import test from 'ava'
import md5Hex from 'md5-hex'
import proxyquire from 'proxyquire'

import {createConfig, fromConfig, fromDirectory, prepareCache, restoreVerifier} from '..'
import Verifier from '../build/Verifier'
import fixture from './helpers/fixture'
import runGeneratedCode from './helpers/runGeneratedCode'
import envPluginFn from './fixtures/compare/node_modules/env-plugin'
import pluginCopyFn from './fixtures/compare/node_modules/plugin-copy'
import pluginDefaultOptsFn from './fixtures/compare/node_modules/plugin-default-opts'
import pluginFn from './fixtures/compare/node_modules/plugin'
import presetFn from './fixtures/compare/node_modules/preset'
import scopedPluginFn from './fixtures/compare/node_modules/@scope/babel-plugin-plugin'
import scopedPresetFn from './fixtures/compare/node_modules/@scope/babel-preset-preset'

function mockCurrentEnv (env = {}) {
  return proxyquire('..', {
    './currentEnv': proxyquire('../build/currentEnv', {
      process: {
        env
      }
    })
  }).currentEnv
}

function replaceWrapped (options) {
  if (options.plugins) {
    for (const plugin of options.plugins) {
      plugin[0] = plugin[0].wrapped || plugin[0]
    }
  }
  if (options.presets) {
    for (const preset of options.presets) {
      preset[0] = preset[0].wrapped || preset[0]
    }
  }
  return options
}

test('createConfig() allows dir to be specified separately from source', async t => {
  const dir = fixture('compare')
  const result = await fromConfig(createConfig({
    options: {
      babelrc: false,
      plugins: ['module:plugin']
    },
    source: 'foo',
    dir
  }))
  const configModule = runGeneratedCode(result.generateModule())

  t.deepEqual(replaceWrapped(configModule.getOptions()), {
    babelrc: false,
    envName: 'test',
    overrides: [],
    plugins: [[pluginFn, undefined, '🤡🎪🎟.0']]
  })
})

test('createConfig() can take a fixed hash for the options', async t => {
  const result = await fromConfig(createConfig({
    options: {
      babelrc: false
    },
    source: 'foo',
    hash: 'hash of foo'
  }))

  const verifier = await result.createVerifier()
  t.deepEqual(verifier.cacheKeysForEnv(), {
    dependencies: md5Hex([]),
    sources: md5Hex(['hash of foo'])
  })
})

test('createConfig() copies options to prevent modification of original input', async t => {
  const options = {
    inputSourceMap: {},
    parserOpts: {},
    generatorOpts: {},
    ignore: [],
    only: [],
    env: {foo: {}}
  }

  const {unflattenedDefaultOptions: [config]} = await fromConfig(createConfig({
    options,
    source: fixture()
  }))
  t.deepEqual(options.env, {foo: {}})

  t.false(options.inputSourceMap === config.options.inputSourceMap)
  t.false(options.parserOpts === config.options.parserOpts)
  t.false(options.generatorOpts === config.options.generatorOpts)
  t.false(options.ignore === config.options.ignore)
  t.false(options.only === config.options.only)
  t.false(options.env === config.options.env)
})

test('createConfig() throws if options are not provided', t => {
  const err = t.throws(() => createConfig(), TypeError)
  t.is(err.message, "Expected 'options' and 'source' options")
})

test('createConfig() throws if \'options\' option is not provided', t => {
  const err = t.throws(() => createConfig({source: 'foo'}), TypeError)
  t.is(err.message, "Expected 'options' and 'source' options")
})

test('createConfig() throws if \'source\' option is not provided', t => {
  const err = t.throws(() => createConfig({options: {}}), TypeError)
  t.is(err.message, "Expected 'options' and 'source' options")
})

test('createConfig() throws if \'options\' option is null', t => {
  const err = t.throws(() => createConfig({options: null, source: 'foo'}), TypeError)
  t.is(err.message, "Expected 'options' and 'source' options")
})

test('createConfig() throws if \'options\' option is an array', t => {
  const err = t.throws(() => createConfig({options: [], source: 'foo'}), TypeError)
  t.is(err.message, "'options' must be an actual object")
})

