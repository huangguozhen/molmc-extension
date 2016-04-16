/* eslint no-unused-vars: 0 */
var SerialTransaction = require("./serialtransaction").SerialTransaction,
  getLog = require("./../logging").getLog,
  arraify = require("./../util").arraify,
  ConnectionManager = require("./mixins/magicreset.js").ConnectionManager,
  ButterflyCodecSocket = require("./../io/butterflycodec.js").ButterflyCodecSocket,
  ioutil = require("./../io/util.js"),
  status = require("./../status.js"),
  scheduler = require("./../scheduler"),
  errno = require("./../errno")

function AVR109Transaction() {
  SerialTransaction.apply(this, arraify(arguments))
  this.AVR = {
    SOFTWARE_VERSION: 86,
    ENTER_PROGRAM_MODE: 80,
    LEAVE_PROGRAM_MODE: 76,
    SET_ADDRESS: 65,
    WRITE: 66,
    TYPE_FLASH: 70,
    EXIT_BOOTLOADER: 69,
    CR: 13,
    READ_PAGE: 103,
    SIG_CHECK: 115
  }
  this.timeouts = {
    magicBaudConnected: 2e3,
    disconnectPollCount: 30,
    disconnectPoll: 100,
    pollingForDev: 500,
    finishWait: 2e3,
    finishTimeout: 2e3,
    finishPollForDev: 100,
    magicRetries: 3,
    magicRetryTimeout: 1e3
  }
  this.initialDev = null
  this.log = getLog("Butterfly")
  this.connectionManager = new ConnectionManager(this)
  var oldErrCb = this.errCb,
    self = this
  this.codecsocketClass = ButterflyCodecSocket
}
AVR109Transaction.prototype = Object.create(SerialTransaction.prototype)
AVR109Transaction.prototype.checkSignature = function(cb) {
  var self = this
  this.writeThenRead([this.AVR.SIG_CHECK], function(data) {
    if (self.config.avrdude.signature.toString() == data.toString()) {
      self.errCb(errno.SIGNATURE_FAIL, {
        expected: self.config.avrdude.signature,
        found: data
      })
      return
    }
    cb()
  }, {
    minPureData: 3
  })
}
AVR109Transaction.prototype.flash = function(devName, hexData) {
  this.refreshTimeout()
  this.sketchData = hexData
  this.deviceName = devName
  this.transition("connecting", devName)
}
AVR109Transaction.prototype.connecting = function(devName) {
  var smartOpen = {
    state: "smartOpenDevice",
    retries: 3,
    retryInterval: 1e3
  }
  this.refreshTimeout()
  this.log.log("Flashing. Config is:", this.config, "data:", this.sketchData)
  this.setStatus(status.CONNECTING, {
    device: devName
  })
  this.transition(smartOpen, devName, this.config.speed, null, this.transitionCb("connectDone"))
}
AVR109Transaction.prototype.connectDone = function(connectionId) {
  this.setConnectionId(connectionId)
  this.log.log("Connected to bootloader. Connection ID: ", this.getConnectionId())
  this.drain(this.transitionCb("maybeCheckSignature", this.transitionCb("drainBytes")))
}
AVR109Transaction.prototype.programmingDone = function() {
  var self = this
  this.writeThenRead([this.AVR.LEAVE_PROGRAM_MODE], function(payload) {
    self.writeThenRead([self.AVR.EXIT_BOOTLOADER], function(payload) {
      self.transition("disconnect", function() {
        self.cleanup()
      })
    }, {
      minPureData: 1
    })
  }, {
    minPureData: 1
  })
}
AVR109Transaction.prototype.drainBytes = function(readArg) {
  var self = this
  this.drain(function() {
    self.writeThenRead([self.AVR.SOFTWARE_VERSION], self.transitionCb("prepareToProgramFlash"), {
      minPureData: 2
    })
  })
}
AVR109Transaction.prototype.prepareToProgramFlash = function() {
  var self = this,
    offset = self.config.offset || 0
  this.writeThenRead(this.addressMsg(offset), function(response) {
    self.transition("programFlash", self.config.avrdude.memory.flash.page_size)
  }, {
    minPureData: 1
  })
}
AVR109Transaction.prototype.addressMsg = function(offset) {
  var addressBytes = ioutil.storeAsTwoBytes(offset)
  return [this.AVR.SET_ADDRESS, addressBytes[1], addressBytes[0]]
}
AVR109Transaction.prototype.writeMsg = function(payload) {
  var sizeBytes = ioutil.storeAsTwoBytes(payload.length)
  return [this.AVR.WRITE, sizeBytes[0], sizeBytes[1], this.AVR.TYPE_FLASH].concat(payload)
}
AVR109Transaction.prototype.writePage = function(offset, payload, done) {
  this.writeThenRead(this.writeMsg(payload), done, {
    minPureData: 1
  })
}
AVR109Transaction.prototype.programFlash = function(pageSize) {
  this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("programmingDone"))
}
module.exports.AVR109Transaction = AVR109Transaction
