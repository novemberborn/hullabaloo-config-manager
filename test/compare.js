import { runInNewContext } from 'vm'

import test from 'ava'
import { transform } from 'babel-core'

import codegen from '../lib/codegen'
import collector from '../lib/collector'
import resolvePluginsAndPresets from '../lib/resolvePluginsAndPresets'

const virtualSource = require.resolve('./fixtures/compare/virtual.json')
const virtualOptions = require('./fixtures/compare/virtual.json')

function transformChain (getOptions, pluginsAndPresets, envName = 'ava') {
  process.env.BABEL_ENV = envName

  const options = Object.assign(getOptions(envName), {
    filename: virtualSource
  })
  const { code, map } = transform('[]', options)
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
  const code = codegen(chains, pluginsAndPresets)
  const configModule = {}
  runInNewContext(code, { exports: configModule })

  t.deepEqual(transformChain(configModule.withoutEnv, pluginsAndPresets), transformBabel(), 'no BABEL_ENV')
  t.deepEqual(transformChain(configModule.byEnv.foo, pluginsAndPresets, 'foo'), transformBabel('foo'), 'BABEL_ENV=foo')
})
