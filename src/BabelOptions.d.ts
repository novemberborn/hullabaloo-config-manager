declare type Plugins = Array<string | [string, any]>
declare type Presets = Array<string | [string, any]>
declare interface ReducedOptions {
  babelrc?: boolean
  env?: {[name: string]: ReducedOptions}
  extends?: string
  plugins?: Plugins
  presets?: Presets
}
export {ReducedOptions, Plugins, Presets}

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
