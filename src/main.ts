import path = require('path')

import BabelOptions from './BabelOptions'
import Cache, {prepare as prepareCache} from './Cache'
import cloneOptions from './cloneOptions'
import * as collector from './collector'
import currentEnv from './currentEnv'
import ResolvedConfig from './ResolvedConfig'
import Verifier from './Verifier'

export {currentEnv, prepareCache}

export interface CreateOptions {
  options: BabelOptions
  source: string
  dir?: string
  hash?: string
  fileType?: collector.FileType.JSON | collector.FileType.JSON5
}

export interface FromOptions {
  cache?: Cache
  expectedEnvNames?: string[]
}

export function createConfig (options: CreateOptions): collector.VirtualConfig {
  if (!options || !options.options || !options.source) {
    throw new TypeError("Expected 'options' and 'source' options")
  }
  if (typeof options.options !== 'object' || Array.isArray(options.options)) {
    throw new TypeError("'options' must be an actual object")
  }

  const source = options.source
  const dir = options.dir || path.dirname(source)
  const hash = typeof options.hash === 'string' ? options.hash : null
  const fileType = typeof options.fileType === 'string' ? options.fileType : collector.FileType.JSON5
  const babelOptions = cloneOptions(options.options)

  if (Object.prototype.hasOwnProperty.call(babelOptions, 'envName')) {
    throw new TypeError("'options' must not have an 'envName' property")
  }

  return new collector.VirtualConfig(dir, null, hash, babelOptions, source, fileType, null, null)
}

export async function fromConfig (baseConfig: collector.Config, options?: FromOptions): Promise<ResolvedConfig> {
  const cache = options && options.cache
  const expectedEnvNames = options && options.expectedEnvNames
  const chains = await collector.fromConfig(baseConfig, expectedEnvNames, cache)
  return new ResolvedConfig(chains, cache)
}

export async function fromDirectory (dir: string, options?: FromOptions): Promise<ResolvedConfig | null> {
  const cache = options && options.cache
  const expectedEnvNames = options && options.expectedEnvNames
  const chains = await collector.fromDirectory(dir, expectedEnvNames, cache)
  return chains && new ResolvedConfig(chains, cache)
}

export function restoreVerifier (buffer: Buffer): Verifier {
  return Verifier.fromBuffer(buffer)
}
