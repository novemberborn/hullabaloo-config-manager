declare module 'resolve-from' {
  function resolveFrom (fromDir: string, name: string): string
  namespace resolveFrom {
    export function silent (fromDir: string, name: string): string | null
  }
  export = resolveFrom
}
