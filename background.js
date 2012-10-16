/**
Handles all actual API calls to salesforce. 
Implements caching of describe data to prevent excessive API calls continually retrieving it.
**/

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
        sforce.connection = this.sfconnection;
        this.globalDescribe = sforce.connection.describeGlobal();
    },
    getDescribeForId: function(recordId){
        console.log("looking up describe for "+recordId.substring(0,3));
        sforce.connection = this.sfconnection;
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
			sforce.connection = this.sfconnection;
			describe = sforce.connection.describeSObject(typeName);
			console.log("Got describe: ",describe);
			this.fullDescribes[typeName] = describe;
		}
		return describe;
	}

}

var cache = {
    cachedConnections: {},
    getConnection: function(context){
        if(context == null || context.sessionId == null)
            throw "Invalid context";
        var result = this.cachedConnections[context.sessionId];
        if(result == null){
            result = Object.create(Connection);
            this.cachedConnections[context.sessionId] = result;
            sforce.connection.init(context.sessionId,"https://"+context.sfhost+"/services/Soap/u/25.0");
            result.sfconnection = sforce.connection;
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }else{
            sforce.connection = result.connection;
            UserContext.getUrl = function(path){ return "https://"+context.sfhost+path; }; //hack for apex.js to work
        }
        return result;
    }
};

