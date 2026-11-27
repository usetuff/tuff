import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * The seam holds.
 *
 * The community edition is this tree without its `cloud/` folders, with
 * `edition.community.*` copied over `edition.*`. That builds only if
 * nothing else in the core reaches into a `cloud/` folder: one import
 * from `routes.ts` straight into one and the edition does
 * not compile. So every file outside `cloud/` is read here, and any import
 * that lands inside one is named — except from `edition.ts`,
 * `edition.tsx` and `edition.front.tsx`, which are the doors.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TREES = ['server/src', 'server/test', 'server/scripts', 'web/src', 'web/test', 'web/scripts', 'shared-schema/src', 'e2e', 'scripts']
const DOORS = new Set(['server/src/edition.ts', 'web/src/edition.tsx', 'web/src/edition.front.tsx'])

function walk(dir: string, out: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

const inCloud = (p: string) => p.split(sep).includes('cloud')

test('nothing outside a cloud folder imports from one, but the edition', () => {
  const crossings: string[] = []
  for (const tree of TREES) {
    for (const file of walk(join(root, tree))) {
      const rel = relative(root, file).split(sep).join('/')
      if (inCloud(file) || DOORS.has(rel)) continue
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const target = resolve(dirname(file), m[1]!)
        if (inCloud(target)) crossings.push(`${rel} → ${m[1]}`)
      }
    }
  }
  assert.deepEqual(crossings, [], 'only edition.ts, edition.tsx and edition.front.tsx may import from a cloud/ folder')
})
