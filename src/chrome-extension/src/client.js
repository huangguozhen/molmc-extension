(function(global) {
  module.exports.setupClient = require("./handlers.js").setupClient;
  global.setupClient = module.exports.setupClient;
  module.exports.extentionAvailable = true;
  global.extentionAvailable = true;
  console.log("Client can run setup...")
}).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
