import { preview } from './preview.js'
import { oneLine } from '../text.js'
import { address } from './address.js'
import { waysIn } from './waysIn.js'
import { agents } from './agents.js'
import { agentWork } from './agentWork.js'
import { password } from './password.js'
import { ownership } from './ownership.js'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { BODY_MOST, TOO_LONG_TO_SAVE, TOO_LONG_TO_SEND } from './body.js'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { API_VERSION, MAX_FILE_BYTES, MarkIcon, MarkTint, WorkspaceSettings } from '@tracker/shared-schema'
import { asAuth, asAuthActor, authSql, bounded, sql, withActor } from '../db.js'
import { digestOffValid } from '../digest.js'
import { COMMIT, VERSION } from '../version.js'
import { chose } from '../presence.js'
import { cookieHeaders, faced, linkFor, FILE_COOKIE, fileCookie, put, readFileCookie, whereBytesGo, whereLinksGo } from '../storage.js'
import { brandHere } from '../brand.js'
import { UNPROVED, authenticate, allow, allowedActions, offHostActions, planSaid, type AuthContext } from '../auth/context.js'
import { agentsHeld } from '../ceilings.js'
import {
  signUp,
  login,
  startNowhereSession,
  refresh,
  logout,
  ownWorkspaceName,
  confirmed,
  beginTotp,
  enableTotp,
  disableTotp,
  totpState,
} from '../auth/flows.js'
import { invites, publicInvites } from './invites.js'
import { publicDocs } from './publicDocs.js'
import { access, bindBrowser, origin, sendAlreadyHere, sendChoosePassword } from './access.js'
import { setup } from './setup.js'
import { addCookies } from './afterward.js'
import { asksOf, codeFromInbox, itIsThem, tellFactorOn } from '../auth/address.js'
import { projects } from './projects.js'
import { places } from './places.js'
import { labels } from './labels.js'
import { people } from './people.js'
import { confirming } from './confirming.js'
import { tokens } from './tokens.js'
import { posts } from './posts.js'
import { tasks } from './tasks.js'
import { blocks } from './blocks.js'
import { files, rasterOf } from './files.js'
import { versions } from './versions.js'
import { search } from './search.js'
import { authLimit, clientOf, fromOurEdge, guess, metaOf, onThisMachine, rateLimit, reask, spendOn } from './limits.js'
import { workspaces } from './workspaces.js'
import { chat } from './chat.js'
import { inbox } from './inbox.js'
import { overview } from './overview.js'
import { webhooks } from './webhooks.js'
import { importer } from './import.js'
import { audit } from './audit.js'
import { linearImport } from './linearImport.js'
import { otherImport } from './otherImport.js'
import { csvImport } from './csvImport.js'
import { comments } from './objects.js'
import { push } from './push.js'
import { frenchError, heard } from '../words.js'
import { yourData } from './yourdata.js'
import { NO_WORKSPACE_YET, nowhere } from './nowhere.js'
import { oauth, oauthApi } from './oauth.js'
import { apple } from './apple.js'
import { android } from './android.js'
import { remote } from '../mcp/remote.js'
import { discovery } from './discovery.js'
import { BadShape } from './badShape.js'
import { Busy, busy, TooComplex, tooComplex } from '../mcp/markdownPool.js'
import { edition } from '../edition.js'
import { isClosed, SIGN_UP_CLOSED, signUpOpen } from '../instance.js'
import { instanceApi } from './instance.js'
import { serverVersion } from '../updates.js'
import { feedback, feedbackPublic } from './feedback.js'
import { githubApi, githubHooks, githubReturns } from './github.js'
import { incomingHooks, roomHooks } from './hooks.js'
import { slackApi, slackHooks, slackReturns } from './slack.js'
import { watching } from '../watchdog.js'
import { onlyLocalhost } from '../tryLocalhost.js'
import { usedAs } from './used.js'
import { hostOf, usableHere } from '../host.js'
import { verifyAccessToken } from '../auth/tokens.js'

type Vars = { ctx: AuthContext }

export const app = new Hono<{ Variables: Vars }>()

/* First, so a request is on the watchdog's list from the moment anything
   here holds the thread for it — its method and the shape of its path, no
   more. Nothing while the watchdog is off. */
app.use('*', watching)

/* Tuff tried on one computer over plain http answers only requests
   addressed to localhost. Nothing anywhere else. */
app.use('*', onlyLocalhost)

/*
 * What reaches here unanswered.
 *
 * A row naming something in another place — another project's list,
 * another room's message — is refused by the database as a
 * `check_violation` (`109_what_the_audit_found.sql`), and that is the
 * caller's mistake, said as one. Anything else is ours: logged, and a 500
 * that says nothing about why.
 */
export const answerError = (e: Error, c: Context) => {
  if (e instanceof HTTPException) return e.getResponse()
  /* A body that is not the shape a body has — too deep, or not a
     document at all: the caller's, said as one. `badShape.ts`. */
  if (e instanceof BadShape) return c.json({ error: { code: 'invalid' } }, 400)
  /* Markdown a worker could not read in half a second: the caller's text,
     refused as such. */
  if (e instanceof TooComplex) return c.json(tooComplex, 422)
  /* Too much waiting for the workers already: come back shortly. */
  if (e instanceof Busy) return c.json(busy, 503, { 'retry-after': '5' })
  const code = (e as { code?: string }).code
  /* The account's previous holder was put out after this request was let
     in: nothing it would write is written — `auth_still_in`, migration 317, */
  if (code === '28000') return c.json({ error: { code: 'unauthorized' } }, 401)
  if (code === '23514') {
    return c.json({ error: { code: 'invalid', message: (e as Error).message } }, 400)
  }
  if (code === '23503' || code === '22P02') {
    return c.json({ error: { code: 'invalid' } }, 400)
  }
  /* A task made by any way into a project whose import still runs —
     migration 159. */
  if (code === 'P0001' && (e as Error).message === 'project_importing') {
    return c.json({ error: { code: 'conflict', message: 'This project is still being imported. Try again when it’s done.' } }, 409)
  }
  /* An account, or the confirmation of an address, refused on your own
     server with sign-up closed — migration 202.
     Wherever it came from: the database decides, not the route. */
  if (isClosed(e)) return c.json(SIGN_UP_CLOSED, 403)
  /* A board's address is its key: never written to a log whole. */
  /* Nor a room's webhook, whose address is its secret. */
  console.error(`[api] ${c.req.method} ${c.req.path.replace(/^\/b\/[^/]+/, '/b/…').replace(/^\/hooks\/rooms\/.*/, '/hooks/rooms/…')}`, e)
  return c.json({ error: { code: 'internal' } }, 500)
}
app.onError(answerError)

