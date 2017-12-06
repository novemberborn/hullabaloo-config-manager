import path = require('path')

import json5 = require('json5')

import BabelOptions, {ReducedOptions} from './BabelOptions'
import Cache from './Cache'
import {ExtendsError, InvalidFileError, MultipleSourcesError, NoSourceFileError, ParseError} from './errors'
import readSafe from './readSafe'

function makeValid (source: string, options: any): BabelOptions {
  // Arrays are never valid options.
  if (Array.isArray(options)) throw new InvalidFileError(source)

  // Force options to be an object. Babel itself ignores falsy values when
  // resolving config chains. Here such files still need to be included
  // for cache busting purposes.
  if (!options || typeof options !== 'object') return {}

  return options
}

function parseFile (source: string, buffer: Buffer): BabelOptions {
  let options
  try {
    options = json5.parse(buffer.toString('utf8'))
  } catch (err) {
    throw new ParseError(source, err)
  }

  return makeValid(source, options)
}

function parsePackage (source: string, buffer: Buffer): BabelOptions | null {
  let options
  try {
    const pkg = JSON.parse(buffer.toString('utf8'))
    if (!pkg || typeof pkg !== 'object' || !has(pkg, 'babel')) return null

    options = pkg.babel
  } catch (err) {
    throw new ParseError(source, err)
  }

  return makeValid(source, options)
}

export class Config {
  public readonly dir: string
  public readonly env: string | null
  public readonly hash: string | null
  public readonly json5: boolean
  public readonly options: BabelOptions
  public readonly source: string

  public babelrcPointer: number | null
  public extends: Config | null
  public extendsPointer: number | null
  public readonly envPointers: Map<string, number>

  public constructor (
    dir: string,
    env: string | null,
    hash: string | null,
    json5: boolean,
    options: BabelOptions,
    source: string
  ) {
    this.dir = dir
    this.env = env
    this.hash = hash
    this.json5 = json5
    this.options = options
    this.source = source

    this.babelrcPointer = null
    this.envPointers = new Map()
    this.extends = null
    this.extendsPointer = null
  }

  public copyWithEnv (env: string, options: BabelOptions): Config {
    return new Config(this.dir, env, this.hash, this.json5, options, this.source)
  }

  public extend (config: Config): void {
    const clause = this.takeExtends()
    if (clause) {
      throw new TypeError(`Cannot extend config: there is an extends clause in the current options: ${clause}`)
    }
    if (this.extends) {
      throw new Error('Cannot extend config: already extended')
    }

    this.extends = config
  }

  public takeEnvs (): Map<string, ReducedOptions> {
    const env = this.options.env
    delete this.options.env

    if (!env) return new Map()

    const take = Object.keys(env).map<[string, ReducedOptions]>(name => [name, env[name]])
    return new Map(take)
  }

  public takeExtends (): string | undefined {
    const clause = this.options.extends
    delete this.options.extends
    return clause
  }
}

async function resolveDirectory (dir: string, cache?: Cache): Promise<Config | null> {
  const fileSource = path.join(dir, '.babelrc')
  const packageSource = path.join(dir, 'package.json')

  type Options = BabelOptions | null
  interface Result {
    json5: boolean
    source: string
    parse(): Options
  }

  // Attempt to read file and package concurrently. Neither may exist, and
  // that's OK.
  const fromFile = readSafe(fileSource, cache).then<Result | null>(contents => contents && {
    json5: true,
    parse () { return parseFile(fileSource, contents) },
    source: fileSource
  })

  const fromPackage = readSafe(packageSource, cache).then<Result | null>(contents => contents && {
    json5: false,
    parse () { return parsePackage(packageSource, contents) },
    source: packageSource
  })

  let result = await fromFile
  let options: Options = null
  if (result) {
    const packageResult = await fromPackage
    if (packageResult && packageResult.parse() !== null) {
      throw new MultipleSourcesError(fileSource, packageSource)
    }

    options = result.parse()
  } else {
    result = await fromPackage
    if (result) {
      options = result.parse()
    }
  }

  return result && options && new Config(dir, null, null, result.json5, options, result.source)
}

async function resolveFile (source: string, cache?: Cache): Promise<Config> {
  const contents = await readSafe(source, cache)
  // The file *must* exist. Causes a proper error to be propagated to
  // where "extends" directives are resolved.
  if (!contents) throw new NoSourceFileError(source)

  return new Config(path.dirname(source), null, null, true, parseFile(source, contents), source)
}

export type Chain = Set<Config>

export class Chains {
  public readonly babelrcDir?: string
  public readonly defaultChain: Chain
  public readonly envChains: Map<string, Chain>

  public constructor (babelrcDir: string | undefined, defaultChain: Chain, envChains: Map<string, Chain>) {
    this.babelrcDir = babelrcDir
    this.defaultChain = defaultChain
    this.envChains = envChains
  }

  public * [Symbol.iterator] () {
    yield this.defaultChain
    for (const chain of this.envChains.values()) {
      yield chain
    }
  }
}

class Collector {
  public readonly cache?: Cache

  protected configs: Config[]
  protected envNames: Set<string>
  protected pointers: Map<string, number>

  public constructor (cache?: Cache) {
    this.cache = cache
    this.configs = []
    this.envNames = new Set()
    this.pointers = new Map()
  }

