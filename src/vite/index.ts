import path from 'node:path'
import type { Plugin } from 'vite'
import { generate } from '../index'
import { resolveOptions, type TailwindTypedOptions } from '../config/resolveOptions'

export type VitePluginOptions = TailwindTypedOptions

/**
 * Vite plugin that generates a typed module from your Tailwind v4 theme and
 * keeps it in sync. Generates once on build start, and in dev watches your CSS
 * entry, regenerating (and triggering HMR) whenever your `@theme` changes.
 */
export default function tailwindTyped(options: VitePluginOptions = {}): Plugin {
  let opts: TailwindTypedOptions = { ...options }

  async function run(): Promise<void> {
    const result = await generate(opts)
    if (result.changed) {
      // eslint-disable-next-line no-console
      console.log(`[tailwind-typed] Generated ${result.outPath} (${result.tokenCount} tokens).`)
    }
  }

  return {
    name: 'tailwind-typed',

    configResolved(config) {
      if (!opts.cwd) opts = { ...opts, cwd: config.root }
    },

    async buildStart() {
      await run()
    },

    configureServer(server) {
      let inputPath: string
      try {
        inputPath = resolveOptions(opts).input
      } catch (err) {
        server.config.logger.error(`[tailwind-typed] ${(err as Error).message}`)
        return
      }

      server.watcher.add(inputPath)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) !== inputPath) return
        return run().catch((err) =>
          server.config.logger.error(`[tailwind-typed] ${(err as Error).message}`),
        )
      })
    },
  }
}
