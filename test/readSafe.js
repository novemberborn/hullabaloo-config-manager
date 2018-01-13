import test from 'ava'
import td from 'testdouble'

const gfs = td.replace('graceful-fs')
const {default: readSafe} = require('../build/readSafe')

td.when(gfs.stat(__filename)).thenCallback(null, {isFile () { return true }})

test('rejects when reading an actual file fails with an error', async t => {
  const expected = new Error()
  td.when(gfs.readFile(__filename)).thenCallback(expected)
  const actual = await t.throws(readSafe(__filename))
  t.is(actual, expected)
})
