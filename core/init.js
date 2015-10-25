// HoneyQA Worker = Honey
const DEFAULT_OPTIONS = {
          maxCallsPerWorker           : Infinity
        , maxConcurrentWorkers        : require('os').cpus().length
        , maxConcurrentCallsPerWorker : 10
        , maxConcurrentCalls          : Infinity
        , maxCallTime                 : Infinity
        , maxRetries                  : Infinity
        , forcedKillTime              : 100
        , autoStart                   : false
      }

const extend                  = require('xtend')
    , fork                    = require('./fork')
    , TimeoutError            = require('errno').create('TimeoutError')
    , ProcessTerminatedError  = require('errno').create('ProcessTerminatedError')
    , MaxConcurrentCallsError = require('errno').create('MaxConcurrentCallsError')

function Hoeny (options, path) {
  this.options     = extend(DEFAULT_OPTIONS, options)
  this.path        = path
  this.activeCalls = 0
}

Hoeny.prototype.mkhandle = function (method) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    if (this.activeCalls >= this.options.maxConcurrentCalls) {
      var err = new MaxConcurrentCallsError('Too many concurrent calls (' + this.activeCalls + ')')
      if (typeof args[args.length - 1] == 'function')
        return process.nextTick(args[args.length - 1].bind(null, err))
      throw err
    }
    this.addCall({
        method   : method
      , callback : args.pop()
      , args     : args
      , retries  : 0
    })
  }.bind(this)
}

Hoeny.prototype.setup = function (methods) {
  var iface
  if (!methods) { // single-function export
    iface = this.mkhandle()
  } else { // multiple functions on the export
    iface = {}
    methods.forEach(function (m) {
      iface[m] = this.mkhandle(m)
    }.bind(this))
  }

  this.searchStart    = -1
  this.childId        = -1
  this.children       = {}
  this.activeChildren = 0
  this.callQueue      = []

  if (this.options.autoStart) {
    while (this.activeChildren < this.options.maxConcurrentWorkers)
      this.startChild()
  }

  return iface
}

Hoeny.prototype.onExit = function (childId) {
  setTimeout(function () {
    var doQueue = false
    if (this.children[childId] && this.children[childId].activeCalls) {
      this.children[childId].calls.forEach(function (call, i) {
        if (!call) return
        else if (call.retries >= this.options.maxRetries) {
          this.receive({
              idx   : i
            , child : childId
            , args  : [ new ProcessTerminatedError('cancel after ' + call.retries + ' retries!') ]
          })
        } else {
          call.retries++
          this.callQueue.unshift(call)
          doQueue = true
        }
      }.bind(this))
    }
    this.stopChild(childId)
    doQueue && this.processQueue()
  }.bind(this), 10)
}

// start a new worker
Hoeny.prototype.startChild = function () {
  this.childId++

  var forked = fork(this.path)
    , id     = this.childId
    , c      = {
          send        : forked.send
        , child       : forked.child
        , calls       : []
        , activeCalls : 0
        , exitCode    : null
      }

  forked.child.on('message', this.receive.bind(this))
  forked.child.once('exit', function (code) {
    c.exitCode = code
    this.onExit(id)
  }.bind(this))

  this.activeChildren++
  this.children[id] = c
}

// stop a worker, identified by id
Hoeny.prototype.stopChild = function (childId) {
  var child = this.children[childId]
  if (child) {
    child.send('die')
    setTimeout(function () {
      if (child.exitCode === null)
        child.child.kill('SIGKILL')
    }, this.options.forcedKillTime)
    ;delete this.children[childId]
    this.activeChildren--
  }
}

