var FiniteStateMachine = require("./../../fsm.js").FiniteStateMachine,
  scheduler = require("./../../scheduler.js"),
    ioutile = require("./../../io/util.js"),
      status = require("./../../status.js"),
        errno = require("./../../errno.js")
        var LEONARDO_RESET_MESSAGE = "Trying to auto-reset your device. If it does not reset automatically, please reset your device manually!"

        function pollGetDevicesUntil(expirationTime, devList, transaction, cb) {
          if (scheduler.now() >= expirationTime) {
            cb(null)
            return
          }
          if (transaction.dead()) return
          transaction.serial.getDevices(function(devs) {
            if (!devs) {
              transaction.errCb(errno.API_ERROR, {
                method: "serial.getDevices"
              })
              return
            }
            var newDevs = devs.filter(function(newDev) {
              return !devList.some(function(oldDev) {
                return oldDev.path == newDev.path
              })
            })
            if (newDevs.length > 0) {
              cb(newDevs[0].path)
              return
            }
            pollGetDevicesUntil(expirationTime, devs, transaction, cb)
          })
        }

        function MagicReset(config, finishCb, errorCb, parent) {
          FiniteStateMachine.call(this, {}, finishCb, errorCb, parent)
          this.schedulerTimeout = null
          this.config = config
          this.serial = this.config.api.serial
          this.magicBaudrate = 1200
          this.magicConnectionId = null
        }
        MagicReset.prototype = Object.create(FiniteStateMachine.prototype)
        MagicReset.prototype.openDevice = function(device, speed) {
          this.connectSpeed = speed
          this.initialDevice = device
          this.transition("magicConnect")
        }
        MagicReset.prototype.safeSetTimeout = function(cb, timeout) {
          var self = this
          if (this.safeTimeout) {
            this.errCb(errno.OVERLAPPING_TIMEOUTS)
            return
          }
          this.safeTimeout = scheduler.setTimeout(function() {
            self.safeTimeout = null
            cb()
          })
        }
        MagicReset.prototype.localCleanup = function(cb) {
          if (this.safeTimeout) scheduler.clearTimeout(this.safeTimeout)
          this.safeTimeout = null
          cb()
        }
        MagicReset.prototype.magicConnect = function() {
          var device = this.intialDevice,
            self = this
            this.serial.connect(this.initialDevice, {
              bitrate: this.magicBaudrate,
              name: this.initialDevice
            }, function(info) {
              if (!info) {
                console.warn("Failed to connect to magic baudrate." + "  Contiuing anyway.")
                self.transition("commenceReset")
                return
              }
              self.magicConnectionId = info.connectionId
              self.safeSetTimeout(self.transitionCb("magicDisconnect"), 2e3)
            })
        }
        MagicReset.prototype.controlSignal = function() {
          var self = this,
            failWarn = "I failed to set rts/dtr. " + "ArduinoIDE does not set rts, dtr when flashing AVR109 devices. " + "It expects that it will be set by the os during enumeration. " + "The codebenderplugin however does so explicitly, " + "but does not abort on failure."
            this.serial.setControlSignals(this.magicConnectionId, {
              rts: false,
              dtr: true
            }, function(ok) {
              if (!ok) {
                console.warn(failWarn)
              }
              self.safeSetTimeout(self.transitionCb("magicDisconnect"), 2e3)
            })
        }
        MagicReset.prototype.magicDisconnect = function() {
          var self = this
          this.serial.disconnect(this.magicConnectionId, function(ok) {
            self.magicConnectionId = null
            if (!ok) {
              self.errCb(errno.LEONARDO_MAGIC_DISCONNECT_FAIL, {
                initialDevice: self.initialDevice
              })
              return
            }
            self.transition("commenceReset")
          })
        }
        MagicReset.prototype.commenceReset = function() {
          this.setStatus(status.LEONARDO_RESET_START)
          this.transition({
            retries: 1,
            state: "waitForDevice"
          }, 5e3, this.transitionCb("tryOriginalDevice"))
        }
        MagicReset.prototype.waitForDevice = function(timeout, fallbackCb) {
          var expirationTime = scheduler.now() + timeout,
            self = this
            fallbackCb = fallbackCb || function() {
              self.errCb(errno.LEONARDO_REAPPEAR_TIMEOUT)
            }
            this.serial.getDevices(function(devs) {
              pollGetDevicesUntil(expirationTime, devs, self, function(dev) {
                if (!dev) {
                  fallbackCb()
                  return
                }
                scheduler.setTimeout(self.transitionCb("useDevice", dev), 100)
              })
            })
        }
        MagicReset.prototype.tryOriginalDevice = function(cb) {
          var self = this
          this.serial.getDevices(function(devs) {
            if (devs.some(function(dev) {
              return dev.path == self.initialDevice
            })) {
              self.transition("useDevice", self.initialDevice)
              return
            }
            self.transition({
              retries: 1,
              state: "waitForDevice"
            }, 5e3)
          })
        }
        MagicReset.prototype.useDevice = function(dev) {
          var self = this
          this.setStatus(status.LEONARDO_RESET_END)
          this.serial.connect(dev, {
            name: dev,
            bitrate: this.connectSpeed
          }, function(info) {
            if (!info) {
              self.errCb(errno.API_ERROR, {
                method: "serial.connect",
                dev: dev,
                speed: self.connectSpeed
              })
              return
            }
            self.setStatus(status.START_FLASH)
            if (self.parentState) self.parentState.parent.connectionId = info.connectionId
            self.cleanup()
          })
        }
        MagicReset.prototype.localCleanup = function(cb) {
          if (!this.magicConnectionId) {
            cb()
            return
          }
          this.serial.disconnect(this.magicConnectionId, function(ok) {
            cb()
          })
        }

        function PollingDisconnect(config, finishCb, errorCb, parent) {
          FiniteStateMachine.call(this, config, finishCb, errorCb, parent)
          this.serial = parent.serial
        }
        PollingDisconnect.prototype = Object.create(FiniteStateMachine.prototype)
        PollingDisconnect.prototype.closeDevice = function(initialDevice) {
          var self = this
          this.initialDevice = initialDevice
          if (!this.parentState.parent.connectionId) {
            this.cleanup()
            return
          }
          this.serial.disconnect(this.parentState.parent.connectionId, function(ok) {
            if (!ok) {
              self.errCb(errno.LEONARDO_BOOTLOADER_DISCONNECT, {
                connectionId: self.parentState.parent.connectionId,
                initialDevice: self.initialDevice
              })
              return
            }
            if (self.dead()) {
              self.cleanup()
              return
            }
            self.transition("originalDevReappear")
          })
          this.parentState.parent.connectionId = null
        }
        PollingDisconnect.prototype.originalDevReappear = function() {
          var self = this,
            expirationTime = scheduler.now() + 2e3
            this.serial.getDevices(function poll(devs) {
              if (devs.some(function(dev) {
                return dev.path == self.initialDevice
              })) {
                self.cleanup()
                return
              }
              pollGetDevicesUntil(expirationTime, devs, self, function(dev) {
                if (!dev) {
                  console.warn("Device didn't reappear", self.initialDevice)
                  self.cleanup()
                  return
                }
                poll(devs.concat([dev]))
              })
            })
        }

        function ConnectionManager(transaction) {
          this.transaction = transaction
        }
        ConnectionManager.prototype = {
          openDevice: function(dev, speed, _msg, cb) {
            var self = this
            this.connector = this.transaction.child(MagicReset, function() {
              cb(self.transaction.connectionId)
            })
            this.connector.openDevice(dev, speed)
          },
          closeDevice: function(cb) {
            if (this.closed) {
              cb()
              return
            }
            this.closed = true
            if (!this.connector) {
              this.transaction.errCb(errno.PREMATURE_RETURN, {
                desc: "magic closing null device"
              })
              return
            }
            this.disconnector = this.transaction.child(PollingDisconnect, cb)
            this.disconnector.closeDevice(this.connector.initialDevice)
          }
        }
        module.exports.MagicReset = MagicReset
        module.exports.PollingDisconnect = PollingDisconnect
        module.exports.ConnectionManager = ConnectionManager
