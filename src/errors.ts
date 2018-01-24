import {Kind} from './resolvePluginsAndPresets'

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
  public constructor (source: string, message: string) {
    super(message, source)
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

export class MultipleSourcesError extends SourceError {
  public readonly otherSource: string

  public constructor (source: string, otherSource: string) {
    super('Multiple configuration files found', source)
    this.name = 'MultipleSourcesError'
    this.otherSource = otherSource
  }
}

export class ResolveError extends SourceError {
  public readonly source: string
  public readonly ref: string
  public readonly isPlugin: boolean
  public readonly isPreset: boolean

  public constructor (source: string, kind: Kind, ref: string, message?: string) {
    super(message || `Couldn't find ${kind} ${JSON.stringify(ref)} relative to directory`, source)
    this.name = 'ResolveError'
    this.ref = ref
    this.isPlugin = kind === 'plugin'
    this.isPreset = kind === 'preset'
  }
}

export class ResolveFromCacheError extends ResolveError {
  public constructor (source: string, kind: Kind, ref: string) {
    super(source, kind, ref, `Couldn't find ${kind} ${JSON.stringify(ref)} in cache`)
    this.name = 'ResolveFromCacheError'
  }
}
