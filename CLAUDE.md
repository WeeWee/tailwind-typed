# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@adamkindberg/tailwind-typed` reads a **Tailwind v4** theme (built-in defaults + the consumer's `@theme` blocks) and generates a **self-contained** `.ts` module exposing every token as typed values — usable anywhere, including outside Tailwind/Vite (OG-image generators, emails, SSR, CI). The generated file has zero runtime dependency on this package, so consumers install it as a `devDependency`.

Package manager is **pnpm**.

## Commands

```bash
pnpm build            # tsup -> dist/ (ESM + CJS + .d.ts) for index, vite, cli
pnpm dev              # tsup --watch
pnpm test             # vitest run (all tests in test/**/*.test.ts)
pnpm test:watch       # vitest watch
pnpm typecheck        # tsc --noEmit
pnpm e2e              # node e2e/verify.mjs — requires dist/ to be built first
pnpm verify           # full gate: vitest run && tsc --noEmit && tsup && e2e
```

Run a single test file / case:
```bash
pnpm vitest run test/namespaces.test.ts
pnpm vitest run -t "part of the test name"
```

Note: `e2e/verify.mjs` exercises the **built** `dist/` (CLI, Vite plugin, tsc type-safety, a real Vite build) against a throwaway temp app. Build before running it. It creates the temp app in the OS tmpdir on purpose — Vite dislikes the spaces in this repo's own path.

## Architecture

Three public entry points, all funneling through one pipeline (see `src/index.ts` for the exported surface):

- **`src/index.ts`** — programmatic API: `generate()` (build + write), `check()` (build + compare, no write), plus low-level `buildModule`, `resolveTheme`, `generateModule`.
- **`src/vite/index.ts`** — Vite plugin (default export). Generates on `buildStart`; in dev, watches the CSS entry and regenerates on `@theme` change (HMR).
- **`src/cli/index.ts`** + **`src/cli/run.ts`** — the `tw-typed` bin. `generate` (with `--watch`) and `check` (exits non-zero when stale — a CI guard).

### The pipeline

`resolveOptions` → read CSS → `resolveTheme` → `generateModule` → `writeIfChanged`

1. **`src/config/resolveOptions.ts`** — merges explicit options, the `tailwind-typed` field in the consumer's `package.json` (lowest priority), and defaults into absolute paths. Auto-detects the CSS entry from `INPUT_CANDIDATES` when `input` is omitted.
2. **`src/core/build.ts`** (`buildModule`) — orchestrates: resolve options, read the CSS file, resolve the theme, generate the module string. Never touches the output file; callers decide to write (`generate`) or compare (`check`).
3. **`src/core/resolveTheme.ts`** — the heart. Loads Tailwind's own `tailwindcss/theme.css` defaults, concatenates the user's CSS, and runs the merged result through Tailwind's private `__unstable__loadDesignSystem` — so tokens come out exactly as Tailwind resolves them, with overrides applied. Returns a normalized `TokenSet`.
4. **`src/generate/generate.ts`** (`generateModule`) — emits the self-contained TS source: a `tokens` object (`.var` + `.value`), typed `cssVar()`/`value()` accessors, `cn` class-name builders (only when a `color` namespace exists), and an iterable `allTokens` list.
5. **`src/generate/writeFile.ts`** — `writeIfChanged` writes atomically (temp file + rename) and only when content differs. Returning `changed`/`upToDate` is what powers idempotent generation and the `check` staleness guard.

### Things that will bite you

- **Namespace detection is longest-prefix-match** (`src/core/namespaces.ts`). Several namespaces share prefixes (`font` vs `font-weight`, `text` vs `text-shadow`, `shadow` vs `inset-shadow`). `THEME_NAMESPACES` is sorted longest-first so the split lands correctly. **Adding support for a new Tailwind namespace means adding it to this list.**
- **`resolveTheme` strips `@import` rules** from the user CSS before loading — the defaults are already inlined manually, and only `@theme` data matters. Consequence (a documented v1 limitation): `@theme` blocks inside *imported* CSS files are **not** followed; only the configured entry's `@theme` is read.
- **`isDefault` comes from a Tailwind bitflag** — `DEFAULT_FLAG = 1 << 2` on `ThemeEntry.options`. Distinguishes built-in defaults from the consumer's own tokens.
- **Paired sub-properties are dropped** — keys containing `--` (e.g. `--text-lg--line-height`) are skipped; only the primary token (`--text-lg`) is kept.
- **`loadDefaultThemeCss` prefers the consumer's `tailwindcss` install** over this package's own, resolving via anchors so the generated tokens match the version they actually use.
- **Generated output is deterministically sorted** (`sortTokens`, locale + numeric-aware) so regeneration is diff-friendly and `check`-safe. Don't introduce nondeterministic ordering into the generator.

## Branching workflow

Feature/fix branches merge up through `dev`, then `dev` merges to `main`. Never commit directly to `dev` or `main`.

```
feat/*  ─┐
fix/*   ─┼─▶ dev ─▶ main
```

- Branch from `dev` (not `main`) for new work; name it `feat/<slug>` or `fix/<slug>`.
- Open PRs into `dev`. `main` receives changes only via a `dev` → `main` promotion.
- `main` is the release branch — keep it green (run `pnpm verify` before promoting).

**Merge strategy** — squash short-lived branches, merge-commit long-lived ones. Squash/rebase rewrite SHAs: harmless for a branch deleted right after, but between two branches that both keep living it diverges their histories and every later promotion shows phantom diffs.

- `feat/*` / `fix/*` → `dev`: **Squash and merge** (`gh pr merge <n> --squash`) — one clean commit per feature.
- `dev` → `main`: **Create a merge commit** (`gh pr merge <n> --merge`) — both branches live on, so they stay on shared history.
- A revert PR follows its target: reverting on `dev` → **squash** (the revert branch is short-lived).

## Build/config notes

- `tsup.config.ts` builds three entries (`index`, `vite`, `cli`) as both ESM and CJS with `.d.ts`. `cli.js` gets a shebang and is the `tw-typed` bin.
- `tailwindcss` is a **peer dependency** (v4); `vite` is an optional peer. Both are also devDeps for tests/e2e.
- `tsconfig.json` is strict with `noUnusedLocals`/`noUnusedParameters`/`verbatimModuleSyntax` — keep imports type-only where applicable.
