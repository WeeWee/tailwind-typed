/** A single resolved theme token. */
export interface Token {
  /** Full CSS custom property name, e.g. `--color-brand`. */
  name: string
  /** CSS variable reference, e.g. `var(--color-brand)`. */
  var: string
  /** Resolved/authored value, e.g. `#5b21b6`. Whitespace-normalized. */
  value: string
  /** Theme namespace, e.g. `color` or `font-weight`. */
  namespace: string
  /** Token key within the namespace, e.g. `red-500`. `DEFAULT` for a bare value like `--spacing`. */
  key: string
  /** True when the token comes from Tailwind's built-in defaults (not your `@theme`). */
  isDefault: boolean
}

/** The full set of resolved theme tokens, both flat and grouped by namespace. */
export interface TokenSet {
  /** Every token, flat. */
  tokens: Token[]
  /** Tokens grouped: `byNamespace[namespace][key]`. */
  byNamespace: Record<string, Record<string, Token>>
}
