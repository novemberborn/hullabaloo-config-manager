declare type PluginOrPresetOptions = object | void | false
declare type PluginOrPresetTarget = string | object | Function
declare type PluginOrPresetItem = PluginOrPresetTarget
  | [PluginOrPresetTarget]
  | [PluginOrPresetTarget, PluginOrPresetOptions]
  | [PluginOrPresetTarget, PluginOrPresetOptions, string]
declare type PluginOrPresetList = Array<PluginOrPresetItem>
export {PluginOrPresetOptions, PluginOrPresetTarget, PluginOrPresetItem, PluginOrPresetList}

declare interface LimitedOptions {
  babelrc?: boolean
  env?: {[name: string]: LimitedOptions}
  extends?: string
  plugins?: PluginOrPresetList
  presets?: PluginOrPresetList
}
export {LimitedOptions}

// Based on <https://github.com/babel/babel/blob/fba19295b4e837fe7af782653fd3dd6480ba2edf/packages/babel-core/src/config/options.js>
/* eslint-disable typescript/member-ordering */
declare interface BabelOptions extends LimitedOptions {
  cwd?: string
  filename?: string
  filenameRelative?: string
  code?: boolean
  ast?: boolean
  inputSourceMap?: object | boolean
  envName?: string

  test?: string | Function | RegExp
  include?: string | Function | RegExp
  exclude?: string | Function | RegExp
  ignore?: Array<string | Function | RegExp>
  only?: Array<string | Function | RegExp>
  overrides?: Array<BabelOptions>

  passPerPreset?: boolean

  // Options for @babel/generator
  retainLines?: boolean
  comments?: boolean
  shouldPrintComment?(comment: string): boolean
  compact?: boolean | 'auto'
  minified?: boolean
  auxiliaryCommentBefore?: string
  auxiliaryCommentAfter?: string

  // Parser
  sourceType?: 'module' | 'script' | 'unambiguous'

  wrapPluginVisitorMethod?(pluginAlias: string, visitorType: 'enter' | 'exit', callback: (path: object, state: any) => void): (path: object, state: any) => void // eslint-disable-line max-len
  highlightCode?: boolean

  // Sourcemap generation options.
  sourceMaps?: boolean | 'inline' | 'both'
  sourceMap?: boolean | 'inline' | 'both'
  sourceFileName?: string
  sourceRoot?: string

  // AMD/UMD/SystemJS module naming options.
  getModuleId?(moduleName: string): string
  moduleRoot?: string
  moduleIds?: boolean
  moduleId?: string

  // Deprecate top level parserOpts
  parserOpts?: object
  // Deprecate top level generatorOpts
  generatorOpts?: object
}
export default BabelOptions