/*
 * Through the proxy in front, or not at all.
 *
 * A host's own address answers as well as the domain does, and a host's
 * edge may take a connection naming the domain from anybody who finds it:
 * either way round the proxy (Cloudflare, say), past its protection and its
 * limits, with a forwarded address the sender wrote. When `ORIGIN_SECRET`
 * is set, the proxy adds it to every request it passes on (a request header
 * rule), and a request without it is answered as if nothing were here. The
 * health check is the host's own and comes from inside.
 */
const ORIGIN_SECRET = process.env.ORIGIN_SECRET ?? ''
app.use('*', async (c, next) => {
  if (!ORIGIN_SECRET || c.req.path === '/health') return next()
  if (!fromOurEdge(c)) return c.text('Not found', 404)
  return next()
})

/*
 * A workspace's own domain, on the service.
 * A request the Worker signed for a connected name is that workspace's and
 * meets its allow-list; one for a name that went is sent to the same path
 * here. Anything else, whatever its headers say, is an ordinary request.
 */
edition.hosts?.mount(app)

/* No credentials across origins: sign-in is a bearer header, and nothing a
   page elsewhere could send with this site's cookies should be allowed to. */
app.use('*', cors({ origin: (o) => o ?? '*', credentials: false }))

/*
 * The addresses a sign-in carries a ticket in — `/signin?handoff=…`,
 * `?linked=…`, and the providers' callbacks — never go anywhere as a
 * referrer: a picture, a font or a link followed from that page would
 * otherwise hand a server elsewhere the whole address.
 * Only these: the rest of the product's
 * referrers are the browser's default, which sends only our origin across
 * sites.
 */
