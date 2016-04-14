/* eslint no-unused-vars: 0 */
var genericRespHandler = require('./../responses.js').genericRespHandler,
    messageApi = require("./../messaging.js"),
    log = new (require('./../log.js').Log)('genericrequest');

/**
 * A generic request to inherit new ones from. Make sure you define
 * hostId property in your classes and also define a forSending.
 */
function GenericRequest() {};

GenericRequest.prototype = {
  /**
   * Create a serializable object to send over the API.
   * @returns {Message} a serialized messae
   */
  forSending: function () {
    throw Error("forSending not implemented.");
  },

  /**
   * Send the request and handle the response.
   * @param {Function} cb Called when handling is finished. No
   * arguments in case it succeeds, an error object if it failes
   */
  send: function (cb, errorCb) {
    var self = this,
        msg = this.forSending(),
        hostId = this.hostId;

    messageApi.sendMessage(
      hostId, msg, function (resp) {
        genericRespHandler(resp, self,
                           cb || function (err) {
                             if (err) {
                               throw err;
                             };
                           });
      });
  }
};
module.exports.GenericRequest = GenericRequest;
