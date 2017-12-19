'use strict'
let count = 0
module.exports = {
  __esModule: true,
  default (context) {
    context.cache.never()
    count++
    return {}
  },
  getCount () {
    return count
  }
}
