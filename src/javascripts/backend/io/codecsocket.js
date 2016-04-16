/* eslint no-unused-vars: 0 */
var Buffer = require("./buffer.js").Buffer,
  SerialIo = require("./serial.js").SerialIo,
  errno = require("./../errno.js"),
  logging = require("./../logging.js"),
  scheduler = require("./../scheduler.js")
var readerId = 0

function ReadOperation(buffer, decodeCb, finishCb, config, errorCb) {
  var self = this
  this.closed = false
  this.buffer = buffer
  this.config = config || {}
  this.decodeCb = decodeCb
  this.finishCallback = finishCb
  this.id = readerId++
  this.log = logging.getLog("ReadOperation")
  if (errorCb) {
    this.errorCb = errorCb
  }
  this.updateListener = function(type) {
    if (type != "received") return
    self.gotBytes()
  }
  var ttl = this.config.ttl || 2e3
  this.log.log("read operation (id: ", this.id, "ttl:", ttl, ")")
  this.buffer.onUpdate.addListener(this.updateListener)
  this.timeoutHandle = scheduler.setTimeout(function() {
    self.log.log("Failed read operation (id: ", self.id, "ttl:", ttl, ")")
    self.close()
    self.errorCb(errno.READER_TIMEOUT)
  }, ttl)
}
ReadOperation.prototype = {
  errorCb: function(retval) {
    throw Error(retval.shortMessage())
  },
  close: function() {
    if (this.closed) {
      return
    }
    this.log.log("Closing read operation")
    this.closed = true
    scheduler.clearTimeout(this.timeoutHandle)
    this.buffer.onUpdate.removeListener(this.updateListener)
  },
  gotBytes: function() {
    if (this.closed) {
      this.errorCb(errno.MESSAGE_ON_CLOSED_READ_OPERTION)
      return
    }
    this.log.log("Buffer(decode config:", this.config, "):", this.buffer.dataBuffer())
    var response = this.decodeCb(this.buffer.dataBuffer(), this.config.minPureData, this.config)
    this.buffer.update({
      dataBuffer: response.dataBuffer
    })
    if (!response.message) return
    this.close()
    this.finishCallback(response.message)
  }
}
var codecSocketUid = 0

function CodecSocket(connectionId, api, errorCb) {
  var self = this
  this.connectionId = connectionId
  this.buffer = new Buffer(connectionId, api, errorCb)
  this.serial = this.buffer.serial
  this.log = logging.getLog("CodecSocket")
  this.refCount = 0
  this.id = codecSocketUid++
  if (errorCb) {
    this.errorCb = errorCb
  }
  this.receiveErrorListener = function(err) {
    self.errorCb(errno.SERIAL_RECEIVE_ERROR, {
      error: err
    })
  }
  this.state = {}
  this.state.readOperation = null
  this.closed = false
  this.serial.onReceiveError.addListener(this.receiveErrorListener)
}
CodecSocket.prototype = {
  errorCb: function(retval) {
    throw Error(retval.shortMessage())
  },
  encode: function(data) {
    return data
  },
  decode: function(dataBuffer) {
    return createFinalMessage([], dataBuffer.slice())
  },
  justWrite: function(data, cb, config) {
    var message = this.encode(data)
    this.log.log("Sending (", this.connectionId, "):", message)
    this.serial.send(this.connectionId, message, cb)
  },
  writeThenRead: function(data, cb, config) {
    var self = this,
      handle = function(ok) {
        if (ok) return
        self.cancelRead()
        self.errorCb(errno.API_ERROR)
      }
    if (this.state.readOperation && !this.state.readOperation.closed) {
      this.state.readOperation.close()
    }
    this.state.readOperation = new ReadOperation(this.buffer, this.decode.bind(this), cb, config, this.errorCb.bind(this))
    this.justWrite(data, handle)
  },
  cancelRead: function() {
    this.state.readOperation.close()
  },
  drain: function(cb) {
    if (this.closed) {
      this.errorCb(errno.DRAIN_CLOSED_CODEC)
      return
    }
    this.buffer.update({
      dataBuffer: []
    })
    cb()
  },
  close: function() {
    if (this.closed) {
      return
    }
    this.log.log("Closing socket")
    this.closed = true
    this.refCount = 0
    if (this.state.readOperation && !this.state.readOperation.closed) this.state.readOperation.close()
    this.buffer.close()
  },
  ref: function() {
    if (this.closed) return
    this.log.log("Referencing socket:", this.id, "(refcount", this.refCount, ")")
    this.refCount++
  },
  unref: function() {
    if (this.closed) return
    this.log.log("Unreferencing socket:", this.id, "(refcount", this.refCount, ")")
    if (--this.refCount <= 0) {
      this.log.log("Refcount 0 for socket:", this.id)
      this.close()
    }
  }
}

function createFinalMessage(dataBuffer, message) {
  return {
    dataBuffer: dataBuffer,
    message: message
  }
}

function createBadMessage(dataBuffer, offset, errorMessage) {
  return {
    dataBuffer: dataBuffer,
    message: null,
    errorMessage: errorMessage,
    offset: offset
  }
}
module.exports.createFinalMessage = createFinalMessage
module.exports.createBadMessage = createBadMessage
module.exports.CodecSocket = CodecSocket
