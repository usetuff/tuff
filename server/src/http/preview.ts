import { Hono, type Context } from 'hono'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { authenticate, type AuthContext } from '../auth/context.js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { guardedLookup, privateAddress } from '../outbound.js'
import { env } from '../env.js'
import { botAgent, publicUrl } from '../publicUrl.js'
import { FILE_COOKIE, readFileCookie } from '../storage.js'
import { clientOf, spendOn } from './limits.js'
import { machineOf } from './machine.js'

type Vars = { ctx: AuthContext }
export const preview = new Hono<{ Variables: Vars }>()

/**
 * A link's card.
 *
 * The server reads the page because a browser may not read another site's.
 * Which makes this a way to have the server ask anything, so the guard is
 * at the socket: every address a name resolves to is checked as the
 * connection is made — not looked up first and connected to after, which a
 * name that answers differently the second time walks straight through.
 */
export type Card = { url: string; title: string; description: string | null; image: string | null; site: string | null }

/* The one list of addresses the server never asks, and the one lookup that
   refuses to hand a socket any of them, shared with webhook delivery — two
   copies had drifted, this one missing NAT64, the hex form of a mapped
   IPv4 address and two reserved ranges. `outbound.ts`. */
const safeLookup = guardedLookup()

const LIMIT = 1_000_000
/* What a card's picture may be: the four a browser draws everywhere — no
   SVG, which is a document — and five megabytes at most. */
const PICTURE = /^image\/(png|jpeg|gif|webp)\b/i
const PICTURE_LIMIT = 5_000_000

/**
 * How much of this process reading other people's sites may take — the
 * seventh audit, the security audit spec. A site that sends
 * a byte every four seconds never tripped the five-second idle timeout, and
 * nothing counted how many such reads were open: twenty pages and five
 * pictures held their sockets and fifty megabytes for as long as the site
 * liked.
 *
 * - `deadlineMs`: one read, every redirect included, from the first byte
 *   asked to the last — then it is dropped, whatever it was doing.
 * - `most`: reads open at once in this process, cards and pictures
 *   together; past it the next is refused, not queued.
 * - `perCaller`: of those, how many one person — or, for a picture asked
 *   with nobody signed in, one address — may hold.
 * - `signedDays`: how long a picture's signed address works for somebody
 *   not signed in.
 * - `legacyUntil`: until when an address signed before signatures had a
 *   date works for somebody not signed in.
 *
 * Kept in one object so a test can shorten them; nothing else writes it.
 */
export const fetching = {
  deadlineMs: 8_000,
  most: 32,
  perCaller: 4,
  signedDays: 7,
  legacyUntil: Date.parse('2026-12-04T00:00:00Z'),
}

/* Who holds the reads open now. */
let open = 0
const held = new Map<string, number>()

/** A place for one read, or null when the process or this caller has none left. */
export function take(caller: string): (() => void) | null {
  const mine = held.get(caller) ?? 0
  if (open >= fetching.most || mine >= fetching.perCaller) return null
  open++
  held.set(caller, mine + 1)
  let given = false
  return () => {
    if (given) return
    given = true
    open--
    const left = (held.get(caller) ?? 1) - 1
    if (left > 0) held.set(caller, left)
    else held.delete(caller)
  }
}

/** How many reads are open, for the tests. */
export const openReads = () => open

type Got = { status: number; location: string | null; type: string; body: string; bytes: Buffer }

/**
 * One request, dropped at `until` (a time, ms) whatever it is doing. With
 * the guarded lookup in every real read (`get`); a test hands it its own to
 * reach a server on this machine, which nothing on a request's path can.
 */
