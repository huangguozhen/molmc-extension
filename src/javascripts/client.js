(function(global) {
  /* eslint no-unused-vars: 0 */
  // var protocols = require("./backend/protocols.js").protocols,
  var util = require("./backend/util.js"),
    settings = require("./backend/settings.js"),
    defaultSettings = require("./default.js").settings,
    hexutil = require("./backend/hexparser.js"),
    scheduler = require("./backend/scheduler.js"),
    avrdudeconf = require("./backend/avrdudeconf.js"),
    Event = require("./event.js").Event,
    errno = require("./backend/errno.js"),
    status = require("./backend/status.js"),
    hexfile = require("./backend/hexfile.js"),
    base64 = require("./backend/base64.js"),
    logger = require("./backend/logging.js").getLog,
    wrapper = require("./wrapper.js"),
    api = require("./api.js"),
    killFlashButton = require("./killflash.js"),
    asAvailable = require("./appavailability.js").asAvailable,
    SerialMonitor = require("./serialmonitor/monitor.js").Monitor

  function Plugin() {
    var self = this
    this.log = logger("Plugin")
    this.log.log("New plugin.")
    this.version = null
    asAvailable.call(this)
    this.onFound.setDispatcher(function(listener, version) {
      if (version) {
        listener(version)
        return
      }
      self.getVersion(function(version) {
        listener(version)
      })
    })
    global.chrome = global.chrome || {}
    wrapper.wrap(global.chrome, self.api)
    this.onFound.addListener(function(version) {
      if (self.serialMonitor) {
        self.serialMonitor.disconnect()
      }
      self.serial = self.api.serial
    })
    this.serialMonitor = null
    this.onLost.addListener(function() {
      self.close(false)
    })
    this.onError.addListener(function(error) {
      if (error.badVersion) {
        self.onFound.dispatch(error.badVersion)
      }
    })
    this.onRawMessageReceived = new Event()
  }
  Plugin.prototype = {
    errorCallback: function(from, msg, status) {
      console.error("[" + from + "] ", msg, "(status: " + status + ")")
    },
    serialRead: function(port, baudrate, readCb, connectErrorCb) {
      var self = this

      function handleClose(err) {
        var success = err.id == errno.SUCCESS.id,
          error = !success,
          deviceLost = err.id == errno.SERIAL_MONITOR_DEVICE_LOST.id,
          connectError = err.id == errno.SERIAL_MONITOR_CONNECT.id || err.id == errno.RESOURCE_BUSY.id || err.id == errno.RESOURCE_BUSY_FROM_CHROME.id,
          normalClose = success || deviceLost
        if (deviceLost) {
          self.errorCallback(null, err.shortMessage(), 1)
        }
        if (normalClose || connectError) {
          self.serialMonitorDisconnect()
        }
        if (connectError) {
          connectErrorCb(null, err.value)
        }
      }
      this.serialMonitor = new SerialMonitor(port, Number.parseInt(baudrate), this.api)
      this.serialMonitor.onRead.addListener(function(msg) {
        readCb(null, msg)
      })
      this.serialMonitor.onRead.addListener(function(msg) {
        scheduler.setImmediate(function() {
          self.onRawMessageReceived.dispatch(msg)
        })
      })
      this.serialMonitor.onClose.addListener(handleClose)
    },
    flashBootloader: function(device, protocol, communication, speed, force, delay, high_fuses, low_fuses, extended_fuses, unlock_bits, lock_bits, mcu, cb, _extraConfig) {
      function toint(hex) {
        return hex ? Number.parseInt(hex.substring(2), 16) : null
      }
      var _ = null,
        controlBits = {
          lfuse: toint(low_fuses),
          efuse: toint(extended_fuses),
          lock: toint(unlock_bits),
          hfuse: toint(high_fuses)
        },
        extraConfig = settings.toSettings(_extraConfig).child({
          controlBits: controlBits,
          cleanControlBits: {
            lock: toint(lock_bits)
          },
          chipErase: true
        })
      var p = new hexfile.Parser(this.hexString),
        data = p.data()
      if (data === null) {
        cb("extension", p.lastError)
        return
      }
      data.defaultByte = 255
      this.flashWithProgrammer(device, data, _, protocol, communication, speed, force, delay, mcu, cb, extraConfig)
    },
    flashWithProgrammer: function(device, code, maxsize, protocol, communication, speed, force, delay, mcu, cb, _extraConfig) {
      var extraConfig = settings.toSettings(_extraConfig).child({
        avoidTwiggleDTR: true,
        confirmPages: true,
        readSwVersion: true,
        chipErase: true,
        skipSignatureCheck: force == "true",
        communication: communication || "usb",
        dryRun: window.dryRun
      })
      this.flash(device, code, maxsize, protocol, false, speed, mcu, cb, extraConfig)
    },
    // flash: function(device, code, maxsize, protocol, disable_flushing, speed, mcu, cb, _extraConfig) {
    //   this.log.log("Flashing " + device)
    //   if (typeof code === "string") {
    //     var p = new base64.Parser(code, 0, maxsize)
    //     code = p.data()
    //     if (code === null) {
    //       cb("extension-client", p.lastError.value)
    //       return
    //     }
    //   }
    //   var from = null,
    //     self = this,
    //     config = settings.toSettings(_extraConfig).child({
    //       api: this.api,
    //       maxsize: Number(maxsize),
    //       protocol: protocol,
    //       disableFlushing: disable_flushing && disable_flushing != "false",
    //       speed: Number(speed),
    //       mcu: mcu,
    //       avrdude: avrdudeconf.getMCUConf(mcu)
    //     }).parent(defaultSettings),
    //     finishCallback = function() {
    //       var pluginReturnValue = 0
    //       self.log.log("Flash success")
    //       cb(from, pluginReturnValue)
    //       self.transaction = null
    //     },
    //     errorCallback = function(id, msg) {
    //       scheduler.setTimeout(function() {
    //         self.transaction = null
    //         var warnOrError = id >= defaultSettings.get("warningReturnValueRange")[0] && id <= defaultSettings.get("warningReturnValueRange")[1] ? 1 : 0
    //         self.errorCallback("extension-client", msg, warnOrError)
    //       })
    //       self.log.log("Flash fail.")
    //       self.lastFlashResult = msg
    //       self.transaction = null
    //       cb(from, id)
    //     },
    //     messageCallback = function(s) {
    //       if (s.id == status.BLOCKING_STATES.id) {
    //         scheduler.setTimeout(function() {
    //           self.sendUiMessage(s.toCrazyLog())
    //         })
    //       }
    //       var msg = null
    //       if (!(s.id != status.LEONARDO_RESET_START.id && s.priority > 0 && !config.get("statusLog"))) {
    //         msg = s.toString()
    //       }
    //       if (config.get("killButton")) {
    //         msg = (msg || "Flashing device...") + killFlashButton(self.transaction)
    //       }
    //       if (msg) self.sendUiMessage(msg)
    //     }

    //   function doflash() {
    //     var dodoFlash = function() {
    //       self.log.log("Code length", code.length || code.data.length, "Protocol:", protocols, "Device:", device)
    //       self.transaction.flash(device, code.squashed())
    //     }
    //     self.transaction = new (protocols[config.get("communication") || "serial"][protocol])(config.obj(), finishCallback, errorCallback)
    //     self.transaction.onStatusChange.addListener(messageCallback)
    //     if (self.transaction.destroyOtherConnections) {
    //       self.transaction.destroyOtherConnections(device, dodoFlash)
    //       return
    //     }
    //     dodoFlash()
    //   }
    //   if (self.transaction) {
    //     self.transaction.cleanup(doflash)
    //     return
    //   }
    //   doflash()
    // },
    cachingGetDevices: function(cb) {
      var self = this
      if (!self._cachedPorts) {
        this.serial.getDevices(function(devs) {
          var devUniquify = {};
          (devs || []).forEach(function(d) {
            var trueDevName = d.path.replace("/dev/tty.", "/dev/cu.")
            if (!devUniquify[trueDevName] || d.path == trueDevName) devUniquify[trueDevName] = d
          })
          self._cachedPorts = Object.getOwnPropertyNames(devUniquify).map(function(k) {
            return devUniquify[k]
          })
          cb(self._cachedPorts)
          setTimeout(function() {
            self._cachedPorts = null
          }, 1e3)
        })
        return
      }
      cb(self._cachedPorts)
    },
    availablePorts: function(cb) {
      this.cachingGetDevices(function(devs) {
        cb(this.pluginDevsFormat_(devs).map(function(d) {
          return d.port
        }).join(","))
      }.bind(this))
    },
    getPorts: function(cb) {
      var self = this
      this.cachingGetDevices(function(devs) {
        var ret = JSON.stringify(self.pluginDevsFormat_(devs))
        cb(ret)
      })
    },
    pluginDevsFormat_: function(devs) {
      var set_ = {}
      devs.forEach(function(d) {
        set_[d.path] = true
      })
      return Object.getOwnPropertyNames(set_).map(function(dev) {
        return {
          port: dev
        }
      })
    },
    probeUSB: function(cb) {
      this.availablePorts(cb)
    },
    getFlashResult: function(cb) {
      cb(this.lastFlashResult)
    },
    getVersion: function(cb) {
      var self = this
      if (this.version) {
        cb(this.version)
        return
      }
      this.api.runtime.getManifestAsync(function(manifest) {
        if (self.api.runtime.lastError) {
          throw new Error(self.api.runtime.lastError.message || self.api.runtime.lastError)
        }
        if (!manifest) {
          throw Error("Could not retrieve app version")
        }
        self.version = manifest.version
        cb(self.version)
      })
    },
    // saveToHex: function(strData) {
    //   console.error("Not implemented")
    // },
    serialWrite: function(strData, cb) {
      this.serialMonitor.writer.write(strData, cb)
    },
    setCallback: function(cb) {
      this.sendUiMessage = function(msg) {
        if (msg === "disconnect") msg = "disconnect "
        cb(null, msg)
      }
      this.serialMonitorDisconnect = function() {
        cb(null, "disconnect")
      }
      return true
    },
    sendUiMessage: function() {
      console.warn("Use setCallback to provide a way of communicating with the ui.")
    },
    serialMonitorDisconnect: function() {
      console.warn("Use setCallback to provide a way of communicating with the ui.")
    },
    setErrorCallback: function(cb) {
      this.errorCallback = cb
      return true
    },
    deleteMap: function() {
      this.close()
    },
    closeTab: function() {
      this.close()
    },
    serialMonitorSetStatus: function(cb) {
      this.serialMonitor.disconnect(cb)
      this.serialMonitor = null
    },
    saveToHex: function(hexString) {
      this.hexString = hexString
    },
    close: function(shutdown, cb) {
      if (this.serialMonitor) {
        this.serialMonitor.disconnect()
        this.serialMonitor = null
      }
      this.version = null
      if (this.transaction) {
        this.transaction.cleanup()
      }
      if (shutdown) {
        this.shutdown(cb)
        return
      }
      this.disconnect(cb)
    },
    debugEnable: function(verbosity) {
      if (typeof verbosity === "number") global.verbosity = verbosity
    }
  }
  global.CodebenderPlugin = Plugin
  module.exports = global.CodebenderPlugin
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
