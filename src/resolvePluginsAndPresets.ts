import path = require('path')

import pkgDir = require('pkg-dir')
import resolveFrom = require('resolve-from')

import Cache, {PluginsAndPresetsMap, PluginsAndPresetsMapValue} from './Cache'
import {Chains, Config} from './collector'
import standardizeName from './standardizeName'

export const enum Kind {
  PLUGIN = 'plugin',
  PRESET = 'preset'
}

class ResolveError extends Error {
  public readonly source: string
  public readonly ref: string
  public readonly isPlugin: boolean
  public readonly isPreset: boolean

  public constructor (source: string, kind: Kind, ref: string) {
    super(`${source}: Couldn't find ${kind} ${JSON.stringify(ref)} relative to directory`)
    this.name = 'ResolveError'
    this.source = source
    this.ref = ref
    this.isPlugin = kind === 'plugin'
    this.isPreset = kind === 'preset'
  }
}

function normalize (arr: any): string[] {
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

export type ResolutionMap = Map<Config, {
  plugins: Map<string, Entry>
  presets: Map<string, Entry>
}>

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
  for (const chain of chains) {
    for (const config of chain) {
      if (byConfig.has(config)) continue

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

      for (const target of normalize(config.options.plugins)) {
        if (typeof target === 'string') resolve(Kind.PLUGIN, target)
      }
      for (const target of normalize(config.options.presets)) {
        if (typeof target === 'string') resolve(Kind.PRESET, target)
      }
    }
  }

  return byConfig
}