export function ask(url: URL, want: 'page' | 'image', until: number, lookup: LookupFunction): Promise<Got> {
  return new Promise((resolve, reject) => {
    let late = false
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = send(
      url,
      {
        method: 'GET',
        lookup: lookup as never,
        timeout: 5000,
        headers: { 'user-agent': botAgent(publicUrl()), accept: want === 'page' ? 'text/html' : 'image/*' },
      },
      (res: IncomingMessage) => {
        const type = String(res.headers['content-type'] ?? '')
        const location = res.headers.location ?? null
        const fits = want === 'page' ? type.includes('text/html') : PICTURE.test(type)
        if (!fits || (res.statusCode ?? 0) >= 300) {
          clearTimeout(timer)
          /* Its body is never read, so it is not drained either: drained, a
             redirect or a wrong type that dripped kept its socket past the
             deadline with the read's place already given back. The connection goes with it. */
          res.destroy()
          return resolve({ status: res.statusCode ?? 0, location, type, body: '', bytes: Buffer.alloc(0) })
        }
        const limit = want === 'page' ? LIMIT : PICTURE_LIMIT
        let size = 0
        let over = false
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => {
          size += c.length
          if (size > limit) {
            over = true
            return res.destroy()
          }
          chunks.push(c)
        })
        res.on('close', () => {
          clearTimeout(timer)
          /* Cut off by the deadline, what arrived is half a page or half a
             picture — nothing to make a card of or to keep for a day. */
          if (late) return reject(new Error('too slow'))
          const bytes = over ? Buffer.alloc(0) : Buffer.concat(chunks)
          resolve({
            status: over ? 413 : (res.statusCode ?? 0),
            location,
            type,
            body: want === 'page' ? bytes.toString('utf8') : '',
            bytes,
          })
        })
        res.on('error', reject)
      },
    )
    const timer = setTimeout(
      () => {
        late = true
        req.destroy(new Error('too slow'))
      },
      Math.max(0, until - Date.now()),
    )
    req.on('timeout', () => req.destroy(new Error('slow')))
    req.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    req.end()
  })
}

function get(url: URL, want: 'page' | 'image', until: number): Promise<Got> {
  /* An address written as one is never looked up, so `safeLookup` never
     sees it: it is checked here, without the brackets an IPv6 one comes
     in — `isIP('[::1]')` is no address at all, and `[::1]` was let
     through on that. */
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1')
  if (isIP(host) && privateAddress(host)) return Promise.reject(new Error('a private address'))
  return ask(url, want, until, safeLookup as LookupFunction)
}

const entity = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d{1,7});/g, (_, n: string) => point(Number(n)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n: string) => point(parseInt(n, 16)))
    .trim()

/* A number past Unicode threw, and the preview was a 500. */
const point = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '')

/**
 * The part of a page a card is read from: its head, and no more than the
 * first 64 KB of it. Read whole, a megabyte of `<meta` with no `>` cost a
 * pattern the square of its length — minutes of a server that does
 * nothing else meanwhile — and every tag a card needs is in the head.
 */
function headOf(html: string): string {
  const first = html.slice(0, 64 * 1024)
  const end = first.search(/<\/head\s*>/i)
  return end < 0 ? first : first.slice(0, end)
}

/** Every `<meta>` tag in a head, found once, each tag bounded. */
function metas(head: string): string[] {
  return head.match(/<meta\b[^<>]{0,2048}>/gi) ?? []
}

function meta(tags: string[], ...names: string[]): string | null {
  for (const name of names) {
    const said = new RegExp(`(?:property|name)=["']${name.replace(/[.:]/g, '\\$&')}["']`, 'i')
    const tag = tags.find((t) => said.test(t))
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (content) return entity(content)
  }
  return null
}

/** Where a redirect goes, or null for a `Location` that is not an address. */
export function nextUrl(location: string, from: URL): URL | null {
  try {
    return new URL(location, from)
  } catch {
    return null
  }
}

export async function readCard(address: string): Promise<Card | null> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }
  /* One deadline for the read and every redirect in it. */
  const until = Date.now() + fetching.deadlineMs
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const got = await get(url, 'page', until).catch(() => null)
    if (!got) return null
    if (got.status >= 300 && got.status < 400 && got.location) {
      /* A `Location` that is no address ends the read, not the request. */
      const next = nextUrl(got.location, url)
      if (!next) return null
      url = next
      continue
    }
    if (got.status >= 400 || !got.body) return null
    return cardFrom(got.body, address, url)
  }
  return null
}

