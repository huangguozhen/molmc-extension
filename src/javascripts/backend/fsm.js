/* eslint no-unused-vars: 0 */
var scheduler = require("./scheduler.js"),
  errno = require("./errno.js"),
  status = require("./status.js"),
  Event = require("./../event.js").Event,
  getLog = require("./logging.js").getLog

function TransitionConfig(conf) {
  conf = conf || {}
  this.state = conf.state
  this.fallbackCb = conf.fallbackCb || function(cb) {
    cb()
  }
  this.isRetry = conf.isRetry || false
  this.waitBefore = null
  if (typeof conf.waitBefore === "number") {
    this.waitBefore = conf.waitBefore
  }
  this.retryInterval = typeof conf.retryInterval === "number" ? conf.retryInterval : 500
  this.retries = conf.retries || 3
  this.args = conf.args instanceof Array ? conf.args.slice() : []
}
TransitionConfig.prototype = {
  copy: function() {
    return new TransitionConfig(this)
  },
  doFallback: function(doTransition) {
    var ret = this.copy()
    ret.isRetry = true
    ret.retries--
    if (ret.retries > 0) {
      var args = [doTransition.bind(null, ret)].concat(this.args)
      scheduler.setTimeout(function _errorFallback() {
        ret.fallbackCb.apply(null, args)
      }, ret.retryInterval)
      return true
    }
    return false
  }
}

