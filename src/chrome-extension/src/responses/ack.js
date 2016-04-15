var GenericResponse = require('./generic.js').GenericResponse;
require('./../setimmediate.js');

/**
 * The request wasn't supposed to yield any result but was
 * successful.
 */
function AckResponse () {
};

/**
 * Handle the response on the client side if it is of the correct
 * type.
 *
 * @param {Message} msg the raw message received by the server
 * @param {Request} request the request object that msg is a response
 * to.
 * @param {Function} doneCb Call this when you are done. It will be
 * called with no arguments on succes or an error object on error.
 * @return {Boolean} true if we handled it.
 */
AckResponse.maybeHandle = function (msg, request, doneCb) {
  if (msg.responseType != "AckResponse") return false;
  setImmediate(doneCb);
  return true;
};

AckResponse.prototype = Object.create(GenericResponse.prototype);

/**
 * Serialized response that also can be recognized as a response.
 *
 * @returns {Object} the object to be put through the API.
 */
AckResponse.prototype.forSending = function () {
  return {responseType: "AckResponse"};
};
module.exports = AckResponse;
