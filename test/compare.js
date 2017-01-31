import { runInNewContext } from 'vm'

import test from 'ava'
import { transform } from 'babel-core'

import { fromVirtual } from '../'

const virtualSource = require.resolve('./fixtures/compare/virtual.json')
const virtualOptions = require('./fixtures/compare/virtual.json')

function transformChain (options, envName) {
  // Always set value, so Babel correctly resolves the plugin and preset
  // hierarchy.
  process.env.BABEL_ENV = envName

  const { code, map } = transform('[]', Object.assign(options, {
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
  const config = await fromVirtual(virtualOptions, virtualSource)
  const configModule = {}
  runInNewContext(config.generateModule(), { exports: configModule })

  t.deepEqual(transformChain(configModule.withoutEnv('ava'), 'ava'), transformBabel(), 'no BABEL_ENV')
  t.deepEqual(transformChain(configModule.byEnv.foo(), 'foo'), transformBabel('foo'), 'BABEL_ENV=foo')
})
