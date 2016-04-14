/**
 * @fileOverview Abstractions for handling argument transformation for
 * transportation between host-client.
 * @name arguments.js
 * @author Chris Perivolaroulos
 */

// The sorting below will be reflected.
module.exports.CallbackArgument = require('./arguments/callback.js');
module.exports.DataArgument = require('./arguments/data.js');
module.exports.DatabufferArgument = require('./arguments/databuffer.js');
module.exports.BasicArgument = require('./arguments/basic.js');
module.exports.Arguments = require('./arguments/container.js');
module.exports.argumentFactory = require('./arguments/factory.js').argumentFactory;
module.exports.argumentClasses = require('./arguments/factory.js').argumentClasses;