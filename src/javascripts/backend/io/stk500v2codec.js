var CodecSocket = require("./codecsocket.js").CodecSocket,
  createBadMessage = require("./codecsocket.js").createBadMessage,
  util = require("./util.js"),
  getLog = require("./../logging.js").getLog,
  createFinalMessage = require("./codecsocket.js").createFinalMessage
var STKv2_START = 27,
  STKv2_TOKEN = 14,
  createMessage = createLastStarterMessage,
  log

/* eslint no-unused-vars: 0 */
function createLastStarterMessage(dataBuffer, state) {
  var minMessage = 6 + (state.minPureData || 0)
  var tokenIndex = typeof state.lastValidTokenIndex !== "undefined" ? state.lastValidTokenIndex : dataBuffer.length - 1
  for (; tokenIndex >= 0; tokenIndex--) {
    if (dataBuffer[tokenIndex] == STKv2_TOKEN) break
  }
  state.lastValidTokenIndex = tokenIndex - 1
  var startIndex = tokenIndex - 4
  if (startIndex < 0) {
    return createBadMessage(dataBuffer, Math.max(startIndex, 0), "No message header found")
  }
  if (dataBuffer[startIndex] != STKv2_START) {
    log.log("Found no start at:", startIndex)
    return createLastStarterMessage(dataBuffer, state)
  }
  return createSeqMessage(dataBuffer, startIndex, state)
}

function createSeqMessage(dataBuffer, offset, state) {
  var newOffset = offset + 1,
    seq = dataBuffer[newOffset]
  if (state.seq != seq) {
    log.warn("Bad sequence:", seq, "!=", state.seq)
    return createLastStarterMessage(dataBuffer, state)
  }
  return createLengthMessage(dataBuffer, newOffset, state)
}

function createLengthMessage(dataBuffer, offset, state) {
  var length1 = dataBuffer[offset + 1],
    length2 = dataBuffer[offset + 2],
    msgLength = length1 << 8 | length2,
    newOffset = offset + 2
  if (state.minPureData && msgLength < state.minPureData) {
    log.warn("Less data than expected:", msgLength, "!=", state.minPureData)
    return createLastStarterMessage(dataBuffer, state)
  }
  state.msgLength = msgLength
  return createTokenMessage(dataBuffer, newOffset, state)
}

function createTokenMessage(dataBuffer, offset, state) {
  var newOffset = offset + 1
  if (dataBuffer[newOffset] != STKv2_TOKEN) {
    log.warn("Expected a token, god garbage")
    return createLastStarterMessage(dataBuffer, state)
  }
  return createContentMessage(dataBuffer, newOffset, state)
}

function createContentMessage(dataBuffer, offset, state) {
  var messageStart = offset + 1,
    messageEnd = messageStart + state.msgLength,
    newOffset = messageEnd - 1,
    message = dataBuffer.slice(messageStart, messageEnd)
  if (message.length != state.msgLength) {
    return createLastStarterMessage(dataBuffer, state)
  }
  state.message = message
  return createCrcMessage(dataBuffer, newOffset, state)
}

function createCrcMessage(dataBuffer, offset, state) {
  var end = offset + 2,
    crc = dataBuffer.slice(state.lastValidTokenIndex - 3, end).reduce(function(a, b) {
      return a ^ b
    }, 0)
  if (crc != 0) {
    log.warn("Bad crc...")
    return createLastStarterMessage(dataBuffer, state)
  }
  return createFinalMessage(dataBuffer.slice(end), state.message)
}

function Stk500v2CodecSocket(connectionId, api, errorCb) {
  CodecSocket.call(this, connectionId, api, errorCb)
  log = getLog("STK500v2codec")
  this.state = this.state || {}
  this.state.seq = 0
}
Stk500v2CodecSocket.prototype = Object.create(CodecSocket.prototype)
Stk500v2CodecSocket.prototype.encode = function(data) {
  var size = util.storeAsTwoBytes(data.length),
    msg = [STKv2_START, this.state.seq, size[0], size[1], STKv2_TOKEN].concat(data),
    crc = msg.reduce(function(a, b) {
      return a ^ b
    }, 0)
  msg.push(crc)
  return msg
}
Stk500v2CodecSocket.prototype.decode = function(dataBuffer, minPureData) {
  var state = {
      seq: this.state.seq,
      lastValidTokenIndex: dataBuffer.length - 1,
      minPureData: minPureData
    },
    message = createMessage(dataBuffer, state)
  if (message.message) this.state.seq = this.state.seq + 1 & 255
  return message
}
module.exports.createStarterMessage = createLastStarterMessage
module.exports.createSeqMessage = createSeqMessage
module.exports.createLengthMessage = createLengthMessage
module.exports.createTokenMessage = createTokenMessage
module.exports.createContentMessage = createContentMessage
module.exports.createCrcMessage = createCrcMessage
module.exports.Stk500v2CodecSocket = Stk500v2CodecSocket
