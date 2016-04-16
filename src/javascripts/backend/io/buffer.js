var SerialIo = require("./serial.js").SerialIo,
  errno = require("./../errno.js"),
  getLog = require("./../logging.js").getLog,
  Event = require("./../../event.js").Event

function Buffer(connectionId, api, errorCb) {
  var self = this
  this.serial = new SerialIo(api, errorCb)
  this.log = getLog("Buffer")
  this.state = {}
  this.state.connectionId = connectionId
  this.state.dataBuffer = []
  if (errorCb) {
    this.errorCb = errorCb
  }
  this.onUpdate = new Event()
  this.serial.onReceive.addListener(function(connectionId, data) {
    if (self.state.connectionId != connectionId) return
    self.receive(data)
  })
}
Buffer.prototype = {
  errorCb: function(retval) {
    throw Error(retval.shortMessage())
  },
  update: function(conf) {
    if (this.closed) {
      this.errorCb(errno.UPDATE_CLOSED_BUFFER)
      return
    }
    this.state.dataBuffer = conf.dataBuffer || this.state.dataBuffer
  },
  dataBuffer: function() {
    if (this.closed) {
      this.errorCb(errno.READ_CLOSED_BUFFER)
      return null
    }
    return this.state.dataBuffer
  },
  receive: function(data) {
    if (this.closed) {
      this.errorCb(errno.READ_CLOSED_BUFFER)
      return
    }
    this.state.dataBuffer = this.state.dataBuffer.concat(data)
    this.onUpdate.dispatch("received")
  },
  close: function() {
    if (this.closed) {
      this.errorCb(errno.CLOSE_CLOSED_BUFFER)
      return
    }
    this.log.log("Closing buffer")
    this.closed = true
    this.serial.close()
    this.onUpdate.close()
  }
}
module.exports.Buffer = Buffer
