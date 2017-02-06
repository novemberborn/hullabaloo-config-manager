import { runInNewContext } from 'vm'

import test from 'ava'
import { transform } from 'babel-core'

import { fromVirtual } from '../'
import runGeneratedCode from './helpers/runGeneratedCode'

const virtualSource = require.resolve('./fixtures/compare/virtual.json')
const virtualOptions = require('./fixtures/compare/virtual.json')

function setBabelEnv (envName) {
  if (envName) {
    process.env.BABEL_ENV = envName
  } else {
    delete process.env.BABEL_ENV
  }
}

function setNodeEnv (envName) {
  if (envName) {
    process.env.NODE_ENV = envName
  } else {
    delete process.env.NODE_ENV
  }
}

function transformChain (options) {
  const { code, map } = transform('[]', Object.assign(options, {
    filename: virtualSource
  }))
  return [runInNewContext(code), map]
}

function transformBabel () {
  const { code, map } = transform('[]', {
    babelrc: true,
    extends: virtualSource,
    filename: virtualSource
  })
  return [runInNewContext(code), map]
}

test('resolved config matches babel-core', async t => {
  const config = await fromVirtual(virtualOptions, virtualSource)
  const configModule = runGeneratedCode(config.generateModule())

  setBabelEnv()
  t.deepEqual(transformChain(configModule.getOptions()), transformBabel(), 'no BABEL_ENV')

  setBabelEnv('foo')
  t.deepEqual(transformChain(configModule.getOptions()), transformBabel(), 'BABEL_ENV=foo')

  setBabelEnv()
  setNodeEnv('foo')
  t.deepEqual(transformChain(configModule.getOptions()), transformBabel(), 'no BABEL_ENV, NODE_ENV=foo')
})
