import indentString = require('indent-string')
import json5 = require('json5')

import {CompressedOptions} from './reduceChains'
import ResolvedConfig from './ResolvedConfig'

function stringify (asJson5: boolean, value: object): string {
  return asJson5
    ? json5.stringify(value, null, 2)
    : JSON.stringify(value, null, 2)
}

function trimLeft (str: string): string {
  return str.replace(/^\s+/, '')
}

function generateFactory (unflattened: CompressedOptions, envName?: string): string {
  const code = [`${envName ? '()' : 'envName'} => {`]

  if (envName) {
    const flattenedOptions = unflattened.reduceRight((prev, options) => ({...options, env: {[envName]: prev}}))
    code.push(indentString(`return ${stringify(unflattened.json5, flattenedOptions)}`, 2))
  } else {
    const optionsCode = unflattened.reduceRight((prev: string | null, options, index) => {
      const str = stringify(unflattened.json5, options)
      if (!prev) return str

      // reduceOptions ensures no options object is ever empty.
      const lines = str.split('\n')
      lines[lines.length - 2] += ','
      lines[lines.length - 1] = indentString(`env: {\n  [envName]: ${trimLeft(indentString(prev, 2))}\n}`, 2)
      return lines.join('\n') + '\n}'
    }, null)!

    code.push(indentString(`return ${trimLeft(optionsCode)}`, 2))
  }

  code.push('}')
  return code.join('\n')
}

export default function codegen (resolvedConfig: ResolvedConfig): string {
  const code = [`"use strict"

const process = require("process")\n`]
  code.push(`const defaultOptions = ${generateFactory(resolvedConfig.unflattenedDefaultOptions)}\n`)

  code.push(`const envOptions = Object.create(null)\n`)
  for (const envName of resolvedConfig.envNames) {
    const unflattened = resolvedConfig.unflattenedEnvOptions.get(envName)!
    code.push(`envOptions[${JSON.stringify(envName)}] = ${generateFactory(unflattened, envName)}\n`)
  }

  code.push(`exports.getOptions = () => {
  const envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  return envName in envOptions
    ? envOptions[envName]()
    : defaultOptions(envName)
}\n`)

  return code.join('\n')
}
