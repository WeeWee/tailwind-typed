import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { exports: Record<string, unknown> }

describe('package.json exports', () => {
  it('exposes ./package.json so consumers can read the installed version', () => {
    // ERR_PACKAGE_PATH_NOT_EXPORTED otherwise — breaks tools that do
    // require('@adamkindberg/tailwind-typed/package.json').
    expect(pkg.exports['./package.json']).toBe('./package.json')
  })
})
