declare module 'pkg-dir' {
  namespace pkgDir {
    export function sync (filename: string): string | null
  }
  export = pkgDir
}
