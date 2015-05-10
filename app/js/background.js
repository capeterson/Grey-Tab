/**
Handles all actual API calls to salesforce. 
Implements caching of describe data to prevent excessive API calls continually retrieving it.
**/
"use strict";

window.onerror = function(message, source, row, col, err){
  GreyTab.log.addMessage("ERROR", {
      message: message,
      file: source,
      row: row,
      column: col,
      errorObject: err
  });
};

GreyTab.API_VERSION = 'v33.0';

Object.create = function(o){
    var result = function(){};
    result.prototype = o;
    return new result();
};

var OrganizationSchema = function(){
    if(!(this instanceof OrganizationSchema))
        throw Error("Constructor called as a function.");
    this.sObjectTypes = {};
};

var SObjectType = function(describeData, connectionId){
    if(describeData == null || describeData == undefined)
        throw Error("First argument cannot be null");
    if(!(this instanceof SObjectType))
        throw Error("Constructor called as a function.");
    this.name = describeData.name;
    this.label = describeData.label;
    this.labelPlural = describeData.label;
    this.activateable = describeData.activateable;
    this.createable = describeData.createable;
    this.custom = describeData.custom;
    this.customSetting = describeData.custom;
    this.deletable = describeData.deletable;
    this.deprecatedAndHidden = describeData.deprecatedAndHidden;
    this.feedEnabled = describeData.feedEnabled;
    this.keyPrefix =  describeData.keyPrefix;
    this.layoutable = describeData.layoutable;
    this.mergeable = describeData.mergeable;
    this.queryable = describeData.queryable;
    this.replicateable = describeData.replicateable;
    this.retrieveable = describeData.retrieveable;
    this.searchable = describeData.searchable;
    this.triggerable = describeData.triggerable;
    this.undeletable = describeData.undeletable;
    this.updateable = describeData.updateable;

    var that = this;
    var fields = null;
    var connectionId = connectionId;
    var fetchFields = function(){
        var res = cache.cachedConnections[connectionId].getFieldsForSObject(that.name);
        fields = [];
        for(var i = 0; i < res.fields.length; i++)
            fields.push( new SObjectField(res.fields[i]) );
    };

    this.getFields = function(){
        fetchFields();
        var result = [];
        for(var fieldName in fields){
            result.push(fields[fieldName]);
        }
        return result;
    };
    this.getField = function(fieldName){
        fetchFields();
        var result = fields[fieldName.toLowerCase()];
        return result;
    };
};

var SObjectField = function(describeData){
    if(!(this instanceof SObjectField))
        throw Error("Constructor called as a function.");
    this.autoNumber = describeData.autoNumber;
    this.byteLength = describeData.byteLength;
    this.calculated = describeData.calculated;
    this.calculated = describeData.calculated;
    this.caseSensitive = describeData.caseSensitive;
    this.createable = describeData.createable;
    this.custom = describeData.custom;
    this.defaultedOnCreate = describeData.defaultedOnCreate;
    this.deprecatedAndHidden = describeData.deprecatedAndHidden;
    this.digits = describeData.digits;
    this.filterable = describeData.filterable;
    this.groupable = describeData.groupable;
    this.idLookup = describeData.idLookup;
    this.label = describeData.label;
    this.length = describeData.length;
    this.name = describeData.name;
    this.nameField = describeData.nameField;
    this.namePointing = describeData.namePointing;
    this.nillable = describeData.nillable;
    this.permissionable = describeData.permissionable;
    this.precision = describeData.precision;
    this.restrictedPicklist = describeData.restrictedPicklist;
    this.scale = describeData.scale;
    this.soapType = describeData.soapType;
    this.sortable = describeData.sortable;
    this.type = describeData.type;
    this.unique = describeData.unique;
    this.updateable = describeData.updateable;
};

//TODO: switch to a constructor
var Connection = {
    connectionId: null, //aka sid_client
    sfconnection: null,
    globalDescribe: null,
	fullDescribes: {},
    lastUsed: Date.now(),
    fetchGlobalDescribe: function(){
        this.globalDescribe = this.sfconnection.describeGlobal();
    },
    getOrganizationSchema: function(){
        //TODO: add better caching (on connection instantiation?)
        if(this.globalDescribe == null)
            this.fetchGlobalDescribe();
        var result = new OrganizationSchema();
        for(var i = 0; i < this.globalDescribe.sobjects.length; i++){
            var describe = this.globalDescribe.sobjects[i];
            var objType = new SObjectType(describe,this.connectionId);
            result.sObjectTypes[objType.name.toLowerCase()] = objType;
        }
        return result;
    },
    getDescribeForId: function(recordId){
        if(this.globalDescribe == null)
            this.fetchGlobalDescribe();
        var result;
        for(var i = 0; i < this.globalDescribe.sobjects.length; i++){
            var describe = this.globalDescribe.sobjects[i];
            if(describe.keyPrefix == recordId.substring(0,3))
                result = describe;
        }
        return result;
    },
	getFieldsForSObject: function(typeName){
		var describe;
		console.log("looking up full describe for "+typeName);
        if(this.fullDescribes[typeName] !== undefined){
			describe = this.fullDescribes[typeName];
		}else {
			describe = this.sfconnection.describeSObject(typeName);
			this.fullDescribes[typeName] = describe;
		}
		return describe;
	}

};

var cache = {
    cachedConnections: {},
    getConnection: function(context){
        if(context == null || context.sessionId == null || context.sid_Client == null)
            throw "Invalid context";
        var result = this.cachedConnections[context.sid_Client];
        if(result == null){
            result = Object.create(Connection);
            result.connectionId = context.sid_Client;
            this.cachedConnections[result.connectionId] = result;
            result.sfconnection = new sforce.Connection();
            GreyTab.log.addMessage("info", "Setting up API connection with session Id "+context.masterSessionId+" to "+context.sfhost);
            result.sfconnection.init(context.masterSessionId,"https://"+context.sfhost+"/services/Soap/u/25.0");
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }else{
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }
        result.lastUsed = Date.now();
        return result;
    },
    removeConnection: function(context){
        if(context == null || context.sessionId == null || context.sid_Client == null){}
            throw "Invalid context: "+context.sid_Client;
        delete this.cachedConnections[context.sid_Client];
    }

};

var cleanupTimer = 900000; // 15 minutes - value is miliseconds between cleanup runs. 
setInterval(
    function(){
        //Clear out connections unused for x seconds
        var maxConnectionCacheAge = config.getConfig("connection_cleanup_age") * 60 * 60 * 1000; //config is hrs - need it in ms
        GreyTab.log.addMessage("debug", 'Running old connection cleanup. Removing entries older than '+maxConnectionCacheAge+' miliseconds.');
        var now = Date.now();
        for(var key in cache.cachedConnections){
            if( (now - maxConnectionCacheAge) >= cache.cachedConnections[key].lastUsed){
                GreyTab.log.addMessage("debug", 'removing connection '+key+'. Last used '+cache.cachedConnections[key].lastUsed);
                delete cache.cachedConnections[key];
            }
        }
    },
    cleanupTimer
);
