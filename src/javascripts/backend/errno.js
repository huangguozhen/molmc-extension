var uniqueId = 1

function RetVal(value, message, context, id) {
  this.name = null
  this.value = value
  this.message = message
  this.context = context
  this.id = id || uniqueId++
}
RetVal.prototype = {
  copy: function(context) {
    var ret = new RetVal(this.value, this.message, context, this.id)
    ret.name = this.name
    return ret
  },
  shortMessage: function(context, state) {
    var safeContext = {}

    function populateSafelyWith(ctx) {
      Object.getOwnPropertyNames(ctx || {}).forEach(function(p) {
        safeContext[p] = context[p]
        try {
          JSON.stringify(context[p])
        } catch (e) {
          safeContext[p] = "<recursive>"
        }
      })
    }
    populateSafelyWith(this.context)
    populateSafelyWith(context)
    return JSON.stringify({
      name: this.name,
      val: this.value,
      state: state,
      context: safeContext
    })
  }
}

function populatedErrorNames() {
  Object.getOwnPropertyNames(errors).forEach(function(key) {
    errors[key].name = key
  })
  return errors
}
var errors = {
  SUCCESS: new RetVal(0, "Success!"),
  UNKNOWN_ERROR: new RetVal(1, "Unknown error."),
  API_ERROR: new RetVal(1, "Unknown api error."),
  KILLED: new RetVal(2, "Killed by user."),
  PREMATURE_RETURN: new RetVal(1, "Some process returned before it was supposed to."),
  LEONARDO_MAGIC_CONNECT_FAIL: new RetVal(20100, "Failed to connect to magic baudrate."),
  LEONARDO_MAGIC_DISCONNECT_FAIL: new RetVal(20101, "Failed to disconnect from magic baudrate"),
  LEONARDO_DISCONNECT_INITIAL_DEV: new RetVal(20102, "Waited too long for the initial device after a disconnect."),
  LEONARDO_REAPPEAR_TIMEOUT: new RetVal(20103, "Butterfly device never reappeared after magic"),
  BAD_BOOTLOADER: new RetVal(20104, "Butterfly device doesn't seem to have caterina bootloader."),
  LEONARDO_NOT_DISAPPEARED: new RetVal(20105, "Butterfly device did not disappear after disconnect from magic."),
  LEONARDO_DTR_FAIL: new RetVal(20106, "Failed to set dtr to a butterfly device."),
  NONCATERINA_BOOTLOADER_DISCONNECT: new RetVal(20107, "Failed to disconnect before attempting to retry connecting to a bootloader that didn't behave like caterina."),
  OVERLAPPING_TIMEOUTS: new RetVal(20108, "Each transaction should have at most one timeout at a time."),
  HEXFILE_ERROR: new RetVal(20130, "Error during parsing hexfile"),
  HEXFILE_INCOMPLETE: new RetVal(20131, "Expected more hexfile."),
  RESOURCE_BUSY: new RetVal(-22, "Serial monitor seems to be open"),
  RESOURCE_BUSY_FROM_CHROME: new RetVal(-22, "Serial monitor seems to be open by chrome"),
  UNKNOWN_MONITOR_ERROR: new RetVal(20151, "Unrecognized serial monitor error"),
  SERIAL_MONITOR_CONNECT: new RetVal(-55, "Serial monitor failed to connect"),
  SERIAL_MONITOR_WRITE: new RetVal(20153, "Failed to write to serial monitor"),
  SERIAL_MONITOR_DISCONNECT: new RetVal(20154, "Failed to disconnect from serial monitor"),
  SERIAL_MONITOR_PREMATURE_DISCONNECT: new RetVal(20155, "Tried to disconnect from serial monitor before connection was established"),
  SERIAL_MONITOR_WRITE_BEFORE_CONNECT: new RetVal(20156, "Tried to write to a non connected serial monitor"),
  SERIAL_MONITOR_DEVICE_LOST: new RetVal(20157, "Serial monitor lost the connected device."),
  SPAMMING_DEVICE: new RetVal(20010, "Device is too fast for us to handle."),
  LIST_INTERFACES: new RetVal(20170, "Failed to get usb interface list."),
  CLAIM_INTERFACE: new RetVal(20171, "Failed to claim interface."),
  DEVICE_DETECTION: new RetVal(20172, "Chrome app doesn't have device registered."),
  NO_DEVICE: new RetVal(20173, "Couldn't find a suitable device to connect."),
  OPEN_USB_DEVICE: new RetVal(20174, "Failed to open usb device."),
  SET_CONFIGURATION: new RetVal(20175, "Failed to set configuration to device."),
  NO_DEVICE_2: new RetVal(20176, "Api failed to get devices."),
  COMMAND_CHECK: new RetVal(20177, "Bad responce to command."),
  IDLE_HOST: new RetVal(1, "Host seems dead."),
  CONNECTION_FAIL: new RetVal(36e3, "Failed to connect to serial for flashing."),
  DTR_RTS_FAIL: new RetVal(1001, "Failed to set DTR/RTS"),
  READER_TIMEOUT: new RetVal(2e4, "Reader timed out"),
  GET_INFO: new RetVal(20001, "Failed to get info"),
  WRITE_FAIL: new RetVal(20003, "Failed to send to serial port"),
  FLUSH_FAIL: new RetVal(20004, "Failed to flush serial."),
  BUFFER_WRITE_FAIL: new RetVal(20005, "Failed to write received data to internal buffer."),
  FORCE_DISCONNECT_FAIL: new RetVal(20006, "Failed to nuke open connections on port"),
  COMMAND_SIZE_FAIL: new RetVal(20007, "Tried to send mis-sized command (should be 4 bytes)"),
  SIGN_ON_FAIL: new RetVal(20008, "Failed to sign on to device"),
  BAD_RESPONSE: new RetVal(20009, "Received malformed response."),
  PROGRAM_TOO_LARGE: new RetVal(20090, "Tried to flash too large a program"),
  SIGNATURE_FAIL: new RetVal(20092, "Signature check failed."),
  ZOMBIE_TRANSACTION: new RetVal(20091, "Unfinished and unkilled transaction detected."),
  UNSUPPORTED_TPI: new RetVal(20093, "Device is tpi. We don't support that."),
  GET_DEVICES: new RetVal(20094, "Failed to list serial devices."),
  PAGE_CHECK: new RetVal(20095, "Failed page check"),
  PAGE_WRITE_RESPONSE: new RetVal(20096, "Expected different response for page write"),
  STK500V2USB_DEVICE_RESET: new RetVal(20097, "Failed sk500v2usb device reset"),
  BULK_TRANSFER: new RetVal(20098, "Failed sk500v2usb bulk transfer"),
  BULK_RECEIVE: new RetVal(20099, "Failed sk500v2usb bulk receive"),
  ADDRESS_TOO_LONG: new RetVal(202100, "Address exceeds address space"),
  UNDEFINED_COMMAND_PREFIX: new RetVal(202101, "Did not define the command prefix."),
  TRANSFER_ERROR: new RetVal(202102, "Libusb failed to execute command."),
  SPECIAL_BIT_MEMORY_VERIFICATION: new RetVal(202103, "Failed to verify special bit after write."),
  CLOSING_CLOSED_SERIAL: new RetVal(20220, "Serial transaction was already closed."),
  SENDING_ON_CLOSED_SERIAL: new RetVal(20221, "Serial transaction was closed."),
  UPDATE_CLOSED_BUFFER: new RetVal(20222, "Tried to update closed buffer."),
  READ_CLOSED_BUFFER: new RetVal(20223, "Tried to read from closed buffer."),
  RECEIVED_ON_CLOSED_BUFFER: new RetVal(20224, "Tried to write to closed buffer."),
  CLOSE_CLOSED_BUFFER: new RetVal(20225, "Tried to close closed buffer."),
  CLOSE_CLOSED_READ_OPERATION: new RetVal(20226, "Closing closed read operation."),
  MESSAGE_ON_CLOSED_READ_OPERTION: new RetVal(20227, "Got message on closed read operation."),
  DRAIN_CLOSED_CODEC: new RetVal(20228, "Draining a closed codec"),
  CLOSE_CLOSED_CODEC: new RetVal(20229, "Closing a closed codec"),
  SERIAL_RECEIVE_ERROR: new RetVal(20230, "Serial receive error"),
  OVERLAPPED_READ: new RetVal(20230, "Another read is already in progress."),
  PRECONFIGURE_CONNECT: new RetVal(20240, "Failed to connect during preconfiguration"),
  PRECONFIGURE_DISCONNECT: new RetVal(20241, "Failed to disconnect during preconfiguration"),
  SYNC_RESPONSE: new RetVal(20242, "Got bad response trying to sync.")
}
module.exports = populatedErrorNames()
module.exports.RetVal = RetVal
