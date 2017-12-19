import md5Hex = require('md5-hex')

// Babel compares cache keys using strict equality. Hullabaloo needs to compare
// keys across process restarts, which require the keys to be included in the
// source hash. This function returns string values for all keys. Complex
// values, NaN and symbols are represented by a timestamp and an offset. This
// makes it unlikely they'll compare when verifying the resulting source hash
// in the future, which helps avoid falsely positive hash matches.

let offset = 0

// TODO: Consider fingerprinting well-known and registered symbols.
function fingerprint (key: any): string {
  if (key === null) return 'null'
  if (typeof key === 'boolean') return String(key)
  if (typeof key === 'undefined') return 'undefined'
  if (typeof key === 'string') return JSON.stringify(key)
  if (typeof key === 'number') {
    if (key === Infinity) return 'Infinity'
    if (key === -Infinity) return '-Infinity'
    if (!isNaN(key)) return JSON.stringify(key)
  }

  offset = (offset + 1) % Number.MAX_SAFE_INTEGER
  return `${Date.now()}.${offset}`
}

export interface HandlerFn<T extends any, Data> {
  (data: Data): T
}

export interface Api<Data> {
  (val: boolean): void
  <T>(val: HandlerFn<T, Data>): T

  forever: () => void
  never: () => void
  using<T> (handler: HandlerFn<T, Data>): T
  invalidate<T> (handler: HandlerFn<T, Data>): T
}

enum Configuration {Forever, Never, Using}

export default class SimulatedBabelCache<Data extends object> {
  public api: Api<Data>

  private computedHash?: {value: string | null}
  private configuration: Configuration | null
  private keys: any[]
  private sealed: boolean

  public constructor (data: Data) {
    this.configuration = null
    this.keys = []
    this.sealed = false

    const assertNotSealed = () => {
      if (this.sealed) throw new Error('Cannot change caching after evaluation has completed')
    }
    const assertNotForever = () => {
      if (this.configuration === Configuration.Forever) throw new Error('Caching has already been configured with .forever()')
    }
    const assertNotNever = () => {
      if (this.configuration === Configuration.Never) throw new Error('Caching has already been configured with .never()')
    }

    const forever = () => {
      assertNotSealed()
      assertNotNever()
      this.configuration = Configuration.Forever
    }
    const never = () => {
      assertNotSealed()
      assertNotForever()
      this.configuration = Configuration.Never
    }
    const using = <T extends any> (handler: HandlerFn<T, Data>): T => {
      assertNotSealed()
      assertNotForever()
      assertNotNever()
      this.configuration = Configuration.Using
      const key = handler(data)
      this.keys.push(key)
      return key
    }

    this.api = Object.assign((val: boolean | HandlerFn<any, Data>): void | any => {
      assertNotSealed()
      if (val === true) return forever()
      if (val === false) return never()
      return using(val)
    }, {
      forever,
      invalidate: using,
      never,
      using
    })
  }

  public get wasConfigured () {
    return this.configuration !== null
  }

  public get never () {
    return this.configuration === Configuration.Never
  }

  public hash (): string | null {
    if (!this.sealed) throw new Error('seal() must be called before invoking hash()')
    if (this.computedHash) return this.computedHash.value

    let value: string | null = null
    // Return a unique hash to ensure the resulting source hash won't match when
    // verified.
    if (this.never) {
      value = md5Hex(fingerprint({}))
    } else if (this.keys.length > 0) {
      value = md5Hex(this.keys.map(key => fingerprint(key)))
    }
    // The value remains null if there were no keys, which indicates that the
    // cache was never used, or forever() was called.

    this.computedHash = {value}
    return value
  }

  public seal () {
    this.sealed = true
  }
}
