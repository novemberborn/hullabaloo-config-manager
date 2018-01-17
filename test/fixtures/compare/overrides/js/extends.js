'use strict'
const plugin = require('../../node_modules/plugin')

module.exports = {
  plugins: [
    [plugin, {label: 'extends'}],
    [plugin, {label: 'extends.named'}, 'named'],
    [plugin, {label: 'extends.new'}, 'new']
  ],
  overrides: [
    {
      test: 'foo.js',
      plugins: [
        [plugin, {label: 'extends.named.override'}, 'named']
      ]
    }
  ]
}
