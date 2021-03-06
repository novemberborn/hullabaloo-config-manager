import path from 'path'
import test from 'ava'
import mockRequire from 'mock-require'
import proxyquire from 'proxyquire'

import pkgDirMock from './helpers/pkgDirMock'

const {default: reduceChains} = proxyquire('../build/reduceChains', {
  './resolvePluginsAndPresets': proxyquire('../build/resolvePluginsAndPresets', {
    'pkg-dir': pkgDirMock,
    'resolve-from': {
      silent (dir, ref) {
        if (ref.startsWith('./')) return path.posix.join('~', ref + '.js')
        if (ref.startsWith('/')) return ref + '.js'
        return path.posix.join('~', ref, 'index.js')
      }
    }
  })
})

mockRequire('~/babel-plugin-foo/index.js', () => ({}))
mockRequire('~/babel-plugin-quux/index.js', () => ({}))
mockRequire('~/babel-preset-qux/index.js', () => ({}))
mockRequire('~/bar.js', () => ({}))
mockRequire('~/baz.js', () => ({}))
mockRequire('/thud.js', () => ({}))

function makeChainsObj (defaultChain, envChains) {
  return {
    defaultChain,
    envChains,
    * [Symbol.iterator] () {
      yield defaultChain
      for (const chain of envChains.values()) {
        yield chain
      }
    }
  }
}

const reduces = (t, defaultChain, envChains, expected) => {
  const chains = makeChainsObj(defaultChain, envChains)
  const {
    dependencies,
    envNames,
    fixedSourceHashes,
    sources,
    unflattenedDefaultOptions,
    unflattenedEnvOptions
  } = reduceChains(chains)

  if ('dependencies' in expected) t.deepEqual(dependencies, expected.dependencies)
  if ('fixedSourceHashes' in expected) t.deepEqual(fixedSourceHashes, expected.fixedSourceHashes)
  if ('envNames' in expected) t.deepEqual(envNames, expected.envNames)
  if ('sources' in expected) t.deepEqual(sources, expected.sources)
  if ('unflattenedDefaultOptions' in expected) t.deepEqual(unflattenedDefaultOptions, expected.unflattenedDefaultOptions)
  if ('unflattenedEnvOptions' in expected) t.deepEqual(unflattenedEnvOptions, expected.unflattenedEnvOptions)
}

