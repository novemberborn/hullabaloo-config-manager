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
${JSON.stringify(config.overrideIndex) || 'undefined'}, ${JSON.stringify(config.envName !== null)})`
}

function generateFactory (unflattened: ConfigList): string {
  return `(envName, cache) => {
  return Object.assign(mergeConfigs([
${unflattened.map(item => indentString(printConfig(item), 4)).join(',\n')}
  ]), {
    babelrc: false,
    envName,
    overrides: [
${unflattened.overrides.map(items => `      mergeConfigs([
${items.map(item => indentString(printConfig(item), 8)).join(',\n')}
      ])`).join(',\n')}
    ]
  })
}`
}

export default function codegen (resolvedConfig: ResolvedConfig): string {
  let code = `"use strict"

const process = require("process")
const merge = require(${JSON.stringify(require.resolve('lodash.merge'))})
const cloneOptions = require(${JSON.stringify(require.resolve('./cloneOptions'))}).default
const getPluginOrPresetName = require(${JSON.stringify(require.resolve('./getPluginOrPresetName'))}).default
const mergePluginsOrPresets = require(${JSON.stringify(require.resolve('./mergePluginsOrPresets'))}).default
const normalizeSomeOptions = require(${JSON.stringify(require.resolve('./normalizeOptions'))}).default
const standardizeName = require(${JSON.stringify(require.resolve('./standardizeName'))}).default

function resolvePluginOrPreset (resolutionCache, kind, ref) {
  const name = standardizeName(kind, ref).name
  if (!resolutionCache.has(name)) throw new Error(\`Could not find previously resolved \${kind} in cache\`)
  return resolutionCache.get(name)
}

function normalizePluginsAndPresets (resolutionCache, nameMap, options) {
  if (Array.isArray(options.plugins)) {
    options.plugins = options.plugins.map(item => {
      if (Array.isArray(item)) {
        const target = item[0]
        if (typeof target !== 'string') {
          return {target, options: item[1], name: item.length > 2 ? item[2] : getPluginOrPresetName(nameMap, target)}
        }

        const filename = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PLUGIN)}, target)
        return {filename, options: item[1], name: item.length > 2 ? item[2] : getPluginOrPresetName(nameMap, filename)}
      }
      if (typeof item === 'string') {
        const filename = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PLUGIN)}, item)
        return {filename, name: getPluginOrPresetName(nameMap, filename)}
      }
      return {target: item, name: getPluginOrPresetName(nameMap, item)}
    })
  } else {
    delete options.plugins
  }
  if (Array.isArray(options.presets)) {
    options.presets = options.presets.map(item => {
      if (Array.isArray(item)) {
        const target = item[0]
        if (typeof target !== 'string') {
          return {target, options: item[1], name: item.length > 2 ? item[2] : getPluginOrPresetName(nameMap, target)}
        }

        const filename = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PRESET)}, target)
        return {filename, options: item[1], name: item.length > 2 ? item[2] : getPluginOrPresetName(nameMap, filename)}
      }
      if (typeof item === 'string') {
        const filename = resolvePluginOrPreset(resolutionCache, ${JSON.stringify(Kind.PRESET)}, item)
        return {filename, name: getPluginOrPresetName(nameMap, filename)}
      }
      return {target: item, name: getPluginOrPresetName(nameMap, item)}
    })
  } else {
    delete options.presets
  }
  return options
}

function loadCachedModule (cache, dir, source, envName, selectOverride, selectEnv) {
  if (!cache) throw new Error(\`A cache is required to load the configuration module at '\${source}'\`)

  const cached = cache.moduleSources.get(source)
  if (!cached) throw new Error(\`Could not find the configuration module for '\${source}' in the cache\`)
  if (!cached.unrestricted && !cached.byEnv.has(envName)) throw new Error(\`Could not find the configuration module, \
specific to the '\${envName}' environment, for '\${source}', in the cache\`)

  let options = cloneOptions(cached.unrestricted ? cached.options : cached.byEnv.get(envName).options)
  if (selectOverride !== undefined) options = options.overrides[selectOverride]
  if (selectEnv) options = options.env[envName]
  delete options.env
  delete options.extends
  delete options.overrides
  normalizeSomeOptions(options)
  normalizePluginsAndPresets(cache.pluginsAndPresets.get(dir), cache.nameMap, options)
  return options
}

function mergeConfigs (configs) {
  const merged = configs.reduce((target, options) => {
    const plugins = options.plugins
    const presets = options.presets

    delete options.plugins
    delete options.presets

    if (plugins) {
      mergePluginsOrPresets(target.plugins, plugins)
    }
    if (presets) {
      mergePluginsOrPresets(target.presets, presets)
    }
    return merge(target, options)
  }, {plugins: [], presets: []})

  if (merged.plugins.length > 0) {
    merged.plugins = merged.plugins.map(item => ([item.target || item.filename, item.options, item.name]))
  } else {
    delete merged.plugins
  }
  if (merged.presets.length > 0) {
    merged.presets = merged.presets.map(item => ([item.target || item.filename, item.options, item.name]))
  } else {
    delete merged.presets
  }

  return merged
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
