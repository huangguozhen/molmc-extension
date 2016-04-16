var Data = require("./data.js").Data,
  errno = require("./errno.js")
var Base64 = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  decodeArrayBuffer: function(input) {
    var bytes = input.length / 4 * 3
    var ab = new ArrayBuffer(bytes)
    this.decode(input, ab)
    return ab
  },
  decode: function(input, arrayBuffer) {
    var lkey1 = this._keyStr.indexOf(input.charAt(input.length - 1))
    var lkey2 = this._keyStr.indexOf(input.charAt(input.length - 2))
    var bytes = input.length / 4 * 3
    if (lkey1 == 64) bytes--
    if (lkey2 == 64) bytes--
    var uarray
    var chr1, chr2, chr3
    var enc1, enc2, enc3, enc4
    var i = 0
    var j = 0
    if (arrayBuffer) uarray = new Uint8Array(arrayBuffer)
    else uarray = new Uint8Array(bytes)
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "")
    for (i = 0; i < bytes; i += 3) {
      enc1 = this._keyStr.indexOf(input.charAt(j++))
      enc2 = this._keyStr.indexOf(input.charAt(j++))
      enc3 = this._keyStr.indexOf(input.charAt(j++))
      enc4 = this._keyStr.indexOf(input.charAt(j++))
      chr1 = enc1 << 2 | enc2 >> 4
      chr2 = (enc2 & 15) << 4 | enc3 >> 2
      chr3 = (enc3 & 3) << 6 | enc4
      uarray[i] = chr1
      if (enc3 != 64) uarray[i + 1] = chr2
      if (enc4 != 64) uarray[i + 2] = chr3
    }
    return uarray
  }
}

function Parser(base64str, offset, maxSize) {
  this.base64str = base64str
  this.maxSize = maxSize
  this.offset = offset || 0
  this.lastError = errno.PREMATURE_RETURN.copy({
    process: "parser"
  })
}
Parser.prototype = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  data: function() {
    var ret = [].slice.call(Base64.decode(this.base64str))
    if (!ret) {
      this.lastError = errno.BASE64_ERROR
      return null
    }
    if (this.maxSize && ret.length > this.maxSize) {
      this.lastError = errno.PROGRAM_TOO_LARGE.copy({
        maxSize: this.maxSize,
        progLength: ret.length
      })
      return null
    }
    this.lastError = errno.SUCCESS
    return new Data(ret, this.offset)
  }
}
module.exports.Parser = Parser
