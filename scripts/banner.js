const pkg = require('../package.json')
const version = process.env.VERSION || pkg.version
module.exports =
  '/*!\n' +
  ' * d-event.js v' +
  version +
  '\n' +
  ' * (c) ' +
  new Date().getFullYear() +
  ' dawenci.' +
  ' */\n'
