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

var Connection = {
    sfconnection: null,
    globalDescribe: null,
	fullDescribes: new Object(),
    fetchGlobalDescribe: function(){
        this.globalDescribe = this.sfconnection.describeGlobal();
    },
    getDescribeForId: function(recordId){
        console.log("looking up describe for "+recordId.substring(0,3));
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
        var result = this.cachedConnections[context.sessionId];
        if(result == null){
            result = Object.create(Connection);
            this.cachedConnections[context.sessionId] = result;
            result.sfconnection = new sforce.Connection();
            console.log("Setting up API connection with session Id "+context.masterSessionId+" to "+context.sfhost);
            result.sfconnection.init(context.masterSessionId,"https://"+context.sfhost+"/services/Soap/u/25.0");
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }else{
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }
        return result;
    }
};

