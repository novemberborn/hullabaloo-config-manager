import test from 'ava'
import md5Hex from 'md5-hex'
import proxyquire from 'proxyquire'

import {createConfig, fromConfig, fromDirectory, prepareCache, restoreVerifier} from '..'
import Verifier from '../build/Verifier'
import fixture from './helpers/fixture'
import runGeneratedCode from './helpers/runGeneratedCode'
import envPluginFn from './fixtures/compare/node_modules/env-plugin'
import pluginDefaultOptsFn from './fixtures/compare/node_modules/plugin-default-opts'
import pluginFn from './fixtures/compare/node_modules/plugin'
import presetFn from './fixtures/compare/node_modules/preset'

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
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
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
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2.foo'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ],
      [
        envPluginFn,
        {
          label: 'env-plugin@babelrc.foo'
        },
        'plugin@babelrc.foo'
      ],
      [
        pluginDefaultOptsFn,
        undefined,
        '🤡🎪🎟.2'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc.foo'
        },
        'preset@extended-by-babelrc.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc.foo'
        },
        'preset@babelrc.foo'
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
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual'
        },
        'plugin@extended-by-virtual'
      ],
      [
        pluginFn,
        {
          label: 'plugin@virtual'
        },
        'plugin@virtual'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual'
        },
        'preset@extended-by-virtual'
      ],
      [
        presetFn,
        {
          label: 'preset@virtual'
        },
        'preset@virtual'
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
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.2.foo'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ],
      [
        envPluginFn,
        {
          label: 'env-plugin@babelrc.foo'
        },
        'plugin@babelrc.foo'
      ],
      [
        pluginDefaultOptsFn,
        undefined,
        '🤡🎪🎟.2'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual'
        },
        'plugin@extended-by-virtual'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual.foo'
        },
        'plugin@extended-by-virtual.foo'
      ],
      [
        pluginFn,
        {
          label: 'plugin@virtual'
        },
        'plugin@virtual'
      ],
      [
        pluginFn,
        {
          label: 'plugin@extended-by-virtual-foo'
        },
        'plugin@extended-by-virtual-foo'
      ],
      [
        pluginFn,
        {
          label: 'plugin@virtual.foo'
        },
        'plugin@virtual.foo'
      ]
    ],
    presets: [
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-babelrc.foo'
        },
        'preset@extended-by-babelrc.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
      ],
      [
        presetFn,
        {
          label: 'preset@babelrc.foo'
        },
        'preset@babelrc.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual'
        },
        'preset@extended-by-virtual'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual.foo'
        },
        'preset@extended-by-virtual.foo'
      ],
      [
        presetFn,
        {
          label: 'preset@virtual'
        },
        'preset@virtual'
      ],
      [
        presetFn,
        {
          label: 'preset@extended-by-virtual-foo'
        },
        'preset@extended-by-virtual-foo'
      ],
      [
        presetFn,
        {
          label: 'preset@virtual.foo'
        },
        'preset@virtual.foo'
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
