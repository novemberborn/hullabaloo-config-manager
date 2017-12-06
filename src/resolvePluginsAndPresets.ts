import path = require('path')

import pkgDir = require('pkg-dir')
import resolveFrom = require('resolve-from')

import Cache, {PluginsAndPresetsMap, PluginsAndPresetsMapValue} from './Cache'
import {Chains, Config} from './collector'

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

function isFilePath (ref: string): boolean {
  return path.isAbsolute(ref) || ref.startsWith('./') || ref.startsWith('../')
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

// Based on https://github.com/babel/babel/blob/master/packages/babel-core/src/config/loading/files/plugins.js#L60:L86
// but with fewer regular expressions 😉
function standardizeName (kind: Kind, ref: string): {fromFile: boolean, name: string} { // eslint-disable-line typescript/member-delimiter-style
  if (isFilePath(ref)) return {fromFile: true, name: ref}
  if (ref.startsWith('module:')) return {fromFile: false, name: ref.slice(7)}

  if (kind === Kind.PLUGIN) {
    if (ref.startsWith('babel-plugin-') || ref.startsWith('@babel/plugin-')) return {fromFile: false, name: ref}
    if (ref.startsWith('@babel/')) return {fromFile: false, name: `@babel/plugin-${ref.slice(7)}`}
    if (!ref.startsWith('@')) return {fromFile: false, name: `babel-plugin-${ref}`}
  } else {
    if (ref.startsWith('babel-preset-') || ref.startsWith('@babel/preset-')) return {fromFile: false, name: ref}
    if (ref.startsWith('@babel/')) return {fromFile: false, name: `@babel/preset-${ref.slice(7)}`}
    if (!ref.startsWith('@')) return {fromFile: false, name: `babel-preset-${ref}`}
  }

  // At this point `ref` is guaranteed to be scoped.
  const matches = /^(@.+?)\/([^/]+)(.*)/.exec(ref)!
  const scope = matches[1]
  const partialName = matches[2]
  const remainder = matches[3]
  return {fromFile: false, name: `${scope}/babel-${kind === Kind.PLUGIN ? 'plugin' : 'preset'}-${partialName}${remainder}`}
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
  const dirCaches: PluginsAndPresetsMap = (sharedCache && sharedCache.pluginsAndPresets) || new Map()
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

      for (const ref of normalize(config.options.plugins)) {
        resolve(Kind.PLUGIN, ref)
      }
      for (const ref of normalize(config.options.presets)) {
        resolve(Kind.PRESET, ref)
      }
    }
  }

  return byConfig
}
