var argumentClasses = require('./factory.js').argumentClasses,
    util = require('../util.js');
/**
 * Boxing for databuffers.
 *
 * @param {DataBuffer|Object} arg Either a databuffer or a serialized
 * databuffer object.
 * @throws {Error} Protects you in case you forgot to call canWrap
 */
function DatabufferArgument(arg) {
  if (!DatabufferArgument.canWrap(arg)) {
    throw Error("Cant wrap argument " + arg + " as a databuffer");
  }

  this.buffer = arg instanceof ArrayBuffer ? arg : null;
  this.obj = arg.isArrayBuffer ? arg : null;
}

/**
 * Check if the object is eithe a databuffer or a serialized databuffer
 *
 * @param {anything} arg The object to check
 * @returns {Boolean} True if we can wrap.
 */
DatabufferArgument.canWrap = function (arg) {
  return arg && ((arg instanceof ArrayBuffer) || arg.isArrayBuffer);
};

DatabufferArgument.prototype = {
  /**
   * @returns {DataBuffer} What the API expects or what is expected by
   * the API.
   */
  forCalling: function () {
    return this.buffer || util.arrToBuf(this.obj.data);
  },

  /**
   * @returns {Object} An serializable object that we can turn back
   * into a DataBuffer.
   */
  forSending: function () {
    return this.obj || {data: util.bufToArr(this.buffer),
                        isArrayBuffer: true};
  },

  concat: function (msg) {
    if (!msg.isArrayBuffer) return this;
    var ret = this.forSending();
    ret.data = ret.data.concat(msg.data);
    return new DatabufferArgument(ret);
  }
};
argumentClasses.push(DatabufferArgument);
module.exports = DatabufferArgument;