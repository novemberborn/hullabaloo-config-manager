'use strict'

const codegen = require('./lib/codegen')
const collector = require('./lib/collector')
const resolvePluginsAndPresets = require('./lib/resolvePluginsAndPresets')

class ResolvedConfig {
  constructor (chains) {
    this.chains = chains
    this.pluginsAndPresets = resolvePluginsAndPresets(chains)
  }

  generateModule () {
    return codegen(this.chains, this.pluginsAndPresets)
  }
}

function fromDirectory (dir) {
  return collector.fromDirectory(dir)
    .then(chains => chains && new ResolvedConfig(chains))
}
exports.fromDirectory = fromDirectory

function fromVirtual (babelOptions, source, options) {
  options = options || {}
  return collector.fromVirtual(babelOptions, source, options.json5)
    .then(chains => chains && new ResolvedConfig(chains))
}
exports.fromVirtual = fromVirtual
