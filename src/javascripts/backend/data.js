var scheduler = require("./scheduler.js")

function Data(data, offset, parent, defaultByte) {
  this.parent = parent
  this.offset = offset || 0
  this.data = data || []
  this.defaultByte = defaultByte || 0
  this.slice = this.capSlice
  Object.defineProperty(this, "length", {
    get: function() {
      if (this.getParent()) {
        if (this.isEmpty()) return this.getParent().length
        return Math.max(this.getParent().length, this.offset + this.data.length)
      }
      return this.offset + this.data.length
    }
  })
}
Data.prototype = {
  getParent: function() {
    return this.parent && this.parent.getSelf()
  },
  getSelf: function() {
    if (this.offset === Infinity) {
      return this.getParent()
    }
    return this
  },
  copy: function() {
    return new Data(this.data, this.offset, this.parent, this.defaultByte)
  },
  /* eslint no-redeclare: 0 */
  get: function(addr, defaultByte) {
    var byte = this.data[addr - this.offset],
      defaultByte = typeof defaultByte == "undefined" ? this.defaultByte : defaultByte
    if (typeof byte === "undefined" && this.getParent()) {
      byte = this.getParent().get(addr, defaultByte)
    }
    if (typeof byte === "undefined") {
      byte = defaultByte
    }
    return byte
  },
  unknownSlice: function(start, end) {
    if (this.getParent()) {
      return this.getParent().infiniteSlice(start, end)
    }
    if (end <= start) {
      return []
    }
    var ret = new Array(end - start)
    for (var i = 0; i < end - start; i++) ret[i] = this.defaultByte
    return ret
  },
  infiniteSlice: function(start, end) {
    if (start >= end) {
      return []
    }
    var sr = this.subranges(start, end),
      before = this.unknownSlice(sr.before[0], sr.before[1]),
      own = this.data.slice(sr.data[0] - this.offset, sr.data[1] - this.offset),
      after = this.unknownSlice(sr.after[0], sr.after[1]),
      ret = before.concat(own).concat(after)
    return ret
  },
  capSlice: function(start, end) {
    var realEnd = typeof end === "undefined" ? this.length : end
    return this.infiniteSlice(Math.max(start || 0, 0), Math.min(realEnd, this.length))
  },
  subranges: function(start, end) {
    var dataStart = this.offset,
      dataEnd = this.offset + this.data.length
    if (dataStart < start) {
      dataStart = start
    } else if (dataStart > end) {
      dataStart = end
    }
    if (dataEnd > end) {
      dataEnd = end
    } else if (dataEnd < start) {
      dataEnd = start
    }
    return {
      before: [start, dataStart],
      data: [dataStart, dataEnd],
      after: [dataEnd, end]
    }
  },
  layer: function(data, offset, trySquashing) {
    if (!data) return new Data(null, null, this)
    var overlapRange = this.subranges(offset, offset + data).data,
      overlapping = overlapRange[1] - overlapRange[0] > 0,
      consecutiveAfter = offset == this.data.length + this.offset,
      consecutiveBefore = offset + data.length == this.offset
    if (trySquashing && (overlapping || consecutiveAfter || consecutiveBefore)) {
      var mirror = this.copy()
      mirror.parent = null
      var ret = new Data(data, offset, mirror).squashed()
      ret.parent = this.parent
      return ret
    }
    return new Data(data, offset, this)
  },
  layerData: function(data) {
    data.parent = this
    return data
  },
  min: function() {
    var parentOffset = Infinity,
      thisOffset = Infinity
    if (this.getParent()) {
      parentOffset = this.getParent().min()
    }
    if (!this.isEmpty()) {
      thisOffset = this.offset
    }
    return Math.min(thisOffset, parentOffset)
  },
  squashed: function() {
    var ret = new Data(this.slice(this.min()), this.min()),
      db = this.defaultByte
    Object.defineProperty(ret, "defaultByte", {
      value: db,
      writable: false
    })
    return ret
  },
  isEmpty: function(recursive) {
    var selfEmpty = this.data.length == 0,
      parentEmpty = true
    if (!recursive) {
      return selfEmpty
    }
    if (this.getParent()) {
      parentEmpty = this.getParent().isEmpty()
    }
    return selfEmpty && parentEmpty
  },
  tile: function(strider, pagesize, done, start, end) {
    var self = this,
      firstAddr = start || 0,
      lastAddr = end || self.length

    function tileFrom(offset, args) {
      var data = self.slice(offset, pagesize + offset)
      if (offset >= lastAddr) {
        done.apply(null, args)
        return
      }
      scheduler.setImmediate(function() {
        strider.bind(null, offset, data, function() {
          tileFrom(offset + data.length, [].slice.call(arguments))
        }).apply(null, args)
      })
    }
    tileFrom(firstAddr)
  }
}
module.exports.Data = Data
