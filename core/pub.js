var rabbitHub = require('../lib/hub');
var workerHub = rabbitHub.create( { task: rabbitHub.worker, channel: rabbitHub.channelType } );
pubHub.on('connection', function(hub) {

  hub.send('connection established');

});
pubHub.connect();
