/**
 * Finds the salesforce viewstate string, if any, base64 decodes it, and returns its length.
 * This means the result will be blob size, not base64 string size - which is how SFDC calculates it for limit checking
 * @return {Number|null} the size of the current viewstate, in bytes. Null if no view state.
 */
var calculateViewstateSize = function(){
    var result;
    try{
        result = atob(document.getElementById('com.salesforce.visualforce.ViewState').value).length;
    }catch(ex){
        result = null;
    }
    return result;
};

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
};


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
    } else if (match = url.match(/sObject\/\w{15}|sObject\/\w{18}/)) {
        //success; captured id from lightning.force.com/one/one.app?source=aloha#/sObject/000xxxxxxxxxxxxXXX
        return match[0].substr(8)
	} else {
		//failure; not on a page with an id
		return null;
	}
};

/**
 * Initialize page-level session.
 * This is in a different javascript scope than the page's js, so the global isn't as dumb as it seems
 */
(function(){
	var sessionId = getCookie('sid'),
			sessionClient = getCookie('sid_Client');

	window.context = new Map();
	context.currentRecord = getCurrentRecordId((window.location.href));
	context.sessionId = sessionId;
	if(sessionId){
		context.orgId = sessionId.substring(0,15);
	}
	context.sid_Client = sessionClient;
	pod = null;
	sfhost = null;
})();

( function() {
    var instance = null;
    var hostname = window.location.host;
    //modified from http://stackoverflow.com/a/9722468/740787
    var parts = hostname.split("\.");
    if (parts.length == 3)
        instance = parts[0];
    else if (parts.length == 5)
        instance = parts[1];
    else if (parts.length == 4 && parts[1] === "my")
        instance = parts[0]+".my";
    else if (parts.length == 4)
        // my domain on sandbox instances
        instance = parts[0]+"."+parts[1];

    if(instance === null)
        throw new Error("Unable to determine salesforce instance");
    context.pod = instance;

    var isVf = hostname.indexOf(".visual.force.com") > 0;
    if(parts[0].indexOf("--") > 0 && isVf){ //using my domain & this is sandbox or managed vf page
        var subparts = parts[0].split("--");
        context.sfhost = hostname.replace("--"+subparts[subparts.length-1],"").replace(".visual.force.com",".salesforce.com").replace(instance,"my");
    }else if(parts[0].indexOf("--") > 0 && !isVf){ //named sandbox
    	context.sfhost = hostname;
    }else{
        context.sfhost = context.pod + ".salesforce.com";
    }

}());

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	switch(request.command){
        case 'getContext':
            sendResponse(context);
            break;
        case 'getViewstateSize':
            sendResponse(calculateViewstateSize());
            break;
        default:
            throw 'Unknown command ' + request.command;
    }
});
