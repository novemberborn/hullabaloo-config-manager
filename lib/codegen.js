'use strict'

const indentString = require('indent-string')
const stringifyJson5 = require('json5').stringify

const reduceOptions = require('./reduceOptions')

function stringify (json5, value) {
  return json5
    ? stringifyJson5(value, null, 2)
    : JSON.stringify(value, null, 2)
}

function generateChain (chain, pluginsAndPresets, envName) {
  const code = [`${envName ? '()' : 'envName'} => {`]

  const reduced = reduceOptions(chain, pluginsAndPresets)
  if (envName) {
    const flattenedOptions = reduced.unflattenedOptions.reduceRight((prev, options) => {
      options.env = {
        [envName]: prev
      }
      return options
    })
    code.push(indentString(`return ${stringify(reduced.json5, flattenedOptions)}`, 2))
  } else {
    const optionsCode = reduced.unflattenedOptions.reduceRight((prev, options, index) => {
      const str = stringify(reduced.json5, options)
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

function codegen (chains, pluginsAndPresets) {
  const code = ['"use strict"\n']
  code.push(`exports.withoutEnv = ${generateChain(chains.withoutEnv, pluginsAndPresets)}\n`)

  code.push(`exports.byEnv = Object.create(null)\n`)
  for (const pair of chains.byEnv) {
    const envName = pair[0]
    const chain = pair[1]
    code.push(`exports.byEnv[${JSON.stringify(envName)}] = ${generateChain(chain, pluginsAndPresets, envName)}\n`)
  }

  return code.join('\n')
}

module.exports = codegen
