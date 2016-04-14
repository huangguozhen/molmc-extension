function isOldstyleGetManifest (message) {
  // Here is an exemplary oldstyle message:
  //
  // {
  //     timestamp: 1435930180385,
  //     object: "runtime",
  //     method: "getManifestAsync",
  //     args: {
  //       args: [{
  //         type: "function"
  //       }]
  //     },
  //     error: null,
  //     callbackId: 1435930180385,
  //     sender: 1435930180385
  //   }

  return message &&
    message.method == "getManifestAsync" &&
    message.object == "runtime" &&
    message.callbackId;
}


function getState (apiRoot, state, cb) {
  var formattedState = apiRoot.runtime.getManifest();
  formattedState.connections = state.connections.map(function (c) {
    return c && {
      bufferLength: c.bufferLength,
      conf: c.portConf,
      id: c.id,
      closed: c.closed
    };
  }),

  formattedState.keepalives = state.keepalives.map(function (k) {
    return k && {
      clientId: k.clientId,
      conf: k.portConf,
      closed: k.closed
    };
  }),

  cb(formattedState);
};

function setupAdHoc (state) {
  var apiRoot = state.apiRoot;

  // Remember to add these to the client configuration.
  if (apiRoot.runtime) {
    if (!apiRoot.babelfish) apiRoot.babelfish = {};
    apiRoot.babelfish.getState =
      apiRoot.runtime.getManifestAsync =
      getState.bind(null, apiRoot, state);


    // Listen for get state to non-babelfish or early babelfish.
    function provideState (msg, sendResp) {
      if (msg && (msg.method == "getState" || isOldstyleGetManifest(msg))) {
        apiRoot.babelfish.getState(sendResp);
        return false;
      }

      return true;
    };

    state.bootstrapHost.commands.push(provideState);
  }

  if (apiRoot.serial) {
    apiRoot.serial.onReceiveError.forceDispatch = function (info) {
      state.connections.forEach(function (c) {
        if (c.apiEvent.methodName == 'serial.onReceiveError.addListener') {
          c.apiEvent.methodRequest.realCallback().call(null, info);
        }
      });
    };
  }
}

module.exports.setupAdHoc = setupAdHoc;