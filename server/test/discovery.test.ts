import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { app } from '../src/http/routes.js'
import { ABOUT } from '../src/mcp/tools.js'
import { env } from '../src/env.js'
import { closeDb } from './helpers.js'

/* Where an agent finds the API and the MCP server. */

after(async () => {
  await closeDb()
})

type Link = { href: string; type?: string }
type Catalog = { linkset: ({ anchor: string } & Record<string, Link[] | string>)[] }

test('the API catalog lists the REST API and the MCP server, as RFC 9727 says', async () => {
  const res = await app.request('/.well-known/api-catalog')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"')
  assert.match(res.headers.get('link') ?? '', /<[^>]*\/\.well-known\/api-catalog>; rel="api-catalog"/)
  const { linkset } = (await res.json()) as Catalog
  const self = linkset.find((l) => l.anchor.endsWith('/.well-known/api-catalog'))!
  const at = self.anchor.replace(/\/\.well-known\/api-catalog$/, '')
  /* Each API is named by an address on the server asked, never another's. */
  assert.deepEqual(
    (self.item as Link[]).map((l) => l.href),
    [`${at}/api`, `${at}/mcp`],
  )
  const api = linkset.find((l) => l.anchor === `${at}/api`)!
  assert.equal(
    (api['service-desc'] as Link[])[0]!.href,
    'https://raw.githubusercontent.com/usetuff/tuff/main/shared-schema/generated/api.schema.json',
  )
  assert.equal((api['service-doc'] as Link[])[0]!.href, 'https://github.com/usetuff/tuff/blob/main/docs/api.md')
  assert.equal((api.status as Link[])[0]!.href, `${at}/health`)
  const mcp = linkset.find((l) => l.anchor === `${at}/mcp`)!
  assert.ok(
    (mcp['service-doc'] as Link[]).some((l) => l.href === `${at}/.well-known/agent-skills/tuff/SKILL.md` && l.type === 'text/markdown'),
  )
  assert.equal((mcp['service-meta'] as Link[])[0]!.href, `${at}/.well-known/oauth-protected-resource/mcp`)
})

test('a HEAD of the catalog carries its relation and no body', async () => {
  const res = await app.request('/.well-known/api-catalog', { method: 'HEAD' })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('link') ?? '', /rel="api-catalog"/)
  assert.equal(await res.text(), '')
})

test('the skills index names one skill, whose digest is of the bytes it answers', async () => {
  const res = await app.request('/.well-known/agent-skills/index.json')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/)
  const index = (await res.json()) as {
    $schema: string
    skills: { name: string; type: string; description: string; url: string; digest: string }[]
  }
  assert.equal(index.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json')
  assert.equal(index.skills.length, 1)
  const [skill] = index.skills
  assert.equal(skill!.name, 'tuff')
  assert.equal(skill!.type, 'skill-md')
  assert.equal(skill!.url, '/.well-known/agent-skills/tuff/SKILL.md')
  assert.ok(skill!.description.length > 0 && skill!.description.length <= 1024)

  const file = await app.request(skill!.url)
  assert.equal(file.status, 200)
  assert.equal(file.headers.get('content-type'), 'text/markdown; charset=utf-8')
  const bytes = Buffer.from(await file.arrayBuffer())
  assert.equal(skill!.digest, `sha256:${createHash('sha256').update(bytes).digest('hex')}`)
})

test('the skill says how to connect, and lists exactly the tools the server has', async () => {
  const text = await (await app.request('/.well-known/agent-skills/tuff/SKILL.md')).text()
  /* The front matter a skill is read by: a lowercase name, a description. */
  const front = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/.exec(text)
  assert.ok(front, 'front matter')
  assert.equal(front[1], 'tuff')
  assert.ok(front[2]!.length <= 1024)
  const at = /This server is at (\S+)\.$/m.exec(text)?.[1]
  assert.ok(at)
  assert.ok(text.includes(`claude mcp add --transport http tuff ${at}/mcp`))
  const listed = [...text.matchAll(/^- `([a-z_]+)` — /gm)].map((m) => m[1])
  assert.deepEqual(listed, Object.keys(ABOUT))
  /* What the server tells an agent when it connects, said here too. */
  assert.ok(text.includes('Never build or guess an address.'))
})

/*
 * The addresses are this server's as the world reaches it, never the
 * request's `Host`: a catalog naming `attacker.example/mcp` would send an
 * agent to sign in somewhere else (`publicUrl.ts`).
 */
test('in production every address said is APP_URL, whatever Host the request names', async () => {
  const was = { node: process.env.NODE_ENV, appUrl: env.appUrl }
  process.env.NODE_ENV = 'production'
  env.appUrl = 'https://tuff.example.com'
  try {
    const hostile = { host: 'attacker.example', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'attacker.example' }
    for (const path of [
      '/.well-known/api-catalog',
      '/.well-known/agent-skills/index.json',
      '/.well-known/agent-skills/tuff/SKILL.md',
      '/.well-known/ard.json',
      '/.well-known/ai-catalog.json',
    ]) {
      const said = await (await app.request(`http://attacker.example${path}`, { headers: hostile })).text()
      assert.doesNotMatch(said, /attacker/, path)
      assert.match(said, /https:\/\/tuff\.example\.com\/mcp/, path)
    }
  } finally {
    process.env.NODE_ENV = was.node
    env.appUrl = was.appUrl
  }
})

/*
 * Agentic Resource Discovery's manifest, as its schema (v0.91) and
 * Lighthouse's check of it ask: entries, each with an identifier of the
 * `urn:air:<domain>:…` form, a name, a media type and exactly one of `url`
 * or `data`, and two to five queries it answers. At its old name too,
 * which Lighthouse still asks for and which answered the app's page.
 */
test('the ARD manifest names the MCP server and the skill, at both its names', async () => {
  const URN =
    /^urn:air:[a-zA-Z0-9.-]+:(?:[a-zA-Z0-9._~!$&'()*+,;=@/-]|%[0-9a-fA-F]{2})+(:(?:[a-zA-Z0-9._~!$&'()*+,;=@/-]|%[0-9a-fA-F]{2})+)?$/
  for (const path of ['/.well-known/ard.json', '/.well-known/ai-catalog.json']) {
    const res = await app.request(path)
    assert.equal(res.status, 200, path)
    assert.match(res.headers.get('content-type') ?? '', /^application\/json/, path)
    const { entries } = (await res.json()) as {
      entries: { identifier: string; displayName: string; type: string; url?: string; data?: object; representativeQueries: string[] }[]
    }
    assert.equal(entries.length, 2, path)
    for (const e of entries) {
      assert.match(e.identifier, URN, e.identifier)
      assert.ok(e.displayName, e.identifier)
      assert.ok((e.url === undefined) !== (e.data === undefined), `${e.identifier}: exactly one of url or data`)
      assert.ok(e.representativeQueries.length >= 2 && e.representativeQueries.length <= 5, e.identifier)
    }
    const mcp = entries.find((e) => e.type === 'application/mcp-server-card+json')!
    assert.match((mcp.data as { url: string }).url, /\/mcp$/)
    const skills = entries.find((e) => e.type === 'application/agent-skills+json')!
    assert.match(skills.url!, /\/\.well-known\/agent-skills\/index\.json$/)
  }
})
