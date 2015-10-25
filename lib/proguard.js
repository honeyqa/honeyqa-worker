#!/usr/bin/env node
'use strict';

var retrace = require("./honeyqaNativeJava.js");
var honeyObject = require("../core/init.js");
retrace.classpath.push("proguard.jar");
var stackTrace = honeyObject.stackTrace;
var mappingFile = honeyObject.mappingFile;

const result = retrace.retraceCode(mappingFile, stackTrace);

module.exports = {
  getProguardResult: function() {
    return result;
  }
};
