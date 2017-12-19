'use strict'
let count = 0
module.exports = {
  __esModule: true,
  default (context) {
    context.cache.forever()
    count++
    return {}
  },
  getCount () {
    return count
  }
}