app.use('*', async (c, next) => {
  await next()
  const path = c.req.path
  if (path === '/signin' || path === '/setup' || path.startsWith('/auth/')) c.header('referrer-policy', 'no-referrer')
  /* An invitation's page, whose address is its token. */
  if (path.startsWith('/invite/')) c.header('referrer-policy', 'no-referrer')
  /* (The edition's own such addresses are said by the edition, just
     below: `edition.headers`.) */
  /* And a feedback page's confirmation, whose address carries the link's
     token. */
  if (/^\/f\/[^/]+\/confirm\//.test(path)) c.header('referrer-policy', 'no-referrer')
})
edition.headers(app)

/*
 * An error's message in the language the screen showing it speaks.
 * After every handler rather than inside each: the
 * English stays where it is written, and the French is looked up by it.
 * The code is the contract and is never touched.
 */
app.use('*', async (c, next) => {
  await next()
  if (c.res.status < 400 || heard(c) !== 'fr') return
  if (!c.res.headers.get('content-type')?.includes('application/json')) return
  const body = (await c.res
    .clone()
    .json()
    .catch(() => null)) as { error?: { message?: unknown } } | null
  const message = body?.error?.message
  if (typeof message !== 'string') return
  const headers = new Headers(c.res.headers)
  headers.delete('content-length')
  c.res = new Response(JSON.stringify({ ...body, error: { ...body!.error, message: frenchError(message) } }), {
    status: c.res.status,
    headers,
  })
})

/*
 * How much a request may carry, said before it is read. Nothing capped it,
 * so the unauthenticated doors buffered whatever arrived and an upload was
 * read whole before its size was asked. The doors before signing in take a
 * few kilobytes; a body of words a few megabytes; an upload its file and a
 * little more.
 */
const UPLOAD = /\/(uploads|icon|avatar|display|import\/[a-z]+)$/
app.use('/auth/*', bodyLimit({ maxSize: 64 * 1024 }))
app.use('/api/*', async (c, next) => {
  const max = UPLOAD.test(c.req.path) ? MAX_FILE_BYTES + 1024 * 1024 : 5 * 1024 * 1024
  return bodyLimit({ maxSize: max, onError: (cc) => cc.json({ error: { code: 'too_large' } }, 413) })(c, next)
})
/*
 * And how much one body of words may weigh.
 * Said of the request, which is the body plus a few fields, so nothing
 * stored can be larger; asked before the handler reads a byte of it.
 */
const BODIES: readonly { method: string; path: RegExp; max: number; said: boolean }[] = [
  { method: 'POST', path: /^\/api\/(tasks|posts|files)\/[^/]+\/comments$/, max: BODY_MOST.said, said: true },
  { method: 'PATCH', path: /^\/api\/comments\/[^/]+$/, max: BODY_MOST.said, said: true },
  { method: 'POST', path: /^\/api\/conversations\/[^/]+\/messages$/, max: BODY_MOST.said, said: true },
  { method: 'PATCH', path: /^\/api\/messages\/[^/]+$/, max: BODY_MOST.said, said: true },
  { method: 'POST', path: /^\/api\/board\/(app\/task|tasks)\/[^/]+\/comments$/, max: BODY_MOST.said, said: true },
  { method: 'POST', path: /^\/api\/projects\/[^/]+\/(tasks|posts)$/, max: BODY_MOST.page, said: false },
  { method: 'PATCH', path: /^\/api\/(tasks|posts|steps)\/[^/]+$/, max: BODY_MOST.page, said: false },
  { method: 'POST', path: /^\/api\/tasks\/[^/]+\/steps$/, max: BODY_MOST.page, said: false },
  { method: 'POST', path: /^\/api\/board\/(tasks|app\/tasks)$/, max: BODY_MOST.page, said: false },
  { method: 'PATCH', path: /^\/api\/board\/(tasks\/[^/]+|app\/task\/[^/]+)$/, max: BODY_MOST.page, said: false },
]
app.use('/api/*', async (c, next) => {
  const one = BODIES.find((b) => b.method === c.req.method && b.path.test(c.req.path))
  if (!one) return next()
  return bodyLimit({
    maxSize: one.max,
    onError: (cc) => cc.json({ error: { code: 'too_large', message: tooLong(one) } }, 413),
  })(c, next)
})
/* Something said is sent; a page is saved. */
function tooLong(b: { said: boolean }): string {
  if (b.said) return TOO_LONG_TO_SEND
  return TOO_LONG_TO_SAVE
}
/* A spreadsheet's page of rows: two hundred of them, words in any script,
   is several megabytes — and never the fifty an upload's door allows. */
app.use('/api/projects/:projectId/import/tasks', bodyLimit({ maxSize: 16 * 1024 * 1024 }))
app.use('/auth/*', authLimit)
/* Deliveries — GitHub's, and the edition's own — read whole before their
   signature is checked: bounded at what GitHub may send (25 MB), not left
   open. */
app.use('/hooks/*', bodyLimit({ maxSize: 25 * 1024 * 1024 }))
/* Slack's events are a few kilobytes. */
app.use('/hooks/slack', bodyLimit({ maxSize: 1024 * 1024 }))
/* A room's incoming webhook takes what Slack's does, a few kilobytes and
   rarely more; 64 KB bounds what the converter is ever asked to read. */
app.use('/hooks/rooms/*', bodyLimit({ maxSize: 64 * 1024, onError: (cc) => cc.text('payload_too_large', 413) }))
/* An agent signing in from elsewhere, and the MCP server it then talks to.
   The trade is a few kilobytes; a tool call
   carries what a body of words does. Not behind the per-address ceiling:
   every ChatGPT user arrives from the same few of OpenAI's addresses, and a
   token's own ceiling is what counts for what it does. */
app.use('/oauth/*', bodyLimit({ maxSize: 64 * 1024 }))
app.use('/mcp', bodyLimit({ maxSize: 5 * 1024 * 1024 }))
/* And what the edition limits and gates of its own, before any of it is
   read — `edition.ts`. */
edition.early(app)

/**
 * A client six months out of date must be told so rather than writing against
 * a contract that has moved. The version is a header because it applies to
 * every request, including the ones with no body.
 */
app.use('/api/*', async (c, next) => {
  const sent = Number(c.req.header('x-api-version') ?? API_VERSION)
  if (sent > API_VERSION) {
    return c.json({ error: { code: 'api_too_new', message: 'Update the server' } }, 400)
  }
  await next()
})

/*
 * And which build is answering.
 *
 * A whole day went into a fault that reproduced on the deployed board and
 * never locally, and the question that could not be answered from outside
 * was the simplest one: is the fix even running there? The front end's
 * bundle hash is visible in the page, so a web-only change can be checked
 * — a server-only change could not be, and twice we argued about a fix
 * that may or may not have been deployed.
 *
 * Railway sets `RAILWAY_GIT_COMMIT_SHA`; anything else can pass `GIT_SHA`.
 * Absent, it says so rather than pretending.
 */
/*
 * The link at the foot of a digest: off, without signing in, for the one
 * person it was signed for — `docs/specs/notifications.md`.
 *
 * Opening it asks; pressing the button, or the mail client's own
 * Unsubscribe (a POST, RFC 8058), does it. It acted on the GET, and a mail
 * scanner that opens every link turned people's digests off for them.
 */
const digestPage = (said: string, button?: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tuff</title>` +
  `<body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">` +
  `<div style="max-width:480px;margin:80px auto;background:#fff;border-radius:16px;padding:32px;font-size:15px;line-height:1.5;color:#3a3a3c">` +
  `<div style="font-size:17px;font-weight:600;color:#1d1d1f;padding-bottom:16px">Tuff</div>${said}` +
  (button
    ? `<form method="post" style="margin:24px 0 0"><button type="submit" style="font:inherit;font-weight:500;background:#007aff;color:#fff;border:0;border-radius:999px;padding:12px 24px;cursor:pointer">${button}</button></form>`
    : '') +
  `</div></body>`

const digestOwner = (c: { req: { query: (k: string) => string | undefined } }) => {
  const u = c.req.query('u') ?? ''
  const t = c.req.query('t') ?? ''
  return /^[0-9a-f-]{36}$/i.test(u) && digestOffValid(u, t) ? u : null
}
const DIGEST_BAD = 'This link isn’t valid. You can turn these emails off under Notifications in your account.'

app.get('/digest/off', (c) =>
  digestOwner(c)
    ? c.html(digestPage('Stop the emails about what you haven’t read on Tuff?', 'Stop these emails'))
    : c.html(digestPage(DIGEST_BAD), 400),
)

app.post('/digest/off', async (c) => {
  const u = digestOwner(c)
  if (!u) return c.html(digestPage(DIGEST_BAD), 400)
  await asAuth((tx) => tx`select digest_off(${u})`)
  return c.html(digestPage('You won’t get these emails any more. You can turn them back on under Notifications in your account.'))
})

app.get('/health', async (c) => {
  /*
   * And, when asked, how far away the database is.
   *
   * Every request pays that distance several times over, and from outside
   * it cannot be told apart from the distance to the server itself: an open
   * task took a second on the deployment and a tenth of that here, and the
   * question was which leg it was spent on. The best of three, so a cold
   * connection does not answer for a warm one.
   */
  let db: number | undefined
  if (c.req.query('db') === '1') {
    const times: number[] = []
    for (let i = 0; i < 3; i++) {
      const t = performance.now()
      await sql`select 1`
      times.push(performance.now() - t)
    }
    db = Math.round(Math.min(...times) * 10) / 10
  }
  return c.json({
    ok: true,
    api_version: API_VERSION,
    /* The release (`server/src/version.ts`), which `scripts/update.sh`
       waits to see before it calls an update done. */
    version: VERSION,
    commit: COMMIT,
    ...(db !== undefined ? { db_ms: db } : {}),
    /* Where uploads live and where readers fetch them from — the two facts
       about this deployment that cannot be told from outside, and the
       difference between files that survive a deploy and files that do
       not. Names, never credentials. */
    storage: whereBytesGo() ? 'bucket' : 'disk',
    links: whereLinksGo(),
  })
})

/*
 * How long the server spent on each answer, in the response itself.
 *
 * The browser's network panel draws it beside the request, which separates
 * the time somebody waited on the server from the time they waited on the
 * wire — the two were one number, and the second is the one no code fixes.
 */
app.use('/api/*', async (c, next) => {
  const t = performance.now()
  await next()
  try {
    c.res.headers.set('server-timing', `app;dur=${Math.round(performance.now() - t)}`)
  } catch {
    // A response whose headers are fixed keeps them; the timing is a nicety.
  }
})

/* ---------------------------------------------------------------- auth */

/*
 * A name and an address. No
 * password: one is chosen from the letter, after the address is proved.
 * The apps' builds from before the password came after the proof still send `password`, and
 * `z.object` drops what it does not name, so they get the same letter.
 */
const Register = z.object({
  email: z.email(),
  name: z.string().max(200).transform(oneLine).pipe(z.string().min(1)),
  /* Left out, called after the name, as a sign-up through Google is. */
  workspace_name: z.string().max(200).transform(oneLine).pipe(z.string().min(1)).optional(),
  /* The shape every address has — `workspace_slug_allowed` in the database
     says the same and has the last word. */
  workspace_slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    .optional(),
})

/* `email` and `approve` for the app builds that decode this answer as
   another `{ email, approve }` — `Pending` in `shared-schema`. */
const pending = (email: string) => ({ pending: true, email, approve: false })

const PASSWORD_NOT_HERE = {
  error: { code: 'password_not_here', message: 'Passwords aren’t used here. Sign in with a code sent to your email.' },
} as const

/*
 * Signing up.
 * An account with no password and its workspace, and no session: a letter
 * goes to the address, and choosing a password from it is what signs in.
 * The answer is the same whether the address is new or already has an
 * account, which is told so in its own inbox rather than on the screen of
 * whoever typed it. Either way this browser is named (`bindBrowser`), so
 * the password chosen here signs in here — and so the answer's headers say
 * nothing about which it was.
 */
app.post('/auth/register', async (c) => {
  const body = Register.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) {
    return c.json({ error: { code: 'invalid', details: body.error.issues } }, 400)
  }
  /* Twenty a quarter of an hour from one address: a sign-up sends mail, and
     a form that sends mail is a way to send mail to anybody. */
  const from = clientOf(c)
  if (!onThisMachine(from) && !(await spendOn(`register:${from}`, 20, 900))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
  }
  /* Closed on your own server: said before whether the address has an
     account, so the answer is the same for every address. */
  if (!(await signUpOpen())) return c.json(SIGN_UP_CLOSED, 403)
  const email = body.data.email.toLowerCase()
  const [had] = await authSql()<{ actor_id: string }[]>`select actor_id from auth_lookup_user(${email})`
  if (had) {
    await sendAlreadyHere(c, had.actor_id, email)
    await bindBrowser(c, had.actor_id)
    return c.json(pending(email), 202)
  }
  const asked = {
    email,
    name: body.data.name,
    workspace_name: body.data.workspace_name ?? ownWorkspaceName(body.data.name),
  }
  /* A workspace address asked for and taken is not said: a known address
     answers 202 whatever it asked, so a new one does too, with the next
     free address made from the name. And the same email made a moment ago
     by another request is a known address, which that request has told. */
  const taken = (e: unknown) => ['23505', '23514'].includes((e as { code?: string }).code ?? '')
  let actorId: string
  try {
    actorId = await signUp({ ...asked, workspace_slug: body.data.workspace_slug }).catch((e: unknown) => {
      if (body.data.workspace_slug && taken(e)) return signUp(asked)
      throw e
    })
  } catch (e) {
    /* Closed between the question above and the account: the database's
       answer is the one that counts. */
    if (isClosed(e)) return c.json(SIGN_UP_CLOSED, 403)
    if (taken(e)) {
      const [now] = await authSql()<{ actor_id: string }[]>`select actor_id from auth_lookup_user(${email})`
      if (now) await bindBrowser(c, now.actor_id)
      return c.json(pending(email), 202)
    }
    throw e
  }
  await sendChoosePassword(c, actorId, email)
  await bindBrowser(c, actorId)
  return c.json(pending(email), 202)
})

app.post('/auth/login', async (c) => {
  /* No password is typed on a workspace's own domain: whoever controls its
     DNS could serve a copy of this page there. A code to the address, or a
     provider through usetuff.com. Decided by
     the signed host, never by the page. */
  if (hostOf(c)) return c.json(PASSWORD_NOT_HERE, 403)
  const body = z
    .object({ email: z.email(), password: z.string(), totp: z.string().optional(), nowhere: z.boolean().optional() })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  /*
   * Ten wrong answers for one account from one address in a quarter of an
   * hour, and that address waits — a password or a second-factor code.
   * Counted only when wrong, so somebody signing in all day is never
   * stopped, and per address, so somebody else's guessing does not stop
   * them either (`guess`). Counted before the password is read and given
   * back when it was right, so a burst sent at once is counted too.
   */
  const tried = await guess(body.data.email, c)
  if (!tried.ok) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
  }
  const { nowhere: canShowNowhere, ...given } = body.data
  const session = await login(given, metaOf(c))
  if (session && !(session === 'totp_required' && body.data.totp)) await tried.right()
  if (!session) return c.json({ error: { code: 'unauthorized' } }, 401)
  if (session === 'totp_required') {
    return c.json({ error: { code: 'totp_required', message: 'Enter the code from your authenticator app.' } }, 401)
  }
  /* The password is right and the address is not confirmed — an account
     from before the password came after the proof, or one a link with no address made: the letter
     goes to it, and the screen says to look. Confirming takes this
     password (migration 212), so the letter asks for one. */
  if ('unconfirmed' in session) {
    await sendChoosePassword(c, session.unconfirmed, body.data.email.toLowerCase())
    // This browser has the password: the link signs it in.
    await bindBrowser(c, session.unconfirmed)
    return c.json({ error: { code: 'email_unverified', message: 'Confirm your email first. Check your inbox for the link.' } }, 403)
  }
  /* Right password, right code, and in no workspace: a session for nowhere
     to a client that can show its screen, said to one that cannot. */
  if ('nowhere' in session) {
    if (canShowNowhere) return c.json(await startNowhereSession(session.nowhere, { ...metaOf(c), since: session.since }))
    return c.json(NO_WORKSPACE_YET, 403)
  }
  return c.json(session)
})

