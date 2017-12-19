import fs from 'fs'

import test from 'ava'
import md5Hex from 'md5-hex'

import {prepareCache} from '..'
import hashSources from '../build/hashSources'
import fixture from './helpers/fixture'

test('hashes file contents', async t => {
  const source = fixture('babelrc', '.babelrc')
  const hashed = await hashSources([{source, runtimeHash: null}])
  t.deepEqual(hashed, [md5Hex(fs.readFileSync(source))])
})

test('includes the runtimeHash', async t => {
  const source = fixture('babelrc', '.babelrc')
  const hashed = await hashSources([{source, runtimeHash: 'foo'}])
  t.deepEqual(hashed, [md5Hex(['foo', fs.readFileSync(source)])])
})

test('hashes the "babel" value in package.json sources', async t => {
  const sources = [
    fixture('pkg', 'package.json'),
    fixture('bad-pkg', 'array-babel', 'package.json'),
    fixture('bad-pkg', 'bool-babel', 'package.json'),
    fixture('bad-pkg', 'falsy', 'package.json'),
    fixture('bad-pkg', 'null', 'package.json'),
    fixture('bad-pkg', 'null-babel', 'package.json'),
    fixture('bad-pkg', 'without-babel', 'package.json')
  ].map(source => ({source, runtimeHash: null}))

  const hashed = await hashSources(sources)
  t.deepEqual(hashed, [
    md5Hex('{"plugins":["pkg"]}'),
    md5Hex('[]'),
    md5Hex('true'),
    md5Hex('{}'),
    md5Hex('{}'),
    md5Hex('{}'),
    md5Hex('{}')
  ])
})

test('source may contain a dot-prop path', async t => {
  const source = fixture('virtual', 'package.json#deeply.nested')
  const hashed = await hashSources([{source, runtimeHash: null}])
  t.deepEqual(hashed, [md5Hex('{"virtual":true}')])
})

test('can use a map of fixed hashes', async t => {
  const hashed = await hashSources([
    {source: fixture('pkg', 'package.json'), runtimeHash: null},
    {source: 'foo', runtimeHash: null},
    {source: 'bar', runtimeHash: null}
  ], new Map([
    ['foo', 'hash of foo'],
    ['bar', 'hash of bar']
  ]))
  t.deepEqual(hashed, [
    md5Hex('{"plugins":["pkg"]}'),
    'hash of foo',
    'hash of bar'
  ])
})

test('can use a cache of computed hashes', async t => {
  const source = fixture('precomputed')
  const cache = prepareCache()
  cache.sourceHashes.set(source, Promise.resolve('hash'))

  const hashed = await hashSources([{source, runtimeHash: null}], null, cache)
  t.deepEqual(hashed, ['hash'])
})

test('caches new hashes', async t => {
  const source = fixture('babelrc', '.babelrc')
  const cache = prepareCache()

  const hashed = await hashSources([{source, runtimeHash: null}], null, cache)
  const fromCache = await cache.sourceHashes.get(source)
  t.true(hashed[0] === fromCache)
})

test('can use a cache for file access', async t => {
  const source = fixture('cached-access')
  const contents = Buffer.from('cached')
  const cache = prepareCache()
  cache.files.set(source, Promise.resolve(contents))

  const hashed = await hashSources([{source, runtimeHash: null}], null, cache)
  t.deepEqual(hashed, [md5Hex(contents)])
})

test('fails when source file does not exist', async t => {
  const source = fixture('non-existent')
  const err = await t.throws(hashSources([{source, runtimeHash: null}]))
  t.is(err.name, 'NoSourceFileError')
  t.is(err.source, source)
})
