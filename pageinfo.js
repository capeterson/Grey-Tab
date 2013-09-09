var podMapping = {
  "ssl": "0",
  "na1": "3",
  "na2": "4",
  "na3": "5",
  "na4": "6",
  "na5": "7",
  "na6": "8",
  "na7": "A",
  "na8": "C",
  "na9": "E",
  "na10": "F",
  "na11": "G",
  "na12": "U",
  "na13": "a",
  "na14": "d",
  "na15": "i",
  "ap": "1",
  "ap1": "9",
  "emea": "2",
  "eu1": "D",
  "eu2": "b",
  "tapp0": "T",
  "cs1": "S",
  "cs2": "R",
  "cs3": "Q",
  "cs4": "P",
  "cs5": "O",
  "cs6": "N",
  "cs7": "M",
  "cs8": "L",
  "cs9": "K",
  "cs10": "J",
  "cs11": "Z",
  "cs12": "V",
  "cs13": "W",
  "cs14": "c",
  "cs15": "e",
  "cs16": "f",
  "cs17": "g",
  "prerelna1.pre": "t"
}

/**
 * Finds the salesforce viewstate string, if any, base64 decodes it, and return's it's length.
 * The length returned is the blob's lenght, NOT the base64 string - which is how SFDC calculates it
 * @return {integer|null}
 */
var calculateViewstateSize = function(){
    var restult;
    try{
        result = atob(document.getElementById('com.salesforce.visualforce.ViewState').value).length;
    }catch(ex){
        result = null;
    }
    return result;
}

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
	orgId         : getCookie('sid').substring(0,15),
	userId        : null,
	sid_Client    : getCookie('sid_Client'),
	pod           : null,
	sfhost        : null
};

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
    
    if(instance === null)
        throw new Error("Unable to determine salesforce instance");
    context.pod = instance;
    context.userId = !!podMapping[instance] ? '005' + podMapping[instance] + getCookie('sid_Client').substring(0,11) : 'Unable to determine';
    
    var isVf = hostname.indexOf(".visual.force.com") > 0;
    if(parts[0].indexOf("--") > 0 && isVf){ //using my domain & this is sandbox or managed vf page
        var subparts = parts[0].split("--");
        context.sfhost = hostname.replace("--"+subparts[subparts.length-1],"").replace(".visual.force.com",".salesforce.com").replace(instance,"my");
    }else{
        context.sfhost = context.pod + ".salesforce.com";
    } 
    
}());

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	if(request.command == 'getContext') 
	    sendResponse(context);
	else if(request.command == 'getViewstateSize')
	    sendResponse(calculateViewstateSize());
	else 
	    throw 'Unknown command ' + request.command;
});