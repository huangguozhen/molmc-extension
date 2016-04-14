  // util = require("./util.js"),
  // scheduler = require("./../backend/scheduler.js");
const Event = require("./../event.js").Event,
  buffer = require("./../backend/buffer.js"),
  LineBuffer = require("./linebuffer.js").LineBuffer,
  rs = require("./readerstates.js"),
  getLog = require("./../backend/logging.js").getLog

class PreliminaryState extends rs.State {
  constructor(reader, cons) {
    super(reader, cons)
    this.log = getLog("PreliminaryReaderState");

    this.name = "PreliminaryState";
    this.reader.leftoverBuffers = {}
  }

  _handler (msg) {
    var data = buffer.bufToBin(msg.data);
    this.log.log("Got bytes:", data.length);
    if (!msg || !msg.connectionId) return;
    this.reader.leftoverBuffers[msg.connectionId] = this.reader.leftoverBuffers[msg.connectionId] || [];
    var bufs = this.reader.leftoverBuffers[msg.connectionId],
      lastBuf = bufs[bufs.length - 1] || new LineBuffer(),
      newBuf = lastBuf.updated(data, null);
    bufs.push(newBuf)
  }

  _destroy () {
    let bufs = this.reader.leftoverBuffers[this.reader.connectionId] || [];
    this.reader.lastBuffer = bufs[bufs.length - 1];
    this.buffers = null
  }
}

class NormalState extends rs.State {
  constructor (reader, cons) {
    super(reader, cons)
    this.log = getLog("NormalState");
    this.name = "NormalState";
    let bufs = this.reader.leftoverBuffers[this.reader.connectionId] || [],
      self = this;
    this.log.log("Entering normal state, connectionId:", this.reader.connectionId, "pending buffers:", bufs.length);

    bufs.forEach(function(b) {
      self.reader.dispatch(b.flushData)
    });

    this.buffer = bufs[bufs.length - 1] || new LineBuffer()
  }

  _handler (msg) {
    let arr = buffer.bufToBin(msg.data);
    this.log.log("Got bytes:", arr.length);
    this.buffer = this.buffer.updated(arr, this.reader.dispatch.bind(this.reader));
    this.reader.dispatch(this.buffer.flushData)
  }

  _destroy () {
    this.buffer.freeze()
  }
}

class Reader extends Event {
  constructor (api) {
    super()
    this.log = getLog("Reader")
    this.api = api
    this.leftoverBuffers = {}
    this.stateList = new rs.StateCons(this, PreliminaryState, rs.NilCons)
  }

  init (connectionId) {
    this.buffer = new LineBuffer()
    this.connectionId = connectionId;
    this.stateList = new rs.StateCons(this, NormalState, this.stateList)
  }

  readHandler_ (message) {
    var stringMessage = buffer.bufToBin(message);
    this.buffer = this.buffer.updated(stringMessage, this.dispatch.bind(this));
    this.log.log("Flushing bytes:", this.buffer.flushData.length);
    this.dispatch(this.buffer.flushData)
  }

  close () {
    Event.prototype.close.call(this);
    this.stateList.destroy();
    this.stateList = rs.NilCons;
    this.leftoverBuffers = {}
  }
}

module.exports.Reader = Reader

// function PreliminaryState(reader, cons) {
//   this.log = getLog("PreliminaryReaderState");
//   rs.State.call(this, reader, cons);
//   this.name = "PreliminaryState";
//   this.reader.leftoverBuffers = {}
// }
// PreliminaryState.prototype = Object.create(rs.State.prototype);
// PreliminaryState.prototype._handler = function(msg) {
//   var data = buffer.bufToBin(msg.data);
//   this.log.log("Got bytes:", data.length);
//   if (!msg || !msg.connectionId) return;
//   this.reader.leftoverBuffers[msg.connectionId] = this.reader.leftoverBuffers[msg.connectionId] || [];
//   var bufs = this.reader.leftoverBuffers[msg.connectionId],
//     lastBuf = bufs[bufs.length - 1] || new LineBuffer(),
//     newBuf = lastBuf.updated(data, null);
//   bufs.push(newBuf)
// }
// PreliminaryState.prototype._destroy = function() {
//   let bufs = this.reader.leftoverBuffers[this.reader.connectionId] || [];
//   this.reader.lastBuffer = bufs[bufs.length - 1];
//   this.buffers = null
// };

// function NormalState(reader, cons) {
//   this.log = getLog("NormalState");
//   rs.State.call(this, reader, cons);
//   this.name = "NormalState";
//   let bufs = this.reader.leftoverBuffers[this.reader.connectionId] || [],
//     self = this;
//   this.log.log("Entering normal state, connectionId:", this.reader.connectionId, "pending buffers:", bufs.length);
//
//   bufs.forEach(function(b) {
//     self.reader.dispatch(b.flushData)
//   });
//   this.buffer = bufs[bufs.length - 1] || new LineBuffer()
// }
// NormalState.prototype = Object.create(rs.State.prototype);
// NormalState.prototype._handler = function(msg) {
//   let arr = buffer.bufToBin(msg.data);
//   this.log.log("Got bytes:", arr.length);
//   this.buffer = this.buffer.updated(arr, this.reader.dispatch.bind(this.reader));
//   this.reader.dispatch(this.buffer.flushData)
// };
// NormalState.prototype._destroy = function() {
//   this.buffer.freeze()
// }

// function Reader(api) {
//   this.log = getLog("Reader");
//   Event.call(this);
//   this.api = api;
//   this.leftoverBuffers = {};
//   this.stateList = new rs.StateCons(this, PreliminaryState, rs.NilCons)
// }
// Reader.prototype = Object.create(Event.prototype);
// Reader.prototype.init = function(connectionId) {
//   this.buffer = new LineBuffer()
//   this.connectionId = connectionId;
//   this.stateList = new rs.StateCons(this, NormalState, this.stateList)
// }
// Reader.prototype.readHandler_ = function(message) {
//   var stringMessage = buffer.bufToBin(message);
//   this.buffer = this.buffer.updated(stringMessage, this.dispatch.bind(this));
//   this.log.log("Flushing bytes:", this.buffer.flushData.length);
//   this.dispatch(this.buffer.flushData)
// }
// Reader.prototype.close = function() {
//   Event.prototype.close.call(this);
//   this.stateList.destroy();
//   this.stateList = rs.NilCons;
//   this.leftoverBuffers = {}
// }
