import test from 'ava'
import md5Hex from 'md5-hex'

import SimulatedBabelCache from '../build/SimulatedBabelCache'

test.beforeEach(t => {
  const data = {}
  const cache = new SimulatedBabelCache(data)
  t.context = {cache, data}
})

test('provides data to api.using() and api.invalidate() handlers', t => {
  const key = Symbol('key')
  const value = Symbol('value')
  t.context.data[key] = value

  t.plan(2)
  t.context.cache.api.using(data => t.deepEqual(data, t.context.data))
  t.context.cache.api.invalidate(data => t.deepEqual(data, t.context.data))
})

test('api.forever() configures the cache', t => {
  t.false(t.context.cache.wasConfigured)
  t.context.cache.api.forever()
  t.true(t.context.cache.wasConfigured)
})

test('api.never() configures the cache', t => {
  t.false(t.context.cache.wasConfigured)
  t.context.cache.api.never()
  t.true(t.context.cache.wasConfigured)
})

test('api.using() configures the cache', t => {
  t.false(t.context.cache.wasConfigured)
  t.context.cache.api.using(() => {})
  t.true(t.context.cache.wasConfigured)
})

test('api.invalidate() configures the cache', t => {
  t.false(t.context.cache.wasConfigured)
  t.context.cache.api.invalidate(() => {})
  t.true(t.context.cache.wasConfigured)
})

test('api.never() fails after api.forever()', t => {
  t.context.cache.api.forever()
  const err = t.throws(() => t.context.cache.api.never())
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .forever()')
})

test('api.using() fails after api.forever()', t => {
  t.context.cache.api.forever()
  const err = t.throws(() => t.context.cache.api.using(() => {}))
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .forever()')
})

test('api.invalidate() fails after api.forever()', t => {
  t.context.cache.api.forever()
  const err = t.throws(() => t.context.cache.api.invalidate(() => {}))
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .forever()')
})

test('api.forever() fails after api.never()', t => {
  t.context.cache.api.never()
  const err = t.throws(() => t.context.cache.api.forever())
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .never()')
})

test('api.using() fails after api.never()', t => {
  t.context.cache.api.never()
  const err = t.throws(() => t.context.cache.api.using(() => {}))
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .never()')
})

test('api.invalidate() fails after api.never()', t => {
  t.context.cache.api.never()
  const err = t.throws(() => t.context.cache.api.invalidate(() => {}))
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .never()')
})

test('.never is true after api.never()', t => {
  t.false(t.context.cache.never)
  t.context.cache.api.never()
  t.true(t.context.cache.never)
})

test('.never is false after api.forever()', t => {
  t.false(t.context.cache.never)
  t.context.cache.api.forever()
  t.false(t.context.cache.never)
})

test('.never is false after api.using()', t => {
  t.false(t.context.cache.never)
  t.context.cache.api.using(() => {})
  t.false(t.context.cache.never)
})

test('.never is false after api.invalidate()', t => {
  t.false(t.context.cache.never)
  t.context.cache.api.invalidate(() => {})
  t.false(t.context.cache.never)
})

test('api.forever() fails after seal()', t => {
  t.context.cache.seal()
  const err = t.throws(() => t.context.cache.api.forever())
  t.is(err.name, 'Error')
  t.is(err.message, 'Cannot change caching after evaluation has completed')
})

test('api.never() fails after seal()', t => {
  t.context.cache.seal()
  const err = t.throws(() => t.context.cache.api.never())
  t.is(err.name, 'Error')
  t.is(err.message, 'Cannot change caching after evaluation has completed')
})

test('api.using() fails after seal()', t => {
  t.context.cache.seal()
  const err = t.throws(() => t.context.cache.api.using(() => {}))
  t.is(err.name, 'Error')
  t.is(err.message, 'Cannot change caching after evaluation has completed')
})

test('api.invalidate() fails after seal()', t => {
  t.context.cache.seal()
  const err = t.throws(() => t.context.cache.api.invalidate(() => {}))
  t.is(err.name, 'Error')
  t.is(err.message, 'Cannot change caching after evaluation has completed')
})

test('api(false) behaves like api.never()', t => {
  t.false(t.context.cache.never)
  t.context.cache.api(false)
  t.true(t.context.cache.never)
  const err = t.throws(() => t.context.cache.api.forever())
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .never()')
})

test('api(true) behaves like api.forever()', t => {
  t.false(t.context.cache.never)
  t.context.cache.api(true)
  t.false(t.context.cache.never)
  const err = t.throws(() => t.context.cache.api.never())
  t.is(err.name, 'Error')
  t.is(err.message, 'Caching has already been configured with .forever()')
})

test('api(handler) behaves like api.using(handler)', t => {
  t.plan(4)
  t.false(t.context.cache.never)

  const key = Symbol('key')
  const value = Symbol('value')
  t.context.data[key] = value

  t.context.cache.api(data => t.deepEqual(data, t.context.data))
  t.false(t.context.cache.never)
  t.true(t.context.cache.wasConfigured)
})

test('hash() fails if called before seal()', t => {
  const err = t.throws(() => t.context.cache.hash())
  t.is(err.name, 'Error')
  t.is(err.message, 'seal() must be called before invoking hash()')
})

test('hash() returns null after api.forever()', t => {
  t.context.cache.api.forever()
  t.context.cache.seal()
  t.is(t.context.cache.hash(), null)
})

test('hash() returns a unique value after api.never()', t => {
  t.context.cache.api.never()
  t.context.cache.seal()
  const value = t.context.cache.hash()
  t.not(value, null)

  const other = new SimulatedBabelCache({})
  other.api.never()
  other.seal()
  t.not(value, other.hash())
})

test('hash() returns the same value if called repeatedly', t => {
  t.context.cache.api.never()
  t.context.cache.seal()
  t.is(t.context.cache.hash(), t.context.cache.hash())
})

{
  const primitive = (t, value, expected) => {
    t.context.cache.api.using(() => value)
    t.context.cache.seal()
    t.is(t.context.cache.hash(), expected)
  }
  primitive.title = kind => `hash() fingerprints ${kind} values`

  test('null', primitive, null, md5Hex('null'))
  test('true', primitive, true, md5Hex('true'))
  test('false', primitive, false, md5Hex('false'))
  test('undefined', primitive, undefined, md5Hex('undefined'))
  test('string', primitive, 'foo', md5Hex('"foo"'))
  test('Infinity', primitive, Infinity, md5Hex('Infinity'))
  test('-Infinity', primitive, -Infinity, md5Hex('-Infinity'))
  test('0', primitive, 0, md5Hex('0'))
  test('-0', primitive, -0, md5Hex('0'))
  test('number (not NaN)', primitive, 3.14, md5Hex('3.14'))
}

{
  const complex = (t, value) => {
    t.context.cache.api.using(() => value)
    t.context.cache.seal()
    const other = new SimulatedBabelCache({})
    other.api.using(() => value)
    other.seal()
    t.not(t.context.cache.hash(), other.hash())
  }
  complex.title = kind => `hash() uniquely fingerprints ${kind} values`

  test('NaN', complex, NaN)
  test('object', complex, {})
  test('array', complex, [])
  test('Map', complex, new Map())
}