/** A card from a page's text, as `address` and found at `url`. */
export function cardFrom(body: string, address: string, url: URL): Card | null {
  const head = headOf(body)
  const tags = metas(head)
  const named = /<title\b[^<>]{0,256}>([^<]{1,1000})<\/title>/i.exec(head)?.[1]
  const title = meta(tags, 'og:title', 'twitter:title') ?? (named ? entity(named) : null)
  if (!title) return null
  const image = meta(tags, 'og:image', 'og:image:url', 'twitter:image')
  let absolute: URL | null = null
  try {
    absolute = image ? new URL(image, url) : null
  } catch {
    // A picture's address that is not one: the card goes without it.
  }
  return {
    url: address,
    title: title.slice(0, 300),
    description: meta(tags, 'og:description', 'description', 'twitter:description')?.slice(0, 500) ?? null,
    image: absolute && absolute.protocol === 'https:' ? through(absolute.toString()) : null,
    site: meta(tags, 'og:site_name') ?? url.hostname.replace(/^www\./, ''),
  }
}

const kept = new Map<string, { card: Card | null; until: number }>()

/** Refused for want of a place: not the page's fault, so nothing is kept of it. */
class Busy extends Error {}

const busy = (c: Context) => {
  c.header('retry-after', '5')
  return c.json({ error: { code: 'busy', message: 'Too many links being read. Try again in a moment.' } }, 429)
}

preview.get('/preview', async (c) => {
  const url = c.req.query('url') ?? ''
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return c.json({ error: { code: 'invalid' } }, 400)
  const hit = kept.get(url)
  let card: Card | null
  if (hit && hit.until > Date.now()) card = hit.card
  else {
    const caller = `a:${c.get('ctx').actorId}`
    try {
      card = await once(`card:${url}`, async () => {
        const done = take(caller)
        if (!done) throw new Busy()
        try {
          return await readCard(url)
        } finally {
          done()
        }
      })
    } catch (e) {
      if (e instanceof Busy) return busy(c)
      throw e
    }
    if (kept.size > 2000) kept.clear()
    kept.set(url, { card, until: Date.now() + 3_600_000 })
  }
  return card ? c.json(card) : c.json({ error: { code: 'gone', message: 'No preview for that link.' } }, 422)
})

/*
 * A card's picture, fetched by us and not by every reader.
 *
 * The card carried the site's own picture address, so each person who
 * scrolled past a link sent their address and the time to whoever made
 * the page — and a body could name any picture at all, which made every
 * message a way to see who read it. Now the card names a picture through
 * this server, signed so it fetches only addresses it put on a card
 * itself, and the reader's browser asks nobody else.
 *
 * Signed over the address and a date (`e`, seconds) since the seventh
 * audit: past it, only somebody signed in is answered — the address is
 * kept in every body the card was sent in, and the people reading those
 * are signed in — and a stranger holding the address is not. An address
 * signed before there was a date is the same past `legacyUntil`.
 */
const key = createHmac('sha256', env.jwtSecret).update('tuff:preview-picture').digest()
const sign = (u: string) => createHmac('sha256', key).update(u).digest('base64url').slice(0, 32)

/* A dated one is signed over `v1`, the address and the date, each on a line:
   never the same words as an undated one, which is the address alone. */
const signDated = (u: string, e: string | number) => sign(`v1\n${u}\n${e}`)

