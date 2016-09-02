var context;
var record = {};
var gatheringWasDone = false;
var GreyTab = chrome.extension.getBackgroundPage().GreyTab;

chrome.tabs.getSelected(null,function(tab)
{
    chrome.tabs.sendRequest(tab.id,{command: "getContext"}, function(response){
        context = response;
        chrome.cookies.getAll({domain: context.sfhost, name: "sid"}, function(cookies){
            for(var i = 0; i < cookies.length; i++){
                if(cookies[i].domain == context.sfhost){
                    GreyTab.log.addMessage("DEBUG", {
                        event: "Setting master sessionId",
                        value: cookies[i]
                    });
                    context.masterSessionId = cookies[i].value;
                }else{
                	GreyTab.log.addMessage("DEBUG", {
                        event: "ignoring session cookie for mismatched host: ",
                        value: cookies[i]
                    });
                }
            }
        });
        populateSessionDetails();
    });
    chrome.tabs.sendRequest(tab.id,{command: "getViewstateSize"}, function(response){
        try{
        	if(response === null){
        		$("#viewstate").hide();
	        }else{
	        	var formattedSize = (response / 1024.0).toFixed(2);
	        	if(isNaN(formattedSize))
	        		$("#viewstateUsed").text("0kB");
	        	else
	        		$("#viewstateUsed").text(formattedSize+"kB");
	        }
	    }catch(ex){
	    	$("#viewstateUsed").text("Unable to calculate.");
	    	GreyTab.log.addMessage("ERROR", {
                event: 'Calculating viewstate failed',
                value: ex
            });
	    }
    });
});

var getOrganizationSchema = function(){
	var bkg = chrome.extension.getBackgroundPage();
    return bkg.cache.getConnection(context).getOrganizationSchema();
};

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
	record.value = getFullRecord(record.id);
	var allFields = '';
	for(var i = 0; i < record.fields.length; i++){
		var field = record.fields[i];
		var fieldValue = record.value.fields[field.name];

		var fieldValueClasses = [];
		fieldValueClasses.push('record-data');
		fieldValueClasses.push('field-type--' + field.type);
		if (null === fieldValue) {
			fieldValueClasses.push('field-value--null');
		}

		allFields +=
			'<tr class="fieldInfo" id='+field.name.toLowerCase()+'>' +
			'    <td>'+field.label+'</td>' +
			'    <td>'+field.name+'</td>' +
			'    <td>'+field.type+'</td>' +
			'    <td class="' + fieldValueClasses.join(' ') + '">' + escapeHtml(fieldValue) + '</td>' +
			'</tr>';
	}
	$('#fieldTable > tbody:last').append(allFields);
};

var invalidateSession = function(){
	chrome.extension.getBackgroundPage().cache.removeConnection(context);
};

 $(document).ready(function() {
    document.getElementById('search').addEventListener('keyup', filterFields);
	$(function() {
		$( "#tabs" ).tabs();
		$( "#tabs" ).bind(
			"tabsselect",function(event,ui){
				if(ui.tab.hash === "#tab-record"){
					if (true !== gatheringWasDone) {
						showLoading();
						setTimeout(function () {
							startGathering();
							hideLoading();
							gatheringWasDone = true;
						}, 0);
					}
				}
			}
		);
	});
});

var startGathering = function () {
	var isError = false;

	if(undefined === context){
		showError("Context are not loaded.");
		isError = true;
	} else {
		if (undefined === context.currentRecord || null === context.currentRecord) {
			showError("No record Id found in the current page's URL.");
			isError = true;
		}
	}

	if (!isError) {
		try {
			gatherRecordInfo();
		} catch (ex) {
			isError = true;
			if (ex.faultcode == "sf:INVALID_SESSION_ID") {
				invalidateSession();
				showError("Your salesforce session is invalid. Please reload the page and try again.");
			} else {
				showError("An error occured trying to load record details: " + ex.exceptionMessage);
			}
		}
	}
};

var showLoading = function(){
	$('.loading').show();
};
var hideLoading = function(){
	$('.loading').hide();
};

var showError = function (errorMessage) {
	$("#dialog-message").text(errorMessage);
	$("#dialog").dialog({
		title:  "Error",
		resizable: false,
		modal: true,
		buttons: {
			Ok: function(){
				$(this).dialog("close");
			}
		}
	});
};

var getFullRecord = function(recordId){
	var fieldSOQL = "",
		fieldsPerQuery = 100,
		sobj = new GreyTab.model.SObject(),
		rawConnection = chrome.extension.getBackgroundPage().cache.getConnection(context).sfconnection;
	for(var i = 0; i < record.fields.length; i++){
		var field = record.fields[i];
		fieldSOQL += field.name+", ";

		if(i % fieldsPerQuery === 0){
			fieldSOQL = fieldSOQL.substring(0,fieldSOQL.length-2);
			sobj.applyFieldData(
				rawConnection.query("select "+fieldSOQL+" from "+record.describe.name+" WHERE Id = '"+record.id+"'").records
			);
			fieldSOQL = ""; //reset for the next query
		}
	}
	if(fieldSOQL !== ""){ //need to query the leftovers if we didn't end on a multiple of fieldsPerQuery
		fieldSOQL = fieldSOQL.substring(0,fieldSOQL.length-2);
		sobj.applyFieldData(
			rawConnection.query("select "+fieldSOQL+" from "+record.describe.name+" WHERE Id = '"+record.id+"'").records
		);
	}

	//SOQL injection ahoy! Fix this!
	return sobj;
};
		
var getFields = function(typeName){
	console.log("sending request for "+typeName);
	var bkg = chrome.extension.getBackgroundPage();
    var fields = bkg.cache.getConnection(context).getFieldsForSObject(typeName).fields;
	return fields;
};

var getDescribeForId = function(recordId){
    console.log("sending request for "+recordId);
    var bkg = chrome.extension.getBackgroundPage();
    return bkg.cache.getConnection(context).getDescribeForId(recordId);
};

var populateSessionDetails = function(){
	console.log("populating session details",context);
    document.getElementById("sessionId").innerHTML = context.sessionId;
    document.getElementById("sfhost").innerHTML = context.sfhost;
    document.getElementById("orgId").innerHTML = context.orgId;
};

var populateCRUD = function(recordId){
    var describe = getDescribeForId(recordId);
    console.log('populating data for describe');
    console.log(describe);
    $('#CRUD > tbody:last').after('<tr><td>'+describe.createable+'</td><td>'+describe.queryable+'</td><td>'+describe.updateable+'</td><td>'+describe.deletable+'</td></tr>');
};

var filterFields = function(){
    var searchText = $('#search').val().toLowerCase();
    if (searchText === '') {
        showAll();
    } else {
        applySearchFilter(searchText);
    }
};

var showAll = function(){
    $('tr').each(function(){
        $(this).show();
    });
};

var applySearchFilter = function(searchText){
	$('#fieldTable tr.fieldInfo').each(function(index,el){
		var matchedTerm = false;
		for(var i = 0; i < el.children.length; i++){ 
			if(el.children[i].textContent.toLowerCase().indexOf(searchText.toLowerCase()) !== -1){
				matchedTerm = true;
				break;
			} 
		}
		if(matchedTerm){
			$(el).show();
		}else{
			$(el).hide();
		}
	})
};
