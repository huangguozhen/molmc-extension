/**
 * @fileOverview A wrapper around a chrome api event or non-pure call
 * that needs cleaning up. Understands the currency of MethodRequests
 * for cleaning up and managing state and provides a unified interface
 * for cleaning any call based on client's instructions upon
 * connection.
 *
 * Due to usb.findDevices which opens multiple devices at once we may
 * need more than one cleanup methods to actually close the event
 * emitter.
 *
 * @name apieventemitter.js
 * @author Chris Perivolaropoulos
 */
var util = require("./util"),
  AckResponse = require('./responses.js').AckResponse,
  ArgsResponse = require('./responses.js').ArgsResponse,
  MethodRequest = require('./requests.js').MethodRequest,
  Arguments = require('./arguments.js').Arguments,
  log = new (require('./log.js').Log)('apieventemitter')

/**
 * Response methods to inject in an api depending on the closing type.
 */
var closingResponses = {
  callingArguments: function (closingRequest) {
    if (!closingRequest) {
      new MethodRequest(null, this.reverser.path, this.args)
        .call(null, this.hostApi)
      return null
    }

    if (this.reverser.path == closingRequest.method &&
        JSON.stringify(closingRequest.args.forSending()) ==
        JSON.stringify(this.args.forSending())) {
      closingRequest.call(null, this.hostApi)
      this.destroy(true)
      return new AckResponse()
    }

    return null
  },

  /**
   * Maybe cleanup based on the arguments of the first callback.
   *
   * @param {undefined|MethodReqest} closingRequest A method request
   * that is supposed to close. If not provided make sure we are
   * destroyed as there is noone to report to.
   * @returns {null|ArgsResponse} The response to be sent after the cleanup.
   */
  firstResponse: function (closingRequest) {
    var fr = this.firstResponseMsg
    if (!fr || fr.responseType != 'ArgsResponse') {
      return null
    }

    var closingArg = fr.args[0]
    if (this.reverser.firstArgPath) {
      closingArg = closingArg[this.reverser.firstArgPath]
    }

    if (!closingRequest) {
      // Just do your best.
      var mr = new MethodRequest(null, this.reverser.path,
                                 new Arguments([closingArg, function () {}]))
      mr.call(null, this.hostApi)
      return null
    }

    if (JSON.stringify(closingArg) ==
        JSON.stringify(closingRequest.args.forSending()[0]) &&
        closingRequest.method == this.reverser.path) {
      this.destroy(true)
      // The request will be called and will call an actual callback.
      return ArgsResponse.async(closingRequest, this.hostApi)
    }

    return null
  },

  // Backwards compatible
  serial: function (closingRequest) {
    var oldfap = this.reverser.firstArgPath = 'connectionId'
    return closingResponses.firstResponse(closingRequest)

    /* eslint no-unreachable: 0 */
    this.reverser.firstArgPath = oldfap
  },

  default: function (closingRequest) {
    return closingResponses.serial(closingRequest) ||
      closingResponses.firstResponse(closingRequest) ||
      closingResponses.callingArguments(closingRequest)
  }
}

/**
 * An Api event emitter or a method with side effects that need
 * cleaning up.
 *
 * @param {MethodRequest} methodRequest the information on how to call
 * the emitter
 * @param {ReverserObject} reverser a {path, type} reverser object.
 * @param {Object} hostApi The root of the host api.
 * @param {Function} closeCb Call this when closed
 */
function ApiEventEmitter (methodRequest, reverser, hostApi, closeCb) {
  var self = this
  this.methodName = methodRequest.method
  this.reverser = reverser
  this.hostApi = hostApi
  this.calledClosingRequests = []

  // Remember the first response
  this.args = methodRequest.args
  this.args.setLens(function (cb) {
    return function () {
      var args = [].slice.call(arguments)
      self.firstResponseMsg = self.firstResponseMsg || args[0]
      cb.apply(null, args)
    }
  })
  this.methodRequest = methodRequest
  log.log("Starting [rev type: " + self.reverser.type + "]: ", methodRequest.forSending())

  this.maybeRunCloser = function (closingRequest) {
    if (self.closed) {
      console.error("Trying to close a closed event emitter")
      // THis shouldn't happen
      return null
    }

    // Default to *some* way of handling responses.
    var closingResponseFactory = closingResponses[self.reverser.type] ||
        closingResponses.default,
        ret = closingResponseFactory.call(self, closingRequest)

    if (ret) {
      log.log("Closing[" + self.reverser.type + "]:", ret,
              "with", closingRequest)
    }
    return ret
  }

  // Actually trigger the event.
  this.closeCb = closeCb
}

ApiEventEmitter.prototype = {
  /**
   * Actually run the api event emitter.
   */
  fire: function () {
    log.log("Connected:", this.methodRequest.forSending())
    // No send function, just a hostapi
    this.methodRequest.call(null, this.hostApi)
  },

  /**
   * Call all the closing requests to close this event.
   * @param {Boolean} shallow True means the API part of destroying
   * has been handled.
   */
  destroy: function (shallow) {
    /* eslint no-unused-vars: 0 */
    var self = this
    // Closing this and the connection will create a loop so don't omit this.
    if (this.closed) return
    if (!shallow) this.maybeRunCloser()
    this.closed = true
    this.closeCb()
    log.log("Disconected:", this.methodRequest.forSending())
  },

  missingReverseCb: function () {
    throw new Error("No such method as " + this.methodName)
  },

  missingMethodCb: function () {
    throw new Error("No reverse method for " + this.methodName)
  }
}

module.exports.ApiEventEmitter = ApiEventEmitter
