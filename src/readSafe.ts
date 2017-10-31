import gfs = require('graceful-fs')

import Cache from './Cache'

export default function readSafe (source: string, cache?: Cache): Promise<Buffer | null> {
  if (cache && cache.files && cache.files.has(source)) {
    return cache.files.get(source)!
  }

  const promise = new Promise<Buffer | null>((resolve, reject) => {
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
