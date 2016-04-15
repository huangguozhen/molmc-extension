var changed = require('gulp-changed')
var gulp = require('gulp')
var path = require('path')

var paths = {
  src: path.join('src/chrome-extension/{' + ['_locales/**/*', 'manifest.json', 'index.html', 'background.html'] + '}'),
  dest: path.join('public/chrome-extension/')
}

var staticTask = function() {
  return gulp.src(paths.src)
    .pipe(changed(paths.dest))
    .pipe(gulp.dest(paths.dest))
}

gulp.task('chrome:static', staticTask)
module.exports = staticTask
