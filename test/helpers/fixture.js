import path from 'path'

export default function fixture (...args) {
  return path.join(__dirname, '..', 'fixtures', ...args)
}
