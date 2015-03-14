"use strict";

var options = {
    connection_cleanup_age: null
};
var log = chrome.extension.getBackgroundPage().log;

// Saves options to localStorage.
function save_options() {
    options.connection_cleanup_age = document.getElementById("connection_cleanup_age").value;
    localStorage.connection_cleanup_age = options.connection_cleanup_age;

    // Update status to let user know options were saved.
    var status = document.getElementById("status");
    status.innerHTML = "Options Saved.";
    setTimeout(function () {
        status.innerHTML = "";
    }, 750);
}

// Restores select box state to saved value from localStorage.
function restore_options() {

    options.connection_cleanup_age = localStorage["connection_cleanup_age"];
    document.getElementById("connection_cleanup_age").value = options.connection_cleanup_age;
    document.getElementById('save').addEventListener('click', save_options);
}

document.addEventListener('DOMContentLoaded', function () {
    restore_options();
});

function copyTextToClipboard(text) {
    var copyFrom = $('<textarea/>');
    copyFrom.text(text);
    $('body').append(copyFrom);
    copyFrom.select();
    document.execCommand('copy');
    copyFrom.remove();
};

$(document).ready(function(){
    $("#copy-log").on("click", function(){
        var messages = log.getMessages();
        copyTextToClipboard(JSON.stringify(messages, null, '\t'));
        alert("Got it! Note that the log will contain session ids, be sure to remove them or log out before sharing.");
    });
    restore_options();
});
