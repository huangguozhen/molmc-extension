/*
 * 16
 */
/* eslint no-unused-vars: 0 */
var MethodRequest = require("./requests.js").MethodRequest,
  ClientConnection = require("./clientconnection.js").ClientConnection,
  getKeepAliveConnection = require("./server.js").getKeepAliveConnection,
  messageApi = require("./server.js").messageApi,
  errhandle = require("./error.js"),
  getConfig = require("./config.js").getConfig,
  log = new (require("./log.js").Log)("handlers")
require("./setimmediate.js")

function uncaughtError(err) {
  console.error(err)
}
var clientConnections = []

function handlerFactory(path, config, withError) {
  var handler

  function unregisterConnection() {
    if (!this.closed) {
      this.close()
    }
    var self = this
    clientConnections = clientConnections.filter(function(c) {
      return c !== self
    })
  }

  function registerConnection(varArgs) {
    clientConnections.push(new ClientConnection(path, [].slice.call(arguments), config.reverseMethods[path], config.hostId, config.clientId, unregisterConnection, null, withError))
  }

  if (config.reverseMethods[path]) {
    return registerConnection
  }

  var isReverter = Object.getOwnPropertyNames(config.reverseMethods).some(function(k) { return config.reverseMethods[k].path == path }),
    noCallback = config.noCallbackMethods.indexOf(path) > -1

  return function() {
    var mr = new MethodRequest(config.hostId, path, [].slice.call(arguments), isReverter, noCallback)
    mr.withError = withError
    mr.send()
  }
}

function setupClient(apiRoot, connectCb, disconnectCb, errorCb, timeout) {
  if (apiRoot.local && apiRoot.local.token) {
    if (errorCb) {
      errorCb("already_connected")
      return
    }
    throw new Error("Tried to reconnect to a non disconnected api")
  }
  getConfig(function(config) {
    apiRoot.local = config
    asApiClient(apiRoot)
    connectCb()
  }, disconnectCb, errorCb, timeout)
}

function asApiClient(apiRoot) {
  apiRoot.local.getConnections = function() {
    return clientConnections
  }
  apiRoot.local.disconnect = function(done, silent) {
    var self = this,
      evt = null
    if (this.token && this.token.port) {
      this.token.port.disconnect()
      if (!silent) {
        evt = this.token.disconnectCb
      }
      setImmediate(function() {
        if (evt) evt()
        if (done) done()
      })
    }
    this.token = null
  }
  apiRoot.local.methods.forEach(function(path) {
    var names = path.split("."),
      method = names.pop(),
      obj = names.reduce(function(ob, meth) {
        if (!ob[meth]) {
          ob[meth] = {}
        }
        return ob[meth]
      }, apiRoot)
    if (obj[method]) return
    obj[method] = handlerFactory(path, apiRoot.local, errhandle.withError.bind(null, apiRoot))
  })
}
module.exports.getConfig = getConfig
module.exports.handlerFactory = handlerFactory
module.exports.setupClient = setupClient
module.exports.uncaughtError = uncaughtError
