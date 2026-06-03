import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildModule, generate, check } from '../src/index'

function tmpProject(css: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'twt-api-'))
  mkdirSync(path.join(dir, 'src'), { recursive: true })
  writeFileSync(path.join(dir, 'src/index.css'), css, 'utf8')
  return dir
}

const CSS = `@import "tailwindcss";
@theme {
  --color-brand: #5b21b6;
}
`

describe('buildModule', () => {
  it('reads the input CSS and produces a typed module containing the custom token', async () => {
    const cwd = tmpProject(CSS)
    const res = await buildModule({ cwd })
    expect(res.inputPath).toBe(path.resolve(cwd, 'src/index.css'))
    expect(res.outPath).toBe(path.resolve(cwd, 'src/tailwind-theme.gen.ts'))
    expect(res.tokenCount).toBeGreaterThan(100)
    expect(res.content).toContain('var(--color-brand)')
    expect(res.content).toContain('#5b21b6')
  })
})

describe('generate', () => {
  it('writes the generated file (changed=true), then is idempotent (changed=false)', async () => {
    const cwd = tmpProject(CSS)
    const first = await generate({ cwd })
    expect(first.changed).toBe(true)
    expect(existsSync(first.outPath)).toBe(true)
    expect(readFileSync(first.outPath, 'utf8')).toContain('var(--color-brand)')

    const second = await generate({ cwd })
    expect(second.changed).toBe(false)
  })
})

describe('check', () => {
  it('reports not-up-to-date when the file is missing or stale, up-to-date after generate', async () => {
    const cwd = tmpProject(CSS)

    expect((await check({ cwd })).upToDate).toBe(false) // missing

    await generate({ cwd })
    expect((await check({ cwd })).upToDate).toBe(true) // fresh

    writeFileSync(path.resolve(cwd, 'src/tailwind-theme.gen.ts'), '// stale', 'utf8')
    expect((await check({ cwd })).upToDate).toBe(false) // stale
  })
})
