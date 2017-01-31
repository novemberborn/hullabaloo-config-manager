'use strict'

const path = require('path')

const ExtendableError = require('es6-error')
const gfs = require('graceful-fs')
const parseJson5 = require('json5').parse
const cloneDeep = require('lodash.clonedeep')

function readSafe (source, cache) {
  if (cache && cache.files && cache.files.has(source)) {
    return cache.files.get(source)
  }

  const promise = new Promise((resolve, reject) => {
    gfs.readFile(source, (err, contents) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(null)
        } else {
          reject(err)
        }
      } else {
        resolve(contents)
      }
    })
  })

  if (cache && cache.files) {
    cache.files.set(source, promise)
  }
  return promise
}

class SourceError extends ExtendableError {
  constructor (message, source, parent) {
    super(`${source}: ${message}`)
    this.source = source
    this.parent = parent || null
  }
}

class NoSourceFileError extends SourceError {
  constructor (source) {
    super('No such file', source)
  }
}

class ParseError extends SourceError {
  constructor (source, parent) {
    super(`Error while parsing — ${parent.message}`, source, parent)
  }
}

class InvalidFileError extends SourceError {
  constructor (source) {
    super('Not a proper configuration file', source)
  }
}

class ExtendsError extends SourceError {
  constructor (source, clause, parent) {
    super(`Couldn't resolve extends clause: ${clause}`, source, parent)
    this.clause = clause
  }
}

function makeValid (source, options) {
  // Arrays are never valid options.
  if (Array.isArray(options)) {
    throw new InvalidFileError(source)
  }

  // Force options to be an object. Babel itself ignores falsy values when
  // resolving config chains. Here such files still need to be included
  // for cache busting purposes. The usage of Object.assign() ensures its
  // at least an empty object.
  return Object.assign({}, options)
}

function parseFile (source, buffer) {
  let options
  try {
    options = parseJson5(buffer.toString('utf8'))
  } catch (err) {
    throw new ParseError(source, err)
  }

  return makeValid(source, options)
}

function parsePackage (source, buffer) {
  let options
  try {
    const pkg = JSON.parse(buffer.toString('utf8'))
    options = pkg && pkg.babel
  } catch (err) {
    throw new ParseError(source, err)
  }

  return makeValid(source, options)
}

class Config {
  constructor (source, json5, options, env) {
    this.env = env || null
    this.json5 = json5
    this.options = options
    this.source = source

    this.babelrcPointer = null
    this.envPointers = new Map()
    this.extendsPointer = null
  }

  copyWithEnv (env, options) {
    return new this.constructor(this.source, this.json5, options, env)
  }

  takeEnvs () {
    const env = this.options.env
    delete this.options.env

    return env
      ? new Map(
          Object.keys(env)
            .filter(Boolean)
            .map(name => [name, env[name]]))
      : new Map()
  }

  takeExtends () {
    const clause = this.options.extends
    delete this.options.extends
    return clause
  }

  get dir () {
    return path.dirname(this.source)
  }
}

function resolveDirectory (dir, cache) {
  const fileSource = path.join(dir, '.babelrc')
  const packageSource = path.join(dir, 'package.json')

  const fromFile = readSafe(fileSource, cache)
    .then(contents => contents && {
      json5: true,
      parse () { return parseFile(fileSource, contents) },
      source: fileSource
    })

  const fromPackage = readSafe(packageSource, cache)
    .then(contents => contents && {
      json5: false,
      parse () { return parsePackage(packageSource, contents) },
      source: packageSource
    })

  return fromFile
    .then(fileResult => fileResult || fromPackage)
    .then(result => {
      // .babelrc or package.json files may not exist, and that's OK.
      if (!result) return null

      return new Config(result.source, result.json5, result.parse())
    })
}

function resolveFile (source, cache) {
  return readSafe(source, cache)
    .then(contents => {
      // The file *must* exist. Causes a proper error to be propagated to
      // where "extends" directives are resolved.
      if (!contents) throw new NoSourceFileError(source)

      return new Config(source, true, parseFile(source, contents))
    })
}

class Chains {
  constructor (babelrcDir, withoutEnv, byEnv) {
    this.babelrcDir = babelrcDir
    this.withoutEnv = withoutEnv
    this.byEnv = byEnv
  }

