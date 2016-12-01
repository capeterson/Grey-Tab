var context;
var record = {};
var recordEditedValues = {};
var gatheringWasDone = false;
var GreyTab = chrome.extension.getBackgroundPage().GreyTab;

chrome.tabs.getSelected(null,function(tab) {
    chrome.tabs.sendRequest(tab.id,{command: "getContext"}, function(response){
        context = response;
        chrome.cookies.getAll({domain: context.sfhost, name: "sid"}, function(cookies) {
            for (var i = 0; i < cookies.length; i++) {
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
    chrome.tabs.sendRequest(tab.id,{command: "getViewstateSize"}, function(response) {
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

	$("#currentRecordId").text(record.id);
	$("#sobject_name").text(record.describe.name);
	$("#sobject_label").text(record.describe.label);

	$("#CRUD_c").text(record.describe.createable);
	$("#CRUD_r").text(record.describe.retrieveable);
	$("#CRUD_u").text(record.describe.updateable);
	$("#CRUD_d").text(record.describe.deletable);
	record.value = getFullRecord(record.describe.name, record.id);
	var allFields = '';
	for(var i = 0; i < record.fields.length; i++){
		var field = record.fields[i];
		var fieldValue = record.value.fields[field.name];

		var fieldValueClasses = [];
		fieldValueClasses.push('field-type--' + field.type);
		if (null === fieldValue) {
			fieldValueClasses.push('field-value--null');
		}

		allFields +=
			'<tr class="fieldInfo" data-field-api-name="' + field.name + '" id="'+field.name.toLowerCase()+'">' +
			'    <td class="td-resizable">'+field.label+'</td>' +
			'    <td class="td-resizable">'+field.name+'</td>' +
			'    <td class="td-resizable">'+field.type+'</td>' +
			'    <td class="td-resizable record-data ' + fieldValueClasses.join(' ') + '">' +
            '       <div class="field-value-wrapper">' +
			'           <span class="value">' + escapeHtml(fieldValue) + '</span>' +
            '           <div class="editor">' +
            '               <textarea rows="1" type="text" class="new-value"/>' +
            '               <label><input type="checkbox" class="new-value-is-null"/>NULL</label>' +
            '               <button class="button-save">Save</button>' +
            '               <button class="button-cancel">Undo</button>' +
            '           </div>' +
			'           <span class="button-edit" title="Edit the value">&#9998;</span>' +
			'           <span class="button-reset" title="Undo">&#8634;</span>' +
            '       </div>' +
			'    </td>' +
			'</tr>';
	}
    $('#fieldTable > tbody:last').html('');
	$('#fieldTable > tbody:last').append(allFields);
    showHideComandPanel();
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
						}, 10);
					}
				}
			}
		);
	});
});

