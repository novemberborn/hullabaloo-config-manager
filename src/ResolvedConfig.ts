import Cache from './Cache'
import codegen from './codegen'
import {Chains} from './collector'
import reduceChains, {ConfigList, Dependency, Source} from './reduceChains'
import Verifier from './Verifier'

export default class ResolvedConfig {
  public readonly cache?: Cache
  public readonly babelrcDir?: string
  public readonly dependencies: Dependency[]
  public readonly envNames: Set<string>
  public readonly fixedSourceHashes: Map<string, string>
  public readonly sources: Source[]
  public readonly unflattenedDefaultOptions: ConfigList
  public readonly unflattenedEnvOptions: Map<string, ConfigList>

  public constructor (chains: Chains, cache?: Cache) {
    this.cache = cache
    this.babelrcDir = chains.babelrcDir

    const reduced = reduceChains(chains, cache)
    this.dependencies = reduced.dependencies
    this.envNames = reduced.envNames
    this.fixedSourceHashes = reduced.fixedSourceHashes
    this.sources = reduced.sources
    this.unflattenedDefaultOptions = reduced.unflattenedDefaultOptions
    this.unflattenedEnvOptions = reduced.unflattenedEnvOptions
  }

  public createVerifier () {
    return Verifier.hashAndCreate(
      this.babelrcDir,
      this.envNames,
      this.dependencies,
      this.sources,
      this.fixedSourceHashes,
      this.cache)
  }

  public generateModule () {
    return codegen(this)
  }
}
