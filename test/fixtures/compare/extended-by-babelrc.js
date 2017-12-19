module.exports = options => {
  options.cache.forever()
  return {
    plugins: [
      ['module:plugin', {label: 'plugin@extended-by-babelrc'}, 'plugin@extended-by-babelrc']
    ],
    presets: [
      ['module:preset', {label: 'preset@extended-by-babelrc'}, 'preset@extended-by-babelrc']
    ],
    env: {
      foo: {
        plugins: [
          ['module:plugin', {label: 'plugin@extended-by-babelrc.foo'}, 'plugin@extended-by-babelrc.foo']
        ],
        presets: [
          ['module:preset', {label: 'preset@extended-by-babelrc.foo'}, 'preset@extended-by-babelrc.foo']
        ]
      }
    }
  }
}
