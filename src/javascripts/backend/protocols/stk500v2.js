var SerialTransaction = require("./serialtransaction").SerialTransaction,
			getLog = require("./../logging").getLog,
			arraify = require("./../util").arraify,
			zip = require("./../util").zip,
			util = require("./../util"),
			scheduler = require("./../scheduler"),
			memops = require("./memops"),
			Stk500v2CodecSocket = require("./../io/stk500v2codec.js").Stk500v2CodecSocket,
			ioutil = require("./../io/util.js"),
			status = require("./../status.js"),
			errno = require("./../errno");

		function STK500v2Transaction() {
			SerialTransaction.apply(this, arraify(arguments));
			this.log = getLog("STK500v2");
			this.cmdSeq = 1;
			this.codecsocketClass = Stk500v2CodecSocket
		}
		STK500v2Transaction.prototype = Object.create(SerialTransaction.prototype);
		STK500v2Transaction.prototype.STK2 = {
			CMD_SIGN_ON: 1,
			CMD_SET_PARAMETER: 2,
			CMD_GET_PARAMETER: 3,
			CMD_SET_DEVICE_PARAMETERS: 4,
			CMD_OSCCAL: 5,
			CMD_LOAD_ADDRESS: 6,
			CMD_FIRMWARE_UPGRADE: 7,
			CMD_CHECK_TARGET_CONNECTION: 13,
			CMD_LOAD_RC_ID_TABLE: 14,
			CMD_LOAD_EC_ID_TABLE: 15,
			CMD_ENTER_PROGMODE_ISP: 16,
			CMD_LEAVE_PROGMODE_ISP: 17,
			CMD_CHIP_ERASE_ISP: 18,
			CMD_PROGRAM_FLASH_ISP: 19,
			CMD_READ_FLASH_ISP: 20,
			CMD_PROGRAM_EEPROM_ISP: 21,
			CMD_READ_EEPROM_ISP: 22,
			CMD_PROGRAM_FUSE_ISP: 23,
			CMD_READ_FUSE_ISP: 24,
			CMD_PROGRAM_LOCK_ISP: 25,
			CMD_READ_LOCK_ISP: 26,
			CMD_READ_SIGNATURE_ISP: 27,
			CMD_READ_OSCCAL_ISP: 28,
			CMD_SPI_MULTI: 29,
			CMD_XPROG: 80,
			CMD_XPROG_SETMODE: 81,
			STATUS_CMD_OK: 0,
			STATUS_CMD_TOUT: 128,
			STATUS_RDY_BSY_TOUT: 129,
			STATUS_SET_PARAM_MISSING: 130,
			STATUS_CMD_FAILED: 192,
			STATUS_CKSUM_ERROR: 193,
			STATUS_CMD_UNKNOWN: 201,
			MESSAGE_START: 27,
			TOKEN: 14
		};
		STK500v2Transaction.prototype.cmd = function(cmd, cb) {
			if (cmd.length != 4) {
				this.errCb(errno.COMMAND_SIZE_FAIL, {
					receivedCmd: cmd
				});
				return
			}
			var buf = [this.STK2.CMD_SPI_MULTI, 4, 4, 0].concat(cmd);
			this.writeThenRead(buf, function(resp) {
				cb(resp.slice(2, 6))
			})
		};
		STK500v2Transaction.prototype.flash = function(deviceName, sketchData) {
			this.refreshTimeout();
			this.sketchData = sketchData;
			this.deviceName = deviceName;
			var self = this;
			var smartOpen = {
				state: "smartOpenDevice",
				retries: 3,
				retryInterval: 1e3
			};
			this.setStatus(status.CONNECTING, {
				device: deviceName
			});
			this.transition(smartOpen, deviceName, this.config.speed, {
				request: [this.STK2.CMD_SIGN_ON],
				response: [self.STK2.CMD_SIGN_ON, self.STK2.STATUS_CMD_OK]
			}, this.transitionCb({
				state: "signedOn",
				retries: 10,
				waitBefore: 200,
				retryInterval: 0
			}))
		};
		STK500v2Transaction.prototype.signedOn = function() {
			var timeout = 200,
				stabDelay = 100,
				cmdExecDelay = 25,
				syncHLoops = 32,
				byteDelay = 0,
				pollValue = 83,
				pollIndex = 3,
				pgmEnable = [172, 83, 0, 0],
				nextStep = this.transitionCb("postSignOn");
			this.writeThenRead([this.STK2.CMD_ENTER_PROGMODE_ISP, timeout, stabDelay, cmdExecDelay, syncHLoops, byteDelay, pollValue, pollIndex].concat(pgmEnable), nextStep)
		};
		STK500v2Transaction.prototype.postSignOn = function(cb) {
			var self = this,
				programFlash = this.transitionCb("programFlash", this.config.avrdude.memory.flash.page_size);

			function eraseCmd(cmd, cb) {
				var buf = [self.STK2.CMD_CHIP_ERASE_ISP, self.config.avrdude.chipEraseDelay / 1e3, 0].concat(cmd);
				self.writeThenRead(buf, cb)
			}
			this.transition("maybeCheckSignature", this.transitionCb("maybeChipErase", programFlash, eraseCmd))
		};
		STK500v2Transaction.prototype.preProgramHack = function(offset, pgSize) {
			this.cmdChain([
				[48, 0, 0, 0],
				[48, 0, 1, 0],
				[48, 0, 2, 0],
				[160, 15, 252, 0],
				[160, 15, 253, 0],
				[160, 15, 254, 0],
				[160, 15, 255, 0]
			], this.transitionCb("programFlash", pgSize || 256))
		};
		STK500v2Transaction.prototype.programFlash = function(pageSize) {
			this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("checkPages", pageSize), this.sketchData.min())
		};
		STK500v2Transaction.prototype.checkPages = function(pageSize) {
			var self = this;

			function writeAndRecheck(retryCb, offset, payload, done) {
				self.writePage(offset, payload, retryCb)
			}
			this.sketchData.tile(this.transitionCb({
				state: "checkPage",
				fallbackCb: writeAndRecheck,
				retries: 10
			}), pageSize, this.transitionCb("maybeCleanupBits"), this.sketchData.min())
		};
		STK500v2Transaction.prototype.maybeCleanupBits = function(pageSize) {
			this.setupSpecialBits(this.config.cleanControlBits, this.transitionCb("doneProgramming"))
		};
		STK500v2Transaction.prototype.doneProgramming = function() {
			var self = this;
			self.writeThenRead([17, 1, 1], function(data) {
				self.setStatus(status.CLEANING_UP);
				self.transition("disconnect", function() {
					self.cleanup(function() {
						scheduler.setTimeout(self.finishCallback, 1e3)
					})
				})
			})
		};
		STK500v2Transaction.prototype.writePage = function(offset, payload, done) {
			var self = this;
			this.writeThenRead(this.addressMsg(offset), function(reponse) {
				self.writeThenRead(self.writeMsg(payload), function(response) {
					if (response[0] != 19 || response[1] != 0) {
						self.errCb(errno.PAGE_WRITE_RESPONSE, {
							deviceResponse: response,
							expectedResponse: [19, 0]
						});
						return
					}
					done()
				})
			})
		};
		STK500v2Transaction.prototype.checkPage = function(offset, payload, done) {
			var self = this,
				index = 0;
			this.writeThenRead(this.addressMsg(offset), function(reponse) {
				self.writeThenRead(self.readMsg(payload.length), function(response) {
					response = response.slice(2);
					response.pop();
					if (response.length != payload.length || response.some(function(v, i) {
							index = i;
							return v != payload[i]
						})) {
						self.errCb(errno.PAGE_CHECK, {
							devPage: response,
							hostPage: payload,
							pageOffset: offset
						});
						return
					}
					done()
				}, {
					minPureData: 2 + payload.length + 1
				})
			})
		};
		STK500v2Transaction.prototype.readMsg = function(size) {
			var readCmds = memops.opToBin(this.config.avrdude.memory.flash.memops.READ_LO),
				sizeBytes = ioutil.storeAsTwoBytes(size);
			return [this.STK2.CMD_READ_FLASH_ISP, sizeBytes[0], sizeBytes[1], readCmds[0]]
		};
		STK500v2Transaction.prototype.addressMsg = function(address) {
			var addressBytes = ioutil.storeAsFourBytes(address / 2);
			if (this.config.avrdude.memory.flash.memops.LOAD_EXT_ADDR) addressBytes[0] |= 128;
			return [this.STK2.CMD_LOAD_ADDRESS].concat(addressBytes)
		};
		STK500v2Transaction.prototype.writeMsg = function(payload) {
			var sizeBytes = ioutil.storeAsTwoBytes(payload.length),
				memMode = 193,
				delay = 10,
				loadpageLoCmd = 64,
				writepageCmd = 76,
				avrOpReadLo = 32;
			return [this.STK2.CMD_PROGRAM_FLASH_ISP, sizeBytes[0], sizeBytes[1], memMode, delay, loadpageLoCmd, writepageCmd, avrOpReadLo, 0, 0].concat(payload)
		};
		module.exports.STK500v2Transaction = STK500v2Transaction
