import test from 'ava'
import proxyquire from 'proxyquire'

import reduceOptions from '../lib/reduceOptions'
import pkgDirMock from './helpers/pkgDirMock'

const resolvePluginsAndPresets = proxyquire('../lib/resolvePluginsAndPresets', {
  'pkg-dir': pkgDirMock,
  'resolve-from' (dir, ref) {
    return ref
  }
})

const reduces = (t, chain, expected) => {
  const {
    dependencies,
    json5,
    sources,
    unflattenedOptions
  } = reduceOptions(chain, resolvePluginsAndPresets([chain]))

  if ('dependencies' in expected) t.deepEqual(dependencies, expected.dependencies)
  if ('json5' in expected) t.is(json5, expected.json5)
  if ('sources' in expected) t.deepEqual(sources, expected.sources)
  if ('unflattenedOptions' in expected) t.deepEqual(unflattenedOptions, expected.unflattenedOptions)
}

test('reduces a config chain', reduces, [
  {
    options: {
      plugins: ['foo'],
      presets: [['./bar', {hello: 'world'}]],
      sourceMaps: true
    },
    source: '1'
  },
  {
    options: {
      parserOpts: { foo: 1 },
      plugins: [['./baz', {}], 'foo'],
      presets: ['qux'],
      sourceMaps: false
    },
    source: '2'
  },
  {
    options: {
      parserOpts: { foo: 2 },
      presets: [['./bar', {goodbye: true}]]
    },
    source: '3'
  }
], {
  dependencies: [
    { filename: 'babel-plugin-foo', fromPackage: '.' },
    { filename: './bar', fromPackage: null },
    { filename: './baz', fromPackage: null },
    { filename: 'babel-preset-qux', fromPackage: '.' }
  ],
  sources: ['1', '2', '3'],
  unflattenedOptions: [
    {
      babelrc: false,
      parserOpts: { foo: 2 },
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
    }
  ]
})

test('babelrc option is always false', reduces, [
  {
    options: {
      babelrc: true
    }
  }
], {
  unflattenedOptions: [{
    babelrc: false
  }]
})

test('removes non-array plugins and presets values', reduces, [
  {
    options: {
      plugins: 'plugins',
      presets: 'presets'
    }
  }
], {
  unflattenedOptions: [
    {
      babelrc: false,
      plugins: [],
      presets: []
    }
  ]
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
], {
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
], {
  json5: true
})
