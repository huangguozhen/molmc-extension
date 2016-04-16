var Transaction = require("./../transaction").Transaction,
			arraify = require("./../util").arraify,
			chain = require("./../util").chain,
			forEachWithCallback = require("./../util").forEachWithCallback,
			MemoryOperations = require("./memops"),
			buffer = require("./../buffer"),
			scheduler = require("./../scheduler"),
			errno = require("./../errno"),
			ops = require("./memops"),
			getLog = require("./../logging").getLog;

		function USBTransaction(config, finishCallback, errorCallback) {
			Transaction.apply(this, arraify(arguments));
			this.parentErrCb = Object.getPrototypeOf(Transaction.prototype).errCb;
			this.log = getLog("USBTransaction");
			this.sck = 10;
			this.endpoints = {};
			if (config) {
				this.usb = this.config.api.usb;
				this.transfer = this.usb.controlTransfer.bind(this.usb)
			}
			this.setupAsControl()
		}
		USBTransaction.prototype = Object.create(Transaction.prototype);
		USBTransaction.prototype.setupAsControl = function() {
			this.transferIn = this.controlIn.bind(this);
			this.transferOut = this.controlOut.bind(this);
			this.setupEndpoints = function(cb) {
				cb()
			};
			this.setConfiguration = function(cb) {
				cb()
			}
		};
		USBTransaction.prototype.setupAsBulk = function() {
			var proto = USBTransaction.prototype;
			this.transferIn = this.bulkIn.bind(this);
			this.transferOut = this.bulkOut.bind(this);
			this.setupEndpoints = proto.setupEndpoints;
			this.setConfiguration = proto.setConfiguration
		};
		USBTransaction.prototype.claimDirection = function(interfaces, direction, cb) {
			var self = this,
				found = interfaces.some(function isGoodIface(iface) {
					return iface.endpoints.some(function isGoodEp(ep) {
						if (ep.direction == direction) {
							self.usb.claimInterface(self.handler, iface.interfaceNumber, function() {
								if (self.config.api.runtime.lastError) {
									self.errCb(errno.CLAIM_INTERFACE, {
										ifaceNumber: iface.interfaceNumber
									});
									return
								}
								cb(ep)
							});
							return true
						}
						return false
					})
				});
			if (!found) cb(null)
		};
		USBTransaction.prototype.setupEndpoints = function(cb) {
			var self = this,
				cbCalled = false,
				interfacesToClaim = 0;

			function claimedInterface() {
				if (self.endpoints.in && self.endpoints.out && !cbCalled) {
					cbCalled = true;
					cb()
				}
			}
			this.usb.listInterfaces(this.handler, function(ifaces) {
				if (!ifaces) {
					self.errCb(errno.LIST_INTERFACES);
					return
				}
				self.claimDirection(ifaces, "in", function(inEp) {
					self.endpoints.in = inEp;
					self.claimDirection(ifaces, "out", function(outEp) {
						self.endpoints.out = outEp;
						cb()
					})
				})
			})
		};
		USBTransaction.prototype.smartOpenDevice = function(device, _nullspeed, _nullmsg, cb) {
			var self = this;
			this.config.api.runtime.getManifestAsync(function(manifest) {
				var knownDevs = manifest.permissions.filter(function(p) {
						return !!p.usbDevices
					}).reduce(function(ret, p) {
						return ret.concat(p.usbDevices)
					}, []),
					canDetect = knownDevs.some(function(d) {
						return device.vendorId == d.vendorId && device.productId == d.productId
					});
				if (!canDetect) {
					self.errCb(errno.DEVICE_DETECTION, {
						device: device,
						knownDevices: knownDevs
					});
					return
				}
				self.usb.getDevices(device, function(devs) {
					if (!devs) {
						self.errCb(errno.GET_DEVICES);
						return
					}
					if (devs.length == 0) {
						self.errCb(errno.NO_DEVICE, {
							searchedFor: device
						});
						return
					}
					self._usedDevice = device;
					self.openDevice(devs.pop(), cb)
				})
			})
		};
		USBTransaction.prototype.openDevice = function(dev, cb) {
			var self = this;
			this.usb.openDevice(dev, function(hndl) {
				var _callback = function() {
					self.setupEndpoints(function() {
						self.log.log("Endpoints:", self.endpoints);
						cb(hndl)
					})
				};
				if (!hndl) {
					self.errCb(errno.OPEN_USB_DEVICE, {
						device: dev
					});
					return
				}
				self.handler = hndl;
				var _getConfs = typeof self.usb.getConfigurations === "function" ? self.usb.getConfigurations.bind(self.usb.api) : function(_, cb) {
					cb()
				};
				_getConfs(dev, function(confs) {
					var typedConfs = typeof confs !== "undefined" ? confs.map(function(c) {
						return c.configurationValue
					}) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
					if (self.config.api.runtime.lastError) {
						self.log.log("Looks like you have chrome < 47.", "Upgrade to make better use of the API")
					}
					self.setConfiguration(_callback, typedConfs)
				})
			})
		};
		USBTransaction.prototype.setAGoodConf = function(configurations, cb, collectedErrors) {
			var confVal = configurations[0],
				self = this;
			if (configurations.length <= 0) {
				self.log.warn("Tried all available configurations and failed.", "Let's hope this works. Errors:", collectedErrors);
				cb();
				return
			}
			self.usb.setConfiguration(self.handler, configurations[0], function() {
				if (!self.config.api.runtime.lastError) {
					self.log.log("Configuration set to:", confVal);
					self.configurationValue = confVal;
					cb();
					return
				}
				collectedErrors.push(self.config.api.runtime.lastError.message);
				self.setAGoodConf(configurations.slice(1), cb, collectedErrors)
			})
		};
		USBTransaction.prototype.setConfiguration = function(cb, configurations) {
			var self = this,
				collectedErrors = [];
			this.usb.getConfiguration(this.handler, function(conf) {
				if (self.config.api.runtime.lastError) {
					collectedErrors.push(self.config.api.runtime.lastError.message)
				}
				self.setAGoodConf(configurations, cb, collectedErrors)
			})
		};
		USBTransaction.prototype.xferMaybe = function(info, callback) {
			var self = this;
			if (this.config.dryRun) {
				callback({
					data: [222, 173, 190, 239]
				});
				return
			}
			self.xfer(info, callback)
		};
		USBTransaction.prototype.cmd = function(cmd, cb) {
			if (typeof this.cmdFunction === "undefined") {
				this.errCb(errno.UNDEFINED_COMMAND_PREFIX);
				return
			}
			var self = this,
				info = this.transferIn(this.cmdFunction, cmd[1] << 8 | cmd[0], cmd[3] << 8 | cmd[2], 4);
			this.xferMaybe(info, function(resp) {
				self.log.log("CMD:", buffer.hexRep(cmd), buffer.hexRep(resp.data));
				cb({
					data: resp.data
				})
			})
		};
		USBTransaction.prototype.control = function(op, v1, v2, cb) {
			this.xfer(this.transferIn(op, v1, v2, 4), cb)
		};
		USBTransaction.prototype.errCb = function(err, ctx) {
			var self = this,
				context = ctx || {};
			if (!this.usb || !this._usedDevice) {
				this.parentErrCb(err, ctx);
				return
			}
			this.usb.getDevices(this._usedDevice, function(devs) {
				if (devs.length <= 0) {
					context.lostDevice = true;
					self.finalError(err, context);
					return
				}
				self.parentErrCb(err, ctx)
			})
		};
		USBTransaction.prototype.localCleanup = function(cb) {
			this.disconnect(cb)
		};
		USBTransaction.prototype.disconnect = function(callback) {
			if (this.handler) {
				this.usb.closeDevice(this.handler, callback);
				this._usedDevice = null;
				this.handler = null;
				return
			}
			callback()
		};
		USBTransaction.prototype.flash = function(_, sketchData) {
			var self = this,
				smartOpen = {
					state: "smartOpenDevice",
					retries: 3,
					retryInterval: 1e3
				};
			this.refreshTimeout();
			this.sketchData = sketchData;
			this.transition(smartOpen, this.device, null, null, function(hndl) {
				self.handler = hndl;
				self.transition(self.entryState)
			})
		};
		USBTransaction.prototype.xfer = function(info, cb) {
			var self = this;
			this.log.log("Performing control transfer", info.direction, buffer.hexRep([info.request, info.value, info.index]), "len:", info.length);
			if (info.direction == "out") {
				this.log.log("Data:", buffer.hexRep(buffer.bufToBin(info.data)))
			}
			this.refreshTimeout();
			scheduler.setImmediate(function() {
				self.transfer(self.handler, info, function(arg) {
					if (!arg || arg.resultCode != 0) {
						self.errCb(errno.TRANSFER_ERROR, {
							response: arg,
							request: info
						});
						return
					}
					arg.data = buffer.bufToBin(arg.data);
					self.log.log("Response was:", arg);
					cb(arg)
				})
			})
		};
		USBTransaction.prototype.controlOut = function(op, value, index, data) {
			return {
				recipient: "device",
				direction: "out",
				requestType: "vendor",
				request: op,
				value: value,
				index: index,
				timeout: 5e3,
				data: buffer.binToBuf(data || []),
				length: data ? data.length : 0
			}
		};
		USBTransaction.prototype.controlIn = function(op, value, index, length) {
			return {
				recipient: "device",
				direction: "in",
				requestType: "vendor",
				request: op,
				index: index,
				value: value,
				timeout: 5e3,
				length: length || 0
			}
		};
		USBTransaction.prototype.bulkOut = function(msg, timeout) {
			if (msg.length > this.endpoints.out.maximumPacketSize) {
				this.log.error("Sending too large a packet:", msg.length, " > ", this.endpoints.out.maximumPacketSize)
			}
			return {
				direction: "out",
				endpoint: this.endpoints.out.address,
				data: buffer.binToBuf(msg),
				timeout: timeout || 1e4
			}
		};
		USBTransaction.prototype.bulkIn = function(length, timeout) {
			if (length > this.endpoints.in.maximumPacketSize) {
				this.log.error("Requested too large a packet:", length, " > ", this.endpoints.in.maximumPacketSize)
			}
			return {
				direction: "in",
				endpoint: this.endpoints.in.address,
				length: length,
				timeout: timeout || 1e4
			}
		};
		USBTransaction.prototype.maxPacketSize = function(length) {
			var min = 64;
			if (typeof this.maxXfer === "undefined" && this.maxXfer < min) {
				min = this.maxXfer
			}
			if (this.endpoints.in && this.endpoints.in.maximumPacketSize < min) {
				min = this.endpoints.in.maximumPacketSize
			}
			if (this.endpoints.out && this.endpoints.out.maximumPacketSize < min) {
				min = this.endpoints.out.maximumPacketSize
			}
			return min
		};
		module.exports.USBTransaction = USBTransaction