test('createConfig() throws if \'options\' option is not an object', t => {
  const err = t.throws(() => createConfig({options: 'str', source: 'foo'}), TypeError)
  t.is(err.message, "'options' must be an actual object")
})

test('createConfig() throws if \'options\' option has an \'envName\' property', t => {
  const err = t.throws(() => createConfig({options: {envName: ''}, source: 'foo'}), TypeError)
  t.is(err.message, "'options' must not have an 'envName' property")
})

test('currentEnv() returns BABEL_ENV, if set', t => {
  const currentEnv = mockCurrentEnv({
    BABEL_ENV: 'foo'
  })
  t.true(currentEnv() === 'foo')
})

test('currentEnv() returns NODE_ENV, if no BABEL_ENV', t => {
  const currentEnv = mockCurrentEnv({
    NODE_ENV: 'foo'
  })
  t.true(currentEnv() === 'foo')
})

test('currentEnv() falls back to "development", if no BABEL_ENV or NODE_ENV', t => {
  const currentEnv = mockCurrentEnv()
  t.true(currentEnv() === 'development')
})

test('fromDirectory() resolves options, dependencies, uses cache, and can generate code', async t => {
  const dir = fixture('compare')
  const cache = prepareCache()
  const result = await fromDirectory(dir, {cache})

  for (const file of [
    fixture('compare', '.babelrc'),
    fixture('compare', 'package.json')
  ]) {
    t.true(cache.files.has(file))
  }
  t.true(cache.moduleSources.has(fixture('compare', 'dir', 'subdir', 'extended-by-babelrc.js')))
  t.true(cache.pluginsAndPresets.has(dir))

  const env = {}
  const configModule = runGeneratedCode(result.generateModule(), env)

  t.deepEqual(replaceWrapped(configModule.getOptions(null, cache)), {
    overrides: [],
    plugins: [
      [
        pluginFn,
        {
          label: 'plugin@babelrc.1'
        },
        '🤡🎪🎟.0'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-babelrc.2'
        },
        '🤡🎪🎟.0.plugin@extended-by-babelrc.2'
      ],
      [
        pluginCopyFn,
        {
          label: 'plugin-copy'
        },
        '🤡🎪🎟.2.copy-or-not'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2'
        },
        '🤡🎪🎟.0.plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        '🤡🎪🎟.0.plugin@babelrc.3'
      ],
      [
        pluginFn,
        {
          label: 'plugin-not-copied'
        },
        '🤡🎪🎟.0.copy-or-not'
      ],
      [
        scopedPluginFn,
        {
          label: '@scope/babel-plugin-plugin'
        },
        '🤡🎪🎟.5'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        '🤡🎪🎟.4.preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        '🤡🎪🎟.4.preset@babelrc'
      ],
      [
        scopedPresetFn,
        {
          label: '@scope/babel-preset-preset'
        },
        '🤡🎪🎟.8'
      ]
    ],
    babelrc: false,
    envName: 'development',
    sourceMaps: false
  })

  env.BABEL_ENV = 'foo'
  t.deepEqual(replaceWrapped(configModule.getOptions(null, cache)), {
    overrides: [],
    plugins: [
      [
        pluginFn,
        {
          label: 'plugin@babelrc.1.foo'
        },
        '🤡🎪🎟.0'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-babelrc.2.foo'
        },
        '🤡🎪🎟.0.plugin@extended-by-babelrc.2'
      ],
      [
        pluginCopyFn,
        {
          label: 'plugin-copy'
        },
        '🤡🎪🎟.2.copy-or-not'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2.foo'
        },
        '🤡🎪🎟.0.plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        '🤡🎪🎟.0.plugin@babelrc.3'
      ],
      [
        pluginFn,
        {
          label: 'plugin-not-copied'
        },
        '🤡🎪🎟.0.copy-or-not'
      ],
      [
        scopedPluginFn,
        {
          label: '@scope/babel-plugin-plugin'
        },
        '🤡🎪🎟.5'
      ],
      [
        envPluginFn,
        {
          label: 'env-plugin@babelrc.foo'
        },
        '🤡🎪🎟.0.plugin@babelrc.foo'
      ],
      [
        pluginDefaultOptsFn,
        undefined,
        '🤡🎪🎟.11'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        '🤡🎪🎟.4.preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc.foo'
        },
        '🤡🎪🎟.4.preset@extended-by-babelrc.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        '🤡🎪🎟.4.preset@babelrc'
      ],
      [
        scopedPresetFn,
        {
          label: '@scope/babel-preset-preset'
        },
        '🤡🎪🎟.8'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc.foo'
        },
        '🤡🎪🎟.4.preset@babelrc.foo'
      ]
    ],
    babelrc: false,
    envName: 'foo',
    sourceMaps: false
  })
})

