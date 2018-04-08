declare module 'json5' {
  namespace json5 {
    type Options = {
      quote?: string
      space?: string | number
      replacer?: (key: string, value: any) => string
    }

    function parse (text: string, reviver?: (key: string, value: any) => any): any
    function stringify (value: any, replacer?: (key: string, value: any) => string, space?: string | number): string
    function stringify (value: any, options?: Options): string
  }
  export = json5
}
