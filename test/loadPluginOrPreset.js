import test from 'ava'
import loadPluginOrPreset from '../build/loadPluginOrPreset'

test('throws when module does not export a function', t => {
  const err = t.throws(() => loadPluginOrPreset(__filename))
  t.is(err.name, 'TypeError')
  t.is(err.message, `Plugin or preset file '${__filename}' did not export a function`)
})
