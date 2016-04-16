(function(global) {
  var NO_DOM = !(global.removeEventListener && global.addEventListener && global.postMessage),
    TESTING = typeof global.it === "function" && typeof global.describe === "function"

  function WaitHelperDom(waiter) {
    this.waiter = waiter
  }
  WaitHelperDom.prototype = {
    maybeListen: function() {
      if (this.domListener) return
      var self = this
      this.domListener = function(ev) {
        if (ev.source !== window) return
        var data = ev.data
        if (!data || !(data instanceof Object) || data.waiterId != self.waiter.id) return
        self.guard()
      }
      global.addEventListener("message", this.domListener, true)
    },
    due: function() {
      if (typeof this.due === "number") return this.due
      return this.waiter.due
    },
    guard: function() {
      if (this.due() > this.waiter.async.now()) {
        this.wait()
        return
      }
      this.close()
      this.waiter.guard()
    },
    close: function() {
      if (!this.domListener) return
      global.removeEventListener("message", this.domListener)
      this.domListener = null
    },
    wait: function(ms) {
      if (typeof ms === "number") this.due = this.waiter.async.now() + ms
      this.maybeListen()
      global.postMessage({
        waiterId: this.waiter.id
      }, "*")
    }
  }

  function WaitHelperJs(waiter) {
    this.waiter = waiter
  }
  WaitHelperJs.prototype = {
    close: function() {
      if (!this.handle) return
      global.clearTimeout(this.handle)
      this.handle = null
    },
    wait: function(ms) {
      var self = this,
        time = typeof ms === "number" ? ms : this.waiter.due - this.waiter.async.now()
      this.handle = global.setTimeout(function() {
        self.waiter.guard()
      }, time)
    }
  }
  var waiterIds = 1

  function Waiter(cb, due, async) {
    this.cb = cb
    this.due = due
    this.async = async
    this.onClose = null
    this.closed = false
    this.id = waiterIds++
  }
  Waiter.prototype = {
    setHelper: function(helper) {
      if (this.helper) this.helper.close()
      this.helper = helper
      return helper
    },
    guard: function() {
      if (this.closed) return
      var tl = this.due - this.async.now()
      if (tl < 0) {
        this.close()
        this.cb()
        return
      }
      this.run()
    },
    /* eslint no-unused-vars: 0 */
    run: function() {
      if (this.closed) return null
      var self = this
      if (this.due - this.async.now() >= 1e3 || NO_DOM) {
        this.setHelper(new WaitHelperJs(this))
      } else {
        this.setHelper(new WaitHelperDom(this))
      }
      this.helper.wait()
      return this
    },
    close: function() {
      if (this.closed) return
      this.closed = true
      this.setHelper(null)
      if (this.onClose) this.onClose()
      this.onClose = null
    },
    quickRun: function() {
      if (this.closed) return null
      this.setHelper(new WaitHelperJs(this)).wait(0)
      return this
    }
  }

  function Async() {
    this.index = new WaiterIndex()
  }
  Async.prototype = {
    wait: function(cb, due) {
      return new Waiter(cb, due, this)
    },
    postpone: function(cb) {
      return new Waiter(cb, this.now(), this)
    },
    now: function() {
      return Date.now()
    },
    setTimeout: function(cb, to) {
      return this.index.put(this.wait(cb, (to || 0) + this.now()).run())
    },
    clearTimeout: function(id) {
      this.index.rm(id)
    },
    clearImmediate: function(id) {
      return this.clearTimeout(id)
    },
    setImmediate: function(cb) {
      return this.setTimeout(cb, 0)
    }
  }

  function TestAsync() {
    this.index = new WaiterIndex()
    this.offset = 0
    this.capHandle = null
  }
  TestAsync.prototype = Object.create(Async.prototype)
  TestAsync.prototype.idleCap = function() {
    var waiter = this.index.minDue()
    if (waiter === null) {
      if (this.onEnd) this.onEnd()
      this.capHandle = null
      return
    }
    this.changeClock(waiter.due)
    waiter.quickRun()
    this.idleRenew()
  }
  TestAsync.prototype.idleRenew = function() {
    var self = this
    if (!this.capHandle) {
      this.capHandle = global.setTimeout(function() {
        self.capHandle = null
        self.idleCap()
      })
    }
  }
  TestAsync.prototype.changeClock = function(ms) {
    this.offset = ms - Date.now()
  }
  TestAsync.prototype.now = function() {
    return Date.now() + this.offset
  }
  TestAsync.prototype.setTimeout = function(cb, ms) {
    this.idleRenew()
    return this.index.put(this.wait(cb, (ms || 0) + this.now()))
  }

  function WaiterIndex() {
    this.db = {}
  }
  WaiterIndex.prototype = {
    put: function(obj) {
      this.rm(obj.id)
      this.db[obj.id] = obj
      obj.onClose = this.rm.bind(this, obj.id)
      return obj.id
    },
    get: function(id) {
      return this.db[id]
    },
    rm: function(id) {
      var waiter = this.db[id]
      if (!waiter) return
      waiter.close()
      this.rawDel(id)
    },
    rawDel: function(id) {
      delete this.db[id]
    },
    minDue: function() {
      var self = this,
        keys = Object.getOwnPropertyNames(this.db)
      if (keys.length > 0) {
        var minkey = keys.reduce(function(mink, k) {
          var cand = self.db[k],
            min = self.db[mink]
          if (!min) return min
          if (min.due < cand.due) return mink
          if (min.due == cand.due && min.id < cand.id) return mink
          return k
        })
        return this.get(minkey)
      }
      return null
    },
    array: function() {
      var self = this
      return Object.getOwnPropertyNames(this.db).map(function(k) {
        return self.db[k]
      })
    },
    length: function() {
      return Object.getOwnPropertyNames(this.db).length
    }
  }
  if (TESTING) {
    module.exports = new TestAsync()
  } else {
    module.exports = new Async()
  }
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
