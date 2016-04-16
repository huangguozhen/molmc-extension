/* eslint no-unused-vars: 0 */
var CodecSocket = require("./codecsocket.js").CodecSocket,
  createBadMessage = require("./codecsocket.js").createBadMessage,
  createFinalMessage = require("./codecsocket.js").createFinalMessage
var STK_INSYC = 20,
  STK_OK = 16,
  createMessage = createSizedMessage

function createSizedMessage(dataBuffer, minPureData) {
  if (dataBuffer.length != minPureData) return createBadMessage(dataBuffer, 0, "Not the right amount of data")
  /* eslint new-cap: 0 */
  return new createFinalMessage(dataBuffer.slice(minPureData), dataBuffer.slice(0, minPureData))
}

function ButterflyCodecSocket(connectionId, api, errorCb) {
  CodecSocket.call(this, connectionId, api, errorCb)
}
ButterflyCodecSocket.prototype = Object.create(CodecSocket.prototype)
ButterflyCodecSocket.prototype.encode = function(data) {
  return data
}
ButterflyCodecSocket.prototype.decode = function(dataBuffer, minPureData) {
  return createMessage(dataBuffer, minPureData)
}
module.exports.createEndedMessage = createSizedMessage
module.exports.ButterflyCodecSocket = ButterflyCodecSocket
