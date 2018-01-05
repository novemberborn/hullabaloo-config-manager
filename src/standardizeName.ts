import isFilePath from './isFilePath'
import {Kind} from './resolvePluginsAndPresets'

// Based on https://github.com/babel/babel/blob/master/packages/babel-core/src/config/loading/files/plugins.js#L60:L86
// but with fewer regular expressions 😉
export default function standardizeName (kind: Kind, ref: string): {fromFile: boolean, name: string} { // eslint-disable-line typescript/member-delimiter-style
  if (isFilePath(ref)) return {fromFile: true, name: ref}
  if (ref.startsWith('module:')) return {fromFile: false, name: ref.slice(7)}

  if (kind === Kind.PLUGIN) {
    if (ref.startsWith('babel-plugin-') || ref.startsWith('@babel/plugin-')) return {fromFile: false, name: ref}
    if (ref.startsWith('@babel/')) return {fromFile: false, name: `@babel/plugin-${ref.slice(7)}`}
    if (!ref.startsWith('@')) return {fromFile: false, name: `babel-plugin-${ref}`}
  } else {
    if (ref.startsWith('babel-preset-') || ref.startsWith('@babel/preset-')) return {fromFile: false, name: ref}
    if (ref.startsWith('@babel/')) return {fromFile: false, name: `@babel/preset-${ref.slice(7)}`}
    if (!ref.startsWith('@')) return {fromFile: false, name: `babel-preset-${ref}`}
  }

  // At this point `ref` is guaranteed to be scoped.
  const matches = /^(@.+?)\/([^/]+)(.*)/.exec(ref)!
  const scope = matches[1]
  const partialName = matches[2]
  const remainder = matches[3]
  return {fromFile: false, name: `${scope}/babel-${kind === Kind.PLUGIN ? 'plugin' : 'preset'}-${partialName}${remainder}`}
}
