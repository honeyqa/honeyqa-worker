'use strict';

process.env.PATH += require('../build/jvm_dll_path.json');

var _ = require('lodash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var binaryPath = path.resolve(path.join(__dirname, "../build/Release/nodejavabridge_bindings.node"));
var bindings = require(binaryPath);

var java = module.exports = new bindings.Java();
java.classpath.push(path.resolve(__dirname, "../commons-lang3-node-java.jar"));
java.classpath.push(path.resolve(__dirname, __dirname, "../src-java"));
java.classpath.pushDir = function(dir) {
  fs.readdirSync(dir).forEach(function(file) {
    java.classpath.push(path.resolve(dir, file));
  });
};
java.nativeBindingLocation = binaryPath;

var syncSuffix = undefined;
var asyncSuffix = undefined;
var ifReadOnlySuffix = '_';

var SyncCall = function(obj, method) {
  if (syncSuffix === undefined)
    throw new Error('Sync call made before jvm created');
  var syncMethodName = method + syncSuffix;
  if (syncMethodName in obj)
    return obj[syncMethodName].bind(obj);
  else
    throw new Error('Sync method not found:' + syncMethodName);
}

java.isJvmCreated = function() {
  return typeof java.onJvmCreated !== 'function';
}

var clients = [];
java.registerClient = function(before, after) {
  if (java.isJvmCreated()) {
    throw new Error('java.registerClient() called after JVM already created.');
  }
  clients.push({before: before, after: after});
}

java.registerClientP = function(beforeP, afterP) {
  if (java.isJvmCreated()) {
    throw new Error('java.registerClient() called after JVM already created.');
  }
  clients.push({beforeP: beforeP, afterP: afterP});
}

function runBeforeHooks(done) {
  function iterator(client, cb) {
    try {
      if (client.before) {
        client.before(cb);
      }
      else if (client.beforeP) {
        client.beforeP().then(function(ignored) { cb(); }, function(err) { cb(err); });
      }
      else {
        cb();
      }
    }
    catch (err) {
      cb(err);
    }
  }
  async.each(clients, iterator, done);
}

function createJVMAsync(callback) {
  var ignore = java.newLong(0);
  callback();
}

function runAfterHooks(done) {
  function iterator(client, cb) {
    try {
      if (client.after) {
        client.after(cb);
      }
      else if (client.afterP) {
        client.afterP().then(function(ignored) { cb(); }, function(err) { cb(err); });
      }
      else {
        cb();
      }
    }
    catch (err) {
      cb(err);
    }
  }
  async.each(clients, iterator, done);
}

function initializeAll(done) {
  async.series([runBeforeHooks, createJVMAsync, runAfterHooks], done);
}

java.ensureJvm = function(callback) {

  if (_.isUndefined(callback) && java.asyncOptions && _.isFunction(java.asyncOptions.promisify)) {
    var launchJvmPromise = java.asyncOptions.promisify(java.ensureJvm.bind(java));
    return launchJvmPromise();
  }
else if (!_.isFunction(callback)) {
    throw new Error('java.launchJvm(cb) requires its one argument to be a callback function.');
  }
else if (java.isJvmCreated()) {
    return setImmediate(callback);
  }

  else {
    return setImmediate(initializeAll, callback);
  }
}

java.onJvmCreated = function() {
  if (java.asyncOptions) {
    syncSuffix = java.asyncOptions.syncSuffix;
    asyncSuffix = java.asyncOptions.asyncSuffix;
    if (typeof syncSuffix !== 'string') {
      throw new Error('In asyncOptions, syncSuffix must be defined and must a string');
    }
    var promiseSuffix = java.asyncOptions.promiseSuffix;
    var promisify = java.asyncOptions.promisify;
    if (typeof promiseSuffix === 'string' && typeof promisify === 'function') {
      var methods = ['newInstance', 'callMethod', 'callStaticMethod'];
      methods.forEach(function (name) {
        java[name + promiseSuffix] = promisify(java[name]);
      });
    } else if (typeof promiseSuffix === 'undefined' && typeof promisify === 'undefined') {
    } else {
      throw new Error('In asyncOptions, if either promiseSuffix or promisify is defined, both most be.');
    }

    if (_.isString(java.asyncOptions.ifReadOnlySuffix) && java.asyncOptions.ifReadOnlySuffix !== '') {
      ifReadOnlySuffix = java.asyncOptions.ifReadOnlySuffix;
    }
  } else {
    syncSuffix = 'Sync';
    asyncSuffix = '';
  }
}

var MODIFIER_PUBLIC = 1;
var MODIFIER_STATIC = 8;

function isWritable(prop) {
  if (prop === 'caller' || prop === 'arguments') { return false; }

  var desc = Object.getOwnPropertyDescriptor(function() {}, prop) || {};
  return desc.writable !== false &&  desc.configurable !== false;
}

function usableName(name) {
  if (!isWritable(name)) {
    name = name + ifReadOnlySuffix;
  }
  return name;
}

java.import = function(name) {
  var clazz = java.findClassSync(name);
  var result = function javaClassConstructorProxy() {
    var args = [name];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    return java.newInstanceSync.apply(java, args);
  };
  var i;

  result.class = clazz;

  var fields = SyncCall(clazz, 'getDeclaredFields')();
  for (i = 0; i < fields.length; i++) {
    var modifiers = SyncCall(fields[i], 'getModifiers')();
    if (((modifiers & MODIFIER_PUBLIC) === MODIFIER_PUBLIC)
      && ((modifiers & MODIFIER_STATIC) === MODIFIER_STATIC)) {
      var fieldName = SyncCall(fields[i], 'getName')();
      var jsfieldName = usableName(fieldName);
      result.__defineGetter__(jsfieldName, function(name, fieldName) {
        return java.getStaticFieldValue(name, fieldName);
      }.bind(this, name, fieldName));
      result.__defineSetter__(jsfieldName, function(name, fieldName, val) {
        java.setStaticFieldValue(name, fieldName, val);
      }.bind(this, name, fieldName));
    }
  }

  var promisify = undefined;
  var promiseSuffix;
  if (java.asyncOptions && java.asyncOptions.promisify) {
    promisify = java.asyncOptions.promisify;
    promiseSuffix = java.asyncOptions.promiseSuffix;
  }

  var methods = SyncCall(clazz, 'getDeclaredMethods')();
  for (i = 0; i < methods.length; i++) {
    var modifiers = SyncCall(methods[i], 'getModifiers')();
    if (((modifiers & MODIFIER_PUBLIC) === MODIFIER_PUBLIC)
      && ((modifiers & MODIFIER_STATIC) === MODIFIER_STATIC)) {
      var methodName = SyncCall(methods[i], 'getName')();

      if (_.isString(syncSuffix)) {
        var syncName = usableName(methodName + syncSuffix);
        result[syncName] = java.callStaticMethodSync.bind(java, name, methodName);
      }

      if (_.isString(asyncSuffix)) {
        var asyncName = usableName(methodName + asyncSuffix);
        result[asyncName] = java.callStaticMethod.bind(java, name, methodName);
      }

      if (promisify && _.isString(promiseSuffix)) {
        var promiseName = usableName(methodName + promiseSuffix);
        result[promiseName] = promisify(java.callStaticMethod.bind(java, name, methodName));
      }
    }
  }

  var classes = SyncCall(clazz, 'getDeclaredClasses')();
  for (i = 0; i < classes.length; i++) {
    var modifiers = SyncCall(classes[i], 'getModifiers')();
    if (((modifiers & MODIFIER_PUBLIC) === MODIFIER_PUBLIC)
      && ((modifiers & MODIFIER_STATIC) === MODIFIER_STATIC)) {
      var className = SyncCall(classes[i], 'getName')();
      var simpleName = SyncCall(classes[i], 'getSimpleName')();
      Object.defineProperty(result, simpleName, {
        get: function(result, simpleName, className) {
          var c = java.import(className);

          var d = Object.getOwnPropertyDescriptor(result, simpleName);
          d.get = function(c) { return c; }.bind(null, c);
          Object.defineProperty(result, simpleName, d);

          return c;
        }.bind(this, result, simpleName, className),
        enumerable: true,
        configurable: true
      });
    }
  }

  return result;
};
