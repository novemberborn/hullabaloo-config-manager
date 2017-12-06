import path from 'path'

import test from 'ava'

import {createConfig} from '..'
import codegen from '../build/codegen'
import * as collector from '../build/collector'
import reduceChains from '../build/reduceChains'

const source = path.join(__dirname, 'fixtures', 'empty', 'source.js')

test('stringifies using JSON5 unless chain is marked otherwise', async t => {
  const json5 = false
  const chains = await collector.fromConfig(createConfig({
    json5,
    options: {},
    source
  }))
  const code = codegen(reduceChains(chains))

  t.true(code.includes(`const defaultOptions = () => {
  return {
    "babelrc": false
  }
}`))
})

test('by default stringifies using JSON5', async t => {
  const chains = await collector.fromConfig(createConfig({
    options: {},
    source
  }))
  const code = codegen(reduceChains(chains))

  t.true(code.includes(`const defaultOptions = () => {
  return {
    babelrc: false
  }
}`))
})

test('generates a nicely indented module', async t => {
  const modulePath = name => {
    const p = path.join(__dirname, 'fixtures', 'compare', 'node_modules', name, 'index.js')
    return JSON.stringify(p)
  }

  const chains = await collector.fromConfig(createConfig({
    json5: true,
    options: {
      extends: path.join(__dirname, 'fixtures', 'compare', 'extended-by-babelrc.json5')
    },
    source
  }))
  const code = codegen(reduceChains(chains))

  t.is(code, `"use strict"

const process = require("process")

const defaultOptions = () => {
  return {
    plugins: [
      [
        ${modulePath('plugin')},
        {
          label: "plugin@extended-by-babelrc"
        },
        "plugin@extended-by-babelrc"
      ]
    ],
    presets: [
      [
        ${modulePath('preset')},
        {
          label: "preset@extended-by-babelrc"
        },
        "preset@extended-by-babelrc"
      ]
    ],
    babelrc: false
  }
}

const envOptions = Object.create(null)

envOptions["foo"] = () => {
  return {
    plugins: [
      [
        ${modulePath('plugin')},
        {
          label: "plugin@extended-by-babelrc"
        },
        "plugin@extended-by-babelrc"
      ],
      [
        ${modulePath('plugin')},
        {
          label: "plugin@extended-by-babelrc.foo"
        },
        "plugin@extended-by-babelrc.foo"
      ]
    ],
    presets: [
      [
        ${modulePath('preset')},
        {
          label: "preset@extended-by-babelrc"
        },
        "preset@extended-by-babelrc"
      ],
      [
        ${modulePath('preset')},
        {
          label: "preset@extended-by-babelrc.foo"
        },
        "preset@extended-by-babelrc.foo"
      ]
    ],
    babelrc: false
  }
}

exports.getOptions = () => {
  const envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  return envName in envOptions
    ? envOptions[envName]()
    : defaultOptions()
}
`)
})
