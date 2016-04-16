/* eslint no-unused-vars: 0 */
var USBTransaction = require("./usbtransaction").USBTransaction,
  util = require("./../util"),
  arraify = util.arraify,
  ops = require("./memops"),
  buffer = require("./../buffer"),
  errno = require("./../errno"),
  scheduler = require("./../scheduler.js"),
  getLog = require("./../logging").getLog

function USBAspTransaction(config, finishCallback, errorCallback) {
  USBTransaction.apply(this, arraify(arguments))
  this.setupAsControl()
  this.log = getLog("USBASP")
  this.UA = {
    CONNECT: 1,
    DISCONNECT: 2,
    TRANSMIT: 3,
    READFLASH: 4,
    ENABLEPROG: 5,
    WRITEFLASH: 6,
    READEEPROM: 7,
    WRITEEEPROM: 8,
    SETLONGADDRESS: 9,
    SETISPSCK: 10,
    GETCAPABILITIES: 127,
    READBLOCKSIZE: 200,
    WRITEBLOCKSIZE: 200,
    BLOCKFLAG_FIRST: 1,
    BLOCKFLAG_LAST: 2,
    CAP_TPI: 1
  }
  this.SCK_OPTIONS = {
    15e5: 12,
    75e4: 11,
    375e3: 10,
    187500: 9,
    93750: 8,
    32e3: 7,
    16e3: 6,
    8e3: 5,
    4e3: 4,
    2e3: 3,
    1e3: 2,
    500: 1
  }
  this.device = {
    productId: 1500,
    vendorId: 5824
  }
  this.cmdFunction = this.UA.TRANSMIT
  this.entryState = {
    state: "checkCapabilities",
    retries: 3
  }
}
USBAspTransaction.prototype = Object.create(USBTransaction.prototype)
USBAspTransaction.prototype.checkCapabilities = function() {
  var self = this
  var info = this.transferIn(this.UA.GETCAPABILITIES, 0, 0, 4)
  this.xferMaybe(info, function(resp) {
    var capabilities = resp.data.reduce(function(a, b) {
      return a << 8 | b
    }, 0)
    if (capabilities & self.UA.CAP_TPI) {
      self.errCb(errno.UNSUPPORTED_TPI, {
        capabilities: capabilities
      })
      return
    }
    scheduler.setTimeout(self.transitionCb("setSck"), 1e3)
  })
}
USBAspTransaction.prototype.setSck = function() {
  var sck_id = 0
  if (this.config.bitclock) {
    var request_hz = this.config.bitclock,
      sck_hz = Object.getOwnPropertyNames(this.SCK_OPTIONS).map(Number).sort().filter(function(sck) {
        return request_hz < sck
      })[0]
    sck_id = this.SCK_OPTIONS[sck_hz] || 0
  }
  var info = this.transferIn(this.UA.SETISPSCK, sck_id, 0, 4)
  this.sck_hz = sck_hz
  this.xfer(info, this.transitionCb("programEnable"))
}
USBAspTransaction.prototype.programEnable = function() {
  var cb, self = this,
    enableProgInfo = this.transferIn(this.UA.ENABLEPROG, 0, 0, 4),
    connectInfo = this.transferIn(this.UA.CONNECT, 0, 0, 4)
  if (!this.chipErased) {
    this.chipErased = true
    cb = this.transitionCb("maybeCheckSignature", this.transitionCb("maybeChipErase", this.transitionCb("checkCapabilities")))
  } else {
    cb = this.transitionCb("writePages", this.config.avrdude.memory.flash.page_size)
  }
  this.xferMaybe(connectInfo, function() {
    self.xferMaybe(enableProgInfo, cb)
  })
}
USBAspTransaction.prototype.infoAddress = function(offset) {
  var cmd = [offset & 255, offset >> 8 & 255, offset >> 16 & 255, offset >> 24 & 255]
  if (offset >>> 31 >> 1 != 0) {
    this.errCb(errno.ADDRESS_TOO_LONG, {
      address: offset
    })
    return null
  }
  this.log.log("[CMD]setaddress: ", this.UA.SETLONGADDRESS.toString(16), (cmd[1] << 8 | cmd[0]).toString(16), (cmd[3] << 8 | cmd[2]).toString(16))
  return this.transferIn(this.UA.SETLONGADDRESS, cmd[1] << 8 | cmd[0], cmd[3] << 8 | cmd[2], 4)
}
USBAspTransaction.prototype.writePage = function(offset, payload, done) {
  var pageStart = offset,
    pageEnd = offset + payload.length
  this.sketchData.tile(this.transitionCb("writeBlock", payload.length, pageStart, pageEnd), this.blockSize(), done, pageStart, pageEnd)
}
USBAspTransaction.prototype.writeBlock = function(pageSize, pageStart, pageEnd, offset, payload, done) {
  var isLast = pageEnd <= offset + payload.length,
    isFirst = offset == pageStart,
    address = [offset >> 0 & 255, offset >> 8 & 255],
    flags = (isFirst ? this.UA.BLOCKFLAG_FIRST : 0) | (isLast ? this.UA.BLOCKFLAG_LAST : 0),
    flagHex = flags & 15 | (pageSize & 3840) >> 4,
    infoWrite = this.transferOut(this.UA.WRITEFLASH, address[1] << 8 | address[0], pageSize & 255 | flagHex << 8, payload),
    self = this
  this.xferMaybe(this.infoAddress(offset), function(resp) {
    self.log.log("[CMD]writeflash: ", self.UA.WRITEFLASH.toString(16), (address[1] << 8 | address[0]).toString(16), (pageSize & 255 | flagHex << 8).toString(16))
    self.xferMaybe(infoWrite, done)
  })
}
USBAspTransaction.prototype.checkBlock = function(offset, payload, done) {
  var self = this,
    address = [offset >> 0 & 255, offset >> 8 & 255],
    infoRead = self.transferIn(this.UA.READFLASH, address[1] << 8 | address[0], 0, payload.length)
  this.xferMaybe(this.infoAddress(offset), function(resp) {
    self.log.log("[CMD]readflash: ", self.UA.READFLASH.toString(16), (address[1] << 8 | address[0]).toString(16), 0)
    self.xferMaybe(infoRead, function(resp) {
      if (!util.arrEqual(resp.data, payload)) {
        self.errCb(errno.PAGE_CHECK, {
          devPage: resp.data,
          hostPage: payload,
          pageOffset: offset
        })
        return
      }
      done()
    })
  })
}
USBAspTransaction.prototype.blockSize = function() {
  return this.sck_hz && this.sck_hz > 0 && this.sck_hz < 1e4 ? this.UA.WRITEBLOCKSIZE / 10 : this.UA.WRITEBLOCKSIZE
}
USBAspTransaction.prototype.checkPage = function(offset, payload, done) {
  this.sketchData.tile(this.transitionCb("checkBlock"), this.blockSize(), done, offset, offset + payload.length)
}
USBAspTransaction.prototype.writePages = function(pageSize) {
  this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("checkPages", pageSize), this.sketchData.min())
}
USBAspTransaction.prototype.checkPages = function(pageSize) {
  var self = this

  function writeAndRecheck(retryCb, offset, payload, done) {
    self.writePage(offset, payload, retryCb)
  }
  var checkPage = {
    state: "checkPage",
    retries: 3,
    fallbackCb: writeAndRecheck
  }
  this.sketchData.tile(this.transitionCb(checkPage), pageSize, this.transitionCb("close"), this.sketchData.min())
}
USBAspTransaction.prototype.close = function() {
  var self = this
  this.setupSpecialBits(self.config.cleanControlBits, function() {
    self.control(self.UA.DISCONNECT, 0, 0, function() {
      self.cleanup(self.finishCallback)
    })
  })
}
module.exports.USBAspTransaction = USBAspTransaction