test('fromDirectory() works without cache', async t => {
  await t.notThrows(fromDirectory(fixture('compare')))
})

test('fromConfig() resolves options, dependencies, uses cache, and can generate code', async t => {
  const dir = fixture('compare')
  const cache = prepareCache()
  const source = fixture('compare', 'virtual.json')
  const result = await fromConfig(createConfig({
    options: require(source), // eslint-disable-line import/no-dynamic-require
    source
  }), {cache})

  for (const file of [
    fixture('compare', '.babelrc'),
    fixture('compare', 'extended-by-virtual.json5'),
    fixture('compare', 'dir', 'extended-by-virtual-foo.json5'),
    fixture('compare', 'package.json')
  ]) {
    t.true(cache.files.has(file))
  }
  t.true(cache.moduleSources.has(fixture('compare', 'dir', 'subdir', 'extended-by-babelrc.js')))
  t.true(cache.pluginsAndPresets.has(dir))

  const env = {}
  const configModule = runGeneratedCode(result.generateModule(), env)

  t.deepEqual(replaceWrapped(configModule.getOptions(null, cache)), {
    overrides: [],
    plugins: [
      [
        pluginFn,
        {
          label: 'plugin@babelrc.1'
        },
        '🤡🎪🎟.0'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-babelrc.2'
        },
        '🤡🎪🎟.0.plugin@extended-by-babelrc.2'
      ],
      [
        pluginCopyFn,
        {
          label: 'plugin-copy'
        },
        '🤡🎪🎟.2.copy-or-not'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2'
        },
        '🤡🎪🎟.0.plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        '🤡🎪🎟.0.plugin@babelrc.3'
      ],
      [
        pluginFn,
        {
          label: 'plugin-not-copied'
        },
        '🤡🎪🎟.0.copy-or-not'
      ],
      [
        scopedPluginFn,
        {
          label: '@scope/babel-plugin-plugin'
        },
        '🤡🎪🎟.5'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual'
        },
        '🤡🎪🎟.0.plugin@extended-by-virtual'
      ],
      [
        pluginFn,
        {
          label: 'plugin@virtual'
        },
        '🤡🎪🎟.0.plugin@virtual'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        '🤡🎪🎟.4.preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        '🤡🎪🎟.4.preset@babelrc'
      ],
      [
        scopedPresetFn,
        {
          label: '@scope/babel-preset-preset'
        },
        '🤡🎪🎟.8'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual'
        },
        '🤡🎪🎟.4.preset@extended-by-virtual'
      ],
      [
        presetFn,
        {
          label: 'preset@virtual'
        },
        '🤡🎪🎟.4.preset@virtual'
      ]
    ],
    babelrc: false,
    envName: 'development',
    sourceMaps: true
  })

  env.BABEL_ENV = 'foo'
  t.deepEqual(replaceWrapped(configModule.getOptions(null, cache)), {
    overrides: [],
    plugins: [
      [
        pluginFn,
        {
          label: 'plugin@babelrc.1.foo'
        },
        '🤡🎪🎟.0'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-babelrc.2.foo'
        },
        '🤡🎪🎟.0.plugin@extended-by-babelrc.2'
      ],
      [
        pluginCopyFn,
        {
          label: 'plugin-copy'
        },
        '🤡🎪🎟.2.copy-or-not'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2.foo'
        },
        '🤡🎪🎟.0.plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        '🤡🎪🎟.0.plugin@babelrc.3'
      ],
      [
        pluginFn,
        {
          label: 'plugin-not-copied'
        },
        '🤡🎪🎟.0.copy-or-not'
      ],
      [
        scopedPluginFn,
        {
          label: '@scope/babel-plugin-plugin'
        },
        '🤡🎪🎟.5'
      ],
      [
        envPluginFn,
        {
          label: 'env-plugin@babelrc.foo'
        },
        '🤡🎪🎟.0.plugin@babelrc.foo'
      ],
      [
        pluginDefaultOptsFn,
        undefined,
        '🤡🎪🎟.11'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual'
        },
        '🤡🎪🎟.0.plugin@extended-by-virtual'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual.foo'
        },
        '🤡🎪🎟.0.plugin@extended-by-virtual.foo'
      ],
      [
        pluginFn,
        {
          label: 'plugin@virtual'
        },
        '🤡🎪🎟.0.plugin@virtual'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual-foo'
        },
        '🤡🎪🎟.0.plugin@extended-by-virtual-foo'
      ],
      [
        pluginFn,
        {
          label: 'plugin@virtual.foo'
        },
        '🤡🎪🎟.0.plugin@virtual.foo'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        '🤡🎪🎟.4.preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc.foo'
        },
        '🤡🎪🎟.4.preset@extended-by-babelrc.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        '🤡🎪🎟.4.preset@babelrc'
      ],
      [
        scopedPresetFn,
        {
          label: '@scope/babel-preset-preset'
        },
        '🤡🎪🎟.8'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc.foo'
        },
        '🤡🎪🎟.4.preset@babelrc.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual'
        },
        '🤡🎪🎟.4.preset@extended-by-virtual'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual.foo'
        },
        '🤡🎪🎟.4.preset@extended-by-virtual.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@virtual'
        },
        '🤡🎪🎟.4.preset@virtual'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual-foo'
        },
        '🤡🎪🎟.4.preset@extended-by-virtual-foo'
      ],
      [
        presetFn,
        {
          label: 'preset@virtual.foo'
        },
        '🤡🎪🎟.4.preset@virtual.foo'
      ]
    ],
    babelrc: false,
    envName: 'foo',
    sourceMaps: true
  })
})

