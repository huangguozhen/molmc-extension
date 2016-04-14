var argumentClasses = [];

/**
 * Choose the right *Argument type and create it for arg.
 * @param {anything} arg The raw argument
 * @param {Function} replacingCb A callback to replace arg if it is
 * serialized CallbackArgument.
 * @returns {*Argument} An argument in argumentClasses
 */
function argumentFactory(arg, replacingCb) {
  var classes = argumentClasses.filter(function (ac) {
    return ac.canWrap(arg);
  });

  // At least basic argument will be able to do this.
  return new classes[0](arg, replacingCb);
}

module.exports.argumentFactory = argumentFactory;
module.exports.argumentClasses = argumentClasses;