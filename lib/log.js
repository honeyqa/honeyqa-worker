var fs = require("fs");
var winston = require('winston');

var dirData = __dirname + "/data";
if (!fs.existsSync(dirData)) {
  fs.mkdirSync(dirData);
}

var dirLogs = __dirname + "/data/logs";
if (!fs.existsSync(dirLogs)) {
  fs.mkdirSync(dirLogs, "0755");
}

module.exports = new winston.Logger({
    transports: [
      new winston.transports.Console({
        level: 'debug',
        handleExceptions: true,
        json: false,
        colorize: true
      }),
      new winston.transports.File({
        level: 'debug',
        filename: "lib/data/logs/cluster.log",
        handleExceptions: true,
        json: false,
        maxsize: 5242880, //5MB
        maxFiles: 5,
        colorize: false
      })
    ],
    exitOnError: false
});