test('fromConfig() works without cache', async t => {
  const source = fixture('compare', 'virtual.json')
  await t.notThrows(fromConfig(createConfig({
    options: require(source), // eslint-disable-line import/no-dynamic-require
    source
  })))
})

test('fromConfig() puts virtual configs in module source cache if fileType is JS', async t => {
  const dir = fixture('compare')
  const cache = prepareCache()
  const result = await fromConfig(createConfig({
    dir,
    fileType: 'JS',
    options: {
      babelrc: false,
      plugins: [pluginFn]
    },
    source: 'foo'
  }), {cache})
  const configModule = runGeneratedCode(result.generateModule())

  t.deepEqual(replaceWrapped(configModule.getOptions(null, cache)), {
    babelrc: false,
    envName: 'test',
    overrides: [],
    plugins: [[pluginFn, undefined, '🤡🎪🎟.0']]
  })
})

test('explicit hashes can be empty strings', async t => {
  const cache = prepareCache()
  const result = await fromConfig(createConfig({
    options: {},
    hash: '',
    source: '👋'
  }), {cache})

  await result.createVerifier()
  t.pass()
})

test('prepareCache()', t => {
  const cache = prepareCache()
  t.deepEqual(Object.keys(cache), [
    'dependencyHashes', 'fileExistence', 'files', 'moduleSources', 'nameMap', 'pluginsAndPresets', 'sourceHashes'
  ])
  t.true(cache.dependencyHashes instanceof Map)
  t.true(cache.fileExistence instanceof Map)
  t.true(cache.files instanceof Map)
  t.true(cache.moduleSources instanceof Map)
  t.true(cache.nameMap instanceof Map)
  t.true(cache.pluginsAndPresets instanceof Map)
  t.true(cache.sourceHashes instanceof Map)
})

test('restoreVerifier()', t => {
  const verifier = new Verifier(__dirname, new Set(), [], [])
  const buffer = verifier.toBuffer()

  t.deepEqual(restoreVerifier(buffer), verifier)
})
