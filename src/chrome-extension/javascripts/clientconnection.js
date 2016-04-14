/* eslint no-unused-vars: 0 */
var Argumets = require("./arguments.js").Arguments,
  r = require("./responses.js"),
  messageApi = require("./messaging.js"),
  MethodRequest = require("./requests.js").MethodRequest,
  BurstRequest = require("./requests.js").BurstRequest,
  log = new (require("./log.js").Log)("clientconnection");

require("./setimmediate.js");

function ClientConnection(method, args, reverser, hostId, clientId, closeCb, connectedCb, withError) {
  this.methodRequest = new MethodRequest(hostId, method, args, false, false, withError);
  this.id = this.createId();
  this.closeCb = closeCb;
  this.clientId = clientId;
  this.hostId = hostId;
  this.reverser = reverser;
  this.busy = false;
  this.dataReady = false;
  this.paused = false;
  this.closed = false;
  const portName = JSON.stringify({
      methodRequestMsg: this.methodRequest.forSending(),
      id: this.id,
      reverser: reverser,
      clientId: clientId
    }),
    self = this;

  this.port = messageApi.connect(hostId, {
    name: portName
  });

  this.connectedCbs = [];

  function initFinished(msg) {
    if (r.ErrResponse.maybeHandle(msg, self.methodRequest, self.close.bind(self))) {
      return null
    }
    if (typeof msg != "string") {
      return self.handleDtr(msg)
    }
    initFinished.id = "initFinished-" + self.id;
    if (msg == "ack" && self.port) {
      self.port.onMessage.removeListener(initFinished);
      self.connectedCbs.forEach(function(cb) {
        cb()
      });
      self.connectedCbs = null;
      if (connectedCb) {
        connectedCb()
      }
      return false
    }
    return true
  }
  log.log("Registering ondisconnect");
  this.port.onDisconnect.addListener(function() {
    self.close()
  });
  this.port.onMessage.addListener(function(msg) {
    setImmediate(function() {
      initFinished(msg)
    });
    return true
  });
  this.port.postMessage("client created")
}

ClientConnection.prototype = {
  repr: function() {
    return this.id + " ( " + this.methodRequest.method + " )"
  },
  createId: function() {
    return "connection-" + (Date.now() + Math.random())
  },
  afterConnect: function(cb, varArgs) {
    var callback = cb.bind(null, [].slice.call(arguments, 1));
    if (this.connectedCbs) {
      this.connectedCbs.push(callback);
      return
    }
    setImmediate(callback)
  },
  pause: function(pause, emptyBufferCb) {
    var self = this;
    emptyBufferCb = emptyBufferCb || function() {};
    self.paused = pause;
    this.afterConnect(function() {
      if (!self.paused && self.dataReady) {
        self.handleDtr(null, emptyBufferCb);
        return
      }
      emptyBufferCb()
    })
  },
  handleDtr: function(message, finished) {
    var self = this;
    log.log("Got data ready:" + this.repr(), "(busy:" + this.busy + ", paused:" + this.paused + ")");
    if (this.closed) {
      log.warn("Closed client side of connection " + this.id);
      return
    }
    if (this.busy || this.paused) {
      this.dataReady = true;
      return
    }

    function doneCb() {
      log.log("Done handling dtr", self.dataReady);
      if (!self.dataReady) {
        self.busy = false;
        if (finished) finished();
        return
      }
      self.dataReady = false;
      self.requestData(doneCb)
    }
    this.busy = true;
    this.dataReady = false;
    this.requestData(doneCb)
  },
  requestData: function(doneCb) {
    log.log("Requesting data from " + this.repr() + ". Secs since last: " + Date.now() - this.lastRequest || 0);
    if (this.closed) return;
    var self = this;
    this.lastRequest = Date.now();
    var req = new BurstRequest(this.hostId, this, function() {
      if (self.closed) return null;
      return self.methodRequest.getCallback().apply(null, arguments)
    });
    this.servingRequest = req;
    req.send(doneCb)
  },
  close: function(error) {
    if (this.servingRequest) {
      this.servingRequest.blocked = true
    }
    if (!this.closed) {
      this.port.disconnect()
    }
    this.closed = true;
    this.dataReady = false;
    this.pause = false;
    this.busy = false;
    this.port = null;
    setImmediate(this.closeCb.bind(this, error))
  }
}

module.exports.ClientConnection = ClientConnection
