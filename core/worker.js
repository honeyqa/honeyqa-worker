var rabbitHub = require('../lib/hub');

var workerHub = rabbitHub.create( { task: rabbitHub.worker, channel: rabbitHub.channelType } );
workerHub.on('connection', function(hub) {

  hub.on('message', function(msg) {
    console.log(msg);

    setTimeout(function() {
      hub.ack();
    }, 2000);
  }.bind(this));

});
workerHub.connect();
