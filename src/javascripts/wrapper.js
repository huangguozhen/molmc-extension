function PropertyDescriptor(element, prop) {
  var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), prop);
  if (desc) {
    Object.getOwnPropertyNames(desc).forEach(function(pp) {
      if (pp != "value" && true) {
        console.log(prop + "[" + pp + "]");
        this[pp] = element[pp]
      }
    })
  }

  throw Error("Could not determine property descruptor of plugin property '" + prop);

  /* eslint no-unreachable: 0 */
  this.get = function() {
    return element[prop]
  };

  this.set = function(val) {
    element[prop] = val
  }
}

function prototypeProperties(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
}

function wrap(wrapper, obj) {
  prototypeProperties(obj).forEach(function(attr) {
    if (typeof wrapper[attr] !== "undefined") {
      return
    }
    if (obj[attr] instanceof Function) {
      wrapper[attr] = obj[attr].bind(obj);
      return
    }
    var descr = new PropertyDescriptor(obj, attr);
    Object.defineProperty(wrapper, attr, descr)
  })
}

module.exports.wrap = wrap
