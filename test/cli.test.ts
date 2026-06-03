import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runCli } from '../src/cli/run'

function tmpProject(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'twt-cli-'))
  mkdirSync(path.join(dir, 'src'), { recursive: true })
  writeFileSync(
    path.join(dir, 'src/index.css'),
    '@import "tailwindcss";\n@theme { --color-brand: #5b21b6; }\n',
    'utf8',
  )
  return dir
}
const out = (dir: string) => path.resolve(dir, 'src/tailwind-theme.gen.ts')

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('runCli', () => {
  it('generate writes the file and exits 0', async () => {
    const dir = tmpProject()
    expect(await runCli(['generate', '--cwd', dir])).toBe(0)
    expect(existsSync(out(dir))).toBe(true)
    expect(readFileSync(out(dir), 'utf8')).toContain('var(--color-brand)')
  })

  it('defaults to generate when no command is given', async () => {
    const dir = tmpProject()
    expect(await runCli(['--cwd', dir])).toBe(0)
    expect(existsSync(out(dir))).toBe(true)
  })

  it('check exits 1 when missing/stale and 0 when fresh', async () => {
    const dir = tmpProject()
    expect(await runCli(['check', '--cwd', dir])).toBe(1) // missing
    await runCli(['generate', '--cwd', dir])
    expect(await runCli(['check', '--cwd', dir])).toBe(0) // fresh
    writeFileSync(out(dir), '// stale', 'utf8')
    expect(await runCli(['check', '--cwd', dir])).toBe(1) // stale
  })

  it('respects --out', async () => {
    const dir = tmpProject()
    expect(await runCli(['generate', '--cwd', dir, '--out', 'custom/theme.ts'])).toBe(0)
    expect(existsSync(path.resolve(dir, 'custom/theme.ts'))).toBe(true)
  })

  it('returns 1 for an unknown command', async () => {
    const dir = tmpProject()
    expect(await runCli(['frobnicate', '--cwd', dir])).toBe(1)
  })

  it('returns 1 with a clear error when no CSS entry can be found', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'twt-cli-empty-'))
    expect(await runCli(['generate', '--cwd', dir])).toBe(1)
  })

  it('--help exits 0', async () => {
    expect(await runCli(['--help'])).toBe(0)
  })
})
