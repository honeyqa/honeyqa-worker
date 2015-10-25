var rabbitHub = require('../lib/hub');
var workerHub = rabbitHub.create( { task: rabbitHub.worker, channel: rabbitHub.channelType } );
taskHub.on('connection', function(hub) {

  var i = 0;
  setInterval(function() {
    hub.send('task:' + i);
    i++;
  }, 1000);

});
taskHub.connect();
