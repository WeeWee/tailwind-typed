import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveOptions } from '../src/config/resolveOptions'

function tmpProject(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'twt-opts-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf8')
  }
  return dir
}

describe('resolveOptions', () => {
  it('auto-detects src/index.css', () => {
    const cwd = tmpProject({ 'src/index.css': '@theme {}' })
    expect(resolveOptions({ cwd }).input).toBe(path.resolve(cwd, 'src/index.css'))
  })

  it('defaults out to src/tailwind-theme.gen.ts (absolute)', () => {
    const cwd = tmpProject({ 'src/index.css': '@theme {}' })
    expect(resolveOptions({ cwd }).out).toBe(path.resolve(cwd, 'src/tailwind-theme.gen.ts'))
  })

  it('respects an explicit input', () => {
    const cwd = tmpProject({ 'styles/tw.css': '@theme {}' })
    expect(resolveOptions({ cwd, input: 'styles/tw.css' }).input).toBe(path.resolve(cwd, 'styles/tw.css'))
  })

  it('reads input/out from the package.json tailwind-typed field', () => {
    const cwd = tmpProject({
      'app/app.css': '@theme {}',
      'package.json': JSON.stringify({ 'tailwind-typed': { input: 'app/app.css', out: 'app/theme.ts' } }),
    })
    const r = resolveOptions({ cwd })
    expect(r.input).toBe(path.resolve(cwd, 'app/app.css'))
    expect(r.out).toBe(path.resolve(cwd, 'app/theme.ts'))
  })

  it('lets explicit options override package.json', () => {
    const cwd = tmpProject({
      'a.css': '@theme {}',
      'b.css': '@theme {}',
      'package.json': JSON.stringify({ 'tailwind-typed': { input: 'a.css' } }),
    })
    expect(resolveOptions({ cwd, input: 'b.css' }).input).toBe(path.resolve(cwd, 'b.css'))
  })

  it('throws a clear error when the explicit input does not exist', () => {
    const cwd = tmpProject({})
    expect(() => resolveOptions({ cwd, input: 'missing.css' })).toThrowError(/missing\.css/)
  })

  it('throws when no CSS entry can be auto-detected, listing candidates', () => {
    const cwd = tmpProject({})
    expect(() => resolveOptions({ cwd })).toThrowError(/auto-detect/i)
  })

  it('prefers the higher-priority candidate when several exist', () => {
    const cwd = tmpProject({ 'src/index.css': '@theme {}', 'src/app.css': '@theme {}' })
    expect(resolveOptions({ cwd }).input).toBe(path.resolve(cwd, 'src/index.css'))
  })
})
