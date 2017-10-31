'use strict'

const ExtendableError = require('es6-error')

class SourceError extends ExtendableError {
  constructor (message, source, parent) {
    super(`${source}: ${message}`)
    this.name = 'SourceError'
    this.source = source
    this.parent = parent || null
  }
}
exports.SourceError = SourceError

class NoSourceFileError extends SourceError {
  constructor (source) {
    super('No such file', source)
    this.name = 'NoSourceFileError'
  }
}
exports.NoSourceFileError = NoSourceFileError

class ParseError extends SourceError {
  constructor (source, parent) {
    super(`Error while parsing — ${parent.message}`, source, parent)
    this.name = 'ParseError'
  }
}
exports.ParseError = ParseError

class InvalidFileError extends SourceError {
  constructor (source) {
    super('Not a proper configuration file', source)
    this.name = 'InvalidFileError'
  }
}
exports.InvalidFileError = InvalidFileError

class ExtendsError extends SourceError {
  constructor (source, clause, parent) {
    super(`Couldn't resolve extends clause: ${clause}`, source, parent)
    this.name = 'ExtendsError'
    this.clause = clause
  }
}
exports.ExtendsError = ExtendsError

class BadDependencyError extends SourceError {
  constructor (source, parent) {
    super("Couldn't resolve dependency", source, parent)
    this.name = 'BadDependencyError'
  }
}
exports.BadDependencyError = BadDependencyError
