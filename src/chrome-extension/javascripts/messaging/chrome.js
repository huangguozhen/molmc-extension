/**
 * @fileOverview The chrome API message passing method.
 * @name chrome.js
 * @author Chris Perivolaropoulos
 */

function ChromeMessaging () {
  this.version = chrome.runtime.getManifest ?
    chrome.runtime.getManifest().version : "1" ;
  this.onConnectExternal = chrome.runtime.onConnectExternal;
  this.onMessageExternal = chrome.runtime.onMessageExternal;
  this.sendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
  this.connect = chrome.runtime.connect.bind(chrome.runtime);
}
module.exports.ChromeMessaging = ChromeMessaging;