import merge = require('lodash.merge')

import Cache, {isUnrestrictedModuleSource, NameMap, PluginsAndPresetsMapValue} from './Cache'
import BabelOptions, {PluginOrPresetItem, PluginOrPresetList, PluginOrPresetOptions, PluginOrPresetTarget} from './BabelOptions'
import cloneOptions from './cloneOptions'
import {PluginOrPresetDescriptor, ReducedBabelOptions} from './reduceChains'
import getPluginOrPresetName from './getPluginOrPresetName'
import loadPluginOrPreset from './loadPluginOrPreset'
import mergePluginsOrPresets from './mergePluginsOrPresets'
import normalizeSomeOptions from './normalizeOptions'
import standardizeName from './standardizeName'
import {Kind} from './resolvePluginsAndPresets'

function resolvePluginOrPreset (resolutionCache: PluginsAndPresetsMapValue, kind: Kind, ref: string): string {
  const name = standardizeName(kind, ref).name
  if (!resolutionCache.has(name)) throw new Error(`Could not find previously resolved ${kind} in cache`)
  return resolutionCache.get(name)!
}

function normalizePluginOrPreset (
  dirname: string,
  resolutionCache: PluginsAndPresetsMapValue,
  nameMap: NameMap,
  item: PluginOrPresetItem,
  kind: Kind
): PluginOrPresetDescriptor {
  if (Array.isArray(item)) {
    const target = item[0]
    if (typeof target !== 'string') {
      switch (item.length) {
        case 1: return {dirname, target, name: getPluginOrPresetName(nameMap, target)}
        case 2: return {dirname, target, options: item[1] as PluginOrPresetOptions, name: getPluginOrPresetName(nameMap, target)}
        default: return {dirname, target, options: item[1] as PluginOrPresetOptions, name: item[2] as string}
      }
    }

    const filename = resolvePluginOrPreset(resolutionCache, kind, target)
    switch (item.length) {
      case 1: return {dirname, filename, name: getPluginOrPresetName(nameMap, filename)}
      case 2: return {dirname, filename, options: item[1] as PluginOrPresetOptions, name: getPluginOrPresetName(nameMap, filename)} // eslint-disable-line max-len
      default: return {dirname, filename, options: item[1] as PluginOrPresetOptions, name: item[2] as string}
    }
  }

  if (typeof item === 'string') {
    const filename = resolvePluginOrPreset(resolutionCache, kind, item)
    return {dirname, filename, name: getPluginOrPresetName(nameMap, filename)}
  }

  return {dirname, target: item, name: getPluginOrPresetName(nameMap, item)}
}

export type WrapperFnMap = Map<PluginOrPresetTarget, Function>
export type WrapperFnDirMap = Map<string, WrapperFnMap>

type WrapperFn = Function & {
  wrapped: Function
}

function arrifyPluginsOrPresets (list: PluginOrPresetDescriptor[], wrapperFnsByDir: WrapperFnDirMap): PluginOrPresetList {
  return list.map(item => {
    let wrapperFns: WrapperFnMap
    if (wrapperFnsByDir.has(item.dirname)) {
      wrapperFns = wrapperFnsByDir.get(item.dirname)!
    } else {
      wrapperFns = new Map()
      wrapperFnsByDir.set(item.dirname, wrapperFns)
    }

    let target: object | Function
    if (typeof item.target === 'object') {
      target = item.target
    } else if (wrapperFns.has(item.name)) {
      target = wrapperFns.get(item.name)!
    } else {
      const wrapped = item.target || loadPluginOrPreset(item.filename!)
      const targetFn: WrapperFn = Object.assign((api: any, options: any) => wrapped(api, options, item.dirname), {wrapped})
      wrapperFns.set(item.name, targetFn)
      target = targetFn
    }
    return [target, item.options, item.name]
  })
}

export function loadCachedModule (
  cache: Cache,
  dir: string,
  source: string,
  envName: string,
  selectEnv: boolean,
  selectOverride?: number
): ReducedBabelOptions {
  if (!cache) throw new Error(`A cache is required to load the configuration module at '${source}'`)

  const cached = cache.moduleSources.get(source)
  if (!cached) throw new Error(`Could not find the configuration module for '${source}' in the cache`)
  if (!isUnrestrictedModuleSource(cached) && !cached.byEnv.has(envName)) {
    throw new Error(`Could not find the configuration module, specific to the '${envName}' environment, for '${source}', in the cache`) // eslint-disable-line max-len
  }

  let options = cloneOptions(isUnrestrictedModuleSource(cached) ? cached.options : cached.byEnv.get(envName)!.options)
  if (selectOverride !== undefined) options = options.overrides![selectOverride]
  if (selectEnv) options = options.env![envName]
  delete options.env
  delete options.extends
  delete options.overrides
  normalizeSomeOptions(options)

  const resolutionCache = cache.pluginsAndPresets.get(dir)!
  if (Array.isArray(options.plugins)) {
    options.plugins = options.plugins.map(item => normalizePluginOrPreset(dir, resolutionCache, cache.nameMap, item, Kind.PLUGIN))
  } else {
    options.plugins = []
  }
  if (Array.isArray(options.presets)) {
    options.presets = options.presets.map(item => normalizePluginOrPreset(dir, resolutionCache, cache.nameMap, item, Kind.PRESET))
  } else {
    options.presets = []
  }
  return options as ReducedBabelOptions
}

export function mergeOptions (configs: ReducedBabelOptions[], wrapperFnsByDir: WrapperFnDirMap): BabelOptions {
  const merged = configs.reduce((target, options) => {
    mergePluginsOrPresets(target.plugins, options.plugins)
    delete options.plugins

    mergePluginsOrPresets(target.presets, options.presets)
    delete options.presets

    return merge(target, options)
  }, {plugins: [], presets: []} as ReducedBabelOptions)

  const retval = merged as BabelOptions
  if (merged.plugins.length > 0) {
    retval.plugins = arrifyPluginsOrPresets(merged.plugins, wrapperFnsByDir)
  } else {
    delete retval.plugins
  }
  if (merged.presets.length > 0) {
    retval.presets = arrifyPluginsOrPresets(merged.presets, wrapperFnsByDir)
  } else {
    delete retval.presets
  }

  return retval
}
