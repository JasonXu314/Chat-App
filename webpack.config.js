const path = require('path');
module.exports = {
  entry: './src/server-test.js',
  output: {
    filename: 'server.js',
    path: path.resolve(__dirname, 'dist')
  }
};