(function (global){
var DummyRuntime = require('./messaging/dummy.js').DummyRuntime,
    ChromeMessaging = require('./messaging/chrome.js').ChromeMessaging;

/**
 * The messaging intefaces should implement
 *
 * - onConnectExternal
 * - onMessageExternal
 * - sendMessage
 * - connect
 *
 * That behave like tha chrome runtime messaging interface.
 */
var interfaces = {
  chrome: ChromeMessaging,
  test: DummyRuntime
};

if (!global.chrome ||
    !global.chrome.runtime ||
    !global.chrome.runtime.sendMessage) {
  global.MESSAGING_METHOD = 'test';
}

module.exports = new (interfaces[global.MESSAGING_METHOD || 'chrome'])();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})