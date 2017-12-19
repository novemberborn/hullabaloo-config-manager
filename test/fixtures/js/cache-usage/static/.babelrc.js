'use strict'
let count = 0
module.exports = {
  __esModule: true,
  get default () {
    count++
    return {}
  },
  getCount () {
    return count
  }
}
