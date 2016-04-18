/*
 * 81
 */
var getLog = require("./../backend/logging.js").getLog

function State(reader, cons) {
  var self = this
  this.log = this.log || getLog("ReaderState")
  this.reader = reader
  this.cons = cons
  this.destroyed = false
  this.handler = function() {
    if (self.destroyed) return null
    self.cons.cdr.destroy()
    self.cons.cdr = NilCons
    if (!self._handler) return null
    return self._handler.apply(self, arguments)
  }
  this.log.log("Registering listener")
  this.reader.api.serial.onReceive.addListener(this.handler)
}
State.prototype = {
  _handler: function() {},
  _destroy: function() {},
  destroy: function() {
    this.destroyed = true
    if (this.handler) this.log.log("Unregistering listener")
    this.reader.api.serial.onReceive.removeListener(this.handler)
    if (this._destroy) this._destroy()
  }
}

/* eslint no-unused-vars: 0 */
function stateFactory(handler, destroy, data) {
  var created = false,
    ret = function(reader, cons) {
      State.call(this, reader, cons)
      this.data = data
    }
  ret.prototype = Object.create(State.prototype)
  ret.prototype._handler = handler || function() {}
  ret.prototype._destroy = destroy || function() {}
  return ret
}

/* eslint new-cap: 0 */
function StateCons(reader, car, cdr) {
  this.car = new car(reader, this)
  this.cdr = cdr || NilCons
}
StateCons.prototype = {
  destroy: function() {
    if (this.destroyed) return
    this.destroyed = true
    this.car.destroy()
    this.cdr.destroy()
    this.cdr = NilCons
  }
}
var nop = function() {},
  NilCons = new StateCons(null, function() {
    this.destroy = nop
  }, {
    destroy: nop
  })

NilCons.destroy = nop
module.exports.State = State
module.exports.NilCons = NilCons
module.exports.StateCons = StateCons
module.exports.stateFactory = stateFactory
