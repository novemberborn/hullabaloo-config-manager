import BabelOptions, {PluginOrPresetTarget} from './BabelOptions'

export interface ModuleSource {
  options: BabelOptions
  runtimeDependencies: Map<string, string>
  runtimeHash: string | null
  unrestricted: boolean
}
export interface UnrestrictedModuleSource extends ModuleSource {
  unrestricted: true
}
export interface EnvModuleSource {
  byEnv: Map<string, ModuleSource>
  factory (envName: string): ModuleSource
}
export type ModuleSourcesMap = Map<string, UnrestrictedModuleSource | EnvModuleSource>

export type NameMap = Map<PluginOrPresetTarget, string>

export type PluginsAndPresetsMapValue = Map<string, string | null>
export type PluginsAndPresetsMap = Map<string, PluginsAndPresetsMapValue>

export default interface Cache {
  dependencyHashes: Map<string, Promise<string>>
  fileExistence: Map<string, Promise<boolean>>
  files: Map<string, Promise<Buffer | null>>
  moduleSources: ModuleSourcesMap
  nameMap: NameMap
  pluginsAndPresets: PluginsAndPresetsMap
  sourceHashes: Map<string, Promise<string>>
}

export function prepare (): Cache {
  return {
    dependencyHashes: new Map(),
    fileExistence: new Map(),
    files: new Map(),
    moduleSources: new Map(),
    nameMap: new Map(),
    pluginsAndPresets: new Map(),
    sourceHashes: new Map()
  }
}

export function isUnrestrictedModuleSource (
  value: UnrestrictedModuleSource | EnvModuleSource
): value is UnrestrictedModuleSource {
  return 'unrestricted' in value
}
