'use strict'
const noop = require('../node_modules/noop')
const noop3 = require('../node_modules/noop3')

module.exports = api => {
  api.cache.forever()
  return {
    extends: './no-plugins-or-presets.js',
    plugins: [
      [{}],
      [noop],
      ['module:noop2'],
      noop3,
      'module:noop4'
    ]
  }
}
