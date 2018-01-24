import path = require('path')

import pkgDir = require('pkg-dir')
import resolveFrom = require('resolve-from')

import {PluginOrPresetList, PluginOrPresetTarget} from './BabelOptions'
import Cache, {PluginsAndPresetsMap, PluginsAndPresetsMapValue} from './Cache'
import {Chain, Chains, Config} from './collector'
import {ResolveError} from './errors'
import standardizeName from './standardizeName'

export interface PresetObject {
  plugins?: PluginOrPresetList
  presets?: PluginOrPresetList
}

function isPresetObject (target: PluginOrPresetTarget): target is PresetObject {
  return typeof target === 'object'
}

export const enum Kind {
  PLUGIN = 'plugin',
  PRESET = 'preset'
}

function normalize (arr: PluginOrPresetList | void): PluginOrPresetTarget[] {
  if (!Array.isArray(arr)) return []

  return arr.map(item => Array.isArray(item) ? item[0] : item)
}

function resolveName (name: string, fromDir: string, cache: PluginsAndPresetsMapValue): string | null {
  if (cache.has(name)) return cache.get(name)!

  const filename = resolveFrom.silent(fromDir, name)
  cache.set(name, filename)
  return filename
}

function resolvePackage (filename: string, fromFile: boolean): string | null {
  if (fromFile) return null

  return pkgDir.sync(filename)
}

export interface Entry {
  filename: string
  fromPackage: string | null
}

export type Resolutions = {
  plugins: Map<string, Entry>
  presets: Map<string, Entry>
}
export type ResolutionMap = Map<Config, Resolutions>

export default function resolvePluginsAndPresets (chains: Chains, sharedCache?: Cache): ResolutionMap {
  const dirCaches: PluginsAndPresetsMap = sharedCache
    ? sharedCache.pluginsAndPresets
    : new Map()
  const getCache = (dir: string): PluginsAndPresetsMapValue => {
    if (dirCaches.has(dir)) return dirCaches.get(dir)!

    const cache: PluginsAndPresetsMapValue = new Map()
    dirCaches.set(dir, cache)
    return cache
  }

  const byConfig: ResolutionMap = new Map()
  const resolveConfig = (config: Config) => {
    if (byConfig.has(config)) return

    const plugins = new Map<string, Entry>()
    const presets = new Map<string, Entry>()
    byConfig.set(config, {plugins, presets})

    const fromDir = config.dir
    const cache = getCache(fromDir)
    const resolve = (kind: Kind, ref: string) => {
      const possibility = standardizeName(kind, ref)
      const filename = resolveName(possibility.name, fromDir, cache)
      if (!filename) throw new ResolveError(config.source, kind, ref)

      const fromPackage = resolvePackage(filename, possibility.fromFile)
      const entry = {filename, fromPackage}
      if (kind === Kind.PLUGIN) {
        plugins.set(ref, entry)
      } else {
        presets.set(ref, entry)
      }
    }
    const resolvePlugins = (targets: PluginOrPresetTarget[]) => {
      for (const target of targets) {
        if (typeof target === 'string') resolve(Kind.PLUGIN, target)
      }
    }
    const resolvePresets = (targets: PluginOrPresetTarget[]) => {
      for (const target of targets) {
        if (typeof target === 'string') {
          resolve(Kind.PRESET, target)
        } else if (isPresetObject(target)) {
          resolvePlugins(normalize(target.plugins))
          resolvePresets(normalize(target.presets))
        }
      }
    }

    resolvePlugins(normalize(config.options.plugins))
    resolvePresets(normalize(config.options.presets))
  }

  const resolveChains = (iterable: Iterable<Chain>) => {
    for (const chain of iterable) {
      for (const config of chain) {
        resolveConfig(config)
      }
      resolveChains(chain.overrides)
    }
  }
  resolveChains(chains)

  return byConfig
}
