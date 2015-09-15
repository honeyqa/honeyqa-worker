
var Adapter;

if (typeof module.exports !== 'undefined') {
    Adapter = module.exports;
}

Adapter.VERSION = '0.1.0';

Adapter.create = function(hub, callback) {
    new WorkerAdapter(hub, callback);
};

var WorkerAdapter = function(hub, callback) {
    this.hub = hub;
    this._init(callback);
};

(function(S) {

    var P = S.prototype;
    
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

    P._openCallback = function(exchange) {

        var self = this;

        var queueSettings = { ack: self.hub.options.ack !== undefined ? self.hub.options.ack : true, prefetchCount: self.hub.options.prefetchCount ? self.hub.options.prefetchCount : 1 };

        var q = this.hub.connection.queue(this.hub.options.queueName || 'workerQueue', {durable: true, autoDelete: false}, function(queue) {

          queue.subscribe(queueSettings, function(msg) {
            self.hub.send(msg.data.toString());
          });

          var routingKeys = self.hub.options.routingKeys || ['#'];
          for(var i in routingKeys) {
            var routingKey = routingKeys[i];
            queue.bind(exchange.name, routingKey);
          }

        });

        this.hub.on('ack', function() {
          q.shift();
        });

    };

})(WorkerAdapter);