import path = require('path')

import dotProp = require('dot-prop')
import md5Hex = require('md5-hex')

import Cache from './Cache'
import {NoSourceFileError} from './errors'
import readSafe from './readSafe'
import {Source} from './reduceChains'

function hashSource (source: string, cache?: Cache): Promise<string> {
  if (cache && cache.sourceHashes && cache.sourceHashes.has(source)) {
    return cache.sourceHashes.get(source)!
  }

  const basename = path.basename(source)
  const parts = basename.split('#')
  const filename = parts[0]
  const filepath = path.join(path.dirname(source), filename)

  const pkgAccessor = filename === 'package.json'
    ? parts[1] || 'babel'
    : null

  const promise = readSafe(filepath, cache)
    .then(contents => {
      if (!contents) throw new NoSourceFileError(source)

      if (!pkgAccessor) {
        return md5Hex(contents)
      }

      const json = JSON.parse(contents.toString('utf8'))
      const value = dotProp.get(json, pkgAccessor) || {}
      return md5Hex(JSON.stringify(value))
    })

  if (cache && cache.sourceHashes) {
    cache.sourceHashes.set(source, promise)
  }
  return promise
}

export default function hashSources (sources: Source[], fixedHashes?: Map<string, string>, cache?: Cache): Promise<string[]> {
  const promises = sources.map(item => {
    return fixedHashes && fixedHashes.has(item.source)
      ? fixedHashes.get(item.source)!
      : hashSource(item.source, cache)
  })
  return Promise.all(promises)
}
