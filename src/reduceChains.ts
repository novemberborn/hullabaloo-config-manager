import merge = require('lodash.merge')

import BabelOptions, {PluginOrPresetItem} from './BabelOptions'
import Cache from './Cache'
import cloneOptions from './cloneOptions'
import {Chain, Chains, FileType} from './collector'
import normalizeOptions from './normalizeOptions'
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
  runtimeHash: string | null
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

function trackSource (sourceMap: SourceMap, source: string, runtimeHash: string | null, envName: string | null): void {
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
    runtimeHash,
    source
  })
}

function mapPluginOrPresetTarget (
  envName: string | null,
  dependencyMap: DependencyMap,
  getEntry: (ref: string) => Entry,
  target: string
): string {
  const entry = getEntry(target)
  trackDependency(dependencyMap, entry.filename, entry.fromPackage, envName)
  return entry.filename
}

function mapPluginOrPreset (
  envName: string | null,
  dependencyMap: DependencyMap,
  getEntry: (ref: string) => Entry,
  item: PluginOrPresetItem
): PluginOrPresetItem {
  if (Array.isArray(item)) {
    const target = item[0]
    if (typeof target !== 'string') return item

    const filename = mapPluginOrPresetTarget(envName, dependencyMap, getEntry, target)
    switch (item.length) {
      case 1: return filename
      case 2: return [filename, item[1]]
      default: return [filename, item[1], item[2]]
    }
  }

  return typeof item === 'string'
    ? mapPluginOrPresetTarget(envName, dependencyMap, getEntry, item)
    : item
}

export interface MergedConfig {
  fileType: FileType
  options: BabelOptions
}

export interface ModuleConfig {
  dir: string
  envName: string | null
  fileType: FileType.JS
  source: string
}

export type ConfigList = Array<MergedConfig | ModuleConfig>

export function isModuleConfig (object: MergedConfig | ModuleConfig): object is ModuleConfig {
  return object.fileType === FileType.JS
}

function mergeChain (
  chain: Chain,
  envName: string | null,
  pluginsAndPresets: ResolutionMap,
  dependencyMap: DependencyMap,
  sourceMap: SourceMap,
  fixedSourceHashes: Map<string, string>
): ConfigList {
  const list: ConfigList = []
  let tail: MergedConfig | null = null

  const queue = Array.from(chain, (config, index) => {
    const options = cloneOptions(config.options)
    const plugins = options.plugins
    const presets = options.presets
    delete options.plugins
    delete options.presets
    return {
      config,
      // The first config's options are not normalized.
      options: index === 0 ? options : normalizeOptions(options),
      plugins: Array.isArray(plugins) ? plugins : null,
      presets: Array.isArray(presets) ? presets : null
    }
  })
  for (const item of queue) {
    const config = item.config
    trackSource(sourceMap, config.source, config.runtimeHash, envName)
    if (config.hash) {
      fixedSourceHashes.set(config.source, config.hash)
    }

    // When used properly, pluginsAndPresets *will* contain a lookup for
    // `config`. Don't handle situations where this is not the case. This is an
    // internal module after all.
    const lookup = pluginsAndPresets.get(config)!
    const getPluginEntry = (ref: string) => lookup.plugins.get(ref)!
    const getPresetEntry = (ref: string) => lookup.presets.get(ref)!

    const plugins = item.plugins && item.plugins.map(plugin => mapPluginOrPreset(envName, dependencyMap, getPluginEntry, plugin))
    const presets = item.presets && item.presets.map(preset => mapPluginOrPreset(envName, dependencyMap, getPresetEntry, preset))

    if (config.fileType === FileType.JS) {
      // Note that preparing `plugins` and `presets` has added them to
      // `dependencyMap`. This will still be used when determining the
      // configuration hash, even if the values are discarded.
      list.push({
        dir: config.dir,
        envName: config.envName,
        fileType: config.fileType,
        source: config.source
      })
      tail = null
    } else if (tail) {
      if (plugins) {
        tail.options.plugins = tail.options.plugins
          ? tail.options.plugins.concat(plugins)
          : plugins
      }
      if (presets) {
        tail.options.presets = tail.options.presets
          ? tail.options.presets.concat(presets)
          : presets
      }
      merge(tail.options, item.options)

      if (tail.fileType === FileType.JSON && config.fileType === FileType.JSON5) {
        tail.fileType = config.fileType
      }
    } else {
      if (plugins) {
        item.options.plugins = plugins
      }
      if (presets) {
        item.options.presets = presets
      }
      tail = {
        fileType: config.fileType,
        options: item.options
      }
      list.push(tail)
    }
  }

  return list
}

function sortKeys (a: [string, any], b: [string, any]): -1 | 1 {
  return a[0] < b[0] ? -1 : 1
}

export interface ReducedChains {
  dependencies: Dependency[]
  envNames: Set<string>
  fixedSourceHashes: Map<string, string>
  sources: Source[]
  unflattenedDefaultOptions: ConfigList
  unflattenedEnvOptions: Map<string, ConfigList>
}

export default function reduceChains (chains: Chains, cache?: Cache): ReducedChains {
  const pluginsAndPresets = resolvePluginsAndPresets(chains, cache)

  const dependencyMap: DependencyMap = new Map()
  const envNames = new Set<string>()
  const fixedSourceHashes = new Map<string, string>()
  const sourceMap: SourceMap = new Map()

  const unflattenedDefaultOptions = mergeChain(
    chains.defaultChain, null, pluginsAndPresets, dependencyMap, sourceMap, fixedSourceHashes
  )

  const unflattenedEnvOptions = new Map<string, ConfigList>()
  for (const pair of chains.envChains) {
    const envName = pair[0]
    const chain = pair[1]

    envNames.add(envName)
    unflattenedEnvOptions.set(
      envName,
      mergeChain(chain, envName, pluginsAndPresets, dependencyMap, sourceMap, fixedSourceHashes)
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
