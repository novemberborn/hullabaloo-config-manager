import path = require('path')

import json5 = require('json5')
import md5Hex = require('md5-hex')
import resolveFrom = require('resolve-from')

import BabelOptions, {LimitedOptions} from './BabelOptions'
import Cache, {isUnrestrictedModuleSource, EnvModuleSource, ModuleSource, UnrestrictedModuleSource} from './Cache'
import cloneOptions from './cloneOptions'
import currentEnv from './currentEnv'
import {ExtendsError, InvalidFileError, MultipleSourcesError, NoSourceFileError, ParseError} from './errors'
import loadConfigModule, {LoadedConfigModule} from './loadConfigModule'
import SimulatedBabelCache from './SimulatedBabelCache'
import readSafe from './readSafe'

export const enum FileType {
  JS = 'JS',
  JSON = 'JSON',
  JSON5 = 'JSON5'
}

function has (obj: object, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function validateOptions (source: string, options: any): BabelOptions {
  if (!options) throw new InvalidFileError(source, 'Options must be an object')
  if (typeof options !== 'object') throw new InvalidFileError(source, 'Options must be an object')
  if (Array.isArray(options)) throw new InvalidFileError(source, 'Options must be an object and not an array')

  // See https://github.com/babel/babel/blob/509dbb7302ee15d0243118afc09dde56b2987c38/packages/babel-core/src/config/options.js#L251:L255
  if (has(options, 'sourceMap') && has(options, 'sourceMaps')) {
    throw new InvalidFileError(source, '.sourceMap is an alias for .sourceMaps, cannot use both')
  }

  // See https://github.com/babel/babel/blob/509dbb7302ee15d0243118afc09dde56b2987c38/packages/babel-core/src/config/options.js#L19:L36
  if (has(options, 'cwd')) throw new InvalidFileError(source, '.cwd cannot be used here')
  if (has(options, 'filename')) throw new InvalidFileError(source, '.filename cannot be used here')
  if (has(options, 'filenameRelative')) throw new InvalidFileError(source, '.filenameRelative cannot be used here')
  if (has(options, 'babelrc')) throw new InvalidFileError(source, '.babelrc cannot be used here')
  if (has(options, 'code')) throw new InvalidFileError(source, '.code cannot be used here')
  if (has(options, 'ast')) throw new InvalidFileError(source, '.ast cannot be used here')
  if (has(options, 'envName')) throw new InvalidFileError(source, '.envName cannot be used here')

  if (has(options, 'env')) {
    for (const envName in options.env) {
      // See https://github.com/babel/babel/blob/509dbb7302ee15d0243118afc09dde56b2987c38/packages/babel-core/src/config/options.js#L216:L218
      if (has(options.env[envName], 'env')) {
        throw new InvalidFileError(source, '.env is not allowed inside another env block')
      }
      // See https://github.com/babel/babel/blob/2d05487293278286e352d7acc0761751025b4b1a/packages/babel-core/src/config/validation/options.js#L246:L257
      if (has(options.env[envName], 'overrides')) {
        throw new InvalidFileError(source, '.overrides is not allowed inside an env block')
      }
    }
  }

  if (has(options, 'overrides')) {
    // See https://github.com/babel/babel/blob/2d05487293278286e352d7acc0761751025b4b1a/packages/babel-core/src/config/validation/options.js#L304
    if (options.overrides !== null && options.overrides !== undefined && !Array.isArray(options.overrides)) {
      throw new InvalidFileError(source, '.overrides must be an array')
    }
    for (const override of options.overrides) {
      // See https://github.com/babel/babel/blob/2d05487293278286e352d7acc0761751025b4b1a/packages/babel-core/src/config/config-chain.js#L257:L258
      if (!override) throw new InvalidFileError(source, `.overrides must only contain objects`)
      // See https://github.com/babel/babel/blob/2d05487293278286e352d7acc0761751025b4b1a/packages/babel-core/src/config/validation/options.js#L249:L250
      if (has(override, 'overrides')) throw new InvalidFileError(source, '.override is not allowed inside an overrides block')
    }
  }

  return options
}

function parseFile (source: string, buffer: Buffer): BabelOptions {
  let options
  try {
    options = json5.parse(buffer.toString('utf8'))
  } catch (err) {
    throw new ParseError(source, err)
  }

  return validateOptions(source, options)
}

function parsePackage (source: string, buffer: Buffer): BabelOptions | null {
  let options
  try {
    const pkg = JSON.parse(buffer.toString('utf8'))
    // Babel assumes `pkg` is not `undefined` or `null`, and crashes otherwise.
    // This logic is slightly more forgiving but that shouldn't make a read
    // difference.
    if (!pkg || typeof pkg !== 'object' || !has(pkg, 'babel') || !pkg.babel) return null

    options = pkg.babel
  } catch (err) {
    throw new ParseError(source, err)
  }

  return validateOptions(source, options)
}

function cloneCachedModule<T extends (ModuleSource | UnrestrictedModuleSource)> (obj: T): T {
  return Object.assign({}, obj, {runtimeDependencies: new Map(obj.runtimeDependencies), options: cloneOptions(obj.options)})
}

interface ResolvedModule extends ModuleSource {
  unrestricted: boolean
  factory? (envName: string): ModuleSource
}
function resolveModule (source: string, envName: string, cache?: Cache): ResolvedModule | null {
  if (cache && cache.moduleSources.has(source)) {
    const cached = cache.moduleSources.get(source)!
    if (isUnrestrictedModuleSource(cached)) return cloneCachedModule(cached)
    if (cached.byEnv.has(envName)) return {...cloneCachedModule(cached.byEnv.get(envName)!), factory: cached.factory}

    const result = cached.factory!(envName)
    cached.byEnv.set(envName, cloneCachedModule(result))
    return {...result, factory: cached.factory}
  }

  if (resolveFrom.silent(path.dirname(source), source) === null) return null

  let configModule: LoadedConfigModule
  try {
    configModule = loadConfigModule(source)
  } catch (err) {
    throw new ParseError(source, err)
  }

  const dependencies = configModule.dependencies
  const options = configModule.options
  if (typeof options !== 'function') {
    if (options && typeof options.then === 'function') {
      throw new InvalidFileError(source, 'Asynchronous configuration modules are not supported')
    }

    const validOptions = validateOptions(source, options)
    const result: UnrestrictedModuleSource = {
      options: validOptions,
      runtimeDependencies: dependencies,
      runtimeHash: null,
      unrestricted: true
    }
    if (cache) cache.moduleSources.set(source, cloneCachedModule(result))
    return cloneCachedModule(result)
  }

  const staticDependencies = Array.from(dependencies)
  dependencies.clear()

  const factory = (envName: string) => { // eslint-disable-line no-shadow
    let unrestricted = true
    const babelCache = new SimulatedBabelCache<{envName: string}>({envName})

    let factoryDependencies: Array<[string, string]>
    let possibleOptions: any = null
    try {
      dependencies.clear()
      possibleOptions = options({
        cache: babelCache.api,
        env: () => {
          unrestricted = false
          return babelCache.api.using(data => data.envName)
        },
        async () {
          /* istanbul ignore next */
          return false
        }
      })
    } catch (err) {
      throw new ParseError(source, err)
    } finally {
      factoryDependencies = Array.from(dependencies)
      dependencies.clear()
    }
    babelCache.seal()

    if (!babelCache.wasConfigured) throw new InvalidFileError(source, 'Caching must be configured')
    if (possibleOptions && typeof possibleOptions.then === 'function') {
      throw new InvalidFileError(source, 'Asynchronous configuration modules are not supported')
    }

    return {
      options: validateOptions(source, possibleOptions),
      runtimeDependencies: new Map(staticDependencies.concat(factoryDependencies)),
      runtimeHash: babelCache.hash(),
      unrestricted: unrestricted && !babelCache.never
    }
  }

  const result = factory(envName)
  if (cache) {
    if (result.unrestricted) cache.moduleSources.set(source, cloneCachedModule(result) as UnrestrictedModuleSource)
    else cache.moduleSources.set(source, {byEnv: new Map([[envName, cloneCachedModule(result)]]), factory})
  }
  return {...cloneCachedModule(result), factory}
}

export class Config {
  public readonly dir: string
  public readonly envName: string | null
  public readonly fileType: FileType
  public readonly hash: string | null
  public readonly options: BabelOptions
  public readonly runtimeDependencies: Map<string, string> | null
  public readonly runtimeHash: string | null
  public readonly source: string

  public babelrcPointer: number | null
  public extends: Config | null
  public extendsPointer: number | null
  public readonly envPointers: Map<string, number>
  public readonly overridePointers: number[]

  public constructor (
    dir: string,
    envName: string | null,
    hash: string | null,
    options: BabelOptions,
    source: string,
    fileType: FileType,
    runtimeDependencies: Map<string, string> | null,
    runtimeHash: string | null
  ) {
    this.dir = dir
    this.envName = envName
    this.fileType = fileType
    this.hash = hash
    this.options = options
    this.runtimeDependencies = runtimeDependencies
    this.runtimeHash = typeof runtimeHash === 'string' ? runtimeHash : null
    this.source = source

    this.babelrcPointer = null
    this.envPointers = new Map()
    this.extends = null
    this.extendsPointer = null
    this.overridePointers = []
  }

  public copyAsOverride (index: number, options: BabelOptions): OverrideConfig {
    return new OverrideConfig(index, this.dir, this.envName, this.hash, options, this.source, this.fileType, null, null)
  }

  public copyWithEnv (
    envName: string,
    options: BabelOptions,
    runtimeDependencies: Map<string, string> | null,
    runtimeHash: string | null
  ): Config {
    return new Config(this.dir, envName, this.hash, options, this.source, this.fileType, runtimeDependencies, runtimeHash)
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

  public takeEnvs (): Map<string, LimitedOptions> {
    const env = this.options.env
    delete this.options.env

    if (!env) return new Map()

    const take = Object.keys(env).map<[string, LimitedOptions]>(name => [name, env[name]])
    return new Map(take)
  }

  public takeExtends (): string | undefined {
    const clause = this.options.extends
    delete this.options.extends
    return clause
  }

  public takeOverrides (): Array<BabelOptions> {
    const overrides = this.options.overrides
    delete this.options.overrides

    return Array.isArray(overrides) ? overrides : []
  }
}

class FactoryConfig extends Config {
  public readonly factory: (envName: string) => ModuleSource

  public constructor ( // eslint-disable-line typescript/member-ordering
    dir: string,
    source: string,
    factory: (envName: string) => ModuleSource
  ) {
    super(dir, null, null, {}, source, FileType.JS, null, null)
    this.factory = factory
  }

  public copyRestricted (
    options: BabelOptions,
    runtimeDependencies: Map<string, string> | null,
    runtimeHash: string | null
  ): RestrictedConfig {
    return new RestrictedConfig(
      this.dir,
      this.envName,
      this.hash,
      options,
      this.source,
      this.fileType,
      runtimeDependencies,
      runtimeHash
    )
  }
}

export class OverrideConfig extends Config {
  public readonly index: number

  public constructor (
    index: number,
    dir: string,
    envName: string | null,
    hash: string | null,
    options: BabelOptions,
    source: string,
    fileType: FileType,
    runtimeDependencies: Map<string, string> | null,
    runtimeHash: string | null
  ) {
    super(dir, envName, hash, options, source, fileType, null, null)
    this.index = index
  }

  public copyWithEnv (
    envName: string,
    options: BabelOptions,
    runtimeDependencies: Map<string, string> | null,
    runtimeHash: string | null
  ): OverrideConfig {
    const test = this.options.test
    const include = this.options.include
    const exclude = this.options.exclude
    return new OverrideConfig(
      this.index,
      this.dir,
      envName,
      this.hash,
      {test, include, exclude, ...options},
      this.source,
      this.fileType,
      runtimeDependencies,
      runtimeHash
    )
  }
}

export class VirtualConfig extends Config {}

export class RestrictedConfig extends Config {}
async function resolveDirectory (dir: string, expectedEnvNames: string[], cache?: Cache): Promise<Config | null> {
  const fileSource = path.resolve(dir, '.babelrc')
  const jsSource = path.resolve(dir, '.babelrc.js')
  const packageSource = path.resolve(dir, 'package.json')

  // Attempt to read file and package concurrently. Neither may exist, and
  // that's OK.
  const fromFile = readSafe(fileSource, cache)
  const fromPackage = readSafe(packageSource, cache)

  // Also try to resolve the .babelrc.js file.
  const envName = expectedEnvNames.length > 0
    ? expectedEnvNames[0]
    : currentEnv()
  const jsOptions = resolveModule(jsSource, envName, cache)

  const fileContents = await fromFile
  if (fileContents) {
    const packageContents = await fromPackage
    if (packageContents && parsePackage(packageSource, packageContents) !== null) {
      throw new MultipleSourcesError(fileSource, packageSource)
    }
    if (jsOptions) {
      throw new MultipleSourcesError(fileSource, jsSource)
    }

    return new Config(dir, null, null, parseFile(fileSource, fileContents), fileSource, FileType.JSON5, null, null)
  }

  const packageContents = await fromPackage
  if (packageContents) {
    const options = parsePackage(packageSource, packageContents)
    if (options) {
      if (jsOptions) throw new MultipleSourcesError(jsSource, packageSource)
      return new Config(dir, null, null, options, packageSource, FileType.JSON, null, null)
    }
  }

  if (jsOptions) {
    if (jsOptions.unrestricted) {
      return new Config(
        dir,
        null,
        null,
        jsOptions.options,
        jsSource,
        FileType.JS,
        jsOptions.runtimeDependencies,
        jsOptions.runtimeHash
      )
    } else if (expectedEnvNames.length === 0) {
      return new Config(
        dir,
        envName,
        null,
        jsOptions.options,
        jsSource,
        FileType.JS,
        jsOptions.runtimeDependencies,
        jsOptions.runtimeHash
      )
    } else {
      return new FactoryConfig(dir, jsSource, jsOptions.factory!)
    }
  }

  return null
}

async function resolveFile (source: string, expectedEnvNames: string[], cache?: Cache): Promise<Config> {
  const dir = path.dirname(source)
  if (path.extname(source) === '.js') {
    const envName = expectedEnvNames.length > 0
      ? expectedEnvNames[0]
      : currentEnv()
    const jsOptions = resolveModule(source, envName, cache)
    // The file *must* exist. `resolveModule()` returns `null` when it doesn't.
    // Causes a proper error to be propagated to where "extends" directives are
    // resolved.
    if (!jsOptions) throw new NoSourceFileError(source)

    if (jsOptions.unrestricted) {
      return new Config(
        dir,
        null,
        null,
        jsOptions.options,
        source,
        FileType.JS,
        jsOptions.runtimeDependencies,
        jsOptions.runtimeHash
      )
    } else if (expectedEnvNames.length === 0) {
      return new Config(
        dir,
        envName,
        null,
        jsOptions.options,
        source,
        FileType.JS,
        jsOptions.runtimeDependencies,
        jsOptions.runtimeHash
      )
    } else {
      return new FactoryConfig(dir, source, jsOptions.factory!)
    }
  }

  const contents = await readSafe(source, cache)
  // The file *must* exist. Causes a proper error to be propagated to where
  // "extends" directives are resolved.
  if (!contents) throw new NoSourceFileError(source)

  return new Config(path.dirname(source), null, null, parseFile(source, contents), source, FileType.JSON5, null, null)
}

export type Chain = Set<Config> & {
  overrides: Chain[]
}

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

// Configs that came from an env-restricted factory, or "env" or "overrides"
// directives share their source with their parent config, and thus cannot reuse
// the pointer.
function reusePointer (config: Config): boolean {
  return !config.envName && !(config instanceof OverrideConfig) && !(config instanceof RestrictedConfig)
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

  public async add (config: Config, expectedEnvNames: string[]): Promise<number> {
    // Avoid adding duplicate configs.
    if (reusePointer(config) && this.pointers.has(config.source)) {
      return this.pointers.get(config.source)!
    }

    const pointer = this.configs.push(config) - 1
    // Make sure not to override the pointer to an environmental or override
    // config's parent.
    if (reusePointer(config)) {
      this.pointers.set(config.source, pointer)
    }

    if (this.cache && config instanceof VirtualConfig && config.fileType === FileType.JS) {
      this.cache.moduleSources.set(config.source, {
        options: cloneOptions(config.options),
        runtimeDependencies: new Map(),
        runtimeHash: null,
        unrestricted: true
      })
    }

    // Collect promises so they can run concurrently and be awaited at the end
    // of this function.
    const waitFor: Promise<void>[] = []

    if (config instanceof FactoryConfig) {
      for (const envName of expectedEnvNames) {
        this.envNames.add(envName)

        let options: BabelOptions
        let runtimeDependencies: Map<string, string> | null = null
        let runtimeHash: string | null = null
        if (this.cache && this.cache.moduleSources.has(config.source)) {
          // `config` shouldn't be a `FactoryConfig` unless its cached source
          // is an `EnvModuleSource`.
          const cached = this.cache.moduleSources.get(config.source)! as EnvModuleSource
          if (cached.byEnv.has(envName)) {
            options = cloneOptions(cached.byEnv.get(envName)!.options)
          } else {
            const result = config.factory(envName)
            cached.byEnv.set(envName, result)
            options = cloneOptions(result.options)
            runtimeDependencies = result.runtimeDependencies
            runtimeHash = result.runtimeHash
          }
        } else {
          const result = config.factory(envName)
          options = result.options
          runtimeDependencies = result.runtimeDependencies
          runtimeHash = result.runtimeHash
        }

        const promise = this.add(config.copyRestricted(options, runtimeDependencies, runtimeHash), [envName])
          .then(envPointer => {
            config.envPointers.set(envName, envPointer)
          })
        waitFor.push(promise)
      }
    } else {
      const envs = config.takeEnvs()
      const extendsClause = config.takeExtends()
      const overrides = config.takeOverrides()

      if (config.extends) {
        const promise = this.add(config.extends, expectedEnvNames).then(extendsPointer => {
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
          const promise = resolveFile(extendsSource, expectedEnvNames, this.cache).then(async parentConfig => {
            config.extendsPointer = await this.add(parentConfig, expectedEnvNames)
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
        const envName = pair[0]
        const options = pair[1]

        this.envNames.add(envName)
        const promise = this.add(config.copyWithEnv(envName, options, null, null), [envName]).then(envPointer => {
          config.envPointers.set(envName, envPointer)
        })
        waitFor.push(promise)
      }

      overrides.forEach((options, index) => {
        const promise = this.add(config.copyAsOverride(index, options), expectedEnvNames).then(overridePointer => {
          config.overridePointers.push(overridePointer)
        })
        waitFor.push(promise)
      })
    }

    await Promise.all(waitFor)
    return pointer
  }

  public resolveChains (babelrcDir?: string): Chains | null {
    if (this.configs.length === 0) return null

    // Resolves a config chain, correctly ordering parent configs and recursing
    // through environmental configs, while avoiding cycles and repetitions.
    const resolveChain = (from: Iterable<Config>, envName?: string): Chain => {
      const chain: Chain = Object.assign(new Set(), {overrides: []})
      const knownParents: Set<Config> = new Set()

      const addOverrides = (config: Config) => {
        for (const pointer of config.overridePointers) {
          const overrideConfig = this.configs[pointer]
          const defaultChain = resolveChain([overrideConfig])
          if (typeof envName === 'string') {
            chain.overrides.push(resolveChain(defaultChain, envName))
          } else {
            chain.overrides.push(defaultChain)
          }
        }
      }

      const addWithEnv = (config: Config) => {
        // Avoid unnecessary work in case the `from` list contains configs that
        // have already been added through an environmental config's parent.
        if (chain.has(config)) return
        chain.add(config)
        addOverrides(config)

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
          addOverrides(config)
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

    const deleteFactoryConfigs = (chain: Chain): Chain => {
      for (const config of chain) {
        if (config instanceof FactoryConfig) chain.delete(config)
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
      return [name, deleteFactoryConfigs(resolveChain(defaultChain, name))]
    }))

    return new Chains(babelrcDir, deleteFactoryConfigs(defaultChain), envChains)
  }
}

export async function fromConfig (baseConfig: Config, expectedEnvNames?: string[], cache?: Cache): Promise<Chains> {
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
    collector.add(baseConfig, expectedEnvNames || []),
    // Resolve the directory concurrently. Assumes that in the common case,
    // the babelrcConfig doesn't extend from a .babelrc file while also leaving
    // the babelrc option enabled. Worst case the resolved config is discarded
    // as a duplicate.
    babelrcConfig && resolveDirectory(babelrcConfig.dir, expectedEnvNames || [], cache).then(async parentConfig => {
      if (parentConfig) {
        babelrcConfig!.babelrcPointer = await collector.add(parentConfig, expectedEnvNames || [])
      }
    })
  ])
  return babelrcConfig ? collector.resolveChains(babelrcConfig.dir)! : collector.resolveChains()!
}

export function fromDirectory (dir: string, expectedEnvNames?: string[], cache?: Cache): Promise<Chains | null> {
  dir = path.resolve(dir)

  const collector = new Collector(cache)
  return resolveDirectory(dir, expectedEnvNames || [], cache)
    .then<any>(config => config && collector.add(config, expectedEnvNames || []))
    .then(() => collector.resolveChains(dir))
}
