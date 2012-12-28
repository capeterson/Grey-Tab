"use strict";

var config = {
	defaults: {
		connection_cleanup_age: 4
	},
	getConfig: function(configName){
		var configValue = localStorage[configName];
		if(configValue == null || configValue == undefined)
			configValue = defaults[configName];
		return configValue;
	}
}