var gulp = require('gulp')
var htmlmin = require('gulp-htmlmin')
var handleErrors = require('../../lib/handleErrors')
var path = require('path')

var paths = {
  src: [path.join('src/chrome-extension/html', '/**/*.html' )],
  dest: path.join('public/chrome-extension/html')
}

var htmlTask = function() {
  return gulp.src(paths.src)
    .pipe(gulp.dest(paths.dest))

}

gulp.task('chrome:html', htmlTask)
module.exports = htmlTask
