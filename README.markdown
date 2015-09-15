# queue-worker-nodejs

# Pub/Sub 사용법

	var rabbitHub = require('rabbitmq-nodejs-client');

	var subHub = rabbitHub.create( { task: 'sub', channel: 'myChannel' } );
    subHub.on('connection', function(hub) {

        hub.on('message', function(msg) {
            console.log(msg);
        }.bind(this));

    });
    subHub.connect();

    var pubHub = rabbitHub.create( { task: 'pub', channel: 'myChannel' } );
    pubHub.on('connection', function(hub) {

        hub.send('Hello World!');

    });
    pubHub.connect();

# Task/Worker 사용법

    var rabbitHub = require('rabbitmq-nodejs-client');

    var taskHub = rabbitHub.create( { task: 'task', channel: 'myChannel' } );
    taskHub.on('connection', function(hub) {

      var i = 0;
      setInterval(function() {
        hub.send('Hello World! ' + i);
        i++;
      }, 1000);

    });
    taskHub.connect();

    //multiple instances of workers
    var rabbitHub = require('rabbitmq-nodejs-client');

    var workerHub = rabbitHub.create( { task: 'worker', channel: 'myChannel' } );
    workerHub.on('connection', function(hub) {

      hub.on('message', function(msg) {
        console.log(msg);

        setTimeout(function() {
          hub.ack();
        }, 2000);
      }.bind(this));

    });
    workerHub.connect();