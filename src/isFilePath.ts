import path = require('path')

export default function isFilePath (ref: string): boolean {
  return path.isAbsolute(ref) || ref.startsWith('./') || ref.startsWith('../')
}
