import fs from 'fs'

import test from 'ava'
import isMatch from 'lodash.ismatch'
import proxyquire from 'proxyquire'
import td from 'testdouble'

import collector from '../lib/collector'
import fixture from './helpers/fixture'

const compare = async (t, resolveChains, expected) => {
  const actual = (await resolveChains()).withoutEnv
  t.true(isMatch(actual, expected))
}

const compareEnv = async (t, resolveChains, env, expected) => {
  const actual = (await resolveChains()).byEnv.get(env)
  t.true(isMatch(actual, expected))
}

{
  // Exercise babel-config-chain assertions, based on
  // <https://github.com/babel/babel/blob/d76092b2ddd86ecaa9df2a23610fd86a34ed379b/packages/babel-core/test/config-chain.js>,
  // but without using virtual configs.

  const [root, dir2, pkg, env] = ['', 'dir2', 'pkg', 'env']
    .map(dir => fixture('babel-config-chain', dir))
    .map(expanded => () => collector.fromDirectory(expanded))

  test('babel-config-chain: root', compare, root, new Set([
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
  ]))

  test('babel-config-chain: dir2', compare, dir2, new Set([
    {
      options: {
        plugins: ['dir2']
      },
      source: fixture('babel-config-chain', 'dir2', '.babelrc')
    }
  ]))

  test('babel-config-chain: pkg', compare, pkg, new Set([
    {
      options: {
        plugins: ['pkg-plugin']
      },
      source: fixture('babel-config-chain', 'pkg', 'package.json')
    }
  ]))

  test('babel-config-chain: env - base', compare, env, new Set([
    {
      options: {
        plugins: ['env-base']
      },
      source: fixture('babel-config-chain', 'env', '.babelrc')
    }
  ]))

  test('babel-config-chain: env - foo', compareEnv, env, 'foo', new Set([
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
  ]))

  test('babel-config-chain: env - bar', compareEnv, env, 'bar', new Set([
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
  ]))
}

{
  const babelrc = () => collector.fromVirtual({ plugins: ['virtual'] }, fixture('babelrc', 'source.js'))
  const pkg = () => collector.fromVirtual({ plugins: ['virtual'] }, fixture('pkg', 'source.js'), null, false)
  const disabled = () => collector.fromVirtual({ babelrc: false, plugins: ['virtual'] }, fixture('babelrc', 'source.js'))

  test('virtual with .babelrc', compare, babelrc, new Set([
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('babelrc', '.babelrc'),
      json5: true
    },
    {
      options: {
        plugins: ['virtual']
      },
      source: fixture('babelrc', 'source.js'),
      json5: true
    }
  ]))

  test('virtual with package.json', compare, pkg, new Set([
    {
      options: {
        plugins: ['pkg']
      },
      source: fixture('pkg', 'package.json'),
      json5: false
    },
    {
      options: {
        plugins: ['virtual']
      },
      source: fixture('pkg', 'source.js'),
      json5: false
    }
  ]))

  test('virtual with babelrc lookup disabled', compare, disabled, new Set([
    {
      options: {
        babelrc: false,
        plugins: ['virtual']
      },
      source: fixture('babelrc', 'source.js'),
      json5: true
    }
  ]))
}

{
  const simpleCycle = () => collector.fromDirectory(fixture('cycles', 'simple'))
  const deepCycle = () => collector.fromDirectory(fixture('cycles', 'deep'))

  test('simple cycle', compare, simpleCycle, new Set([
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
  ]))

  test('deep cycle', compare, deepCycle, new Set([
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
  ]))
}

{
  const emptyVirtual = () => collector.fromVirtual({ plugins: ['virtual'] }, fixture('empty', 'source.js'))
  test('virtual from empty directory', compare, emptyVirtual, new Set([
    {
      options: {
        plugins: ['virtual']
      },
      source: fixture('empty', 'source.js')
    }
  ]))
}

{
  const virtualSource = fixture('repeats', 'virtual.json')
  const repeats = () => collector.fromVirtual(require(virtualSource), virtualSource) // eslint-disable-line import/no-dynamic-require
  test('includes configs but once', compare, repeats, new Set([
    {
      options: {
        plugins: ['babelrc']
      },
      source: fixture('repeats', '.babelrc')
    },
    {
      options: {
        plugins: ['virtual']
      },
      source: virtualSource
    }
  ]))
}

{
  const complex = () => collector.fromDirectory(fixture('complex-env'))
  test('resolves complex enviroment chains', compareEnv, complex, 'foo', new Set([
    {
      options: {
        plugins: ['extended-further']
      },
      source: fixture('complex-env', 'extended-further.json5')
    },
    {
      options: {
        plugins: ['extended']
      },
      source: fixture('complex-env', 'extended.json5')
    },
    {
      options: {
        plugins: ['extended-further/env/foo']
      },
      source: fixture('complex-env', 'extended-further.json5')
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
  ]))
}

{
  const absExtends = () => collector.fromVirtual({
    babelrc: false,
    extends: fixture('babelrc', '.babelrc')
  }, __filename)
  test('accepts absolute paths in extends clauses', compare, absExtends, new Set([
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
  ]))
}

test('returns null when resolving a directory without configs', async t => {
  t.true((await collector.fromDirectory(fixture('empty'))) === null)
})

test('does not modify virtual options', async t => {
  const options = {
    env: {
      foo: {
        env: {
          bar: {}
        }
      }
    }
  }

  await collector.fromVirtual(options, fixture())
  t.deepEqual(options, {
    env: {
      foo: {
        env: {
          bar: {}
        }
      }
    }
  })
})

test('if options were found from directory, provides babelrcDir', async t => {
  const { babelrcDir } = await collector.fromDirectory(fixture('babelrc'))
  t.is(babelrcDir, fixture('babelrc'))
})

test('with virtual options, provides babelrcDir', async t => {
  const options = {
    plugins: ['virtual']
  }
  const source = fixture('babelrc', 'source.js')

  const { babelrcDir } = await collector.fromVirtual(options, source)
  t.is(babelrcDir, fixture('babelrc'))
})

test('chains can be iterated over', async t => {
  const chains = await collector.fromDirectory(fixture('complex-env'))
  const [withoutEnv, foo] = chains
  t.is(withoutEnv, chains.withoutEnv)
  t.is(foo, chains.byEnv.get('foo'))
})

test('a cache can be used for file access', async t => {
  const readFile = td.function()
  for (const filename of [
    fixture('complex-env', '.babelrc'),
    fixture('complex-env', 'extended-further.json5'),
    fixture('complex-env', 'extended.json5'),
    fixture('complex-env', 'foo.json5')
  ]) {
    td.when(readFile(filename)).thenCallback(null, fs.readFileSync(filename))
  }
  try {
    fs.readFileSync(fixture('complex-env', 'package.json'))
  } catch (err) {
    td.when(readFile(fixture('complex-env', 'package.json'))).thenCallback(err)
  }

  const { fromDirectory } = proxyquire('../lib/collector', {
    'graceful-fs': { readFile }
  })

  const sharedCache = {
    files: new Map()
  }

  await Promise.all([
    fromDirectory(fixture('complex-env'), sharedCache),
    fromDirectory(fixture('complex-env'), sharedCache)
  ])

  const { callCount } = td.explain(readFile)
  t.is(callCount, 5)
})
