import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import tailwindTyped from '../src/vite/index'

const CSS = '@import "tailwindcss";\n@theme { --color-brand: #5b21b6; }\n'

function tmpProject(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'twt-vite-'))
  mkdirSync(path.join(dir, 'src'), { recursive: true })
  writeFileSync(path.join(dir, 'src/index.css'), CSS, 'utf8')
  return dir
}
const out = (dir: string) => path.resolve(dir, 'src/tailwind-theme.gen.ts')

/** Invoke a Vite/Rollup hook that may be a function or an `{ handler }` object. */
async function callHook(hook: any, ...args: any[]): Promise<any> {
  const fn = typeof hook === 'function' ? hook : hook?.handler
  return fn.apply({}, args)
}

function fakeServer() {
  let changeHandler: ((file: string) => unknown) | undefined
  const added: string[] = []
  const server: any = {
    config: { logger: { error: () => {} } },
    watcher: {
      add: (f: string) => added.push(f),
      on: (event: string, handler: (file: string) => unknown) => {
        if (event === 'change') changeHandler = handler
      },
    },
  }
  return { server, added, fire: (file: string) => changeHandler?.(file) }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('tailwindTyped vite plugin', () => {
  it('exposes the plugin name', () => {
    expect(tailwindTyped().name).toBe('tailwind-typed')
  })

  it('generates the typed module on buildStart', async () => {
    const dir = tmpProject()
    const plugin = tailwindTyped({ cwd: dir })
    await callHook(plugin.buildStart)
    expect(existsSync(out(dir))).toBe(true)
    expect(readFileSync(out(dir), 'utf8')).toContain('var(--color-brand)')
  })

  it('watches the CSS entry and regenerates when it changes', async () => {
    const dir = tmpProject()
    const plugin = tailwindTyped({ cwd: dir })
    await callHook(plugin.buildStart)

    const { server, added, fire } = fakeServer()
    await callHook(plugin.configureServer, server)

    const input = path.resolve(dir, 'src/index.css')
    expect(added).toContain(input)

    writeFileSync(input, '@import "tailwindcss";\n@theme { --color-brand: #00ff00; }\n', 'utf8')
    await fire(input)

    expect(readFileSync(out(dir), 'utf8')).toContain('#00ff00')
  })

  it('ignores changes to files other than the CSS entry', async () => {
    const dir = tmpProject()
    const plugin = tailwindTyped({ cwd: dir })
    await callHook(plugin.buildStart)
    const original = readFileSync(out(dir), 'utf8')

    const { server, fire } = fakeServer()
    await callHook(plugin.configureServer, server)

    await fire(path.resolve(dir, 'src/some-other-file.ts'))
    expect(readFileSync(out(dir), 'utf8')).toBe(original)
  })
})
