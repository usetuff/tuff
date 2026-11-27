import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext } from '../auth/context.js'
import { sql, withActor, withoutActor, type Sql } from '../db.js'

/**
 * A ceiling per token and per workspace, which the design asks for by name.
 *
 * The counters are in Postgres, not in this process. They were in memory
 * first, which was honest while there was one process and stopped being
 * honest the moment the worker joined it: two processes with private counters
 * let through twice the traffic while both go on reporting the number written
 * on them.
 *
 * One statement per check, on an unlogged table, and the insert-on-conflict
 * is the whole lock — two processes arriving together serialise on the row
 * rather than on anything anybody has to remember to take. If this ever
 * becomes the hot path it can move to Redis, and this file is the only one
 * that changes.
 */

/**
 * A token is held to a tighter budget than a person.
 *
 * A person clicks; an agent loops. The looping one is the one that takes a
 * workspace down, and it is also the one nobody is watching.
 */
export const PER_TOKEN = 300
export const PER_PERSON = 1200
export const PER_WORKSPACE = 6000
/*
 * And the workspace's grows with it: sixty a minute for each person in it.
 *
 * Six thousand was six a person in a company of a thousand, and three
 * hundred people at work at once used the minute up for all of them. The
 * size is asked once a minute per workspace, beside the request rather
 * than in front of it; until it is known the floor stands.
 */
export const PER_SEAT = 60
const sizes = new Map<string, { n: number; at: number }>()
export function workspaceAllowance(workspaceId: string): number {
  const had = sizes.get(workspaceId)
  if (!had || Date.now() - had.at > 60_000) {
    sizes.set(workspaceId, { n: had?.n ?? PER_WORKSPACE, at: Date.now() })
    void sql<{ n: number }[]>`select rate_allowance(${workspaceId}, ${PER_WORKSPACE}, ${PER_SEAT}) as n`
      .then(([r]) => sizes.set(workspaceId, { n: r?.n ?? PER_WORKSPACE, at: Date.now() }))
      .catch(() => {})
    if (sizes.size > 50_000) sizes.clear()
  }
  return sizes.get(workspaceId)?.n ?? PER_WORKSPACE
}

/**
 * Both allowances in one statement, outside a transaction.
 *
 * They were two transactions — begin, spend, commit, twice — six round
 * trips to the database in front of every request. One statement commits
 * by itself, and `case` spends the workspace's allowance only when the
 * caller's held, as the two calls in a row did.
 */
export async function spend(caller: string, allowance: number, workspace: string, shared: number, person?: string): Promise<boolean> {
  /*
   * A token spends its person's allowance too, between its own and the
   * workspace's (`person`): seventeen tokens of one member were seventeen
   * times three hundred a minute out of the workspace's six thousand, and
   * for that minute the owner was refused even the press that revokes them
   * — the seventh audit. A person, however
   * many tokens they hold, is twelve hundred a minute. Nested `case`s, not
   * `and`: the order the allowances are spent in is the point, and `and`
   * promises none.
   */
  const [row] = person
    ? await sql<{ ok: boolean }[]>`
    select case when rate_spend(${caller}, ${allowance})
                then case when rate_spend(${person}, ${PER_PERSON})
                          then rate_spend(${workspace}, ${shared})
                          else false end
                else false end as ok`
    : await sql<{ ok: boolean }[]>`
    select case when rate_spend(${caller}, ${allowance})
                then rate_spend(${workspace}, ${shared})
                else false end as ok`
  return row?.ok !== false
}

/*
 * What stops somebody, which a full minute never refuses: revoking a token,
 * taking a member out of the workspace, disconnecting an agent or one of its
 * connections. A member draining the workspace's allowance was answered by
 * the owner with exactly these, and they were the requests refused. Only in
 * a session of a person's own — never through a token, which is what is
 * being stopped — and on an allowance of their own, sixty a minute, so the
 * way past the ceiling is not a way round it. Each route still asks `can()`.
 */
