Overview
========

Grey Tab is a chrome extension that adds useful developer and/or support tools for working with Salesforce/Force.com applications.
It is currently in a alpha state and should be considered "experimental". 

Currently there are two tabs available:
 - Session Information
 - Record Details

Session Information
-------------------
This tab shows information gathered from browser cookies and does not make any API calls to salesforce.
Currently it shows
 - Current User Id
 - Current Org Id
 - The salesforce pod/instance you are connected to
 - Your current session id

Record Details
--------------
Selecting this tab opens an API connection to salesforce, fetched sObject describe details, and then queries all fields on the currently viewed record.
This view is supported on all native salesforce pages, and visualforce pages that use the "id" parameter.


Getting Grey Tab
----------------

### To install released versions
Install from the [chrome web store](https://chrome.google.com/webstore/detail/grey-tab/gdhilgkkfgmndikdhlenenjbacmnggmb) 

This version should automatically update, and is the preferred way to install unless you plan to make modifications to the source.

### To install from source

1. download to a folder
2. go to chrome://extensions
3. check developer mode, then load unpacked extension
