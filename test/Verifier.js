import fs from 'fs'
import path from 'path'

import test from 'ava'
import fse from 'fs-extra'
import md5Hex from 'md5-hex'
import packageHash from 'package-hash'
import proxyquire from 'proxyquire'
import resolveFrom from 'resolve-from'
import td from 'testdouble'
import uniqueTempDir from 'unique-temp-dir'

import {createConfig, fromConfig, fromDirectory, prepareCache} from '..'
import Verifier from '../lib/Verifier'

import fixture from './helpers/fixture'

const hashes = Object.create(null)
test.before(t => {
  const promises = []

  for (const pkg of [
    fixture('compare', 'node_modules', 'env-plugin', 'package.json'),
    fixture('compare', 'node_modules', 'plugin', 'package.json'),
    fixture('compare', 'node_modules', 'plugin-default-opts', 'package.json'),
    fixture('compare', 'node_modules', 'preset', 'package.json')
  ]) {
    promises.push(
      packageHash(pkg)
        .then(hash => (hashes[pkg] = hash)))
  }

  for (const fp of [
    fixture('compare', '.babelrc'),
    fixture('compare', 'extended-by-babelrc.json5'),
    fixture('compare', 'extended-by-virtual.json5'),
    fixture('compare', 'extended-by-virtual-foo.json5'),
    fixture('compare', 'virtual.json')
  ]) {
    promises.push(
      new Promise((resolve, reject) => {
        fs.readFile(fp, (err, contents) => err ? reject(err) : resolve(contents))
      })
        .then(md5Hex)
        .then(hash => (hashes[fp] = hash)))
  }

  return Promise.all(promises)
})

function requireWithCurrentEnv (env = {}) {
  const currentEnv = proxyquire('../lib/currentEnv', {
    process: {
      env
    }
  })

  const Verifier_ = proxyquire('../lib/Verifier', {
    './currentEnv': currentEnv
  })

  return proxyquire('../', {
    './lib/currentEnv': currentEnv,
    './lib/Verifier': Verifier_,
    './lib/ResolvedConfig': proxyquire('../lib/ResolvedConfig', {
      './Verifier': Verifier_
    })
  })
}

const tmpDir = uniqueTempDir()
test.after.always(() => {
  fse.removeSync(tmpDir)
})

test('cache is used when creating verifier', async t => {
  const source = fixture('compare', 'virtual.json')

  const env = {}
  const main = requireWithCurrentEnv(env)
  const cache = main.prepareCache()
  const result = await main.fromConfig(main.createConfig({
    options: require(source), // eslint-disable-line import/no-dynamic-require
    source
  }), {cache})

  await result.createVerifier()
  for (const dependency of [
    fixture('compare', 'node_modules', 'plugin', 'index.js'),
    fixture('compare', 'node_modules', 'plugin-default-opts', 'index.js'),
    fixture('compare', 'node_modules', 'preset', 'index.js')
  ]) {
    t.true(cache.dependencyHashes.has(dependency))
  }
  for (const file of [
    fixture('compare', '.babelrc'),
    fixture('compare', 'extended-by-babelrc.json5'),
    fixture('compare', 'extended-by-virtual.json5'),
    fixture('compare', 'extended-by-virtual-foo.json5'),
    fixture('compare', 'virtual.json')
  ]) {
    t.true(cache.sourceHashes.has(file))
  }
})

test('cacheKeysForCurrentEnv()', async t => {
  const source = fixture('compare', 'virtual.json')

  const env = {}
  const main = requireWithCurrentEnv(env)
  const cache = main.prepareCache()
  const result = await main.fromConfig(main.createConfig({
    options: require(source), // eslint-disable-line import/no-dynamic-require
    source
  }), {cache})
  const verifier = await result.createVerifier()

  t.deepEqual(verifier.cacheKeysForCurrentEnv(), {
    dependencies: md5Hex([
      hashes[fixture('compare', 'node_modules', 'plugin', 'package.json')],
      hashes[fixture('compare', 'node_modules', 'preset', 'package.json')]
    ]),
    sources: md5Hex([
      hashes[fixture('compare', '.babelrc')],
      hashes[fixture('compare', 'extended-by-babelrc.json5')],
      hashes[fixture('compare', 'extended-by-virtual.json5')],
      hashes[fixture('compare', 'virtual.json')]
    ])
  })

  env.BABEL_ENV = 'foo'
  t.deepEqual(verifier.cacheKeysForCurrentEnv(), {
    dependencies: md5Hex([
      hashes[fixture('compare', 'node_modules', 'env-plugin', 'package.json')],
      hashes[fixture('compare', 'node_modules', 'plugin-default-opts', 'package.json')],
      hashes[fixture('compare', 'node_modules', 'plugin', 'package.json')],
      hashes[fixture('compare', 'node_modules', 'preset', 'package.json')]
    ]),
    sources: md5Hex([
      hashes[fixture('compare', '.babelrc')],
      hashes[fixture('compare', 'extended-by-babelrc.json5')],
      hashes[fixture('compare', 'extended-by-virtual-foo.json5')],
      hashes[fixture('compare', 'extended-by-virtual.json5')],
      hashes[fixture('compare', 'virtual.json')]
    ])
  })
})

