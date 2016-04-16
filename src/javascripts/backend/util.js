/* eslint no-unused-vars: 0 */
var scheduler = require("./scheduler.js")

function arraify(arrayLike, offset, prefixVarArgs) {
  var ret = Array.prototype.slice.call(arrayLike, offset),
    prefix = Array.prototype.slice.call(arguments, 2)
  return prefix.concat(ret)
}

/* eslint no-unreachable: 0 */
function deepCopy(obj) {
  switch (typeof obj) {
    case "array":
      return obj.map(deepCopy)
      break
    case "object":
      var ret = {}
      Object.getOwnPropertyNames(obj).forEach(function(k) {
        ret[k] = deepCopy(obj[k])
      })
      return ret
      break
    default:
      return obj
  }
}

function shallowCopy(obj) {
  var ret = {}
  Object.getOwnPropertyNames(obj).forEach(function(k) {
    ret[k] = obj[k]
  })
  return ret
}

/* eslint no-undef: 0 */
function infinitePoll(timeout, cb) {
  var finished = false

  function stopPoll() {
    finished = true
  }
  if (finished) {
    return
  }
  cb(function() {
    backendTimeout(function() {
      infinitePoll(timeout, cb)
    }, timeout)
  })
  return stopPoll
}
var dbg = console.log.bind(console, "[Plugin Frontend]")

function forEachWithCallback(array, iterationCb, finishCb) {
  var arr = array.slice()

  function nextCb() {
    if (arr.length != 0) {
      var item = arr.shift()
      iterationCb(item, nextCb)
    } else {
      finishCb()
    }
  }
  nextCb()
}

function poll(maxRetries, timeout, cb, errCb) {
  if (maxRetries < 0) {
    if (errCb) {
      errCb()
      return
    }
    throw Error("Retry limit exceeded")
  }
  cb(function() {
    backendTimeout(function() {
      poll(maxRetries - 1, timeout, cb, errCb)
    }, timeout)
  })
}

function zip(varArgs) {
  var arrays = arraify(arguments)
  return arrays[0].map(function(_, i) {
    return arrays.map(function(array) {
      return array[i]
    })
  })
}

function arrEqual(varArgs) {
  var arrays = arraify(arguments)
  if (arrays.length == 0) {
    return true
  }
  if (arrays.some(function(a) {
    a.length != arrays[0].length
  })) return false
  return !arrays[0].some(function(ele, i) {
    return arrays.some(function(array) {
      return array[i] != ele
    })
  })
}

function pyzip() {
  var args = [].slice.call(arguments)
  var shortest = args.length == 0 ? [] : args.reduce(function(a, b) {
    return a.length < b.length ? a : b
  })
  return shortest.map(function(_, i) {
    return args.map(function(array) {
      return array[i]
    })
  })
}

function chain(functionArray, final) {
  if (functionArray.length == 0) {
    if (final) final()
    return
  }
  var args = [chain.bind(null, functionArray.slice(1), final)].concat(arraify(arguments, 2))
  functionArray[0].apply(null, args)
}

function makeArrayOf(value, length) {
  assert(length < 1e5 && length >= 0, "Length of array too large or too small")
  var arr = [],
    i = length
  while (i--) {
    arr[i] = value
  }
  return arr
}

function assert(val, msg) {
  if (!val) throw Error("AssertionError: " + msg)
}

function merge(o1, o2) {
  var ret = {}
  Object.getOwnPropertyNames(o1).forEach(function(k) {
    ret[k] = o1[k]
  })
  Object.getOwnPropertyNames(o2).forEach(function(k) {
    ret[k] = o2[k]
  })
  return ret
}
module.exports.makeArrayOf = makeArrayOf
module.exports.merge = merge
module.exports.arraify = arraify
module.exports.assert = assert
module.exports.chain = chain
module.exports.zip = zip
module.exports.deepCopy = deepCopy
module.exports.shallowCopy = shallowCopy
module.exports.infinitePoll = infinitePoll
module.exports.poll = poll
module.exports.dbg = dbg
module.exports.forEachWithCallback = forEachWithCallback
module.exports.arrEqual = arrEqual
