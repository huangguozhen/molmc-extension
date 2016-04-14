function strToUtf8Array(str) {
  var utf8 = [];
  for (var i = 0; i < str.length; i++) {
    var charcode = str.charCodeAt(i);
    if (charcode < 128) utf8.push(charcode);
    else if (charcode < 2048) {
      utf8.push(192 | charcode >> 6, 128 | charcode & 63)
    } else if (charcode < 55296 || charcode >= 57344) {
      utf8.push(224 | charcode >> 12, 128 | charcode >> 6 & 63, 128 | charcode & 63)
    } else {
      i++;
      charcode = 65536 + ((charcode & 1023) << 10 | str.charCodeAt(i) & 1023);
      utf8.push(240 | charcode >> 18, 128 | charcode >> 12 & 63, 128 | charcode >> 6 & 63, 128 | charcode & 63)
    }
  }
  return utf8
}

function utf8ArrayToStr(array) {
  let out, i, len, c;
  // var char2, char3;
  out = "";
  len = array.length;
  i = 0;
  while (i < len) {
    c = array[i++];
    if (c >> 7 == 0) {
      out += String.fromCharCode(c);
      continue
    }
    if (c >> 6 == 2) {
      continue
    }
    var extraLength = null;
    if (c >> 5 == 6) {
      extraLength = 1
    } else if (c >> 4 == 14) {
      extraLength = 2
    } else if (c >> 3 == 30) {
      extraLength = 3
    } else if (c >> 2 == 62) {
      extraLength = 4
    } else if (c >> 1 == 126) {
      extraLength = 5
    } else {
      continue
    }
    if (i + extraLength > len) {
      var leftovers = array.slice(i - 1);
      for (; i < len; i++) {
        if (array[i] >> 6 != 2) break;
      }
      if (i != len) continue;
      return {
        result: out,
        leftovers: leftovers
      }
    }
    var mask = (1 << 8 - extraLength - 1) - 1,
      res = c & mask,
      nextChar, count;
    for (count = 0; count < extraLength; count++) {
      nextChar = array[i++];
      if (nextChar >> 6 != 2) {
        break
      }
      res = res << 6 | nextChar & 63
    }
    if (count != extraLength) {
      i--;
      continue
    }
    if (res <= 65535) {
      out += String.fromCharCode(res);
      continue
    }
    res -= 65536;
    var high = (res >> 10 & 1023) + 55296,
      low = (res & 1023) + 56320;
    out += String.fromCharCode(high, low)
  }
  return {
    result: out,
    leftovers: []
  }
}

module.exports.strToUtf8Array = strToUtf8Array;
module.exports.utf8ArrayToStr = utf8ArrayToStr