test('can be serialized and deserialized', t => {
  const babelrcDir = fixture('compare')
  const envNames = new Set(['foo', 'bar'])
  const dependencies = [
    {
      default: true,
      envs: new Set(['foo']),
      filename: fixture('compare', 'node_modules', 'plugin', 'index.js'),
      fromPackage: fixture('compare', 'node_modules', 'plugin'),
      hash: hashes[fixture('compare', 'node_modules', 'plugin', 'package.json')]
    }
  ]
  const sources = [
    {
      default: true,
      envs: new Set(['foo']),
      source: fixture('compare', '.babelrc'),
      hash: hashes[fixture('compare', '.babelrc')]
    }
  ]
  const verifier = new Verifier(babelrcDir, envNames, dependencies, sources)

  const buffer = verifier.toBuffer()
  const deserialized = Verifier.fromBuffer(buffer)
  t.is(deserialized.babelrcDir, babelrcDir)
  t.deepEqual(deserialized.envNames, envNames)
  t.deepEqual(deserialized.dependencies, dependencies)
  t.deepEqual(deserialized.sources, sources)
})

test('verifyCurrentEnv() behavior with .babelrc file', async t => {
  const dir = path.join(tmpDir, 'babelrc')
  fse.copySync(fixture('verifier', 'babelrc'), dir)

  const verifier = await (await fromDirectory(dir)).createVerifier()
  const cacheKeys = verifier.cacheKeysForCurrentEnv()

  t.deepEqual(await verifier.verifyCurrentEnv(), {
    sourcesChanged: false,
    dependenciesChanged: false,
    cacheKeys,
    verifier
  })

  {
    fs.writeFileSync(path.join(dir, 'plugin.js'), 'foo')
    const expectedCacheKeys = {
      dependencies: md5Hex([md5Hex('foo')]),
      sources: cacheKeys.sources
    }

    const result = await verifier.verifyCurrentEnv()
    const {verifier: newVerifier} = result
    delete result.verifier

    t.deepEqual(result, {
      sourcesChanged: false,
      dependenciesChanged: true,
      cacheKeys: expectedCacheKeys
    })
    t.true(newVerifier !== verifier)
    t.deepEqual(newVerifier.cacheKeysForCurrentEnv(), expectedCacheKeys)
  }

  fs.writeFileSync(path.join(dir, 'extends.json5'), '{foo:true}')
  t.deepEqual(await verifier.verifyCurrentEnv(), {
    sourcesChanged: true
  })

  fse.copySync(fixture('verifier', 'babelrc', 'extends.json5'), path.join(dir, 'extends.json5'))
  t.false((await verifier.verifyCurrentEnv()).sourcesChanged)

  fs.writeFileSync(path.join(dir, '.babelrc'), '{}')
  t.true((await verifier.verifyCurrentEnv()).sourcesChanged)
})

test('verifyCurrentEnv() behavior without .babelrc file', async t => {
  const dir = path.join(tmpDir, 'pkg')
  fse.copySync(fixture('verifier', 'pkg'), dir)

  const verifier = await (await fromDirectory(dir)).createVerifier()
  const cacheKeys = verifier.cacheKeysForCurrentEnv()

  t.deepEqual(await verifier.verifyCurrentEnv(), {
    sourcesChanged: false,
    dependenciesChanged: false,
    cacheKeys,
    verifier
  })

  fs.writeFileSync(path.join(dir, 'extends.json5'), '{foo:true}')
  t.deepEqual(await verifier.verifyCurrentEnv(), {
    sourcesChanged: true
  })

  fse.copySync(fixture('verifier', 'pkg', 'extends.json5'), path.join(dir, 'extends.json5'))
  t.false((await verifier.verifyCurrentEnv()).sourcesChanged)

  fs.writeFileSync(path.join(dir, '.babelrc'), '{}')
  t.true((await verifier.verifyCurrentEnv()).sourcesChanged)
})

