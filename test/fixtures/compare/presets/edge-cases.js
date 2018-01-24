'use strict'
const plugin = require('../node_modules/plugin')

module.exports = () => ({
  presets: [
    {},
    [{}],
    [{}, {}],
    [{}, {}, 'name'],
    () => ({}),
    [() => ({})],
    ['./preset.js', {}],
    ['./preset.js', {}, 'repeat']
  ],
  plugins: [
    () => ({}),
    [() => ({})],
    [plugin, {label: 'edge-cases>plugin.1'}],
    [plugin, {label: 'edge-cases>plugin.2'}, '2']
  ]
})