{
  const zero = {
    fileType: 'JSON',
    options: {},
    dir: '~',
    source: '0',
    runtimeHash: null
  }
  const one = {
    fileType: 'JSON',
    options: {
      plugins: ['foo'],
      presets: [['./bar', {hello: 'world'}]],
      sourceMaps: true
    },
    dir: '~',
    source: '1',
    runtimeHash: null
  }
  const two = {
    fileType: 'JSON',
    options: {
      parserOpts: {foo: 1},
      plugins: [['./baz', {}], 'foo'],
      presets: [['qux']],
      sourceMaps: false
    },
    dir: '~',
    source: '2',
    runtimeHash: null
  }
  const three = {
    fileType: 'JSON',
    options: {
      parserOpts: {foo: 2},
      presets: [['./bar', {goodbye: true}]]
    },
    dir: '~',
    source: '3',
    runtimeHash: null
  }
  const four = {
    fileType: 'JSON',
    options: {
      plugins: ['quux']
    },
    dir: '~',
    source: '4',
    runtimeHash: null
  }
  const five = {
    fileType: 'JS',
    options: {
      plugins: ['/thud']
    },
    dir: '/',
    envName: 'foo',
    source: '5',
    runtimeDependencies: new Map([['/thud.js', '/thud']]),
    runtimeHash: null
  }

  test('reduces config chains', reduces,
    Object.assign([zero, one, two], {overrides: []}),
    new Map([['foo', Object.assign([one, two, three, four, five], {overrides: []})]]),
    {
      dependencies: [
        {default: false, envs: new Set(['foo']), filename: '/thud.js', fromPackage: null},
        {default: true, envs: new Set(['foo']), filename: '~/babel-plugin-foo/index.js', fromPackage: '~/babel-plugin-foo'},
        {default: false, envs: new Set(['foo']), filename: '~/babel-plugin-quux/index.js', fromPackage: '~/babel-plugin-quux'},
        {default: true, envs: new Set(['foo']), filename: '~/babel-preset-qux/index.js', fromPackage: '~/babel-preset-qux'},
        {default: true, envs: new Set(['foo']), filename: '~/bar.js', fromPackage: null},
        {default: true, envs: new Set(['foo']), filename: '~/baz.js', fromPackage: null}
      ],
      envNames: new Set(['foo']),
      sources: [
        {default: true, envs: new Set(), source: '0', runtimeHash: null},
        {default: true, envs: new Set(['foo']), source: '1', runtimeHash: null},
        {default: true, envs: new Set(['foo']), source: '2', runtimeHash: null},
        {default: false, envs: new Set(['foo']), source: '3', runtimeHash: null},
        {default: false, envs: new Set(['foo']), source: '4', runtimeHash: null},
        {default: false, envs: new Set(['foo']), source: '5', runtimeHash: null}
      ],
      unflattenedDefaultOptions: Object.assign([{
        fileType: 'JSON',
        options: {
          parserOpts: {foo: 1},
          plugins: [
            {dirname: '~', filename: '~/babel-plugin-foo/index.js', name: '🤡🎪🎟.0'},
            {dirname: '~', filename: '~/baz.js', options: {}, name: '🤡🎪🎟.4'}
          ],
          presets: [
            {dirname: '~', filename: '~/bar.js', options: {hello: 'world'}, name: '🤡🎪🎟.2'},
            {dirname: '~', filename: '~/babel-preset-qux/index.js', name: '🤡🎪🎟.6'}
          ],
          sourceMaps: false
        }
      }], {overrides: []}),
      unflattenedEnvOptions: new Map([
        ['foo', Object.assign([{
          fileType: 'JSON',
          options: {
            parserOpts: {foo: 2},
            plugins: [
              {dirname: '~', filename: '~/babel-plugin-foo/index.js', name: '🤡🎪🎟.0'},
              {dirname: '~', filename: '~/baz.js', options: {}, name: '🤡🎪🎟.4'},
              {dirname: '~', filename: '~/babel-plugin-quux/index.js', name: '🤡🎪🎟.8'}
            ],
            presets: [
              {dirname: '~', filename: '~/bar.js', options: {goodbye: true}, name: '🤡🎪🎟.2'},
              {dirname: '~', filename: '~/babel-preset-qux/index.js', name: '🤡🎪🎟.6'}
            ],
            sourceMaps: false
          }
        }, {
          dir: '/',
          envName: 'foo',
          fileType: 'JS',
          source: '5'
        }], {overrides: []})]
      ])
    })
}

test('removes non-array plugins and presets values', reduces, Object.assign([
  {
    fileType: 'JSON',
    options: {
      plugins: 'plugins',
      presets: 'presets'
    }
  }
], {overrides: []}), new Map(), {
  unflattenedDefaultOptions: Object.assign([{
    fileType: 'JSON',
    options: {
      plugins: [],
      presets: []
    }
  }], {overrides: []})
})

test('fileType becomes JSON5 if some of the configs were parsed using JSON5', reduces, Object.assign([
  {
    fileType: 'JSON',
    options: {}
  },
  {
    fileType: 'JSON5',
    options: {}
  }
], {overrides: []}), new Map(), {
  unflattenedDefaultOptions: Object.assign([{
    fileType: 'JSON5',
    options: {
      plugins: [],
      presets: []
    }
  }], {overrides: []})
})

test('fileType becomes JSON5 if some of the configs were parsed using JSON5, after encountering a JS config', reduces,
  Object.assign([
    {
      dir: '~',
      envName: null,
      fileType: 'JS',
      options: {},
      source: '~/config.js'
    },
    {
      fileType: 'JSON',
      options: {}
    },
    {
      fileType: 'JSON5',
      options: {}
    }
  ], {overrides: []}), new Map(), {
    unflattenedDefaultOptions: Object.assign([
      {
        dir: '~',
        envName: null,
        fileType: 'JS',
        source: '~/config.js'
      },
      {
        fileType: 'JSON5',
        options: {
          plugins: [],
          presets: []
        }
      }
    ], {overrides: []})
  })

