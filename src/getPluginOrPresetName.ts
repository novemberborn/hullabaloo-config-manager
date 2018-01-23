import {PluginOrPresetTarget} from './BabelOptions'
import {NameMap} from './Cache'
import loadPluginOrPreset from './loadPluginOrPreset'

export default function getPluginOrPresetName (nameMap: NameMap, target: PluginOrPresetTarget): string {
  if (nameMap.has(target)) return nameMap.get(target)!

  if (typeof target === 'string') {
    const resolved = loadPluginOrPreset(target)
    let name
    if (nameMap.has(resolved)) {
      name = nameMap.get(resolved)!
    } else {
      name = `🤡🎪🎟.${nameMap.size}`
      nameMap.set(resolved, name)
    }
    nameMap.set(target, name)
    return name
  }

  const name = `🤡🎪🎟.${nameMap.size}`
  nameMap.set(target, name)
  return name
}
