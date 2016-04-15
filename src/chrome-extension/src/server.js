/**
 * @fileOverview Initialize and handle requests and connections.
 * @name server.js
 * @author Chris Perivolaropoulos
 */

/* eslint no-unused-vars: 0 */
var HostConnection = require("./hostconnection.js").HostConnection,
  MethodRequest = require("./requests.js").MethodRequest,
  BurstRequest = require("./requests.js").BurstRequest,
  ErrResponse = require("./responses.js").ErrResponse,
  AckResponse = require("./responses.js").AckResponse,
  log = new (require('./log.js').Log)('server'),
  messageApi = require('./messaging.js'),
  BootstrapHost = require('./bootstraphost.js').BootstrapHost;
require('./setimmediate.js');

var state = {connections: [],
             keepalives: [],
             uniqueId: 0,
             version: messageApi.version};

/**
 * A port to keep track of a client. It also sets the id of the client;
 * @param {Port} port
 * @param {Function} dieCb Called when the client dies.
 */
function HostKeepAliveConnection (port, closeCb) {
  log.log("Creating host keepalive");
  var self = this;
  this.port = port;
  port.onDisconnect.addListener(this.close.bind(this));
  this.closeCb = closeCb.bind(null, this);
  this.clientId = state.uniqueId++;
  this.portConf = JSON.parse(port.name);

  // Set the clientId
  port.onDisconnect.addListener(function () {
    log.log("Client disconnected:" + self.clientId);
  });
  port.postMessage({
    clientId: self.clientId,
    version: state.version});
  log.log("Client connected:" + self.clientId);
  this.closed = false;
}

HostKeepAliveConnection.is = function (port) {
  return JSON.parse(port.name).type == "KeepAliveConnection";
};

HostKeepAliveConnection.prototype = {
  maybeClose: function (c) {

    if (c.clientId == this.clientId) {
      c.close();
    }
  },

  close: function () {
    if (this.closed) return;
    // Cleaning up may require the port.
    this.closed = true;
    this.closeCb();
    this.port.disconnect();
    this.port = null;
  }
};

/**
 * Get a keep alive connection token for the client. The object is
 * {port, clientId}.
 *
 * @param {String} hostId The ide of the host to connect to.
 * @param {Function} connectCb The callback to be called when the
 * connection is successful.
 * @param {Function} diconnectCb Will be called when the host
 * disconencts. Will be called immediately if the connection fails.
 */
function getKeepAliveConnection (hostId, connectCb, disconnectCb, timeout) {
  messageApi = require("./messaging.js");

  var portName = JSON.stringify({type: "KeepAliveConnection"}),
    port = messageApi.connect(hostId, {name: portName});
  if (disconnectCb) {
    log.log("Detected disconnect cb on client keepalive");
    port.onDisconnect.addListener(function () { disconnectCb(); });
  }

  var gotToken = false;
  port.onMessage.addListener(function tokenizer (msg) {
    port.onMessage.removeListener(tokenizer);
    gotToken = true;

    if (!msg) {
      log.warn("Empty message came on keepalive port.");
      disconnectCb("no_host");
      port.disconnect();
      return true;
    }

    // Only matching major version numbers can communicate.
    if (msg && msg.version &&
        msg.version.split('.')[0] != messageApi.version.split('.')[0]) {
      log.warn("Received bad app version:", msg.version);
      disconnectCb("bad_version");
      port.disconnect();
      return true;
    }

    if (typeof msg.clientId !== 'number') {
      return false;
    }

    var token = {
      port: port,
      version: msg.version,
      clientId: msg.clientId,
      disconnectCb: disconnectCb
    };
    setImmediate(connectCb.bind(null, token));
  });

  if (typeof timeout !== 'undefined') {
    setTimeout(function() {
      if (gotToken) return;
      log.warn("Host keepalive connection was silent for too long.");
      disconnectCb("timeout");
      port.disconnect();
      return true;
    }, timeout);
  }
}

/**
 * Handle (or delegate) connections and messages from any client. Also
 * keep track of open connections and clean them up if the user asks
 * for it.
 *
 * @param {Object} apiRoot the root of the api to serve.
 */
function HostServer (apiRoot) {
  if (state.apiRoot === apiRoot) {
    throw Error("You are trying to host a second server on the same api.");
  }

  var adhoc = require("./adhoc/host.js");
  apiRoot.messageApi = messageApi;
  apiRoot.serverId = Math.random();
  state.apiRoot = apiRoot;
  state.bootstrapHost = new BootstrapHost();
  adhoc.setupAdHoc(state);

  function closeCb (connection) {
    var len = state.connections.length;
    state.connections = state.connections.filter(function (c) {
      return c !== connection;
    });
    log.log("Cleanined:", connection.repr(), '(before: ', len, 'after: ', state.connections.length, ')');
  };

  function tabDiedCb (keepalive) {
    // Keep only one reference to each connection, ie don't register
    // them to keepalives or whatever.
    state.connections.forEach(function (c) {
      keepalive.maybeClose(c);
    });
    state.keepalives = state.keepalives.filter(function (ka) {
      return !ka.closed;
    });
  }

  function messageHandle (message, sender, sendResp) {
    return (
      MethodRequest.maybeHandle(message, state.connections, apiRoot, sendResp) ||
        BurstRequest.maybeHandle(message, state.connections, sendResp) ||
        (new ErrResponse("Nothing to do for message." +
                         JSON.stringify(message), false)
         .send(sendResp)));
  }

  function connectHandle (port) {
    if (HostKeepAliveConnection.is(port)) {
      var keepalive = new HostKeepAliveConnection(port, tabDiedCb);
      state.keepalives.push(keepalive);
      return;
    }

    var conn = new HostConnection(port, apiRoot, function () {
      closeCb(conn);
    });
    state.connections.push(conn);
  }

  messageApi.onConnectExternal.addListener(connectHandle);
  log.log("Listening on connections...");
  messageApi.onMessageExternal.addListener(messageHandle);
  log.log("Listening on messages...");

  function cleanUp () {
    log.log("Cleaning connect");
    messageApi.onConnectExternal.removeListener(connectHandle);
    log.log("Cleaning message");
    messageApi.onMessageExternal.removeListener(messageHandle);

    state.connections.forEach(function(c) {
      c.close();
    });

    state.keepalives.forEach(function(k) {
      k.close();
    });

    state.bootstrapHost.cleanup();
    state.apiRoot = null;
  }

  return cleanUp;
}

module.exports.state = state;
module.exports.HostServer = HostServer;
module.exports.getKeepAliveConnection = getKeepAliveConnection;
module.exports.messageApi = messageApi;
