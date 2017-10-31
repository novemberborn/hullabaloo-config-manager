import process = require('process')

const env = process.env
export default function currentEnv () {
  return env.BABEL_ENV || env.NODE_ENV || 'development'
}
