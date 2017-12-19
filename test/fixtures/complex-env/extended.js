module.exports = context => {
  context.env()
  return {
    extends: 'extended-further.json5',
    plugins: ['extended']
  }
}
