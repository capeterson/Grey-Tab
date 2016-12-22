var context;
var records = {};
var recordEditedValues = {};
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

var gatherRecordInfo = function(recordId, callback){
    showLoading();
    setTimeout(function () {
        var record = {};
        record.id = recordId;

        try {
            record.describe = getDescribeForId(record.id);
            record.fields = getFields(record);
            record.value = getFullRecord(record);
        } catch (ex) {
            if (ex.faultcode == "sf:INVALID_SESSION_ID") {
                invalidateSession();
                showError("Your salesforce session is invalid. Please reload the page and try again.");
            } else {
                var message = ex.exceptionMessage;
                if (message === undefined) { message = ex.message; }
                if (message === undefined) { message = ex; }
                showError("An error occured trying to load record details: " + message);
            }
        }
        hideLoading();
        callback(record);
    }, 0);
};

var invalidateSession = function(){
	chrome.extension.getBackgroundPage().cache.removeConnection(context);
};

$(document).ready(function() {
    $(document).on('keyup','.search-input', filterFields);
    var $tabs = $("#tabs").tabs();
    $tabs.bind(
        "tabsselect", function(event, ui){
            if(ui.tab.hash === "#tab-record"){
                setTimeout(function () {
                    openCurrentRecord();
                    $('[href=#tab-record]').closest('li').remove();
                    $("#tabs").tabs('refresh');
                }, 1);
            }
        }
    );

    $tabs.on('click', '.close-tab', function () {
        var tabId = $(this).closest("li").remove().attr("aria-controls");
        $("#" + tabId).remove();
        $tabs.tabs("refresh");

        delete records[tabId];
        delete recordEditedValues[tabId];
    });

     $('form[name=open-record]').submit(function(e){
         var $input = $(this).find('input[name=record-id]');
         var recordId = $input.val().trim();
         $input.val('');
         openRecord(recordId);
         e.preventDefault();
     });

    var handleEdit = function () {
        var $fieldTr = getClosestFieldTr(this);
        if ($fieldTr.length) {
            if (!isShowedInlineEditor($fieldTr)) {
                startInlineEditing($fieldTr);
            }
        }
    };

    var save = function () {
        var $fieldTr = getClosestFieldTr(this);
        saveInlineEditing($fieldTr);
        return false;
    };

    var cancel = function () {
        var $fieldTr = getClosestFieldTr(this);
        cancelInlineEditing($fieldTr);
        return false;
    };

    var reloadRecord = function () {
        var $fieldTr = $(this).closest('.record').find('tr.fieldInfo');
        var recordTabId = getRecordTabIdBy$Tr($fieldTr);
        refreshRecord(recordTabId);
    };

    $(document).on('click', '.record-details .reload-record', reloadRecord);
    $(document).on('dblclick', '.fieldTable tr.fieldInfo', handleEdit);
    $(document).on('click', '.fieldTable .button-edit', handleEdit);

    $(document).on('click', '.fieldTable .button-save', save);
    $(document).on('click', '.fieldTable .button-cancel', cancel);
    $(document).on('click', '.fieldTable .button-reset', cancel);

    $(document).on('change', '.fieldTable .new-value-is-null', function () {
        var $fieldTr = getClosestFieldTr(this);
        var $input = $fieldTr.find('.editor .new-value');
        var isChecked = $(this).is(':checked');
        $input.prop("disabled", isChecked);
    });

    $(document).on('click', '.record .command-undo', function () {
        $(this).closest('.record').find('tr.fieldInfo').each(function () {
            cancelInlineEditing($(this));
        });
    });

    $(document).on('click', '.record .command-save', function () {
        var $fieldTr = $(this).closest('.record').find('tr.fieldInfo');
        var recordTabId = getRecordTabIdBy$Tr($fieldTr);
        var newRecord = new sforce.Xml();

        newRecord.Id = records[recordTabId].value.fields.Id;
        newRecord.type = records[recordTabId].value.fields.type;

        $.each(recordEditedValues[recordTabId], function(field, value) {
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
                        refreshRecord(recordTabId);
                        hideLoading();
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

        $(document).on("mousedown", ".table-resizable .th-resizable .resizecolumn", function(e) {
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

var openCurrentRecord = function () {
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
        openRecord(context.currentRecord);
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

var startInlineEditing = function ($fieldTr) {
    if (!isShowedInlineEditor($fieldTr)) {
        var recordTabId = getRecordTabIdBy$Tr($fieldTr);
        var fieldApiName = getFieldApiNameBy$Tr($fieldTr);
        var fieldValue = records[recordTabId].value.fields[fieldApiName];
        var newFieldValue = recordEditedValues[recordTabId][fieldApiName];
        if (undefined !== newFieldValue) {
            fieldValue = newFieldValue;
        }
        showInlineEditor($fieldTr, fieldValue);
    }
};

var saveInlineEditing = function ($fieldTr) {
    var recordTabId = getRecordTabIdBy$Tr($fieldTr);
    var fieldApiName = getFieldApiNameBy$Tr($fieldTr);
    var oldfieldValue = records[recordTabId].value.fields[fieldApiName];
    var newFieldValue = getValueFromInlineEditor($fieldTr);

    if (oldfieldValue !== newFieldValue) {
        recordEditedValues[recordTabId][fieldApiName] = newFieldValue;
        changeValueInTable($fieldTr, newFieldValue);
        $fieldTr.addClass('edited');
    }

    hideInlineEditor($fieldTr);
    showHideCommandPanel();
};

var cancelInlineEditing = function ($fieldTr) {
    var recordTabId = getRecordTabIdBy$Tr($fieldTr);
    var fieldApiName = getFieldApiNameBy$Tr($fieldTr);
    var fieldValue = records[recordTabId].value.fields[fieldApiName];
    recordEditedValues[recordTabId][fieldApiName] = undefined;
    changeValueInTable($fieldTr, fieldValue);
    $fieldTr.removeClass('edited');

    hideInlineEditor($fieldTr);
    showHideCommandPanel();
};


var getClosestFieldTr = function(elem) {
    return $(elem).closest('tr.fieldInfo');
};

var getFieldApiNameBy$Tr = function($fieldTr) {
    return $fieldTr.attr('data-field-api-name');
};
var getRecordTabIdBy$Tr = function($fieldTr) {
    return $fieldTr.closest('.record').attr('id');
};

var changeValueInTable = function ($fieldTr, fieldValue) {
    var $fieldValueTd = $fieldTr.find('td.record-data');
    var $fieldValue = $fieldValueTd.find('.value');

    if (null === fieldValue) {
        $fieldValueTd.addClass('field-value--null');
    } else {
        $fieldValueTd.removeClass('field-value--null');
    }

    $fieldValue.text(fieldValue);
};

var showHideCommandPanel = function () {
    $('.record').each(function () {
        var $this = $(this);
        if ($this.find('tr.fieldInfo.edited').length) {
            $this.addClass('changed');
        } else {
            $this.removeClass('changed');
        }
    });
};

var getFullRecord = function(record){
    var fieldsPerQuery = 200;
    var sobj = new GreyTab.model.SObject();
    var rawConnection = chrome.extension.getBackgroundPage().cache.getConnection(context).sfconnection;

    var fieldsArr = [];
    for(var i = 0; i < record.fields.length; i++){
        if (i % fieldsPerQuery === 0) {
            fieldsArr.push([]);
        }
        if ('Id' !== record.fields[i].name) {
            fieldsArr[fieldsArr.length - 1].push( soqlEscapeString(record.fields[i].name) );
        }
    }

    fieldsArr.forEach(function (subArr) {
       if(subArr.length) {
           var fieldSOQL = subArr.join(',');
           sobj.applyFieldData(
               rawConnection.query("SELECT Id, " + fieldSOQL + " FROM " + record.describe.name + " WHERE Id = '" + soqlEscapeString(record.id) + "'").records
           );
       }
    });

    return sobj;
};

var soqlEscapeString = function(unescapedString) {
    return unescapedString.replace('/(\\n|\\N|\\r|\\R|\\t|\\T|\\b|\\B|\\f|\\F|"|\'|\\\\)/g', "\\$1");
};

var getFields = function(record){
	console.log("sending request for "+record.describe.name);
	var bkg = chrome.extension.getBackgroundPage();
    var fields = bkg.cache.getConnection(context).getFieldsForSObject(record.describe.name).fields;
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

var filterFields = function(){
    var $tab = $(this).closest('.record');
    var searchText = $(this).val().toLowerCase();
    if (searchText === '') {
        showAll($tab);
    } else {
        applySearchFilter($tab, searchText);
    }
};

var showAll = function($tab){
    $tab.find('tr').each(function(){
        $(this).show();
    });
};

var applySearchFilter = function($tab, searchText){
    $tab.find('.fieldTable tr.fieldInfo').each(function(index,el){
		var matchedTerm = false;
		for(var i = 0; i < el.children.length; i++){
			if($(el.children[i]).find('.searchable').text().toLowerCase().indexOf(searchText.toLowerCase()) !== -1){
				matchedTerm = true;
				break;
			}
		}
		if(matchedTerm){
			$(el).show();
		}else{
			$(el).hide();
		}
	});
};


var openRecord = function(recordId) {
    var recordTabId = `record-${+ new Date().getUTCMilliseconds()}`;
    var $tab = $(TEMPLATES.record);
    var $tabLink = $(TEMPLATES.tabLink);

    $tabLink.find('.title')
        .attr('href', `#${recordTabId}`)
        .text(recordId);

    $tab.attr('id', recordTabId);
    $tab.attr('data-record-id', recordId);

    $('a[href=#open-record]:first').parent().before($tabLink);
    $('#tabs:last').append($tab);
    $("#tabs").tabs('refresh').tabs('select', $tabLink.find('.title').attr('href'));

    gatherRecordInfo(recordId, function (record) {
        records[recordTabId] = record;
        recordEditedValues[recordTabId] = {};
        displayRecord($tab, record);
    });
};

var refreshRecord = function(recordTabId) {
    var $tab = $('#' + recordTabId);
    if ($tab.length) {
        var recordId = $tab.attr('data-record-id');

        var $emptyTab = $(TEMPLATES.record);
        $tab.html($emptyTab.html());

        gatherRecordInfo(recordId, function (record) {
            records[recordTabId] = record;
            recordEditedValues[recordTabId] = {};
            displayRecord($tab, record);
        });
    }
};

var displayRecord = function ($tab, record) {
    var $recordDetails  = $tab.find('.record-details');

    $recordDetails.find(".recordId").text(record.id);
    $recordDetails.find(".sobject_name").text(record.describe.name);
    $recordDetails.find(".sobject_label").text(record.describe.label);

    $recordDetails.find(".CRUD_c").text(record.describe.createable);
    $recordDetails.find(".CRUD_r").text(record.describe.retrieveable);
    $recordDetails.find(".CRUD_u").text(record.describe.updateable);
    $recordDetails.find(".CRUD_d").text(record.describe.deletable);

    $tab.find('.fieldTable > tbody:last');

    for(var i = 0; i < record.fields.length; i++){
        var $tr = $(TEMPLATES.fieldTr);

        var field = record.fields[i];
        var fieldValue = record.value.fields[field.name];

        $tr.find('.record-data').addClass('field-type--' + field.type);
        if (null === fieldValue) {
            $tr.find('.record-data').addClass('field-value--null');
        }

        $tr.attr('data-field-api-name', field.name);
        $tr.find('.field-label').text(field.label);
        $tr.find('.field-name').text(field.name);
        $tr.find('.field-type').text(field.type);
        $tr.find('.field-value').text(fieldValue);

        $tab.find('.fieldTable > tbody:last').append($tr);
    }

    showHideCommandPanel();
};

var TEMPLATES = {
    tabLink: `<li><a href="" class="title"></a><span class="close-tab">x</span></li>`,
    record : `            
            <div class="record">
                <table class="record-details">
                    <tr>
                        <td class="left">
                            <div class="record-details-title">
                                Currently viewing record
                                <button class="reload-record">reload &#8634;</button>
                            </div>
                            <table>
                                <tr>
                                    <th>Record Id</th>
                                    <td class="recordId">UNDEFINED</td>
                                </tr>
                                <tr>
                                    <th title="Also known as the API Name">SObject Name</th>
                                    <td class="sobject_name">UNDEFINED</td>
                                </tr>
                                <tr>
                                    <th>SObject Label</th>
                                    <td class="sobject_label">UNDEFINED</td>
                                </tr>
                            </table>
                        </td>
                        <td class="right">
                            <div class="record-details-title">CRUD Permissions</div>
                            <table>
                                <tr>
                                    <th>Creatable</th>
                                    <td class="CRUD_c"></td>
                                </tr>
                                <tr>
                                    <th>Readable</th>
                                    <td class="CRUD_r"></td>
                                </tr>
                                <tr>
                                    <th>Updateable</th>
                                    <td class="CRUD_u"></td>
                                </tr>
                                <tr>
                                    <th>Deletable</th>
                                    <td class="CRUD_d"></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <div class="search-form">
                    Field Search: <input class="search-input" placeholder="Search..." />
                </div>
                <table class="fieldTable table-resizable">
                    <thead>
                        <tr>
                            <th class="th-resizable" width="25%">Field Label<span class="resizecolumn"></span></th>
                            <th class="th-resizable" width="25%">API Name<span class="resizecolumn"></span></th>
                            <th class="th-resizable" width="15%">Type<span class="resizecolumn"></span></th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                    
                    </tbody>
                </table>
                <div class="command-panel">
                    <button class="command-save">Save Record</button>
                    <button class="command-undo">Undo All</button>
                </div>
            </div>
        </div>`,
    fieldTr : `
            <tr class="fieldInfo">
			    <td class="td-resizable field-label searchable"></td>
			    <td class="td-resizable field-name searchable"></td>
			    <td class="td-resizable field-type searchable"></td>
			    <td class="td-resizable record-data">
                   <div class="field-value-wrapper">
			           <span class="value field-value searchable"></span>
                       <div class="editor">
                           <textarea rows="1" class="new-value"/>
                           <label><input type="checkbox" class="new-value-is-null"/>NULL</label>
                           <button class="button-save">Save</button>
                           <button class="button-cancel">Undo</button>
                       </div>
			           <span class="button-edit" title="Edit the value">&#9998;</span>
			           <span class="button-reset" title="Undo">&#8634;</span>
                   </div>
			    </td>
			</tr>`
};