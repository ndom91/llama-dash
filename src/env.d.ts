declare const __GIT_COMMIT__: string

// Set by src/server.ts. Returns false when the upgrade is not for llama-dash.
declare var __llamaDashUpgrade:
  | ((req: import('node:http').IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => boolean)
  | undefined
