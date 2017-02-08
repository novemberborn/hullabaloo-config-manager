'use strict'

const collector = require('./lib/collector')
const currentEnv = require('./lib/currentEnv')
const ResolvedConfig = require('./lib/ResolvedConfig')
const Verifier = require('./lib/Verifier')

exports.currentEnv = currentEnv

function fromDirectory (dir, options) {
  options = options || {}
  return collector.fromDirectory(dir, options.cache)
    .then(chains => chains && new ResolvedConfig(chains, options.cache))
}
exports.fromDirectory = fromDirectory

function fromVirtual (babelOptions, source, options) {
  options = options || {}
  return collector.fromVirtual(babelOptions, source, options.cache, options.json5)
    .then(chains => chains && new ResolvedConfig(chains, options.cache))
}
exports.fromVirtual = fromVirtual

function prepareCache () {
  return {
    dependencyHashes: new Map(),
    fileExistence: new Map(),
    files: new Map(),
    pluginsAndPresets: new Map(),
    sourceHashes: new Map()
  }
}
exports.prepareCache = prepareCache

exports.Verifier = Verifier
