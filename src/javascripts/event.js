/*
 * 75
 */
var scheduler = require("./backend/scheduler.js")

function Event() {
  this.listeners = []
  this.pollCb = null
}
Event.prototype = {
  poll: function(pollCb) {
    this.pollCb = pollCb
    if (pollCb) {
      this.doPoll()
    }
  },
  doPoll: function(cb) {
    var self = this,
      next = this.doPoll.bind(this),
      dispatch = this.dispatch.bind(this)
    scheduler.setImmediate(function() {
      if (!self.pollCb || self.listeners.length == 0 || self.paused) {
        return
      }
      self.pollCb(next, dispatch)
      if (cb) cb()
    })
  },
  addListener: function(cb, config) {
    if (!cb || this.listeners.some(function(l) {
      return l === cb
    })) {
      return
    }
    if (this.pollCb && this.listeners.length == 0) {
      scheduler.setImmediate(this.doPoll.bind(this))
    }
    cb.forceAsync = !!(config || {}).forceAsync
    this.listeners.push(cb)
  },
  hasListener: function(cb) {
    return this.listeners.some(function(l) {
      return l === cb
    })
  },
  removeListener: function(cb) {
    this.listeners = this.listeners.filter(function(l) {
      return l !== cb
    })
  },
  dispatch: function(varArgs) {
    var args = [].slice.call(arguments),
      self = this
    this.listeners.some(function(l) {
      function callListener() {
        if (!self.dispatcher) {
          return l.apply(null, args)
        }
        return self.dispatcher.apply(self, [l].concat(args))
      }
      if (l.forceAsync) {
        scheduler.setImmediate(callListener)
        return
      }
      callListener()
    })
  },
  close: function() {
    this.listeners = []
    this.poll(null)
  },
  setDispatcher: function(cb) {
    this.dispatcher = cb
  }
}
module.exports.Event = Event
