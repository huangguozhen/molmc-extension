(function(global) {
  // var protocols = require("./backend/protocols.js").protocols,
  //   util = require("./backend/util.js"),
  //   settings = require("./backend/settings.js"),
  //   defaultSettings = require("./default.js").settings,
  //   hexutil = require("./backend/hexparser.js"),
  //   avrdudeconf = require("./backend/avrdudeconf.js"),
  //   status = require("./backend/status.js"),
  //   hexfile = require("./backend/hexfile.js"),
  //   base64 = require("./backend/base64.js"),
  //   api = require("./api.js"),
  //   killFlashButton = require("./killflash.js"),
  var scheduler = require("./backend/scheduler.js"),
    Event = require("./event.js").Event,
    errno = require("./backend/errno.js"),
    logger = require("./backend/logging.js").getLog,
    wrapper = require("./wrapper.js"),
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

      /* eslint no-unused-vars: 0 */
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
  global.IntoRobotPlugin = Plugin
  module.exports = global.IntoRobotPlugin
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
