(function(global) {
  var dbg = console.log.bind(console),
    defaultSettings = require("./../default.js").settings,
    NODEJS = global.window !== global

  function ModifiedConsole(console) {
    this.console = console
    this.setConsoleMethod("error")
    this.setConsoleMethod("warn")
    this.setConsoleMethod("info")
    this.setConsoleMethod("log")
    this.setConsoleMethod("debug")
  }
  ModifiedConsole.prototype = {
    setConsoleMethod: function(type) {
      var self = this
      Object.defineProperty(this, type, {
        get: function() {
          return self.consoleMethod(Function.prototype.bind.call(self.console[type], self.console), type)
        }
      })
    },
    consoleMethod: function(origMethod, name) {
      return origMethod
    }
  }

  function ConditionalConsole(console) {
    ModifiedConsole.call(this, console)
  }
  ConditionalConsole.prototype = Object.create(ModifiedConsole.prototype)
  ConditionalConsole.prototype.consoleMethod = function(origLog, name) {
    if (this.shouldCall(origLog, name)) return origLog
    return function() {}
  }
  ConditionalConsole.prototype.shouldCall = function(origLog, name) {
    return true
  }

  function VerbosityConsole(console) {
    ConditionalConsole.call(this, console)
    this.typeThresholds = {
      error: 0,
      warn: 1,
      info: 2,
      log: 3,
      debug: 4
    }
  }
  VerbosityConsole.prototype = Object.create(ConditionalConsole.prototype)
  VerbosityConsole.prototype.verbosity = function() {
    if (typeof this.verbosity === "number") return this.verbosity
    return defaultSettings.get("verbosity")
  }
  VerbosityConsole.prototype.shouldCall = function(origLog, name) {
    var threshold = this.typeThresholds[name]
    return this.verbosity() >= threshold && !NODEJS
  }

  function PrefixConsole(prefix, console) {
    ModifiedConsole.call(this, console)
    this.prefix = prefix
  }
  PrefixConsole.prototype = Object.create(ModifiedConsole.prototype)
  PrefixConsole.prototype.consoleMethod = function(origLog) {
    var ol = ModifiedConsole.prototype.consoleMethod.call(this, origLog)
    return ol.bind(null, "[" + this.getPrefix() + "]")
  }
  PrefixConsole.prototype.getPrefix = function() {
    return this.prefix
  }

  function PrefixTimestampConsole(prefix, console) {
    PrefixConsole.call(this, prefix, console)
  }
  PrefixTimestampConsole.prototype = Object.create(PrefixConsole.prototype)
  PrefixTimestampConsole.prototype.getPrefix = function() {
    return this.timestampString() + ":" + this.prefix
  }
  PrefixTimestampConsole.prototype.timestampString = function() {
    var date = this.getDate()
    var pad = function(n) {
      if (n < 10) {
        return "0" + n
      }
      return n
    }
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + "." + this.zeroFill(date.getMilliseconds(), 3)
  }
  PrefixTimestampConsole.prototype.zeroFill = function(number, width) {
    width -= number.toString().length
    if (width > 0) {
      return new Array(width + (/\./.test(number) ? 2 : 1)).join("0") + number
    }
    return number + ""
  }
  PrefixTimestampConsole.prototype.getDate = function() {
    return new Date()
  }

  function PrefixTimediffConsole(prefix, console) {
    PrefixConsole.call(this, prefix, console)
  }
  PrefixTimediffConsole.prototype = Object.create(PrefixTimestampConsole.prototype)
  PrefixTimediffConsole.prototype.lastLogTime = Date.now()
  PrefixTimediffConsole.prototype.getDate = function() {
    var proto = Object.getPrototypeOf(this),
      time = Date.now() - proto.lastLogTime
    proto.lastLogTime = Date.now()
    return new Date(time + (new Date()).getTimezoneOffset() * 6e4)
  }
  var loggers = {
    "default": function(prefix) {
      return new VerbosityConsole(new PrefixTimestampConsole(prefix, global.console))
    },
    timediff: function(prefix) {
      return new VerbosityConsole(new PrefixTimediffConsole(prefix, global.console))
    }
  }

  function getLog(prefix) {
    return (loggers[defaultSettings.get("logger")] || loggers["default"])(prefix)
  }
  module.exports.getLog = getLog
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
