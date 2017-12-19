module.exports = api => {
  api.cache.forever()
  return Promise.resolve()
}
