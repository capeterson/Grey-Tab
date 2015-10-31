var GreyTab = window.GreyTab || {};
GreyTab.model = GreyTab.model || {};

GreyTab.model.SObject = function(){
    if(!(this instanceof GreyTab.model.SObject))
        throw Error("Constructor called as a function. Use the new keyword");

    /**
     * Since javascript has methods and data intermixed on objects we need to keep fields off the root type
     * since they can conceivably be anything.
     * @type {Object}
     */
    this.fields = {};
    this.applyFieldData = function(newFieldData){
        var fieldKey,
            me = this;
        for(fieldKey in newFieldData){
            Object.keys(newFieldData).forEach(function(key){
                me.fields[key] = newFieldData[key];
            });
        }
    }
};