  *[Symbol.iterator] () {
    yield this.withoutEnv
    for (const chain of this.byEnv.values()) {
      yield chain
    }
  }
}

class Collector {
  constructor (cache) {
    this.cache = cache
    this.configs = []
    this.envNames = new Set()
    this.pointers = new Map()
  }

  get initialConfig () {
    return this.configs[0]
  }

  add (config) {
    // Avoid adding duplicate configs. Note that configs that came from an
    // "env" directive share their source with their parent config.
    if (!config.env && this.pointers.has(config.source)) {
      return Promise.resolve(this.pointers.get(config.source))
    }

    const pointer = this.configs.push(config) - 1
    // Make sure not to override the pointer to an environmental
    // config's parent.
    if (!config.env) this.pointers.set(config.source, pointer)

    const envs = config.takeEnvs()
    const extendsClause = config.takeExtends()
    const waitFor = []

    if (extendsClause) {
      const extendsSource = path.resolve(config.dir, extendsClause)

      if (this.pointers.has(extendsSource)) {
        // Point at existing config.
        config.extendsPointer = this.pointers.get(extendsSource)
      } else {
        // Different configs may concurrently resolve the same extends source.
        // While only one such resolution is added to the config list, this
        // does lead to extra file I/O and parsing. Optimizing this is not
        // currently considered worthwhile.
        const promise = resolveFile(extendsSource, this.cache)
          .then(parentConfig => this.add(parentConfig))
          .then(extendsPointer => (config.extendsPointer = extendsPointer))
          .catch(err => {
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
      const promise = this.add(config.copyWithEnv(name, options))
        .then(envPointer => config.envPointers.set(name, envPointer))
      waitFor.push(promise)
    }

    return Promise.all(waitFor)
      .then(() => pointer)
  }

  resolveChains () {
    if (this.configs.length === 0) return null

    // Resolves a config chain, correctly ordering parent configs and recursing
    // through environmental configs, while avoiding cycles and repetitions.
    const resolveChain = (from, envName) => {
      const chain = new Set()
      const knownParents = new Set()

      /* eslint-disable no-use-before-define */
      const addWithEnv = config => {
        // Avoid unnecessary work in case the `from` list contains configs that
        // have already been added through an environmental config's parent.
        if (chain.has(config)) return
        chain.add(config)

        if (config.envPointers.has(envName)) {
          const pointer = config.envPointers.get(envName)
          const envConfig = this.configs[pointer]
          addAfterParents(envConfig)
        }
      }

      const addAfterParents = config => {
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
      /* eslint-enable no-use-before-define */

      for (const config of from) {
        if (envName) {
          addWithEnv(config)
        } else {
          addAfterParents(config)
        }
      }

      return chain
    }

    // Start with the first config. This is either the virtual config provided
    // to fromVirtual(), or the config derived from .babelrc / package.json
    // found in fromDirectory().
    const withoutEnv = resolveChain([this.initialConfig])

    // For each environment, augment the default chain with environmental
    // configs.
    const byEnv = new Map(Array.from(this.envNames, name => {
      return [name, resolveChain(withoutEnv, name)]
    }))

    return new Chains(this.initialConfig.dir, withoutEnv, byEnv)
  }
}

function fromDirectory (dir, cache) {
  const collector = new Collector(cache)
  return resolveDirectory(path.resolve(dir), cache)
    .then(config => config && collector.add(config))
    .then(() => collector.resolveChains())
}
exports.fromDirectory = fromDirectory

function fromVirtual (options, source, cache, json5) {
  const config = new Config(source, json5 !== false, cloneDeep(options))
  const collector = new Collector(cache)

  return Promise.all([
    collector.add(config),
    // Resolve the directory concurrently. Assumes that in the common case,
    // the config doesn't extend from a .babelrc file while also leaving the
    // babelrc option enabled. Worst case the resolved config is discarded as
    // a duplicate.
    options.babelrc !== false
      ? resolveDirectory(config.dir, cache)
        .then(parentConfig => {
          if (!parentConfig) return

          return collector.add(parentConfig)
            .then(babelrcPointer => (config.babelrcPointer = babelrcPointer))
        })
      : null
  ])
    .then(() => collector.resolveChains())
}
exports.fromVirtual = fromVirtual
