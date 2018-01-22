import assert from 'assert'
import {runInNewContext} from 'vm'

import * as helpers from '../../build/helpers'

export default function runGeneratedCode (code, env = process.env) {
  const configModule = {}
  runInNewContext(code, {
    console,
    exports: configModule,
    require (mid) {
      if (mid === 'process') return {env}
      if (mid === require.resolve('../../build/helpers')) return helpers
      assert.fail(`Unexpected mid: ${mid}`)
    }
  })

  return configModule
}
