declare module 'lodash.merge' {
  function merge<T> (object: T, ...sources: object[]): T
  export = merge
}
