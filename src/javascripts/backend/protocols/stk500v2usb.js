var USBTransaction = require("./usbtransaction").USBTransaction,
			STK500v2Transaction = require("./stk500v2").STK500v2Transaction,
			getLog = require("./../logging").getLog,
			arraify = require("./../util").arraify,
			zip = require("./../util").zip,
			buffer = require("./../buffer"),
			util = require("./../util"),
			errno = require("./../errno");

		function STK500v2UsbTransaction() {
			USBTransaction.apply(this, arraify(arguments));
			this.setupAsBulk();
			this.MAX_READ_LENGTH = 275;
			this.cmdSeq = 1;
			this.device = {
				vendorId: 1003,
				productId: 8452
			};
			this.log = getLog("STK500v2USB");
			this.entryState = "sync";
			this.transfer = this.usb.bulkTransfer.bind(this.usb);
			this.transferIn = this.bulkIn.bind(this);
			this.transferOut = this.bulkOut.bind(this)
		}
		STK500v2UsbTransaction.prototype = Object.create(util.shallowCopy(STK500v2Transaction.prototype));
		STK500v2UsbTransaction.prototype.__proto__.__proto__ = USBTransaction.prototype;
		STK500v2UsbTransaction.prototype.flash = USBTransaction.prototype.flash;
		STK500v2UsbTransaction.prototype.sync = function(cb) {
			var expectedResp = [this.STK2.CMD_SIGN_ON, this.STK2.STATUS_CMD_OK],
				self = this;
			this.writeThenRead([this.STK2.CMD_SIGN_ON], function(data) {
				if (data.toString() == expectedResp.toString()) {
					self.errCb(errno.SYNC_RESPONSE, {
						expected: expectedResp,
						got: data
					});
					return
				}
				self.transition("signedOn")
			})
		};
		STK500v2UsbTransaction.prototype.drain = function(cb) {
			var self = this;
			this.usb.resetDevice(this.handler, function(ok) {
				if (!ok) {
					self.errCb(errno.STK500V2USB_DEVICE_RESET);
					return
				}
				cb()
			})
		};
		STK500v2UsbTransaction.prototype.resetDevice = function(cb) {
			cb()
		};
		STK500v2UsbTransaction.prototype.write = function(data, cb, kwargs) {
			kwargs = kwargs || {};
			var self = this,
				msg = data.slice(0, this.maxPacketSize()),
				outMsg = this.transferOut(msg);
			this.usb.bulkTransfer(this.handler, outMsg, function(outResp) {
				if (!outResp || outResp.resultCode != 0) {
					self.errCb(errno.BULK_TRANSFER, {
						sentMessage: outMsg,
						response: outResp
					});
					return
				}
				if (data.length >= self.maxPacketSize()) {
					self.write(data.slice(self.maxPacketSize()), cb, kwargs);
					return
				}
				cb()
			})
		};
		STK500v2UsbTransaction.prototype.read = function(length, cb, kwargs) {
			var self = this;
			kwargs = kwargs || {};
			if (length > this.maxPacketSize()) {
				self.read(self.maxPacketSize(), function(headPacket) {
					if (headPacket.length < self.maxPacketSize()) {
						cb(headPacket);
						return
					}
					self.read(length - self.maxPacketSize(), function(rest) {
						cb(headPacket.concat(rest))
					}, kwargs)
				}, kwargs);
				return
			}
			var packetSize = this.maxPacketSize(),
				inMsg = this.transferIn(packetSize, kwargs.timeout);
			this.usb.bulkTransfer(self.handler, inMsg, function(inResp) {
				if (!kwargs.silenceErrors && (!inResp || inResp.resultCode != 0)) {
					self.errCb(errno.BULK_RECEIVE, {
						response: inResp
					});
					return
				}
				var ret = buffer.bufToBin(inResp.data);
				cb(ret)
			})
		};
		STK500v2UsbTransaction.prototype.writeThenRead = function(data, cb, kwargs) {
			var self = this;
			this.write(data, function() {
				self.read(self.MAX_READ_LENGTH, function(data) {
					cb(data)
				})
			})
		};
		module.exports.STK500v2UsbTransaction = STK500v2UsbTransaction
