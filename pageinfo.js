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
		sfhost        : window.location.host.toString()
	};

	chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
		if(request.command == 'getContext') sendResponse(context);
		else throw 'Unknown command ' + request.command;
	});

}());