app.post('/auth/refresh', async (c) => {
  const body = z.object({ refresh_token: z.string() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const session = await refresh(body.data.refresh_token, metaOf(c))
  if (!session) return c.json({ error: { code: 'unauthorized' } }, 401)
  /* On a workspace's own domain, only a session made on it, in its
     workspace: anything else asked here is nobody — `host.ts`. */
  const host = hostOf(c)
  if (host && 'access_token' in session) {
    const claims = await verifyAccessToken(session.access_token)
    if (!claims || claims.host !== host.hostname || claims.workspace_id !== host.workspaceId) {
      await logout(session.refresh_token)
      return c.json({ error: { code: 'unauthorized' } }, 401)
    }
  }
  /* Removed from the workspace the session was in: said, with which one,
     so the device clears what it kept of it and tells them —
     `docs/specs/removing-someone.md`, "On their devices". */
  if ('removed' in session) {
    /* And what the browser holds of it goes, as on signing out: its pass
       to the workspace's files, and the files it kept under their signed
       addresses. */
    for (const h of cookieHeaders(null)) c.header('set-cookie', h, { append: true })
    c.header('clear-site-data', '"cache"')
    return c.json({ error: { code: 'removed', message: 'You are no longer in this workspace.', workspace: session.removed } }, 401)
  }
  return c.json(session)
})

app.post('/auth/logout', async (c) => {
  const body = z.object({ refresh_token: z.string() }).safeParse(await c.req.json().catch(() => ({})))
  if (body.success) await logout(body.data.refresh_token)
  // And the browser's pass to its files goes with the session.
  for (const h of cookieHeaders(null)) c.header('set-cookie', h, { append: true })
  /* And the files it kept: a picture or a PDF opened is held a year under
     its signed address, and opened again from history after signing out
     with no request at all. */
  c.header('clear-site-data', '"cache"')
  return c.json({ ok: true })
})

app.route('/auth', publicInvites)
/* Google, Apple, and a forgotten password. */
app.route('/auth', access)
/* Your own server's first opening, behind its setup link; nothing on the
   service. */
app.route('/auth', setup)
/* Back from installing the Tuff app on GitHub. */
app.route('/', githubReturns)
/* Back from adding the Tuff app to Slack. */
app.route('/', slackReturns)

/* --------------------------------------------------------------- signed in */

/**
 * The bearer token, on everything but the one route that is reached by link.
 *
 * `/api/blob/:key` carries its own authorisation: a signature over the key
 * and an expiry, checked in the handler. That was written and never reached
 * — the route sits under `/api/*`, an `<img src>` sends no `Authorization`
 * header, and this middleware answered 401 before the signature was looked
 * at. Every project icon and every uploaded file has failed to load in a
 * browser for as long as both have existed.
 *
 * It was invisible because a broken `<img>` is still an element: it is in
 * the layout, `toBeVisible` is true of it, and the test that uploads a
 * picture passed on the placeholder. The only sign was a 401 in the console
 * of a run where everything was green.
 *
 * Exempted by path rather than made public: the signature is short-lived and
 * covers the key, so a link out of a screenshot stops working — which is the
 * property the whole thing was for.
 */
app.route('/api/public', publicDocs)
/* What the edition answers before anybody signs in, if anything.
   `edition.ts`. */
edition.open(app)
/* A project's feedback page, for anybody. Words
   only, and few of them. */
app.use('/api/f/*', bodyLimit({ maxSize: 16 * 1024, onError: (cc) => cc.json({ error: { code: 'too_large' } }, 413) }))
app.route('/api/f', feedbackPublic)
/* A session in no workspace, answered on its short list and refused
   everywhere else, before the check every other request goes through —
   which would refuse it anyway. */
app.route('/api', nowhere)
app.use('/api/*', async (c, next) => {
  /* And a link card's picture, which an `<img>` asks for with no header
     either — signed over its address instead. `preview.ts`. */
  if (c.req.path.startsWith('/api/blob/') || c.req.path === '/api/preview/image') return next()
  /* A document shared to the web, read by its token. */
  if (c.req.path.startsWith('/api/public/')) return next()
  /* A feedback page, asked by anybody. Answered above; never past here. */
  if (c.req.path.startsWith('/api/f/')) return next()
  /* What the edition answered above before anybody signs in; never past here. */
  if (edition.openApi(c.req.path)) return next()
  const ctx = await authenticate(c.req.header('authorization'))
  if (!ctx) return c.json({ error: { code: 'unauthorized' } }, 401)
  /* On a workspace's own domain, a session made there for its workspace
     and nothing else: any other token is as one that has ended. */
  if (!usableHere(c, ctx)) return c.json({ error: { code: 'unauthorized' } }, 401)
  /* And a session made on a host never reaches what belongs to the
     account rather than the workspace: the password, the address, the
     second factor, the devices signed in, the ways in, an agent's
     connection, the account's data and its deletion — wherever it is used. */
  if (ctx.host && !inviteOnItsHost(c) && (ACCOUNT_ONLY.test(c.req.path) || (c.req.method !== 'GET' && SENT_OUT.test(c.req.path))))
    return c.json(NOT_ON_A_HOST, 403)
  /* A token held back by the edition does nothing, and says why, to the
     agent holding it — which says it to the person. On your own server,
     never. */
  const held = ctx.viaMcp ? agentsHeld(ctx) : null
  if (held) return c.json(held, 403)
  /* Kept short: it travels inside an 8 kB NOTIFY payload with the event. */
  const tab = c.req.header('x-tab')
  c.set('ctx', tab ? { ...ctx, tab: tab.slice(0, 32) } : ctx)
  /* A token made for some projects keeps to them in every transaction this
     request makes as its person. */
  await bounded(ctx, next)
})

/* What belongs to the account, never to a session made on a host. */
const ACCOUNT_ONLY =
  /^\/api\/(me\/(password|email|inbox-code|ways-in|delete|export|invitations|unconfirmed)|github\/me|2fa|sessions|oauth\/authorize|invite|push)(\/|$)/
/* And, from a project, a link that sends its work out of the workspace — a
   Slack channel, a GitHub repository — made or taken away. */
const SENT_OUT = /^\/api\/projects\/[^/]+\/(slack|github)$/
/*
 * But one invitation's preview, read on the host itself: the host's
 * allow-list has already matched it to the host's workspace, and found it
 * open (`cloud/domains/hosts.ts`). Only reading — so a member who follows
 * their own link is shown the way in; joining as oneself stays the
 * account's, refused here.
 */
const inviteOnItsHost = (c: Context) => c.req.method === 'GET' && hostOf(c) !== null && /^\/api\/invite\/[^/]+$/.test(c.req.path)
const NOT_ON_A_HOST = {
  error: { code: 'not_on_a_host', message: 'Open Tuff at usetuff.com to change this.' },
} as const

// After authentication, because who is asking is what the ceiling is per.
app.use('/api/*', rateLimit)

/*
 * What the request was, told to the edition once it is answered — on your
 * own server, nothing. The route's pattern, never the address:
 * after `next`, Hono's route is the handler that answered. A next page of
 * a list is the same look, so a request with a cursor is not told. An
 * agent's tool is named only by a token, never believed from anybody else.
 */
app.use('/api/*', async (c, next) => {
  await next()
  const ctx = c.get('ctx')
  if (!ctx || c.req.query('cursor')) return
  try {
    edition.used({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      said: usedAs(c),
      tool: ctx.viaMcp ? (c.req.header('x-mcp-tool') ?? null) : null,
    })
  } catch {
    // Counting never costs anybody an answer.
  }
})

/*
 * Refused to somebody whose address nobody has proved: said as that, so the
 * screen can say what to do. `can()`
 * decided it; this only words the refusal, for every handler at once.
 */
app.use('/api/*', async (c, next) => {
  await next()
  if (c.res.status !== 403 || !c.get('ctx')?.unproved) return
  const said = (await c.res
    .clone()
    .json()
    .catch(() => null)) as { error?: { code?: string } } | null
  if (said?.error?.code !== 'forbidden') return
  c.res = new Response(JSON.stringify(UNPROVED), { status: 403, headers: { 'content-type': 'application/json' } })
})

/*
 * The browser's pass to its files, kept fresh by being signed in.
 *
 * Any signed-in answer carries it when it is missing, names somebody else,
 * or has under a day left — so a page in use always has one, and nothing on
 * the client has to remember to ask. `storage.ts`, `linkForReader`.
 */
app.use('/api/*', async (c, next) => {
  await next()
  const ctx = c.get('ctx')
  if (!ctx || ctx.viaMcp) return
  const had = (c.req.header('cookie') ?? '')
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${FILE_COOKIE}=`))
    ?.slice(FILE_COOKIE.length + 1)
  const now = readFileCookie(had)
  if (now && now.actorId === ctx.actorId && now.left > 86_400) return
  try {
    /* Made again with the cookies in it, not appended: appended, the
       running server dropped them from every GET — `afterward.ts`. */
    addCookies(c, cookieHeaders(fileCookie(ctx.actorId)))
  } catch {
    // An answer that cannot take a header now: the next answer sets it.
  }
})

/**
 * Who I am and what I may do.
 *
 * The action list is here so the interface can hide buttons it would only be
 * told off for pressing. It is a convenience, not the decision: every endpoint
 * asks again.
 */
app.get('/api/me', async (c) => {
  const ctx = c.get('ctx')
  const me = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [actor] = await tx<
      {
        id: string
        name: string
        avatar_key: string | null
        presence: string
        chosen: string | null
        title: string | null
        timezone: string | null
        language: string | null
      }[]
    >`
      select id, name, avatar_key, title,
             -- What they read the product in, null for never said:
             (select u.language from app_user u where u.actor_id = actor.id) as language,
             -- The zone quiet hours and a colleague's card use, so the
             -- browser can say where it is while this is still the default:
             -- docs/specs/person-card.md.
             (select u.timezone from app_user u where u.actor_id = actor.id) as timezone,
             -- What everybody else sees, and separately what was chosen, so
             -- the menu can show which of the three is ticked. Null chosen is
             -- "work it out" -- docs/specs/presence.md.
             presence_of(seen_at, presence) as presence, presence as chosen
      from actor where id = ${ctx.actorId}`
    const [ws] = await tx<
      { id: string; name: string; slug: string; mark_icon: string | null; mark_tint: number | null; icon_key: string | null }[]
    >`
      select id, name, slug, mark_icon, mark_tint, icon_key from workspace where id = ${ctx.workspaceId}`
    /* Its mark, for the switcher. */
    const workspace = ws
      ? {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          mark_icon: ws.mark_icon,
          mark_tint: ws.mark_tint,
          icon_url: ws.icon_key ? linkFor(ws.icon_key) : null,
          /* Its own name and mark, worn in Tuff's place where its plan
             says so — the tab's icon and title, Settings' line. */
          brand: await brandHere(tx, ws.id),
          /* Where its own links point: its domain, when it has one on a
             branded plan. */
          origin: edition.hosts ? await edition.hosts.originOf(tx, ws.id) : null,
        }
      : ws
    return { actor: actor ? faced(actor) : actor, workspace }
  })
  return c.json({
    ...me,
    role: ctx.role,
    /* The plan the workspace is on, where the edition has plans. */
    ...planSaid(ctx),
    settings: ctx.settings,
    via_mcp: ctx.viaMcp,
    can: allowedActions(ctx, { inProject: true, isAuthor: true }),
    /* On a host's session, what the person's role allows at usetuff.com and
       this session may not do — so the app can point there rather than
       hide it. Worked out here,
       never by the page. */
    ...(ctx.host ? { can_off_host: offHostActions(ctx, { inProject: true, isAuthor: true }) } : {}),
    /* The server's version and a newer release, for its owners alone, so
       the bar can mark a security release on their face — `updates.ts`.
       Absent for everybody else, and always on the service, where
       `instance` is nobody's. */
    ...(allow(ctx, 'instance') ? { server: await serverVersion(ctx.actorId, ctx.workspaceId) } : {}),
    /* The domain this session was made on: it sees this workspace only. */
    host: ctx.host ?? null,
  })
})

/**
 * What somebody is called and what they do, in their own words.
 * Theirs alone to
 * set; an empty title takes it off, and an empty name is not a name.
 *
 * The name never through a token: an agent does not rename the person it
 * acts for, any more than it sets their face.
 */
app.patch('/api/me', async (c) => {
  const ctx = c.get('ctx')
  const body = z
    .object({
      title: z.string().max(80).nullable().optional(),
      name: z.string().max(200).optional(),
      language: z.enum(['en', 'fr']).nullable().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  /* Never through a token, like the name: what a person reads their mail
     in is theirs to say, not their agent's. */
  if (body.data.language !== undefined && ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  const name = body.data.name === undefined ? undefined : oneLine(body.data.name)
  if (body.data.name !== undefined) {
    if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
    if (!name) return c.json({ error: { code: 'invalid', message: 'Enter your name.' } }, 400)
  }
  const title = body.data.title === undefined ? undefined : body.data.title?.trim() || null
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (name) await tx`update actor set name = ${name}, updated_at = now() where id = ${ctx.actorId}`
    if (title !== undefined) await tx`update actor set title = ${title}, updated_at = now() where id = ${ctx.actorId}`
    if (body.data.language !== undefined) {
      await tx`update app_user set language = ${body.data.language} where actor_id = ${ctx.actorId}`
    }
  })
  return c.json({
    ok: true,
    ...(name ? { name } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(body.data.language !== undefined ? { language: body.data.language } : {}),
  })
})

/**
 * Which of the three somebody wants to be — `docs/specs/presence.md`.
 *
 * `null` is "work it out", which is the default and the only one of the
 * three that can be wrong about them; the other two are what they said.
 * Through a token it is refused: an agent is not a person who is here, and
 * a tool that can set its owner to Do not disturb is a tool that can make
 * somebody unreachable without their knowing.
 */
app.post('/api/me/presence', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  const body = z.object({ presence: z.enum(['away', 'busy']).nullable() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  await chose(ctx.actorId, ctx.workspaceId, body.data.presence)
  return c.json({ ok: true })
})

/**
 * A person's own picture.
 *
 * No permission beyond being signed in: a face is the one thing here that is
 * yours without a role saying so, and there is nobody else this endpoint
 * could be changing. Refused through a token for the same reason presence is
 * — an agent is not a person and has no face to set.
 *
 * The bytes go where every other upload goes and the row keeps a key, not a
 * link. `docs/specs/avatar.md` says why the `avatar_url` column beside it is
 * left alone: a text field of that name is an invitation to store a URL
 * pointing out of the product, and there are no public URLs here.
 */
app.post('/api/me/avatar', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  /* Thirty pictures an hour a person: the bytes a changed picture leaves
     go an hour later, and a loop of uploads was storage nobody counted. */
  if (!(await spendOn(`picture:${ctx.actorId}`, 30, 3600))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many picture uploads. Try again later.' } }, 429)
  }

  const form = await c.req.formData().catch(() => null)
  const picked = form?.get('file')
  if (!(picked instanceof File)) return c.json({ error: { code: 'invalid' } }, 400)
  // The project icon's limit, so there is one answer to how big a picture is.
  if (picked.size > 2 * 1024 * 1024) {
    return c.json({ error: { code: 'too_large', message: 'Images can be up to 2 MB.' } }, 413)
  }
  /* What a browser can draw, and nothing else, by its bytes — never the
     type the form says (`rasterOf`). The web turns an SVG into a PNG
     before sending it. `data/picture.ts`. */
  const bytes = new Uint8Array(await picked.arrayBuffer())
  const type = rasterOf(bytes)
  if (!type) return c.json({ error: { code: 'invalid', message: 'Use a PNG, JPEG, GIF or WebP image.' } }, 400)
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const stored = await put(ctx.workspaceId, bytes, type)
    await tx`update actor set avatar_key = ${stored.key} where id = ${ctx.actorId}`
  })
  /* Nothing recorded. A project's icon is logged because a project is shared
     and its history is read by people who did not change it; a person
     changing their own face has no second party to tell, and a line for it
     would be a record of somebody's appearance nobody asked to keep. */
  return c.json({ ok: true })
})

/** Back to the letter, which was never a placeholder. */
app.delete('/api/me/avatar', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    await tx`update actor set avatar_key = null where id = ${ctx.actorId}`
  })
  return c.json({ ok: true })
})

/* -------------------------------------------------------------- sessions */

/**
 * Where this account is signed in, and ending one from here.
 *
 * "End the one on the laptop I left at the office" is the whole point, and it
 * cannot work if you cannot see the list. A session row is a credential, so
 * the application role cannot select it — both of these go through definer
 * functions scoped to the person asking.
 */
app.get('/api/sessions', async (c) => {
  const ctx = c.get('ctx')
  const [rows, here] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    async (tx) =>
      [
        await tx<{ id: string; device: string | null }[]>`select * from auth_sessions(${ctx.actorId})`,
        ctx.sessionId
          ? ((await tx<{ device: string | null }[]>`select auth_device_of(${ctx.actorId}, ${ctx.sessionId}) as device`)[0]?.device ?? null)
          : null,
      ] as const,
  )
  /* Which line is the browser asking: its own session, or another of its
     tabs'. The device id is the browser's own,
     so it is not sent back. */
  return c.json({
    sessions: rows.map(({ device, ...r }) => ({
      ...r,
      current: r.id === ctx.sessionId || (here !== null && device === here),
    })),
  })
})

/* Every other device, signed out at once: the one asking stays. */
app.delete('/api/sessions', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json({ error: { code: 'forbidden' } }, 403)
  const [r] = await asAuthActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx<{ n: number }[]>`select auth_revoke_others(${ctx.actorId}, ${ctx.sessionId!}) as n`,
  )
  return c.json({ ok: true, ended: r?.n ?? 0 })
})

app.delete('/api/sessions/:id', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  const done = await asAuthActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`
      select auth_revoke_session(${ctx.actorId}, ${c.req.param('id')}) as ok`
    return r?.ok ?? false
  })
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/*
 * The clear-out is the worker's (`pnpm worker`), on its own schedule. It was
 * also an endpoint any workspace's owner could call, and the function under
 * it clears every workspace at once — so anybody who signed up could shrink
 * everybody's thirty days to one.
 */

/* ---------------------------------------------------------- second factor */

/**
 * Enrolling is three steps because the middle one is the point.
 *
 * Begin stores a secret and leaves the factor off; enable turns it on only
 * for somebody who has already produced a code from it. Nobody ends up with
 * the factor on and a secret they never managed to scan — an account its
 * owner cannot reach is worse than one without a second factor.
 */
app.get('/api/2fa', async (c) => {
  const me = c.get('ctx').actorId
  const [state, asks] = await Promise.all([totpState(me), asksOf(me)])
  /* What turning it on and off asks beside the factor's own code: the
     password, or six digits from the inbox for an account that has none. */
  return c.json({ ...state, proof: asks.password ? 'password' : 'email' })
})

const FactorProof = z.object({ password: z.string().max(1024).optional(), code: z.string().max(64).optional() })

/*
 * Only a session of the person's own changes the second factor —
 * positively, as entering a workspace refuses: a token for a tool, GitHub's,
 * an import's or a feedback page's, and any kind added later, is refused.
 */
const notASession = (ctx: AuthContext) => !ctx.sessionId || ctx.viaMcp || ctx.viaGithub || ctx.viaImport || ctx.feedbackPage

app.post('/api/2fa/begin', async (c) => {
  const ctx = c.get('ctx')
  if (notASession(ctx)) return c.json({ error: { code: 'forbidden' } }, 403)
  const body = FactorProof.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const me = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ email: string }[]>`
      select email from app_user where actor_id = ${ctx.actorId}`
    return r
  })
  if (!me) return c.json({ error: { code: 'not_found' } }, 404)
  /* Not for an address nobody has proved — a link with no address, followed
     with somebody's: a factor its owner never set would stand between them
     and their account. */
  if (!(await confirmed(ctx.actorId)))
    return c.json({ error: { code: 'email_unverified', message: 'Confirm your email first. Check your inbox for the link.' } }, 403)
  /*
   * Not over a factor already on. Beginning wrote a new secret and switched
   * the factor off on the spot — so anybody holding a session, without the
   * password, could take it off and put their own on. Turning it off asks
   * for the password; beginning again comes after that.
   */
  if ((await totpState(ctx.actorId)).enabled) {
    return c.json({ error: { code: 'conflict', message: 'Turn off two-factor authentication first. You’ll need your password.' } }, 409)
  }
  /*
   * Asked again, as every change to how this account signs in is: a
   * session alone turned the factor on, and then it was the only proof a
   * change of address asked — an account made through Google was taken
   * whole, and one with a password locked out. The password,
   * or for an account with none, six digits sent to its inbox for this.
   * Counted on the key every re-ask counts on.
   */
  const tries = await reask(ctx.actorId)
  if (!tries.ok) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
  }
  const asks = await asksOf(ctx.actorId)
  const given = asks.password ? body.data.password : body.data.code
  if (!given) {
    await tries.right()
    /* An app from before beginning asked who it was sends `{}` and no
       Origin: it is told where it can be done, never let through. */
    if (!body.data.password && !body.data.code && !c.req.header('origin')) {
      return c.json(
        {
          error: {
            code: asks.password ? 'password_required' : 'code_required',
            message: 'Set up two-factor authentication from Account in your browser, or update the app.',
          },
        },
        403,
      )
    }
    return asks.password
      ? c.json({ error: { code: 'password_required', message: 'Enter your password.' } }, 403)
      : c.json({ error: { code: 'code_required', message: 'Enter the code we emailed you.' } }, 403)
  }
  const yes = asks.password
    ? await itIsThem(ctx.actorId, me.email, { password: true, code: false }, { password: given })
    : await codeFromInbox(ctx.actorId, given, 'twofa')
  if (!yes) {
    /* 403, not 401: a mistyped password is not a reason to be signed out. */
    return c.json({ error: { code: asks.password ? 'wrong_password' : 'wrong_code', message: 'That didn’t match. Try again.' } }, 403)
  }
  await tries.right()
  const begun = await beginTotp(ctx.actorId, me.email)
  /* Turned on between the look above and the write: the write asks too. */
  if (!begun) {
    return c.json({ error: { code: 'conflict', message: 'Turn off two-factor authentication first. You’ll need your password.' } }, 409)
  }
  return c.json(begun)
})

app.post('/api/2fa/enable', async (c) => {
  const ctx = c.get('ctx')
  if (notASession(ctx)) return c.json({ error: { code: 'forbidden' } }, 403)
  const body = z.object({ code: z.string() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  /*
   * Not over a factor that is on. This answered whatever the state, so a
   * session could guess at the factor here — uncounted — and a hit dealt
   * a fresh set of recovery codes. Wrong codes count as every
   * re-ask does; the codes are dealt only on the turn from off to on.
   */
  if ((await totpState(ctx.actorId)).enabled) {
    return c.json({ error: { code: 'conflict', message: 'Two-factor authentication is already on.' } }, 409)
  }
  const tries = await reask(ctx.actorId)
  if (!tries.ok) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
  }
  const codes = await enableTotp(ctx.actorId, body.data.code)
  if (codes === 'on') {
    await tries.right()
    return c.json({ error: { code: 'conflict', message: 'Two-factor authentication is already on.' } }, 409)
  }
  if (!codes) return c.json({ error: { code: 'wrong_code' } }, 400)
  await tries.right()
  /* Begun more than a quarter of an hour ago — left, or begun before
     beginning asked who it was: begun again, with the proof. */
  if (codes === 'expired') return c.json({ error: { code: 'expired', message: 'Start again.' } }, 400)
  /* The address is told, and how to take it off if it wasn't them. A mail
     that did not go is said in the log — the account, not the address. */
  await tellFactorOn(origin(c), ctx.actorId, heard(c)).catch((e) => {
    console.error(`[2fa] the note that the factor is on was not sent to ${ctx.actorId}:`, (e as Error).message)
  })
  // The only moment they exist in readable form anywhere.
  return c.json({ recovery_codes: codes })
})

app.post('/api/2fa/disable', async (c) => {
  const ctx = c.get('ctx')
  if (notASession(ctx)) return c.json({ error: { code: 'forbidden' } }, 403)
  /* `email_code` in the password's place for an account with none: six
     digits from `/api/me/inbox-code` `{ for: 'twofa-off' }`. */
  const body = z
    .object({ password: z.string().max(500).optional(), email_code: z.string().max(64).optional(), code: z.string().max(40).optional() })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  /* Counted as every other door that asks the password again counts it:
     uncounted, a session held for a minute guessed the password here at
     the person's whole request ceiling. */
  const tries = await reask(ctx.actorId)
  if (!tries.ok) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
  }
  /* Without a code it is asked for, as signing in asks: an app from before
     the code was asked sends only the password, and is told what is missing. */
  if (!body.data.code) {
    await tries.right()
    return c.json({ error: { code: 'totp_required', message: 'Enter a code from your authenticator app.' } }, 403)
  }
  const done = await disableTotp(ctx.actorId, { password: body.data.password, emailCode: body.data.email_code }, body.data.code)
  if (done !== 'ok') {
    return c.json({ error: { code: done } }, 403)
  }
  await tries.right()
  return c.json({ ok: true })
})

/*
 * The workspace's switches, and what it is called and looks like — the
 * owner's, as the plan is.
 */
const WorkspaceChange = WorkspaceSettings.partial().extend({
  name: z.string().max(80).transform(oneLine).pipe(z.string().min(1)).optional(),
  mark_icon: MarkIcon.nullable().optional(),
  mark_tint: MarkTint.nullable().optional(),
})

app.patch('/api/workspace', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'workspace.billing')) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  const body = WorkspaceChange.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const { name, mark_icon, mark_tint, ...switches } = body.data

  const next = { ...ctx.settings, ...switches }
  const switched = Object.keys(switches).length > 0
  const looks = name !== undefined || mark_icon !== undefined || mark_tint !== undefined
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (switched) {
      await tx`update workspace set settings = ${tx.json(next as never)} where id = ${ctx.workspaceId}`
      // Changing a switch is written to the audit log: the design asks for it by
      // name, and a permission change nobody can trace is the one that matters.
      await tx`
        insert into activity_event (id, workspace_id, actor_id, action, origin, meta)
        values (${uuidv7()}, ${ctx.workspaceId}, ${ctx.actorId}, 'workspace.settings',
                ${ctx.viaMcp ? 'mcp' : 'web'}, ${tx.json({ from: ctx.settings, to: next } as never)})`
    }
    if (looks) {
      await tx`
        update workspace set
          name = coalesce(${name ?? null}::text, name),
          mark_icon = case when ${mark_icon !== undefined} then ${mark_icon ?? null}::text else mark_icon end,
          mark_tint = case when ${mark_tint !== undefined} then ${mark_tint ?? null}::smallint else mark_tint end,
          updated_at = now()
        where id = ${ctx.workspaceId}`
    }
  })
  return c.json({ settings: next })
})

app.route('/api', invites)
/* Workspaces joined before the proof. */
app.route('/api', confirming)
app.route('/api', workspaces)
app.route('/api', projects)
app.route('/api', people)
app.route('/api', tokens)
app.route('/api', posts)
app.route('/api', tasks)
app.route('/api', blocks)
app.route('/api', files)
app.route('/api', versions)
app.route('/api', search)
app.route('/api', chat)
app.route('/api', roomHooks)
app.route('/api', inbox)
app.route('/api', overview)
app.route('/api', webhooks)
/* Before the closed general import, whose `/import/:kind` would answer
   Linear's door with its 410. */
app.route('/api', linearImport)
app.route('/api', otherImport)
app.route('/api', csvImport)
app.route('/api', importer)
app.route('/api', audit)
app.route('/api', comments)
app.route('/api', push)
app.route('/api', places)
app.route('/api', labels)
app.route('/api', yourData)
app.route('/api', preview)
app.route('/api', address)
app.route('/api', waysIn)
app.route('/api', agents)
/* What an agent did this week. */
app.route('/api', agentWork)
app.route('/api', password)
app.route('/api', ownership)
app.route('/api', oauthApi)
app.route('/api', githubApi)
app.route('/api', slackApi)
app.route('/api', feedback)
/* Your own server's owner screen — 404 on the service. */
app.route('/api', instanceApi)
/* What only the edition has, signed in, if anything. `edition.ts`. */
edition.api(app)
app.route('/', githubHooks)
app.route('/', incomingHooks)
app.route('/', slackHooks)
app.route('/', oauth)
app.route('/', apple)
app.route('/', android)
app.route('/', remote)
/* Where an agent finds the API and the MCP server. */
app.route('/', discovery)
/* And outside `/api` with nobody signed in behind it, if anything. */
edition.outside(app)

app.notFound((c) => c.json({ error: { code: 'not_found' } }, 404))
