# Using `@adamkindberg/tailwind-typed` — a guide for AI agents

> Audience: an AI coding agent working in a **consumer project** that depends on
> `@adamkindberg/tailwind-typed`. This is not the README (that's for humans) and
> not `CLAUDE.md` (that's for agents editing *this package*). This tells you how
> to correctly use the package's output when writing application code.

## The one-line model

The package reads a Tailwind v4 theme (`@theme { … }` + Tailwind's built-in
defaults) and emits **one self-contained `.ts` file** (default
`src/tailwind-theme.gen.ts`) exposing every theme token as typed values. The
generated file has **zero runtime dependency** on the package, so it imports
anywhere — inside the Vite app, in SSR, in standalone Node scripts, in CI.

## Rules you must follow

1. **Never hand-edit the generated file.** It starts with
   `// AUTO-GENERATED … do not edit by hand`. Any manual change is lost on the
   next regeneration. To change tokens, edit the CSS `@theme` block, then
   regenerate.
2. **Never author a token by editing the `.gen.ts`.** Add
   `--color-brand: #5b21b6` to the project's `@theme` in the CSS entry, then run
   generation.
3. **Pick `.value` vs `.var` deliberately** — see the decision rule below. This
   is the single most common mistake.

## `.value` vs `.var` — the decision rule

Every token exposes both:

| Field    | Example                 | Use when…                                                          |
| -------- | ----------------------- | ------------------------------------------------------------------ |
| `.value` | `"#5b21b6"`             | the CSS `:root` variables are **not** guaranteed present           |
| `.var`   | `"var(--color-brand)"`  | you're inside the app where Tailwind's theme CSS **is** loaded     |

```ts
tokens.color.brand.value   // "#5b21b6"          — literal, safe everywhere
tokens.color.brand.var     // "var(--color-brand)" — only resolves where :root vars exist
```

**Default to `.value`** for anything that renders outside the normal app DOM:
OG-image / metadata generators, emails, canvas, inline styles injected before
Tailwind loads, SSR fragments, CI output. In those contexts `var(--…)` resolves
to nothing. Use `.var` only inside components/styles that render where the
Tailwind theme stylesheet is present.

## Importing the generated module

Import from the generated file path directly (a real file, not a virtual
module), so it works from any script — not only inside the Vite bundle:

```ts
import { tokens, cssVar, value, cn, allTokens } from './tailwind-theme.gen'
```

### API surface of the generated file

| Export                       | Shape / returns                          | Notes                                             |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------- |
| `tokens`                     | `tokens[namespace][key].{var,value}`     | `as const`; fully typed; primary accessor         |
| `cssVar(namespace, key)`     | `string` → `"var(--…)"`                   | typed args, typo-safe autocomplete                |
| `value(namespace, key)`      | `string` → literal value                 | typed args                                        |
| `cn`                         | `{ bg, text, border, ring, outline, fill, stroke }` | **only emitted if a `color` namespace exists**    |
| `allTokens`                  | `TokenInfo[]`                            | iterable; each has `namespace,key,name,var,value,isDefault` |
| types `Namespace`, `TokenKey<N>`, `ColorToken`, `TokenInfo` | —          | `ColorToken` only when `cn` is emitted            |

```ts
cssVar('color', 'brand')   // "var(--color-brand)"
value('spacing', '4')      // resolved spacing value
cn.bg('brand')             // "bg-brand"   (class-name builder, color tokens only)

for (const t of allTokens) {
  // t.namespace, t.key, t.name (e.g. "--color-brand"), t.var, t.value, t.isDefault
}
```

- `t.isDefault === true` → the token is a Tailwind built-in default. `false` →
  it came from the project's own `@theme`. Filter on this to show only custom
  tokens (e.g. a brand-palette explorer).
- `key` is `"DEFAULT"` for a bare namespace value like `--spacing` (i.e.
  `tokens.spacing.DEFAULT`).

## Regenerating after a theme change

If you add/change a `@theme` token, the `.gen.ts` is stale until regenerated.
Two mechanisms exist — prefer whichever the project already wires up:

- **Vite plugin** (`@adamkindberg/tailwind-typed/vite`): regenerates on
  `buildStart` and, in dev, on `@theme` changes with HMR. If the dev server is
  running, the file updates itself — no action needed.
- **CLI** (`tw-typed`), for CI / non-Vite / one-off:

```bash
tw-typed generate              # write the module (auto-detects input & out)
tw-typed generate --watch      # regenerate on CSS changes
tw-typed check                 # exit non-zero if stale — CI guard, no write
tw-typed generate -i src/app.css -o src/theme.gen.ts
```

When you edit CSS `@theme` from an agent session and the dev server is **not**
running, run `tw-typed generate` (or the project's `predev`/`prebuild` script)
before relying on the new token in TS.

## Adding a new token — the correct workflow

1. Add the custom property to the `@theme` block in the CSS entry (the file the
   project imports Tailwind from, e.g. `src/index.css`):
   ```css
   @theme {
     --color-brand: #5b21b6;
   }
   ```
2. Regenerate (Vite plugin auto-runs, or `tw-typed generate`).
3. Consume `tokens.color.brand.value` / `.var` in TS — now typed and
   autocompleted.

## Configuration & path resolution

Options merge in priority order: **explicit (CLI flag / Vite arg) > `tailwind-typed`
field in `package.json` > defaults.**

| Option   | Default                       | Meaning                              |
| -------- | ----------------------------- | ------------------------------------ |
| `input`  | auto-detected¹                | CSS entry containing `@theme`        |
| `out`    | `src/tailwind-theme.gen.ts`   | generated module path                |
| `cwd`    | `process.cwd()` / Vite root   | project root                         |
| `header` | package banner                | override the file's header comment   |

¹ Auto-detect scans common entries (`src/index.css`, `src/app.css`,
`src/styles/index.css`, `app/app.css`, `styles/globals.css`, …). If none match,
generation throws a clear error listing what was searched — set `input`
explicitly to fix it.

To find where a given project reads/writes, check (in order): the Vite plugin
call in `vite.config.*`, the `tailwind-typed` field in `package.json`, then the
default paths above.

## Gotchas that will bite you

- **`cn` may not exist.** It's only generated when the theme has a `color`
  namespace. Don't import `cn` unconditionally; guard or confirm the theme has
  colors.
- **`.var` in an isolated context renders nothing.** The #1 bug. If a color/size
  "disappears" in an OG image, email, or pre-hydration inline style, you used
  `.var` where you needed `.value`.
- **Imported `@theme` isn't followed (v1).** Only the configured entry file's
  `@theme` is read. `@theme` blocks in files pulled in via `@import` are ignored.
  Put tokens in the entry, or point `input` at the file that holds them.
- **Paired sub-properties are dropped.** Keys like `--text-lg--line-height` are
  omitted; only the primary token (`--text-lg`) is emitted. Don't expect
  `tokens.text['lg--line-height']`.
- **Namespaces are a fixed, longest-prefix-matched set** (`color`, `spacing`,
  `font`, `font-weight`, `text`, `text-shadow`, `shadow`, `inset-shadow`, `radius`,
  `breakpoint`, `container`, `max-width`, `tracking`, `leading`, `blur`, `ease`,
  `animate`, `aspect`, `perspective`, `drop-shadow`, `default`, …). A custom
  property outside these namespaces won't appear as a token.
- **Stale file after a CSS edit.** If you changed `@theme` but the dev server
  isn't running, regenerate before using the new token or TS will lack it.

## CI / verification

- `tw-typed check` exits non-zero when the generated file doesn't match the
  current theme — use it as a CI guard so a forgotten regeneration fails the
  build.
- Committing the `.gen.ts` is valid (works everywhere, zero setup). Gitignoring
  it and regenerating in `predev`/`prebuild` + guarding with `check` in CI is
  also valid. Match whatever the project already does; don't switch strategies
  unprompted.

## Programmatic API (Node, advanced)

For scripts that need the module source or the raw token set without the CLI:

```ts
import { generate, check, buildModule, resolveTheme, generateModule } from '@adamkindberg/tailwind-typed'

await generate({ cwd, input, out })   // build + write → { changed, outPath, tokenCount, inputPath, content }
await check({ cwd, input, out })      // build + compare → { upToDate, … } (no write)
const { content } = await buildModule({ input })  // module source, no write
const tokenSet = await resolveTheme({ css })      // low-level: CSS → normalized TokenSet
```

`generate`/`check`/`buildModule` return `outPath`, `inputPath`, `tokenCount`, and
`content`; `generate` adds `changed`, `check` adds `upToDate`.
