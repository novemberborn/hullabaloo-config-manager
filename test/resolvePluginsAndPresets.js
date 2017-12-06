import path from 'path'

import test from 'ava'
import proxyquire from 'proxyquire'
import td from 'testdouble'

import pkgDirMock from './helpers/pkgDirMock'

{
  const {default: resolvePluginsAndPresets} = proxyquire('../build/resolvePluginsAndPresets', {
    'pkg-dir': pkgDirMock,
    'resolve-from': {
      silent (dir, ref) {
        if (path.isAbsolute(ref)) {
          return ref
        }

        if (ref.startsWith('./') || ref.startsWith('../')) {
          return path.resolve(dir, ref + '.js')
        }

        if (ref.includes('exact') && ref.replace(/^@.+?\//, '').startsWith('babel-')) {
          return null
        }

        return path.resolve('node_modules', ref, 'index.js')
      }
    }
  })

  const resolves = (t, chains, expected) => {
    t.deepEqual(resolvePluginsAndPresets(chains), expected)
  }

  {
    const config = {
      options: {
        plugins: [
          'plugin',
          'babel-plugin-plugin',
          '@babel/plugin',
          '@babel/plugin-plugin',
          ['plugin-with-options', {}],
          '../relative-plugin',
          'module:exact-plugin',
          '@scope/plugin',
          'module:@scope/exact-plugin'
        ],
        presets: [
          'preset',
          'babel-preset-preset',
          '@babel/preset',
          '@babel/preset-preset',
          ['preset-with-options', {}],
          '../relative-preset',
          'module:exact-preset',
          '@scope/preset',
          'module:@scope/exact-preset'
        ]
      },
      dir: path.resolve('my-configs')
    }

    test('resolves plugins and presets', resolves, [
      [config]
    ], new Map([
      [config, {
        plugins: new Map([
          ['plugin', {
            filename: path.resolve('node_modules/babel-plugin-plugin/index.js'),
            fromPackage: path.resolve('node_modules/babel-plugin-plugin')
          }],
          ['babel-plugin-plugin', {
            filename: path.resolve('node_modules/babel-plugin-plugin/index.js'),
            fromPackage: path.resolve('node_modules/babel-plugin-plugin')
          }],
          ['@babel/plugin', {
            filename: path.resolve('node_modules/@babel/plugin-plugin/index.js'),
            fromPackage: path.resolve('node_modules/@babel/plugin-plugin')
          }],
          ['@babel/plugin-plugin', {
            filename: path.resolve('node_modules/@babel/plugin-plugin/index.js'),
            fromPackage: path.resolve('node_modules/@babel/plugin-plugin')
          }],
          ['plugin-with-options', {
            filename: path.resolve('node_modules/babel-plugin-plugin-with-options/index.js'),
            fromPackage: path.resolve('node_modules/babel-plugin-plugin-with-options')
          }],
          ['../relative-plugin', {
            filename: path.resolve('relative-plugin.js'),
            fromPackage: null
          }],
          ['module:exact-plugin', {
            filename: path.resolve('node_modules/exact-plugin/index.js'),
            fromPackage: path.resolve('node_modules/exact-plugin')
          }],
          ['@scope/plugin', {
            filename: path.resolve('node_modules/@scope/babel-plugin-plugin/index.js'),
            fromPackage: path.resolve('node_modules/@scope/babel-plugin-plugin')
          }],
          ['module:@scope/exact-plugin', {
            filename: path.resolve('node_modules/@scope/exact-plugin/index.js'),
            fromPackage: path.resolve('node_modules/@scope/exact-plugin')
          }]
        ]),
        presets: new Map([
          ['preset', {
            filename: path.resolve('node_modules/babel-preset-preset/index.js'),
            fromPackage: path.resolve('node_modules/babel-preset-preset')
          }],
          ['babel-preset-preset', {
            filename: path.resolve('node_modules/babel-preset-preset/index.js'),
            fromPackage: path.resolve('node_modules/babel-preset-preset')
          }],
          ['@babel/preset', {
            filename: path.resolve('node_modules/@babel/preset-preset/index.js'),
            fromPackage: path.resolve('node_modules/@babel/preset-preset')
          }],
          ['@babel/preset-preset', {
            filename: path.resolve('node_modules/@babel/preset-preset/index.js'),
            fromPackage: path.resolve('node_modules/@babel/preset-preset')
          }],
          ['preset-with-options', {
            filename: path.resolve('node_modules/babel-preset-preset-with-options/index.js'),
            fromPackage: path.resolve('node_modules/babel-preset-preset-with-options')
          }],
          ['../relative-preset', {
            filename: path.resolve('relative-preset.js'),
            fromPackage: null
          }],
          ['module:exact-preset', {
            filename: path.resolve('node_modules/exact-preset/index.js'),
            fromPackage: path.resolve('node_modules/exact-preset')
          }],
          ['@scope/preset', {
            filename: path.resolve('node_modules/@scope/babel-preset-preset/index.js'),
            fromPackage: path.resolve('node_modules/@scope/babel-preset-preset')
          }],
          ['module:@scope/exact-preset', {
            filename: path.resolve('node_modules/@scope/exact-preset/index.js'),
            fromPackage: path.resolve('node_modules/@scope/exact-preset')
          }]
        ])
      }]
    ]))
  }

  {
    const first = {
      options: {
        plugins: [
          'plugin'
        ]
      },
      dir: path.resolve('my-configs')
    }
    const second = {
      options: {
        presets: [
          'preset'
        ]
      },
      dir: path.resolve('my-configs')
    }

    const expected = new Map([
      [first, {
        plugins: new Map([
          ['plugin', {
            filename: path.resolve('node_modules/babel-plugin-plugin/index.js'),
            fromPackage: path.resolve('node_modules/babel-plugin-plugin')
          }]
        ]),
        presets: new Map()
      }],
      [second, {
        plugins: new Map(),
        presets: new Map([
          ['preset', {
            filename: path.resolve('node_modules/babel-preset-preset/index.js'),
            fromPackage: path.resolve('node_modules/babel-preset-preset')
          }]
        ])
      }]
    ])

    test('resolves multiple configs in a chain', resolves, [[first, second]], expected)
    test('resolves multiple chains', resolves, [[first], [second]], expected)
  }
}

test('caches results', t => {
  const resolveFrom = td.object({silent () {}})
  td.when(resolveFrom.silent(td.matchers.anything(), td.matchers.anything())).thenReturn('/stubbed/path')

  const {default: resolvePluginsAndPresets} = proxyquire('../build/resolvePluginsAndPresets', {
    'pkg-dir': pkgDirMock,
    'resolve-from': resolveFrom
  })

  const config = {
    options: {
      plugins: [
        'foo'
      ],
      presets: [
        'foo'
      ]
    },
    dir: path.resolve('bar')
  }
  resolvePluginsAndPresets([
    [
      config,
      {
        options: {
          plugins: [
            'foo',
            'baz'
          ]
        },
        dir: path.resolve('bar')
      }
    ],
    [
      {
        options: {
          plugins: [
            'foo',
            'baz'
          ]
        },
        dir: path.resolve('qux')
      },
      config
    ]
  ])

  const {callCount, calls} = td.explain(resolveFrom.silent)
  t.is(callCount, 5)
  t.deepEqual(calls.shift().args, [path.resolve('bar'), 'babel-plugin-foo'])
  t.deepEqual(calls.shift().args, [path.resolve('bar'), 'babel-preset-foo'])
  t.deepEqual(calls.shift().args, [path.resolve('bar'), 'babel-plugin-baz'])
  t.deepEqual(calls.shift().args, [path.resolve('qux'), 'babel-plugin-foo'])
  t.deepEqual(calls.shift().args, [path.resolve('qux'), 'babel-plugin-baz'])
})

test('caches can be shared', t => {
  const resolveFrom = td.object({silent () {}})
  td.when(resolveFrom.silent(td.matchers.anything(), td.matchers.anything())).thenReturn('/stubbed/path')

  const sharedCache = {
    pluginsAndPresets: new Map()
  }

  const {default: resolvePluginsAndPresets} = proxyquire('../build/resolvePluginsAndPresets', {
    'resolve-from': resolveFrom
  })

  const config = {
    options: {
      plugins: [
        'foo'
      ],
      presets: [
        'foo'
      ]
    },
    dir: path.resolve('bar')
  }

  ;[1, 2].forEach(() => {
    resolvePluginsAndPresets([
      [
        config,
        {
          options: {
            plugins: [
              'foo',
              'baz'
            ]
          },
          dir: path.resolve('bar')
        }
      ],
      [
        {
          options: {
            plugins: [
              'foo',
              'baz'
            ]
          },
          dir: path.resolve('qux')
        },
        config
      ]
    ], sharedCache)
  })

  const {callCount, calls} = td.explain(resolveFrom.silent)
  t.is(callCount, 5)
  t.deepEqual(calls.shift().args, [path.resolve('bar'), 'babel-plugin-foo'])
  t.deepEqual(calls.shift().args, [path.resolve('bar'), 'babel-preset-foo'])
  t.deepEqual(calls.shift().args, [path.resolve('bar'), 'babel-plugin-baz'])
  t.deepEqual(calls.shift().args, [path.resolve('qux'), 'babel-plugin-foo'])
  t.deepEqual(calls.shift().args, [path.resolve('qux'), 'babel-plugin-baz'])
})

{
  const resolveFrom = td.object({silent () {}})
  td.when(resolveFrom.silent(td.matchers.anything(), td.matchers.anything())).thenReturn(null)

  const {default: resolvePluginsAndPresets} = proxyquire('../build/resolvePluginsAndPresets', {
    'pkg-dir': pkgDirMock,
    'resolve-from': resolveFrom
  })

  const throws = (t, kind, ref) => {
    const dir = path.resolve('foo')
    const source = path.join(dir, 'source.js')
    const config = {
      options: {
        [`${kind}s`]: [ref]
      },
      dir,
      source
    }

    const err = t.throws(() => resolvePluginsAndPresets([[config]]))
    t.is(err.name, 'ResolveError')
    t.is(err.source, source)
    t.is(err.ref, ref)
    if (kind === 'plugin') {
      t.true(err.isPlugin)
      t.false(err.isPreset)
    }
    if (kind === 'preset') {
      t.false(err.isPlugin)
      t.true(err.isPreset)
    }
  }

  test('throws if a plugin cannot be resolved', throws, 'plugin', 'my-plugin')
  test('throws if a preset cannot be resolved', throws, 'preset', 'my-preset')
}
