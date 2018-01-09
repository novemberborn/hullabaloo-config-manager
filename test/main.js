import path from 'path'

import test from 'ava'
import md5Hex from 'md5-hex'
import proxyquire from 'proxyquire'

import {createConfig, fromConfig, fromDirectory, prepareCache, restoreVerifier} from '..'
import Verifier from '../build/Verifier'
import fixture from './helpers/fixture'
import runGeneratedCode from './helpers/runGeneratedCode'

function mockCurrentEnv (env = {}) {
  return proxyquire('..', {
    './currentEnv': proxyquire('../build/currentEnv', {
      process: {
        env
      }
    })
  }).currentEnv
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

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  t.deepEqual(configModule.getOptions(), {
    babelrc: false,
    envName: 'test',
    plugins: [[pluginIndex, undefined, '🤡🎪🎟.0']]
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
  t.true(cache.moduleSources.has(fixture('compare', 'extended-by-babelrc.js')))
  t.true(cache.pluginsAndPresets.has(dir))

  const env = {}
  const configModule = runGeneratedCode(result.generateModule(), env)

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  const presetIndex = path.join(dir, 'node_modules', 'preset', 'index.js')
  t.deepEqual(configModule.getOptions(null, cache), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.1'
        },
        '🤡🎪🎟.0'
      ],
      [
        require(pluginIndex), // eslint-disable-line import/no-dynamic-require
        {
          label: 'plugin@extended-by-babelrc.2'
        },
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.2'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ]
    ],
    presets: [
      [
        require(presetIndex), // eslint-disable-line import/no-dynamic-require
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetIndex,
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
  const envPluginIndex = path.join(dir, 'node_modules', 'env-plugin', 'index.js')
  const pluginDefaultOptsIndex = path.join(dir, 'node_modules', 'plugin-default-opts', 'index.js')
  t.deepEqual(configModule.getOptions(null, cache), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.1.foo'
        },
        '🤡🎪🎟.0'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-babelrc.2.foo'
        },
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.2.foo'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ],
      [
        envPluginIndex,
        {
          label: 'env-plugin@babelrc.foo'
        },
        'plugin@babelrc.foo'
      ],
      [
        pluginDefaultOptsIndex,
        undefined,
        '🤡🎪🎟.2'
      ]
    ],
    presets: [
      [
        require(presetIndex), // eslint-disable-line import/no-dynamic-require
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetIndex,
        {
          label: 'preset@extended-by-babelrc.foo'
        },
        'preset@extended-by-babelrc.foo'
      ],
      [
        presetIndex,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
      ],
      [
        presetIndex,
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
    fixture('compare', 'extended-by-virtual-foo.json5'),
    fixture('compare', 'package.json')
  ]) {
    t.true(cache.files.has(file))
  }
  t.true(cache.moduleSources.has(fixture('compare', 'extended-by-babelrc.js')))
  t.true(cache.pluginsAndPresets.has(dir))

  const env = {}
  const configModule = runGeneratedCode(result.generateModule(), env)

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  const presetIndex = path.join(dir, 'node_modules', 'preset', 'index.js')
  const envPluginIndex = path.join(dir, 'node_modules', 'env-plugin', 'index.js')
  const pluginDefaultOptsIndex = path.join(dir, 'node_modules', 'plugin-default-opts', 'index.js')
  t.deepEqual(configModule.getOptions(null, cache), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.1'
        },
        '🤡🎪🎟.0'
      ],
      [
        require(pluginIndex), // eslint-disable-line import/no-dynamic-require
        {
          label: 'plugin@extended-by-babelrc.2'
        },
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.2'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-virtual'
        },
        'plugin@extended-by-virtual'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@virtual'
        },
        'plugin@virtual'
      ]
    ],
    presets: [
      [
        require(presetIndex), // eslint-disable-line import/no-dynamic-require
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetIndex,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
      ],
      [
        presetIndex,
        {
          label: 'preset@extended-by-virtual'
        },
        'preset@extended-by-virtual'
      ],
      [
        presetIndex,
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
  t.deepEqual(configModule.getOptions(null, cache), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.1.foo'
        },
        '🤡🎪🎟.0'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-babelrc.2.foo'
        },
        'plugin@extended-by-babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.2.foo'
        },
        'plugin@babelrc.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@babelrc.3'
        },
        'plugin@babelrc.3'
      ],
      [
        envPluginIndex,
        {
          label: 'env-plugin@babelrc.foo'
        },
        'plugin@babelrc.foo'
      ],
      [
        pluginDefaultOptsIndex,
        undefined,
        '🤡🎪🎟.2'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-virtual'
        },
        'plugin@extended-by-virtual'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-virtual.foo'
        },
        'plugin@extended-by-virtual.foo'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@virtual'
        },
        'plugin@virtual'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-virtual-foo'
        },
        'plugin@extended-by-virtual-foo'
      ],
      [
        pluginIndex,
        {
          label: 'plugin@virtual.foo'
        },
        'plugin@virtual.foo'
      ]
    ],
    presets: [
      [
        require(presetIndex), // eslint-disable-line import/no-dynamic-require
        {
          label: 'preset@extended-by-babelrc'
        },
        'preset@extended-by-babelrc'
      ],
      [
        presetIndex,
        {
          label: 'preset@extended-by-babelrc.foo'
        },
        'preset@extended-by-babelrc.foo'
      ],
      [
        presetIndex,
        {
          label: 'preset@babelrc'
        },
        'preset@babelrc'
      ],
      [
        presetIndex,
        {
          label: 'preset@babelrc.foo'
        },
        'preset@babelrc.foo'
      ],
      [
        presetIndex,
        {
          label: 'preset@extended-by-virtual'
        },
        'preset@extended-by-virtual'
      ],
      [
        presetIndex,
        {
          label: 'preset@extended-by-virtual.foo'
        },
        'preset@extended-by-virtual.foo'
      ],
      [
        presetIndex,
        {
          label: 'preset@virtual'
        },
        'preset@virtual'
      ],
      [
        presetIndex,
        {
          label: 'preset@extended-by-virtual-foo'
        },
        'preset@extended-by-virtual-foo'
      ],
      [
        presetIndex,
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
