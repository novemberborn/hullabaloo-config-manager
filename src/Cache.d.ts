declare type PluginsAndPresetsMapValue = Map<string, string | null>
declare type PluginsAndPresetsMap = Map<string, PluginsAndPresetsMapValue>
export {PluginsAndPresetsMap, PluginsAndPresetsMapValue}

declare interface Cache {
  dependencyHashes: Map<string, Promise<string>>
  fileExistence: Map<string, Promise<boolean>>
  files: Map<string, Promise<Buffer | null>>
  pluginsAndPresets: PluginsAndPresetsMap
  sourceHashes: Map<string, Promise<string>>
}
export default Cache