Hoeny.prototype.receive = function (data) {
  var idx     = data.idx
    , childId = data.child
    , args    = data.args
    , child   = this.children[childId]
    , call

  if (!child) {
    return console.error(
        'Worker Hoeny: Received message for unknown child. '
      + 'This is likely as a result of premature child death, '
      + 'the operation will have been re-queued.'
    )
  }

  call = child.calls[idx]
  if (!call) {
    return console.error(
        'Worker Hoeny: Received message for unknown index for existing child. '
      + 'This should not happen!'
    )
  }

  if (this.options.maxCallTime !== Infinity)
    clearTimeout(call.timer)

  if (args[0] && args[0].$error == '$error') {
    var e = args[0]
    switch (e.type) {
      case 'TypeError': args[0] = new TypeError(e.message); break
      case 'RangeError': args[0] = new RangeError(e.message); break
      case 'EvalError': args[0] = new EvalError(e.message); break
      case 'ReferenceError': args[0] = new ReferenceError(e.message); break
      case 'SyntaxError': args[0] = new SyntaxError(e.message); break
      case 'URIError': args[0] = new URIError(e.message); break
      default: args[0] = new Error(e.message)
    }
    args[0].type = e.type
    args[0].stack = e.stack

    // Copy any custom properties to pass it on.
    Object.keys(e).forEach(function(key) {
      args[0][key] = e[key];
    });
  }

  process.nextTick(function () {
    call.callback.apply(null, args)
  })

  ;delete child.calls[idx]
  child.activeCalls--
  this.activeCalls--

  if (child.calls.length >= this.options.maxCallsPerWorker
      && !Object.keys(child.calls).length) {

    this.stopChild(childId)
  }

  this.processQueue()
}

Hoeny.prototype.childTimeout = function (childId) {
  var child = this.children[childId]
    , i

  if (!child)
    return

  for (i in child.calls) {
    this.receive({
        idx   : i
      , child : childId
      , args  : [ new TimeoutError('worker call timed out!') ]
    })
  }
  this.stopChild(childId)
}

Hoeny.prototype.send = function (childId, call) {
  var child = this.children[childId]
    , idx   = child.calls.length

  child.calls.push(call)
  child.activeCalls++
  this.activeCalls++

  child.send({
      idx    : idx
    , child  : childId
    , method : call.method
    , args   : call.args
  })

  if (this.options.maxCallTime !== Infinity) {
    call.timer =
      setTimeout(this.childTimeout.bind(this, childId), this.options.maxCallTime)
  }
}

Hoeny.prototype.childKeys = function () {
  var cka = Object.keys(this.children)
    , cks

  if (this.searchStart >= cka.length - 1)
    this.searchStart = 0
  else
    this.searchStart++

  cks = cka.splice(0, this.searchStart)

  return cka.concat(cks)
}

Hoeny.prototype.processQueue = function () {
  var cka, i = 0, childId

  if (!this.callQueue.length)
    return this.ending && this.end()

  if (this.activeChildren < this.options.maxConcurrentWorkers)
    this.startChild()

  for (cka = this.childKeys(); i < cka.length; i++) {
    childId = +cka[i]
    if (this.children[childId].activeCalls < this.options.maxConcurrentCallsPerWorker
        && this.children[childId].calls.length < this.options.maxCallsPerWorker) {

      this.send(childId, this.callQueue.shift())
      if (!this.callQueue.length)
        return this.ending && this.end()
    } /*else {
      console.log(
        , this.children[childId].activeCalls < this.options.maxConcurrentCallsPerWorker
        , this.children[childId].calls.length < this.options.maxCallsPerWorker
        , this.children[childId].calls.length , this.options.maxCallsPerWorker)
    }*/
  }

  if (this.ending)
    this.end()
}

Hoeny.prototype.addCall = function (call) {
  if (this.ending)
    return this.end() // don't add anything new to the queue
  this.callQueue.push(call)
  this.processQueue()
}

Hoeny.prototype.end = function (callback) {
  var complete = true
  if (this.ending === false)
    return
  if (callback)
    this.ending = callback
  else if (this.ending == null)
    this.ending = true
  Object.keys(this.children).forEach(function (child) {
    if (!this.children[child])
      return
    if (!this.children[child].activeCalls)
      this.stopChild(child)
    else
      complete = false
  }.bind(this))

  if (complete && typeof this.ending == 'function') {
    process.nextTick(function () {
      this.ending()
      this.ending = false
    }.bind(this))
  }
}

module.exports              = Hoeny
module.exports.TimeoutError = TimeoutError
