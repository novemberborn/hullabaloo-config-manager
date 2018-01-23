export default function loadPluginOrPreset (filename: string): Function {
  const m = require(filename) // eslint-disable-line import/no-dynamic-require
  const fn = m && m.__esModule ? m.default : m
  if (typeof fn !== 'function') {
    throw new TypeError(`Plugin or preset file '${filename}' did not export a function`)
  }
  return fn
}
