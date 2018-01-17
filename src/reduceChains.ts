import merge = require('lodash.merge')
import pkgDir = require('pkg-dir')

// FIXME: Remove ESLint exception. BabelOptions *is* used but this isn't being detected.
// eslint-disable-next-line no-unused-vars
import BabelOptions, {PluginOrPresetItem, PluginOrPresetList, PluginOrPresetOptions} from './BabelOptions'
import Cache, {NameMap} from './Cache'
import cloneOptions from './cloneOptions'
import {Chain, Chains, Config, FileType, OverrideConfig} from './collector'
import getPluginOrPresetName from './getPluginOrPresetName'
import isFilePath from './isFilePath'
import mergePluginsOrPresets from './mergePluginsOrPresets'
import normalizeOptions from './normalizeOptions'
// FIXME: Remove ESLint exception. Entry *is* used but this isn't being detected.
// eslint-disable-next-line no-unused-vars
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

export type PluginOrPresetDescriptor = {
  filename?: string
  name: string
  target?: object | Function
  options?: PluginOrPresetOptions
}

function describePluginOrPreset (
  envName: string | null,
  dependencyMap: DependencyMap,
  nameMap: NameMap,
  getEntry: (ref: string) => Entry,
  item: PluginOrPresetItem
): PluginOrPresetDescriptor {
  if (Array.isArray(item)) {
    const target = item[0]
    if (typeof target !== 'string') {
      switch (item.length) {
        case 1: return {target, name: getPluginOrPresetName(nameMap, target)}
        case 2: return {target, options: item[1] as PluginOrPresetOptions, name: getPluginOrPresetName(nameMap, target)}
        default: return {target, options: item[1] as PluginOrPresetOptions, name: item[2] as string}
      }
    }

    const filename = mapPluginOrPresetTarget(envName, dependencyMap, getEntry, target)
    switch (item.length) {
      case 1: return {filename, name: getPluginOrPresetName(nameMap, filename)}
      case 2: return {filename, options: item[1] as PluginOrPresetOptions, name: getPluginOrPresetName(nameMap, filename)}
      default: return {filename, options: item[1] as PluginOrPresetOptions, name: item[2] as string}
    }
  }

  if (typeof item === 'string') {
    const filename = mapPluginOrPresetTarget(envName, dependencyMap, getEntry, item)
    return {filename, name: getPluginOrPresetName(nameMap, filename)}
  }

  return {target: item, name: getPluginOrPresetName(nameMap, item)}
}

export interface ReducedBabelOptions extends BabelOptions {
  plugins: PluginOrPresetDescriptor[]
  presets: PluginOrPresetDescriptor[]
}

export interface MergedConfig {
  fileType: FileType
  options: ReducedBabelOptions
  overrideIndex?: number
}

export interface ModuleConfig {
  dir: string
  envName: string | null
  fileType: FileType.JS
  source: string
  overrideIndex?: number
}

export type ConfigList = Array<MergedConfig | ModuleConfig> & {
  overrides: Array<MergedConfig | ModuleConfig>[]
}

export function isModuleConfig (object: MergedConfig | ModuleConfig): object is ModuleConfig {
  return object.fileType === FileType.JS
}

interface QueueItem {
  config: Config
  options: ReducedBabelOptions
  plugins: PluginOrPresetList
  presets: PluginOrPresetList
  overrideIndex?: number
}