$(document).ready(function () {
    var handleEdit = function () {
        var $fieldTr = getClosestFieldTr(this);
        if ($fieldTr.length) {
            var fieldApiName = $fieldTr.attr('data-field-api-name');
            startInlineEditing(fieldApiName);
        }
    };

    var save = function () {
        var $fieldTr = getClosestFieldTr(this);
        var fieldApiname = getFieldApiNameBy$Tr($fieldTr);

        saveInlineEditing(fieldApiname);
        return false;
    };

    var cancel = function () {
        var $fieldTr = getClosestFieldTr(this);
        var fieldApiname = getFieldApiNameBy$Tr($fieldTr);

        cancelInlineEditing(fieldApiname);
        return false;
    };

    var $fieldTable = $('#fieldTable');
    $fieldTable.on('dblclick', 'tr.fieldInfo', handleEdit);
    $fieldTable.on('click', '.button-edit', handleEdit);

    $fieldTable.on('click', '.button-save', save);
    $fieldTable.on('click', '.button-cancel', cancel);
    $fieldTable.on('click', '.button-reset', cancel);

    $fieldTable.on('change', '.new-value-is-null', function () {
        var $fieldTr = getClosestFieldTr(this);
        var $input = $fieldTr.find('.editor .new-value');
        var isChecked = $(this).is(':checked');
        $input.prop("disabled", isChecked);
    });

    $('.command-undo').click(function () {
        $('tr.fieldInfo.edited').each(function () {
            var fieldApiName = getFieldApiNameBy$Tr($(this));
            cancelInlineEditing(fieldApiName);
        });
    });

    $('.command-save').click(function () {
        var newRecord = new sforce.Xml();

        newRecord.Id = record.value.fields['Id'];
        newRecord.type = record.value.fields['type'];

        $.each(recordEditedValues, function(field, value) {
            newRecord[field] = value;
        });

        var rawConnection = chrome.extension.getBackgroundPage().cache.getConnection(context).sfconnection;
        rawConnection.update([newRecord], onUpdate);

        function onUpdate(result) {
            if (result && result[0]) {
                result = result[0];

                if (result.success == 'true') {
                    showLoading();
                    setTimeout(function () {
                        startGathering();
                        hideLoading();
                        gatheringWasDone = true;
                    }, 10);
                } else {
                    if (result.errors) {
                        var error = result.errors;
                        showError(error.statusCode + ': ' + error.message);
                    } else {
                        showError('An error occurred!');
                    }
                }
            }
        }
    });

    (function() {
        var pressed = false;
        var $column = undefined;
        var startX, startWidth;

        $(".table-resizable .th-resizable .resizecolumn").mousedown(function (e) {
            pressed = true;
            startX = e.pageX;
            $column = $(this).parent();
            startWidth = $column.width();
        });

        $(document).mousemove(function (e) {
            if (pressed) {
                $column.width(startWidth + (e.pageX - startX));
            }
        }).mouseup(function() {
            pressed = false;
        });
    })();

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

var isShowedInlineEditor = function($fieldTr) {
    return $fieldTr.hasClass('editing');
};
var showInlineEditor = function($fieldTr, fieldValue) {
    var fieldValueIsNull = (null === fieldValue);

    if (fieldValueIsNull) {
        fieldValue = '';
    }

    $fieldTr.find('.editor .new-value-is-null').prop('checked', fieldValueIsNull).change();
    $fieldTr.find('.editor .new-value').val(fieldValue).change();

    $fieldTr.addClass('editing');
    $fieldTr.find('.editor .new-value').focus();
};
var getValueFromInlineEditor = function($fieldTr) {
    var fieldValue = $fieldTr.find('.editor .new-value').val();
    var fieldValueIsNull = ($fieldTr.find('.editor .new-value-is-null:checked').length !== 0);

    if (fieldValueIsNull || '' == fieldValue) {
        fieldValue = null;
    }

    return fieldValue;
};

var hideInlineEditor = function($fieldTr) {
    $fieldTr.removeClass('editing');
};

var startInlineEditing = function (fieldApiName) {
    if('Id' !== fieldApiName) {
        var $fieldTr = getFieldTrByApiName(fieldApiName);
        if (!isShowedInlineEditor($fieldTr)) {
            var fieldValue = record.value.fields[fieldApiName];
            var newFieldValue = recordEditedValues[fieldApiName];
            if (undefined !== newFieldValue) {
                fieldValue = newFieldValue;
            }
            showInlineEditor($fieldTr, fieldValue);
        }
    }
};

var saveInlineEditing = function (fieldApiName) {
    var $fieldTr = getFieldTrByApiName(fieldApiName);
    var oldfieldValue = record.value.fields[fieldApiName];
    var newFieldValue = getValueFromInlineEditor($fieldTr);

    if (oldfieldValue !== newFieldValue) {
        recordEditedValues[fieldApiName] = newFieldValue;
        changeValueInTable(fieldApiName, newFieldValue);
        $fieldTr.addClass('edited');
    }

    hideInlineEditor($fieldTr);
    showHideComandPanel();
};

var cancelInlineEditing = function (fieldApiName) {
    var $fieldTr = getFieldTrByApiName(fieldApiName);
    var fieldValue = record.value.fields[fieldApiName];
    recordEditedValues[fieldApiName] = undefined;
    changeValueInTable(fieldApiName, fieldValue);
    $fieldTr.removeClass('edited');

    hideInlineEditor($fieldTr);
    showHideComandPanel();
};


var getClosestFieldTr = function(elem) {
    return $(elem).closest('tr.fieldInfo');
};
var getFieldTrByApiName = function(fieldApiName) {
    return $('.fieldInfo[data-field-api-name="' + fieldApiName + '"]');
};
var getFieldApiNameBy$Tr = function($fieldTr) {
    return $fieldTr.attr('data-field-api-name');
};
var changeValueInTable = function (filedApiName, fieldValue) {
    var $fieldTr = getFieldTrByApiName(filedApiName);
    var $fieldValueTd = $fieldTr.find('td.record-data');
    var $fieldValue = $fieldValueTd.find('.value');

    if (null === fieldValue) {
        $fieldValueTd.addClass('field-value--null');
    } else {
        $fieldValueTd.removeClass('field-value--null');
    }

    $fieldValue.html( escapeHtml(fieldValue) );
};

var showHideComandPanel = function () {
    if ($('tr.fieldInfo.edited').length) {
        $('#tab-record').addClass('changed');
    } else {
        $('#tab-record').removeClass('changed');
    }
};

var getFullRecord = function(objectName, recordId){
    var fieldsPerQuery = 200;
    var sobj = new GreyTab.model.SObject();
    var rawConnection = chrome.extension.getBackgroundPage().cache.getConnection(context).sfconnection;

    var fieldsArr = [];
    for(var i = 0; i < record.fields.length; i++){
        if (i % fieldsPerQuery === 0) {
            fieldsArr.push([]);
        }
        if ('Id' !== record.fields[i].name) {
            fieldsArr[fieldsArr.length - 1].push(record.fields[i].name);
        }
    }

    fieldsArr.forEach(function (subArr) {
       if(subArr.length) {
           var fieldSOQL = subArr.join(',');
           sobj.applyFieldData(
               rawConnection.query("SELECT Id, " + fieldSOQL + " FROM " + objectName + " WHERE Id = '" + recordId + "'").records
           );
       }
    });

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
