var context;
var record = new Object();

chrome.tabs.getSelected(null,function(tab)
{
    chrome.tabs.sendRequest(tab.id,{command: "getContext"}, function(response){
        context = response;
        chrome.cookies.getAll({domain: context.sfhost, name: "sid"}, function(cookies){
            for(var i = 0; i < cookies.length; i++){
                if(cookies[i].domain == context.sfhost){
                    console.log("Setting master sessionId to ",cookies);
                    context.masterSessionId = cookies[i].value;
                }else{
                	console.log("ignoring session cookie for mismatched host",cookies[i]);
                }
            }
        });
        populateSessionDetails();
    });
}); 

var gatherRecordInfo = function(){
	record.id = context.currentRecord;
	record.describe = getDescribeForId(record.id);
	record.fields = getFields(record.describe.name);
	$("#currentRecordId").text(context.currentRecord);
	$("#sobject_name").text(record.describe.name);
	$("#sobject_label").text(record.describe.label);
	$("#CRUD_c").text(record.describe.createable);
	$("#CRUD_r").text(record.describe.retrieveable);
	$("#CRUD_u").text(record.describe.updateable);
	$("#CRUD_d").text(record.describe.deletable);
	record.values = getFullRecord(record.id);
	for(var i = 0; i < record.fields.length; i++){
		var field = record.fields[i];
		console.log("Field: ",field);
		$('#fieldTable > tbody:last').append("<tr><td>"+field.name+"</td><td>"+field.label+"</td><td>"+record.values[field.name]+"</td></tr>");
	}
	console.log();
}

 $(document).ready(function() {
            $(function() {
		        $( "#tabs" ).tabs();
				$( "#tabs" ).bind(
					"tabsselect",function(event,ui){ 
						if(ui.tab.hash === "#tab-schema"){
							gatherRecordInfo();
						}
					}
				);
    	    });
        });

var getFullRecord = function(recordId){
	var fieldSOQL = "";
	for(var i = 0; i < record.fields.length; i++){
		var field = record.fields[i];
		fieldSOQL += field.name+", ";
	}
	fieldSOQL = fieldSOQL.substring(0,fieldSOQL.length-2);
	//SOQL injection ahoy! Fix this!
	return chrome.extension.getBackgroundPage().cache.getConnection(context).sfconnection.query("select "+fieldSOQL+" from "+record.describe.name+" WHERE Id = '"+record.id+"'").records;
}
		
var getFields = function(typeName){
	console.log("sending request for "+typeName);
	var bkg = chrome.extension.getBackgroundPage();
    var fields = bkg.cache.getConnection(context).getFieldsForSObject(typeName).fields;
	return fields;
}
var getDescribeForId = function(recordId){
    console.log("sending request for "+recordId);
    var bkg = chrome.extension.getBackgroundPage();
    return bkg.cache.getConnection(context).getDescribeForId(recordId);
}

var populateSessionDetails = function(){
	console.log("populating session details",context);
    document.getElementById("sessionId").innerHTML = context.sessionId;
    document.getElementById("sfhost").innerHTML = context.sfhost;
    document.getElementById("orgId").innerHTML = context.orgId;
    document.getElementById("userId").innerHTML = context.userId;  
}
var populateCRUD = function(recordId){
    var describe = getDescribeForId(recordId);
    console.log('populating data for describe');
    console.log(describe);
    $('#CRUD > tbody:last').after('<tr><td>'+describe.createable+'</td><td>'+describe.queryable+'</td><td>'+describe.updateable+'</td><td>'+describe.deletable+'</td></tr>');
}