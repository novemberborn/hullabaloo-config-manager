declare module 'package-hash' {
  function packageHash (paths: string | string[], salt?: any[] | Buffer | object | string): Promise<string>
  export = packageHash
}
