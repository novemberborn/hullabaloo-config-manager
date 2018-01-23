const plugin = require('plugin') // eslint-disable-line import/no-extraneous-dependencies

module.exports = options => {
  options.cache.forever()
  return {
    plugins: [
      ['module:plugin', {label: 'plugin@extended-by-babelrc.1'}],
      [plugin, {label: 'plugin@extended-by-babelrc.2'}, 'plugin@extended-by-babelrc.2']
    ],
    presets: [
      [
        require('preset').default, // eslint-disable-line import/no-extraneous-dependencies
        {label: 'preset@extended-by-babelrc'},
        'preset@extended-by-babelrc'
      ]
    ],
    env: {
      foo: {
        plugins: [
          ['module:plugin', {label: 'plugin@extended-by-babelrc.1.foo'}],
          ['module:plugin', {label: 'plugin@extended-by-babelrc.2.foo'}, 'plugin@extended-by-babelrc.2']
        ],
        presets: [
          ['module:preset', {label: 'preset@extended-by-babelrc.foo'}, 'preset@extended-by-babelrc.foo']
        ]
      }
    }
  }
}
