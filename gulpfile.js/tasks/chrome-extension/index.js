var gulp         = require('gulp')
var gulpSequence = require('gulp-sequence')

var chromeTask = function(cb) {
  gulpSequence('chrome:manifest', 'chrome:html', 'chrome:images', 'chrome:javascripts', cb)
}

gulp.task('chrome', chromeTask)
module.exports = chromeTask
