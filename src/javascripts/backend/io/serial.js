var util = require("./util.js"),
  errno = require("./../errno.js"),
  getLog = require("./../logging").getLog,
  Event = require("./../../event.js").Event

function SerialIo(api, errorCb) {
  var self = this
  this.log = getLog("SerialIo")
  this.api = api
  this.onReceive = new Event()
  this.onReceiveError = new Event()
  if (errorCb) this.errorCb = errorCb
  this.handlers = {
    onReceiveErrorCb: function() {
      self.onReceiveError.dispatch.apply(self.onReceiveError, arguments)
    },
    onReceiveCb: function(rcv) {
      var data = util.bufToBin(rcv.data)
      self.log.log("Received:", data)
      self.onReceive.dispatch(rcv.connectionId, data)
    }
  }
  this.api.onReceiveError.addListener(this.handlers.onReceiveErrorCb)
  this.api.onReceive.addListener(this.handlers.onReceiveCb)
}
SerialIo.prototype = {
  errorCb: function(retval) {
    throw Error(retval.shortMessage())
  },
  send: function(connectionId, data, cb) {
    if (this.closed) {
      this.errorCb(errno.SENDING_ON_CLOSED_SERIAL)
      return
    }
    var realData = util.binToBuf(data)
    this.api.send(connectionId, realData, function(resp) {
      if (!resp || resp.bytesSent != data.length) {
        cb(false)
        return
      }
      cb(true)
    })
  },
  close: function() {
    if (this.closed) {
      this.errorCb(errno.CLOSING_CLOSED_SERIAL)
      return
    }
    this.log.log("Closing serial")
    this.closed = true
    this.onReceive.close()
    this.onReceiveError.close()
    this.log.log("Removing onReveive and onReceiveError listeners")
    this.api.onReceiveError.removeListener(this.handlers.onReceiveErrorCb)
    this.api.onReceive.removeListener(this.handlers.onReceiveCb)
  }
}
module.exports.SerialIo = SerialIo
