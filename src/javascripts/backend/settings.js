(function(global) {
  function SettingsManager(settings) {
    this.settings = settings
    this.default = null
  }
  SettingsManager.prototype = {
    set: function(key, value) {
      this.settings[key] = value
    },
    get: function(key, _default) {
      if (!this.has(key)) {
        if ([].slice.call(arguments).length == 1) {
          return this.default
        }
        return _default
      }
      return this.settings[key]
    },
    keys: function() {
      return Object.getOwnPropertyNames(this.settings)
    },
    obj: function() {
      var dic = {},
        self = this
      this.keys().reverse().forEach(function(k) {
        dic[k] = self.get(k)
      })
      return dic
    },
    has: function(key) {
      return Object.hasOwnProperty.call(this.settings, key)
    },
    parent: function(settings) {
      return new MuxSettingsManager([this, toSettings(settings)])
    },
    child: function(settings) {
      return new MuxSettingsManager([toSettings(settings), this])
    }
  }

  function GetSettingsManager() {
    this.prefix = "babelfish_"
    this.settings = this.updatedSettings()
  }
  GetSettingsManager.prototype = Object.create(SettingsManager.prototype)
  GetSettingsManager.prototype.set = function() {
    throw Error("Cont'set to settings manager based on GET")
  }
  GetSettingsManager.prototype.get = function(key, _default) {
    return SettingsManager.prototype.get.call(this, key.toLowerCase(), _default)
  }
  GetSettingsManager.prototype.has = function(key) {
    return SettingsManager.prototype.has.call(this, key.toLowerCase())
  }
  GetSettingsManager.prototype.updatedSettings = function() {
    var self = this,
      dic = {},
      get = global.window && window.location && window.location.search && window.location.search.split("?" + this.prefix)[1] || null
    if (get !== null) {
      get.split("&" + this.prefix).forEach(function(g) {
        var s = g.split("=")
        dic[s[0].toLowerCase()] = self.parseValue(s[1])
      })
    }
    return dic
  }
  GetSettingsManager.prototype.parseValue = function(val) {
    try {
      return JSON.parse(val)
    } catch (e) {
      return val
    }
  }

  function MuxSettingsManager(lst) {
    this.managers = lst
  }
  MuxSettingsManager.prototype = Object.create(SettingsManager.prototype)
  MuxSettingsManager.prototype.has = function(key) {
    return this.managers.some(function(m) {
      return m.has(key)
    })
  }
  MuxSettingsManager.prototype.keys = function() {
    var dic = {}
    for (var i = this.managers.length - 1; i >= 0; i--) {
      this.managers[i].keys().reverse().forEach(function(k) {
        dic[k] = null
      })
    }
    return Object.getOwnPropertyNames(dic)
  }
  MuxSettingsManager.prototype.get = function(key, _default) {
    for (var i = 0; i < this.managers.length; i++) {
      var m = this.managers[i]
      if (!m.has(key)) continue
      return m.get(key)
    }
    if ([].slice.call(arguments).length == 1) {
      return this.default
    }
    return _default
  }
  MuxSettingsManager.prototype.set = function(keu, value) {
    throw Error("Can't set to multiplexing settings manager")
  }

  function toSettings(obj) {
    if (typeof obj !== "object") return new SettingsManager({})
    if (obj instanceof SettingsManager) return obj
    return new SettingsManager(obj)
  }
  module.exports.toSettings = toSettings
  module.exports.SettingsManager = SettingsManager
  module.exports.GetSettingsManager = GetSettingsManager
  module.exports.MuxSettingsManager = MuxSettingsManager
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

