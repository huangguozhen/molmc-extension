(function(global) {
  var messageApi = require("./messaging.js")

  function BootStrapClient() {}

  BootStrapClient.prototype = {
    getState: function(hostId, cb, cfg) {
      messageApi.sendMessage(hostId, {
        legacy: true,
        method: "getManifestAsync",
        object: "runtime",
        args: {
          args: [{
            type: "function"
          }]
        },
        callbackId: -1
      }, function clientStateResponse(resp) {
        if (!resp || resp.version) {
          cb(resp)
          return
        }
        var val = null
        try {
          val = resp.args.args[0].val
        } catch (e) {}
        cb(val)
      })
    },

    getHostId: function(cb, cfg) {
      cfg = cfg || {}
      var appIds = cfg.ids || global.appIds || ["liifijdapbinabgcopgmodjkbgmbbdoi", "degcgnklllnnbfnknpelaclgiclcaioe", global.APP_ID],
        car = appIds[0],
        cdr = appIds.slice(1),
        self = this

      if (!car) {
        cb()
        return
      }

      this.getState(car, function checkManifest(arg) {
        if (!arg) {
          cfg.ids = cdr
          self.getHostId(cb, cfg)
          return
        }
        cb(car, arg)
      }, cfg)
    },

    getManifest: function(cb, cfg) {
      this.getHostId(function(id, state) {
        if (state) state.hostId = id
        cb(state)
      }, cfg)
    }
  }

  module.exports = new BootStrapClient()
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
