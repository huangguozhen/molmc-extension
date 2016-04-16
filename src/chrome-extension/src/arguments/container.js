/**
 * @fileOverview Abstractions for handling argument transformation for
 * transportation between host-client.
 * @name container.js
 * @author Chris Perivolaroulos
 */

var CallbackArgument = require('./callback.js'),
  argumentFactory = require('./factory.js').argumentFactory

/**
 * An wrapper around an arguments list that abstracts all
 * trasformations to serialize them, convert them to a callable state,
 * substitute callbacks with 'send response' callbakcs etc. We support
 * only one callback per Arguments object. This object will do the
 * right thing depending on whether weare on the host or the client.
 *
 * @param {Array} arguments An array of arguments either serialized or
 * not. The elements will be handled by argument types.
 * @param {Function} replaceCb The 'send request' callback typically
 * to substitute the callback in the arguments.
 */
function Arguments (args, replaceCb) {
  this.arguments = args.map(function (a) {
    return argumentFactory(a, replaceCb)
  })
}

Arguments.prototype = {
  /**
   * The argument list suitable for passing to an api method.
   * @returns {Array} An array of arguments as expected by the API
   */
  forCalling: function () {
    return this.arguments.map(function (a) { return a.forCalling() })
  },

  /**
   * The argument list suitable for sending over the message passing
   * api of chrome.
   * @returns {Array} The argument array serialized.
   */
  forSending: function () {
    return this.arguments.map(function (a) {
      return a.forSending()
    })
  },

  /**
   * Depending on wether we are on the client or the host get the
   * callback found in the arguments.
   *
   * @returns {Function} Either the 'send response' callback, or the
   * actual callback.
   */
  getCallback: function () {
    var cbArg = this.arguments.filter(function (a) { return a instanceof CallbackArgument })[0],
      ret = cbArg ? cbArg.forCalling() : this.replaceCb

    return ret
  },

  setLens: function(lens) {
    if (this.replaceCb) {
      this.replaceCb = lens(this.replaceCb)
    }

    this.arguments.forEach(function(a) {
      if (a.setLens) a.setLens(lens)
    })
  }
}

module.exports = Arguments
