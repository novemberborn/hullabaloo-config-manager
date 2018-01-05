declare module 'pirates' {
  namespace pirates {
    function addHook(
      hook: (code: string, filename: string) => string,
      opts: {
        exts: string[]
        matcher: (filename: string) => boolean
      }
    ): () => void
  }
  export = pirates
}
