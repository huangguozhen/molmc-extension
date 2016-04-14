(function(global) {
  const getLog = require('./backend/logging').getLog,
    Event = require("./event.js").Event,
    errno = require("./backend/errno.js"),
    scheduler = require("./backend/scheduler.js"),
    wrapper = require("./wrapper.js"),
    asAvailable = require("./appavailability.js").asAvailable,
    SerialMonitor = require("./serialmonitor/monitor.js").Monitor

  class Plugin {
    constructor () {
      const self = this
      this.log = getLog('Plugin')
      this.log.log('New Plugin.')

      this.version = null
      asAvailable.call(this)

      this.onFound.setDispatcher((listener, version) => {
        if (version) {
          listener(version)
          return
        }
        self.getVersion((version) => listener(version))
      })

      global.chrome = global.chrome || {}
      wrapper.wrap(global.chrome, self.api)
      this.onFound.addListener((version) => {
        if (self.serialMonitor) {
          self.serialMonitor.disconnect()
        }
        self.serial = self.api.serial
      })

      this.serialMonitor = null
      this.onLost.addListener(() => self.close(false))
      this.onError.addListener((error) => {
        if (error.badVersion) {
          self.onFound.setDispatcher(error.badVersion)
        }
      })

      this.onRawMessageReceived = new Event()
    }

    errorCallback (from, msg, status) {
      console.error('[' + from + '] ', msg, '(status: ' + status + ')')
    }

    serialRead (port, baudrate, readCb, connectErrorCb) {
      const self = this;
      const handleClose = (err) => {
        const success = err.id == errno.SUCCESS.id,
          // error = !success,
          deviceLost = err.id == errno.SERIAL_MONITOR_DEVICE_LOST.id,
          connectError = err.id == errno.SERIAL_MONITOR_CONNECT.id || err.id == errno.RESOURCE_BUSY.id || err.id == errno.RESOURCE_BUSY_FROM_CHROME.id,
          normalClose = success || deviceLost;
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

      this.serialMonitor = new SerialMonitor(port, Number.parseInt(baudrate), this.api);
      this.serialMonitor.onRead.addListener((msg) => readCb(null, msg))
      this.serialMonitor.onRead.addListener((msg) => {
        scheduler.setImmediate(() => {
          self.onRawMessageReceived.dispatch(msg)
        })
      })

      this.serialMonitor.onClose.addListener(handleClose)
    }

    serialWrite (strData, cb) {
      this.serialMonitor.writer.write(strData, cb)
    }

    cachingGetDevices (cb) {
      var self = this;

      if (!self._cachedPorts) {
        this.serial.getDevices((devs) => {
          var devUniquify = {};
          (devs || []).forEach((d) => {
            var trueDevName = d.path.replace("/dev/tty.", "/dev/cu.");
            if (!devUniquify[trueDevName] || d.path == trueDevName) devUniquify[trueDevName] = d
          });

          self._cachedPorts = Object.getOwnPropertyNames(devUniquify).map((k) => devUniquify[k]);
          cb(self._cachedPorts);

          setTimeout(() => {
            self._cachedPorts = null
          }, 1e3)
        });

        return
      }

      cb(self._cachedPorts)
    }

    availablePorts (cb) {
      this.cachingGetDevices(function(devs) {
        cb(this.pluginDevsFormat_(devs).map((d) => d.port).join(","))
      }.bind(this))
    }

    getPorts (cb) {
      const self = this;
      this.cachingGetDevices((devs) => {
        let ret = JSON.stringify(self.pluginDevsFormat_(devs));
        cb(ret)
      })
    }

    pluginDevsFormat_ (devs) {
      let set_ = {};
      devs.forEach((d) => {
        set_[d.path] = true
      });
      return Object.getOwnPropertyNames(set_).map((dev) => ({port: dev}))
    }

    probeUSB (cb) {
      this.availablePorts(cb)
    }

    getFlashResult (cb) {
      cb(this.lastFlashResult)
    }

    getVersion (cb) {
      const self = this
      if (this.version) {
        cb(this.version)
        return
      }

      this.api.runtime.getManifestAsync((manifest) => {
        if (self.api.runtime.lastError) {
          throw new Error(self.api.runtime.lastError.message || self.api.runtime.lastError)
        }
        if (!manifest) {
          throw Error('Could not retrieve app version')
        }
        self.version = manifest.version
        cb(self.version)
      })
    }

    setCallback (cb) {
      this.sendUiMessage = (msg) => {
        if (msg === "disconnect") msg = "disconnect ";
        cb(null, msg)
      }

      this.serialMonitorDisconnect = () => {
        cb(null, "disconnect")
      }

      return true
    }

    sendUiMessage () {
      console.warn("Use setCallback to provide a way of communicating with the ui.")
    }

    serialMonitorDisconnect () {
      console.warn("Use setCallback to provide a way of communicating with the ui.")
    }

    setErrorCallback (cb) {
      this.errorCallback = cb;
      return true
    }

    deleteMap () {
      this.close()
    }

    closeTab () {
      this.close()
    }

    serialMonitorSetStatus (cb) {
      this.serialMonitor.disconnect(cb);
      this.serialMonitor = null
    }

    saveToHex (hexString) {
      this.hexString = hexString
    }

    close (shutdown, cb) {
      if (this.serialMonitor) {
        this.serialMonitor.disconnect();
        this.serialMonitor = null
      }
      this.version = null;
      if (this.transaction) {
        this.transaction.cleanup()
      }
      if (shutdown) {
        this.shutdown(cb);
        return
      }
      this.disconnect(cb)
    }

    debugEnable (verbosity) {
      if (typeof verbosity === "number") {
        global.verbosity = verbosity
      }
    }
  }

  global.IntoRobotPlugin = Plugin
  module.exports = global.IntoRobotPlugin
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
