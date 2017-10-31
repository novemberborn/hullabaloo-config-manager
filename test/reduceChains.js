import test from 'ava'
import proxyquire from 'proxyquire'

import pkgDirMock from './helpers/pkgDirMock'

const reduceChains = proxyquire('../lib/reduceChains', {
  './resolvePluginsAndPresets': proxyquire('../lib/resolvePluginsAndPresets', {
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
  if ('json5' in expected) t.is(unflattenedDefaultOptions.json5, expected.json5)
  if ('sources' in expected) t.deepEqual(sources, expected.sources)
  if ('unflattenedDefaultOptions' in expected) t.deepEqual(unflattenedDefaultOptions, expected.unflattenedDefaultOptions)
  if ('unflattenedEnvOptions' in expected) t.deepEqual(unflattenedEnvOptions, expected.unflattenedEnvOptions)
}

{
  const one = {
    options: {
      plugins: ['foo'],
      presets: [['./bar', {hello: 'world'}]],
      sourceMaps: true
    },
    source: '1'
  }
  const two = {
    options: {
      parserOpts: {foo: 1},
      plugins: [['./baz', {}], 'foo'],
      presets: [['qux']],
      sourceMaps: false
    },
    source: '2'
  }
  const three = {
    options: {
      parserOpts: {foo: 2},
      presets: [['./bar', {goodbye: true}]]
    },
    source: '3'
  }
  const four = {
    options: {
      plugins: ['quux']
    },
    source: '4'
  }

  test('reduces config chains', reduces, [one, two], new Map([['foo', [one, two, three, four]]]), {
    dependencies: [
      {default: true, envs: new Set(['foo']), filename: './bar', fromPackage: null},
      {default: true, envs: new Set(['foo']), filename: './baz', fromPackage: null},
      {default: true, envs: new Set(['foo']), filename: 'babel-plugin-foo', fromPackage: '.'},
      {default: false, envs: new Set(['foo']), filename: 'babel-plugin-quux', fromPackage: '.'},
      {default: true, envs: new Set(['foo']), filename: 'babel-preset-qux', fromPackage: '.'}
    ],
    envNames: new Set(['foo']),
    sources: [
      {default: true, envs: new Set(['foo']), source: '1'},
      {default: true, envs: new Set(['foo']), source: '2'},
      {default: false, envs: new Set(['foo']), source: '3'},
      {default: false, envs: new Set(['foo']), source: '4'}
    ],
    unflattenedDefaultOptions: Object.assign([
      {
        babelrc: false,
        parserOpts: {foo: 1},
        plugins: ['babel-plugin-foo'],
        presets: [['./bar', {hello: 'world'}]],
        sourceMaps: false
      },
      {
        plugins: [['./baz', {}], 'babel-plugin-foo'],
        presets: ['babel-preset-qux']
      }
    ], {json5: false}),
    unflattenedEnvOptions: new Map([
      ['foo', Object.assign([
        {
          babelrc: false,
          parserOpts: {foo: 2},
          plugins: ['babel-plugin-foo'],
          presets: [['./bar', {hello: 'world'}]],
          sourceMaps: false
        },
        {
          plugins: [['./baz', {}], 'babel-plugin-foo'],
          presets: ['babel-preset-qux']
        },
        {
          presets: [['./bar', {goodbye: true}]]
        },
        {
          plugins: ['babel-plugin-quux']
        }
      ], {json5: false})]
    ])
  })
}

test('babelrc option is always false', reduces, [
  {
    options: {
      babelrc: true
    }
  }
], new Map(), {
  unflattenedDefaultOptions: Object.assign([{
    babelrc: false
  }], {json5: false})
})

test('removes non-array plugins and presets values', reduces, [
  {
    options: {
      plugins: 'plugins',
      presets: 'presets'
    }
  }
], new Map(), {
  unflattenedDefaultOptions: Object.assign([
    {
      babelrc: false,
      plugins: [],
      presets: []
    }
  ], {json5: false})
})

test('json5 remains false if none of the configs were parsed using JSON5', reduces, [
  {
    json5: false,
    options: {}
  },
  {
    json5: false,
    options: {}
  }
], new Map(), {
  json5: false
})

test('json5 becomes true if some of the configs were parsed using JSON5', reduces, [
  {
    json5: true,
    options: {}
  },
  {
    json5: false,
    options: {}
  }
], new Map(), {
  json5: true
})

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
