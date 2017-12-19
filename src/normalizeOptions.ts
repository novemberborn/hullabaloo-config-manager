import BabelOptions from './BabelOptions'

export default function normalizeOptions (options: BabelOptions): BabelOptions {
  // Always delete `babelrc`. Babel itself no longer needs to resolve this file.
  delete options.babelrc

  // Based on <https://github.com/babel/babel/blob/509dbb7302ee15d0243118afc09dde56b2987c38/packages/babel-core/src/config/option-manager.js#L154:L171>.
  // `extends` and `env` have already been removed, and removing `plugins` and
  // `presets` is superfluous here.
  delete options.passPerPreset
  delete options.ignore
  delete options.only

  if (options.sourceMap) {
    options.sourceMaps = options.sourceMap
    delete options.sourceMap
  }

  return options
}
