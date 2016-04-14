var path            = require('path')
var pathToUrl       = require('../../lib/pathToUrl')
var webpack         = require('webpack')
var gulp            = require('gulp')
var logger          = require('../../lib/compileLogger')

extensionConfig = function() {
  var jsSrc = path.resolve('src', 'chrome-extension/javascripts')
  var jsDest = path.resolve('public', 'chrome-extension/javascripts')
  var publicPath = pathToUrl('chrome-extension/javascripts', '/')

  var extensions = ['.js', '.json']
  var filenamePattern = '[name].js'

  var webpackConfig = {
    context: jsSrc,
    plugins: [],
    resolve: {
      root: jsSrc,
      extensions: [''].concat(extensions)
    },
    module: {
      loaders: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
          query: {
            "presets": ["es2015", "stage-1"],
            "plugins": []
          }
        }
      ]
    }
  }

  // Karma doesn't need entry points or output settings
  webpackConfig.entry = {
    "host-bundles": ["./host.js"],
    "background": ["./background.js"]
  }

  webpackConfig.output= {
    path: path.normalize(jsDest),
    filename: filenamePattern,
    publicPath: publicPath
  }

  webpackConfig.plugins.push(
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production')
      }
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.NoErrorsPlugin()
  )

  return webpackConfig
}

var javascriptsTask = function(callback) {
  webpack(extensionConfig(), function(err, stats) {
    logger(err, stats)
    callback()
  })
}

gulp.task('chrome:javascripts', javascriptsTask)
module.exports = javascriptsTask
