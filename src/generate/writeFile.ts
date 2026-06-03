import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Read a file's contents, or `null` if it does not exist. */
export function readIfExists(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * Write `content` to `file` only if it differs from what is already there.
 * Creates missing parent directories and writes atomically (temp file + rename)
 * so a crash never leaves a half-written file. Returns `true` when the file was
 * created or changed, `false` when it was already up to date.
 */
export function writeIfChanged(file: string, content: string): boolean {
  if (readIfExists(file) === content) return false

  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, file)
  return true
}
