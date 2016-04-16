var scheduler = require("./scheduler.js")
var uniqueIds = 1,
  COMMON = 1,
    LEONARDO = 1,
      SERIAL_RESET = 1

      function showArray(arr) {
        if (arr.length >= 5) {
          return "[" + arr.length + " items]"
        }
        return arr.reduce(function(ret, it) {
          if (typeof it === "string") return ret + ' "' + it + '"'
          var val = show(it)
          if (!val) return ret
          return ret + " " + val
        }, "")
      }

      function show(obj) {
        if (typeof obj === "function") {
          return null
        }
        if (obj instanceof Array) {
          return showArray(obj)
        }
        if (typeof obj === "string") {
          return obj
        }
        try {
          var str = JSON.stringify(obj)
          if (str.length < 100) {
            return str
          }
        } catch (e) {
          return obj + ""
        }
      }

      function Status(priority, message, timestamp, id, context) {
        this.priority = priority
        this.context = context || null
        this.message = message
        this.timestamp = timestamp || null
        this.id = id || uniqueIds++
      }
      Status.prototype = {
        toCrazyLog: function() {
          return {
            isCrazyLog: true,
            metadata: this.toString()
          }
        },
        copy: function(context) {
          return new Status(this.priority, this.message, scheduler.now(), this.id, context || this.context)
        },
        toString: function() {
          var ctx = this.context || {}
          return Object.getOwnPropertyNames(ctx).reduce(function(ret, key) {
            return ret.replace("{" + key + "}", show(ctx[key]))
          }, this.message)
        }
      }
      module.exports = {
        BABELFISH: new Status(0, "Welcome to babelfish!"),
        BLOCKING_STATES: new Status(COMMON, "Blocking states: {states}"),
        TRANSITION: new Status(COMMON, "Jumping to {state}: {args}"),
        CONNECTING: new Status(COMMON, "Connecting to: {device}"),
        SIGN_ON: new Status(COMMON, "Signing on"),
        CHECK_SIGNATURE: new Status(COMMON, "Checking signature"),
        HARDWARE_VERSION: new Status(COMMON, "Getting hardware version"),
        SOFTWARE_VERSION: new Status(COMMON, "Getting software version"),
        ENTER_PROGMODE: new Status(COMMON, "Entering programming mode"),
        START_WRITE_DATA: new Status(COMMON, "Starting to write data"),
        SYNC: new Status(COMMON, "Syncing with the device"),
        START_CHECK_DATA: new Status(COMMON, "Starting to check data"),
        LEAVE_PROGMODE: new Status(COMMON, "Leaving programming mode"),
        CLEANING_UP: new Status(COMMON, "Creaning up state"),
        WRITE_PAGE: new Status(COMMON, "Writing page to address {address}"),
        CHECK_PAGE: new Status(COMMON, "Checking page at address {address}"),
        PRECONFIGURING: new Status(SERIAL_RESET, "Preconfiguring serial device: {device}"),
        CONNECTING: new Status(SERIAL_RESET, "Connecting to device: {device}"),
        RESETTING: new Status(SERIAL_RESET, "Resetting device: {device}"),
        LEONARDO_RESET_START: new Status(LEONARDO, "Trying to auto-reset your device. If it does not reset automatically, please reset your device manually!"),
        LEONARDO_RESET_END: new Status(LEONARDO, "Leonardo board reset successfully!"),
        START_FLASH: new Status(LEONARDO, "Flashing device please wait...")
      }
