import packageHash = require('package-hash')
import md5Hex = require('md5-hex')

import Cache from './Cache'
import {BadDependencyError} from './errors'
import readSafe from './readSafe'
import {Dependency} from './reduceChains'

async function hashFile (filename: string, cache?: Cache): Promise<string> {
  const contents = await readSafe(filename, cache)
  if (!contents) throw new BadDependencyError(filename)

  return md5Hex(contents)
}

async function hashPackage (filename: string, fromPackage: string): Promise<string> {
  try {
    return await packageHash(`${fromPackage}/package.json`)
  } catch (err) {
    throw new BadDependencyError(filename, err)
  }
}

function hashDependency (filename: string, fromPackage: string | null, cache?: Cache): Promise<string> {
  if (cache && cache.dependencyHashes.has(filename)) {
    return cache.dependencyHashes.get(filename)!
  }

  const promise = fromPackage
    ? hashPackage(filename, fromPackage)
    : hashFile(filename, cache)

  if (cache) {
    cache.dependencyHashes.set(filename, promise)
  }
  return promise
}

export default function hashDependencies (dependencies: Dependency[], cache?: Cache): Promise<string[]> {
  const promises = dependencies.map(item => hashDependency(item.filename, item.fromPackage, cache))
  return Promise.all(promises)
}
