/*
 * 74
 */
(function(global) {
  const settings = require("./backend/settings.js"),
    defaults = {
      checkPages: true,
      logger: "default",
      developer: false,
      warningReturnValueRange: [20500, 21e3]
    },
    userSettings = {
      statusLog: false,
      killButton: false,
      verbosity: 0
    },
    developerSettings = {
      statusLog: true,
      killButton: true,
      verbosity: 0
    }

  function getDefaultSettings() {
    var def = settings.toSettings(defaults),
      mid = settings.toSettings(userSettings),
      adhoc = (new settings.GetSettingsManager()).child(global.babelfishSettings)
    if (adhoc.get("developer") || def.get("developer")) {
      mid = developerSettings
      console.warn("Enabling developer settings:", developerSettings)
      console.warn("User settings are: ", userSettings)
      console.warn("Remember you can override settings:")
      console.warn("- editing the babelfishSettings object")
      console.warn("- `babelfish_OPTION=JSON_ENCODED_VALUE` " + "(the json value will fallback to raw string.")
      console.warn("other settings include (but not limited):", defaults)
    }
    return def.child(mid).child(adhoc)
  }
  global.babelfishSettings = {}
  module.exports.settings = getDefaultSettings()
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
