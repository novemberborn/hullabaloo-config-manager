import assert from 'assert'
import {runInNewContext} from 'vm'

export default function runGeneratedCode (code, env = process.env) {
  const configModule = {}
  runInNewContext(code, {
    exports: configModule,
    require (mid) {
      assert(mid === 'process')

      return {env}
    }
  })

  return configModule
}
