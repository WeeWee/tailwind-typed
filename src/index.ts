import { writeIfChanged, readIfExists } from './generate/writeFile'
import { buildModule } from './core/build'
import type { BuildResult } from './core/build'
import type { TailwindTypedOptions } from './config/resolveOptions'

export interface GenerateResult extends BuildResult {
  /** Whether the output file was created or changed by this call. */
  changed: boolean
}

export interface CheckResult extends BuildResult {
  /** Whether the existing output file already matches what would be generated. */
  upToDate: boolean
}

/** Build the typed theme module and write it to disk (only if changed). */
export async function generate(options: TailwindTypedOptions = {}): Promise<GenerateResult> {
  const result = await buildModule(options)
  const changed = writeIfChanged(result.outPath, result.content)
  return { ...result, changed }
}

/** Build the typed theme module and compare it to the file on disk without writing. */
export async function check(options: TailwindTypedOptions = {}): Promise<CheckResult> {
  const result = await buildModule(options)
  const upToDate = readIfExists(result.outPath) === result.content
  return { ...result, upToDate }
}

// --- Advanced / programmatic API ---
export { buildModule }
export { resolveTheme } from './core/resolveTheme'
export { generateModule } from './generate/generate'
export { resolveOptions } from './config/resolveOptions'
export { splitVarName } from './core/namespaces'
export { writeIfChanged, readIfExists } from './generate/writeFile'

export type { BuildResult }
export type { ResolveThemeOptions } from './core/resolveTheme'
export type { GenerateOptions } from './generate/generate'
export type { TailwindTypedOptions, ResolvedOptions } from './config/resolveOptions'
export type { Token, TokenSet } from './core/types'
export type { VarParts } from './core/namespaces'
