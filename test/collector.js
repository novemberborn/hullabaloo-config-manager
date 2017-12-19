import fs from 'fs'

import test from 'ava'
import proxyquire from 'proxyquire'
import td from 'testdouble'

import {createConfig, prepareCache} from '..'
import * as collector from '../build/collector'
import fixture from './helpers/fixture'

const compare = async (t, resolveChains, expected) => {
  const chain = (await resolveChains()).defaultChain
  const pairs = Array.from(chain, (config, index) => [config, expected[index]])
  t.true(pairs.length === expected.length)

  let index = 0
  for (const [config, expectedConfig] of pairs) {
    for (const prop of Object.keys(expectedConfig)) {
      t.deepEqual(config[prop], expectedConfig[prop], `${index}.${prop}`)
    }
    index++
  }
}

const compareEnv = async (t, resolveChains, envName, expected) => {
  const chain = (await resolveChains(envName)).envChains.get(envName)
  const pairs = Array.from(chain, (config, index) => [config, expected[index]])
  t.true(pairs.length === expected.length)

  let index = 0
  for (const [config, expectedConfig] of pairs) {
    for (const prop of Object.keys(expectedConfig)) {
      t.deepEqual(config[prop], expectedConfig[prop], `${index}.${prop}`)
    }
    index++
  }
}

{
  // Exercise babel-config-chain assertions, based on
  // <https://github.com/babel/babel/blob/d76092b2ddd86ecaa9df2a23610fd86a34ed379b/packages/babel-core/test/config-chain.js>,
  // but without using virtual configs.

  const [root, dir2, pkg, env] = ['', 'dir2', 'pkg', 'env']
    .map(dir => fixture('babel-config-chain', dir))
    .map(expanded => envName => collector.fromDirectory(expanded, envName && [envName]))

  test('babel-config-chain: root', compare, root, [
    {
      options: {
        plugins: ['extended']
      },
      source: fixture('babel-config-chain', 'extended.babelrc.json')
    },
    {
      options: {
        plugins: ['root']
      },
      source: fixture('babel-config-chain', '.babelrc')
    }
  ])

  test('babel-config-chain: dir2', compare, dir2, [
    {
      options: {
        plugins: ['dir2']
      },
      source: fixture('babel-config-chain', 'dir2', '.babelrc')
    }
  ])

  test('babel-config-chain: pkg', compare, pkg, [
    {
      options: {
        plugins: ['pkg-plugin']
      },
      source: fixture('babel-config-chain', 'pkg', 'package.json')
    }
  ])

  test('babel-config-chain: env - base', compare, env, [
    {
      options: {
        plugins: ['env-base']
      },
      source: fixture('babel-config-chain', 'env', '.babelrc')
    }
  ])

  test('babel-config-chain: env - foo', compareEnv, env, 'foo', [
    {
      options: {
        plugins: ['env-base']
      },
      source: fixture('babel-config-chain', 'env', '.babelrc')
    },
    {
      options: {
        plugins: ['env-foo']
      },
      source: fixture('babel-config-chain', 'env', '.babelrc')
    }
  ])

  test('babel-config-chain: env - bar', compareEnv, env, 'bar', [
    {
      options: {
        plugins: ['env-base']
      },
      source: fixture('babel-config-chain', 'env', '.babelrc')
    },
    {
      options: {
        plugins: ['env-bar']
      },
      source: fixture('babel-config-chain', 'env', '.babelrc')
    }
  ])
}

