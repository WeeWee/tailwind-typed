import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { generateModule } from '../src/generate/generate'
import type { Token, TokenSet } from '../src/core/types'

/** Transpile generated TS and import it as a self-contained ES module (avoids path-with-spaces issues). */
async function importGenerated(source: string): Promise<any> {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const tmpDir = path.join(import.meta.dirname, '__tmp__')
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }))

function sampleSet(): TokenSet {
  const tokens: Token[] = [
    { name: '--color-brand', var: 'var(--color-brand)', value: '#5b21b6', namespace: 'color', key: 'brand', isDefault: false },
    { name: '--color-red-500', var: 'var(--color-red-500)', value: '#ef4444', namespace: 'color', key: 'red-500', isDefault: true },
    { name: '--spacing-huge', var: 'var(--spacing-huge)', value: '100px', namespace: 'spacing', key: 'huge', isDefault: false },
  ]
  const byNamespace: TokenSet['byNamespace'] = {}
  for (const t of tokens) (byNamespace[t.namespace] ??= {})[t.key] = t
  return { tokens, byNamespace }
}

function writeGen(prefix: string): string {
  mkdirSync(tmpDir, { recursive: true })
  const file = path.join(tmpDir, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`)
  writeFileSync(file, generateModule(sampleSet()), 'utf8')
  return file
}

describe('generateModule', () => {
  it('includes the key exports and token data', () => {
    const out = generateModule(sampleSet())
    expect(out).toContain('export const tokens')
    expect(out).toContain('var(--color-brand)')
    expect(out).toContain('#5b21b6')
    expect(out).toContain('export function cssVar')
    expect(out).toContain('export function value')
    expect(out).toContain('export const cn')
    expect(out).toContain('export const allTokens')
  })

  it('is deterministic regardless of input token order', () => {
    const a = sampleSet()
    const b = sampleSet()
    b.tokens.reverse()
    expect(generateModule(a)).toBe(generateModule(b))
  })

  it('produces a module whose runtime exports behave correctly', async () => {
    const mod = await importGenerated(generateModule(sampleSet()))

    expect(mod.tokens.color.brand.value).toBe('#5b21b6')
    expect(mod.tokens.color.brand.var).toBe('var(--color-brand)')
    expect(mod.cssVar('color', 'brand')).toBe('var(--color-brand)')
    expect(mod.value('spacing', 'huge')).toBe('100px')
    expect(mod.cn.bg('brand')).toBe('bg-brand')
    expect(mod.cn.text('red-500')).toBe('text-red-500')
    expect(mod.allTokens).toHaveLength(3)
    expect(mod.allTokens.find((t: any) => t.key === 'brand')).toMatchObject({
      namespace: 'color',
      isDefault: false,
    })
  })

  it('emits valid, type-safe TypeScript (tsc --noEmit passes)', () => {
    const file = writeGen('compile')
    const tsc = path.join(import.meta.dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc')
    // Throws (non-zero exit) if the generated module is not valid, strict TS.
    execFileSync(
      process.execPath,
      [tsc, '--noEmit', '--strict', '--target', 'es2022', '--lib', 'es2022', '--moduleResolution', 'bundler', '--module', 'esnext', file],
      { stdio: 'pipe' },
    )
  })
})
