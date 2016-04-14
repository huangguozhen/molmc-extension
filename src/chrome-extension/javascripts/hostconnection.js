/**
 * @fileOverview Know when the client closes and also close if
 * orphaned.
 *
 * Common operations:
 * - closeMessage -> closeCall
 * - closeFn(openFn) = closefn
 *
 * Parameterized operation:
 * - closeArgs(closeFn, openArgs, callbackArgs)
 *
 * On connection open:
 * fromOpen(openFn, openArgs, callbackArgs) =
 *     fromClose(closeFn(openFn), closeArgs(closeFn, openArgs, callbackArgs)) =
 *     closeMessage -> closeCall
 *
 * On method:
 * fromClose(closeFn, closeArgs) = closeMessage -> closeCall
 * @name hostconnection.js
 * @author
 * @license
 */

var Arguments = require('./arguments.js').Arguments,
    MethodRequest = require('./requests.js').MethodRequest,
    ApiEventEmitter = require("./apieventemitter.js").ApiEventEmitter,
    r = require("./responses.js"),
    util = require("./util.js"),
    closed = [],
    log = new (require('./log.js').Log)('hostconnection');
require('./setimmediate.js');

/**
 * Method gets the args from the connection. Reverse just gets the
 * provided callback. There is one connection per event per callback
 * per client.
 *
 * There are 3 stages in the lifecycle of a connection
 *
 * - Init where the connection is initiated and the app event is
 *   triggered. Handled by the constructor and init.
 *
 * - Communication where the host pokes the client with a data ready
 *   (DTR) signal that there is data available, and the client requests
 *   for the available data with a separate one time request
 *
 * - Close where the DTR connection is closed and the listener is
 *   removed. Handled by close.
 *
 * @param {Port} port The port returned from onConnectExternal. The
 * name should be a json encoded object with
 *
 * - id: the connection id
 * - clientId: the id of the tab, generated by a KeepAliveConnetion
 * - methodRequest: An object called from MethodRequest.forSending
 * - reverse: A {path, type} object describing the reverser.
 *
 * @param {Function} closeCb Optionally a callback when the connection
 * closes. This should handle the cleanup of the connection for
 * external resources.
 */
function HostConnection (port, hostApi, closeCb) {
  var self = this;
  this.buffer = [];
  this.port = port;
  this.portConf = JSON.parse(port.name);
  this.id = this.portConf.id;
  this.closeCb = closeCb.bind(this);
  this.closed = false;

  // Will not be sent.
  var sendRaw = function (msg) {
    self.pushRequest(msg);
  };
  this.methodRequest = MethodRequest.fromMessage(
    null, this.portConf.methodRequestMsg, sendRaw);

  log.log("Opening connection:", this.repr());
  this.apiEvent = new ApiEventEmitter(this.methodRequest,
                                      this.portConf.reverser,
                                      hostApi,
                                      this.close.bind(this));
  this.port.onMessage.addListener(function (msg) {
    if (msg == "client created") {
      self.port.postMessage("ack");
      self.apiEvent.fire();
    }
  });
  log.log("Registering server side ondisconnect for method connection");
  this.port.onDisconnect.addListener(this.close.bind(this));
}

HostConnection.prototype = {
  repr: function () {
    return this.id +  " ( " + this.methodRequest.method + " )";
  },

  /**
   * Close the connection gracefully.
   */
  close: function () {
    if (this.closed) return;
    log.log("Closing connection:", this.repr());
    this.closed = true;
    this.port.disconnect();
    this.apiEvent.destroy();
    this.port = null;
    this.closeCb();
  },

  /**
   * Send an error message to the client over the connection port.
   *
   * @param {String} message The contents of the error.
   */
  sendError: function (message) {
    if (this.closed) return;

    this.port.postMessage(new r.ErrResponse(message).forSending());
    this.close();
  },

  /**
   * @param {Message} reqMsg A message that was to be called is
   * instead buffered.
   */
  pushRequest: function (reqMsg) {
    if (this.closed) return;

    if (reqMsg.responseType == "ErrResponse") {
      this.sendError(reqMsg.err);
    }

    // We expect they wont contain a function.
    if (!this.apiEvent.firstResponseMsg){
      this.apiEvent.firstResponseMsg = reqMsg;
    }

    if (this.buffer.length == 0){
      // To the end of the queue.
      setImmediate(this.setDtr.bind(this));
    }

    this.buffer.push(reqMsg);
    this.buffer.timestamp = Date.now();
  },

  /**
   * Notify the client that there is data to be read.
   */
  setDtr: function () {
    // This might be lef over on the queue.
    if (this.port)
      this.port.postMessage({timestamp: this.buffer.timestamp,
                             connection: this.id});
  },

  /**
   * Send the list of arguments accumulated.
   *
   * @param {Function} callback callback to accept the buffer of
   * Arguments objects.
   */
  flushBuffer: function (callback) {
    callback(this.buffer);
    this.buffer = [];
  },

  /**
   * Let the connection decide if it wants to apply a closing request
   * on itself.
   *
   * @param {MethodRequest|MethodRequestMessage} closingRequest the
   * request from the client that may be called.
   * @returns {null|AckResponse|ArgsResponse} True if we actually
   * called the request. We may still be open if we need more closing
   * requests to teminate. If the event emitter can call a callback
   * this is an ArgsResponse.
   */
  tryClosing: function (closingRequest) {
    if (this.closed) return false;
    var ret = this.apiEvent.maybeRunCloser(closingRequest);
    if (this.apiEvent.closed) {
      this.close();
    }
    return ret;
  }
};

module.exports.HostConnection = HostConnection;