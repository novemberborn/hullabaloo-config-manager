import {PluginOrPresetTarget} from './BabelOptions'
import {NameMap} from './Cache'

export default function getPluginOrPresetName (nameMap: NameMap, target: PluginOrPresetTarget): string {
  if (nameMap.has(target)) return nameMap.get(target)!

  if (typeof target === 'string') {
    const resolved = require(target) // eslint-disable-line import/no-dynamic-require
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
