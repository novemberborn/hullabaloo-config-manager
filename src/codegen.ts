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
    // TODO: Support `.babelrc.js` files.
    return prev || options
  }, null)!

  const body = indentString(`return Object.assign(${stringify(unflattened.json5, mergedOptions)}, {envName})`, 2)
  return `envName => {\n${body}\n}`
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

  code.push(`exports.getOptions = envName => {
  if (typeof envName !== "string") {
    envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  }
  return envName in envOptions
    ? envOptions[envName](envName)
    : defaultOptions(envName)
}\n`)

  return code.join('\n')
}
