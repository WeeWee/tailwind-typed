/**
 * The set of theme namespaces Tailwind v4 understands. A CSS variable like
 * `--color-red-500` belongs to the `color` namespace with key `red-500`.
 *
 * Several namespaces share a prefix (`font` vs `font-weight`, `text` vs
 * `text-shadow`, `shadow` vs `inset-shadow`/`drop-shadow`). We therefore match
 * the *longest* namespace first so the boundary is placed correctly.
 */
const THEME_NAMESPACES = [
  'inset-shadow',
  'drop-shadow',
  'text-shadow',
  'font-weight',
  'max-width',
  'color',
  'font',
  'text',
  'tracking',
  'leading',
  'breakpoint',
  'container',
  'spacing',
  'radius',
  'shadow',
  'blur',
  'perspective',
  'aspect',
  'ease',
  'animate',
  'default',
].sort((a, b) => b.length - a.length)

export interface VarParts {
  /** The theme namespace, e.g. `color` or `font-weight`. */
  namespace: string
  /** The token key within the namespace, e.g. `red-500`. `DEFAULT` for a bare namespace value like `--spacing`. */
  key: string
}

/**
 * Split a CSS custom property name into its theme namespace and key.
 * Returns `null` when the name is not a custom property or does not belong to a
 * known theme namespace.
 */
export function splitVarName(name: string): VarParts | null {
  if (!name.startsWith('--')) return null
  const body = name.slice(2)

  for (const ns of THEME_NAMESPACES) {
    if (body === ns) return { namespace: ns, key: 'DEFAULT' }
    if (body.startsWith(ns + '-')) {
      return { namespace: ns, key: body.slice(ns.length + 1) }
    }
  }

  return null
}
