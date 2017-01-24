import path from 'path'

export default {
  sync (filename) {
    return path.dirname(filename)
  }
}