const STOPS: [string, RegExp][] = [
  ['POST', /^\/api\/tokens\/[^/]+\/revoke$/],
  ['DELETE', /^\/api\/people\/[^/]+$/],
  ['DELETE', /^\/api\/agents\/[^/]+$/],
  ['DELETE', /^\/api\/agents\/[^/]+\/connections\/[^/]+$/],
  /* And the lists those buttons are on: a press the owner cannot reach is
     no way out. */
  ['GET', /^\/api\/agents$/],
  ['GET', /^\/api\/tokens$/],
  ['GET', /^\/api\/people$/],
]

/*
 * Whose allowance an agent's token spends as its person's: the person who
 * connected it (`agent.created_by`). Five agents spending their own twelve
 * hundred each were six thousand a minute of one member's — the review of
 * Kept a minute: an agent's connector does not change while it
 * runs.
 */
const connectors = new Map<string, { person: string; at: number }>()
export async function personOf(ctx: AuthContext): Promise<string> {
  if (!ctx.agent) return ctx.actorId
  const had = connectors.get(ctx.actorId)
  if (had && Date.now() - had.at < 60_000) return had.person
  const [row] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx<{ created_by: string | null }[]>`
      select created_by from agent where actor_id = ${ctx.actorId} and workspace_id = ${ctx.workspaceId}`,
  )
  const person = row?.created_by ?? ctx.actorId
  if (connectors.size > 10_000) connectors.clear()
  connectors.set(ctx.actorId, { person, at: Date.now() })
  return person
}
export const PER_STOPS = 60
export function stops(method: string, path: string): boolean {
  return STOPS.some(([m, p]) => m === method && p.test(path))
}

/** Anything with a request's headers on it. */
type Asking = { req: { header: (name: string) => string | undefined } }

/*
 * Cloudflare's published ranges — https://www.cloudflare.com/ips/ — which
 * change once in years. Only a request that reached us from one of these
 * may say who is behind it with `CF-Connecting-IP`; from anywhere else the
 * header is whatever the sender wrote.
 */
const CLOUDFLARE_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
]
/* By their first hextets. `2a06:98c0::/29` is 2a06:98c0 to 2a06:98c7, and
   was written `2a06:98`, which took in 2a06:9800 to 2a06:98ff — sixty-four
   times Cloudflare's block, most of it other people's (the eighth audit). */
const CLOUDFLARE_V6 = [
  '2400:cb00:',
  '2606:4700:',
  '2803:f800:',
  '2405:b500:',
  '2405:8100:',
  '2a06:98c0:',
  '2a06:98c1:',
  '2a06:98c2:',
  '2a06:98c3:',
  '2a06:98c4:',
  '2a06:98c5:',
  '2a06:98c6:',
  '2a06:98c7:',
  '2c0f:f248:',
]

function v4(ip: string): number | null {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return ((p[0]! << 24) >>> 0) + (p[1]! << 16) + (p[2]! << 8) + p[3]!
}

export function fromCloudflare(ip: string): boolean {
  const n = v4(ip)
  if (n !== null) {
    return CLOUDFLARE_V4.some((range) => {
      const [base, bits] = range.split('/') as [string, string]
      const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0
      return (n & mask) >>> 0 === (v4(base)! & mask) >>> 0
    })
  }
  const low = ip.toLowerCase()
  return CLOUDFLARE_V6.some((prefix) => low.startsWith(prefix))
}

/**
 * How many entries at the end of `X-Forwarded-For` the deployment's own
 * proxies wrote — `PROXY_HOPS`, two when unset. Railway writes two (below),
 * and the bundled Caddy replaces the header with one, which two reads the
 * same as before. A proxy that *appends* one entry to what the client sent
 * — nginx with `$proxy_add_x_forwarded_for`, an AWS load balancer — is
 * `1`: read at two, the entry before its own was the client's to write,
 * and a fresh address on every request was a fresh allowance
 * (`docs/self-hosting.md`, "Behind a proxy of your own"; the eighth audit).
 * The deployment's shape, not a product setting.
 */
export function proxyHops(raw = process.env.PROXY_HOPS): number {
  const n = Number(raw)
  return raw && Number.isInteger(n) && n >= 1 && n <= 10 ? n : 2
}

