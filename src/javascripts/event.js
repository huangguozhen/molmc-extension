const scheduler = require("./backend/scheduler.js");

class Event {
  constructor () {
    this.listeners = [];
    this.pollCb = null
  }

  poll (pollCb) {
    this.pollCb = pollCb;
    if (pollCb) {
      this.doPoll()
    }
  }

  doPoll (cb) {
    let self = this,
      next = this.doPoll.bind(this),
      dispatch = this.dispatch.bind(this);

    scheduler.setImmediate(function() {
      if (!self.pollCb || self.listeners.length == 0 || self.paused) {
        return
      }
      self.pollCb(next, dispatch);
      if (cb) cb()
    })
  }

  addListener (cb, config) {
    if (!cb || this.listeners.some((l) => (l === cb))) {
      return
    }

    if (this.pollCb && this.listeners.length == 0) {
      scheduler.setImmediate(this.doPoll.bind(this))
    }

    cb.forceAsync = !!(config || {}).forceAsync;
    this.listeners.push(cb)
  }

  hasListener (cb) {
    return this.listeners.some(function(l) {
      return l === cb
    })
  }

  removeListener (cb) {
    this.listeners = this.listeners.filter(function(l) {
      return l !== cb
    })
  }

  dispatch (varArgs) {
    let args = [].slice.call(arguments),
      self = this;
    this.listeners.some((l) => {
      function callListener() {
        if (!self.dispatcher) {
          return l.apply(null, args)
        }
        return self.dispatcher.apply(self, [l].concat(args))
      }

      if (l.forceAsync) {
        scheduler.setImmediate(callListener);
        return
      }
      callListener()
    })
  }

  close () {
    this.listeners = [];
    this.poll(null)
  }

  setDispatcher (cb) {
    this.dispatcher = cb
  }
}

module.exports.Event = Event
