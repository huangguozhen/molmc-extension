const util = require("./util.js"),
  getLog = require("./../backend/logging.js").getLog,
  scheduler = require("./../backend/scheduler.js");

class LineBuffer {
  constructor(data, unfinishedChar, flushData, expireCb) {
    const self = this;
    this.log = getLog("LineBuffer");

    this.unfinishedChar = unfinishedChar || [];
    this.data = data || "";
    this.flushData = flushData || "";
    this.maxSize = 1e3;
    this.frozen = false;
    this.expired = false;
    if (expireCb) {
      this.expirationTimeout = scheduler.setTimeout(function() {
        if (self.frozen || self.data.length == 0) return;
        self.log.log("Expiring data:", self.data);
        self.expired = true;
        expireCb(self.data)
      }, 100)
    }
  }

  splitLines (str) {
    var finishedLineRx = "(:?.*?(:?\\r\\n|\\n|\\r))",
      unfinishedLineRx = "(:?.+$)",
      fullRx = "(:?" + [finishedLineRx, unfinishedLineRx].join("|") + ")",
      ret = str.match(new RegExp(fullRx, "gm"));
    if (!ret) return [""];
    var lastLine = ret[ret.length - 1];
    if (lastLine[lastLine.length - 1].match(new RegExp(finishedLineRx))) {
      return ret.concat([""])
    }
    return ret
  }

  updated (message, expireCb) {
    var data = this.expired ? "" : this.data,
      parsedMessage = util.utf8ArrayToStr(this.unfinishedChar.concat(message)),
      flushArray = this.splitLines(data + parsedMessage.result),
      newBuffer = flushArray.pop();
    this.freeze();
    if (newBuffer.length > this.maxSize) {
      return new LineBuffer("", parsedMessage.leftovers, flushArray.concat([newBuffer]).join(""), expireCb)
    }
    return new LineBuffer(newBuffer, parsedMessage.leftovers, flushArray.join(""), expireCb)
  }

  freeze () {
    this.frozen = true;
    if (this.expirationTimeout) {
      scheduler.clearTimeout(this.expirationTimeout)
    }
  }
}

module.exports.LineBuffer = LineBuffer
