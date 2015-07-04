var GreyTab = window.GreyTab || {};

(function(){
    var Logger = function(){
        if(!(this instanceof Logger))
            throw Error("Constructor called as a function.");
        this._messages = [];
        var me = this;
        var enforceSizeLimit = function(){
            while(me._messages.length >= me.sizeLimit){
                me._messages.shift();
            }
        };
        //when _messages is this long start truncating old _messages
        this.sizeLimit = 256;
        /**
         * Appends a new message to this Logger instance.
         * @param severity a Logger.Severity object or name
         * @param message any stringifyable-type to compose the message body
         */
        this.addMessage = function(severity, message){
            enforceSizeLimit();
            var sevObject;
            if(severity instanceof Object){
                sevObject = GreyTab.log.Severity[severity.name.toUpperCase()];
            }else if(typeof severity == "string"){
                sevObject = GreyTab.log.Severity[severity.toUpperCase()];
            }else{
                throw new Error("Severity is of unsupported type");
            }

            me._messages.push({
                severity: sevObject,
                message: JSON.parse(JSON.stringify(message)), //an ultra-hacky clone implementation
                timestamp: new Date()
            });
        }
        this.getMessages = function(){
            return me._messages
        }
    };

    GreyTab.log = new Logger();
    GreyTab.log.Severity = {
        ERROR: {name: "error", ordinal: 0},
        WARN: {name: "warn", ordinal: 1},
        INFO: {name: "info", ordinal: 2},
        DEBUG: {name: "debug", ordinal: 3}
    };

}());