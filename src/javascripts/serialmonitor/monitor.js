/*
 * browserify: 79
 */
const Connection = require("./connection.js").Connection,
  Writer = require("./writer.js").Writer,
  Reader = require("./reader.js").Reader,
  Event = require("./../event.js").Event,
  errno = require("./../backend/errno.js")

function Monitor(port, baudrate, api) {
  const self = this
  this.onClose = new Event()
  this.onRead = new Event()
  this.onConnected = new Event()
  this.closed = false
  this.api = api
  this.connection = new Connection(port, baudrate, api)
  this.connection.onDisconnected.addListener(this.disconnect.bind(this))
  this.reader = new Reader(self.api)
  this.writer = new Writer(self.api)
  this.connection.onConnected.addListener(function(info) {
    self.reader.init(info.connectionId)
    self.reader.addListener(self.onRead.dispatch.bind(self.onRead))
    self.writer.init(info.connectionId)
    self.writer.onWriteFail.addListener(self.disconnect.bind(self))
    self.onConnected.dispatch(info)
    self.onConnected.close()
  })
}
Monitor.prototype = {
  write: function(strData, cb) {
    if (this.writer) {
      this.writer.write(strData, cb)
      return
    }
    this.onError.display(errno.SERIAL_MONITOR_WRITE_BEFORE_CONNECT)
    cb()
  },
  disconnect: function(retVal) {
    if (this.closed) return
    this.closed = true
    this.connection.disconnect()
    if (this.reader) this.reader.close()
    this.onConnected.close()
    this.onClose.dispatch(retVal || errno.SUCCESS)
    this.onClose.close()
  }
}
module.exports.Monitor = Monitor
