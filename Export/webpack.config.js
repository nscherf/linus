const path = require('path');

module.exports = {
  entry: './src/start.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),

  },
  optimization: {
    minimize: false
},
};