(function (global) {
var timeOffset = Date.now();
global.debugBabelfish = false;

function zeroFill(number, width) {
  width -= number.toString().length;
  if (width > 0) {
    return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number;
  }
  return number + ""; // always return a string
}

function Log (name, verbosity) {
  this.verbosity = verbosity || 1;
  this.name = name;
  this.resetTimeOffset();

  this.showTimes = false;
  this.error = this.console_('error', 0);
  this.warn = this.console_('warn', 1);
  this.info = this.console_('log', 2);
  this.log = this.console_('log', 3);
}

Log.prototype = {
  timestampString: function () {
    var now = new Date(new Date() - timeOffset +
                       timeOffset.getTimezoneOffset() * 60000);
    var pad = function (n) {
      if (n < 10) { return "0" + n; }
      return n;
    };
    return pad(now.getHours()) + ":" + pad(now.getMinutes())
      + ":" + pad(now.getSeconds()) + "." + zeroFill(now.getMilliseconds(), 3);
  },

  resetTimeOffset: function () {
    timeOffset = new Date();
  },

  console_: function (type, verbosity) {
    var self = this;
    if (this.showTimes) {
      return function () {
        if (self.verbosity > verbosity || global.debugBabelfish) {
          return console[type].apply(console,
                                     [self.prefix()].concat(arguments));
        }
      };
    }
    if (this.verbosity > verbosity || global.debugBabelfish) {
      return console[type].bind(console, this.prefix());
    }
    return function () {};
  },

  prefix: function () {
    if (this.showTimes) {
      return "[" + this.timestampString() + " : " + this.name + "]";
    }

    return "[" + this.name + "] ";
  }
};
module.exports.Log = Log;

}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
