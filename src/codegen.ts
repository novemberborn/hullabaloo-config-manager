import indentString = require('indent-string')
import json5 = require('json5')

import BabelOptions from './BabelOptions'
import {CompressedOptions} from './reduceChains'
import ResolvedConfig from './ResolvedConfig'

function stringify (asJson5: boolean, value: object): string {
  return asJson5
    ? json5.stringify(value, null, 2)
    : JSON.stringify(value, null, 2)
}

function generateFactory (unflattened: CompressedOptions): string {
  const mergedOptions = unflattened.reduceRight((prev: BabelOptions | null, options, index) => {
    if (!prev) return Object.assign({}, options)

    const plugins = (options.plugins || []).concat(prev.plugins || [])
    const presets = (options.presets || []).concat(prev.presets || [])
    return Object.assign({}, options, prev, {plugins, presets})
  }, null)!

  const body = indentString(`return ${stringify(unflattened.json5, mergedOptions)}`, 2)
  return `() => {\n${body}\n}`
}

export default function codegen (resolvedConfig: ResolvedConfig): string {
  const code = [`"use strict"

const process = require("process")\n`]
  code.push(`const defaultOptions = ${generateFactory(resolvedConfig.unflattenedDefaultOptions)}\n`)

  code.push(`const envOptions = Object.create(null)\n`)
  for (const envName of resolvedConfig.envNames) {
    const unflattened = resolvedConfig.unflattenedEnvOptions.get(envName)!
    code.push(`envOptions[${JSON.stringify(envName)}] = ${generateFactory(unflattened)}\n`)
  }

  code.push(`exports.getOptions = () => {
  const envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  return envName in envOptions
    ? envOptions[envName]()
    : defaultOptions()
}\n`)

  return code.join('\n')
}
