var changed = require('gulp-changed')
var gulp    = require('gulp')
var path    = require('path')

var paths = {
  src: path.join('src/chrome-extension/manifest.json'),
  dest: path.join('public/chrome-extension/')
}

var manifestTask = function() {
  return gulp.src(paths.src)
    .pipe(changed(paths.dest)) // Ignore unchanged files
    .pipe(gulp.dest(paths.dest))
}

gulp.task('chrome:manifest', manifestTask)
module.exports = manifestTask