  public get initialConfig (): Config {
    return this.configs[0]
  }

  public async add (config: Config): Promise<number> {
    // Avoid adding duplicate configs. Note that configs that came from an
    // "env" directive share their source with their parent config.
    if (!config.env && this.pointers.has(config.source)) {
      return this.pointers.get(config.source)!
    }

    const pointer = this.configs.push(config) - 1
    // Make sure not to override the pointer to an environmental
    // config's parent.
    if (!config.env) this.pointers.set(config.source, pointer)

    const envs = config.takeEnvs()
    const extendsClause = config.takeExtends()

    // Collect promises so they can run concurrently and be awaited at the end
    // of this function.
    const waitFor = []

    if (config.extends) {
      const promise = this.add(config.extends).then(extendsPointer => {
        config.extendsPointer = extendsPointer
      })
      waitFor.push(promise)
    } else if (extendsClause) {
      const extendsSource = path.resolve(config.dir, extendsClause)

      if (this.pointers.has(extendsSource)) {
        // Point at existing config.
        config.extendsPointer = this.pointers.get(extendsSource)!
      } else {
        // Different configs may concurrently resolve the same extends source.
        // While only one such resolution is added to the config list, this
        // does lead to extra file I/O and parsing. Optimizing this is not
        // currently considered worthwhile.
        const promise = resolveFile(extendsSource, this.cache).then(async parentConfig => {
          config.extendsPointer = await this.add(parentConfig)
        }).catch(err => {
          if (err.name === 'NoSourceFileError') {
            throw new ExtendsError(config.source, extendsClause, err)
          }

          throw err
        })

        waitFor.push(promise)
      }
    }

    for (const pair of envs) {
      const name = pair[0]
      const options = pair[1]

      this.envNames.add(name)
      const promise = this.add(config.copyWithEnv(name, options)).then(envPointer => {
        config.envPointers.set(name, envPointer)
      })
      waitFor.push(promise)
    }

    await Promise.all(waitFor)
    return pointer
  }

  public resolveChains (babelrcDir?: string): Chains | null {
    if (this.configs.length === 0) return null

    // Resolves a config chain, correctly ordering parent configs and recursing
    // through environmental configs, while avoiding cycles and repetitions.
    const resolveChain = (from: Iterable<Config>, envName?: string): Chain => {
      const chain: Chain = new Set()
      const knownParents: Chain = new Set()

      const addWithEnv = (config: Config) => {
        // Avoid unnecessary work in case the `from` list contains configs that
        // have already been added through an environmental config's parent.
        if (chain.has(config)) return
        chain.add(config)

        if (config.envPointers.has(envName!)) {
          const pointer = config.envPointers.get(envName!)!
          const envConfig = this.configs[pointer]
          addAfterParents(envConfig)
        }
      }

      const addAfterParents = (config: Config) => {
        // Avoid cycles by ignoring those parents that are already being added.
        if (knownParents.has(config)) return
        knownParents.add(config)

        if (config.babelrcPointer !== null) {
          const parent = this.configs[config.babelrcPointer]
          addAfterParents(parent)
        }
        if (config.extendsPointer !== null) {
          const parent = this.configs[config.extendsPointer]
          addAfterParents(parent)
        }

        if (envName) {
          addWithEnv(config)
        } else {
          chain.add(config)
        }
      }

      for (const config of from) {
        if (envName) {
          addWithEnv(config)
        } else {
          addAfterParents(config)
        }
      }

      return chain
    }

    // Start with the first config. This is either the base config provided
    // to fromConfig(), or the config derived from .babelrc / package.json
    // found in fromDirectory().
    const defaultChain = resolveChain([this.initialConfig])

    // For each environment, augment the default chain with environmental
    // configs.
    const envChains = new Map(Array.from(this.envNames, (name): [string, Chain] => {
      return [name, resolveChain(defaultChain, name)]
    }))

    return new Chains(babelrcDir, defaultChain, envChains)
  }
}

export async function fromConfig (baseConfig: Config, cache?: Cache): Promise<Chains> {
  let babelrcConfig: Config | null = null
  for (let config: Config | null = baseConfig; config; config = config.extends) {
    if (config.options.babelrc === false) continue

    if (babelrcConfig) {
      throw new TypeError(`${config.source}: Cannot resolve babelrc option, already resolved by ${babelrcConfig.source}`)
    }

    babelrcConfig = config
  }

  const collector = new Collector(cache)
  await Promise.all<any>([
    collector.add(baseConfig),
    // Resolve the directory concurrently. Assumes that in the common case,
    // the babelrcConfig doesn't extend from a .babelrc file while also leaving
    // the babelrc option enabled. Worst case the resolved config is discarded
    // as a duplicate.
    babelrcConfig && resolveDirectory(babelrcConfig.dir, cache).then(async parentConfig => {
      if (parentConfig) {
        babelrcConfig!.babelrcPointer = await collector.add(parentConfig)
      }
    })
  ])
  return babelrcConfig ? collector.resolveChains(babelrcConfig.dir)! : collector.resolveChains()!
}

export function fromDirectory (dir: string, cache?: Cache): Promise<Chains | null> {
  dir = path.resolve(dir)

  const collector = new Collector(cache)
  return resolveDirectory(dir, cache)
    .then<any>(config => config && collector.add(config))
    .then(() => collector.resolveChains(dir))
}
