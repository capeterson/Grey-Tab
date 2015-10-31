/**
Handles all actual API calls to salesforce. 
Implements caching of describe data to prevent excessive API calls continually retrieving it.
**/
"use strict";

window.addEventListener("error", function(message, source, row, col, err){
  GreyTab.log.addMessage("ERROR", {
      message: message,
      file: source,
      row: row,
      column: col,
      errorObject: err
  });
});

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

var SObjectType = function(sforceXML, connectionId){
    if(sforceXML == null || sforceXML == undefined)
        throw Error("First argument cannot be null");
    if(!(this instanceof SObjectType))
        throw Error("Constructor called as a function.");
    this.name = sforceXML.name;
    this.label = sforceXML.label;
    this.labelPlural = sforceXML.label;
    this.activateable = sforceXML.activateable;
    this.createable = sforceXML.createable;
    this.custom = sforceXML.custom;
    this.customSetting = sforceXML.custom;
    this.deletable = sforceXML.deletable;
    this.deprecatedAndHidden = sforceXML.deprecatedAndHidden;
    this.feedEnabled = sforceXML.feedEnabled;
    this.keyPrefix =  sforceXML.keyPrefix;      
    this.layoutable = sforceXML.layoutable;
    this.mergeable = sforceXML.mergeable;
    this.queryable = sforceXML.queryable;
    this.replicateable = sforceXML.replicateable;
    this.retrieveable = sforceXML.retrieveable;
    this.searchable = sforceXML.searchable;
    this.triggerable = sforceXML.triggerable;
    this.undeletable = sforceXML.undeletable;
    this.updateable = sforceXML.updateable;

    var that = this;
    var fields = null;

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

var SObjectField = function(sforceXML){
    if(!(this instanceof SObjectField))
        throw Error("Constructor called as a function.");
    this.autoNumber = sforceXML.autoNumber;
    this.byteLength = sforceXML.byteLength;
    this.calculated = sforceXML.calculated;
    this.calculated = sforceXML.calculated;
    this.caseSensitive = sforceXML.caseSensitive;
    this.createable = sforceXML.createable;
    this.custom = sforceXML.custom;
    this.defaultedOnCreate = sforceXML.defaultedOnCreate;
    this.deprecatedAndHidden = sforceXML.deprecatedAndHidden;
    this.digits = sforceXML.digits;
    this.filterable = sforceXML.filterable;
    this.groupable = sforceXML.groupable;
    this.idLookup = sforceXML.idLookup;
    this.label = sforceXML.label;
    this.length = sforceXML.length;
    this.name = sforceXML.name;
    this.nameField = sforceXML.nameField;
    this.namePointing = sforceXML.namePointing;
    this.nillable = sforceXML.nillable;
    this.permissionable = sforceXML.permissionable;
    this.precision = sforceXML.precision;
    this.restrictedPicklist = sforceXML.restrictedPicklist;
    this.scale = sforceXML.scale;
    this.soapType = sforceXML.soapType;
    this.sortable = sforceXML.sortable;
    this.type = sforceXML.type;
    this.unique = sforceXML.unique;
    this.updateable = sforceXML.updateable;
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
        if(context == null || context.sessionId == null || context.sid_Client == null) {
            throw "Invalid context: " + context.sid_Client;
        }
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
