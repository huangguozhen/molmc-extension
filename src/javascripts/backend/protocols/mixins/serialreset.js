var SocketTransaction = require("./../sockettransaction.js").SocketTransaction,
  getLog = require("./../../logging.js").getLog,
    scheduler = require("./../../scheduler.js"),
      ioutile = require("./../../io/util.js"),
        status = require("./../../status.js"),
          errno = require("./../../errno.js")

          function ControlFsm(config, finishCb, errorCb, parent) {
            SocketTransaction.apply(this, arguments)
            this.parent = this.parentState.parent
            this.codecsocketClass = this.parent.codecsocketClass
            this.serial = config.api.serial
          }
          ControlFsm.prototype = Object.create(SocketTransaction.prototype)
          ControlFsm.prototype.maybeSetControls = function(cid, val, cb, _dontFail) {
            if (this.config.avoidTwiggleDTR) {
              scheduler.setTimeout(cb)
              return
            }
            this.setControls(cid, val, cb, true)
          }
          ControlFsm.prototype.setControls = function(cid, val, cb, _dontFail) {
            var self = this
            if (!cid) {
              if (_dontFail) {
                cb()
                return
              }
              self.errCb(errno.DTR_RTS_FAIL, {
                message: "Bad connection id",
                connectionId: cid
              })
              return
            }
            this.log.log("Setting RTS/DTR (", cid, "):", val)
            this.serial.setControlSignals(cid, {
              dtr: val,
              rts: val
            }, function(ok) {
              if (!ok) {
                if (_dontFail) {
                  cb()
                  return
                }
                self.errCb(errno.DTR_RTS_FAIL)
                return
              }
              scheduler.setImmediate(cb)
            })
          }

          function SerialReset(config, finishCb, errorCb, parent) {
            ControlFsm.apply(this, arguments)
            this.devConfig = null
            this.log = getLog("SerialReset")
            this.preconfigureConnectionId = null
            this.unsyncedConnectionId = null
          }
          SerialReset.prototype = Object.create(ControlFsm.prototype)
          SerialReset.prototype.localCleanup = function(cb) {
            var self = this
            this.maybeDisconnect(this.preconfigureConnectionId, function() {
              self.preconfigureConnectionId = null
              self.maybeDisconnect(self.unsyncedConnectionId, function() {
                self.unsyncedConnectionId = null
                ControlFsm.prototype.localCleanup.call(self, cb)
              })
            })
          }
          SerialReset.prototype.maybeDisconnect = function(cid, cb) {
            if (typeof cid !== "number") {
              cb()
              return
            }
            this.log.log("API call to disconnect", cid)
            this.serial.disconnect(cid, cb)
          }
          SerialReset.prototype.openDevice = function(device, speed, syncConf) {
            if (this.config.preconfigureDevice) {
              this.transition("preconfigureOpenDevice", device, speed, syncConf)
              return
            }
            this.transition("normalOpenDevice", device, speed, syncConf)
          }
          SerialReset.prototype.preconfigureOpenDevice = function(device, speed, syncConf) {
            this.syncConf = syncConf
            this.devConfig = {
              device: device,
              speed: speed
            }
            this.setStatus(status.PRECONFIGURING, {
              device: device
            })
            this.serial.connect(device, {
              bitrate: this.config.speed,
              name: device
            }, this.transitionCb("preconfigureConnected"))
          }
          SerialReset.prototype.preconfigureConnected = function(info) {
            if (!info) {
              this.errCb(errno.PRECONFIGURE_CONNECT, {
                devConfig: this.devConfig
              })
              return
            }
            this.preconfigureConnectionId = info.connectionId
            this.log.log("Connected for preconfiguration:", info.connectionId)
            this.transition("presetControlSignals")
          }
          SerialReset.prototype.presetControlSignals = function() {
            this.maybeSetControls(this.preconfigureConnectionId, false, this.transitionCb("finalizePreparation"))
          }
          SerialReset.prototype.finalizePreparation = function() {
            var self = this
            this.serial.disconnect(this.preconfigureConnectionId, function(ok) {
              if (!ok) {
                self.errCb(errno.PRECONFIGURE_DISCONNECT, {
                  devConfig: self.devConfig
                })
                return
              }
              self.preconfigureConnectionId = null
              self.transition("normalOpenDevice", self.devConfig.device, self.devConfig.speed, self.syncConf)
            })
          }
          SerialReset.prototype.normalOpenDevice = function(device, speed, syncConf) {
            this.setStatus(status.CONNECTING, {
              device: device
            })
            this.syncConf = syncConf
            this.devConfig = {
              device: device,
              speed: speed
            }
            this.serial.connect(device, {
              bitrate: this.config.speed,
              name: device
            }, this.transitionCb("normalConnected"))
          }
          SerialReset.prototype.normalConnected = function(info) {
            if (!info) {
              this.errCb(errno.CONNECTION_FAIL, {
                devConfig: this.devConfig
              })
              return
            }
            this.unsyncedConnectionId = info.connectionId
            this.setConnectionId(info.connectionId)
            this.log.log("Connected to preconfigured device:", info.connectionId)
            scheduler.setTimeout(this.transitionCb("twiggleDtr"), 50)
          }
          SerialReset.prototype.twiggleDtr = function() {
            var self = this,
              cid = this.unsyncedConnectionId,
                transition = {
                  state: "sync",
                  retries: 10,
                  waitBefore: 400,
                  retryInterval: 0
                }
                this.setStatus(status.RESETTING, {
                  device: this.devConfig.device
                })
                this.maybeSetControls(cid, false, function() {
                  scheduler.setTimeout(function() {
                    self.maybeSetControls(cid, true, self.transitionCb(transition))
                  }, 250)
                })
          }
          SerialReset.prototype.sync = function() {
            this.writeThenRead(this.syncConf.request, this.transitionCb("finalizeConnect"), {
              ttl: 200
            })
          }
          SerialReset.prototype.finalizeConnect = function(data) {
            if (this.syncConf && this.syncConf.response && this.syncConf.response.some(function(b, i) {
              return b != data[i]
            })) {
              this.errCb(errno.SYNC_RESPONSE, {
                expected: this.syncConf.response,
                got: data
              })
              return
            }
            this.unsyncedConnectionId = null
            this.parent.setSocket(this.getSocket())
            this.cleanup(this.finishCallback)
          }

          function ConnectionManager(transaction) {
            this.transaction = transaction
            this.connector = null
            this.closed = false
            this.log = getLog("ConnectionManager")
          }
          ConnectionManager.prototype = {
            openDevice: function(dev, speed, msg, cb) {
              var self = this
              this.log.log("Opening device", dev)
              this.connector = this.transaction.child(SerialReset, function() {
                self.log.log("Passing reset device to stk500:", self.connector.getConnectionId())
                cb(self.transaction.getConnectionId())
              })
              this.connector.transition("openDevice", dev, speed, msg)
            },
            closeDevice: function(cb) {
              if (this.closed) {
                cb()
                return
              }
              this.closed = true
              if (!this.connector) {
                this.transaction.errCb(errno.PREMATURE_RETURN, {
                  desc: "serial closing null device"
                })
                return
              }
              if (this.transaction.getConnectionId() === null) {
                this.log.log("Skipping disconnecting of a non-connected transaction.")
                cb()
                return
              }
              var cid = this.transaction.getConnectionId(),
                connector = this.connector
                this.log.log("Closing device", cid)
                connector.maybeSetControls(cid, false, function() {
                  connector.maybeDisconnect(cid, cb)
                })
            }
          }
          module.exports.SerialReset = SerialReset
          module.exports.ConnectionManager = ConnectionManager
