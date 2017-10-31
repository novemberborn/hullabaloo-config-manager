import fs = require('fs')
import path = require('path')

import isEqual = require('lodash.isequal')
import md5Hex = require('md5-hex')
import _safeBuffer = require('safe-buffer')

import Cache from './Cache'
import currentEnv from './currentEnv'
import hashDependencies from './hashDependencies'
import hashSources from './hashSources'
import {Dependency, Source} from './reduceChains'

const SafeBuffer = _safeBuffer.Buffer

function ensureMissingBabelrcFile (file: string, cache?: Cache): Promise<boolean> {
  if (cache && cache.fileExistence && cache.fileExistence.has(file)) {
    return cache.fileExistence.get(file)!
  }

  const promise = new Promise<boolean>((resolve, reject) => {
    fs.access(file, err => {
      if (err) {
        if (err.code !== 'ENOENT') {
          reject(err)
        } else {
          resolve(true)
        }
      } else {
        resolve(false)
      }
    })
  })

  if (cache && cache.fileExistence) {
    cache.fileExistence.set(file, promise)
  }
  return promise
}

export type VerificationResult = {sourcesChanged: true} | {missingSource: true} | {badDependency: true} | {
  sourcesChanged: false
  dependenciesChanged: boolean
  cacheKeys: {
    dependencies: string
    sources: string
  }
  verifier: Verifier // eslint-disable-line typescript/no-use-before-define
}

export default class Verifier {
  public readonly babelrcDir?: string
  public readonly dependencies: Dependency[]
  public readonly envNames: Set<string>
  public readonly sources: Source[]

  private constructor (babelrcDir: string | undefined, envNames: Set<string>, dependencies: Dependency[], sources: Source[]) {
    this.babelrcDir = babelrcDir
    this.envNames = envNames
    this.dependencies = dependencies
    this.sources = sources
  }

  public static fromBuffer (buffer: Buffer): Verifier {
    const json = JSON.parse(buffer.toString('utf8'), (key, value) => {
      return key === 'envNames' || key === 'envs'
        ? new Set(value)
        : value
    })
    return new Verifier(json.babelrcDir, json.envNames, json.dependencies, json.sources)
  }

  public static async hashAndCreate (
    babelrcDir: string | undefined,
    envNames: Set<string>,
    dependencies: Dependency[],
    sources: Source[],
    fixedSourceHashes: Map<string, string>,
    cache?: Cache
  ): Promise<Verifier> {
    const results = await Promise.all([
      hashDependencies(dependencies, cache),
      hashSources(sources, fixedSourceHashes, cache)
    ])

    const dependencyHashes = results[0]
    dependencies.forEach((item, index) => {
      item.hash = dependencyHashes[index]
    })

    const sourceHashes = results[1]
    sources.forEach((item, index) => {
      item.hash = sourceHashes[index]
    })

    return new Verifier(babelrcDir, envNames, dependencies, sources)
  }

  public cacheKeysForCurrentEnv (): {dependencies: string; sources: string} { // eslint-disable-line typescript/member-delimiter-style
    const envName = currentEnv()

    const dependencyHashes = this.selectByEnv(this.dependencies, envName).map(item => item.hash!)
    const sourceHashes = this.selectByEnv(this.sources, envName).map(item => item.hash!)

    return {
      dependencies: md5Hex(dependencyHashes),
      sources: md5Hex(sourceHashes)
    }
  }

  public async verifyCurrentEnv (fixedHashes?: {sources?: Map<string, string>}, cache?: Cache): Promise<VerificationResult> {
    const envName = currentEnv()

    const sourcesToHash = this.selectByEnv(this.sources, envName)
    const expectedSourceHashes = sourcesToHash.map(item => item.hash)
    const pendingSourceHashes = hashSources(sourcesToHash, fixedHashes && fixedHashes.sources, cache)

    let checkedBabelrcFile: true | Promise<boolean> = true
    if (this.babelrcDir) {
      const babelrcFile = path.join(this.babelrcDir, '.babelrc')
      if (!sourcesToHash.some(item => item.source === babelrcFile)) {
        checkedBabelrcFile = ensureMissingBabelrcFile(babelrcFile, cache)
      }
    }

    const dependenciesToHash = this.selectByEnv(this.dependencies, envName)
    const expectedDependencyHashes = dependenciesToHash.map(item => item.hash)
    const pendingDependencyHashes = hashDependencies(dependenciesToHash, cache)

    try {
      const results = await Promise.all([
        pendingSourceHashes,
        checkedBabelrcFile
      ])
      const sourceHashes = results[0]
      const babelrcFileIsSame = results[1]

      if (!babelrcFileIsSame || !isEqual(sourceHashes, expectedSourceHashes)) {
        return {sourcesChanged: true}
      }

      const dependencyHashes = await pendingDependencyHashes
      const dependenciesChanged = !isEqual(dependencyHashes, expectedDependencyHashes)

      let verifier: Verifier = this
      if (dependenciesChanged) {
        const dependencies = this.dependencies.map((item, index) => {
          const hash = dependencyHashes[index]
          return {...item, hash}
        })

        verifier = new Verifier(this.babelrcDir, this.envNames, dependencies, this.sources)
      }

      return {
        sourcesChanged: false,
        dependenciesChanged,
        cacheKeys: {
          dependencies: md5Hex(dependencyHashes),
          sources: md5Hex(sourceHashes)
        },
        verifier
      }
    } catch (err) {
      if (err.name === 'NoSourceFileError') {
        return {missingSource: true}
      }

      if (err.name === 'BadDependencyError') {
        return {badDependency: true}
      }

      throw err
    }
  }

  public toBuffer (): Buffer {
    return SafeBuffer.from(JSON.stringify({
      babelrcDir: this.babelrcDir,
      envNames: this.envNames,
      dependencies: this.dependencies,
      sources: this.sources
    }, (key, value) => {
      return key === 'envNames' || key === 'envs'
        ? Array.from(value)
        : value
    }, 2))
  }

  private selectByEnv<Item extends Dependency | Source> (arr: Item[], envName: string): Item[] {
    const selectDefault = !this.envNames.has(envName)
    return arr.filter(item => selectDefault ? item.default : item.envs.has(envName))
  }
}
