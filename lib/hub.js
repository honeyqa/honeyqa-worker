var amqp = require('amqp'),
  EventEmitter = require('events').EventEmitter;

var Hub;

if (typeof module.exports !== 'undefined') {
  Hub = module.exports;
}

Hub.VERSION = '1.0.0';

// Create new instance of the hub.
Hub.create = function(options) {
  return new RabbitHub(options);
};

// ## RabbitHub
// This class represents a hub for RabbitMQ.
var RabbitHub = function(options) {

  // Call super class.
  EventEmitter.call(this);

  // Set options and load defaults if needed.
  this.options = options || {};

  this.host = this.options.host || 'localhost';
  this.port = this.options.port || 5672;
  this.protocol = this.options.protocol || 'amqp';
  this.login = this.options.login;
  this.password = this.options.password;
  this.vhost = this.options.vhost;
  this.task = this.options.task;

  this.url = this.protocol + '://';
  if (this.login && this.password) {
    this.url += this.login + ':' + this.password + '@';
  }
  this.url += this.host;
  if (this.port) {
    this.url += ':' + this.port;
  }
  if (this.vhost) {
    this.url += this.vhost;
  }

};

// Inherit prototyp and extend it.
(function(S) {
  var P = S.prototype = new EventEmitter();

  // __connect:__ initializes the connection.
  // 
  // `hub.connect()`
  P.connect = function() {

    var self = this;

    this.connection = amqp.createConnection({
      url: this.url
    });

    this.connection.on('ready', function() {

      var destroyQueue = function(callback) {
        var q = self.connection.queue(self.options.queueName, {
          durable: true,
          'autoDelete': false
        }, function(queue) {
          queue.destroy();
          if (callback) callback();
        });
      };

      var startAdapter = function() {
        var adapter = require('./adapters/' + self.task);
        adapter.create(self, function(err) {
          if (err) {

          } else {
            self.emit('connection', self);
          }
        });
      };

      if (self.options.clean) {
        self.emit('connection', self);
        destroyQueue(startAdapter);
      } else {
        startAdapter();
      }

    });

  };

  // __send:__ sends a _msg with opitional _routingKey through the hub.
  // 
  // `hub.send(msg, routingKey)`
  //
  // - __msg:__ the message
  // - __routingKey:__ a routingKey [optional]
  P.send = function(msg, routingKey) {

    if (routingKey === 'android_receive_exception') {
      async.waterfall([
        function(callback) {
          var query = connection.query('insert into instance set ?', msg, function(err, result) {
            if (err) {
              console.error(err);
              throw err;
            }
            console.log(query);
            //     res.send(200,'success');
            callback(null, result);
          });
        },
        function(result, callback) {
          var query = connection.query('insert into callstack set ?', msg, function(err, result) {
            if (err) {
              console.error(err);
              throw err;
            }
            console.log(query);
            //  res.send(200,'success');
            callback(null, result);
          });

        },
        function(result, callback) {
          var query = connection.query('insert into console_log set ?', msg, function(err, result) {
            if (err) {
              console.error(err);
              throw err;
            }
            console.log(query);
            //  res.send(200,'success');
            callback(null, result);
          });

        },
        function(result, callback) {

          var query = connection.query('insert into error set ?', msg, function(err, result) {
            if (err) {
              console.error(err);
              throw err;
            }
            console.log(query);
            callback(null, result);
          });
        }
      ], function(err, result) {
        if (err) throw err;
      });
    }
  };

  // __ack:__ acknowledges the last message.
  // Works only if options.ack is true!
  // 
  // `hub.ack()`
  P.ack = function() {

    this.emit('ack');

  };

  // __end:__ closes the connection.
  // 
  // `hub.end()`
  P.end = function() {

    try {
      this.connection.end();
      this.connection = null;
    } catch (e) {}

    this.emit('close');

  };

})(RabbitHub);
