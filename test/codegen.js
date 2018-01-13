import path from 'path'

import test from 'ava'
import replaceString from 'replace-string'

import {createConfig} from '..'
import codegen from '../build/codegen'
import * as collector from '../build/collector'
import reduceChains from '../build/reduceChains'

const source = path.join(__dirname, 'fixtures', 'empty', 'source.js')

test('stringifies using JSON5 unless chain is marked otherwise', async t => {
  const chains = await collector.fromConfig(createConfig({
    fileType: 'JSON',
    options: {sourceType: 'module'},
    source
  }))
  const code = codegen(reduceChains(chains))

  t.true(code.includes('"sourceType": "module"'))
})

test('by default stringifies using JSON5', async t => {
  const chains = await collector.fromConfig(createConfig({
    options: {sourceType: 'module'},
    source
  }))
  const code = codegen(reduceChains(chains))

  t.true(code.includes('sourceType: "module"'))
})

test('generates a nicely indented module', async t => {
  const chains = await collector.fromConfig(createConfig({
    options: {
      extends: path.join(__dirname, 'fixtures', 'compare', '.babelrc')
    },
    source
  }))

  let code = codegen(reduceChains(chains))
  let cwd = process.cwd()
  if (path.sep === path.win32.sep) {
    // File paths are JSON encoded, which means the separator is doubled.
    // Replace by the POSIX separator so the snapshot can be matched.
    code = replaceString(code, path.win32.sep + path.win32.sep, path.posix.sep)
    // Similarly normalize the CWD. Ensure any trailing slashes are removed,
    // e.g. when the CWD is `Z:/`.
    cwd = replaceString(cwd, path.win32.sep, path.posix.sep).replace(/\/$/, '')
  }

  t.snapshot(replaceString(code, cwd, '~'))
})
