import path from 'path'
import {runInNewContext} from 'vm'

import test from 'ava'
import {transform} from '@babel/core'

import {createConfig, fromConfig, fromDirectory, prepareCache} from '..'
import fixture from './helpers/fixture'
import runGeneratedCode from './helpers/runGeneratedCode'

const virtualJson = require.resolve('./fixtures/compare/virtual.json')
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

function transformChain (computedOptions, filename) {
  const {code, map} = transform('[]', Object.assign(computedOptions, {
    cwd: path.dirname(filename),
    filename
  }))
  return [runInNewContext(code), map]
}

function transformBabel (options) {
  const {code, map} = transform('[]', options)
  return [runInNewContext(code), map]
}

test.serial('resolved config matches @babel/core', async t => {
  const cache = prepareCache()
  const config = await fromConfig(createConfig({options: virtualOptions, source: virtualJson}), {cache})
  const configModule = runGeneratedCode(config.generateModule())

  const babelOptions = {
    babelrc: true,
    extends: virtualJson,
    filename: virtualJson
  }

  setBabelEnv()
  t.deepEqual(transformChain(configModule.getOptions(null, cache), virtualJson), transformBabel(babelOptions), 'no BABEL_ENV')

  setBabelEnv('foo')
  t.deepEqual(transformChain(configModule.getOptions(null, cache), virtualJson), transformBabel(babelOptions), 'BABEL_ENV=foo')

  setBabelEnv()
  setNodeEnv('foo')
  t.deepEqual(
    transformChain(configModule.getOptions(null, cache), virtualJson),
    transformBabel(babelOptions),
    'no BABEL_ENV, NODE_ENV=foo')

  setBabelEnv()
  setNodeEnv()
  t.deepEqual(
    transformChain(configModule.getOptions('foo', cache), virtualJson),
    transformBabel(Object.assign({envName: 'foo'}, babelOptions)),
    'explicit envName')
})

test.serial('resolved js-env config matches @babel/core', async t => {
  setBabelEnv()
  setNodeEnv()

  const cache = prepareCache()
  const config = await fromDirectory(fixture('compare/js-env'), {expectedEnvNames: ['foo'], cache})
  const configModule = runGeneratedCode(config.generateModule())
  const filename = fixture('compare/js-env/foo.js')

  t.deepEqual(
    transformChain(configModule.getOptions('foo', cache), 'foo.js'),
    transformBabel({filename, envName: 'foo'}),
    '.babelrc: envName = foo')
})
