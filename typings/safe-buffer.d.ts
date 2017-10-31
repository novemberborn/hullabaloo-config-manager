declare module 'safe-buffer' {
  class NodeBuffer extends Buffer {}
  namespace SafeBuffer {
    export class Buffer extends NodeBuffer {} // eslint-disable-line no-shadow
  }
  export = SafeBuffer
}
