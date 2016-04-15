(function (global) {
  // setTimeout is clamped to 1000ms min time for background tabs.

  // Check wether we are in the app context.
  function isApp () {
    // getManifest resturns a value and thus is not available to the
    // client
    return !!chrome.runtime.getManifest
  }

  // Not in a browser makes it ok to use setTimeout
  if (!(global.postMessage && global.addEventListener) || isApp()) {
    global.setImmediate = global.setTimeout.bind(global)
    global.clearTimeout = global.clearTimeout.bind(global)
  } else {
    (function () {
      "use strict"
      var i = 0
      var timeouts = {}
      var messageName = "setImmediate" + new Date().getTime()

      function post(fn) {
        if (i === 0x100000000) { // max queue size
          i = 0
        }
        if (++i in timeouts) {
          throw new Error("setImmediate queue overflow.")
        }
        timeouts[i] = fn
        global.postMessage({ type: messageName, id: i }, "*")
        return i
      }

      function receive(ev) {
        if (ev.source !== window) {
          return
        }
        var data = ev.data
        if (data && data instanceof Object && data.type === messageName) {
          ev.stopPropagation()
          var id = ev.data.id
          var fn = timeouts[id]
          if (fn) {
            delete timeouts[id]
            fn()
          }
        }
      }

      function clear(id) {
        delete timeouts[id]
      }

      global.addEventListener("message", receive, true)
      global.setImmediate = post
      global.clearImmediate = clear
    })()
  }
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
