/**
Handles all actual API calls to salesforce. 
Implements caching of describe data to prevent excessive API calls continually retrieving it.
**/
"use strict";

Object.create = function(o){
    var result = function(){};
    result.prototype = o;
    return new result();
}

var SObjectType = function(sforceXML){
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
}

var OrganizationSchema = function(){
    if(!(this instanceof OrganizationSchema))
        throw Error("Constructor called as a function.");
    this.sObjectTypes = {};
}

var Connection = {
    sfconnection: null,
    globalDescribe: null,
	fullDescribes: new Object(),
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
            var objType = new SObjectType(describe);
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
			console.log("Got describe: ",describe);
			this.fullDescribes[typeName] = describe;
		}
		return describe;
	}

}

var cache = {
    cachedConnections: {},
    getConnection: function(context){
        if(context == null || context.sessionId == null || context.sid_Client == null)
            throw "Invalid context";
        var result = this.cachedConnections[context.sid_Client];
        if(result == null){
            result = Object.create(Connection);
            this.cachedConnections[context.sid_Client] = result;
            result.sfconnection = new sforce.Connection();
            console.log("Setting up API connection with session Id "+context.masterSessionId+" to "+context.sfhost);
            result.sfconnection.init(context.masterSessionId,"https://"+context.sfhost+"/services/Soap/u/25.0");
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }else{
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }
        result.lastUsed = Date.now();
        return result;
    }

};

var cleanupTimer = 900000; // 15 minutes - value is miliseconds between cleanup runs. 
setInterval(
    function(){
        //Clear out connections unused for x seconds
        var maxConnectionCacheAge = config.getConfig("connection_cleanup_age") * 60 * 1000;
        console.log('Running old connection cleanup. Removing entries older than '+maxConnectionCacheAge+' miliseconds.');
        var now = Date.now();
        for(var key in cache.cachedConnections){
            if( (now - maxConnectionCacheAge) >= cache.cachedConnections[key].lastUsed){
                console.log('removing connection '+key+'. Last used '+cache.cachedConnections[key].lastUsed);
                delete cache.cachedConnections[key];
            }
        }
    },
    cleanupTimer
);

