import assert from 'assert'
import {runInNewContext} from 'vm'

import merge from 'lodash.merge'
import cloneOptions from '../../build/cloneOptions'
import normalizeOptions from '../../build/normalizeOptions'
import standardizeName from '../../build/standardizeName'

export default function runGeneratedCode (code, env = process.env) {
  const configModule = {}
  runInNewContext(code, {
    console,
    exports: configModule,
    require (mid) {
      if (mid === 'process') return {env}
      if (mid === require.resolve('lodash.merge')) return merge
      if (mid === require.resolve('../../build/cloneOptions')) return {default: cloneOptions}
      if (mid === require.resolve('../../build/normalizeOptions')) return {default: normalizeOptions}
      if (mid === require.resolve('../../build/standardizeName')) return {default: standardizeName}
      assert.fail(`Unexpected mid: ${mid}`)
    }
  })

  return configModule
}
