var argumentClasses = require('./factory.js').argumentClasses;

/**
 * Wrap a callback. The callback will get an id. The arg's id (wether
 * function or object) preceeds the replaceCb id.
 *
 * @param {Function|Object} arg a serialized CallbackArgument or the
 * callback itself.
 * @param {Function} replaceCb if the provided arg was serialized
 * substitute it with this when asked for a callable.
 */
function CallbackArgument(arg, replaceCb) {
  if (!CallbackArgument.canWrap(arg)) {
    throw Error("Cant wrap argument " + arg + "as a function");
  }

  this.replaceCb = replaceCb || null;
  this.id = arg.id ||
    (this.replaceCb && this.replaceCb.id) ||
    Date.now() + Math.random();
  this.callback = arg instanceof Function ? arg : replaceCb;

  if (this.callback) {
    this.callback.id = this.id;
  }

  this.placeholder = {id: this.id, isCallback: true};
}

/**
 * Check if the argument is suitable for wrapping.
 *
 * @param {anything} arg
 * @returns {Boolean} True if it's safe to box with this type.
 */
CallbackArgument.canWrap = function (arg) {
  return arg && (arg instanceof Function || arg.isCallback);
};

CallbackArgument.prototype = {
  /**
   * @returns {Function } A callable that will either do the job on
   * the client, or send a message.
   */
  forCalling: function () {
    return this.lens ? this.lens(this.callback) : this.callback;
  },

  /**
   * @returns {Object} A serializable object.
   */
  forSending: function () {
    return this.placeholder;
  },

  setLens: function (lens) {
    this.lens = lens;
  }
};
argumentClasses.push(CallbackArgument);
module.exports = CallbackArgument;
