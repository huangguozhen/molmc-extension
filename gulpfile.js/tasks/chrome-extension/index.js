var gulp = require('gulp')
var gulpSequence = require('gulp-sequence')

var chromeTask = function(cb) {
  gulpSequence('chrome:clean', 'chrome:static', 'chrome:images', 'chrome:scripts', cb)
}

gulp.task('chrome', chromeTask)
module.exports = chromeTask
