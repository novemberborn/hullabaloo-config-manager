import fs from 'fs'
import path from 'path'

import test from 'ava'
import md5Hex from 'md5-hex'
import packageHash from 'package-hash'
import { Buffer as SafeBuffer } from 'safe-buffer'

import hashDependencies from '../lib/hashDependencies'
import fixture from './helpers/fixture'

test('hashes packages', async t => {
  const fromPackage = fixture('compare', 'node_modules', 'plugin')
  const filename = path.join(fromPackage, 'index.js')
  const hashed = await hashDependencies([
    { filename, fromPackage }
  ])
  t.deepEqual(hashed, [await packageHash(path.join(fromPackage, 'package.json'))])
})

test('hashes files', async t => {
  const filename = fixture('compare', 'node_modules', 'plugin', 'index.js')
  const hashed = await hashDependencies([
    { filename, fromPackage: null }
  ])
  t.deepEqual(hashed, [md5Hex(fs.readFileSync(filename))])
})

test('fails when dependency package does not exist', async t => {
  const fromPackage = fixture('node_modules', 'non-existent')
  const filename = path.join(fromPackage, 'index.js')

  const err = await t.throws(hashDependencies([
    { filename, fromPackage }
  ]))
  t.is(err.name, 'BadDependencyError')
  t.is(err.source, filename)
  t.is(err.parent.code, 'ENOENT')
})

test('fails when dependency file does not exist', async t => {
  const filename = path.join('non-existent', 'index.js')

  const err = await t.throws(hashDependencies([
    { filename, fromPackage: null }
  ]))
  t.is(err.name, 'BadDependencyError')
  t.is(err.source, filename)
  t.true(err.parent === null)
})

test('can use a cache of computed hashes', async t => {
  const filename = fixture('precomputed.js')
  const cache = {
    dependencyHashes: new Map([[filename, Promise.resolve('hash')]])
  }

  const hashed = await hashDependencies([
    { filename, fromPackage: null }
  ], cache)
  t.deepEqual(hashed, ['hash'])
})

test('caches new hashes', async t => {
  const fromPackage = fixture('compare', 'node_modules', 'plugin')
  const filename = path.join(fromPackage, 'index.js')
  const cache = {
    dependencyHashes: new Map()
  }

  const hashed = await hashDependencies([
    { filename, fromPackage }
  ], cache)
  const fromCache = await cache.dependencyHashes.get(filename)
  t.true(hashed[0] === fromCache)
})

test('can use a cache for file access', async t => {
  const filename = fixture('cached-access')
  const contents = SafeBuffer.from('cached')
  const cache = {
    files: new Map([[filename, Promise.resolve(contents)]])
  }

  const hashed = await hashDependencies([
    { filename, fromPackage: null }
  ], cache)
  t.deepEqual(hashed, [md5Hex(contents)])
})
