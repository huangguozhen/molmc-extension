var Transaction = require("./../transaction.js").Transaction,
  errno = require("./../errno"),
    getLog = require("./../logging.js").getLog

    function SocketTransaction(config, finishCallback, errorCallback, parent) {
      Transaction.apply(this, arguments)
      this._codecsocket = null
      this.parentErrCb = Object.getPrototypeOf(SocketTransaction.prototype).errCb
      this.log = getLog("SocketTransaction")
      this.init(config)
    }
    SocketTransaction.prototype = Object.create(Transaction.prototype)
    SocketTransaction.prototype.errCb = function(err, ctx) {
      var self = this,
        context = ctx || {}
        if (!this.serial || !this._codecsocket) {
          this.parentErrCb(err, ctx)
          return
        }
        this.serial.getConnections(function(cnx) {
          var currentConnection = null
          cnx.forEach(function(c) {
            if (c.connectionId == self.getConnectionId()) currentConnection = c
          })
        if (!currentConnection) {
          context.lostConnection = true
          self.finalError(err, context)
          return
        }
        self.serial.getDevices(function(devs) {
          var devVisible = devs.some(function(d) {
            return currentConnection.name == d.path
          })
          if (!devVisible) {
            context.lostDevice = true
            self.finalError(err, context)
            return
          }
          self.parentErrCb(err, ctx)
        })
        })
    }
    SocketTransaction.prototype.localCleanup = function(callback) {
      this.setConnectionId(null)
      Transaction.prototype.localCleanup.call(this, callback)
    }
    SocketTransaction.prototype.init = function(config) {
      if (Transaction.prototype.init) Transaction.prototype.init.apply(this, [].slice(arguments, 2))
      this.block = false
      this.config = config
      this.serial = this.config.api.serial
    }
    SocketTransaction.prototype.getSocket = function() {
      return this._codecsocket || this._socketThunk && this.setSocket(this._socketThunk())
    }
    SocketTransaction.prototype.setSocket = function(socket) {
      if (socket === this._codecsocket) return socket
      if (!socket && this._codecsocket) {
        this._codecsocket.unref()
        this._codecsocket = null
        return null
      }
      socket.ref()
      this._codecsocket = socket
      return this._codecsocket
    }
    SocketTransaction.prototype._socketThunk = function() {
      return null
    }
    SocketTransaction.prototype.setConnectionId = function(connectionId, codecsocketClass) {
      if (this._codecsocket && this._codecsocket.connectionId != connectionId) {
        this.setSocket(null)
      }
      if (connectionId && !this._codecsocekt) {
        this._socketThunk = function() {
          delete this._socketThunk
          return new(codecsocketClass || this.codecsocketClass)(connectionId, this.serial, this.errCb.bind(this))
        }
      }
    }
    SocketTransaction.prototype.getConnectionId = function() {
      if (!this._codecsocket) return null
      return this._codecsocket.connectionId
    }
    SocketTransaction.prototype.writeThenRead = function(data, cb, config) {
      var self = this
      this.getSocket().writeThenRead(data, function(data) {
        if (!data) {
          self.errCb(errno.READER_TIMEOUT)
          return
        }
        cb(data)
      }, config)
    }
    SocketTransaction.prototype.justWrite = function(data, cb, config) {
      this.getSocket().justWrite(data, cb, config)
    }
    SocketTransaction.prototype.drain = function(callback) {
      this.getSocket().drain(callback)
    }
    module.exports.SocketTransaction = SocketTransaction
