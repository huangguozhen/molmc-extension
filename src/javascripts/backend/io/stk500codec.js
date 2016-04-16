var CodecSocket = require("./codecsocket.js").CodecSocket,
  createBadMessage = require("./codecsocket.js").createBadMessage,
  createFinalMessage = require("./codecsocket.js").createFinalMessage
var STK_INSYC = 20,
  STK_OK = 16,
  createMessage = createEndMessage

function createEndMessage(dataBuffer, minPureData) {
  var i
  if (dataBuffer.length < minPureData + 2) return createBadMessage(dataBuffer, 0, "Expecting more data")
  for (i = dataBuffer.length; i >= 0; i--) {
    if (dataBuffer[i] == STK_OK) break
  }
  if (i < 0) return createBadMessage(dataBuffer, 0, "No end found")
  return createStartMessage(dataBuffer, i, minPureData)
}

function createStartMessage(dataBuffer, endIndex, minPureData) {
  var start
  for (start = endIndex - minPureData - 1; start >= 0; start--) {
    if (dataBuffer[start] == STK_INSYC) break
  }
  if (start < 0) createBadMessage(dataBuffer, 0, "No start found")
  return createFinalMessage(dataBuffer.slice(endIndex + 1), dataBuffer.slice(start + 1, endIndex))
}

function Stk500CodecSocket(connectionId, api, errorCb) {
  CodecSocket.call(this, connectionId, api, errorCb)
}
Stk500CodecSocket.prototype = Object.create(CodecSocket.prototype)
Stk500CodecSocket.prototype.encode = function(data) {
  return data
}
Stk500CodecSocket.prototype.decode = function(dataBuffer, minPureData, config) {
  if (!config || !config.ignoreBadFinalByte) {
    return createMessage(dataBuffer, minPureData || 0)
  }
  return createStartMessage(dataBuffer, dataBuffer.length, 0)
}
module.exports.Stk500CodecSocket = Stk500CodecSocket