function mergeChain (
  chain: Chain,
  envName: string | null,
  pluginsAndPresets: ResolutionMap,
  dependencyMap: DependencyMap,
  nameMap: NameMap,
  sourceMap: SourceMap,
  fixedSourceHashes: Map<string, string>
): ConfigList {
  const list: ConfigList = Object.assign([], {overrides: []})
  let tail: MergedConfig | null = null

  const queue = Array.from(chain, (config, index): QueueItem => {
    const options = cloneOptions(config.options)
    const overrideIndex = config instanceof OverrideConfig
      ? config.index
      : undefined
    const plugins = options.plugins
    const presets = options.presets
    delete options.plugins
    delete options.presets
    return {
      config,
      // The first config's options are not normalized.
      options: (index === 0 ? options : normalizeOptions(options)) as ReducedBabelOptions,
      plugins: Array.isArray(plugins) ? plugins : [],
      presets: Array.isArray(presets) ? presets : [],
      overrideIndex
    }
  })
  for (const item of queue) {
    const config = item.config
    trackSource(sourceMap, config.source, config.runtimeHash, envName)
    if (config.runtimeDependencies) {
      for (const dependency of config.runtimeDependencies) {
        const filename = dependency[0]
        const fromPackage = isFilePath(dependency[1]) ? null : pkgDir.sync(filename)
        trackDependency(dependencyMap, filename, fromPackage, envName)
      }
    }
    if (config.hash) {
      fixedSourceHashes.set(config.source, config.hash)
    }

    // When used properly, pluginsAndPresets *will* contain a lookup for
    // `config`. Don't handle situations where this is not the case. This is an
    // internal module after all.
    const lookup = pluginsAndPresets.get(config)!
    const getPluginEntry = (ref: string) => lookup.plugins.get(ref)!
    const getPresetEntry = (ref: string) => lookup.presets.get(ref)!

    const plugins = item.plugins.map(plugin => {
      return describePluginOrPreset(envName, dependencyMap, nameMap, getPluginEntry, plugin)
    })
    const presets = item.presets.map(preset => {
      return describePluginOrPreset(envName, dependencyMap, nameMap, getPresetEntry, preset)
    })

    if (config.fileType === FileType.JS) {
      // Note that preparing `plugins` and `presets` has added them to
      // `dependencyMap`. This will still be used when determining the
      // configuration hash, even if the values are discarded.
      const moduleConfig: ModuleConfig = {
        dir: config.dir,
        envName: config.envName,
        fileType: config.fileType,
        source: config.source
      }
      if (item.overrideIndex !== undefined) {
        moduleConfig.overrideIndex = item.overrideIndex
      }
      list.push(moduleConfig)
      tail = null
    } else if (tail && item.overrideIndex === tail.overrideIndex) {
      mergePluginsOrPresets(tail.options.plugins!, plugins)
      mergePluginsOrPresets(tail.options.presets!, presets)
      merge(tail.options, item.options)

      if (tail.fileType === FileType.JSON && config.fileType === FileType.JSON5) {
        tail.fileType = config.fileType
      }
    } else {
      item.options.plugins = plugins
      item.options.presets = presets
      tail = {
        fileType: config.fileType,
        options: item.options
      }
      if (item.overrideIndex !== undefined) {
        tail.overrideIndex = item.overrideIndex
      }
      list.push(tail)
    }
  }

  for (const overrideChain of chain.overrides) {
    const merged = mergeChain(
      overrideChain,
      envName,
      pluginsAndPresets,
      dependencyMap,
      nameMap,
      sourceMap,
      fixedSourceHashes
    )

    for (const recursive of merged.overrides) {
      list.overrides.push(recursive)
    }
    list.overrides.push(merged.slice())
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
  const nameMap: NameMap = cache ? cache.nameMap : new Map()
  const envNames = new Set<string>()
  const fixedSourceHashes = new Map<string, string>()
  const sourceMap: SourceMap = new Map()

  const unflattenedDefaultOptions = mergeChain(
    chains.defaultChain, null, pluginsAndPresets, dependencyMap, nameMap, sourceMap, fixedSourceHashes
  )

  const unflattenedEnvOptions = new Map<string, ConfigList>()
  for (const pair of chains.envChains) {
    const envName = pair[0]
    const chain = pair[1]

    envNames.add(envName)
    unflattenedEnvOptions.set(
      envName,
      mergeChain(chain, envName, pluginsAndPresets, dependencyMap, nameMap, sourceMap, fixedSourceHashes)
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
