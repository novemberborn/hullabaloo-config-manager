import BabelOptions from './BabelOptions'

export default function cloneOptions (options: BabelOptions): BabelOptions {
  const shallow = {...options}

  if (options.env && typeof options.env === 'object') {
    shallow.env = {}
    for (const envName of Object.keys(options.env)) {
      shallow.env[envName] = cloneOptions(options.env[envName])
    }
  }

  if (shallow.overrides && Array.isArray(shallow.overrides)) {
    shallow.overrides = shallow.overrides.map(override => cloneOptions(override))
  }

  if (shallow.inputSourceMap && typeof shallow.inputSourceMap === 'object') {
    shallow.inputSourceMap = {...shallow.inputSourceMap}
  }
  if (shallow.generatorOpts && typeof shallow.generatorOpts === 'object') {
    shallow.generatorOpts = {...shallow.generatorOpts}
  }
  if (shallow.parserOpts && typeof shallow.parserOpts === 'object') {
    shallow.parserOpts = {...shallow.parserOpts}
  }

  if (Array.isArray(shallow.ignore)) {
    shallow.ignore = shallow.ignore.slice()
  }
  if (Array.isArray(shallow.only)) {
    shallow.only = shallow.only.slice()
  }

  if (Array.isArray(shallow.plugins)) {
    shallow.plugins = shallow.plugins.map(plugin => Array.isArray(plugin) ? plugin.slice() : plugin)
  }
  if (Array.isArray(shallow.presets)) {
    shallow.presets = shallow.presets.map(preset => Array.isArray(preset) ? preset.slice() : preset)
  }

  return shallow
}
