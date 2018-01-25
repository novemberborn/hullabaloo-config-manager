import merge = require('lodash.merge')
import resolveFrom = require('resolve-from')

import Cache, {isUnrestrictedModuleSource, NameMap, PluginsAndPresetsMapValue} from './Cache'
import BabelOptions, {PluginOrPresetItem, PluginOrPresetList, PluginOrPresetOptions, PluginOrPresetTarget} from './BabelOptions'
import cloneOptions from './cloneOptions'
import {ResolveFromCacheError} from './errors'
import {
  isFileDescriptor,
  PluginOrPresetFileDescriptor,
  PluginOrPresetDescriptor,
  PluginOrPresetDescriptorList,
  ReducedBabelOptions
} from './reduceChains'
import getPluginOrPresetName from './getPluginOrPresetName'
import loadPluginOrPreset from './loadPluginOrPreset'
import mergePluginsOrPresets from './mergePluginsOrPresets'
import normalizeSomeOptions from './normalizeOptions'
import standardizeName from './standardizeName'
import {Kind, PresetObject} from './resolvePluginsAndPresets'

// Called for plugins and presets found when loading cached configuration modules.
function resolvePluginOrPreset (source: string, resolutionCache: PluginsAndPresetsMapValue, kind: Kind, ref: string): string {
  const name = standardizeName(kind, ref).name
  if (!resolutionCache.has(name)) throw new ResolveFromCacheError(source, kind, ref)
  return resolutionCache.get(name)!
}

// Called for plugins and presets found at runtime in preset objects.
function resolveDynamicPluginOrPreset (kind: Kind, dirname: string, ref: string) {
  const name = standardizeName(kind, ref).name
  const filename = resolveFrom(dirname, name)
  return loadPluginOrPreset(filename)
}

interface DescribedPresetObject extends PresetObject {
  plugins?: PluginOrPresetDescriptorList
  presets?: PluginOrPresetDescriptorList
}

function describePluginOrPreset (
  dirname: string,
  source: string,
  resolutionCache: PluginsAndPresetsMapValue,
  nameMap: NameMap,
  item: PluginOrPresetItem,
  kind: Kind
): PluginOrPresetFileDescriptor | PluginOrPresetDescriptor {
  if (Array.isArray(item)) {
    const target = item[0]
    if (typeof target !== 'string') {
      const name = getPluginOrPresetName(nameMap, target)
      switch (item.length) {
        case 1: return {dirname, target, name}
        case 2: return {dirname, target, options: item[1] as PluginOrPresetOptions, name}
        default: return {dirname, target, options: item[1] as PluginOrPresetOptions, name: `${name}.${item[2]}`}
      }
    }

    const filename = resolvePluginOrPreset(source, resolutionCache, kind, target)
    const name = getPluginOrPresetName(nameMap, filename)
    switch (item.length) {
      case 1: return {dirname, filename, name}
      case 2: return {dirname, filename, options: item[1] as PluginOrPresetOptions, name}
      default: return {dirname, filename, options: item[1] as PluginOrPresetOptions, name: `${name}.${item[2]}`}
    }
  }

  if (typeof item === 'string') {
    const filename = resolvePluginOrPreset(source, resolutionCache, kind, item)
    return {dirname, filename, name: getPluginOrPresetName(nameMap, filename)}
  }

  return {dirname, target: item, name: getPluginOrPresetName(nameMap, item)}
}

// Rewrite plugins from cached configuration modules to match those from regular
// configuration files.
function describePlugin (
  dirname: string,
  source: string,
  resolutionCache: PluginsAndPresetsMapValue,
  nameMap: NameMap,
  item: PluginOrPresetItem
): PluginOrPresetFileDescriptor | PluginOrPresetDescriptor {
  return describePluginOrPreset(dirname, source, resolutionCache, nameMap, item, Kind.PLUGIN)
}

// Rewrite presets from cached configuration modules to match those from regular
// configuration files.
function describePreset (
  dirname: string,
  source: string,
  resolutionCache: PluginsAndPresetsMapValue,
  nameMap: NameMap,
  item: PluginOrPresetItem
): PluginOrPresetFileDescriptor | PluginOrPresetDescriptor {
  const descriptor = describePluginOrPreset(dirname, source, resolutionCache, nameMap, item, Kind.PRESET)
  if (!isFileDescriptor(descriptor) && typeof descriptor.target === 'object') {
    const target: PresetObject = {...descriptor.target}
    if (Array.isArray(target.plugins)) {
      target.plugins = target.plugins.map(plugin => describePlugin(dirname, source, resolutionCache, nameMap, plugin))
    }
    if (Array.isArray(target.presets)) {
      target.presets = target.presets.map(preset => describePreset(dirname, source, resolutionCache, nameMap, preset))
    }
    descriptor.target = target
  }
  return descriptor
}

export type WrapperFn = Function & {wrapped: Function}
export type WrapperFnMap = Map<PluginOrPresetTarget, WrapperFn>
export type WrapperFnDirMap = Map<string, WrapperFnMap>

