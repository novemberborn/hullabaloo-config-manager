import path from 'path'

import test from 'ava'
import replaceString from 'replace-string'

import {createConfig, prepareCache} from '..'
import codegen from '../build/codegen'
import * as collector from '../build/collector'
import reduceChains from '../build/reduceChains'
import fixture from './helpers/fixture'
import runGeneratedCode from './helpers/runGeneratedCode'

const source = path.join(__dirname, 'fixtures', 'empty', 'source.js')

const compile = async ({options = {}, expectedEnvNames, cache}) => {
  const chains = await collector.fromConfig(createConfig({
    fileType: 'JSON',
    options,
    dir: __dirname,
    source
  }), expectedEnvNames, cache)
  const code = codegen(reduceChains(chains, cache))
  return runGeneratedCode(code)
}

test('stringifies using JSON5 unless chain is marked otherwise', async t => {
  const chains = await collector.fromConfig(createConfig({
    fileType: 'JSON',
    options: {sourceType: 'module'},
    source
  }))
  const code = codegen(reduceChains(chains))

  t.true(code.includes('"sourceType": "module"'))
})

test('by default stringifies using JSON5', async t => {
  const chains = await collector.fromConfig(createConfig({
    options: {sourceType: 'module'},
    source
  }))
  const code = codegen(reduceChains(chains))

  t.true(code.includes("sourceType: 'module'"))
})

test('generates a nicely indented module', async t => {
  const chains = await collector.fromConfig(createConfig({
    options: {
      extends: path.join(__dirname, 'fixtures', 'compare', '.babelrc')
    },
    source
  }))

  let code = codegen(reduceChains(chains))
  let cwd = process.cwd()
  if (path.sep === path.win32.sep) {
    // File paths are JSON encoded, which means the separator is doubled.
    // Replace by the POSIX separator so the snapshot can be matched.
    code = replaceString(code, path.win32.sep + path.win32.sep, path.posix.sep)
    // Similarly normalize the CWD. Ensure any trailing slashes are removed,
    // e.g. when the CWD is `Z:/`.
    cwd = replaceString(cwd, path.win32.sep, path.posix.sep).replace(/\/$/, '')
  }

  t.snapshot(replaceString(code, cwd, '~'))
})

test('resulting options have no plugins if resolved config has an empty plugins array', async t => {
  const options = (await compile({options: {plugins: []}})).getOptions()
  t.false(options.hasOwnProperty('plugins'))
})

test('resulting options have no presets if resolved config has an empty presets array', async t => {
  const options = (await compile({options: {presets: []}})).getOptions()
  t.false(options.hasOwnProperty('presets'))
})

test('JS configs require a cache to be passed', async t => {
  const {getOptions} = await compile({
    options: {
      extends: fixture('codegen/empty.js')
    }
  })
  const err = t.throws(() => getOptions())
  t.is(err.name, 'Error')
  t.is(err.message, `A cache is required to load the configuration module at '${fixture('codegen/empty.js')}'`)
})

test('JS configs require a primed cache to be passed', async t => {
  const {getOptions} = await compile({
    options: {
      extends: fixture('codegen/empty.js')
    }
  })
  const err = t.throws(() => getOptions(null, prepareCache()))
  t.is(err.name, 'Error')
  t.is(err.message, `Could not find the configuration module for '${fixture('codegen/empty.js')}' in the cache`)
})

test('env-specific JS configs require an env-primed cache to be passed', async t => {
  const cache = prepareCache()
  const {getOptions} = await compile({
    options: {
      extends: fixture('codegen/env-specific.js')
    },
    cache
  })
  const err = t.throws(() => getOptions('foo', cache))
  t.is(err.name, 'Error')
  t.is(err.message, `Could not find the configuration module, specific to the 'foo' environment, for '${fixture('codegen/env-specific.js')}', in the cache`) // eslint-disable-line max-len
})

test('string-based plugin or preset identifiers in JS configs must be resolved via the cache', async t => {
  const cache = prepareCache()
  const {getOptions} = await compile({
    options: {
      extends: fixture('codegen/plugin-resolution.js')
    },
    cache
  })
  cache.pluginsAndPresets.get(fixture('codegen')).clear()
  const err = t.throws(() => getOptions(null, cache))
  t.is(err.name, 'ResolveFromCacheError')
  t.is(err.message, `${fixture('codegen/plugin-resolution.js')}: Couldn't find plugin "module:noop" in cache`)
  t.is(err.source, fixture('codegen/plugin-resolution.js'))
  t.is(err.ref, 'module:noop')
  t.true(err.isPlugin)
  t.false(err.isPreset)
})
