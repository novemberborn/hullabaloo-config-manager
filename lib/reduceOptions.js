'use strict'

const cloneDeepWith = require('lodash.clonedeepwith')
const merge = require('lodash.merge')

function createOptions (plugins, presets) {
  const options = {}
  if (plugins) options.plugins = plugins
  // istanbul ignore else
  if (presets) options.presets = presets
  return options
}

function reduceOptions (orderedOptions) {
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

  return remaining
}

function reduceChain (chain, pluginsAndPresets) {
  const dependencies = new Map()
  const sources = new Set()
  let json5 = false

  const orderedOptions = Array.from(chain, config => {
    sources.add(config.source)
    if (config.json5) json5 = true

    const lookup = pluginsAndPresets.get(config)
    const mapPluginOrPreset = (getEntry, ref) => {
      if (Array.isArray(ref)) {
        return [mapPluginOrPreset(getEntry, ref[0]), ref[1]]
      }

      const entry = getEntry(ref)
      dependencies.set(entry.filename, entry)
      return entry.filename
    }

    return cloneDeepWith(config.options, (value, key, object) => {
      if (object === config.options && (key === 'plugins' || key === 'presets')) {
        const getEntry = ref => lookup[key].get(ref)
        return Array.isArray(value)
          ? value.map(ref => mapPluginOrPreset(getEntry, ref))
          : []
      }
    })
  })

  return {
    dependencies: Array.from(dependencies, pair => pair[1]),
    json5,
    sources: Array.from(sources),
    unflattenedOptions: reduceOptions(orderedOptions)
  }
}

module.exports = reduceChain
