var path = require('path')
var pathToUrl = require('../../lib/pathToUrl')
var webpack = require('webpack')
var gulp = require('gulp')
var logger = require('../../lib/compileLogger')

var extensionConfig = function(env) {
  var jsSrc = path.resolve('src', 'chrome-extension/src')
  var jsDest = path.resolve('public', 'chrome-extension/bundles')
  var publicPath = pathToUrl('chrome-extension/bundles', '/')

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

  if (env == 'development') {
    webpackConfig.devtool = 'inline-source-map'
  } else {
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
  }

  // Karma doesn't need entry points or output settings
  webpackConfig.entry = {
    "app": ["./host.js"],
    "background": ["./background.js"]
  }

  webpackConfig.output = {
    path: path.normalize(jsDest),
    filename: filenamePattern,
    publicPath: publicPath
  }

  return webpackConfig
}

var javascriptsTask = function(callback) {
  webpack(extensionConfig('production'), function(err, stats) {
    logger(err, stats)
    callback()
  })
}

gulp.task('chrome:scripts', javascriptsTask)
module.exports = javascriptsTask
