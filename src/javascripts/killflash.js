(function(global) {
  var errno = require("./backend/errno.js")
  global.babelfish_killFlash = function() {
    window.currentTransaction.finalError(errno.KILLED, {
      method: "button"
    })
  }

  function killFlashButton(transaction) {
    global.currentTransaction = transaction
    return ' <button onclick="babelfish_killFlash()" style="float: right" class="killbutton">Kill Flash</button>'
  }
  module.exports = killFlashButton
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

