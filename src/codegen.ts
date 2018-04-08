import indentString = require('indent-string')
import json5 = require('json5')

import {FileType} from './collector'
import {ConfigList, isModuleConfig, MergedConfig, ModuleConfig} from './reduceChains'
import ResolvedConfig from './ResolvedConfig'

function stringify (asJson5: boolean, value: object): string {
  return asJson5
    ? json5.stringify(value, undefined, 2)
    : JSON.stringify(value, undefined, 2)
}

function printConfig (config: MergedConfig | ModuleConfig) {
  if (!isModuleConfig(config)) return stringify(config.fileType === FileType.JSON5, config.options)

  return `helpers.loadCachedModule(cache, ${JSON.stringify(config.dir)}, ${JSON.stringify(config.source)}, envName, \
${JSON.stringify(config.envName !== null)}, ${JSON.stringify(config.overrideIndex) || 'undefined'})`
}

function generateFactory (unflattened: ConfigList): string {
  return `(envName, cache) => {
  const wrapperFns = new Map()
  return Object.assign(helpers.mergeOptions([
${unflattened.map(item => indentString(printConfig(item), 4)).join(',\n')}
], wrapperFns), {
    babelrc: false,
    envName,
    overrides: [
${unflattened.overrides.map(items => `      helpers.mergeOptions([
${items.map(item => indentString(printConfig(item), 8)).join(',\n')}
      ], wrapperFns)`).join(',\n')}
    ]
  })
}`
}

export default function codegen (resolvedConfig: ResolvedConfig): string {
  let code = `"use strict"

const process = require("process")
const helpers = require(${JSON.stringify(require.resolve('./helpers'))})

const defaultOptions = ${generateFactory(resolvedConfig.unflattenedDefaultOptions)}

const envOptions = Object.create(null)\n`
  for (const envName of resolvedConfig.envNames) {
    const unflattened = resolvedConfig.unflattenedEnvOptions.get(envName)!
    code += `\nenvOptions[${JSON.stringify(envName)}] = ${generateFactory(unflattened)}\n`
  }

  return `${code}
exports.getOptions = (envName, cache) => {
  if (typeof envName !== "string") {
    envName = process.env.BABEL_ENV || process.env.NODE_ENV || "development"
  }
  return envName in envOptions
    ? envOptions[envName](envName, cache)
    : defaultOptions(envName, cache)
}\n`
}
