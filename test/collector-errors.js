import test from 'ava'

import {createConfig} from '..'
import * as collector from '../build/collector'
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

{
  const fails = async (t, kind) => {
    const err = await t.throws(collector.fromDirectory(fixture('bad-rc', kind)))
    t.is(err.name, 'InvalidFileError')
    t.is(err.source, fixture('bad-rc', kind, '.babelrc'))
  }
  fails.title = (title, kind) => `chain contains empty options when .babelrc is ${title || kind}`

  test(fails, 'array')
  test(fails, 'falsy')
  test(fails, 'null')
  test('not an object', fails, 'bool')
}

test('fails when both sourceMap and sourceMaps options are present', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-rc', 'conflicting-sourcemaps-option')))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, fixture('bad-rc', 'conflicting-sourcemaps-option', '.babelrc'))
})

{
  const invalid = async (t, option) => {
    const err = await t.throws(collector.fromDirectory(fixture('bad-rc', `${option}-option`)))
    t.is(err.name, 'InvalidFileError')
    t.is(err.source, fixture('bad-rc', `${option}-option`, '.babelrc'))
  }
  invalid.title = (desc, option) => `fails when ${desc || `${option} option`} is present`

  test(invalid, 'cwd')
  test(invalid, 'filename')
  test(invalid, 'filenameRelative')
  test(invalid, 'babelrc')
  test(invalid, 'code')
  test(invalid, 'ast')
  test(invalid, 'envName')
  test('nested env option', invalid, 'nested-env')
}

test('fails when parsing invalid JSON', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-pkg', 'invalid-json')))
  t.is(err.name, 'ParseError')
  t.is(err.source, fixture('bad-pkg', 'invalid-json', 'package.json'))
})

{
  const empty = async (t, kind) => {
    t.is(await collector.fromDirectory(fixture('bad-pkg', kind)), null)
  }
  empty.title = (title, kind) => `no chain when package.json is ${title || kind}`

  test(empty, 'falsy')
  test(empty, 'null')
  test('without a "babel" key', empty, 'without-babel')
  test('with a "babel" value that is null', empty, 'null-babel')
}

{
  const fail = async (t, kind) => {
    const err = await t.throws(collector.fromDirectory(fixture('bad-pkg', kind)))
    t.is(err.name, 'InvalidFileError')
    t.is(err.source, fixture('bad-pkg', kind, 'package.json'))
  }
  fail.title = (title, kind) => `fails when "babel" value in package.json is ${title}`

  test('an array', fail, 'array-babel')
  test('truthy but not an object', fail, 'bool-babel')
}

test('fails when module throws when loaded', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-js', 'syntax-error')))
  t.is(err.name, 'ParseError')
  t.is(err.source, fixture('bad-js', 'syntax-error', '.babelrc.js'))
  t.is(err.parent.name, 'SyntaxError')
})

test('fails when module exports a promise', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-js', 'promise-from-factory')))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, fixture('bad-js', 'promise-from-factory', '.babelrc.js'))
})

test('fails when module exports a promise-returning-factory', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-js', 'promise-export')))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, fixture('bad-js', 'promise-export', '.babelrc.js'))
})

test('fails when module exports a factory that does not configure the cache', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-js', 'no-cache-configuration')))
  t.is(err.name, 'InvalidFileError')
  t.is(err.source, fixture('bad-js', 'no-cache-configuration', '.babelrc.js'))
})

test('fails when module exports a factory that throws', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('bad-js', 'factory-throws')))
  t.is(err.name, 'ParseError')
  t.is(err.source, fixture('bad-js', 'factory-throws', '.babelrc.js'))
  t.is(err.parent.message, 'Oops')
})

test('fails when a directory contains .babelrc and package.json#babel', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('multiple-sources', 'babelrc-and-pkg')))
  t.is(err.name, 'MultipleSourcesError')
  t.is(err.source, fixture('multiple-sources', 'babelrc-and-pkg', '.babelrc'))
  t.is(err.otherSource, fixture('multiple-sources', 'babelrc-and-pkg', 'package.json'))
})

test('fails when a directory contains .babelrc and .babelrc.js', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('multiple-sources', 'babelrc-and-js')))
  t.is(err.name, 'MultipleSourcesError')
  t.is(err.source, fixture('multiple-sources', 'babelrc-and-js', '.babelrc'))
  t.is(err.otherSource, fixture('multiple-sources', 'babelrc-and-js', '.babelrc.js'))
})

test('fails when a directory contains .babelrc.js and package.json#babel', async t => {
  const err = await t.throws(collector.fromDirectory(fixture('multiple-sources', 'js-and-pkg')))
  t.is(err.name, 'MultipleSourcesError')
  t.is(err.source, fixture('multiple-sources', 'js-and-pkg', '.babelrc.js'))
  t.is(err.otherSource, fixture('multiple-sources', 'js-and-pkg', 'package.json'))
})

test('fails when extending from a non-existent .babelrc file', async t => {
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

test('fails when extending from a non-existent .babelrc.js file', async t => {
  const err = await t.throws(collector.fromConfig(createConfig({
    options: {extends: 'non-existent.js'},
    source: fixture('source.js')
  })))
  t.is(err.name, 'ExtendsError')
  t.is(err.clause, 'non-existent.js')
  t.is(err.source, fixture('source.js'))
  t.is(err.parent.name, 'NoSourceFileError')
  t.is(err.parent.source, fixture('non-existent.js'))
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
  const fail = async (t, kind) => {
    const err = await t.throws(collector.fromConfig(createConfig({
      options: {extends: `${kind}/.babelrc`},
      source: fixture('bad-rc', 'source.js')
    })))
    t.is(err.name, 'InvalidFileError')
    t.is(err.source, fixture('bad-rc', kind, '.babelrc'))
    t.is(err.parent, null)
  }
  fail.title = title => `fails when extending from a ${title}`

  test('falsy file', fail, 'falsy')
  test('null file', fail, 'null')
  test('non-object file', fail, 'bool')
}
