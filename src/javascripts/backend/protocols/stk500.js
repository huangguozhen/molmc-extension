/* eslint no-unused-vars: 0 */
var SerialTransaction = require("./serialtransaction").SerialTransaction,
  getLog = require("./../logging").getLog,
  Stk500CodecSocket = require("./../io/stk500codec.js").Stk500CodecSocket,
  ioutil = require("./../io/util.js"),
  arraify = require("./../util").arraify,
  scheduler = require("./../scheduler.js"),
  errno = require("./../errno"),
  status = require("./../status.js")

function STK500Transaction() {
  SerialTransaction.apply(this, arguments)
  this.log = getLog("STK500")
  if (typeof this.config.preconfigureDevice === "undefined") this.config.preconfigureDevice = true
  this.STK = {
    OK: 16,
    INSYNC: 20,
    CRC_EOP: 32,
    GET_SYNC: 48,
    GET_PARAMETER: 65,
    ENTER_PROGMODE: 80,
    LEAVE_PROGMODE: 81,
    LOAD_ADDRESS: 85,
    UNIVERSAL: 86,
    PROG_PAGE: 100,
    READ_PAGE: 116,
    READ_SIGN: 117,
    HW_VER: 128,
    SW_VER_MINOR: 130,
    SW_VER_MAJOR: 129,
    SET_DEVICE: 66,
    SET_DEVICE_EXT: 69
  }
  this.maxMessageRetries = 2
  this.codecsocketClass = Stk500CodecSocket
}
STK500Transaction.prototype = Object.create(SerialTransaction.prototype)
STK500Transaction.prototype.initializationMsg = function(maj, min) {
  this.log.log("Dev major:", maj, "minor:", min)
  var defmem = {
      readback: [255, 255],
      pageSize: 0,
      size: 0
    },
    flashmem = this.config.avrdude.memory.flash || defmem,
    eepromem = this.config.avrdude.memory.eeprom || defmem,
    extparams = {
      pagel: this.config.avrdude.pagel || 215,
      bs2: this.config.avrdude.bs2 || 160,
      len: maj > 1 || maj == 1 && min > 10 ? 4 : 3
    },
    initMessage = [this.STK.SET_DEVICE, this.config.avrdude.stk500_devcode || 0, 0, this.config.avrdude.serialProgramMode && this.config.avrdude.parallelProgramMode ? 0 : 1, this.config.avrdude.pseudoparallelProgramMode && this.config.avrdude.parallelProgramMode ? 0 : 1, 1, 1, this.config.avrdude.memory.lock ? this.config.avrdude.memory.lock.size : 0, [this.config.avrdude.memory.fuse, this.config.avrdude.memory.hfuse, this.config.avrdude.memory.lfuse, this.config.avrdude.memory.efuse].reduce(function(res, b) {
      return res + (b ? b.size : 0)
    }, 0), flashmem.readback[0], flashmem.readback[1], eepromem.readback[0], eepromem.readback[1], flashmem.page_size >> 8 & 255, flashmem.page_size & 255, eepromem.size >> 8 & 255, eepromem.size & 255, flashmem.size >> 24 & 255, flashmem.size >> 16 & 255, flashmem.size >> 8 & 255, flashmem.size & 255, this.STK.CRC_EOP],
    extparamArray = [this.STK.SET_DEVICE_EXT, extparams.len + 1, this.config.avrdude.memory.eeprom ? this.config.avrdude.memory.eeprom.page_size : 0, extparams.pagel, extparams.bs2, this.config.avrdude.resetDisposition == "dedicated" ? 0 : 1].slice(0, extparams.len + 2).concat(this.STK.CRC_EOP)
  return [initMessage, extparamArray]
}
STK500Transaction.prototype.cmd = function(cmd, cb) {
  this.log.log("Running command:", cmd)
  this.writeThenRead([this.STK.UNIVERSAL].concat(cmd).concat([this.STK.CRC_EOP]), cb)
}
STK500Transaction.prototype.flash = function(deviceName, sketchData) {
  var smartOpen = {
    state: "smartOpenDevice",
    retries: 3,
    retryInterval: 1e3
  }
  this.refreshTimeout()
  this.sketchData = sketchData
  this.deviceName = deviceName
  this.log.log("Flashing. Config is:", this.config, "data:", this.sketchData)
  this.setStatus(status.CONNECTING, {
    device: deviceName
  })
  this.transition(smartOpen, deviceName, this.config.speed || 115200, {
    request: [this.STK.GET_SYNC, this.STK.CRC_EOP],
    response: []
  }, this.transitionCb({
    state: "inSyncWithBoard",
    retries: 10,
    waitBefore: 200,
    retryInterval: 0
  }))
}
STK500Transaction.prototype.signOn = function() {
  this.writeThenRead([this.STK.GET_SYNC, this.STK.CRC_EOP], this.transitionCb("inSyncWithBoard"), {
    ttl: 300
  })
}
STK500Transaction.prototype.maybeCheckSignature = function(cb) {
  var self = this
  if (this.config.skipSignatureCheck) {
    cb()
    return
  }
  this.setStatus(status.CHECK_SIGNATURE)
  this.writeThenRead([this.STK.READ_SIGN, this.STK.CRC_EOP], function(data) {
    if (data.toString() != self.config.avrdude.signature.toString()) {
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
STK500Transaction.prototype.inSyncWithBoard = function(connectionId) {
  var self = this
  this.setStatus(status.HARDWARE_VERSION)
  scheduler.setImmediate(function() {
    self.writeThenRead([self.STK.GET_PARAMETER, self.STK.HW_VER, self.STK.CRC_EOP], self.transitionCb("maybeReadSoftwareVersion"), {
      minPureData: 1
    })
  })
}
STK500Transaction.prototype.maybeReadSoftwareVersion = function(data) {
  var self = this
  this.setStatus(status.SOFTWARE_VERSION)
  if (!this.config.readSwVersion) {
    self.transition("enterProgmode")
    return
  }
  this.writeThenRead([this.STK.GET_PARAMETER, this.STK.SW_VER_MAJOR, this.STK.CRC_EOP], function(major) {
    self.writeThenRead([self.STK.GET_PARAMETER, self.STK.SW_VER_MINOR, self.STK.CRC_EOP], function(minor) {
      var initMsgs = self.initializationMsg(major[0], minor[0])
      self.writeThenRead(initMsgs[0], function(data) {
        self.writeThenRead(initMsgs[1], self.transitionCb("enterProgmode"))
      })
    }, {
      minPureData: 1
    })
  }, {
    minPureData: 1
  })
}
STK500Transaction.prototype.enterProgmode = function(data) {
  this.setStatus(status.ENTER_PROGMODE)
  var self = this
  self.writeThenRead([self.STK.ENTER_PROGMODE, self.STK.CRC_EOP], self.transitionCb("maybeCheckSignature", self.transitionCb("maybeChipErase", self.transitionCb("programFlash", this.config.avrdude.memory.flash.page_size, null))))
}
STK500Transaction.prototype.programFlash = function(pageSize) {
  this.setStatus(status.START_WRITE_DATA)
  this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("doneWriting", pageSize), this.sketchData.min())
}
STK500Transaction.prototype.doneWriting = function(pageSize) {
  this.setStatus(status.SYNC)
  this.writeThenRead([this.STK.GET_SYNC, this.STK.CRC_EOP], this.transitionCb("confirmPages", pageSize))
}
STK500Transaction.prototype.confirmPages = function(pageSize) {
  this.setStatus(status.START_CHECK_DATA)
  this.sketchData.tile(this.transitionCb("checkPage"), pageSize, this.transitionCb("doneProgramming"), this.sketchData.min())
}
STK500Transaction.prototype.doneProgramming = function() {
  var self = this
  this.setStatus(status.LEAVE_PROGMODE)
  this.setupSpecialBits(this.config.cleanControlBits, function() {
    self.writeThenRead([self.STK.LEAVE_PROGMODE, self.STK.CRC_EOP], self.transitionCb("leftProgmode"), {
      ignoreBadFinalByte: true
    })
  })
}
STK500Transaction.prototype.leftProgmode = function(data) {
  var self = this
  this.setStatus(status.CLEANING_UP)
  this.cleanup(function() {
    scheduler.setTimeout(self.finishCallback, 1e3)
  })
}
STK500Transaction.prototype.addressMsg = function(addr) {
  var addrBytes = ioutil.storeAsTwoBytes(addr / 2)
  return [this.STK.LOAD_ADDRESS, addrBytes[1], addrBytes[0], this.STK.CRC_EOP]
}
STK500Transaction.prototype.writeMsg = function(payload) {
  var flashMemoryType = 70,
    sizeBytes = ioutil.storeAsTwoBytes(payload.length)
  return [this.STK.PROG_PAGE, sizeBytes[0], sizeBytes[1], flashMemoryType].concat(payload).concat([this.STK.CRC_EOP])
}
STK500Transaction.prototype.readMsg = function(size) {
  var flashMemoryType = 70,
    sizeBytes = ioutil.storeAsTwoBytes(size)
  return [this.STK.READ_PAGE, sizeBytes[0], sizeBytes[1], flashMemoryType, this.STK.CRC_EOP]
}
STK500Transaction.prototype.writePage = function(offset, payload, done) {
  this.setStatus(status.WRITE_PAGE, {
    address: offset
  })
  var loadAddressMessage = this.addressMsg(offset),
    programMessage = this.writeMsg(payload),
    writeDelay = this.config.avrdude.memory.flash.max_write_delay,
    self = this
  this.writeThenRead(loadAddressMessage, function() {
    self.writeThenRead(programMessage, function() {
      scheduler.setTimeout(done, Math.ceil(writeDelay / 1e3))
    })
  })
}
STK500Transaction.prototype.checkPage = function(offset, payload, done) {
  var loadAddressMessage = this.addressMsg(offset),
    readMessage = this.readMsg(payload.length),
    self = this
  this.log.log("Checking page at address:", offset, "(size:", payload.length, ")")
  this.setStatus(status.CHECK_PAGE, {
    address: offset
  })
  this.writeThenRead(loadAddressMessage, function() {
    self.writeThenRead(readMessage, function(devData) {
      if (devData.some(function(b, i) {
        return b != payload[i]
      })) {
        self.errCb(errno.PAGE_CHECK, {
          devPage: devData,
          hostPage: payload,
          pageOffset: offset
        })
        return
      }
      done()
    }, {
      minPureData: payload.length
    })
  })
}
module.exports.STK500Transaction = STK500Transaction
