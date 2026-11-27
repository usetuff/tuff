import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { addCookies } from '../src/http/afterward.js'

/*
 * Through the real adapter, not `app.request`: the cookie was lost only
 * where `@hono/node-server` had swapped the global `Response`, and the app's
 * `cors` — outside, adding `Vary` after the answer — is what dropped it.
 * A GET with no `Origin` is what a browser sends to its own site.
 */
test('a cookie added after the answer reaches a GET with no Origin, behind cors', async () => {
  const app = new Hono()
  app.use('*', cors({ origin: (o) => o ?? '*', credentials: false }))
  app.use('/appended/*', async (c, next) => {
    await next()
    c.res.headers.append('set-cookie', 'a=1; Path=/')
  })
  app.use('/added/*', async (c, next) => {
    await next()
    addCookies(c, ['a=1; Path=/api/blob', 'a=1; Path=/api/preview/image'])
  })
  app.get('/appended/me', (c) => c.json({ ok: true }))
  /* An answer that sets a cookie of its own keeps it, and gets the two. */
  app.get('/added/own', (c) => {
    c.header('set-cookie', 'own=1; Path=/', { append: true })
    return c.json({ ok: true })
  })
  app.get('/added/none', (c) => c.body(null, 204))
  app.get('/added/me', (c) => c.json({ ok: true }))
  app.post('/added/me', (c) => c.json({ made: true }, 201))

  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
  await new Promise((done) => server.once('listening', done))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    /* The fault this was kept for is gone: `@hono/node-server` 2 no longer
       loses a cookie appended after the answer. `addCookies` stays — it is
       right on either adapter — and this says so, so that a step back to
       one that drops it fails here first. */
    const appended = await fetch(`${base}/appended/me`)
    assert.deepEqual(appended.headers.getSetCookie(), ['a=1; Path=/'])

    const added = await fetch(`${base}/added/me`)
    assert.equal(added.status, 200)
    assert.deepEqual(added.headers.getSetCookie(), ['a=1; Path=/api/blob', 'a=1; Path=/api/preview/image'])
    assert.equal(added.headers.get('vary'), 'Origin')
    assert.deepEqual(await added.json(), { ok: true })

    const own = await fetch(`${base}/added/own`)
    assert.deepEqual(own.headers.getSetCookie(), ['own=1; Path=/', 'a=1; Path=/api/blob', 'a=1; Path=/api/preview/image'])

    const none = await fetch(`${base}/added/none`)
    assert.equal(none.status, 204)

    const withOrigin = await fetch(`${base}/added/me`, { method: 'POST', headers: { origin: base } })
    assert.equal(withOrigin.status, 201)
    assert.equal(withOrigin.headers.getSetCookie().length, 2)
    assert.deepEqual(await withOrigin.json(), { made: true })
  } finally {
    server.close()
  }
})

/* And the app itself, served: a signed-in GET with no Origin carries both
   file cookies — the line in `routes.ts`, not only the helper. */
test('the running app gives a signed-in GET the file cookie on both paths', async () => {
  const { app } = await import('../src/http/routes.js')
  const { makeOwner, closeDb } = await import('./helpers.js')
  const { closeRealtime } = await import('../src/realtime.js')
  const { token } = await makeOwner()
  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
  await new Promise((done) => server.once('listening', done))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    const me = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${token}`, 'x-api-version': '1' } })
    assert.equal(me.status, 200)
    const paths = me.headers
      .getSetCookie()
      .filter((h) => h.startsWith('tracker_files='))
      .map((h) => /Path=([^;]+)/.exec(h)?.[1])
    assert.deepEqual(paths.sort(), ['/api/blob', '/api/preview/image'])
  } finally {
    server.close()
    await closeRealtime()
    await closeDb()
  }
})
