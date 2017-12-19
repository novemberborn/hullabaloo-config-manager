module.exports = context => {
  const env = context.env()
  const plugins = ['env-base']
  if (env === 'foo') {
    return {
      plugins,
      env: {
        foo: {
          plugins: ['env-foo']
        }
      }
    }
  }

  if (env === 'bar') {
    plugins.push(`env-${env}`)
  }
  return {plugins}
}
