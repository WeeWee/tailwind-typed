import { parseArgs } from 'node:util'
import { watch as fsWatch, readFileSync } from 'node:fs'
import { generate, check } from '../index'

const HELP = `tw-typed — generate typed access to your Tailwind v4 theme

Usage:
  tw-typed [generate] [options]   Generate the typed theme module (default command)
  tw-typed check [options]        Exit non-zero if the generated module is out of date (CI guard)

Options:
  -i, --input <file>   CSS entry containing your @theme (auto-detected if omitted)
  -o, --out <file>     Output module path (default: src/tailwind-theme.gen.ts)
      --cwd <dir>      Project root (default: current directory)
  -w, --watch          Regenerate on changes to the CSS entry (generate only)
  -h, --help           Show this help
      --version        Show version
`

function getVersion(): string {
  // dist/cli.js -> ../package.json; src/cli/run.ts -> ../../package.json
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      return JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')).version as string
    } catch {
      /* try next location */
    }
  }
  return 'unknown'
}

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

/** Run the CLI with the given argv (without node/script). Returns a process exit code. */
export async function runCli(argv: string[]): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        input: { type: 'string', short: 'i' },
        out: { type: 'string', short: 'o' },
        cwd: { type: 'string' },
        watch: { type: 'boolean', short: 'w' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean' },
      },
    })
  } catch (err) {
    console.error(`[tailwind-typed] ${(err as Error).message}`)
    return 1
  }

  const { values, positionals } = parsed
  if (values.help) {
    console.log(HELP)
    return 0
  }
  if (values.version) {
    console.log(getVersion())
    return 0
  }

  const command = positionals[0] ?? 'generate'
  const options = { cwd: values.cwd, input: values.input, out: values.out }

  try {
    if (command === 'generate') {
      const result = await generate(options)
      console.log(
        `[tailwind-typed] ${result.changed ? 'Generated' : 'Up to date'} ${result.outPath} (${result.tokenCount} tokens).`,
      )
      if (values.watch) {
        await runWatch(options, result.inputPath)
      }
      return 0
    }

    if (command === 'check') {
      const result = await check(options)
      if (result.upToDate) {
        console.log(`[tailwind-typed] Up to date: ${result.outPath}.`)
        return 0
      }
      console.error(
        `[tailwind-typed] Out of date: ${result.outPath} does not match your theme. Run "tw-typed generate".`,
      )
      return 1
    }

    console.error(`[tailwind-typed] Unknown command "${command}". Run "tw-typed --help".`)
    return 1
  } catch (err) {
    console.error(`[tailwind-typed] ${(err as Error).message}`)
    return 1
  }
}

/** Watch the CSS entry and regenerate on change. Never resolves (until the process is killed). */
function runWatch(options: { cwd?: string; input?: string; out?: string }, inputPath: string): Promise<number> {
  console.log(`[tailwind-typed] Watching ${inputPath} for changes…`)
  const regenerate = debounce(() => {
    generate(options)
      .then((r) => {
        if (r.changed) console.log(`[tailwind-typed] Regenerated ${r.outPath} (${r.tokenCount} tokens).`)
      })
      .catch((err) => console.error(`[tailwind-typed] ${(err as Error).message}`))
  }, 50)

  fsWatch(inputPath, { persistent: true }, regenerate)
  return new Promise<number>(() => {
    /* run until the process is terminated */
  })
}
