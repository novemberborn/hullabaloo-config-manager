import test from 'ava'
import proxyquire from 'proxyquire'

import pkgDirMock from './helpers/pkgDirMock'

const {default: reduceChains} = proxyquire('../build/reduceChains', {
  './resolvePluginsAndPresets': proxyquire('../build/resolvePluginsAndPresets', {
    'pkg-dir': pkgDirMock,
    'resolve-from': {
      silent (dir, ref) {
        return ref
      }
    }
  })
})

const reduces = (t, defaultChain, envChains, expected) => {
  const chains = {
    defaultChain,
    envChains,
    * [Symbol.iterator] () {
      yield defaultChain
      for (const chain of envChains.values()) {
        yield chain
      }
    }
  }
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
    source: '2',
    runtimeHash: null
  }
  const three = {
    fileType: 'JSON',
    options: {
      parserOpts: {foo: 2},
      presets: [['./bar', {goodbye: true}]]
    },
    source: '3',
    runtimeHash: null
  }
  const four = {
    fileType: 'JSON',
    options: {
      plugins: ['quux']
    },
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
    runtimeDependencies: new Map([['/thud', '/thud']]),
    runtimeHash: null
  }

  test('reduces config chains', reduces, [zero, one, two], new Map([['foo', [one, two, three, four, five]]]), {
    dependencies: [
      {default: true, envs: new Set(['foo']), filename: './bar', fromPackage: null},
      {default: true, envs: new Set(['foo']), filename: './baz', fromPackage: null},
      {default: false, envs: new Set(['foo']), filename: '/thud', fromPackage: null},
      {default: true, envs: new Set(['foo']), filename: 'babel-plugin-foo', fromPackage: '.'},
      {default: false, envs: new Set(['foo']), filename: 'babel-plugin-quux', fromPackage: '.'},
      {default: true, envs: new Set(['foo']), filename: 'babel-preset-qux', fromPackage: '.'}
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
    unflattenedDefaultOptions: [{
      fileType: 'JSON',
      options: {
        parserOpts: {foo: 1},
        plugins: [
          'babel-plugin-foo',
          ['./baz', {}],
          'babel-plugin-foo'
        ],
        presets: [
          ['./bar', {hello: 'world'}],
          'babel-preset-qux'
        ],
        sourceMaps: false
      }
    }],
    unflattenedEnvOptions: new Map([
      ['foo', [{
        fileType: 'JSON',
        options: {
          parserOpts: {foo: 2},
          plugins: [
            'babel-plugin-foo',
            ['./baz', {}],
            'babel-plugin-foo',
            'babel-plugin-quux'
          ],
          presets: [
            ['./bar', {hello: 'world'}],
            'babel-preset-qux',
            ['./bar', {goodbye: true}]
          ],
          sourceMaps: false
        }
      }, {
        dir: '/',
        envName: 'foo',
        fileType: 'JS',
        source: '5'
      }]]
    ])
  })
}

test('removes non-array plugins and presets values', reduces, [
  {
    fileType: 'JSON',
    options: {
      plugins: 'plugins',
      presets: 'presets'
    }
  }
], new Map(), {
  unflattenedDefaultOptions: [{
    fileType: 'JSON',
    options: {}
  }]
})

test('fileType becomes JSON5 if some of the configs were parsed using JSON5', reduces, [
  {
    fileType: 'JSON',
    options: {}
  },
  {
    fileType: 'JSON5',
    options: {}
  }
], new Map(), {
  unflattenedDefaultOptions: [{
    fileType: 'JSON5',
    options: {}
  }]
})

test('fileType becomes JSON5 if some of the configs were parsed using JSON5, after encountering a JS config', reduces, [
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
], new Map(), {
  unflattenedDefaultOptions: [
    {
      dir: '~',
      envName: null,
      fileType: 'JS',
      source: '~/config.js'
    },
    {
      fileType: 'JSON5',
      options: {}
    }
  ]
})

{
  const ignore = {ignore: true}
  const only = {only: true}
  const passPerPreset = {passPerPreset: true}
  const sourceMap = {sourceMap: true}

  test('normalizes options', reduces, [
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
  ], new Map(), {
    unflattenedDefaultOptions: [{
      fileType: 'JSON',
      options: {
        ignore,
        only,
        passPerPreset,
        sourceMaps: sourceMap
      }
    }]
  })
}

{
  const pluginTarget = {[Symbol('plugin')]: true}
  const presetTarget = {[Symbol('preset')]: true}
  test('passes object and function values for plugin and preset targets as-is', reduces, [
    {
      fileType: 'JSON',
      options: {
        plugins: [
          pluginTarget,
          [pluginTarget],
          [pluginTarget, {}],
          [pluginTarget, {}, 'name']
        ],
        presets: [
          presetTarget,
          [presetTarget],
          [presetTarget, {}],
          [presetTarget, {}, 'name']
        ]
      }
    }
  ], new Map(), {
    unflattenedDefaultOptions: [{
      fileType: 'JSON',
      options: {
        plugins: [
          pluginTarget,
          [pluginTarget],
          [pluginTarget, {}],
          [pluginTarget, {}, 'name']
        ],
        presets: [
          presetTarget,
          [presetTarget],
          [presetTarget, {}],
          [presetTarget, {}, 'name']
        ]
      }
    }]
  })
}

test('collects fixed source hashes', reduces, [
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
], new Map(), {
  fixedSourceHashes: new Map([
    ['foo', 'hash of foo'],
    ['bar', 'hash of bar']
  ])
})
