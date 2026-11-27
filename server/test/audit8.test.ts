import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { app } from '../src/http/routes.js'
import { closeRealtime } from '../src/realtime.js'
import { rasterOf } from '../src/http/files.js'
import { addressOf, fromCloudflare, proxyHops } from '../src/http/limits.js'
import { nextUrl } from '../src/http/preview.js'
import { hostHears } from '../src/listening.js'
import { oddPath, serveFiles } from '../src/http/statics.js'
import type { AuthContext } from '../src/auth/context.js'
import { closeDb, makeOwner, makeProject } from './helpers.js'

/*
 * The eighth audit. What is the
 * core's: pictures by their bytes, the built files' guards, who is asking
 * by address, a redirect that is no address, a word on `/ws/me`, a key
 * that does not decode. What is a workspace's own domain's is
 * `cloud/audit8.test.ts`.
 */

after(async () => {
  await closeRealtime()
  await closeDb()
})

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) =>
  c.charCodeAt(0),
)
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>')

async function upload(path: string, token: string, bytes: Uint8Array<ArrayBuffer>, type: string) {
  const form = new FormData()
  form.append('file', new File([bytes], 'picture.png', { type }))
  const r = await app.request(path, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as { error?: { code?: string } } }
}

/* ----------------------------------------------------------- finding 1 */

