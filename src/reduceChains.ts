import cloneDeepWith = require('lodash.clonedeepwith')
import merge = require('lodash.merge')

import BabelOptions, {ReducedOptions, Plugins, Presets} from './BabelOptions'
import Cache from './Cache'
import {Chain, Chains} from './collector'
import resolvePluginsAndPresets, {Entry, ResolutionMap} from './resolvePluginsAndPresets'

export interface Dependency {
  default: boolean
  envs: Set<string>
  filename: string
  fromPackage: string | null
  hash?: string
}
type DependencyMap = Map<string, Dependency>

export interface Source {
  default: boolean
  envs: Set<string>
  hash?: string
  source: string
}
type SourceMap = Map<string, Source>

function trackDependency (
  dependencyMap: DependencyMap,
  filename: string,
  fromPackage: string | null,
  envName: string | null
): void {
  if (dependencyMap.has(filename)) {
    const existing = dependencyMap.get(filename)!
    if (envName) {
      existing.envs.add(envName)
    } else {
      existing.default = true
    }
    return
  }

  dependencyMap.set(filename, {
    default: !envName,
    envs: envName ? new Set([envName]) : new Set(),
    filename,
    fromPackage
  })
}

function trackSource (sourceMap: SourceMap, source: string, envName: string | null): void {
  if (sourceMap.has(source)) {
    const existing = sourceMap.get(source)!
    if (envName) {
      existing.envs.add(envName)
    } else {
      existing.default = true
    }
    return
  }

  sourceMap.set(source, {
    default: !envName,
    envs: new Set(envName ? [envName] : []),
    source
  })
}

function createOptions (plugins?: Plugins, presets?: Presets): ReducedOptions {
  const options: ReducedOptions = {}
  if (plugins) options.plugins = plugins
  // istanbul ignore else
  if (presets) options.presets = presets
  return options
}

export type CompressedOptions = BabelOptions[] & {json5: boolean}

function compressOptions (orderedOptions: BabelOptions[], json5: boolean): CompressedOptions {
  const remaining = orderedOptions.slice(0, 1)
  remaining[0].babelrc = false

  for (let index = 1; index < orderedOptions.length; index++) {
    const options = orderedOptions[index]
    delete options.babelrc

    const plugins = options.plugins
    delete options.plugins

    const presets = options.presets
    delete options.presets

    merge(remaining[0], options)

    if (plugins || presets) {
      remaining.push(createOptions(plugins, presets))
    }
  }

  return Object.assign(remaining, {json5})
}

function reduceOptions (
  chain: Chain,
  envName: string | null,
  pluginsAndPresets: ResolutionMap,
  dependencyMap: DependencyMap,
  sourceMap: SourceMap,
  fixedSourceHashes: Map<string, string>
): CompressedOptions {
  let json5 = false

  const orderedOptions = Array.from(chain, config => {
    trackSource(sourceMap, config.source, envName)
    if (config.hash) {
      fixedSourceHashes.set(config.source, config.hash)
    }

    if (config.json5) json5 = true

    // When used properly, pluginsAndPresets *will* contain a lookup for
    // `config`. Don't handle situations where this is not the case. This is an
    // internal module after all.
    const lookup = pluginsAndPresets.get(config)!
    const mapPluginOrPreset = (getEntry: (ref: string) => Entry, ref: string | [string, any]): string | [string, any] => {
      if (Array.isArray(ref)) {
        return ref.length === 1
          ? mapPluginOrPreset(getEntry, ref[0])
          : [mapPluginOrPreset(getEntry, ref[0]), ref[1]] as [string, any]
      }

      const entry = getEntry(ref)
      trackDependency(dependencyMap, entry.filename, entry.fromPackage, envName)
      return entry.filename
    }

    return cloneDeepWith(config.options, (value, key, object) => {
      if (object === config.options && (key === 'plugins' || key === 'presets')) {
        const getEntry = (ref: string) => lookup[key].get(ref)!
        return Array.isArray(value)
          ? (value as Plugins | Presets).map(ref => mapPluginOrPreset(getEntry, ref))
          : []
      }

      return undefined
    })
  })

  return compressOptions(orderedOptions, json5)
}

function sortKeys (a: [string, any], b: [string, any]): -1 | 1 {
  return a[0] < b[0] ? -1 : 1
}

export interface ReducedChains {
  dependencies: Dependency[]
  envNames: Set<string>
  fixedSourceHashes: Map<string, string>
  sources: Source[]
  unflattenedDefaultOptions: CompressedOptions
  unflattenedEnvOptions: Map<string, CompressedOptions>
}

export default function reduceChains (chains: Chains, cache?: Cache): ReducedChains {
  const pluginsAndPresets = resolvePluginsAndPresets(chains, cache)

  const dependencyMap: DependencyMap = new Map()
  const envNames = new Set<string>()
  const fixedSourceHashes = new Map<string, string>()
  const sourceMap: SourceMap = new Map()

  const unflattenedDefaultOptions = reduceOptions(
    chains.defaultChain, null, pluginsAndPresets, dependencyMap, sourceMap, fixedSourceHashes
  )

  const unflattenedEnvOptions = new Map<string, CompressedOptions>()
  for (const pair of chains.envChains) {
    const envName = pair[0]
    const chain = pair[1]

    envNames.add(envName)
    unflattenedEnvOptions.set(
      envName,
      reduceOptions(chain, envName, pluginsAndPresets, dependencyMap, sourceMap, fixedSourceHashes)
    )
  }

  const dependencies = Array.from(dependencyMap).sort(sortKeys).map(entry => entry[1])
  const sources = Array.from(sourceMap).sort(sortKeys).map(entry => entry[1])

  return {
    dependencies,
    envNames,
    fixedSourceHashes,
    sources,
    unflattenedDefaultOptions,
    unflattenedEnvOptions
  }
}
