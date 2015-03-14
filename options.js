"use strict";

var options = {
    connection_cleanup_age: null
};
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

document.addEventListener('DOMContentReady', restore_options);
