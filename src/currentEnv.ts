import process = require('process')

export const DEFAULT_ENV = 'development'

const env = process.env
export default function currentEnv () {
  return env.BABEL_ENV || env.NODE_ENV || DEFAULT_ENV
}
