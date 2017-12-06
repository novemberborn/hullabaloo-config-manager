declare type PluginOrPresetDescriptor = string | [string] | [string, any] | [string, any, string]
declare type PluginOrPresetList = Array<PluginOrPresetDescriptor>
declare interface ReducedOptions {
  babelrc?: boolean
  env?: {[name: string]: ReducedOptions}
  extends?: string
  plugins?: PluginOrPresetList
  presets?: PluginOrPresetList
}
export {ReducedOptions, PluginOrPresetDescriptor, PluginOrPresetList}

// From https://github.com/DefinitelyTyped/DefinitelyTyped/blob/99f93266bb31438c1d4c4e1ce82a3ce343c210c3/types/babel-core/index.d.ts
// but without documentation or external type dependencies.
declare interface BabelOptions extends ReducedOptions {
  ast?: boolean
  auxiliaryCommentAfter?: string
  auxiliaryCommentBefore?: string
  code?: boolean
  comments?: boolean
  compact?: boolean | 'auto'
  filename?: string
  filenameRelative?: string
  generatorOpts?: object
  highlightCode?: boolean
  ignore?: string[]
  inputSourceMap?: object
  minified?: boolean
  moduleId?: string
  moduleIds?: boolean
  moduleRoot?: string
  only?: string | RegExp | Array<string | RegExp>
  parserOpts?: object
  retainLines?: boolean
  sourceFileName?: string
  sourceMaps?: boolean | 'inline' | 'both'
  sourceMapTarget?: string
  sourceRoot?: string
  sourceType?: 'script' | 'module'
  getModuleId?(moduleName: string): string
  resolveModuleSource?(source: string, filename: string): string
  shouldPrintComment?(comment: string): boolean
  wrapPluginVisitorMethod?(pluginAlias: string, visitorType: 'enter' | 'exit', callback: (path: object, state: any) => void): (path: object, state: any) => void // eslint-disable-line max-len
}
export default BabelOptions
