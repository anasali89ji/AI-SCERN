#!/usr/bin/env node
/**
 * ADMIN-B1 regression guard.
 *
 * Fails (exit 1) if any admin API route handler calls requireAdmin without a
 * permission argument, or if the middleware permission map loses the
 * content:moderate grant for the admin role or the deny-by-default fallback.
 *
 * Run: node admin/scripts/verify-rbac.mjs   (from repo root or admin/)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const adminRoot = join(here, '..')
const apiRoot = join(adminRoot, 'app', 'api')

function* routeFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* routeFiles(full)
    else if (entry === 'route.ts' || entry === 'route.tsx') yield full
  }
}

let failures = 0
let checked = 0

for (const file of routeFiles(apiRoot)) {
  const src = readFileSync(file, 'utf8')

  // Routes that do not use requireAdmin at all are (by design) unauthenticated
  // here (e.g. auth login, log-client-error). Only guard requireAdmin users.
  if (!src.includes('requireAdmin')) continue
  checked++

  const bare = []
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    if (/requireAdmin\(req\)(?!,)/.test(line)) bare.push(i + 1)
  })
  if (bare.length) {
    failures++
    console.error(
      `FAIL ${relative(adminRoot, file)}: bare requireAdmin(req) at line(s) ${bare.join(', ')} — add a permission argument`
    )
  }
}

// Middleware invariants
const mw = readFileSync(join(adminRoot, 'lib', 'admin-middleware.ts'), 'utf8')
if (!/admin:\s*\[[^\]]*'content:moderate'[^\]]*\]/.test(mw)) {
  failures++
  console.error('FAIL lib/admin-middleware.ts: admin role lost the content:moderate grant')
}
if (!/adminId === 'legacy' \? 'super_admin' : \(admin\?\.role \|\| 'viewer'\)/.test(mw)) {
  failures++
  console.error('FAIL lib/admin-middleware.ts: role fallback must be legacy=>super_admin, otherwise deny (viewer)')
}

if (failures) {
  console.error(`\n${failures} RBAC check(s) failed (${checked} route files checked).`)
  process.exit(1)
}
console.log(`RBAC OK: ${checked} route files checked, all requireAdmin calls permission-scoped, middleware invariants hold.`)
