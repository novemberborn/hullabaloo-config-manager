import indentString = require('indent-string')
import json5 = require('json5')

import {FileType} from './collector'
import {ConfigList, isModuleConfig, MergedConfig, ModuleConfig} from './reduceChains'
import ResolvedConfig from './ResolvedConfig'
import {Kind} from './resolvePluginsAndPresets'

function stringify (asJson5: boolean, value: object): string {
  return asJson5
    ? json5.stringify(value, null, 2)
    : JSON.stringify(value, null, 2)
}

function printConfig (config: MergedConfig | ModuleConfig) {
  if (!isModuleConfig(config)) return stringify(config.fileType === FileType.JSON5, config.options)

  return `loadCachedModule(cache, ${JSON.stringify(config.dir)}, ${JSON.stringify(config.source)}, envName, \
${JSON.stringify(config.envName !== null)})`
}

function generateFactory (unflattened: ConfigList): string {
  const config = unflattened[0]
  if (!isModuleConfig(config) && unflattened.length === 1) {
    const body = indentString(`return Object.assign(${printConfig(config)}, {babelrc: false, envName})`, 2)
    return `envName => {\n${body}\n}`
  }

  return `(envName, cache) => {
  return Object.assign(mergeConfigs([
${unflattened.map(item => indentString(printConfig(item), 4)).join(',\n')}
  ]), {babelrc: false, envName})
}`
}

export default function codegen (resolvedConfig: ResolvedConfig): string {
  let code = `"use strict"

const process = require("process")
const merge = require(${JSON.stringify(require.resolve('lodash.merge'))})
const cloneOptions = require(${JSON.stringify(require.resolve('./cloneOptions'))}).default
const normalizeSomeOptions = require(${JSON.stringify(require.resolve('./normalizeOptions'))}).default
const standardizeName = require(${JSON.stringify(require.resolve('./standardizeName'))}).default

function resolvePluginOrPreset (resolutionCache, kind, ref) {
  const name = standardizeName(kind, ref).name
  if (!resolutionCache.has(name)) throw new Error(\`Could not find previously resolved \${kind} in cache\`)
  return resolutionCache.get(name)
}

function normalizePluginsAndPresets (resolutionCache, options) {
  if (Array.isArray(options.plugins)) {
    options.plugins = options.plugins.map(ref => {
      if (typeof ref === 'string') {
        ref = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PLUGIN)}, ref)
      } else if (Array.isArray(ref) && typeof ref[0] === 'string') {
        ref[0] = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PLUGIN)}, ref[0])
      }
      return ref
    })
  } else {
    delete options.plugins
  }
  if (Array.isArray(options.presets)) {
    options.presets = options.presets.map(ref => {
      if (typeof ref === 'string') {
        ref = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PRESET)}, ref)
      } else if (Array.isArray(ref) && typeof ref[0] === 'string') {
        ref[0] = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PRESET)}, ref[0])
      }
      return ref
    })
  } else {
    delete options.presets
  }
  return options
}

function loadCachedModule (cache, dir, source, envName, selectEnv) {
  if (!cache) throw new Error(\`A cache is required to load the configuration module at '\${source}'\`)

  const cached = cache.moduleSources.get(source)
  if (!cached) throw new Error(\`Could not find the configuration module for '\${source}' in the cache\`)
  if (!cached.unrestricted && !cached.byEnv.has(envName)) throw new Error(\`Could not find the configuration module, \
specific to the '\${envName}' environment, for '\${source}', in the cache\`)

  let options = cloneOptions(cached.unrestricted ? cached.options : cached.byEnv.get(envName).options)
  if (selectEnv) options = options.env[envName]
  delete options.env
  delete options.extends
  normalizeSomeOptions(options)
  normalizePluginsAndPresets(cache.pluginsAndPresets.get(dir), options)
  return options
}

function mergeConfigs (configs) {
  return configs.reduce((target, config) => {
    const plugins = config.plugins
    const presets = config.presets

    delete config.plugins
    delete config.presets

    if (plugins) {
      target.plugins = target.plugins
        ? target.plugins.concat(plugins)
        : plugins
    }
    if (presets) {
      target.presets = target.presets
        ? target.presets.concat(presets)
        : presets
    }
    return merge(target, config)
  })
}

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
