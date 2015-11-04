#!/usr/bin/env node
'use strict';

var atosl = require("./honeyqaNativeJava.js");
var honeyObject = require("../core/init.js");
atosl.classpath.push("atosl.jar");
var arch = honeyObject.arch;
var dSYM = honeyObject.dSYM;
var addresses = honeyObject.addresses;

const reulst_getArch = atosl.getArch(dSYM);
const result_getUUID = atosl.getUUID(arch, dSYM);
const result_doSymbolicate = atosl.doSymbolicate(arch, dSYM, ddresses);

module.exports = {
  getArch: function() {
    return reulst_getArch;
  }
  getUUID: function() {
    return result_getUUID;
  }
  doSymbolicate: function() {
    return result_doSymbolicate;
  }
};
