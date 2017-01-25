import { runInNewContext } from 'vm'

import test from 'ava'
import { transform } from 'babel-core'

import collector from '../lib/collector'
import reduceOptions from '../lib/reduceOptions'
import resolvePluginsAndPresets from '../lib/resolvePluginsAndPresets'

const virtualSource = require.resolve('./fixtures/compare/virtual.json')
const virtualOptions = require('./fixtures/compare/virtual.json')

function transformChain (chain, pluginsAndPresets, envName = 'ava') {
  process.env.BABEL_ENV = envName

  const { unflattenedOptions } = reduceOptions(chain, pluginsAndPresets)
  const flattenedOptions = unflattenedOptions.reduceRight((prev, options) => {
    options.env = {
      [envName]: prev
    }
    return options
  })
  const { code, map } = transform('[]', Object.assign(flattenedOptions, {
    babelrc: false,
    filename: virtualSource
  }))
  return [runInNewContext(code), map]
}

function transformBabel (envName) {
  process.env.BABEL_ENV = envName

  const { code, map } = transform('[]', {
    babelrc: true,
    extends: virtualSource,
    filename: virtualSource
  })
  return [runInNewContext(code), map]
}

test('resolved config matches babel-core', async t => {
  const chains = await collector.fromVirtual(virtualOptions, virtualSource)
  const pluginsAndPresets = resolvePluginsAndPresets(chains)

  t.deepEqual(transformChain(chains.withoutEnv, pluginsAndPresets), transformBabel(), 'no BABEL_ENV')
  t.deepEqual(transformChain(chains.byEnv.get('foo'), pluginsAndPresets, 'foo'), transformBabel('foo'), 'BABEL_ENV=foo')
})