function FiniteStateMachine(config, finishCallback, errorCallback, parent) {
  var self = this
  this.state = null
  this.onStatusChange = new Event()
  this.onClose = new Event()
  this.onStatusChange.setDispatcher(function(fn, status, context) {
    if (status.timestamp) {
      fn(status)
      return
    }
    fn(status.copy(context))
  })
  this.stateHistory = []
  this.context = {}
  this.dead_ = false
  this.parentState = null
  if (parent) {
    /* eslint no-inner-declarations: 0 */
    function closeListner() {
      self.cleanup(function() {})
    }

    function statusChangePropagate(status, context) {
      self.parentState.parent.onStatusChange.dispatch(status, context)
    }
    this.parentState = {
      parent: parent
    }
    this.parentState.listeners = {}
    this.parentState.parent.onClose.addListener(closeListner)
    this.onStatusChange.addListener(statusChangePropagate)
    this.parentState.listeners.closeListner = closeListner
  }
  this.config = config || {}
  this.idleTimeout = typeof this.config.idleTimeout === "undefined" ? 2e4 : this.config.idleTimeout
  this.finishCallback = function _fsmFinishCb() {
    finishCallback.apply(null, [].slice.call(arguments))
  }
  this.errorCallback = function _fsmErrorCb() {
    errorCallback.apply(null, [].slice.call(arguments))
  }
  this.previousErrors = []
  this.log = getLog("FSM")
}
FiniteStateMachine.prototype = {
  setStatus: function(status, context) {
    this.onStatusChange.dispatch(status, context)
  },
  dead: function() {
    if (this.parentState) return this._dead || this.parentState.parent.dead()
    return this._dead
  },
  child: function(type, cb) {
    /* eslint new-cap: 0 */
    return new type(this.config, cb, this.errCb.bind(this), this)
  },
  refreshTimeout: function() {
    var self = this
    if (this.parentState) {
      this.parentState.parent.refreshTimeout()
      return
    }
    if (this.timeout) {
      scheduler.clearTimeout(this.timeout)
      this.timeout = null
    }
    this.timeout = scheduler.setTimeout(function _fsmIdleHost() {
      self.finalError(errno.IDLE_HOST, {
        timeout: self.idleTimeout
      })
    }, this.idleTimeout)
  },
  errCb: function(retval, context) {
    var self = this,
      retryConf = null,
      ctx = context || {}
    this.log.warn("Received error:", retval)
    if (this.lastTransition && this.lastTransition.doFallback(this.transitionConf.bind(this))) {
      return
    }
    this.finalError(retval, ctx)
  },
  finalError: function(retval, context) {
    var self = this
    this.onClose.dispatch()
    if (this.parentState) {
      this.cleanup(function() {
        self.log.log("Propagating error to parent:", self, "->", self.parentState.parent)
        self.parentState.parent.errCb(retval, context)
      })
      return
    }
    if (this.previousErrors.length > 0) {
      this.log.warn("Previous errors", this.previousErrors)
      return
    }
    context = context || {}
    if (retval.context) {
      context.retValContext = retval.context
    }
    if (this.config && this.config.api && this.config.api.runtime && this.config.api.runtime.lastError) {
      context.apiLastError = this.config.api.runtime.lastError
      this.log.warn("LastError:", this.config.api.runtime.lastError)
    }
    var state = this.lastTransition ? this.lastTransition.state : "<unknown>"
    this.lastTransition = null
    this.log.error("[ERROR:" + state + "]", retval.name, "(" + retval.value + "):", retval.message)
    this.log.error("Context:", context, "last transition:", this.lastTransition)
    this.previousErrors.push(retval.copy(context))
    this.log.log(retval.message, context)
    scheduler.setTimeout(function _fsmFinalError() {
      self.cleanup(function() {
        if (self.errorCallback) {
          scheduler.setTimeout(self.errorCallback.bind(self, retval.value, retval.shortMessage(context, state)))
          return
        }
      })
    })
  },
  transitionConf: function(conf) {
    var self = this
    if (this.dead()) {
      if (!this.blockedStates || this.blockedStates.length >= 10) {
        var states = (this.blockedStates || [conf.state]).toString()
        this.setStatus(status.BLOCKING_STATES, {
          states: states
        })
        this.blockedStates = []
      } else {
        this.blockedStates.push(conf.state)
      }
      console.log("Jumping to state '", conf.state, "' arguments:", conf.args, "BLOCKED", this.dead_ ? "(dead parent)" : "(dead)")
      return
    }
    this.refreshTimeout()
    this.lastTransition = conf
    if (typeof this[conf.state] !== "function") {
      throw Error(conf.state + " transition not available.")
    }
    if (typeof conf.waitBefore !== "number" || conf.isRetry) {
      this.log.log("Jumping '" + conf.state + "' (immediate) arguments:", conf.args)
      self.setStatus(status.TRANSITION, {
        state: conf.state,
        args: conf.args
      })
      this[conf.state].apply(this, conf.args)
      return
    }
    scheduler.setTimeout(function _jumpToState() {
      self.log.log("Jumping '" + conf.state + "' (delay: ", conf.waitBefore, ") arguments:", conf.args)
      self.setStatus(status.TRANSITION, {
        state: conf.state,
        args: conf.args
      })
      self[conf.state].apply(self, conf.args)
    }, conf.waitBefore)
  },
  transition: function(stateOrConf, varArgs) {
    var args = [].slice.call(arguments, 1),
      conf
    if (typeof stateOrConf == "string") {
      conf = new TransitionConfig({
        state: stateOrConf,
        args: args
      })
    } else {
      conf = new TransitionConfig(stateOrConf)
      if (args.length > 0) {
        conf.args = args
      }
    }
    return this.transitionConf(conf)
  },
  transitionCb: function(stateOrConf, varArgs) {
    var self = this,
      allArgs = [].slice.call(arguments)
    return function() {
      var newArgs = [].slice.call(arguments)
      self.transition.apply(self, allArgs.concat(newArgs))
    }
  },
  cleanup: function(callback) {
    if (this._dead) {
      return
    }
    this._dead = true
    if (this.parentState) {
      this.parentState.parent.onClose.removeListener(this.parentState.listeners.closeListner)
    }
    this.onClose.dispatch()
    this.onClose.close()
    callback = callback || this.finishCallback.bind(this)
    if (this.timeout) {
      this.log.log("Stopping timeout")
      scheduler.clearTimeout(this.timeout)
    }
    this.timeout = null

    function doCleanup() {
      scheduler.clearTimeout(emergencyCleanupTimeout)
      callback()
    }
    var emergencyCleanupTimeout = scheduler.setTimeout(doCleanup, 1e4)
    this.localCleanup(doCleanup)
  },
  localCleanup: function(cb) {
    scheduler.setTimeout(function _localCleanupCb() {
      cb()
    })
  }
}
module.exports.FiniteStateMachine = FiniteStateMachine
