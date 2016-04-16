/**
 * @fileOverview Responses that can be generated by the host.  Each
 * response is generated ad-hoc so the signature of their constructor
 * is arbitrary but each _type_ has it's own handle method that is
 * executed on the client and accepts the received message, the
 * request generating the response and a callback when we are done
 * handling it.
 * @name responses.js
 * @author Chris Perivolaropulos
 */

module.exports.ErrResponse = require('./responses/error.js')
module.exports.BurstResponse = require('./responses/burst.js')
module.exports.ArgsResponse = require('./responses/arguments.js')
module.exports.AckResponse = require('./responses/ack.js')
module.exports.genericRespHandler = require('./responses/generic.js').genericRespHandler