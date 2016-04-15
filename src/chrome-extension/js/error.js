function withError(apiRoot, error, cb) {
  var unchecked = true;
  apiRoot.runtime = apiRoot.runtime || {};
  Object.defineProperty(apiRoot.runtime, "lastError", {
    configurable: true,
    enumerable: true,
    get: function() {
      unchecked = false;
      return error
    }
  });

  cb();

  Object.defineProperty(apiRoot.runtime, "lastError", {
    configurable: true,
    enumerable: true,
    get: function() {
      unchecked = false;
      return undefined
    }
  });

  if (unchecked && error) {
    console.error("lastError not checked: " + error.message || error)
  }
}

module.exports.withError = withError
