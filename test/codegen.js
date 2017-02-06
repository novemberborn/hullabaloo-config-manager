import path from 'path'

import test from 'ava'

import codegen from '../lib/codegen'
import collector from '../lib/collector'
import reduceOptions from '../lib/reduceOptions'
import resolvePluginsAndPresets from '../lib/resolvePluginsAndPresets'

const source = path.join(__dirname, 'fixtures', 'empty', 'source.js')

test('stringifies using JSON unless chain is marked as JSON5', async t => {
  const json5 = false
  const chains = await collector.fromVirtual({}, source, null, json5)
  const pluginsAndPresets = resolvePluginsAndPresets(chains)
  const code = codegen({
    withoutEnv: reduceOptions(chains.withoutEnv, pluginsAndPresets),
    byEnv: new Map()
  })

  t.true(code.includes(`const defaultOptions = envName => {
  return {
    "babelrc": false
  }
}`))
})

test('stringifies using JSON5 if chain is marked as such', async t => {
  const json5 = true
  const chains = await collector.fromVirtual({}, source, null, json5)
  const pluginsAndPresets = resolvePluginsAndPresets(chains)
  const code = codegen({
    withoutEnv: reduceOptions(chains.withoutEnv, pluginsAndPresets),
    byEnv: new Map()
  })

  t.true(code.includes(`const defaultOptions = envName => {
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

  const chains = await collector.fromVirtual({
    extends: path.join(__dirname, 'fixtures', 'compare', 'extended-by-babelrc.json5')
  }, source, true)
  const pluginsAndPresets = resolvePluginsAndPresets(chains)
  const code = codegen({
    withoutEnv: reduceOptions(chains.withoutEnv, pluginsAndPresets),
    byEnv: new Map([['foo', reduceOptions(chains.byEnv.get('foo'), pluginsAndPresets)]])
  })

  t.is(code, `"use strict"

const process = require("process")

const defaultOptions = envName => {
  return {
    plugins: [
      [
        ${modulePath('plugin')},
        {
          label: "plugin@extended-by-babelrc"
        }
      ]
    ],
    presets: [
      [
        ${modulePath('preset')},
        {
          label: "preset@extended-by-babelrc"
        }
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
        }
      ]
    ],
    presets: [
      [
        ${modulePath('preset')},
        {
          label: "preset@extended-by-babelrc"
        }
      ]
    ],
    babelrc: false,
    env: {
      foo: {
        plugins: [
          [
            ${modulePath('plugin')},
            {
              label: "plugin@extended-by-babelrc.foo"
            }
          ]
        ],
        presets: [
          [
            ${modulePath('preset')},
            {
              label: "preset@extended-by-babelrc.foo"
            }
          ]
        ]
      }
    }
  }
}

exports.getOptions = () => {
  const envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  return envName in envOptions
    ? envOptions[envName]()
    : defaultOptions(envName)
}
`)
})
