import pirates = require('pirates')

const accessSymbol = Symbol.for('__hullabaloo_dependencies__')

export type LoadedConfigModule = {
  dependencies: Map<string, string>
  options: any
}

export default function loadConfigModule (configFile: string): LoadedConfigModule {
  const revert = pirates.addHook((code, filename) => {
    return `var __hullabaloo_dependencies__ = new Map();(function(exports, require, module, __filename, __dirname) {${code}
})(exports, Object.assign(request => {
  const id = require.resolve(request)
  __hullabaloo_dependencies__.set(id, request)
  return require(id)
}, require), module, __filename, __dirname)
try {
  Object.defineProperty(module.exports, Symbol.for('__hullabaloo_dependencies__'), {
    configurable: false,
    enumerable: false,
    writable: false,
    value: __hullabaloo_dependencies__
  })
} catch (_) {}`
  }, {
    exts: ['.js'],
    matcher: filename => filename === configFile
  })

  try {
    const configExports = require(configFile) // eslint-disable-line import/no-dynamic-require
    const dependencies: Map<string, string> = configExports[accessSymbol] || new Map()
    const options = configExports.__esModule ? configExports.default : configExports
    return {dependencies, options}
  } finally {
    revert()
  }
}
