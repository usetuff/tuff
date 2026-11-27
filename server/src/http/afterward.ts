import type { Context } from 'hono'

/**
 * Cookies added to an answer that has already been made, in a way that
 * reaches the browser.
 *
 * `c.res.headers.append` after `next()` looked right and passed every test,
 * and on the running server the cookie was dropped from most answers. Under
 * `@hono/node-server` a handler's `c.json` is the adapter's own light
 * `Response`, holding the headers it was made with apart from the ones read
 * back through `.headers`. An outer middleware that calls `c.header` once the
 * answer is made — `cors` adds `Vary: Origin` to every one — copies the
 * answer from the headers it was made with, and what was appended is lost.
 * Only an answer made after something had touched `c.res` first kept it,
 * which is a request that carried an `Origin`: a browser's POST did, its
 * GETs to its own site do not. So the file cookie arrived with the first
 * write and never with a page that only read, and a picture linked
 * `?for=me` was refused to somebody who had only looked (found on Railway). `app.request` in the tests does not swap the global `Response`,
 * which is why nothing there saw it.
 *
 * So the cookies go in through `c.header`, which first turns the light answer
 * into a real one and then appends to it, in the order Hono expects. An
 * earlier version made the answer again and handed it to `c.res`, and the
 * setter's copy of the old headers put back only the handler's own cookies:
 * an answer that set one — linking a way in sets `__Host-tuff_link` — lost
 * the file cookie.
 *
 * `@hono/node-server` 2 keeps an appended cookie (`afterward.test.ts` says
 * so); this stays, being right on either adapter.
 *
 * Not on an answer that may carry no body (101, 204, 205, 304): making one
 * of those again throws, and the next answer sets the cookie anyway.
 */
export function addCookies(c: Context, cookies: readonly string[]): void {
  if (cookies.length === 0) return
  const status = c.res.status
  if (status === 101 || status === 204 || status === 205 || status === 304) return
  for (const h of cookies) c.header('set-cookie', h, { append: true })
}