{
  // Exercise babel-config-chain assertions, based on
  // <https://github.com/babel/babel/blob/d76092b2ddd86ecaa9df2a23610fd86a34ed379b/packages/babel-core/test/config-chain.js>,
  // but without using virtual configs, modified to use JS modules rather than
  // JSON5 files.

  const [root, dir2, pkg, env] = ['', 'dir2', 'pkg', 'env']
    .map(dir => fixture('babel-config-chain-js', dir))
    .map(expanded => envName => collector.fromDirectory(expanded, envName && [envName]))

  test('babel-config-chain-js: root', compare, root, [
    {
      options: {
        plugins: ['extended']
      },
      source: fixture('babel-config-chain-js', 'extended.babelrc.js')
    },
    {
      options: {
        plugins: ['root']
      },
      source: fixture('babel-config-chain-js', '.babelrc.js')
    }
  ])

  test('babel-config-chain-js: dir2', compare, dir2, [
    {
      options: {
        plugins: ['dir2']
      },
      source: fixture('babel-config-chain-js', 'dir2', '.babelrc.js')
    }
  ])

  test('babel-config-chain-js: pkg', compare, pkg, [
    {
      options: {
        plugins: ['pkg-plugin']
      },
      source: fixture('babel-config-chain-js', 'pkg', 'package.json')
    }
  ])

  test('babel-config-chain-js: env - base', compare, env, [
    {
      options: {
        plugins: ['env-base']
      },
      source: fixture('babel-config-chain-js', 'env', '.babelrc.js')
    }
  ])

  test('babel-config-chain-js: env - foo', compareEnv, env, 'foo', [
    {
      options: {
        plugins: [
          'env-base'
        ]
      },
      source: fixture('babel-config-chain-js', 'env', '.babelrc.js')
    },
    {
      options: {
        plugins: [
          'env-foo'
        ]
      },
      source: fixture('babel-config-chain-js', 'env', '.babelrc.js')
    }
  ])

  test('babel-config-chain-js: env - bar', compareEnv, env, 'bar', [
    {
      options: {
        plugins: [
          'env-base',
          'env-bar'
        ]
      },
      source: fixture('babel-config-chain-js', 'env', '.babelrc.js')
    }
  ])
}

{
  const babelrc = () => collector.fromConfig(createConfig({
    options: {plugins: ['created-config']},
    source: fixture('babelrc', 'source.js')
  }))
  const js = () => collector.fromConfig(createConfig({
    options: {plugins: ['created-config']},
    source: fixture('js', 'source.js')
  }))
  const pkg = () => collector.fromConfig(createConfig({
    options: {plugins: ['created-config']},
    source: fixture('pkg', 'source.js')
  }))
  const disabled = () => collector.fromConfig(createConfig({
    options: {babelrc: false, plugins: ['created-config']},
    source: fixture('babelrc', 'source.js')
  }))

  test('fromConfig() with .babelrc', compare, babelrc, [
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('babelrc', '.babelrc')
    },
    {
      options: {
        plugins: ['created-config']
      },
      source: fixture('babelrc', 'source.js')
    }
  ])

  test('fromConfig() with .babelrc.js', compare, js, [
    {
      options: {
        plugins: ['js']
      },
      source: fixture('js', '.babelrc.js')
    },
    {
      options: {
        plugins: ['created-config']
      },
      source: fixture('js', 'source.js')
    }
  ])

  test('fromConfig() with package.json', compare, pkg, [
    {
      options: {
        plugins: ['pkg']
      },
      source: fixture('pkg', 'package.json')
    },
    {
      options: {
        plugins: ['created-config']
      },
      source: fixture('pkg', 'source.js')
    }
  ])

  test('fromConfig() with babelrc lookup disabled', compare, disabled, [
    {
      options: {
        babelrc: false,
        plugins: ['created-config']
      },
      source: fixture('babelrc', 'source.js')
    }
  ])
}

{
  const simpleCycle = () => collector.fromDirectory(fixture('cycles', 'simple'))
  const deepCycle = () => collector.fromDirectory(fixture('cycles', 'deep'))

  test('simple cycle', compare, simpleCycle, [
    {
      options: {
        plugins: ['extended']
      },
      source: fixture('cycles', 'simple', 'extended.json5')
    },
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('cycles', 'simple', '.babelrc')
    }
  ])

  test('deep cycle', compare, deepCycle, [
    {
      options: {
        plugins: ['extended-furthest']
      },
      source: fixture('cycles', 'deep', 'extended-furthest.json5')
    },
    {
      options: {
        plugins: ['extended']
      },
      source: fixture('cycles', 'deep', 'extended.json5')
    },
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('cycles', 'deep', '.babelrc')
    }
  ])
}

{
  const empty = () => collector.fromConfig(createConfig({
    options: {plugins: ['created-config']},
    source: fixture('empty', 'source.js')
  }))
  test('fromConfig() from empty directory', compare, empty, [
    {
      options: {
        plugins: ['created-config']
      },
      source: fixture('empty', 'source.js')
    }
  ])
}

{
  const source = fixture('repeats', 'virtual.json')
  const repeats = () => collector.fromConfig(createConfig({
    options: require(source), // eslint-disable-line import/no-dynamic-require
    source
  }))
  test('includes configs but once', compare, repeats, [
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('repeats', '.babelrc')
    },
    {
      options: {
        babelrc: true,
        plugins: [
          'virtual'
        ]
      },
      source
    }
  ])
}

