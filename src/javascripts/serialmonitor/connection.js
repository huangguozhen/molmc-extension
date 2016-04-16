/*
 * 77
 */
const errno = require("./../backend/errno.js"),
  ReceiveErrorEvent = require("./receiveerrorevent.js").ReceiveErrorEvent,
  Event = require("./../event.js").Event

function Connection(port, baudrate, api) {
  var self = this
  this.api = api
  this.disconnected = false
  this.onConnected = new Event()
  this.onDisconnected = new Event()
  this.onReceiveError = null
  this.port = port
  this.baudrate = baudrate
  this.isTaken(this.port, function(taken) {
    if (taken) {
      self.onDisconnected.dispatch(errno.RESOURCE_BUSY_FROM_CHROME)
      return
    }
    self.connect(port, baudrate)
  })
}
Connection.prototype = {
  errorDispatcher: function(listener, error) {
    if (error.error !== "device_lost") {
      listener(errno.UNKNOWN_MONITOR_ERROR.copy({
        apiError: error
      }))
      return
    }
    listener(errno.SERIAL_MONITOR_DEVICE_LOST.copy())
  },
  isTaken: function(port, cb) {
    this.api.serial.getConnections(function(cnxs) {
      var taken = cnxs.some(function(c) {
        return c.name == port
      })
      cb(taken)
    })
  },
  connect: function(port, baudrate) {
    var self = this
    this.api.serial.connect(port, {
      name: port,
      bitrate: baudrate
    }, function(info) {
      if (!info) {
        self.disconnect(errno.SERIAL_MONITOR_CONNECT)
        return
      }
      self.onReceiveError = new ReceiveErrorEvent(info.connectionId, self.api)
      self.onReceiveError.setDispatcher(self.errorDispatcher.bind(self))
      self.onReceiveError.addListener(self.disconnect.bind(self))
      self.info = info
      self.onConnected.dispatch(info)
      self.onConnected.close()
    })
  },
  disconnect: function(error) {
    var self = this
    if (this.disconnected) return

    function disconnect(err) {
      self.disconnected = true
      self.onDisconnected.dispatch(err || errno.SUCCESS)
      if (self.onReceiveError) self.onReceiveError.close()
      self.onConnected.close()
      self.onDisconnected.close()
    }
    if (!this.info) {
      disconnect(error || errno.SERIAL_MONITOR_PREMATURE_DISCONNECT)
      return
    }
    self.api.serial.getConnections(function(cnx) {
      if (!cnx.some(function(c) {
        return c.connectionId == self.info.connectionId
      })) {
        disconnect(error || errno.SERIAL_MONITOR_DEVICE_LOST)
        return
      }
      self.api.serial.disconnect(self.info.connectionId, function(ok) {
        var err = null
        if (!ok) {
          err = errno.SERIAL_MONITOR_DISCONNECT
        }
        disconnect(err || error)
      })
    })
  }
}

module.exports.Connection = Connection
