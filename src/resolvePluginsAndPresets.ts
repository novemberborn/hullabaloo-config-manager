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
        const possibleNames: {fromFile: boolean; name: string}[] = [] // eslint-disable-line typescript/member-delimiter-style
        if (isFilePath(ref)) {
          possibleNames.push({fromFile: true, name: ref})
        } else {
          if (kind === Kind.PLUGIN) {
            // Expand possible plugin names, see
            // https://github.com/babel/babel/blob/510e93b2bd434f05c816fe6639137b35bac267ed/packages/babel-core/src/helpers/get-possible-plugin-names.js

            // Babel doesn't expand scoped plugin references. @ is only valid at
            // the start of a package name, so disregard refs that would result
            // in `babel-plugin-@scope/name`.
            if (!ref.startsWith('@')) {
              const name = `babel-plugin-${ref}`
              possibleNames.push({fromFile: false, name})
            }
          } else {
            // Expand possible preset names, see
            // https://github.com/babel/babel/blob/510e93b2bd434f05c816fe6639137b35bac267ed/packages/babel-core/src/helpers/get-possible-preset-names.js

            const matches = /^(@.+?)\/([^/]+)(.*)/.exec(ref)
            if (matches !== null) {
              const scope = matches[1]
              const partialName = matches[2]
              const remainder = matches[3]

              const name = `${scope}/babel-preset-${partialName}${remainder}`
              possibleNames.push({fromFile: false, name})
            } else {
              const name = `babel-preset-${ref}`
              possibleNames.push({fromFile: false, name})
            }
          }

          possibleNames.push({fromFile: false, name: ref})
        }

        let entry: Entry | null = null
        for (const possibility of possibleNames) {
          const filename = resolveName(possibility.name, fromDir, cache)
          if (filename) {
            const fromPackage = resolvePackage(filename, possibility.fromFile)
            entry = {filename, fromPackage}
            break
          }
        }
        if (!entry) {
          throw new ResolveError(config.source, kind, ref)
        }

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
