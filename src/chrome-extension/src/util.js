/* eslint no-unused-vars: 0 */
function errorThrower (name) {
  return function () {
    throw new Error("No such method: " + name);
  };
}

function arrToBuf(hex) {
  var buffer = new ArrayBuffer(hex.length);
  var bufferView = new Uint8Array(buffer);
  for (var i = 0; i < hex.length; i++) {
    bufferView[i] = hex[i];
  }

  return buffer;
}
module.exports.arrToBuf = arrToBuf;

function bufToArr(bin) {
  var bufferView = new Uint8Array(bin);
  var hexes = [];
  for (var i = 0; i < bufferView.length; ++i) {
    hexes.push(bufferView[i]);
  }
  return hexes;
}
module.exports.bufToArr = bufToArr;

// Get a callable member of this.obj given the name. Dot paths are
// supported.
function path2callable (object, name, callable) {
  var names = name.split('.'),
      method = names.pop(),
      obj = (names.reduce(function (ob, meth) { return ob[meth]; }, object)
             || object),
      self = this;

  if (!obj[method]) {
    console.warn("Tried to resolve bad object path: " + name);
    console.warn("Server:", object);
    return null; // errorThrower(name);
  }

  return obj[method].bind(obj);
};
module.exports.path2callable = path2callable;
