var argumentClasses = require('./factory.js').argumentClasses,
    DatabufferArgument = require('./databuffer.js');

function DataArgument(arg) {
  if (!DataArgument.canWrap(arg)) {
    throw new Error("Expected object like {data: ArrayBuffer}, got: ", arg);
  }
  this.arg = arg;
  this.data = new DatabufferArgument(arg.data);
}

DataArgument.canWrap = function (arg) {
  return arg instanceof Object &&
    DatabufferArgument.canWrap(arg.data);
};

DataArgument.prototype = {
  argCopy: function () {
    var ret = {}, self = this;
    Object.getOwnPropertyNames(this.arg).forEach(function (k) {
      ret[k] = self.arg[k];
    });

    return ret;
  },

  /**
   * @returns {Object} What the API expects or what is expected by
   * the API.
   */
  forCalling: function () {
    var ret = this.argCopy();
    ret.data = this.data.forCalling();
    return ret;
  },

  /**
   * @returns {Object} An serializable object that we can turn back
   * into a databuffer container.
   */
  forSending: function () {
    var ret = this.argCopy();
    ret.data = this.data.forSending();
    return ret;
  },

  concat: function (msg) {
    if (!msg.data || !msg.data.isArrayBuffer) return this;
    var ret = this.forSending();
    ret.data = this.data.concat(msg.data).forSending();
    return new DataArgument(ret);
  }
};
argumentClasses.push(DataArgument);
module.exports = DataArgument;