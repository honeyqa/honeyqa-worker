
var Adapter;

if (typeof module.exports !== 'undefined') {
    Adapter = module.exports;
}

Adapter.VERSION = '1.0.0';

// Create new instance of the adapter.
Adapter.create = function(hub, callback) {
    new PubDurableAdapter(hub, callback);
};

// ## PubDurableAdapter
//
// - __hub:__ the hub
// - __callback:__ `function(err, adapter){}`
var PubDurableAdapter = function(hub, callback) {
    this.hub = hub;
    this._init(callback);
};

// Inherit prototyp and extend it.
(function(S) {

    var P = S.prototype;
    
    // __init:__ initializes the adapter.
    // 
    // `this._init(callback)`
    //
    // - __callback:__ `function(err, adapter){}`
    P._init = function(callback) {
        
        var self = this;

        var handle = function(exchange) {
            self._openCallback(exchange);
            callback(null, self);
        };

        if (!this.hub.options.channel){
            this.hub.connection.exchange('amq.fanout', {passive: true}, handle);
        } else {
            this.hub.connection.exchange(this.hub.options.channel, {type: 'topic', durable: true}, handle);
        }

    };

    // __openCallback:__ this is the callback for the exchange open.
    // 
    // `this._openCallback(exchange)`
    //
    // - __exchange:__ the exchange object coming from connection.exchange();
    P._openCallback = function(exchange) {
        
        this.hub.on('message', function(msg, routingKey) {
            exchange.publish(routingKey || '', msg);
        });

    };
    
})(PubDurableAdapter);
