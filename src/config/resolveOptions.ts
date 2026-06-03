import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface TailwindTypedOptions {
  /** Path (relative to `cwd`) to the CSS entry containing your `@theme`. Auto-detected when omitted. */
  input?: string
  /** Path (relative to `cwd`) for the generated module. Defaults to `src/tailwind-theme.gen.ts`. */
  out?: string
  /** Project root. Defaults to `process.cwd()`. */
  cwd?: string
  /** Override the header comment in the generated file. */
  header?: string
}

export interface ResolvedOptions {
  cwd: string
  /** Absolute path to the resolved CSS entry. */
  input: string
  /** Absolute path to the generated module. */
  out: string
  header?: string
}

const DEFAULT_OUT = 'src/tailwind-theme.gen.ts'

/** Common Tailwind v4 CSS entry locations, in priority order. */
const INPUT_CANDIDATES = [
  'src/index.css',
  'src/app.css',
  'src/main.css',
  'src/styles.css',
  'src/styles/index.css',
  'src/styles/app.css',
  'src/styles/globals.css',
  'app/app.css',
  'app/tailwind.css',
  'app/globals.css',
  'styles/globals.css',
  'index.css',
  'app.css',
]

/** Read the `tailwind-typed` field from the project's package.json, if any. */
function readPackageJsonOptions(cwd: string): TailwindTypedOptions {
  const pkgPath = path.join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return {}
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    const field = pkg['tailwind-typed']
    return field && typeof field === 'object' ? (field as TailwindTypedOptions) : {}
  } catch {
    return {}
  }
}

function resolveInput(cwd: string, input: string | undefined): string {
  if (input) {
    const abs = path.resolve(cwd, input)
    if (!existsSync(abs)) {
      throw new Error(`[tailwind-typed] Input CSS not found: "${input}" (resolved to ${abs}).`)
    }
    return abs
  }

  for (const candidate of INPUT_CANDIDATES) {
    const abs = path.resolve(cwd, candidate)
    if (existsSync(abs)) return abs
  }

  throw new Error(
    `[tailwind-typed] Could not auto-detect your Tailwind CSS entry. ` +
      `Set "input" via the CLI (--input), the Vite plugin option, or the "tailwind-typed" field in package.json. ` +
      `Looked for: ${INPUT_CANDIDATES.join(', ')}.`,
  )
}

/** Merge explicit options, package.json config, and defaults into fully-resolved absolute paths. */
export function resolveOptions(explicit: TailwindTypedOptions = {}): ResolvedOptions {
  const cwd = explicit.cwd ?? process.cwd()
  const fromPkg = readPackageJsonOptions(cwd)

  return {
    cwd,
    input: resolveInput(cwd, explicit.input ?? fromPkg.input),
    out: path.resolve(cwd, explicit.out ?? fromPkg.out ?? DEFAULT_OUT),
    header: explicit.header ?? fromPkg.header,
  }
}
