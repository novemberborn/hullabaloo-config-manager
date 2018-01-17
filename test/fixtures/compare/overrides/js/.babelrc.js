'use strict'
const plugin = require('../../node_modules/plugin')

module.exports = api => {
  api.cache.forever()
  return {
    plugins: [
      [plugin, {label: 'babelrc'}],
      [plugin, {label: 'babelrc.named'}, 'named']
    ],
    env: {
      foo: {
        plugins: [
          [plugin, {label: 'babelrc.foo'}]
        ]
      }
    },
    overrides: [
      {
        test: 'bar.js',
        plugins: [
          [plugin, {label: 'bar'}, 'named']
        ]
      },
      {
        test: 'foo.js',
        extends: './extends.js',
        plugins: [
          [plugin, {label: 'babelrc.named.override'}, 'named']
        ],
        env: {
          foo: {
            plugins: [
              [plugin, {label: 'babelrc.override.foo'}]
            ]
          }
        }
      }
    ]
  }
}
