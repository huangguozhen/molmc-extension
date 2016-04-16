var messageApi = require('./messaging.js')

function BootstrapHost () {
  this.commands = []
  this.listener = null
  this.listen()
}
BootstrapHost.prototype = {
  listen: function () {
    var self = this
    this.listener = function (req, sender, sendResp) {
      // Block if a command sais false ->
      // Say false if some command sais false
      return self.commands.length == 0 || !self.commands.some(function (c) {
        return !c(req, sendResp)
      })
    }

    messageApi.onMessageExternal.addListener(this.listener)
  },

  cleanup: function () {
    messageApi.onMessageExternal.removeListener(this.listener)
  }
}
module.exports.BootstrapHost = BootstrapHost
