var gulp = require('gulp')
var gulpSequence = require('gulp-sequence')
var webpack = require('webpack')
var webpackConfig = require('./scripts')
var logger = require('../../lib/compileLogger')

gulp.task('scripts:dev', function(cb) {
  webpack(webpackConfig('development'), function(err, stats) {
    logger(err, stats)
    cb()
  })
})

gulp.task('scripts:prod', function(cb) {
  webpack(webpackConfig('production'), function(err, stats) {
    logger(err, stats)
    cb()
  })
})

var chromeDev = function(cb) {
  gulpSequence('chrome:clean', ['chrome:static', 'chrome:images', 'scripts:dev'], cb)
}

var chromeProd = function(cb) {
  gulpSequence('chrome:clean', ['chrome:static', 'chrome:images', 'scripts:prod'], cb)
}

gulp.task('chrome:dev', chromeDev)
gulp.task('chrome:prod', chromeProd)
