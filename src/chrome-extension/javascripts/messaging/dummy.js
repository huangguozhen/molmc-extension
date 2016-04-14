(function (global){
// XXX: If disconnect is too soon after the connect the actual
// connection may happen before disconnect.

/**
 * @fileOverview A loopback method mirroring chrome api.
 * @name dummy.js
 * @author Chris Perivolaropoulos
 */

global.APP_ID = global.APP_ID || "fakehostid";
// DEBUG: debug messages
// stackDebug: non async messaging.
var DEBUG = false, stackDebug = false;
var assert = require('assert'),
    maybeAsync = stackDebug ? function (cb) {cb();} : function (cb) {
      var err = new Error("Stack before async message");
      setTimeout(function () {
        try{
          cb();
        } catch (e) {
          console.log(e.stack);
          console.log(err.stack);
          throw err;
        }
      });
    },
    dbg = function () {};
if (DEBUG) {
  dbg = console.log.bind(console, '[dummy messager]');
}

function validateMessage(msg) {
  if (!msg || JSON.stringify(msg) == "{}") {
    throw new Error("Message should be something. Got:" + msg);
  }
}

function Event (jsonOnly, name, buffered) {
  this.listeners = [];
  this.removed = [];
  this.name = name;

  if (buffered) {
    this.buffer = [];
  }

  if (jsonOnly) {
    this.wrap = function (args) {
      return JSON.parse(JSON.stringify(args));
    };
  } else {
    this.wrap = function (a) {return a;};
  }
}

Event.prototype = {
  addListener: function (cb) {
    dbg('Adding listner: ' + cb.id + " to " + this.name);
    var self = this;
    this.listeners = this.listeners.concat([cb]);

    (this.buffer||[]).forEach(function (args) {
      maybeAsync(function () {
        self.listeners.some(function (l) {
          return !l.apply(null, args);
        });
      });
    });
  },

  removeListener: function (cb) {
    dbg('Removing listner: ' + cb.id + " from " + this.name +
        " (" + this.listeners.map(function (l) {return l.id;}) + " - " +
        this.removed + " )");
    this.listeners = this.listeners.filter(function (l) {
      var same = cb === l,
          sameIds = (cb.id && l.id && cb.id == l.id);
      return !(same || sameIds);
    });
  },

  trigger: function (varArgs) {
    var args = [].slice.call(arguments),
        self = this,
        listeners = this.listeners; //Make sure async does't fuck with listeners
    dbg('Triggering[' + this.listeners.length + ']: ' + this.name + "|" +
        ((args[0] instanceof Port) ? "<port>" : JSON.stringify(args)));

    if (this.buffer && this.listeners.length == 0) {
      this.buffer.push(args);
      return;
    }

    maybeAsync(function () {
      var tok = Math.random();
      listeners.some(function (l, i) {
        return !l.apply(null, args);
      });
    });

  }
};

function Runtime () {
  dbg('Creating runtime...');
  this.id = global.APP_ID;
  this.onConnectExternal = new Event(false, "onConnectExternal");
  this.onMessageExternal = new Event(true, "onMessageExternal");
  this.ports = [];
  this.version = "1.0";
}

Runtime.prototype = {
  sendMessage: function (hostId, message, cb) {
    var sendResp = cb,
        sender = null;

    validateMessage(message);
    assert(message);
    assert(hostId);
    if (hostId != this.id || global.blockMessaging) {
      maybeAsync(cb);
      return;
    }

    this.onMessageExternal.trigger(message, sender, function (msg) {
      dbg("Response:", JSON.stringify(msg));
      cb(msg);
    });
  },

  connect: function (hostId, connectInfo) {
    var clientPort = new Port(connectInfo.name, this),
        self = this;
    assert.equal(hostId, this.id);

    if (global.blockMessaging) {
      setImmediate( function () {
        clientPort.onDisconnect.trigger(clientPort);
      });
      return clientPort;
    }

    maybeAsync(function () {
      self.onConnectExternal.trigger(clientPort.otherPort);
    });
    return clientPort;
  }
};

function Port (name, runtime, otherPort) {
  this.name = name;
  this.runtime = runtime;
  runtime.ports = runtime.ports.concat([this]);
  this.prefix = "Port" + (!otherPort ? "<client>" : "<host>");
  this.onDisconnect = new Event(false, this.prefix + ".onDisconnect");
  this.onMessage = new Event(true, this.prefix + ".onMessage", true);

  this.otherPort = otherPort || new Port(name, runtime, this);
  this.connected = true;
}

Port.prototype = {
  postMessage: function (msg) {
    validateMessage(msg);
    this.otherPort.onMessage.trigger(msg);
  },

  disconnect: function (forceListeners) {
    if (this.connected) {
      var self = this;
      this.runtime.ports = this.runtime.ports.filter(function (p) {
        return p !== self;
      });

      this.connected = false;
      this.onMessage.listeners = [];
      if (forceListeners){
        this.onDisconnect.trigger();
      }
      this.onDisconnect.listeners = [];
      this.otherPort.disconnect(true);
    }
  }
};

global.chrome = global.chrome || {runtime: {id: APP_ID}};

module.exports.DummyRuntime = Runtime;
module.exports.Event = Event;
module.exports.Port = Port;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})