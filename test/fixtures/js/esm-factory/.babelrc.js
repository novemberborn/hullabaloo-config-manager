module.exports = {
  __esModule: true,
  default: context => {
    context.cache.forever()
    return {plugins: ['esm-factory']}
  }
}
