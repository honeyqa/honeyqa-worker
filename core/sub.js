var rabbitHub = require('../lib/hub');
var workerHub = rabbitHub.create( { task: rabbitHub.worker, channel: rabbitHub.channelType } );
subHub.on('connection', function(hub) {

  hub.on('message', function(msg) {
    console.log(msg);
  }.bind(this));

});
subHub.connect();
