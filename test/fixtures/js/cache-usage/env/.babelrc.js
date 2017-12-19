'use strict'
let count = 0
module.exports = {
  __esModule: true,
  default (context) {
    context.env()
    count++
    return {}
  },
  getCount () {
    return count
  }
}
