var gulp = require('gulp')
var del = require('del')

var cleanTask = function (cb) {
  del('public/chrome-extension').then(function (paths) {
    cb()
  })
}

gulp.task('chrome:clean', cleanTask)
module.exports = cleanTask
