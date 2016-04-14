const errno = require("./../backend/errno.js"),
  getLog = require("./../backend/logging.js").getLog,
  scheduler = require("./../backend/scheduler.js"),
  Event = require("./../event.js").Event,
  util = require("./util.js"),
  buffer = require("./../backend/buffer.js")

class Writer {
  constructor (api) {
    this.strData = [];
    this.connectionId = null;
    this.api = api;
    this.onWriteFail = new Event()
    this.log = getLog("Writer")
  }

  init (connectionId) {
    this.connectionId = connectionId;
    if (this.strData.length > 0) {
      this.write(this.data)
    }
  }

  write (strData, cb) {
    if (!this.connectionId) {
      this.data = this.strData + strData;
      scheduler.setTimeout(cb);
      return
    }
    var self = this,
      data = util.strToUtf8Array(strData);
    this.api.serial.send(this.connectionId, buffer.binToBuf(data), function(sendInfo) {
      self.log.log("Sent data of length:", data.length);
      if (!sendInfo || sendInfo.error) {
        self.onWriteFail.dispatch(errno.SERIAL_MONITOR_WRITE);
        return
      }
      if (cb) cb(sendInfo)
    })
  }
}

module.exports.Writer = Writer
