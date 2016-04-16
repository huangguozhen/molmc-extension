var utilModule = require("./util"),
  arraify = utilModule.arraify,
    deepCopy = utilModule.deepCopy,
      chain = utilModule.chain,
        log = require("./logging").getLog("Transaction"),
          ops = require("./protocols/memops"),
            buffer = require("./buffer"),
              scheduler = require("./scheduler"),
                status = require("./status.js"),
                  FiniteStateMachine = require("./fsm.js").FiniteStateMachine,
                    errno = require("./errno");

                    function Transaction(config, finishCallback, errorCallback, parent) {
                      FiniteStateMachine.apply(this, arguments)
                    }
                    Transaction.prototype = Object.create(FiniteStateMachine.prototype);
                    Transaction.prototype.padOrSlice = function(data, offset, length) {
                      var payload;
                      if (offset + length > data.length) {
                        payload = data.slice(offset, data.length);
                        var padSize = length - payload.length;
                        for (var i = 0; i < padSize; ++i) {
                          payload.push(0)
                        }
                      } else {
                        payload = data.slice(offset, offset + length)
                      }
                      return payload
                    };
                    Transaction.prototype.assert = function(bool, varMsg) {
                      var args = arraify(arguments, 1, 2, "AssertionError");
                      if (!bool) {
                        this.cbErr.apply(this, args)
                      }
                    };
                    Transaction.prototype.maybeCheckSignature = function(cb, _bytes) {
                      var self = this,
                        bytes = _bytes || [];
                        if (this.config.skipSignatureCheck) {
                          return cb()
                        }
                        return this.checkSignature(cb, [])
                    };
                    Transaction.prototype.checkSignature = function(cb, bytes) {
                      self = this;
                      this.setStatus(status.CHECK_SIGNATURE);
                      if (bytes.length >= 3) {
                        if (bytes.toString() != self.config.avrdude.signature.toString()) {
                          self.errCb(errno.SIGNATURE_FAIL, {
                            expected: self.config.avrdude.signature,
                            found: bytes
                          });
                          return
                        }
                        cb();
                        return
                      }
                      this.readMemory("signature", bytes.length, function(data) {
                        self.checkSignature(cb, bytes.concat(data))
                      })
                    };
                    Transaction.prototype.writePageInBytes = function(offset, data, cb) {
                      var self = this;
                      if (data.length == 0) {
                        cb();
                        return
                      }
                      this.writeMemory("flash", offset, data[0], function() {
                        self.writePageInBytes(offset + 1, data.slice(1), cb)
                      })
                    };
                    Transaction.prototype.writeMemory = function(mem, addr, val, cb) {
                      var writeOp = "WRITE",
                        self = this,
                          memory = this.config.avrdude.memory[mem];
                          if (memory.paged && memory.memops.LOADPAGE_LO) {
                            writeOp = addr & 1 ? "LOADPAGE_HI" : "LOADPAGE_LO";
                            addr = addr / 2
                          }
                          if (memory.memops.WRITE_LO) {
                            writeOp = addr & 1 ? "WRITE_HI" : "WRITE_LO";
                            addr = addr / 2
                          }
                          var writeByteArr = this.config.avrdude.memory[mem].memops[writeOp],
                            writeCmd = ops.opToBin(writeByteArr, {
                              ADDRESS: addr,
                              INPUT: val
                            });
                            this.cmd(writeCmd, cb)
                    };
                    Transaction.prototype.readMemory = function(mem, addr, cb) {
                      var readOp = "READ",
                        self = this;
                        if (this.config.avrdude.memory[mem].memops.READ_LO) {
                          readOp = addr & 1 ? "READ_HI" : "READ_LO";
                          addr = addr / 2
                        }
                        var readByteArr = this.config.avrdude.memory[mem].memops[readOp],
                          extAddrArr = this.config.avrdude.memory[mem].memops.EXT_ADDR,
                            readCmd = ops.opToBin(readByteArr, {
                              ADDRESS: addr
                            }),
                            extAddrCmd = extAddrArr && ops.opToBin(extAddrArr, {
                              ADDRESS: addr
                            }),
                            maybeSetExtAddr = extAddrCmd ? this.cmd.bind(this, extAddrCmd) : function nop(cb) {
                              cb()
                            };
                            maybeSetExtAddr(function() {
                              self.cmd(readCmd, function(resp) {
                                cb(ops.extractOpData("OUTPUT", readByteArr, resp.data || resp))
                              })
                            })
                    };
                    Transaction.prototype.setupSpecialBits = function(controlBits, cb) {
                      var self = this,
                        knownBits = Object.getOwnPropertyNames(controlBits || {});
                        this.log.log("Will write control bits:", controlBits);
                        chain(knownBits.map(function(memName) {
                          var addr = 0;
                          return function(nextCallback) {
                            if (controlBits[memName] !== null) {
                              function verifyMem(cb) {
                                self.readMemory(memName, addr, function(resp) {
                                  self.log.log("Read memory", memName, ":", buffer.hexRep(resp));
                                  if (resp[0] == controlBits[memName]) {
                                    nextCallback()
                                  } else {
                                    self.errCb(errno.SPECIAL_BIT_MEMORY_VERIFICATION, {
                                      respons: resp,
                                      memName: memName,
                                      controlBits: controlBits[memName]
                                    });
                                    return
                                  }
                                })
                              }
                              self.writeMemory(memName, addr, controlBits[memName], verifyMem)
                            } else {
                              nextCallback()
                            }
                          }
                        }), cb)
                    };
                    Transaction.prototype.operation = function(op, args, cb, cmd) {
                      this.log.log("Running operation:", op);
                      var operation = this.config.avrdude.ops[op];
                      return (cmd || this.cmd.bind(this))(ops.opToBin(operation, args), cb)
                    };
                    Transaction.prototype.maybeChipErase = function(cb, cmd) {
                      if (this.config.chipErase) {
                        return this.chipErase(cb, cmd)
                      }
                      return cb()
                    };
                    Transaction.prototype.chipErase = function(cb, cmd) {
                      var self = this;
                      scheduler.setTimeout(function() {
                        self.operation("CHIP_ERASE", {}, function() {
                          self.transition("setupSpecialBits", self.config.controlBits, cb)
                        }, cmd)
                      }, self.config.avrdude.chipEraseDelay / 1e3)
                    };
                    Transaction.prototype.confirmPages = function(confirmPagesCbs, cb) {
                      var self = this,
                        ccb = confirmPagesCbs[0];
                        if (ccb) {
                          ccb(this.transitionCb("confirmPages", confirmPagesCbs.slice(1), cb))
                        } else {
                          cb()
                        }
                    };
                    module.exports.Transaction = Transaction