export function through(u: string, until = Math.floor(Date.now() / 1000) + fetching.signedDays * 86_400): string {
  return `/api/preview/image?u=${encodeURIComponent(u)}&e=${until}&s=${signDated(u, until)}`
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** What a picture's address says of itself: forged, still good for anybody, or good only for somebody signed in. */
export function signature(u: string, e: string | undefined, s: string, now = Date.now()): 'forged' | 'open' | 'members' {
  if (!u || !s) return 'forged'
  if (e === undefined) {
    if (!same(sign(u), s)) return 'forged'
    return now < fetching.legacyUntil ? 'open' : 'members'
  }
  if (!/^\d{1,12}$/.test(e) || !same(signDated(u, e), s)) return 'forged'
  return now < Number(e) * 1000 ? 'open' : 'members'
}

/*
 * Who is asking for a picture: a person — by the bearer an app sends, or
 * the browser's pass to its files (`storage.ts`), which an `<img>` carries
 * here too — or else a machine: an IPv6 address counted by its /64
 * (`machineOf`), which one machine is given and can spread over.
 *
 * A bearer that is sent and does not hold is `null`, answered 401: an app
 * whose token ran out is told to renew it, as on every other route — a 404
 * left the picture blank for good.
 */
async function askedBy(c: Context): Promise<{ who: string; signedIn: boolean } | null> {
  const bearer = c.req.header('authorization')
  if (bearer) {
    const ctx = await authenticate(bearer).catch(() => null)
    return ctx ? { who: `a:${ctx.actorId}`, signedIn: true } : null
  }
  const cookie = (c.req.header('cookie') ?? '')
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${FILE_COOKIE}=`))
    ?.slice(FILE_COOKIE.length + 1)
  const person = readFileCookie(cookie)?.actorId
  return person ? { who: `a:${person}`, signedIn: true } : { who: `ip:${machineOf(clientOf(c))}`, signedIn: false }
}

/* Asked for a minute: a person scrolling a room of cards, and an address
   with nobody signed in at a fifth of that. */
const PICTURES_PER_PERSON = 600
const PICTURES_PER_ADDRESS = 120

const pictures = new Map<string, { at: number; type: string; bytes: Buffer }>()
let heldBytes = 0

async function picture(address: string): Promise<{ type: string; bytes: Buffer } | null> {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }
  const until = Date.now() + fetching.deadlineMs
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:') return null
    const got = await get(url, 'image', until).catch(() => null)
    if (!got) return null
    if (got.status >= 300 && got.status < 400 && got.location) {
      /* A `Location` that is no address ends the read, not the request. */
      const next = nextUrl(got.location, url)
      if (!next) return null
      url = next
      continue
    }
    if (got.status >= 400 || got.bytes.length === 0) return null
    /* The type is ours, not the site's: `image/png, text/html` passed the
       test above and was sent on as it came, and a browser takes the last
       type in a list — the site's HTML, drawn at our address. */
    const kind = PICTURE.exec(got.type)?.[1]?.toLowerCase()
    return kind ? { type: `image/${kind}`, bytes: got.bytes } : null
  }
  return null
}

/* One fetch for one address, however many readers ask at once: a link in a
   room of a thousand was a thousand requests to the site at the same moment. */
const asking = new Map<string, Promise<unknown>>()
function once<T>(key: string, work: () => Promise<T>): Promise<T> {
  const going = asking.get(key) as Promise<T> | undefined
  if (going) return going
  const started = work().finally(() => asking.delete(key))
  asking.set(key, started)
  return started
}

preview.get('/preview/image', async (c) => {
  const u = c.req.query('u') ?? ''
  const said = signature(u, c.req.query('e'), c.req.query('s') ?? '')
  if (said === 'forged') return c.json({ error: { code: 'not_found' } }, 404)
  const asker = await askedBy(c)
  if (!asker) return c.json({ error: { code: 'unauthorized' } }, 401)
  const { who, signedIn } = asker
  if (said === 'members' && !signedIn) return c.json({ error: { code: 'not_found' } }, 404)
  if (!(await spendOn(`picture:${who}`, signedIn ? PICTURES_PER_PERSON : PICTURES_PER_ADDRESS, 60))) {
    c.header('retry-after', '60')
    return c.json({ error: { code: 'rate_limited', message: 'Too many requests. Try again in a minute.' } }, 429)
  }
  let hit = pictures.get(u)
  if (!hit || Date.now() - hit.at > 86_400_000) {
    let got: { type: string; bytes: Buffer } | null
    try {
      got = await once(`picture:${u}`, async () => {
        const done = take(who)
        if (!done) throw new Busy()
        try {
          return await picture(u)
        } finally {
          done()
        }
      })
    } catch (e) {
      if (e instanceof Busy) return busy(c)
      throw e
    }
    if (!got) return c.json({ error: { code: 'gone' } }, 404)
    /* Kept a day and thirty megabytes at most, the oldest let go first. A
       picture fetched again gives back the room its old copy took — added
       and never taken away, the count crept past the limit and the cache
       let go of everything it was handed. */
    const old = pictures.get(u)
    if (old) {
      heldBytes -= old.bytes.length
      pictures.delete(u)
    }
    hit = { at: Date.now(), ...got }
    heldBytes += hit.bytes.length
    pictures.set(u, hit)
    for (const [k, v] of pictures) {
      if (heldBytes <= 30_000_000) break
      pictures.delete(k)
      heldBytes -= v.bytes.length
    }
  }
  return new Response(new Uint8Array(hit.bytes), {
    headers: {
      'content-type': hit.type,
      /* Private now: a picture asked for with a pass is not for a shared cache to hand on. */
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  })
})
