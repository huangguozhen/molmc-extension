/* eslint no-unused-vars: 0 */
var Data = require("./data.js").Data,
  errno = require("./errno.js")

function Parser(hex, maxSize) {
  this.resetState()
  this.hex = hex
  this.maxSize = maxSize
}
Parser.prototype = {
  resetState: function() {
    this.lastError = null
    this.offsetLin = 0
    this.offsetSeg = 0
    this.endOfData = false
  },
  data: function() {
    var self = this
    this.resetState()
    var ret = this.hex.split("\n").reduce(function(data, line) {
      var d = data && self.parseLine(line)
      return d && data.layer(d.data, d.offset, true)
    }, new Data())
    if (!this.endOfData && this.hex.length > 0) {
      this.lastError = errno.HEXFILE_INCOMPLETE
      return null
    }
    return ret
  },
  hexToBytes: function(strData) {
    var arr = new Array(strData.length / 2)
    for (var i = 0; i < strData.length; i += 2) {
      arr[i / 2] = Number.parseInt(strData[i] + strData[i + 1], 16)
    }
    return arr
  },
  parseLine: function(line) {
    var EMPTY = {
      offset: this.offsetLin,
      data: []
    }
    line = line.trim()
    if (line.length == 0) {
      return EMPTY
    }
    if (this.endOfData) {
      this.lastError = errno.HEXFILE_ERROR
      return null
    }
    var index = 0,
      DATA = 0,
      EOF = 1,
      EXTENDED_SEG_ADDR = 2,
      START_SEG_ADDR = 3,
      EXTENDED_LIN_ADDR = 4,
      START_LIN_ADDR = 5

    function rng(length) {
      var start = index,
        end = index + length
      index = end
      return line.substring(start, end)
    }
    var start = rng(1),
      length = Number.parseInt(rng(2), 16),
      addr = Number.parseInt(rng(4), 16),
      type = Number.parseInt(rng(2), 16),
      strData = rng(length * 2),
      actualCheck = this.hexToBytes(line.substring(1, index)).reduce(function(a, b) { return a + b }, 0) & 255,
      checksum = Number.parseInt(rng(2), 16),
      byteData = this.hexToBytes(strData)
    if (start != ":" || checksum != (-actualCheck & 255)) {
      console.log(start, checksum)
      this.lastError = errno.HEXFILE_ERROR
      return null
    }
    switch (type) {
      case DATA:
        return {
          offset: addr + this.offsetSeg + this.offsetLin,
          data: byteData
        }
      case EXTENDED_SEG_ADDR:
        this.offsetSeg = Number.parseInt(strData, 16) * 16
        return {
          offset: this.offsetLin,
          data: []
        }
      case EXTENDED_LIN_ADDR:
        this.offsetLin = Number.parseInt(strData, 16) << 16 >>> 0
        return EMPTY
      case EOF:
        this.endOfData = true
        return EMPTY
      default:
        return {
          offset: this.offsetLin,
          data: []
        }
    }
  }
}
module.exports.Parser = Parser
