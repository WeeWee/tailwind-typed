# @weewee/tailwind-typed

> Turn your **Tailwind v4** theme into a fully-typed, importable module — so you can use your colors, spacing, and brand tokens **anywhere**, including places Tailwind classes can't reach (OG-image / metadata generators, emails, inline styles, CSS-in-JS, canvas…).

In Tailwind v4 your theme lives in CSS (`@theme { --color-brand: … }`), which TypeScript can't see. `tailwind-typed` reads your theme — **the built-in defaults *and* your custom `@theme` additions** — and generates a self-contained `.ts` module with:

- a typed `tokens` object (`tokens.color.brand.value` → `"#5b21b6"`, `.var` → `"var(--color-brand)"`)
- typed helpers `cssVar()` / `value()`
- typed Tailwind class-name builders (`cn.bg('brand')` → `"bg-brand"`)
- an iterable `allTokens` list (browse / render a palette / build a design-token explorer)

The generated file is **self-contained** — your app has zero runtime dependency on this package (it can be a `devDependency`).

## Install

```bash
pnpm add -D @weewee/tailwind-typed
```
Requires tailwindcss v4 (peer)
## Quick start (Vite)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindTyped from '@weewee/tailwind-typed/vite'

export default defineConfig({
  plugins: [tailwindTyped()], // auto-detects your CSS entry; regenerates on @theme changes (HMR)
})
```

Given a CSS entry like:

```css
/* src/index.css */
@import "tailwindcss";
@theme {
  --color-brand: #5b21b6;
}
```

…a `src/tailwind-theme.gen.ts` is generated and kept in sync:

```ts
import { tokens, cssVar, value, cn, allTokens } from './tailwind-theme.gen'

tokens.color.brand.value   // "#5b21b6"
tokens.color.brand.var     // "var(--color-brand)"

cssVar('color', 'brand')   // "var(--color-brand)"   ✓ autocompleted, typo-safe
value('spacing', '4')      // resolved value
cn.bg('brand')             // "bg-brand"

for (const t of allTokens) { /* t.namespace, t.key, t.var, t.value, t.isDefault */ }
```

## The headline use case: tokens outside Tailwind

When you generate raw CSS or inline styles in a context that **doesn't load Tailwind's `:root` variables** (e.g. an OG-image / metadata generator), `var(--color-brand)` resolves to nothing. Use the **resolved value** instead:

```ts
import { tokens } from './src/tailwind-theme.gen' // a plain import — works in any Node script

export function ogStyles() {
  return {
    background: tokens.color.brand.value, // "#5b21b6" — safe; no :root needed
    color: tokens.color.white.value,
  }
}
```

- `.value` → the literal value. Safe everywhere.
- `.var` → `var(--…)`. Use inside your app where the Tailwind theme CSS is present.

Because the generated module is a **real file** (not a Vite virtual module), it imports cleanly from standalone scripts, SSR, CI tasks — anywhere, not just inside your Vite bundle.

## CLI

The Vite plugin covers in-app dev. For CI and contexts that run outside Vite (a standalone generator, a build step), use the CLI:

```bash
tw-typed generate              # write the typed module (auto-detects input/out)
tw-typed generate --watch      # regenerate on CSS changes
tw-typed check                 # exit non-zero if the module is stale (CI guard)

tw-typed generate -i src/app.css -o src/theme.gen.ts
```

Wire it into your scripts so the module always exists before other tooling runs:

```jsonc
{
  "scripts": {
    "predev": "tw-typed generate",
    "prebuild": "tw-typed generate",
    "lint:theme": "tw-typed check"   // fail CI if someone forgot to regenerate
  }
}
```

## Configuration

Options can come from CLI flags, the Vite plugin argument, or a `tailwind-typed` field in `package.json` (lowest priority). Explicit options win.

| Option  | Default                      | Description                                             |
| ------- | ---------------------------- | ------------------------------------------------------- |
| `input` | auto-detected¹               | CSS entry containing your `@theme`.                     |
| `out`   | `src/tailwind-theme.gen.ts`  | Where to write the generated module.                    |
| `cwd`   | `process.cwd()` / Vite root  | Project root.                                           |
| `header`| package banner               | Override the header comment in the generated file.      |

```jsonc
// package.json
{
  "tailwind-typed": { "input": "app/app.css", "out": "app/theme.gen.ts" }
}
```

¹ Auto-detect tries common locations: `src/index.css`, `src/app.css`, `src/styles/index.css`, `app/app.css`, `styles/globals.css`, … If none are found you'll get a clear error listing what was searched.

> **Tip:** commit the generated file (works everywhere, no setup) **or** gitignore it and regenerate via `predev`/`prebuild` + the `check` guard in CI. Either is fine.

## How it works

`tailwind-typed` loads Tailwind v4's default theme (`tailwindcss/theme.css`) plus your `@theme` block(s) and resolves the merged set through Tailwind's own design-system loader — so you get every token, with your overrides applied, exactly as Tailwind sees them. Namespaces (`color`, `spacing`, `font-weight`, `text-shadow`, …) are detected by longest-prefix match.

## Notes & limitations (v1)

- Targets **Tailwind v4** (CSS-first) only.
- Reads `@theme` from the configured CSS entry. `@theme` blocks inside *imported* CSS files aren't followed yet.
- Paired sub-properties (e.g. `--text-lg--line-height`) are omitted; the primary token (`--text-lg`) is included.
- `.var` references only resolve at runtime where the theme's `:root` variables are present — prefer `.value` for isolated contexts.

## Programmatic API

```ts
import { generate, check, buildModule, resolveTheme, generateModule } from '@weewee/tailwind-typed'

await generate({ cwd, input, out })   // build + write (returns { changed, outPath, tokenCount, … })
await check({ cwd, input, out })      // build + compare (returns { upToDate, … })
const { content } = await buildModule({ input })  // build the module source without writing
const tokenSet = await resolveTheme({ css })      // low-level: CSS -> normalized TokenSet
```

## License

Apache-2.0
