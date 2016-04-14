/**
 * @fileOverview The interface that all response types need to be
 * implementing
 * @name generic.js
 * @author Chris Perivolaropoulos
 */

function GenericResponse () {}
GenericResponse.prototype = {
  send: function (sendCb) {
    return sendCb(this.forSending());
  },

  forSending: function () {
    throw new Error("Not implemented");
  }
};

/**
 * Iterate over the response handlers and coose the correct one to
 * handle an incoming message on the clients.
 *
 * @param {Message} msg the raw message received by the server
 * @param {Request} request the request object that msg is a response
 * to.
 * @param {Function} done Call this when you are done. It will be
 * called with no arguments on succes or an error object on error.
 */

function genericRespHandler (msg, request, done) {
  // Be sure to throw done in the queue.
  function doneCb (err) {
    done(err);
  }

  var responseTypesArr = [
    require('./error.js'),                  // Catch the errors first
    require('./burst.js'),
    require('./arguments.js'),
    require('./ack.js')
  ];

  if (!responseTypesArr.some(function (RT) {
    return RT.maybeHandle(msg, request, doneCb);
  })) {
    done(new Error("Couldn't handle message: " + JSON.stringify(msg)));
  }
}
module.exports.GenericResponse = GenericResponse;
module.exports.genericRespHandler = genericRespHandler;
