const Event = require("./event.js").Event;

/* eslint no-unused-vars: 0 */
const SHUTDOWN = 0,
    DISCONNECTED = 1,
    CONNECTED = 2;
const abstractAvailable = (function() {
  let initCb = null;

  function init(cb, timeout) {
    if (cb && !this.onFound.hasListener(cb)) {
      this.onFound.removeListener(initCb);
      initCb = cb;
      this.onFound.addListener(initCb)
    }
    if (this.isConnected()) {
      this.onFound.dispatch();
      return
    }
    this.connect(timeout || 4e3)
  }

  function shutdown(done, dispatchEvents) {
    var self = this;
    this.disconnect(function() {
      if (self.state <= SHUTDOWN) {
        if (done) done();
        return
      }
      self.state = SHUTDOWN;
      self.onLost.close();
      self.onFound.close();
      self.onError.close();
      if (done) done()
    }, dispatchEvents)
  }
  return function(options) {
    this.state = SHUTDOWN;
    this.api = {};
    this.onFound = new Event();
    this.onLost = new Event();
    this.onError = new Event();
    this.closed = true;
    this.init = init;
    this.shutdown = shutdown
  }
})();

module.exports.abstractAvailable = abstractAvailable
