import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeIfChanged, readIfExists } from '../src/generate/writeFile'

const dir = mkdtempSync(path.join(os.tmpdir(), 'twt-write-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('writeIfChanged', () => {
  it('creates the file and any missing parent dirs, returning true', () => {
    const file = path.join(dir, 'nested/deep/theme.gen.ts')
    expect(writeIfChanged(file, 'hello')).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('hello')
  })

  it('returns false and leaves the file untouched when content is identical', () => {
    const file = path.join(dir, 'same.ts')
    writeIfChanged(file, 'abc')
    expect(writeIfChanged(file, 'abc')).toBe(false)
    expect(readFileSync(file, 'utf8')).toBe('abc')
  })

  it('overwrites and returns true when content differs', () => {
    const file = path.join(dir, 'diff.ts')
    writeIfChanged(file, 'one')
    expect(writeIfChanged(file, 'two')).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('two')
  })
})

describe('readIfExists', () => {
  it('returns null for a missing file', () => {
    expect(readIfExists(path.join(dir, 'nope.ts'))).toBeNull()
  })

  it('returns the contents of an existing file', () => {
    const file = path.join(dir, 'present.ts')
    writeIfChanged(file, 'data')
    expect(readIfExists(file)).toBe('data')
  })
})
