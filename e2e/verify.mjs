// End-to-end verification of the BUILT package (dist/). Run: node e2e/verify.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const pkgDir = path.resolve(import.meta.dirname, '..')
const cliJs = path.join(pkgDir, 'dist', 'cli.js')
const viteJs = path.join(pkgDir, 'dist', 'vite.js')
const tscBin = path.join(pkgDir, 'node_modules', 'typescript', 'bin', 'tsc')

const results = []
const ok = (name) => results.push(['✓', name])
const fail = (name, err) => results.push(['✗', `${name} — ${err?.message ?? err}`])
async function step(name, fn) {
  try {
    await fn()
    ok(name)
  } catch (err) {
    fail(name, err)
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

// Fresh temp app (no spaces in path, so Vite is happy)
const app = mkdtempSync(path.join(os.tmpdir(), 'tw-typed-e2e-'))
mkdirSync(path.join(app, 'src'), { recursive: true })
writeFileSync(
  path.join(app, 'src', 'app.css'),
  '@import "tailwindcss";\n@theme {\n  --color-brand: #5b21b6;\n}\n',
  'utf8',
)
const genPath = path.join(app, 'src', 'theme.gen.ts')

await step('CLI generate writes a typed module with defaults + custom token', () => {
  execFileSync(process.execPath, [cliJs, 'generate', '--cwd', app, '--input', 'src/app.css', '--out', 'src/theme.gen.ts'], { stdio: 'pipe' })
  assert(existsSync(genPath), 'theme.gen.ts not created')
  const src = readFileSync(genPath, 'utf8')
  assert(src.includes('var(--color-brand)'), 'missing custom brand token')
  assert(src.includes('#5b21b6'), 'missing brand value')
  assert(src.includes('"red-500"'), 'missing a Tailwind default (red-500)')
})

await step('CLI check: exit 0 when fresh, exit 1 when stale', () => {
  execFileSync(process.execPath, [cliJs, 'check', '--cwd', app, '--input', 'src/app.css', '--out', 'src/theme.gen.ts'], { stdio: 'pipe' })
  writeFileSync(genPath, '// stale', 'utf8')
  let exitCode = 0
  try {
    execFileSync(process.execPath, [cliJs, 'check', '--cwd', app, '--input', 'src/app.css', '--out', 'src/theme.gen.ts'], { stdio: 'pipe' })
  } catch (e) {
    exitCode = e.status
  }
  assert(exitCode === 1, `expected check to exit 1 when stale, got ${exitCode}`)
  // regenerate for the following steps
  execFileSync(process.execPath, [cliJs, 'generate', '--cwd', app, '--input', 'src/app.css', '--out', 'src/theme.gen.ts'], { stdio: 'pipe' })
})

await step('Out-of-Vite: a plain Node process can import the generated module and read values', async () => {
  const tsSrc = readFileSync(genPath, 'utf8')
  const js = ts.transpileModule(tsSrc, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const mjs = path.join(app, 'src', 'theme.gen.mjs')
  writeFileSync(mjs, js, 'utf8')
  const mod = await import(pathToFileURL(mjs).href)
  assert(mod.tokens.color.brand.value === '#5b21b6', `brand value wrong: ${mod.tokens.color.brand.value}`)
  assert(mod.cssVar('color', 'brand') === 'var(--color-brand)', 'cssVar wrong')
  assert(typeof mod.cn.bg('brand') === 'string' && mod.cn.bg('brand') === 'bg-brand', 'cn.bg wrong')
  assert(Array.isArray(mod.allTokens) && mod.allTokens.length > 100, 'allTokens missing')
})

await step('Type-safety: tsc accepts a valid token and rejects an unknown one', () => {
  const goodFile = path.join(app, 'src', 'good.ts')
  const badFile = path.join(app, 'src', 'bad.ts')
  writeFileSync(goodFile, `import { cssVar } from './theme.gen'\nexport const a = cssVar('color', 'brand')\n`, 'utf8')
  writeFileSync(badFile, `import { cssVar } from './theme.gen'\nexport const a = cssVar('color', 'nope-not-real')\n`, 'utf8')
  const flags = ['--noEmit', '--strict', '--target', 'es2022', '--lib', 'es2022', '--moduleResolution', 'bundler', '--module', 'esnext']

  // good compiles
  execFileSync(process.execPath, [tscBin, ...flags, goodFile, genPath], { stdio: 'pipe' })

  // bad fails
  let failed = false
  try {
    execFileSync(process.execPath, [tscBin, ...flags, badFile, genPath], { stdio: 'pipe' })
  } catch {
    failed = true
  }
  assert(failed, 'tsc should have rejected the unknown token')
})

await step('Real Vite build invokes the plugin and generates the module', async () => {
  rmSync(genPath, { force: true })
  const { build } = await import(pathToFileURL(path.join(pkgDir, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href)
  const { default: tailwindTyped } = await import(pathToFileURL(viteJs).href)
  writeFileSync(path.join(app, 'main.js'), 'console.log("app")\n', 'utf8')

  await build({
    root: app,
    configFile: false,
    logLevel: 'silent',
    plugins: [tailwindTyped({ cwd: app, input: 'src/app.css', out: 'src/theme.gen.ts' })],
    build: { write: false, emptyOutDir: false, rollupOptions: { input: path.join(app, 'main.js') } },
  })

  assert(existsSync(genPath), 'plugin did not generate theme.gen.ts during vite build')
  assert(readFileSync(genPath, 'utf8').includes('var(--color-brand)'), 'generated file missing brand token')
})

// Report
console.log('\nE2E verification:')
for (const [mark, name] of results) console.log(`  ${mark} ${name}`)
rmSync(app, { recursive: true, force: true })
const failures = results.filter(([m]) => m === '✗').length
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll E2E checks passed ✓')
process.exit(failures ? 1 : 0)
