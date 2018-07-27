const pkg = require('../package.json')
const version = process.env.VERSION || pkg.version
module.exports =
  '/*!\n' +
  ' * d-events.js v' +
  version +
  '\n' +
  ' * (c) ' +
  new Date().getFullYear() +
  ' dawenci.' +
  ' */\n'
