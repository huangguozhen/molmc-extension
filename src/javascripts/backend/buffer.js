// const arraify = require("./util").arraify,
const scheduler = require("./scheduler.js"),
  logging = require("./logging")

function storeAsTwoBytes(n) {
  return [n >> 8 & 255, n & 255]
}

function storeAsFourBytes(n) {
  return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255]
}

function hexRep(intArray) {
  if (intArray === undefined) return "<undefined>";
  var buf = "[";
  // var sep = "";
  for (var i = 0; i < intArray.length; ++i) {
    var hex = intArray[i].toString(16);
    hex = hex.length < 2 ? "0" + hex : hex;
    buf += " " + hex
  }
  buf += "]";
  return buf
}

function binToBuf(hex) {
  if (hex instanceof ArrayBuffer) return hex;
  var buffer = new ArrayBuffer(hex.length);
  var bufferView = new Uint8Array(buffer);
  for (var i = 0; i < hex.length; i++) {
    bufferView[i] = hex[i]
  }
  return buffer
}

function bufToBin(buf) {
  if (!(buf instanceof ArrayBuffer)) return buf;
  var bufferView = new Uint8Array(buf);
  var hexes = [];
  for (var i = 0; i < bufferView.length; ++i) {
    hexes.push(bufferView[i])
  }
  return hexes
}

function BufferReader(config) {
  var self = this;
  this.log = logging.getLog("Reader");
  Object.keys(config || {}).forEach(function(k) {
    self[k] = config[k]
  });
  this.ttl = typeof this.ttl === "number" ? this.ttl : 2e3;
  this.modifyDatabuffer = this.modifyDatabuffer.bind(this);
  if (this.buffer) {
    this.register(this.buffer)
  }
}
BufferReader.prototype = {
  register: function(buffer) {
    var self = this;
    this.buffer = buffer;
    buffer.appendReader(this);
    this.timeout_ = scheduler.setTimeout(function() {
      self.log.log("Reader timed out", self);
      buffer.removeReader(self);
      if (self.timeoutCb) {
        self.timeoutCb()
      } else {
        throw Error("Unhandled async buffer read timeout.")
      }
    }, this.ttl)
  },
  destroy: function() {
    this.log.log("Destroying reader from buffer", this.buffer);
    this.buffer.removeReader(this);
    if (this.timeout_) scheduler.clearTimeout(this.timeout_)
  },
  modifyDatabuffer: function() {
    throw Error("Not implemented")
  }
};

function Buffer() {
  this.log = logging.getLog("Buffer");
  this.databuffer = [];
  this.readers = [];
  this.maxBufferSize = null
}
Buffer.prototype = {
  removeReader: function(reader) {
    this.log.log("Removing reader:", reader);
    // var len = this.readers.length;
    this.readers = this.readers.filter(function(r) {
      return r !== reader
    })
  },
  appendReader: function(reader) {
    this.readers.push(reader)
  },
  runAsyncReaders: function(done) {
    // var self = this;
    this.log.log("Running readers:", this.readers, ":", this.databuffer);

    function fulfill(reader) {
      if (!reader) return true;
      if (reader.modifyDatabuffer()) {
        reader.destroy();
        return true
      }
      return false
    }
    this.readers.some(function(r) {
      return !fulfill(r)
    });
    if (done) done()
  },
  readAsync: function(maxBytesOrConfig, modifyBuffer, ttl, timeoutCb) {
    var reader;
    if (typeof maxBytesOrConfig === "number") {
      reader = new BufferReader({
        expectedBytes: maxBytesOrConfig,
        ttl: ttl,
        timeoutCb: timeoutCb
      })
    } else {
      reader = new BufferReader(maxBytesOrConfig)
    }
    reader.register(this);
    scheduler.setImmediate(this.runAsyncReaders.bind(this))
  },
  write: function(readArg, errorCb, doneCb) {
    var hexData = bufToBin(readArg.data);
    this.log.log("Dev said:", hexRep(hexData));
    this.databuffer = this.databuffer.concat(hexData);
    if (this.maxBufferSize && this.databuffer.length > this.maxBufferSize) {
      this.cleanup(function() {
        errorCb("Receive buffer larger than " + this.maxBufferSize);
        return
      })
    }
    this.runAsyncReaders(doneCb)
  },
  drain: function(callback) {
    var ret = this.databuffer,
      self = this;
    this.log.log("Draining bytes: ", hexRep(this.databuffer));
    this.readers.slice().forEach(function(r) {
      self.removeReader(r);
      scheduler.setImmediate(r.timeoutCb)
    });
    this.databuffer = [];
    if (callback) {
      callback({
        bytesRead: ret.length,
        data: ret
      })
    }
  },
  cleanup: function(callback) {
    this.log.log("Cleaning everything of buffer.", hexRep(this.databuffer));
    this.readers.slice().forEach(this.removeReader.bind(this));
    if (this.closed) {
      if (callback) callback();
      return
    }
    this.closed = true;
    for (var i = 0; i < this.readers.length; i++) {
      if (!this.readers[i]) {
        delete this.readers[i]
      } else {
        throw Error("Buffer reader survived the cleanup" + this.readers[i])
      }
    }
    this.databuffer = [];
    this.write = function(_, errCb) {
      errCb("Writing on a closed buffer.")
    };
    if (callback) callback()
  }
};

module.exports.Buffer = Buffer;
module.exports.BufferReader = BufferReader;
module.exports.hexRep = hexRep;
module.exports.bufToBin = bufToBin;
module.exports.storeAsTwoBytes = storeAsTwoBytes;
module.exports.storeAsFourBytes = storeAsFourBytes;
module.exports.binToBuf = binToBuf
