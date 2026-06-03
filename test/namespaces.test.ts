import { describe, it, expect } from 'vitest'
import { splitVarName } from '../src/core/namespaces'

describe('splitVarName', () => {
  it('splits a simple namespaced var into namespace + key', () => {
    expect(splitVarName('--color-red-500')).toEqual({ namespace: 'color', key: 'red-500' })
  })

  it('uses longest-prefix matching so font-weight beats font', () => {
    expect(splitVarName('--font-weight-bold')).toEqual({ namespace: 'font-weight', key: 'bold' })
  })

  it('uses longest-prefix matching so text-shadow beats text', () => {
    expect(splitVarName('--text-shadow-lg')).toEqual({ namespace: 'text-shadow', key: 'lg' })
  })

  it('keeps the text namespace for plain font-size tokens', () => {
    expect(splitVarName('--text-lg')).toEqual({ namespace: 'text', key: 'lg' })
  })

  it('handles inset-shadow', () => {
    expect(splitVarName('--inset-shadow-sm')).toEqual({ namespace: 'inset-shadow', key: 'sm' })
  })

  it('handles the default-* namespace', () => {
    expect(splitVarName('--default-transition-duration')).toEqual({
      namespace: 'default',
      key: 'transition-duration',
    })
  })

  it('handles max-width', () => {
    expect(splitVarName('--max-width-prose')).toEqual({ namespace: 'max-width', key: 'prose' })
  })

  it('represents a bare namespace value with the DEFAULT key', () => {
    expect(splitVarName('--spacing')).toEqual({ namespace: 'spacing', key: 'DEFAULT' })
  })

  it('returns the raw split for paired sub-property keys (mid-name --)', () => {
    expect(splitVarName('--text-lg--line-height')).toEqual({ namespace: 'text', key: 'lg--line-height' })
  })

  it('returns null for unknown namespaces', () => {
    expect(splitVarName('--qux-foo')).toBeNull()
  })

  it('returns null for names that are not custom properties', () => {
    expect(splitVarName('color-red')).toBeNull()
  })
})
