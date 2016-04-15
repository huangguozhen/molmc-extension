var GenericResponse = require('./generic.js').GenericResponse

/**
 * An error occured serving the request.
 *
 * @param {String} error The error message.
 * @param {Boolean} isUncaught True if we want to raise an uncaught
 * error when this happens and false if it should be passed to
 * chrome.runtime.lastError
 */
function ErrResponse (error, type) {
  this.error = error
  this.type = type
}

/**
 * Handle the response on the client side if it is of the correct
 * type. This will also handle messages that are undefined messages.
 *
 * @param {Message|undefined} msg the raw message received by the server
 * @param {Request} request the request object that msg is a response
 * to.
 * @param {Function} doneCb Call this when you are done. It will be
 * called with no arguments on succes or an error object on error.
 * @return {Boolean} true if we handled it.
 */
ErrResponse.maybeHandle = function (msg, request, doneCb) {
  if (msg && msg.responseType != "ErrResponse") return false

  var rawError = msg ? msg.err : "Undefined message, probably host is disconnected."
  if (request.trace) {
    console.warn("Received error:", msg.err)
    console.warn(request.trace)
  }

  var withError = function (err, cb) {
    cb()

    if (err) {
      console.error("Uncaught:", err)
    }
  }

  if (request.getCallback()) {
    (request.withError || withError)(rawError, request.getCallback())
    doneCb()
    return true
  }

  doneCb(rawError)
  return true
}

ErrResponse.prototype = new GenericResponse()

/**
 * Serialized response that also can be recognized as a response.
 *
 * @returns {Object} the object to be put through the API.
 */
ErrResponse.prototype.forSending = function () {
  return {
    responseType: "ErrResponse",
    err: this.error,
    type: this.type
  }
}
module.exports = ErrResponse
