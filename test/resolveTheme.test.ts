import { describe, it, expect } from 'vitest'
import { resolveTheme } from '../src/core/resolveTheme'

const userCss = `
@import "tailwindcss";
@theme {
  --color-brand: #5b21b6;
  --spacing-huge: 100px;
  --color-red-500: #ff0000;
}
`

describe('resolveTheme', () => {
  it('includes a custom user token with full metadata', async () => {
    const { byNamespace } = await resolveTheme({ css: userCss })
    expect(byNamespace.color.brand).toEqual({
      name: '--color-brand',
      var: 'var(--color-brand)',
      value: '#5b21b6',
      namespace: 'color',
      key: 'brand',
      isDefault: false,
    })
  })

  it('includes Tailwind built-in defaults flagged as isDefault', async () => {
    const { byNamespace } = await resolveTheme({ css: userCss })
    const blue = byNamespace.color['blue-500']
    expect(blue).toBeDefined()
    expect(blue.isDefault).toBe(true)
    expect(blue.var).toBe('var(--color-blue-500)')
  })

  it('applies user overrides of a default token', async () => {
    const { byNamespace } = await resolveTheme({ css: userCss })
    expect(byNamespace.color['red-500'].value).toBe('#ff0000')
    expect(byNamespace.color['red-500'].isDefault).toBe(false)
  })

  it('tolerates @import statements in the user CSS', async () => {
    const { byNamespace } = await resolveTheme({ css: userCss })
    expect(byNamespace.color.brand.value).toBe('#5b21b6')
  })

  it('tolerates @plugin and @config statements in the user CSS', async () => {
    const css = `
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@config "./tailwind.config.js";
@theme {
  --color-brand: #5b21b6;
}
`
    const { byNamespace } = await resolveTheme({ css })
    expect(byNamespace.color.brand.value).toBe('#5b21b6')
  })

  it('skips paired sub-property keys like --text-lg--line-height', async () => {
    const { tokens, byNamespace } = await resolveTheme({ css: userCss })
    expect(tokens.some((t) => t.key.includes('--'))).toBe(false)
    expect(byNamespace.text.lg).toBeDefined()
  })

  it('exposes a flat tokens array including the custom spacing token', async () => {
    const { tokens } = await resolveTheme({ css: userCss })
    expect(tokens.length).toBeGreaterThan(100)
    expect(tokens.find((t) => t.name === '--spacing-huge')).toMatchObject({
      namespace: 'spacing',
      key: 'huge',
      value: '100px',
      isDefault: false,
    })
  })
})
