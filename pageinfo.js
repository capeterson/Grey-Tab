var sfcontext = new Object();
var getCookie = function(name){
	var i,x,y,ARRcookies=document.cookie.split(";");
	for (i=0;i<ARRcookies.length;i++)
	{
		x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
		y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
		x=x.replace(/^\s+|\s+$/g,"");
		if (x==name){
			return unescape(y);
		}
	}
}
	
chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse)
	{
		if(request.command == "getContext")
			sendResponse(sfcontext);
		else
			throw "Unknown command "+request.command;
 	}
);	

//Good ol Carlos - get record Id
function getUrlVars(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)    {
		hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
	}    
	return vars;
};
var href, iframehtml, id, theMatch, startParam;
try{
	startParam = getUrlVars().timetracker_start;
}catch(err){
	console.log(err);
}
href = window.location.href;
theMatch = /\.com\/\w{15}|\.com\/\w{18}/;
var defaultPages = href.match(theMatch);
if (defaultPages != null) {	
	id = defaultPages[0].substr(5);
} else {
	theMatch = /id\=\w{15}|id\=\w{18}/;
	var customPages = href.match(theMatch);
	if (customPages != null) {
		id = customPages[0].substr(3);
	} else {
		id = null;	
	}
}
//End Carlos

sfcontext.currentRecord = id;
sfcontext.sessionId = getCookie("sid");
sfcontext.orgId = getCookie("oid");
sfcontext.userId = "005E"+getCookie("sid_Client").substring(0,11);
sfcontext.sfhost = window.location.host.toString();
