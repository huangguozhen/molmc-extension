/**
 * @fileOverview A request by the client to receive a burst of
 * requests from an api emitter. This is initially triggered by a data
 * ready signal via a connection from the host. When the client
 * receives it they send a BurstRequest when they are ready to receive
 * the data. The main reason for this is that sending messages is
 * quite expensive and we want to bundle them together as much as
 * possible when an event emmitter spams.
 * @name burstrequest.js
 * @author Chris Perivolaropoulos
 */

/* eslint no-unused-vars: 0 */
var Arguments = require('./../arguments.js').Arguements,
  log = new (require('./../log.js').Log)('burstrequest'),
  GenericRequest = require('./generic.js').GenericRequest,
  ErrResponse = require('./../responses.js').ErrResponse,
  BurstResponse = require('./../responses.js').BurstResponse

/**
 * A request for a burst of callbacks that are destined for the
 * client from a connection.
 *
 * @param {String} hostId The chrome app id.
 * @param {ClientConnection} connection the connection that holds the
 * callback arguments.
 * @param {Function} callback The event callback raw.
 */
function BurstRequest (hostId, connection, callback) {
  this.hostId = hostId
  this.connection = connection
  this.callback = callback
  this.blocked = false
}

/**
 * Handle a request for a burst on the server. If the message doesn't
 * seem valid, disregard it.
 *
 * @param {ApiMessage} msg The message as taken from the send
 * function, ie the forSending method.
 * @param {Array(HostConnections)} connections An array of connections
 * @param {Function(msg, sender, sendResp)} sendRespRaw callback to
 * send response.
 * @return {Boolean} True if we handled it.
 */
BurstRequest.maybeHandle = function (msg, connections, sendRespRaw) {
  if (msg.requestType != "BurstRequest") {
    return false
  }
  var usefulCons = connections.filter(function (c) {
    return msg.connId == c.id
  })

  if (usefulCons.length != 1) {
    var errMsg = "Burst request for connection " + msg.connId + " corresponds to " + usefulCons.length + " connections",
      errResp = new ErrResponse(errMsg)
    errResp.send(sendRespRaw)
    return true
  }

  function sendBuffer (buf) {
    var br = new BurstResponse(buf, msg)
    br.send(sendRespRaw)
  }

  usefulCons[0].flushBuffer(sendBuffer)
  return true
}

BurstRequest.prototype = Object.create(GenericRequest.prototype)

/**
 * Create a serializable object to send over the API.
 * @returns {Message} a serialized messae
 */
BurstRequest.prototype.forSending = function () {
  return {requestType: "BurstRequest",
          connId: this.connection.id}
}

/**
 * Get the callback from the arguments. Will only work on the client
 *
 * @returns {Function} the callback or undefined.
 */
BurstRequest.prototype.getCallback = function () {
  return this.callback
}

module.exports.BurstRequest = BurstRequest