test('a picture is a picture by its bytes: four raster kinds, never an SVG whatever the form says', () => {
  assert.equal(rasterOf(PNG), 'image/png')
  assert.equal(rasterOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(rasterOf(new TextEncoder().encode('GIF89a')), 'image/gif')
  assert.equal(rasterOf(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp')
  assert.equal(rasterOf(SVG), null)
  assert.equal(rasterOf(new TextEncoder().encode('%PDF-1.7')), null)
  assert.equal(rasterOf(new TextEncoder().encode('<html><script>x</script></html>')), null)
  assert.equal(rasterOf(new Uint8Array()), null)
})

test('a face and a project’s picture are refused as an SVG sent as image/png, and taken as a PNG sent as anything', async () => {
  const owner = await makeOwner()
  const project = await makeProject(owner.ctx, owner.workspaceId, 'Pictured')
  for (const path of ['/api/me/avatar', `/api/projects/${project}/icon`]) {
    const svg = await upload(path, owner.token, SVG, 'image/png')
    assert.equal(svg.status, 400, path)
    assert.equal(svg.body.error?.code, 'invalid')
    assert.equal((await upload(path, owner.token, SVG, 'image/svg+xml')).status, 400, path)
    assert.equal((await upload(path, owner.token, PNG, 'application/octet-stream')).status, 200, path)
  }
})

/* ----------------------------------------------------------- finding 5 */

test('an address that spells a dot, a slash, a backslash or a percent sign encoded is odd; ordinary ones are not', () => {
  for (const url of [
    'http://x/auth/%2e%2e/index.html',
    'http://x/auth/%252e%252e/index.html',
    'http://x/api/..%2findex.html',
    'http://x/assets/%5c..%5cindex.html',
    'http://x/%2561ssets/a.js',
    'http://x/a/%00',
    'http://x/a/../b',
    'http://x/a/./b',
  ]) {
    assert.equal(oddPath(url), true, url)
  }
  for (const url of [
    'http://x/',
    'http://x/studio/website/tasks/41',
    'http://x/assets/index-abc.js',
    'http://x/studio/search?q=%2e%2e%2f',
    'http://x/d/AbC_-123',
    'http://x/caf%C3%A9',
    'http://x/a..b/c',
  ]) {
    assert.equal(oddPath(url), false, url)
  }
})

test('the built files: an encoded path is not found, and a file found carries the guard rails whatever its address starts with', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tuff-statics-'))
  try {
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>Tuff</title>')
    mkdirSync(join(root, 'auth'))
    writeFileSync(join(root, 'auth', 'page.html'), '<!doctype html><title>Under auth</title>')
    const guarded = { 'content-security-policy': "default-src 'self'", 'x-frame-options': 'DENY' }
    const site = new Hono()
    /* As `main.ts` adds them: by path, leaving the API, the doors and the
       socket alone. */
    site.use('*', async (c, next) => {
      await next()
      if (/^\/(api|auth|ws)(\/|$)/.test(c.req.path)) return
      for (const [k, v] of Object.entries(guarded)) c.header(k, v)
    })
    serveFiles(site, root, () => guarded)
    site.notFound((c) => {
      for (const [k, v] of Object.entries(guarded)) c.header(k, v)
      return c.html('<!doctype html><title>Tuff</title>')
    })

    for (const path of [
      '/auth/%2e%2e/index.html',
      '/auth/%252e%252e/index.html',
      '/auth/%2e%2e%2findex.html',
      '/api/%252e%252e/index.html',
      '/ws/%2E%2E/index.html',
      '/auth/..%5cindex.html',
      '/%2561uth/page.html',
    ]) {
      const r = await site.request(path)
      const text = await r.text()
      /* Never the page without its guard rails. */
      if (text.includes('<title>')) assert.equal(r.headers.get('content-security-policy'), guarded['content-security-policy'], path)
      else assert.equal(r.status, 404, path)
    }
    assert.equal((await site.request('/auth/%252e%252e/index.html')).status, 404)
    /* A file under a bare prefix is served with them too. */
    const under = await site.request('/auth/page.html')
    assert.equal(under.status, 200)
    assert.equal(under.headers.get('content-security-policy'), guarded['content-security-policy'])
    assert.equal(under.headers.get('x-frame-options'), 'DENY')
    const index = await site.request('/index.html')
    assert.equal(index.status, 200)
    assert.equal(index.headers.get('content-security-policy'), guarded['content-security-policy'])
    /* And the API's not found is still the API's. */
    const api = await site.request('/api/%2e%2e%2fx')
    assert.equal(api.status, 404)
    assert.match(api.headers.get('content-type') ?? '', /json/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

/* ----------------------------------------------------------- finding 7 */

test('who is asking: the entry PROXY_HOPS from the end, two by default, as Railway and the bundled Caddy want', () => {
  assert.equal(proxyHops(undefined), 2)
  assert.equal(proxyHops(''), 2)
  assert.equal(proxyHops('1'), 1)
  assert.equal(proxyHops('3'), 3)
  for (const bad of ['0', '-1', '1.5', 'two', '11']) assert.equal(proxyHops(bad), 2, bad)
  // Railway: the connector, then its edge.
  assert.equal(addressOf('203.0.113.9, 10.0.0.1', undefined, 2), '203.0.113.9')
  assert.equal(addressOf('spoofed, 203.0.113.9, 10.0.0.1', undefined, 2), '203.0.113.9')
  // Caddy, replacing the header with one entry.
  assert.equal(addressOf('203.0.113.9', undefined, 2), '203.0.113.9')
  assert.equal(addressOf(undefined, undefined, 2), 'local')
  // A proxy that appends one: the client's own entry is not the address.
  assert.equal(addressOf('198.51.100.1, 203.0.113.9', undefined, 1), '203.0.113.9')
  assert.equal(addressOf('203.0.113.9', undefined, 1), '203.0.113.9')
  // The default is read from the environment.
  const was = process.env.PROXY_HOPS
  try {
    process.env.PROXY_HOPS = '1'
    assert.equal(addressOf('198.51.100.1, 203.0.113.9'), '203.0.113.9')
    delete process.env.PROXY_HOPS
    assert.equal(addressOf('198.51.100.1, 203.0.113.9'), '198.51.100.1')
  } finally {
    if (was === undefined) delete process.env.PROXY_HOPS
    else process.env.PROXY_HOPS = was
  }
})

test('Cloudflare’s IPv6 block is 2a06:98c0::/29, and nothing else beginning 2a06:98', () => {
  for (const ip of ['2a06:98c0::1', '2A06:98C7:ffff::1', '2a06:98c3:1:2::3', '2606:4700::6810:84e5'])
    assert.equal(fromCloudflare(ip), true, ip)
  for (const ip of ['2a06:98c8::1', '2a06:9800::1', '2a06:98ff::1', '2a06:98bf::1', '2001:db8::1'])
    assert.equal(fromCloudflare(ip), false, ip)
  // So a header naming somebody is believed only from the real block.
  assert.equal(addressOf('2a06:9801::1, 10.0.0.1', '198.51.100.7', 2), '2a06:9801::1')
  assert.equal(addressOf('2a06:98c1::1, 10.0.0.1', '198.51.100.7', 2), '198.51.100.7')
})

/* ----------------------------------------------------------- finding 8 */

test('a redirect whose Location is no address ends the preview, it does not throw', () => {
  const from = new URL('https://site.example/a')
  assert.equal(nextUrl('http://exa mple.com/', from), null)
  assert.equal(nextUrl('https://[::1', from), null)
  assert.equal(nextUrl('/b?c=1', from)?.href, 'https://site.example/b?c=1')
})

test('a key that does not decode is not found, not an error', async () => {
  const r = await app.request('/api/blob/%E0%A4%A?token=x')
  assert.equal(r.status, 404)
})

/* ----------------------------------------------------------- finding 4 */

test('a session made on a workspace’s own domain hears on /ws/me only the words of its workspace', () => {
  const ctx = { workspaceId: 'w-1', host: 'projects.agency.example' } as AuthContext
  assert.equal(hostHears(ctx, { kind: 'message', payload: { conversation_id: 'c', workspace_id: 'w-1' } }), true)
  assert.equal(hostHears(ctx, { kind: 'notification', payload: { object_type: 'task', object_id: 't', workspace_id: 'w-2' } }), false)
  assert.equal(hostHears(ctx, { kind: 'read', payload: {} }), false)
  assert.equal(hostHears(ctx, { kind: 'read', payload: null }), false)
})