{
  const complex = envName => collector.fromDirectory(fixture('complex-env'), [envName])
  test('resolves complex enviroment chains', compareEnv, complex, 'foo', [
    {
      options: {
        plugins: ['extended-further']
      },
      source: fixture('complex-env', 'extended-further.json5')
    },
    {
      options: {
        plugins: ['extended-further/env/foo']
      },
      source: fixture('complex-env', 'extended-further.json5')
    },
    {
      options: {
        plugins: ['extended']
      },
      source: fixture('complex-env', 'extended.js')
    },
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('complex-env', '.babelrc')
    },
    {
      options: {
        plugins: ['foo']
      },
      source: fixture('complex-env', 'foo.json5')
    },
    {
      options: {
        plugins: ['foo/env/foo']
      },
      source: fixture('complex-env', 'foo.json5')
    },
    {
      options: {
        plugins: ['babelrc/env/foo']
      },
      source: fixture('complex-env', '.babelrc')
    }
  ])
}

{
  const absExtends = () => collector.fromConfig(createConfig({
    options: {
      babelrc: false,
      extends: fixture('babelrc', '.babelrc')
    },
    source: __filename
  }))
  test('accepts absolute paths in extends clauses', compare, absExtends, [
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('babelrc', '.babelrc')
    },
    {
      options: {
        babelrc: false
      },
      source: __filename
    }
  ])
}

test('returns null when resolving a directory without configs', async t => {
  t.true((await collector.fromDirectory(fixture('empty'))) === null)
})

test('if options were found from directory, provides babelrcDir', async t => {
  const {babelrcDir} = await collector.fromDirectory(fixture('babelrc'))
  t.is(babelrcDir, fixture('babelrc'))
})

test('with a created config, provides babelrcDir', async t => {
  const options = {
    plugins: ['created-config']
  }
  const source = fixture('babelrc', 'source.js')

  const {babelrcDir} = await collector.fromConfig(createConfig({
    options,
    source
  }))
  t.is(babelrcDir, fixture('babelrc'))
})

{
  const base = createConfig({
    options: {
      babelrc: false,
      plugins: ['base']
    },
    source: 'base'
  })
  const middle = createConfig({
    options: {
      babelrc: false,
      plugins: ['middle']
    },
    source: 'middle'
  })
  const root = createConfig({
    options: {
      babelrc: false,
      plugins: ['root']
    },
    source: 'root'
  })
  base.extend(middle)
  middle.extend(root)

  test('created configs can extend other created configs', compare, () => collector.fromConfig(base), [
    {
      options: {
        babelrc: false,
        plugins: ['root']
      },
      source: 'root'
    },
    {
      options: {
        babelrc: false,
        plugins: ['middle']
      },
      source: 'middle'
    },
    {
      options: {
        babelrc: false,
        plugins: ['base']
      },
      source: 'base'
    }
  ])
}

test('created configs cannot have an extend option and extend another created config', t => {
  const base = createConfig({
    options: {
      extends: './foo'
    },
    source: 'base'
  })
  const other = createConfig({
    options: {},
    source: 'other'
  })

  const err = t.throws(() => base.extend(other), TypeError)
  t.is(err.message, 'Cannot extend config: there is an extends clause in the current options: ./foo')
})

test('created configs cannot extend more than one created config', t => {
  const base = createConfig({
    options: {},
    source: 'base'
  })
  const other = createConfig({
    options: {},
    source: 'other'
  })
  const yetAnother = createConfig({
    options: {},
    source: 'yetAnother'
  })
  base.extend(other)

  const err = t.throws(() => base.extend(yetAnother), Error)
  t.is(err.message, 'Cannot extend config: already extended')
})

test('only one created config can have its babelrc option enabled', async t => {
  const base = createConfig({
    options: {
      babelrc: false // explicitly disable
    },
    source: 'base'
  })
  const other = createConfig({
    options: {
      babelrc: true // explicitly enable
    },
    source: 'other'
  })
  const yetAnother = createConfig({
    options: {
      // implicitly enabled
    },
    source: 'yetAnother'
  })
  base.extend(other)
  other.extend(yetAnother)

  const err = await t.throws(collector.fromConfig(base), TypeError)
  t.is(err.message, 'yetAnother: Cannot resolve babelrc option, already resolved by other')
})

test('chains can be iterated over', async t => {
  const chains = await collector.fromDirectory(fixture('complex-env'))
  const [defaultChain, foo] = chains
  t.is(defaultChain, chains.defaultChain)
  t.is(foo, chains.envChains.get('foo'))
})

