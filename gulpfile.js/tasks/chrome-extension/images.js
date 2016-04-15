var changed = require('gulp-changed')
var gulp = require('gulp')
var imagemin = require('gulp-imagemin')
var path = require('path')

var paths = {
  src: path.join('src/chrome-extension/img/**/*{' + ['png', 'jpg', 'gif'] + '}'),
  dest: path.join('public/chrome-extension/images/')
}

var imagesTask = function() {
  return gulp.src(paths.src)
    .pipe(changed(paths.dest)) // Ignore unchanged files
    .pipe(imagemin()) // Optimize
    .pipe(gulp.dest(paths.dest))
}

gulp.task('chrome:images', imagesTask)
module.exports = imagesTask
