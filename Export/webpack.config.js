const path = require('path');

module.exports = {
  entry: './src/LinusStarter.js',
  output: {
    library: 'linuslib',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  optimization: {
    minimize: true
  },
  devServer: {
    contentBase: path.join(__dirname, ''),
    compress: true,
    port: 9000
  }
};

module.rules = [
    { test: /qrcode/, loader: 'exports-loader?QRCode' }
  ]
