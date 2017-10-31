export class SourceError extends Error {
  public readonly source: string
  public readonly parent: Error | null

  public constructor (message: string, source: string, parent?: Error) {
    super(`${source}: ${message}`)
    this.name = 'SourceError'
    this.source = source
    this.parent = parent || null
  }
}

export class NoSourceFileError extends SourceError {
  public constructor (source: string) {
    super('No such file', source)
    this.name = 'NoSourceFileError'
  }
}

export class ParseError extends SourceError {
  public constructor (source: string, parent: Error) {
    super(`Error while parsing — ${parent.message}`, source, parent)
    this.name = 'ParseError'
  }
}

export class InvalidFileError extends SourceError {
  public constructor (source: string) {
    super('Not a proper configuration file', source)
    this.name = 'InvalidFileError'
  }
}

export class ExtendsError extends SourceError {
  public readonly clause: string

  public constructor (source: string, clause: string, parent: Error) {
    super(`Couldn't resolve extends clause: ${clause}`, source, parent)
    this.name = 'ExtendsError'
    this.clause = clause
  }
}

export class BadDependencyError extends SourceError {
  public constructor (source: string, parent?: Error) {
    super("Couldn't resolve dependency", source, parent)
    this.name = 'BadDependencyError'
  }
}
