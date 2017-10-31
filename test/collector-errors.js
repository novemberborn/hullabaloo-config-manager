import test from 'ava'

import {createConfig} from '..'
import collector from '../lib/collector'
import fixture from './helpers/fixture'

{
  const eisdir = async (t, dir) => {
    const err = await t.throws(collector.fromDirectory(dir))
    t.is(err.code, 'EISDIR')
  }
  eisdir.title = file => `fails if ${file} is a directory`

  test('.babelrc', eisdir, fixture('dirs-not-files', 'babelrc'))
  test('package.json', eisdir, fixture('dirs-not-files', 'pkg'))
}

test('fails when parsing invalid JSON5', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-rc', 'invalid-json5')))
  t.is(err.name, 'ParseError')
  t.is(err.source, fixture('bad-rc', 'invalid-json5', '.babelrc'))
})

test('fails when .babelrc is an array', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-rc', 'array')))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, fixture('bad-rc', 'array', '.babelrc'))
})

{
  const empty = async (t, kind) => {
    const {defaultChain: [{options, source}]} = await collector.fromDirectory(fixture('bad-rc', kind))
    t.deepEqual(options, {})
    t.is(source, fixture('bad-rc', kind, '.babelrc'))
  }
  empty.title = (title, kind) => `chain contains empty options when .babelrc is ${title || kind}`

  test(empty, 'falsy')
  test(empty, 'null')
  test('not an object', empty, 'bool')
}

test('fails when parsing invalid JSON', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-pkg', 'invalid-json')))
  t.is(err.name, 'ParseError')
  t.is(err.source, fixture('bad-pkg', 'invalid-json', 'package.json'))
})

test('fails when "babel" value in package.json is an array', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-pkg', 'array')))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, fixture('bad-pkg', 'array', 'package.json'))
})

{
  const empty = async (t, kind) => {
    const {defaultChain: [{options, source}]} = await collector.fromDirectory(fixture('bad-pkg', kind))
    t.deepEqual(options, {})
    t.is(source, fixture('bad-pkg', kind, 'package.json'))
  }
  empty.title = (title, kind) => `chain contains empty options when package.json is ${title || kind}`

  test(empty, 'falsy')
  test(empty, 'null')
  test('without a "babel" key', empty, 'without-babel')
  test('without a "babel" value that’s null', empty, 'null-babel')
  test('without a "babel" value that’s not an object', empty, 'bool-babel')
}

test('fails when extending from a non-existent file', async t => {
  const err = await t.throws(collector.fromConfig(createConfig({
    options: {extends: 'non-existent'},
    source: fixture('source.js')
  })))
  t.is(err.name, 'ExtendsError')
  t.is(err.clause, 'non-existent')
  t.is(err.source, fixture('source.js'))
  t.is(err.parent.name, 'NoSourceFileError')
  t.is(err.parent.source, fixture('non-existent'))
})

test('fails when extending from an invalid file', async t => {
  const err = await t.throws(collector.fromConfig(createConfig({
    options: {extends: 'invalid-json5/.babelrc'},
    source: fixture('bad-rc', 'source.js')
  })))
  t.is(err.name, 'ParseError')
  t.is(err.source, fixture('bad-rc', 'invalid-json5', '.babelrc'))
  t.is(err.parent.name, 'SyntaxError')
})

{
  const empty = async (t, kind) => {
    const {defaultChain: [{options, source}]} = await collector.fromConfig(createConfig({
      options: {extends: `${kind}/.babelrc`},
      source: fixture('bad-rc', 'source.js')
    }))
    t.deepEqual(options, {})
    t.is(source, fixture('bad-rc', kind, '.babelrc'))
  }
  empty.title = title => `chain contains empty options when extending from a ${title}`

  test('falsy file', empty, 'falsy')
  test('null file', empty, 'null')
  test('non-object file', empty, 'bool')
}
