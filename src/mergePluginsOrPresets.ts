import {PluginOrPresetDescriptorList} from './reduceChains'

export default function mergePluginsOrPresets (target: PluginOrPresetDescriptorList, source: PluginOrPresetDescriptorList) {
  const reverseLookup = new Map(target.map<[string, number]>((item, index) => {
    return [item.name, index]
  }))
  for (const item of source) {
    if (reverseLookup.has(item.name)) {
      target[reverseLookup.get(item.name)!] = item
    } else {
      target.push(item)
    }
  }
}
