(function(global) {
  var bsc = require("./bootstrapclient.js"),
    s = require("./server.js");

  global.defaultConfig = {
    clientId: -1,
    reverseMethods: {
      "serial.onReceive.addListener": {
        path: "serial.onReceive.removeListener",
        type: "callingArguments"
      },

      "serial.onReceiveError.addListener": {
        path: "serial.onReceiveError.removeListener",
        type: "callingArguments"
      },

      "serial.connect": {
        path: "serial.disconnect",
        type: "firstResponse",
        firstArgPath: "connectionId"
      },

      "usb.openDevice": {
        path: "usb.closeDevice",
        type: "firstResponse",
        firstArgPath: null
      }
    },

    methods: ["babelfish.getState", "runtime.getManifestAsync", "serial.onReceiveError.forceDispatch", "runtime.getPlatformInfo", "serial.getDevices", "serial.connect", "serial.update", "serial.disconnect", "serial.setPaused", "serial.getInfo", "serial.getConnections", "serial.send", "serial.flush", "serial.getControlSignals", "serial.setControlSignals", "serial.onReceive.addListener", "serial.onReceive.removeListener", "serial.onReceiveError.addListener", "serial.onReceiveError.removeListener", "usb.getDevices", "usb.getUserSelectedDevices", "usb.requestAccess", "usb.openDevice", "usb.findDevices", "usb.closeDevice", "usb.setConfiguration", "usb.getConfiguration", "usb.getConfigurations", "usb.listInterfaces", "usb.claimInterface", "usb.releaseInterface", "usb.setInterfaceAlternateSetting", "usb.controlTransfer", "usb.bulkTransfer", "usb.interruptTransfer", "usb.isochronousTransfer", "usb.resetDevice", "usb.onDeviceAdded.addListener", "usb.onDeviceAdded.removeListener", "usb.onDeviceRemoved.addListener", "usb.onDeviceRemoved.removeListener"],
    noCallbackMethods: ["usb.onDeviceRemoved.removeListener", "usb.onDeviceAdded.removeListener", "serial.onReceiveError.removeListener", "serial.onReceive.removeListener", "serial.onReceive.forceDispatch"]
  };

  function getConfig(connectCb, disconnectCb, errorCb, timeout) {
    var newConfig = JSON.parse(JSON.stringify(global.defaultConfig));

    function doGetConfig(state, config) {
      config.version = state.version;
      if (parseInt(state.version.split(".").shift()) < 1) {
        errorCb({
          badVersion: config.version
        });
        return
      }
      s.getKeepAliveConnection(state.hostId, function(token) {
        config.token = token;
        config.chromeApi = chrome;
        config.hostId = state.hostId;
        config.clientId = config.token.clientId;
        connectCb(config)
      }, function(error) {
        if (disconnectCb && !error) {
          disconnectCb();
          return
        }
        if (errorCb && error) {
          errorCb(error);
          return
        }
      }, timeout)
    }

    bsc.getManifest(function(m) {
      if (!m) {
        disconnectCb();
        return
      }
      doGetConfig(m, newConfig)
    })
  }

  module.exports.getConfig = getConfig
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
