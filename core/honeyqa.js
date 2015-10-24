var sprintf = require('sprintf-js').sprintf;
var cluster = require('cluster');

var getWorkerOutput = function(w){
  return sprintf("[id: %s] [pid: %s]", w.id, w.process.pid);
};

var log = require("./lib/log.js");

if (cluster.isMaster) {
  var cpuCount = require('os').cpus().length;
  console.log("Starting HoenyQA Worker. CPU count: %s", cpuCount);
  for (var i = 0; i < cpuCount; i++) {
    cluster.fork();
  }
  cluster.on('exit', function(deadWorker, code, signal) {
    var worker = cluster.fork(); // Restart the worker
    log.info("Worker died: %s [code: %s] [signal: %s]. New worker started: %s.",
      getWorkerOutput(deadWorker), code, signal, getWorkerOutput(worker));
  });
  setInterval(function(){
    var workersKeys = Object.keys(cluster.workers);
    var randomWorker = Math.floor(Math.random() * workersKeys.length);
    cluster.workers[workersKeys[randomWorker]].kill();
  }, 1000); // to verify workers keep running
} else {
  log.debug("Worker started: %s", getWorkerOutput(cluster.worker));
}
