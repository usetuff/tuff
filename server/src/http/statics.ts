import type { Context, Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'

/*
 * The built files, served from disk — the app's bundle, its icons, the
 * pages the build wrote — and the two guards in front of them, which hold
 * whatever the version of `@hono/node-server` underneath
 * (the eighth audit).
 *
 * `serveStatic` decodes the path a second time, after the router has
 * decoded it once (GHSA-rmxm-3fg6-px4f): a middleware that matches the
 * once-decoded path and a file found by the twice-decoded one can disagree
 * about which address it was. Here the page's guard rails are added by a
 * middleware that leaves `/api`, `/auth` and `/ws` alone, so a file reached
 * through an address that starts with one of those would go out without
 * them.
 */

/**
 * Whether an address spells a dot, a slash, a backslash, a percent sign or
 * a nul in percent-encoding, or still has a `.` or `..` segment — read from
 * the address as sent, before anything decoded it. Nothing this product
 * links to is written that way (a slug is `[a-z0-9-]`, a file is a number,
 * a share token is base64url), and every way to make two decoders disagree
 * about a path is.
 */
export function oddPath(url: string): boolean {
  const start = url.indexOf('/', url.indexOf('://') + 3)
  if (start < 0) return false
  const end = url.search(/[?#]/)
  const path = url.slice(start, end < 0 ? undefined : end)
  return /%(?:2e|2f|5c|25|00)/i.test(path) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path) || path.includes('\\')
}

/**
 * The files under `root`, behind both guards: an odd address is not found
 * before anything looks on disk, and every file found carries the page's
 * guard rails itself, by `headersFor`, whatever its address starts with —
 * the middleware that adds them by path still runs after, and writes the
 * same set or a narrower one for a page of the site.
 */
export function serveFiles(app: Hono<any>, root: string, headersFor: (c: Context) => Record<string, string>): void {
  app.use('/*', async (c, next) => {
    if (!oddPath(c.req.url)) return next()
    return c.req.path.startsWith('/api/') ? c.json({ error: { code: 'not_found' } }, 404) : c.text('Not found', 404)
  })
  const files = serveStatic({ root })
  app.use('/*', async (c, next) => {
    /* Written on the answer the file came back as: a header set on the
       context while `serveStatic` builds its answer is not on it. */
    const found = await files(c, next)
    if (found instanceof Response) for (const [k, v] of Object.entries(headersFor(c))) found.headers.set(k, v)
    return found
  })
}
