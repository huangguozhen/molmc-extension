const scheduler = require("./../backend/scheduler.js"),
  Event = require("./../event.js").Event;

function ReceiveErrorEvent(connectionId, api) {
  var self = this;
  Event.call(this);
  this.api = api;
  this.connectionId = connectionId;
  this.nextPoll = null;
  this.closed = false;
  this.dispatched = false;
  this.chromeListener = function(info) {
    if (info.connectionId == self.connectionId) {
      self.dispatch(info)
    }
  };
  api.serial.onReceiveError.addListener(this.chromeListener);
  if (0) {
    api.runtime.getPlatformInfo(function(platform) {
      if (platform.os == "win") {
        self.poll(self.pollDtr.bind(self))
      }
    })
  }
}

ReceiveErrorEvent.prototype = Object.create(Event.prototype);
ReceiveErrorEvent.prototype.dispatch = function() {
  if (this.dispatched || this.closed) {
    return
  }
  this.dispatched = true;
  Event.prototype.dispatch.apply(this, arguments)
};
ReceiveErrorEvent.prototype.connectionOk = function() {
  if (this.nextPoll) {
    this.reschedulePoll(null)
  }
};
ReceiveErrorEvent.prototype.pollDtr = function(next, dispatch) {
  var self = this;
  if (this.dispatched) return;
  console.log("Polling dtr...");
  this.checkConnection(function(ok) {
    if (ok) {
      self.reschedulePoll(next);
      return
    }
    scheduler.setImmediate(function() {
      self.nextPoll = null;
      dispatch({
        connectionId: self.connectionId,
        error: "device_lost"
      })
    })
  })
};
ReceiveErrorEvent.prototype.reschedulePoll = function(cb) {
  var callback;
  if (this.nextPoll) {
    scheduler.clearTimeout(this.nextPoll.handler);
    callback = this.nextPoll.callback
  }
  if (cb) {
    callback = cb
  }
  if (callback) {
    this.nextPoll = {
      handler: scheduler.setTimeout(callback, 1e3),
      callback: callback
    }
  }
};

ReceiveErrorEvent.prototype.checkConnection = function(cb) {
  this.api.serial.setControlSignals(this.connectionId, {
    dtr: false
  }, cb)
};

ReceiveErrorEvent.prototype.close = function() {
  Event.prototype.close.call(this);
  if (this.nextPoll) {
    scheduler.clearTimeout(this.nextPoll.handler)
  }
  this.closed = true;
  this.api.serial.onReceiveError.removeListener(this.chromeListener)
};

module.exports.ReceiveErrorEvent = ReceiveErrorEvent
