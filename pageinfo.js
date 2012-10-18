
//isolate from global scope
(function() {
	/**
	 * Get cookie value
	 * @param key
	 * @return {String|null}
	 */
	var getCookie = function(key) {
		var decode = function(value) {return decodeURIComponent(value.replace(/\+/g, ' '));};
		var cookies = document.cookie.split('; ');
		for (var i = 0, l = cookies.length; i < l; i++) {
			var parts = cookies[i].split('=');
			if (decode(parts.shift()) === key) {
				//success; found the key!
				return decode(parts.join('='));
			}
		}
		//failure; no such key
		return null;
	}
    
    /**
     * Takes any of the various forms of SFDC hostnames and spits out a "standard" format
     * @return {String}
     */
    var cleanupHost = function(hostname){
        var result = "";
        var hostname = hostname.replace("visual.force.com","salesforce.com");
        var hostparts = hostname.split("\.");
        if(hostparts[hostparts.length-3] === "my") //as in my.salesforce.com
            result = hostparts[hostparts.length-4]+"."+hostparts[hostparts.length-3]+".";
        result = result+hostparts[hostparts.length-2]+"."+hostparts[hostparts.length-1];
        return result;
    }  

	/**
	 * Get URL parameters
	 * @return {Array}
	 */
	var getUrlParam = function(param) {
		var hash, params = [];
		var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
		for(var i = 0; i < hashes.length; i++)    {
			hash = hashes[i].split('=');
			params.push(hash[0]);
			params[hash[0]] = hash[1];
		}
		return params[param] || null;
	};



	/**
	 * Good ol Carlos - get record Id
	 * @param url
	 */
	var getCurrentRecordId = function(url) {
		var href, iframehtml, id, theMatch, startParam;
		try{
			startParam = getUrlParam('timetracker_start');
		}catch(err){
			console.log(err);
		}

		var match;
		if (match = url.match(/\.com\/\w{15}|\.com\/\w{18}/)) {
			//success; captured id from salesforce.com/000xxxxxxxxxxxxXXX)
			return match[0].substr(5);
		} else if (match = url.match(/id\=\w{15}|id\=\w{18}/)) {
			//success; captured id from salesforce.com/id=000xxxxxxxxxxxxXXX
			return match[0].substr(3);
		} else {
			//failure; not on a page with an id
			return null;
		}
	};

	var context = {
		currentRecord : getCurrentRecordId(window.location.href),
		sessionId     : getCookie('sid'),
		orgId         : getCookie('oid'),
		userId        : '005E' + getCookie('sid_Client').substring(0,11),
		sfhost        : cleanupHost(window.location.host.toString()),
		sid_client    : getCookie('sid_client')
	};

	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		if(request.command == 'getContext') sendResponse(context);
		else throw 'Unknown command ' + request.command;
	});

}());