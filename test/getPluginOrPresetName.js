import test from 'ava'
import getPluginOrPresetName from '../build/getPluginOrPresetName'
import plugin from './fixtures/compare/node_modules/plugin'

test('uses resolved value if already in map', t => {
  const map = new Map([[plugin, '🦄']])
  t.is(getPluginOrPresetName(map, require.resolve('./fixtures/compare/node_modules/plugin')), '🦄')
})
