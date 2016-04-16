var config = require('../config')
var ghPages = require('gulp-gh-pages')
var gulp = require('gulp')
var open = require('open')
var os = require('os')
var packages = require('../../package.json')
var path = require('path')

var settings = {
  url: packages.homepage,
  src: path.join(config.root.dest, '/**/*'),
  ghPages: {
    cacheDir: path.join(os.tmpdir(), packages.name)
  }
}

var deployTask = function() {
  return gulp.src(settings.src)
    .pipe(ghPages(settings.ghPages))
    .on('end', function() {
      open(settings.url)
    })
}

gulp.task('deploy', ['production'], deployTask)
module.exports = deployTask
