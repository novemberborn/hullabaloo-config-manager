declare module 'resolve-from' {
  namespace resolveFrom {
    export function silent (fromDir: string, name: string): string | null
  }
  export = resolveFrom
}
