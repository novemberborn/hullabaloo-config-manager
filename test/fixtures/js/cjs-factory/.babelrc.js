module.exports = context => {
  context.cache.forever()
  return {plugins: ['cjs-factory']}
}
