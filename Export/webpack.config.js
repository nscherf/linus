const path = require('path');

module.exports = {
  entry: './src/LinusStarter.js',
  output: {
    library: 'linuslib',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  optimization: {
    minimize: false
},
};

module.rules = [
    { test: /qrcode/, loader: 'exports-loader?QRCode' }
  ]
