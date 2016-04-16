var USBTransaction = require("./usbtransaction").USBTransaction,
			util = require("./../util"),
			arraify = util.arraify,
			ops = require("./memops"),
			buffer = require("./../buffer"),
			errno = require("./../errno"),
			getLog = require("./../logging").getLog;

		function USBTinyTransaction(config, finishCallback, errorCallback) {
			var self = this;
			USBTransaction.apply(this, arraify(arguments));
			this.setupAsControl();
			this.UT = {
				ECHO: 0,
				READ: 1,
				WRITE: 2,
				CLR: 3,
				SET: 4,
				POWERUP: 5,
				POWERDOWN: 6,
				SPI: 7,
				POLL_BYTES: 8,
				FLASH_READ: 9,
				FLASH_WRITE: 10,
				EEPROM_READ: 11,
				EEPROM_WRITE: 12,
				RESET_LOW: 0,
				RESET_HIGH: 1
			};
			this.entryState = "programEnable";
			this.cmdFunction = this.UT.SPI;
			this.device = {
				productId: 3231,
				vendorId: 6017
			};
			this.log = getLog("USBTinyISP");

			function rewriteThenCheck(retry, offset, payload, cb) {
				self.transition(self.writePageTransitionConf, offset, payload, retry)
			}

			function writeInBytes(retry, offset, payload, cb) {
				self.transition("writePageInBytes", offset, payload, cb)
			}
			this.writePageTransitionConf = {
				state: "writePage",
				fallbackCb: writeInBytes,
				retries: 20,
				retryInterval: 0
			};
			this.checkPageTransitionConf = {
				state: "checkPage",
				fallbackCb: rewriteThenCheck,
				retries: 5,
				retryInterval: 500
			}
		}
		USBTinyTransaction.prototype = Object.create(USBTransaction.prototype);
		USBTinyTransaction.prototype.cmd = function(cmd, cb) {
			var superProto = Object.getPrototypeOf(Object.getPrototypeOf(this)),
				self = this;
			superProto.cmd.call(this, cmd, function(resp) {
				if (!ops.checkMask([null, null, cmd[1], null], resp.data)) {
					self.errCb(errno.COMMAND_CHECK, {
						cmd: cmd,
						resp: resp.data
					});
					return
				}
				cb(resp)
			})
		};
		USBTinyTransaction.prototype.programEnable = function() {
			var cb, self = this;
			if (!this.chipErased) {
				this.chipErased = true;
				cb = function() {
					self.transition("maybeCheckSignature", self.transitionCb("maybeChipErase", self.transitionCb("programEnable")))
				}
			} else {
				cb = this.transitionCb("writePages")
			}
			this.control(this.UT.POWERUP, this.sck, this.UT.RESET_LOW, function() {
				self.log.log("Powered up. Enabling...");
				self.operation("PGM_ENABLE", {}, cb)
			})
		};
		USBTinyTransaction.prototype.writePage = function(offset, payload, done) {
			var info = this.transferOut(this.UT.FLASH_WRITE, 0, offset, payload),
				writePageCmd = this.config.avrdude.memory.flash.memops.WRITEPAGE,
				flushCmd = ops.opToBin(writePageCmd, {
					ADDRESS: offset / 2
				}),
				self = this;
			this.xferMaybe(info, function() {
				self.cmd(flushCmd, done)
			})
		};
		USBTinyTransaction.prototype.checkPage = function(offset, payload, done) {
			var info = this.transferIn(this.UT.FLASH_READ, 0, offset, payload.length),
				self = this;
			this.xfer(info, function(devData) {
				if (devData.data.some(function(b, i) {
						return b != payload[i]
					})) {
					self.errCb(errno.PAGE_CHECK, {
						devPage: devData.data,
						hostPage: payload,
						pageOffset: offset
					});
					return
				}
				done()
			})
		};
		USBTinyTransaction.prototype.writePages = function() {
			var pageSize = this.config.avrdude.memory.flash.page_size;
			this.sketchData.tile(this.transitionCb(this.writePageTransitionConf), pageSize, this.transitionCb("checkPages"), this.sketchData.min())
		};
		USBTinyTransaction.prototype.checkPages = function() {
			var pageSize = this.config.avrdude.memory.flash.page_size;
			this.sketchData.tile(this.transitionCb(this.checkPageTransitionConf), pageSize, this.transitionCb("powerDown"), this.sketchData.min())
		};
		USBTinyTransaction.prototype.powerDown = function() {
			var self = this;
			this.setupSpecialBits(this.config.cleanControlBits, function() {
				self.control(self.UT.POWERDOWN, 0, 0, self.transitionCb("endTransaction"))
			})
		};
		USBTinyTransaction.prototype.endTransaction = function(ctrlArg) {
			var self = this;
			this.cleanup(this.finishCallback)
		};
		module.exports.USBTinyTransaction = USBTinyTransaction
