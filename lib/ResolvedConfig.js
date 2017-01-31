'use strict'

const codegen = require('./codegen')
const reduceOptions = require('./reduceOptions')
const resolvePluginsAndPresets = require('./resolvePluginsAndPresets')

class ResolvedConfig {
  constructor (chains, cache) {
    const pluginsAndPresets = resolvePluginsAndPresets(chains, cache)

    this.babelrcDir = chains.babelrcDir
    this.withoutEnv = reduceOptions(chains.withoutEnv, pluginsAndPresets)
    this.byEnv = new Map()
    for (const pair of chains.byEnv) {
      const envName = pair[0]
      const chain = pair[1]
      this.byEnv.set(envName, reduceOptions(chain, pluginsAndPresets))
    }
  }

  generateModule () {
    return codegen(this)
  }
}
module.exports = ResolvedConfig
