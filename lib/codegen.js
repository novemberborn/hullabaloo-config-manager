'use strict'

const indentString = require('indent-string')
const stringifyJson5 = require('json5').stringify

function stringify (json5, value) {
  return json5
    ? stringifyJson5(value, null, 2)
    : JSON.stringify(value, null, 2)
}

function generateChain (config, envName) {
  const code = [`${envName ? '()' : 'envName'} => {`]

  if (envName) {
    const flattenedOptions = config.unflattenedOptions.reduceRight((prev, options) => {
      options.env = {
        [envName]: prev
      }
      return options
    })
    code.push(indentString(`return ${stringify(config.json5, flattenedOptions)}`, 2))
  } else {
    const optionsCode = config.unflattenedOptions.reduceRight((prev, options, index) => {
      const str = stringify(config.json5, options)
      if (!prev) return str

      // reduceOptions ensures no options object is ever empty.
      const lines = str.split('\n')
      lines[lines.length - 2] += ','
      lines[lines.length - 1] = indentString(`env: {\n  [envName]: ${indentString(prev, 2).trimLeft()}\n}`, 2)
      return lines.join('\n') + '\n}'
    }, null)

    code.push(indentString(`return ${optionsCode.trimLeft()}`, 2))
  }

  code.push('}')
  return code.join('\n')
}

function codegen (resolvedConfig) {
  const code = [`"use strict"

const process = require("process")\n`]
  code.push(`const defaultOptions = ${generateChain(resolvedConfig.withoutEnv)}\n`)

  code.push(`const envOptions = Object.create(null)\n`)
  for (const pair of resolvedConfig.byEnv) {
    const envName = pair[0]
    const envConfig = pair[1]
    code.push(`envOptions[${JSON.stringify(envName)}] = ${generateChain(envConfig, envName)}\n`)
  }

  code.push(`exports.getOptions = () => {
  const envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  return envName in envOptions
    ? envOptions[envName]()
    : defaultOptions(envName)
}\n`)

  return code.join('\n')
}

module.exports = codegen
