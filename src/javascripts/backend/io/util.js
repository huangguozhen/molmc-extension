function bufToBin(buf) {
  if (!(buf instanceof ArrayBuffer)) return buf
  var bufferView = new Uint8Array(buf)
  var hexes = []
  for (var i = 0; i < bufferView.length; ++i) {
    hexes.push(bufferView[i])
  }
  return hexes
}

function binToBuf(hex) {
  if (hex instanceof ArrayBuffer) return hex
  var buffer = new ArrayBuffer(hex.length)
  var bufferView = new Uint8Array(buffer)
  for (var i = 0; i < hex.length; i++) {
    bufferView[i] = hex[i]
  }
  return buffer
}

function storeAsTwoBytes(n) {
  return [n >> 8 & 255, n & 255]
}

function storeAsFourBytes(n) {
  return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255]
}

/* eslint no-unused-vars: 0 */
function hexRep(intArray) {
  if (intArray === undefined) return "<undefined>"
  var buf = "["
  var sep = ""
  for (var i = 0; i < intArray.length; ++i) {
    var hex = intArray[i].toString(16)
    hex = hex.length < 2 ? "0" + hex : hex
    buf += " " + hex
  }
  buf += "]"
  return buf
}
module.exports.bufToBin = bufToBin
module.exports.binToBuf = binToBuf
module.exports.storeAsTwoBytes = storeAsTwoBytes
module.exports.storeAsFourBytes = storeAsFourBytes
module.exports.hexRep = hexRep