{
  const ignore = {ignore: true}
  const only = {only: true}
  const passPerPreset = {passPerPreset: true}
  const sourceMap = {sourceMap: true}

  test('normalizes options', reduces, Object.assign([
    {
      fileType: 'JSON',
      options: {
        ignore,
        only,
        passPerPreset,
        sourceMaps: null
      }
    },
    {
      fileType: 'JSON',
      options: {
        // These should be stripped before options are merged with base
        ignore: null,
        only: null,
        passPerPreset: null,
        // `sourceMap` should be merged as `sourceMaps`
        sourceMap
      }
    }
  ], {overrides: []}), new Map(), {
    unflattenedDefaultOptions: Object.assign([{
      fileType: 'JSON',
      options: {
        ignore,
        only,
        passPerPreset,
        sourceMaps: sourceMap,
        plugins: [],
        presets: []
      }
    }], {overrides: []})
  })
}

{
  const pluginTarget1 = {[Symbol('plugin1')]: true}
  const pluginTarget2 = {[Symbol('plugin2')]: true}
  const pluginTarget3 = {[Symbol('plugin3')]: true}
  const pluginTarget4 = {[Symbol('plugin4')]: true}
  const presetTarget1 = {[Symbol('preset1')]: true}
  const presetTarget2 = {[Symbol('preset2')]: true}
  const presetTarget3 = {[Symbol('preset3')]: true}
  const presetTarget4 = {[Symbol('preset4')]: true}
  test('preserves object and function values for plugin and preset targets', reduces, Object.assign([
    {
      fileType: 'JSON',
      dir: '~',
      options: {
        plugins: [
          pluginTarget1,
          [pluginTarget2],
          [pluginTarget3, {}],
          [pluginTarget4, {}, 'name']
        ],
        presets: [
          presetTarget1,
          [presetTarget2],
          [presetTarget3, {}],
          [presetTarget4, {}, 'name']
        ]
      }
    }
  ], {overrides: []}), new Map(), {
    unflattenedDefaultOptions: Object.assign([{
      fileType: 'JSON',
      options: {
        plugins: [
          {dirname: '~', target: pluginTarget1, name: '🤡🎪🎟.0'},
          {dirname: '~', target: pluginTarget2, name: '🤡🎪🎟.1'},
          {dirname: '~', target: pluginTarget3, options: {}, name: '🤡🎪🎟.2'},
          {dirname: '~', target: pluginTarget4, options: {}, name: '🤡🎪🎟.3.name'}
        ],
        presets: [
          {dirname: '~', target: presetTarget1, name: '🤡🎪🎟.4'},
          {dirname: '~', target: presetTarget2, name: '🤡🎪🎟.5'},
          {dirname: '~', target: presetTarget3, options: {}, name: '🤡🎪🎟.6'},
          {dirname: '~', target: presetTarget4, options: {}, name: '🤡🎪🎟.7.name'}
        ]
      }
    }], {overrides: []})
  })
}

test('collects fixed source hashes', reduces, Object.assign([
  {
    options: {},
    source: 'foo',
    hash: 'hash of foo'
  },
  {
    options: {},
    source: 'bar',
    hash: 'hash of bar'
  }
], {overrides: []}), new Map(), {
  fixedSourceHashes: new Map([
    ['foo', 'hash of foo'],
    ['bar', 'hash of bar']
  ])
})

test('throws when a config contains repeated plugins', t => {
  const plugin = () => {}
  const chains = makeChainsObj(Object.assign([
    {
      options: {
        plugins: [
          plugin,
          plugin
        ]
      },
      source: 'foo'
    }
  ], {overrides: []}), new Map())

  const err = t.throws(() => reduceChains(chains))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, 'foo')
})

test('throws when a config contains repeated presets', t => {
  const preset = () => {}
  const chains = makeChainsObj(Object.assign([
    {
      options: {
        presets: [
          preset,
          preset
        ]
      },
      source: 'foo'
    }
  ], {overrides: []}), new Map())

  const err = t.throws(() => reduceChains(chains))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, 'foo')
})
