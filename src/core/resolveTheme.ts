import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { __unstable__loadDesignSystem } from 'tailwindcss'
import { splitVarName } from './namespaces'
import type { Token, TokenSet } from './types'

/** Tailwind v4 `ThemeOptions.DEFAULT` bit — set on tokens that come from `@theme default`. */
const DEFAULT_FLAG = 1 << 2

/** Shape of a single entry returned by `DesignSystem.theme.entries()`. */
interface ThemeEntry {
  value: string | null
  options: number
}

export interface ResolveThemeOptions {
  /** User CSS containing `@theme` block(s). */
  css: string
  /** Project base dir, used to locate the user's tailwindcss and as the `@import` base. Defaults to `process.cwd()`. */
  base?: string
  /** Override the Tailwind default theme CSS (mainly for testing). */
  defaultThemeCss?: string
}

/** Locate and read `tailwindcss/theme.css`, preferring the consumer's install over our own. */
function loadDefaultThemeCss(base: string): string {
  const anchors = [path.join(base, '__tailwind_typed__.js'), import.meta.url]
  let lastErr: unknown
  for (const anchor of anchors) {
    try {
      const require = createRequire(anchor)
      return readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8')
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(
    `[tailwind-typed] Could not locate "tailwindcss/theme.css". Is tailwindcss v4 installed in your project? (${String(lastErr)})`,
  )
}

/** Collapse runs of whitespace (incl. newlines) to single spaces and trim. */
function normalizeValue(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Read the merged Tailwind v4 theme (built-in defaults + the user's `@theme`
 * additions/overrides) and return it as a normalized {@link TokenSet}.
 */
export async function resolveTheme(opts: ResolveThemeOptions): Promise<TokenSet> {
  const base = opts.base ?? process.cwd()
  const defaults = opts.defaultThemeCss ?? loadDefaultThemeCss(base)
  // Strip @import/@plugin/@config rules so the design system never tries to
  // resolve them; the defaults are already inlined above, and only @theme data
  // matters here. @plugin/@config declare no theme tokens, and leaving them in
  // makes Tailwind demand a `loadModule` callback we don't supply — crashing the
  // CLI/programmatic path with "No `loadModule` function provided to `compile`".
  const userCss = opts.css
    .replace(/@import\s+[^;]+;/g, '')
    .replace(/@plugin\s+[^;]+;/g, '')
    .replace(/@config\s+[^;]+;/g, '')
  const combined = `${defaults}\n${userCss}`

  const designSystem = await __unstable__loadDesignSystem(combined, { base })

  const tokens: Token[] = []
  const byNamespace: Record<string, Record<string, Token>> = {}

  for (const [name, entry] of designSystem.theme.entries() as Iterable<[string, ThemeEntry]>) {
    const parts = splitVarName(name)
    if (!parts) continue
    // Skip Tailwind's paired sub-properties (e.g. `--text-lg--line-height`).
    if (parts.key.includes('--')) continue

    const token: Token = {
      name,
      var: `var(${name})`,
      value: normalizeValue(entry.value),
      namespace: parts.namespace,
      key: parts.key,
      isDefault: (entry.options & DEFAULT_FLAG) !== 0,
    }

    tokens.push(token)
    ;(byNamespace[parts.namespace] ??= {})[parts.key] = token
  }

  return { tokens, byNamespace }
}
