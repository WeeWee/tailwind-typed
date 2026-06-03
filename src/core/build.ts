import { readFileSync } from 'node:fs'
import { resolveOptions, type TailwindTypedOptions } from '../config/resolveOptions'
import { resolveTheme } from './resolveTheme'
import { generateModule } from '../generate/generate'

export interface BuildResult {
  /** The generated TypeScript module source. */
  content: string
  /** Absolute path the module should be written to. */
  outPath: string
  /** Absolute path of the CSS entry that was read. */
  inputPath: string
  /** Number of tokens resolved. */
  tokenCount: number
}

/**
 * Resolve options, read the CSS entry, resolve the theme, and generate the
 * module source. Does not touch the output file — callers decide whether to
 * write (generate) or compare (check).
 */
export async function buildModule(options: TailwindTypedOptions = {}): Promise<BuildResult> {
  const resolved = resolveOptions(options)
  const css = readFileSync(resolved.input, 'utf8')
  const tokenSet = await resolveTheme({ css, base: resolved.cwd })
  const content = generateModule(tokenSet, { header: resolved.header })

  return {
    content,
    outPath: resolved.out,
    inputPath: resolved.input,
    tokenCount: tokenSet.tokens.length,
  }
}