function arrifyPluginsOrPresets (
  list: PluginOrPresetDescriptorList,
  wrapperFnsByDir: WrapperFnDirMap,
  rewrite?: (dirname: string, pluginOrPreset: object) => object
): PluginOrPresetList {
  return list.map(item => {
    let wrapperFns: WrapperFnMap
    if (wrapperFnsByDir.has(item.dirname)) {
      wrapperFns = wrapperFnsByDir.get(item.dirname)!
    } else {
      wrapperFns = new Map()
      wrapperFnsByDir.set(item.dirname, wrapperFns)
    }

    let target: object | Function
    if (!isFileDescriptor(item) && typeof item.target === 'object') {
      target = item.target
    } else if (wrapperFns.has(item.name)) {
      target = wrapperFns.get(item.name)!
    } else {
      const wrapped = isFileDescriptor(item) ? loadPluginOrPreset(item.filename) : item.target as Function
      const targetFn: WrapperFn = Object.assign(
        rewrite
          ? (api: any, options: any) => rewrite(item.dirname, wrapped(api, options, item.dirname))
          : (api: any, options: any) => wrapped(api, options, item.dirname),
        {wrapped})
      wrapperFns.set(item.name, targetFn)
      target = targetFn
    }
    return [target, item.options, item.name]
  })
}

// Turn plugin objects back into arrays for use in Babel.
function arrifyPlugins (list: PluginOrPresetDescriptorList, wrapperFnsByDir: WrapperFnDirMap): PluginOrPresetList {
  return arrifyPluginsOrPresets(list, wrapperFnsByDir)
}

// Rewrite a preset object so its plugins and presets are resolved relative
// to the correct dirname and factories are called with the correct dirname.
function rewritePreset (dirname: string, obj: PresetObject): PresetObject {
  // istanbul ignore next
  if (!obj || typeof obj !== 'object') return obj

  obj = {...obj}
  if (Array.isArray(obj.plugins)) {
    const pluginWrapperFns: WrapperFnMap = new Map()
    obj.plugins = obj.plugins.map(plugin => {
      const target = Array.isArray(plugin) ? (plugin as [PluginOrPresetTarget])[0] : plugin
      if (typeof target === 'object') return plugin

      let targetFn: WrapperFn
      const wrapped = typeof target === 'function' ? target : resolveDynamicPluginOrPreset(Kind.PLUGIN, dirname, target)
      if (pluginWrapperFns.has(wrapped)) {
        targetFn = pluginWrapperFns.get(wrapped)!
      } else {
        targetFn = Object.assign((api: any, options: any) => wrapped(api, options, dirname), {wrapped})
        pluginWrapperFns.set(wrapped, targetFn)
      }

      if (Array.isArray(plugin)) {
        switch (plugin.length) {
          case 1: return [targetFn]
          case 2: return [targetFn, plugin[1]]
          default: return [targetFn, plugin[1], plugin[2]]
        }
      } else {
        return targetFn
      }
    })
  }

  if (Array.isArray(obj.presets)) {
    const presetWrapperFns: WrapperFnMap = new Map()
    obj.presets = obj.presets.map(preset => {
      const target = Array.isArray(preset) ? (preset as [PluginOrPresetTarget])[0] : preset
      if (typeof target === 'object') {
        const rewritten = rewritePreset(dirname, target)
        if (Array.isArray(preset)) {
          switch (preset.length) {
            case 1: return [rewritten]
            case 2: return [rewritten, preset[1]]
            default: return [rewritten, preset[1], preset[2]]
          }
        } else {
          return rewritten
        }
      }

      let targetFn: WrapperFn
      const wrapped = typeof target === 'function' ? target : resolveDynamicPluginOrPreset(Kind.PRESET, dirname, target)
      if (presetWrapperFns.has(wrapped)) {
        targetFn = presetWrapperFns.get(wrapped)!
      } else {
        targetFn = Object.assign((api: any, options: any) => rewritePreset(dirname, wrapped(api, options, dirname)), {wrapped})
        presetWrapperFns.set(wrapped, targetFn)
      }

      if (Array.isArray(preset)) {
        switch (preset.length) {
          case 1: return [targetFn]
          case 2: return [targetFn, preset[1]]
          default: return [targetFn, preset[1], preset[2]]
        }
      } else {
        return targetFn
      }
    })
  }

  return obj
}

// Turn preset objects back into arrays for use in Babel.
function arrifyPresets (list: PluginOrPresetDescriptorList, wrapperFnsByDir: WrapperFnDirMap): PluginOrPresetList {
  return arrifyPluginsOrPresets(list, wrapperFnsByDir, rewritePreset).map(preset => {
    const target = (preset as [DescribedPresetObject])[0]
    if (typeof target === 'object') {
      const obj: PresetObject = {...target}
      if (Array.isArray(target.plugins)) {
        obj.plugins = arrifyPlugins(target.plugins, wrapperFnsByDir)
      }
      if (Array.isArray(target.presets)) {
        obj.presets = arrifyPresets(target.presets, wrapperFnsByDir)
      }
      (preset as [PluginOrPresetTarget])[0] = obj
    }
    return preset
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
    options.plugins = options.plugins.map(item => describePlugin(dir, source, resolutionCache, cache.nameMap, item))
  } else {
    options.plugins = []
  }
  if (Array.isArray(options.presets)) {
    options.presets = options.presets.map(item => describePreset(dir, source, resolutionCache, cache.nameMap, item))
  } else {
    options.presets = []
  }
  // Don't check for duplicate plugin or preset names. Presumably these have
  // been validated when configs were collected.

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
    retval.plugins = arrifyPlugins(merged.plugins, wrapperFnsByDir)
  } else {
    delete retval.plugins
  }
  if (merged.presets.length > 0) {
    retval.presets = arrifyPresets(merged.presets, wrapperFnsByDir)
  } else {
    delete retval.presets
  }

  return retval
}
