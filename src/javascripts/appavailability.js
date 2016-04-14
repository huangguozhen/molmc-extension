const setupClient = require("./../chrome-extension/javascripts/client.js").setupClient,
  abstractAvailable = require("./availability.js").abstractAvailable
  // Event = require("./event.js").Event;

/* eslint no-unused-vars: 0 */
const SHUTDOWN = 0,
  DISCONNECTED = 1,
  CONNECTED = 2;

const asAvailable = (function() {
  function connect(timeout) {
    var self = this;
    this.api = this.api || {};
    setupClient(this.api, function() {
      self.state = CONNECTED;
      self.onFound.dispatch()
    }, function() {
      self.disconnect(function() {
        self.onLost.dispatch()
      })
    }, function(err) {
      self.onError.dispatch(err)
    }, timeout)
  }

  function disconnect(done, dispatchEvents) {
    if (this.state <= DISCONNECTED) {
      if (done) done();
      return
    }
    this.state = DISCONNECTED;
    this.api.local.disconnect(done, !dispatchEvents)
  }

  return function(options) {
    abstractAvailable.call(this);
    this.isConnected = function() {
      return this.api.local && this.api.local.token
    };
    this.connect = connect;
    this.disconnect = disconnect
  }
})();

module.exports.asAvailable = asAvailable
