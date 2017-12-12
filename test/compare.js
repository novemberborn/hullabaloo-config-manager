import {runInNewContext} from 'vm'

import test from 'ava'
import {transform} from '@babel/core'

import {createConfig, fromConfig} from '..'
import runGeneratedCode from './helpers/runGeneratedCode'

const source = require.resolve('./fixtures/compare/virtual.json')
const options = require('./fixtures/compare/virtual.json')

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

function transformChain (computedOptions) {
  const {code, map} = transform('[]', Object.assign(computedOptions, {
    filename: source
  }))
  return [runInNewContext(code), map]
}

function transformBabel (envName) {
  const {code, map} = transform('[]', {
    babelrc: true,
    extends: source,
    filename: source,
    envName
  })
  return [runInNewContext(code), map]
}

test('resolved config matches @babel/core', async t => {
  const config = await fromConfig(createConfig({options, source}))
  const configModule = runGeneratedCode(config.generateModule())

  setBabelEnv()
  t.deepEqual(transformChain(configModule.getOptions()), transformBabel(), 'no BABEL_ENV')

  setBabelEnv('foo')
  t.deepEqual(transformChain(configModule.getOptions()), transformBabel(), 'BABEL_ENV=foo')

  setBabelEnv()
  setNodeEnv('foo')
  t.deepEqual(transformChain(configModule.getOptions()), transformBabel(), 'no BABEL_ENV, NODE_ENV=foo')

  setBabelEnv()
  setNodeEnv()
  t.deepEqual(transformChain(configModule.getOptions('foo')), transformBabel('foo'), 'explicit envName')
})
