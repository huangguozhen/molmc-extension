/* eslint no-unused-vars: 0 */
const server = require('./server.js'),
  srv = new server.HostServer(chrome)
window.api = server
console.log('Serving...')
