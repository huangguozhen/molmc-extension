var forEachWithCallback = require("./../util").forEachWithCallback,
  getLog = require("./../logging.js").getLog,
  SocketTransaction = require("./sockettransaction.js").SocketTransaction,
  ConnectionManager = require("./mixins/serialreset.js").ConnectionManager,
  errno = require("./../errno")

function SerialTransaction(config, finishCallback, errorCallback, parent) {
  SocketTransaction.apply(this, arguments)
  this.log = getLog("SerialTransaction")
  this.connectionManager = new ConnectionManager(this)
}
SerialTransaction.prototype = Object.create(SocketTransaction.prototype)
SerialTransaction.prototype.smartOpenDevice = function(device, speed, msg, cb) {
  this.connectionManager.openDevice(device, speed, msg, cb)
}
SerialTransaction.prototype.localCleanup = function(callback) {
  var self = this
  this.disconnect(function() {
    SocketTransaction.prototype.localCleanup.call(self, callback)
  })
}
SerialTransaction.prototype.disconnect = function(callback) {
  this.connectionManager.closeDevice(callback)
}
SerialTransaction.prototype.destroyOtherConnections = function(name, cb) {
  var self = this
  this.serial.getConnections(function(cnx) {
    if (cnx.length == 0) {
      cb()
    } else {
      forEachWithCallback(cnx, function(c, next) {
        if (c.name != name) {
          next()
          return
        }
        self.log.log("Closing connection ", c.connectionId)
        self.serial.disconnect(c.connectionId, function(ok) {
          if (!ok) {
            self.errCb(errno.FORCE_DISCONNECT_FAIL, {
              device: name
            })
          } else {
            self.log.log("Destroying connection:", c.connectionId)
            self.serial.onReceiveError.forceDispatch({
              connectionId: c.connectionId,
              error: "device_lost"
            })
            next()
          }
        })
      }, cb)
    }
  })
}
SerialTransaction.prototype.cmdChain = function(chain, cb) {
  if (chain.length == 0) {
    cb()
    return
  }
  this.cmd(chain.shift(), this.cmdChain.bind(this, chain, cb))
}
module.exports.SocketTransaction = SocketTransaction
module.exports.SerialTransaction = SerialTransaction
