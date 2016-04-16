(function(global) {
  var Stk500 = require("./protocols/stk500").STK500Transaction
  var Stk500v2 = require("./protocols/stk500v2").STK500v2Transaction
  var Stk500v2Usb = require("./protocols/stk500v2usb").STK500v2UsbTransaction
  var Avr109 = require("./protocols/butterfly").AVR109Transaction
  var USBTiny = require("./protocols/usbtiny").USBTinyTransaction
  var USBAsp = require("./protocols/usbasp").USBAspTransaction
  module.exports.protocols = {
    serial: {
      stk500v2: Stk500v2,
      wiring: Stk500v2,
      stk500: Stk500v2,
      arduino: Stk500,
      stk500v1: Stk500,
      avr109: Avr109
    },
    usb: {
      usbasp: USBAsp,
      usbtiny: USBTiny,
      stk500v2: Stk500v2Usb
    }
  }
  global.DATA = {}

  function Intercepted(Constructor, type, name) {
    function NewConstructor() {
      var config = arguments[0],
        rec = new (require("BlackMirror").Recorder)(arguments[0].api, ["babelfish.getState", "runtime.getManifestAsync", "serial.onReceiveError.forceDispatch", "runtime.getPlatformInfo", "serial.getDevices", "serial.connect", "serial.update", "serial.disconnect", "serial.setPaused", "serial.getInfo", "serial.getConnections", "serial.send", "serial.flush", "serial.getControlSignals", "serial.setControlSignals", "serial.onReceive.addListener", "serial.onReceive.removeListener", "serial.onReceiveError.addListener", "serial.onReceiveError.removeListener", "usb.getDevices", "usb.getUserSelectedDevices", "usb.requestAccess", "usb.openDevice", "usb.findDevices", "usb.closeDevice", "usb.setConfiguration", "usb.getConfiguration", "usb.getConfigurations", "usb.listInterfaces", "usb.claimInterface", "usb.releaseInterface", "usb.setInterfaceAlternateSetting", "usb.controlTransfer", "usb.bulkTransfer", "usb.interruptTransfer", "usb.isochronousTransfer", "usb.resetDevice", "usb.onDeviceAdded.addListener", "usb.onDeviceAdded.removeListener", "usb.onDeviceRemoved.addListener", "usb.onDeviceRemoved.removeListener"]),
        self = this
      arguments[0].api = rec.api
      global.saveLastFlash = function() {
        var ret = {
          device: self.deviceName,
          data: {
            data: self.sketchData.data,
            offset: self.sketchData.min(),
            "default": self.sketchData.defaultByte
          },
          config: config,
          checker: rec.checker().serialize([])
        }
        global.getArgs = "You need to re-record to use getArgs"
        global.DATA[type] = global.DATA[type] || {}
        global.DATA[type][name] = ret
        console.log("Saved in window.DATA[", type, "][", name, "]")
      }
      Constructor.apply(this, arguments)
    }
    NewConstructor.prototype = Constructor.prototype
    return NewConstructor
  }

  /* eslint no-unused-vars: 0 */
  function interceptedObject(obj) {
    var ret = {
      intercepted: true
    }
    Object.getOwnPropertyNames(obj).forEach(function(t) {
      ret[t] = {}
      Object.getOwnPropertyNames(obj[t]).forEach(function(n) {
        ret[t][n] = Intercepted(obj[t][n], t, n)
      })
    })
    return ret
  }
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
