import path from 'path'
import test from 'ava'
import loadConfigModule from '../build/loadConfigModule'

test('defaults dependencies to an empty map if they could not be added to the exports', t => {
  t.deepEqual(loadConfigModule(path.join(__dirname, './fixtures/frozen-config-module.js')).dependencies, new Map())
})
