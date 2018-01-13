import gfs = require('graceful-fs')

import Cache from './Cache'

export default function readSafe (source: string, cache?: Cache): Promise<Buffer | null> {
  if (cache && cache.files.has(source)) {
    return cache.files.get(source)!
  }

  const isFile = new Promise<boolean>(resolve => {
    gfs.stat(source, (err, stat) => {
      resolve(!err && stat.isFile())
    })
  })
  const promise = new Promise<Buffer | null>((resolve, reject) => {
    gfs.readFile(source, async (err, contents) => {
      if (!(await isFile)) {
        resolve(null)
      } else if (err) {
        reject(err)
      } else {
        resolve(contents)
      }
    })
  })

  if (cache) {
    cache.files.set(source, promise)
  }
  return promise
}
