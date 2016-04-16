var util = require("./../util")

function opToBin(op, param) {
  var ret = []
  param = param || {}
  for (var i = 0; i < Math.ceil(op.length / 8); i++) ret.push(0)
  op.forEach(function(bitStruct, index) {
    var bit = bitStruct.instBit % 8,
      byte = Math.floor(bitStruct.instBit / 8)
      if (bitStruct.bitType == "VALUE") {
        ret[byte] |= bitStruct.value << bit
      } else {
        var val = param[bitStruct.bitType] >> bitStruct.bitNo & 1
        ret[byte] |= val << bit
      }
  })
  return ret.reverse()
}

function intToByteArray(intData, bitNum) {
  var ret = []
  for (var i = 0; i < bitNum / 8; i++) {
    ret.push(intData & 255)
    bitNum = intData >> 8
  }
  return ret.reverse()
}

function extractOpData(type, op, bin) {
  var retBits = 0,
    littleEndian = bin.slice().reverse(),
      intData = op.reduce(function(ret, bitStruct, index) {
        var bit = bitStruct.instBit % 8,
          byte = Math.floor(bitStruct.instBit / 8),
            byteMask = 1 << bit
            retBits = Math.max(retBits, bitStruct.bitNo + 1)
            if (bitStruct.bitType == type) {
              return ret | (littleEndian[byte] & byteMask) >> bit << bitStruct.bitNo
            }
            return ret
      }, 0)
      return intToByteArray(intData, retBits)
}

function checkMask(mask, cmd) {
  return mask.length == cmd.length && !mask.some(function(mb, i) {
    return !(cmd[i] == mb || typeof mb !== "number")
  })
}
module.exports.extractOpData = extractOpData
module.exports.opToBin = opToBin
module.exports.checkMask = checkMask
