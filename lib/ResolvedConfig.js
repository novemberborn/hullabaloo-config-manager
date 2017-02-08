'use strict'

const codegen = require('./codegen')
const reduceOptions = require('./reduceOptions')
const resolvePluginsAndPresets = require('./resolvePluginsAndPresets')
const Verifier = require('./Verifier')

class ResolvedConfig {
  constructor (chains, cache) {
    const pluginsAndPresets = resolvePluginsAndPresets(chains, cache)

    this.cache = cache
    this.babelrcDir = chains.babelrcDir
    this.withoutEnv = reduceOptions(chains.withoutEnv, pluginsAndPresets)
    this.byEnv = new Map()
    for (const pair of chains.byEnv) {
      const envName = pair[0]
      const chain = pair[1]
      this.byEnv.set(envName, reduceOptions(chain, pluginsAndPresets))
    }
  }

  createVerifier () {
    const envNames = new Set(this.byEnv.keys())
    const dependencies = new Map(
      this.withoutEnv.dependencies.map(entry => [entry.filename, {
        default: true,
        envs: new Set(),
        filename: entry.filename,
        fromPackage: entry.fromPackage
      }]))

    const sources = new Map(
      this.withoutEnv.sources.map(source => [source, {
        default: true,
        envs: new Set(),
        source
      }]))

    for (const envName of envNames) {
      const reduced = this.byEnv.get(envName)

      for (const entry of reduced.dependencies) {
        if (dependencies.has(entry.filename)) {
          dependencies.get(entry.filename).envs.add(envName)
        } else {
          dependencies.set(entry.filename, {
            default: false,
            envs: new Set([envName]),
            filename: entry.filename,
            fromPackage: entry.fromPackage
          })
        }
      }

      for (const source of reduced.sources) {
        if (sources.has(source)) {
          sources.get(source).envs.add(envName)
        } else {
          sources.set(source, {
            default: false,
            envs: new Set([envName]),
            source
          })
        }
      }
    }

    return Verifier.hashAndCreate(
      this.babelrcDir,
      envNames,
      Array.from(dependencies.keys())
        .sort()
        .map(filename => dependencies.get(filename)),
      Array.from(sources.keys())
        .sort()
        .map(source => sources.get(source)),
      this.cache)
  }

  generateModule () {
    return codegen(this)
  }
}
module.exports = ResolvedConfig