test('a cache can be used for file access', async t => {
  const readFile = td.function()
  for (const filename of [
    fixture('complex-env', '.babelrc'),
    fixture('complex-env', 'extended-further.json5'),
    fixture('complex-env', 'foo.json5')
  ]) {
    td.when(readFile(filename)).thenCallback(null, fs.readFileSync(filename))
  }
  try {
    fs.readFileSync(fixture('complex-env', 'package.json'))
  } catch (err) {
    td.when(readFile(fixture('complex-env', 'package.json'))).thenCallback(err)
  }

  const {fromDirectory} = proxyquire('../build/collector', {
    './readSafe': proxyquire('../build/readSafe', {
      'graceful-fs': {readFile}
    })
  })

  const sharedCache = prepareCache()

  await Promise.all([
    fromDirectory(fixture('complex-env'), [], sharedCache),
    fromDirectory(fixture('complex-env'), [], sharedCache)
  ])

  const {callCount} = td.explain(readFile)
  t.is(callCount, 4)
})

test('supports CJS exports in .babelrc.js files',
  compare,
  () => collector.fromDirectory(fixture('js', 'cjs-object')),
  [
    {
      options: {
        plugins: ['cjs-object']
      },
      source: fixture('js', 'cjs-object', '.babelrc.js')
    }
  ])

test('supports CJS factory exports in .babelrc.js files',
  compare,
  () => collector.fromDirectory(fixture('js', 'cjs-factory')),
  [
    {
      options: {
        plugins: ['cjs-factory']
      },
      source: fixture('js', 'cjs-factory', '.babelrc.js')
    }
  ])

test('supports __esModule default export in .babelrc.js files',
  compare,
  () => collector.fromDirectory(fixture('js', 'esm-object')),
  [
    {
      options: {
        plugins: ['esm-object']
      },
      source: fixture('js', 'esm-object', '.babelrc.js')
    }
  ])

test('supports __esModule factory default export in .babelrc.js files',
  compare,
  () => collector.fromDirectory(fixture('js', 'esm-factory')),
  [
    {
      options: {
        plugins: ['esm-factory']
      },
      source: fixture('js', 'esm-factory', '.babelrc.js')
    }
  ])

test('a cache can be used for factory modules', async t => {
  {
    const {getCount} = require('./fixtures/js/cache-usage/forever/.babelrc.js')
    const sharedCache = prepareCache()
    await Promise.all([
      collector.fromDirectory(fixture('js', 'cache-usage', 'forever'), ['foo'], sharedCache),
      collector.fromDirectory(fixture('js', 'cache-usage', 'forever'), ['bar'], sharedCache)
    ])
    t.is(getCount(), 1, 'forever')
  }

  {
    const {getCount} = require('./fixtures/js/cache-usage/never/.babelrc.js')
    const sharedCache = prepareCache()
    await Promise.all([
      collector.fromDirectory(fixture('js', 'cache-usage', 'never'), ['foo'], sharedCache),
      collector.fromDirectory(fixture('js', 'cache-usage', 'never'), ['bar'], sharedCache)
    ])
    t.is(getCount(), 2, 'never')
  }

  {
    const {getCount} = require('./fixtures/js/cache-usage/env/.babelrc.js')
    const sharedCache = prepareCache()
    await Promise.all([
      collector.fromDirectory(fixture('js', 'cache-usage', 'env'), ['foo'], sharedCache),
      collector.fromDirectory(fixture('js', 'cache-usage', 'env'), ['bar'], sharedCache)
    ])
    t.is(getCount(), 2, 'env')

    await collector.fromDirectory(fixture('js', 'cache-usage', 'env'), ['foo'], sharedCache)
    t.is(getCount(), 2, 'env (just foo)')

    await collector.fromDirectory(fixture('js', 'cache-usage', 'env'), ['foo', 'baz'], sharedCache)
    t.is(getCount(), 3, 'env (foo and baz)')
  }

  {
    const {getCount} = require('./fixtures/js/cache-usage/static/.babelrc.js')
    const sharedCache = prepareCache()
    await Promise.all([
      collector.fromDirectory(fixture('js', 'cache-usage', 'static'), [], sharedCache),
      collector.fromDirectory(fixture('js', 'cache-usage', 'static'), [], sharedCache)
    ])
    t.is(getCount(), 1, 'static')
  }
})
