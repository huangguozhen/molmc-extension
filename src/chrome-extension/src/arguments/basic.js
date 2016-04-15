var argumentClasses = require('./factory.js').argumentClasses;

/**
 * An already serializable argument boxer.
 * @param {argument} arg
 */
function BasicArgument(arg) {
  this.value = arg;
}
/**
 * Wether we can wrap. We assume we always can.
 * @param {anything} arg
 * @returns {Boolean} Always true.
 */
BasicArgument.canWrap = function (arg) {
  return true;
};

BasicArgument.prototype = {
  /**
   * @returns {anything} Just return the value.
   */
  forCalling: function () {
    return this.value;
  },

  /**
   * @returns {anything} Just return the value.
   */
  forSending: function () {
    return this.value;
  }
};
argumentClasses.push(BasicArgument);
module.exports = BasicArgument;
