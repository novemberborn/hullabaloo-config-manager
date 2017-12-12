import path = require('path')

import cloneDeep = require('lodash.clonedeep')

import BabelOptions from './BabelOptions'
import Cache from './Cache'
import * as collector from './collector'
import currentEnv from './currentEnv'
import ResolvedConfig from './ResolvedConfig'
import Verifier from './Verifier'

export {currentEnv}

export interface CreateOptions {
  options: BabelOptions
  source: string
  dir?: string
  hash?: string
  json5?: false
}

export interface FromOptions {
  cache?: Cache
}

export function createConfig (options: CreateOptions): collector.Config {
  if (!options || !options.options || !options.source) {
    throw new TypeError("Expected 'options' and 'source' options")
  }
  if (typeof options.options !== 'object' || Array.isArray(options.options)) {
    throw new TypeError("'options' must be an actual object")
  }

  const source = options.source
  const dir = options.dir || path.dirname(source)
  const hash = options.hash || null
  const json5 = options.json5 !== false
  const babelOptions = cloneDeep(options.options)

  if (Object.prototype.hasOwnProperty.call(babelOptions, 'envName')) {
    throw new TypeError("'options' must not have an 'envName' property")
  }

  return new collector.Config(dir, null, hash, json5, babelOptions, source)
}

export async function fromConfig (baseConfig: collector.Config, options?: FromOptions): Promise<ResolvedConfig> {
  const cache = options && options.cache
  const chains = await collector.fromConfig(baseConfig, cache)
  return new ResolvedConfig(chains, cache)
}

export async function fromDirectory (dir: string, options?: FromOptions): Promise<ResolvedConfig | null> {
  const cache = options && options.cache
  const chains = await collector.fromDirectory(dir, cache)
  return chains && new ResolvedConfig(chains, cache)
}

export function prepareCache (): Cache {
  return {
    dependencyHashes: new Map(),
    fileExistence: new Map(),
    files: new Map(),
    pluginsAndPresets: new Map(),
    sourceHashes: new Map()
  }
}

export function restoreVerifier (buffer: Buffer): Verifier {
  return Verifier.fromBuffer(buffer)
}