/**
 * Who is asking, by address.
 *
 * Railway's proxy writes, at the end of `X-Forwarded-For`, the address that
 * connected to it and then its own edge — so the last entry was always one
 * of two Railway machines, and every limit keyed on it was one limit shared
 * by everybody. The one before is who connected, which nothing the sender
 * writes can move; and when that is Cloudflare, standing in front of the
 * domain, the person behind it is `CF-Connecting-IP`. Elsewhere it is the
 * entry `hops` from the end (`proxyHops`), or the only one there is.
 */
export function addressOf(forwarded: string | undefined, cloudflare?: string | undefined, hops = proxyHops()): string {
  const all = (forwarded ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const peer = all.length >= hops ? all[all.length - hops]! : (all[0] ?? 'local')
  if (cloudflare && fromCloudflare(peer)) return cloudflare.trim()
  return peer
}

/**
 * This machine: a request with no proxy in front of it — the tests, the
 * browser suite through the preview, a developer. Here, every run of the
 * suites shared one twenty-a-quarter-hour sign-up allowance, and the second
 * run in a quarter of an hour failed on it.
 *
 * Never in production. There every request comes through a proxy, and one
 * that arrives with nothing forwarded came round it — exactly the request
 * that must not be let off its limits.
 */
export function onThisMachine(address: string): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return address === 'local' || address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/**
 * Whether a request came through our Cloudflare: it carries the secret a
 * request header rule there adds (`ORIGIN_SECRET`). Compared in constant
 * time; with no secret set, nothing is proven and nothing is assumed.
 *
 * Two may be set, comma-separated, for the minutes a new one is being put
 * in at Cloudflare: the old one stays good until it is taken out here, and
 * nobody is turned away in between.
 */
export function fromOurEdge(c: Asking): boolean {
  const secrets = (process.env.ORIGIN_SECRET ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  if (secrets.length === 0) return false
  const said = Buffer.from(c.req.header('x-origin-secret') ?? '')
  return secrets.some((secret) => {
    const want = Buffer.from(secret)
    return said.length === want.length && timingSafeEqual(said, want)
  })
}

/**
 * What a request the server makes to itself carries to pass the gate in
 * front of every route. The worker's GitHub calls carried nothing, and with
 * `ORIGIN_SECRET` set on the worker every one of them would have been
 * answered "Not found", in production only and with nothing said.
 */
export function fromInside(): Record<string, string> {
  const first = (process.env.ORIGIN_SECRET ?? '')
    .split(',')
    .map((x) => x.trim())
    .find(Boolean)
  return first ? { 'x-origin-secret': first } : {}
}

/**
 * The address of whoever is asking, from a request.
 *
 * Through our Cloudflare, proven by its secret, `CF-Connecting-IP` is the
 * person and nothing else needs reading. Otherwise the forwarded chain, read
 * the careful way — `addressOf`.
 */
export function clientOf(c: Asking): string {
  /* On a workspace's own domain, the address the hosts Worker signed —
     set by the edition only after the signature held. Never a header a
     client wrote. */
  const signed = (c as { get?: (k: string) => unknown }).get?.('clientIp')
  if (typeof signed === 'string' && signed) return signed
  const cloudflare = c.req.header('cf-connecting-ip')
  if (cloudflare && fromOurEdge(c)) return cloudflare.trim()
  return addressOf(c.req.header('x-forwarded-for'), cloudflare)
}

/**
 * Who is signing in from where, for the session about to be made: the
 * address, the browser's name, and the id the browser keeps for itself
 * (`x-device`) — so its tabs and workspaces are one line in the list of
 * places you are signed in.
 */
export function metaOf(c: { req: { header: (name: string) => string | undefined }; get?: (k: never) => unknown }): {
  ip: string
  userAgent: string | null
  device: string | null
  host: string | null
} {
  const device = c.req.header('x-device') ?? ''
  return {
    ip: clientOf(c),
    userAgent: c.req.header('user-agent')?.slice(0, 400) ?? null,
    device: /^[A-Za-z0-9-]{8,64}$/.test(device) ? device : null,
    /* The workspace's own domain this came in on, set only by the edition
       from a signed pair — every session made here is bound to it. */
    host: ((c.get?.('host' as never) as { hostname?: string } | undefined)?.hostname ?? null) as string | null,
  }
}

/**
 * How many rows a page asks for: a whole number from one to `most`, and
 * `fallback` for anything that is not one. `limit=abc` was a NaN handed to
 * the database and a 500 back; a negative one was a SQL error too.
 */
export function pageSize(asked: string | undefined, fallback: number, most: number): number {
  const n = Math.floor(Number(asked ?? fallback))
  return Number.isFinite(n) && n >= 1 ? Math.min(n, most) : fallback
}

/*
 * A moment in a cursor.
 *
 * Written by the database as `to_char(x at time zone 'UTC',
 * 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, to the microsecond, and sent back as
 * text cast in the query, `${at}::text::timestamptz`: a parameter the driver
 * knows is a timestamp — cast to one, or compared with a column that is one —
 * goes through a JavaScript `Date`, which keeps milliseconds, and the rows of
 * one transaction past a page's end were skipped. Checked here to the day
 * and hour, so what reaches that cast is a moment Postgres reads, never a
 * 500: `Date.parse` alone took "Fri Oct 23" and the thirty-first of February.
 */
const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/
const AN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isMoment(at: string): boolean {
  if (!MOMENT.test(at)) return false
  const ms = Date.parse(at)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 19) === at.slice(0, 19)
}

/**
 * `<moment>_<id>`, the cursor of a list newest first by a time and then the
 * id; or a bare moment, which these lists answered before (a `Date` as JSON
 * prints one), with `id` null. Null for anything else — a `400 invalid`.
 *
 * A bare moment is read as everything up to the end of its millisecond
 * (`before`), so a page cut inside one is repeated rather than skipped: the
 * last row of the page before may come again, which a client drawing rows
 * by id draws once.
 */
export function timeCursor(raw: string): { at: string; id: string | null } | null {
  const cut = raw.indexOf('_')
  const at = cut === -1 ? raw : raw.slice(0, cut)
  const id = cut === -1 ? null : raw.slice(cut + 1)
  return isMoment(at) && (id === null || AN_ID.test(id)) ? { at, id } : null
}

/** Spend one of `allowance` in a window of `seconds`; false once it is gone. */
export async function spendOn(key: string, allowance: number, seconds: number, db: Sql = sql): Promise<boolean> {
  try {
    const [r] = await db<{ ok: boolean }[]>`select rate_spend(${key}, ${allowance}, ${seconds}) as ok`
    return r?.ok !== false
  } catch {
    return true
  }
}

/**
 * A guess at a password or a code: whether it may be checked, and how to
 * give it back once it turned out right.
 *
 * Counted before it is checked. It used to be peeked at, checked, and
 * counted only when wrong, and a burst sent at once all passed the peek
 * before any counted: the ceiling of ten was however many arrived
 * together. Given back when right, so somebody who knows their password
 * is never the one who runs out.
 */
export type Attempt = { ok: boolean; right: () => Promise<void> }

const NOTHING = async () => {}

export async function attempt(key: string, allowance: number, seconds: number, db: Sql = sql): Promise<Attempt> {
  try {
    const [r] = await db<{ ok: boolean; at: Date }[]>`select * from rate_take(${key}, ${allowance}, ${seconds})`
    if (!r) return { ok: true, right: NOTHING }
    const back = async () => {
      await db`select rate_give_back(${key}, ${r.at})`.catch(() => {})
    }
    /* Refused, nothing was checked: it does not count against them. */
    if (!r.ok) await back()
    return { ok: r.ok, right: r.ok ? back : NOTHING }
  } catch {
    return { ok: true, right: NOTHING }
  }
}

/** Asked again, signed in, before something that cannot be undone: ten wrong in a quarter of an hour. */
export const reask = (actorId: string) => attempt(`fail:reauth:${actorId}`, 10, 900)

/*
 * Wrong answers to "is it you?" — a password, a second factor's code —
 * counted so that guessing is slow, and so that nobody else's guessing locks
 * you out.
 *
 * It was ten wrong answers per account, from anywhere, and the check came
 * before the password was read: anybody who knew an address could keep its
 * owner out for good with ten bad passwords a quarter of an hour, and the
 * same ten shut them out of changing their password and accepting an
 * invitation too. Now the ten are per account *and* address, so a guesser
 * stops themselves; the account's own ceiling — fifty, from everywhere
 * together — still slows a guess spread over many machines, and past it
 * only a device that has signed in to the account before may try.
 */
const PER_SOURCE = 10
const PER_ACCOUNT = 50
const GUESS_WINDOW = 900

export async function guess(email: string, c: Asking): Promise<Attempt> {
  const account = email.toLowerCase()
  const source = await attempt(`fail:login:${account}:${clientOf(c)}`, PER_SOURCE, GUESS_WINDOW)
  if (!source.ok) return source
  const whole = await attempt(`fail:login:${account}`, PER_ACCOUNT, GUESS_WINDOW)
  const both: Attempt = {
    ok: true,
    right: async () => {
      await Promise.all([source.right(), whole.right()])
    },
  }
  if (whole.ok) return both
  /* Past the account's own ceiling, only a device that has signed in to it
     before; one refused gives back what the source spent on it. */
  const device = metaOf(c).device
  let known = false
  if (device) {
    try {
      const [r] = await sql<{ ok: boolean }[]>`select auth_device_known(${account}, ${device}) as ok`
      known = r?.ok === true
    } catch {
      known = false
    }
  }
  if (known) return { ok: true, right: source.right }
  await source.right()
  return { ok: false, right: NOTHING }
}

/*
 * The doors before signing in — `/auth/*` — had no ceiling at all: a password
 * or a second factor could be guessed for as long as anybody liked, and every
 * guess costs this server a scrypt. Three hundred a minute from one address
 * is far past a person and far short of a flood.
 */
export const authLimit: MiddlewareHandler = async (c, next) => {
  /* And the reads behind them — an invitation's preview, the way out to a
     provider — at twice that: each is a query or a redirect for anybody,
     and they had no ceiling at all. */
  const post = c.req.method === 'POST'
  if (!(await spendOn(`${post ? 'ip' : 'ipget'}:${clientOf(c)}`, post ? 300 : 600, 60))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a minute.' } }, 429)
  }
  await next()
}

/** Old windows stop being written to; something has to remove them. */
let sweptAt = 0
async function sweepOccasionally(): Promise<void> {
  const now = Date.now()
  if (now - sweptAt < 5 * 60_000) return
  sweptAt = now
  await withoutActor((tx) => tx`select rate_sweep()`).catch(() => {})
}

export const rateLimit: MiddlewareHandler<{ Variables: { ctx: AuthContext } }> = async (c, next) => {
  const ctx = c.get('ctx')
  if (!ctx) return next()
  void sweepOccasionally()

  const caller = ctx.tokenId ? `t:${ctx.tokenId}` : `a:${ctx.actorId}`
  const allowance = ctx.tokenId ? PER_TOKEN : PER_PERSON

  let within: boolean
  try {
    /* Already asked, beside who is asking, when the caller is a person —
       `authenticate` spends then, so the two cost one round trip. */
    within =
      ctx.within ??
      (await spend(
        caller,
        allowance,
        `w:${ctx.workspaceId}`,
        workspaceAllowance(ctx.workspaceId),
        ctx.tokenId ? `a:${await personOf(ctx)}` : undefined,
      ))
  } catch {
    // A limiter that cannot reach the database must not become the reason
    // nobody can use the product. Failing open is the lesser fault: the
    // ceiling is there for load, and the database being unreachable is a
    // larger problem that this is not the place to report.
    return next()
  }

  const session = !ctx.tokenId && !ctx.viaMcp && !ctx.viaGithub && !ctx.viaImport && !ctx.board && !ctx.feedbackPage
  if (!within && session && stops(c.req.method, c.req.path) && (await spendOn(`stop:${ctx.actorId}`, PER_STOPS, 60))) {
    return next()
  }
  if (!within) {
    // Saying how long to wait is the difference between a client that backs
    // off and one that hammers harder.
    c.header('retry-after', '60')
    return c.json({ error: { code: 'rate_limited', message: 'Too many requests. Try again in a minute.' } }, 429)
  }
  return next()
}

/*
 * There is deliberately no way to clear the counters.
 *
 * One existed for the tests and the database refused it — the table is
 * granted to nobody, which is the point. A function to empty it would be a
 * way for anything holding a connection to hand itself a fresh minute, and
 * the tests do not need one: they spend against keys that are unique to the
 * run.
 */