test('verifyCurrentEnv() behavior if .babelrc sources do not need to be consulted at all', async t => {
  const dir = path.join(tmpDir, 'no-babelrc')
  fse.copySync(fixture('verifier', 'babelrc'), dir)

  const config = createConfig({
    options: {
      babelrc: false
    },
    source: 'source',
    hash: 'hash of source'
  })
  const fixedHashes = {
    sources: new Map([['source', 'hash of source']])
  }
  const verifier = await (await fromConfig(config)).createVerifier()
  const cacheKeys = verifier.cacheKeysForCurrentEnv()

  t.deepEqual(await verifier.verifyCurrentEnv(fixedHashes), {
    sourcesChanged: false,
    dependenciesChanged: false,
    cacheKeys,
    verifier
  })

  fs.writeFileSync(path.join(dir, '.babelrc'), '{}')
  t.false((await verifier.verifyCurrentEnv(fixedHashes)).sourcesChanged)
})

test('verifyCurrentEnv() can take fixed source hashes', async t => {
  const dir = path.join(tmpDir, 'fixed-source-hashes')
  fse.copySync(fixture('verifier', 'pkg'), dir)

  const result = await fromConfig(createConfig({
    options: {babelrc: true},
    source: 'foo',
    hash: 'hash of foo'
  }), {cache: prepareCache()})
  const verifier = await result.createVerifier()

  const cacheKeys = verifier.cacheKeysForCurrentEnv()

  const fixedHashes = {sources: new Map([['foo', 'hash of foo']])}
  t.deepEqual(await verifier.verifyCurrentEnv(fixedHashes), {
    sourcesChanged: false,
    dependenciesChanged: false,
    cacheKeys,
    verifier
  })
})

test('verifyCurrentEnv() can use cache', async t => {
  const dir = path.join(tmpDir, 'use-cache')
  fse.copySync(fixture('verifier', 'pkg'), dir)
  const plugin = resolveFrom(dir, './plugin.js')

  const cache = prepareCache()
  const verifier = await (await fromDirectory(dir)).createVerifier()
  await verifier.verifyCurrentEnv(null, cache)

  t.deepEqual(Array.from(cache.dependencyHashes.keys()), [
    plugin
  ])
  t.deepEqual(Array.from(cache.fileExistence.keys()), [
    path.join(dir, '.babelrc')
  ])
  t.deepEqual(Array.from(cache.files.keys()), [
    path.join(dir, 'extends.json5'),
    path.join(dir, 'package.json'),
    plugin
  ])
  t.deepEqual(Array.from(cache.sourceHashes.keys()), [
    path.join(dir, 'extends.json5'),
    path.join(dir, 'package.json')
  ])

  const access = td.func()
  const buffer = verifier.toBuffer()
  const stubbedVerifier = proxyquire('../lib/Verifier', {
    fs: {access}
  }).fromBuffer(buffer)

  stubbedVerifier.verifyCurrentEnv(null, cache)
  t.true(td.explain(access).callCount === 0)
})

test('verifyCurrentEnv() behavior when dependency goes missing', async t => {
  const dir = path.join(tmpDir, 'missing-dependency')
  fse.copySync(fixture('verifier', 'pkg'), dir)

  const verifier = await (await fromDirectory(dir)).createVerifier()
  fse.removeSync(path.join(dir, 'plugin.js'))

  t.deepEqual(await verifier.verifyCurrentEnv(), {
    badDependency: true
  })
})

test('verifyCurrentEnv() behavior when source goes missing', async t => {
  const dir = path.join(tmpDir, 'missing-source')
  fse.copySync(fixture('verifier', 'pkg'), dir)

  const verifier = await (await fromDirectory(dir)).createVerifier()
  fse.removeSync(path.join(dir, 'extends.json5'))

  t.deepEqual(await verifier.verifyCurrentEnv(), {
    missingSource: true
  })
})

test('verifyCurrentEnv() behavior with unexpected errors', async t => {
  const dir = path.join(tmpDir, 'unexpected-errors')
  fse.copySync(fixture('verifier', 'pkg'), dir)

  const expected = new Error()
  const access = td.func()
  td.when(access(path.join(dir, '.babelrc'))).thenCallback(expected)

  const buffer = (await (await fromDirectory(dir)).createVerifier()).toBuffer()
  const verifier = proxyquire('../lib/Verifier', {
    fs: {access}
  }).fromBuffer(buffer)

  const actual = await t.throws(verifier.verifyCurrentEnv())
  t.is(actual, expected)
})
