import postgres from 'postgres'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inlineScripts, pageHeaders } from '@tracker/shared-schema'
import { join, relative, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createNodeWebSocket } from '@hono/node-ws'
import type { WSContext } from 'hono/ws'
import type { Context } from 'hono'
import { app } from './http/routes.js'
import { offeredProviders, providersMeta, providersNow } from './http/access.js'
import { whereBytesGo } from './storage.js'
import { env } from './env.js'
import { mailFrom, mailOn } from './mail.js'
import { webPushConfigured } from './push.js'
import { pushKeyLine, vapidPair } from './pushKey.js'
import { alive, authenticate, type AuthContext } from './auth/context.js'
import { subscribe } from './realtime.js'
import { authSql, sql } from './db.js'
import { guardRls } from './rlsGuard.js'
import { needSiteUrl } from './publicUrl.js'
import { hostHears, mayListen, mayWatch, tokenHears } from './listening.js'
import { here } from './presence.js'
import { typed } from './typing.js'
import * as coedit from './coedit.js'
import { BackupFailed, migrateWithBackup, noteVersion } from './backup.js'
import { running } from './updates.js'
import { edition } from './edition.js'
import { serverClaimed, signUpOpen } from './instance.js'
import { readMarkdown } from './mcp/markdownPool.js'
import { startWatchdog } from './watchdog.js'
import { hostOf, hostPage, usableHere } from './host.js'

/* Every error line to where somebody is told — the edition's to say where. */
edition.watchErrors('server')
/* A stalled loop said once past two seconds, and the process ended past
   thirty so Railway starts another. */
startWatchdog('server')

const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app })
/*
 * The largest frame any socket reads — a document's update and its
 * envelope. `ws` reads a hundred megabytes by
 * default, and a frame is held whole and parsed before anything here can
 * look at its length. Every other socket takes in a word or two.
 */
wss.options.maxPayload = coedit.MAX_FRAME

/**
 * A socket held on a topic for as long as it is open.
 *
 * Three things every socket needs and each of the three had to remember
 * alone, and none did:
 *
 * - **A word every twenty-five seconds.** A connection with nothing on it
 *   can be dropped by something in between without either end being told,
 *   and the page goes on looking live. The word keeps it from looking idle,
 *   and its absence is how the page knows to open again.
 * - **Closed when the subscription is gone** — `again` from the listener,
 *   which was deaf for a while: the page reopens and reads itself.
 * - **Let go even when it closes first.** A socket closed while its checks
 *   were still running used to subscribe afterwards and never unsubscribe.
 */
/*
 * Sixty sockets open at once for one person, whatever opened them.
 *
 * A socket is a timer, a subscription and a file descriptor for as long as
 * it is held, and holding one cost nothing: a script with one token could
 * open them until the process ran out. Sixty is three a tab across twenty
 * tabs, past anybody's day.
 */
const SOCKETS_EACH = 60
const sockets = new Map<string, number>()

function holding() {
  let gone = false
  let release: (() => void) | null = null
  /* Whose slot under the ceiling this socket holds, once it holds one. */
  let seat: string | null = null
  const take = (ws: WSContext, actorId: string): boolean => {
    if (seat !== null) return true
    const open = sockets.get(actorId) ?? 0
    if (open >= SOCKETS_EACH) {
      ws.close(4429, 'too many sockets')
      return false
    }
    sockets.set(actorId, open + 1)
    seat = actorId
    return true
  }
  const counted = () => {
    if (seat === null) return
    const n = (sockets.get(seat) ?? 1) - 1
    if (n > 0) sockets.set(seat, n)
    else sockets.delete(seat)
    seat = null
  }
  return {
    /**
     * The slot under the ceiling, taken before anything is read for the
     * socket — a document's room hands over the whole document on joining,
     * and the sixty-first socket was handed it before it was closed
     * (the night audit, 11). False, and
     * closed with 4429, past the ceiling. Given back when the socket goes.
     */
    reserve(ws: WSContext, actorId: string): boolean {
      if (gone) return false
      return take(ws, actorId)
    },
    async on(
      ws: WSContext,
      /** Null for a socket whose words are its own to say — a document's. */
      topic: string | null,
      actorId: string,
      still: () => Promise<boolean>,
      /** Whether this socket hears one word; unset, it hears them all. */
      hears?: (e: { kind: string; payload: unknown }) => Promise<boolean>,
    ): Promise<void> {
      if (gone) return
      if (!take(ws, actorId)) return
      /*
       * And every other word, the question it was opened on, asked again.
       *
       * A socket was checked when it opened and never after: somebody signed
       * out, ended from another device, reset out of their account or taken
       * off the project went on hearing it until the connection happened to
       * drop. Fifty seconds is as long as an ended session hears anything
       * now.
       */
      let beat = 0
      const tick = setInterval(() => {
        try {
          ws.send('tick')
        } catch {
          // Closing; onClose clears this.
        }
        if (++beat % 2 === 0) {
          still()
            .then((ok) => {
              if (!ok) ws.close(4401, 'ended')
            })
            .catch(() => {})
        }
      }, 25_000)
      let off: () => void = () => {}
      try {
        if (topic !== null)
          off = await subscribe(topic, (e) => {
            if (e.kind === 'again') return ws.close(1012, 'again')
            if (!hears) return ws.send(JSON.stringify(e))
            void hears(e)
              .then((yes) => {
                if (yes) ws.send(JSON.stringify(e))
              })
              .catch(() => {})
          })
      } catch {
        clearInterval(tick)
        counted()
        ws.close(1011, 'unavailable')
        return
      }
      release = () => {
        clearInterval(tick)
        counted()
        off()
      }
      if (gone) release()
    },
    off(): void {
      gone = true
      /* A slot reserved and never held — closed before `on` — goes back
         too; `counted` gives one back once, however often it is asked. */
      if (release) release()
      else counted()
    },
  }
}

/**
 * A socket subscribes to one conversation.
 *
 * Per conversation, not per workspace: the design says so, and the reason is
 * fan-out — a workspace-wide subscription wakes every device for every message
 * in every project, which is the load model that falls over first.
 *
 * The token is checked here and the membership is checked against the database,
 * so a socket cannot listen to a room the same person could not read over HTTP.
 */
/*
 * Who is at the other end of a socket, said in its first frame and not in
 * its address.
 *
 * The token travelled as `?token=` because a browser cannot set a header on
 * a WebSocket, and an address is what every proxy on the way writes in its
 * log: Cloudflare's, Railway's, ours. Now the browser opens the socket
 * bare and its first frame is `auth <token>`; nothing is subscribed until
 * that frame has been read and the token proved, and a socket that says
 * nothing for ten seconds is closed. A client that can set a header — a
 * native one — still may; and `?token=` is still read for a window opened
 * before this, until it reloads.
 */
type Signed = {
  open: (ctx: AuthContext, ws: WSContext) => void
  message?: (ctx: AuthContext, ws: WSContext, frame: string) => void
  close: () => void
}
async function signedSocket(c: Context, then: Signed) {
  const said = c.req.header('authorization') ?? (c.req.query('token') ? `Bearer ${c.req.query('token')}` : undefined)
  /* On a workspace's own domain, a session made there and nothing else —
     `host.ts`. */
  const here = (who: AuthContext | null) => (who && usableHere(c, who) ? who : null)
  let ctx: AuthContext | null = said ? here(await authenticate(said)) : null
  let told = Boolean(said)
  let waiting: ReturnType<typeof setTimeout> | undefined
  const begin = (ws: WSContext) => {
    if (!ctx) {
      ws.close(4401, 'unauthorized')
      return
    }
    then.open(ctx, ws)
  }
  return {
    onOpen(_evt: Event, ws: WSContext) {
      if (told) return begin(ws)
      waiting = setTimeout(() => ws.close(4401, 'unauthorized'), 10_000)
    },
    onMessage(evt: MessageEvent, ws: WSContext) {
      if (!told) {
        told = true
        clearTimeout(waiting)
        const frame = typeof evt.data === 'string' ? evt.data : ''
        void (frame.startsWith('auth ') ? authenticate(`Bearer ${frame.slice(5)}`) : Promise.resolve(null))
          .then((who) => {
            ctx = here(who)
            begin(ws)
          })
          .catch(() => ws.close(1011, 'unavailable'))
        return
      }
      if (ctx) then.message?.(ctx, ws, typeof evt.data === 'string' ? evt.data : '')
    },
    onClose() {
      clearTimeout(waiting)
      then.close()
    },
  }
}

/**
 * A socket on a project, for the work rather than the talking.
 *
 * The design asks for a subscription per channel **and** per project, and only
 * the channel half existed — so a task somebody else moved sat there until a
 * reload, on the one screen two people are most likely to be looking at
 * together.
 *
 * Per project rather than per workspace for the same reason as chat: a
 * workspace-wide subscription wakes every device for every change in every
 * project, which is the load model that falls over first.
 */
app.get(
  '/ws/projects/:id',
  upgradeWebSocket(async (c) => {
    const projectId = c.req.param('id') ?? ''
    const held = holding()
    return signedSocket(c, {
      open(ctx, ws) {
        void (async () => {
          if (!(await mayWatch(ctx, projectId))) {
            ws.close(4404, 'not found')
            return
          }
          await held.on(ws, `project:${projectId}`, ctx.actorId, async () => (await alive(ctx)) && (await mayWatch(ctx, projectId)))
        })().catch(() => ws.close(1011, 'unavailable'))
      },
      close() {
        held.off()
      },
    })
  }),
)

/**
 * One socket per signed-in person, for the things that are theirs.
 *
 * The other two are subscribed to only while that project or that room is on
 * the screen, so neither could tell a sidebar that a room it is drawing has
 * changed — the count was read once when the shell loaded and never again.
 *
 * Not a workspace-wide subscription, which was turned down for a good reason
 * and still is: that wakes every device for every change in every project.
 * This wakes one person for what is addressed to them, and carries a word
 * rather than a row — the shell then refetches through the endpoints it would
 * have used anyway.
 */
app.get(
  '/ws/me',
  upgradeWebSocket(async (c) => {
    const held = holding()
    return signedSocket(c, {
      open(ctx, ws) {
        /* The topic is the actor the token proves. A session hears all of
           it — it is the person, in whichever workspace they switch to.
           A token hears only the words about its own workspace, and its
           own projects when it has some: the person's other workspaces
           are not what it was made for (`listening.ts`, `tokenHears`).
           Nor are they a session's made on a workspace's own domain,
           which hears only its workspace's words (`hostHears`). */
        const hears = ctx.tokenId
          ? (e: { kind: string; payload: unknown }) => tokenHears(ctx, e)
          : ctx.host
            ? (e: { kind: string; payload: unknown }) => hostHears(ctx, e)
            : undefined
        void held.on(ws, `actor:${ctx.actorId}`, ctx.actorId, () => alive(ctx), hears)
        void here(ctx.actorId, ctx.workspaceId)
      },
      /*
       * Anything the client sends on this socket says "still here".
       *
       * The socket carries nothing else inbound, so the frame needs no
       * shape and is not read: a connection is not a person — a laptop
       * asleep with a tab open holds one for hours — and what this records
       * is that somebody is looking. `docs/specs/presence.md`.
       */
      message(ctx) {
        void here(ctx.actorId, ctx.workspaceId)
      },
      close() {
        held.off()
      },
    })
  }),
)

app.get(
  '/ws/conversations/:id',
  upgradeWebSocket(async (c) => {
    const conversationId = c.req.param('id') ?? ''
    const held = holding()
    let listening = false
    return signedSocket(c, {
      open(ctx, ws) {
        void (async () => {
          const allowed = await mayListen(ctx, conversationId)
          if (!allowed) {
            ws.close(4404, 'not found')
            return
          }
          await held.on(
            ws,
            `conversation:${conversationId}`,
            ctx.actorId,
            async () => (await alive(ctx)) && (await mayListen(ctx, conversationId)),
          )
          listening = true
        })().catch(() => ws.close(1011, 'unavailable'))
      },
      /*
       * Who is typing. The one word this socket
       * takes in, and only once it was let into the room: `typed` asks
       * again before passing it on, throttles it, and stores nothing.
       */
      message(ctx, _ws, frame) {
        if (!listening) return
        void typed(ctx, conversationId, frame).catch(() => {})
      },
      close() {
        held.off()
      },
    })
  }),
)

/*
 * A document being written, for as long as it is open.
 *
 * The one socket that takes edits in rather than only saying that
 * something changed: every update is asked of `mayEdit` and written as the
 * person under row-level security before anybody else hears it. The room
 * says its own words, so the socket is held for its heartbeat, its ceiling
 * and its re-check, and subscribed to nothing itself.
 */
app.get(
  '/ws/docs/:id',
  upgradeWebSocket(async (c) => {
    const fileId = c.req.param('id') ?? ''
    const held = holding()
    let seat: coedit.Seat | null = null
    let gone = false
    return signedSocket(c, {
      open(ctx, ws) {
        /* The slot first: joining hands over the whole document. */
        if (!held.reserve(ws, ctx.actorId)) return
        void (async () => {
          const s = await coedit.join(ctx, fileId, ws)
          if (!s) {
            ws.close(4404, 'not found')
            return
          }
          if (gone) return void coedit.leave(s)
          seat = s
          await held.on(ws, null, ctx.actorId, async () => (await alive(s.ctx)) && (await coedit.recheck(s)))
        })().catch(() => ws.close(1011, 'unavailable'))
      },
      message(_ctx, _ws, frame) {
        if (seat) coedit.heard(seat, frame)
      },
      close() {
        gone = true
        held.off()
        if (seat) void coedit.leave(seat)
      },
    })
  }),
)

/* And the edition's own — on the service, a board by link. `edition.ts`. */
edition.sockets({ app, upgradeWebSocket, holding })

/*
 * Migrations before the first request, when the deployment asks for it.
 *
 * `MIGRATE_ON_START` and not always: a developer running this against a
 * database they are in the middle of should not have it changed under
 * them, and a second instance coming up must not race the first. In
 * production one container is given the flag and the others wait on it —
 * the advisory lock inside `migrate` makes that safe either way.
 *
 * Before `serve`, so a container that cannot migrate never answers. A
 * server that is up against the wrong schema is worse than one that is
 * down: the first serves wrong answers and the second is noticed.
 */
/* On your own server a backup comes first, when anything is pending, and
   a backup that fails stops the start with nothing applied — `backup.ts`,
   The service never dumps. */
if (process.env.MIGRATE_ON_START === '1') {
  const { applied } = await migrateWithBackup(env.databaseUrl, edition).catch((e: unknown) => {
    /* Said whole in the log already: no stack over it. */
    if (e instanceof BackupFailed) process.exit(1)
    throw e
  })
  console.log(applied.length ? `migrated: ${applied.join(', ')}` : 'schema already current')
}

/* And what the edition needs of the database on every start, migrated
   here or not — on your own server, its rules turned on.
   Before `serve`, as the migrations are: a
   server whose database says nothing of its rules does not answer. */
{
  const owner = postgres(env.databaseUrl, { max: 1, onnotice: () => {} })
  try {
    await edition.ready(owner)
    /* The version this start runs, remembered for the next update's
       notice and backup name; on the service, nothing. */
    await noteVersion(owner, edition, running.version)
  } finally {
    await owner.end()
  }
}

/*
 * The client, from the same origin as the API.
 *
 * One origin means no CORS to configure and no second place to deploy:
 * `/api/...` is answered above and everything else is the app. Mounted last,
 * so it can never shadow a route — a static handler that matches first is
 * how an API starts returning HTML.
 *
 * Only where there is something to serve. In development the client is Vite
 * on another port and `web/dist` is stale or missing, so this stays out of
 * the way rather than serving yesterday's build.
 */
const client = resolve(process.env.WEB_DIR ?? 'web/dist')
if (existsSync(join(client, 'index.html'))) {
  /*
   * The bundle's files are named by their contents, so a file at one name
   * never changes: kept for a year and never asked about again. They went
   * out with no caching said at all, so a returning browser revalidated a
   * third of a megabyte across the Atlantic before drawing anything — the
   * service worker hid that once installed, and not on the first visit or
   * in a browser that had not yet installed it. The page itself is asked
   * about every time, because it is what names the files.
   */
  /*
   * The page's own guard rails — a policy that runs only this origin's
   * scripts and the inline theme script by its hash, refuses to be framed,
   * and keeps to https. Hashed from the page being served, so a change to
   * that script cannot leave the policy refusing it. `pageHeaders`.
   */
  const page = readFileSync(join(client, 'index.html'), 'utf8')
  const hashes = inlineScripts(page).map((s) => `sha256-${createHash('sha256').update(s).digest('base64')}`)
  /* Over plain http on this computer (`TRY_LOCALHOST`), no HSTS: it has
     nothing to say there. */
  const production = process.env.NODE_ENV === 'production' && !env.tryLocalhost
  const guarded = pageHeaders({ scriptHashes: hashes, production })
  /* A public page written as HTML counts its visit. */
  const counted = pageHeaders({ scriptHashes: hashes, production, counted: true })
  /* A project's feedback page lets Turnstile in. */
  const asking = pageHeaders({ scriptHashes: hashes, production, turnstile: true })
  /* Not the API, the doors or the socket — and those exactly: `/wsx` or a
     workspace whose name starts with "ws" is a page like any other, and
     went out with no policy at all. */
  const bare = /^\/(api|auth|ws)(\/|$)/
  /* On a workspace's own domain, HSTS for that name alone: its subdomains
     are not ours to decide. */
  const onAHost = (h: Record<string, string>): Record<string, string> => {
    const sts = h['strict-transport-security']
    return sts ? { ...h, 'strict-transport-security': sts.replace(/;\s*includeSubDomains/i, '') } : h
  }
  const hostGuarded = onAHost(guarded)
  app.use('*', async (c, next) => {
    await next()
    if (bare.test(c.req.path)) return
    const headers = hostOf(c)
      ? hostGuarded
      : c.res.headers.get('x-tuff-written')
        ? counted
        : c.req.path.startsWith('/f/')
          ? asking
          : guarded
    for (const [k, v] of Object.entries(headers)) c.header(k, v)
  })
  app.use('/assets/*', async (c, next) => {
    await next()
    if (c.res.status === 200) c.header('cache-control', 'public, max-age=31536000, immutable')
  })
  /*
   * And the files that keep their name when they change — the mark, the
   * icons, the landing's pictures, robots and the sitemap — for five
   * minutes. Said nothing, Cloudflare kept them four hours: a new mark was
   * on the server and the old one on every screen until the afternoon.
   */
  /* By the file's kind, never the API's answers or a page, which name the
     bundle of the day. */
  const unhashed = /\.(svg|png|webp|jpe?g|ico|txt|xml|webmanifest)$/
  app.use('/*', async (c, next) => {
    await next()
    if (c.res.status === 200 && unhashed.test(c.req.path) && !c.req.path.startsWith('/api/') && !c.req.path.startsWith('/assets/')) {
      c.header('cache-control', 'public, max-age=300')
    }
  })
  /* Which ways in this deployment has keys for, said in the page itself:
     asked for after it, Google and Apple arrived a moment late and pushed
     the form down under the pointer. A server's
     own provider's name goes beside them — `providersMeta`. */
  const waysOf = providersMeta
  const ways = waysOf(offeredProviders())
  /* By a function: a replacement string reads `$&`, `` $` `` and `$'`, and a
     provider's name (`OIDC_NAME`) is the server's owner's to write. */
  const withWays = (html: string, said = ways) => html.replace('</head>', () => `${said}</head>`)
  /* The app's page as a workspace's own domain writes it — `cloud/domains/hosts.ts`. */
  /* Read once, as the page's hashes above were: a deploy is a new process. */
  const hostHtml = withWays(page)
  hostPage.html = () => hostHtml
  hostPage.headers = hostGuarded
  /* The public pages the build wrote, and what `/` is before the app
     answers it — the landing on the service, the app's own sign-in on your
     own server. `edition.ts`. */
  edition.site({ app, client, withWays })
  app.use('/*', serveStatic({ root: relative(process.cwd(), client) }))
  /*
   * And anything the files do not answer is the app itself.
   *
   * Routing is in the client — `web/src/data/route.ts` — so a cold link to
   * `/studio/website/tasks/41` is a path no file matches. Without this it
   * is a 404, which makes every address in the product un-sendable the
   * moment it is reloaded, and the addresses spec is built on the
   * opposite promise.
   */
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: { code: 'not_found' } }, 404)
    /* The app's screens are a sign-in to a crawler, and a thousand of them
       would be a thousand copies of one empty page. */
    c.header('x-robots-tag', 'noindex')
    /* And never without its guard rails, whatever the address: the app
       answers `/auth/anything` too, and the session runs in whatever page
       it is drawn in. */
    for (const [k, v] of Object.entries(guarded)) c.header(k, v)
    /* Your own server asks at each page which ways in to draw: none until
       somebody owns it (`providersNow`), and that changes while it runs. */
    let page = withWays(readFileSync(join(client, 'index.html'), 'utf8'), edition.instance ? waysOf(await providersNow()) : ways)
    /* Your own server says, in the page, what its first screens need before
       they draw: that mail is not set up, so nothing promises a letter, and
       that `/setup` is the setup screen while the server has a setup link
       and no owner. Nothing on the service. */
    if (edition.instance) {
      const said: string[] = []
      if (!(await mailOn().catch(() => true))) said.push('<meta name="tuff-mail" content="off" />')
      if (env.setupToken && !(await serverClaimed().catch(() => true))) said.push('<meta name="tuff-setup" content="open" />')
      if (said.length) page = page.replace('</head>', () => `${said.join('')}</head>`)
    }
    /* Your own server with sign-up closed says so in the page, so the
       sign-up screen opens on the sentence rather than on a form it would
       refuse. Nothing on the service. */
    if (edition.instance && !(await signUpOpen().catch(() => true))) {
      return c.html(page.replace('</head>', '<meta name="tuff-sign-up" content="closed" /></head>'))
    }
    return c.html(page)
  })
}

/*
 * Whether row-level security is actually on for the role this process asks
 * as. Without `DATABASE_URL_APP` it asks as the database's owner, which
 * every policy lets through — every workspace reading every other, and every
 * test still green. In production on your own server that is a refusal to
 * start; on the service, until its variables are checked, as loud a line as
 * a log can hold (`edition.rlsFailClosed`). Before `serve`, so a server that
 * refuses never answers. `rlsGuard.ts`.
 */
await guardRls(sql, 'app', process.env.NODE_ENV === 'production' && edition.rlsFailClosed)
/* And the sign-in connection the same way (`tracker_auth`, migration 308):
   a member of the application role and nothing more, so the same policies
   bind it. Its password was given it by the migration above, from the same
   string it connects with (`db/authUrl.ts`). */
if (env.databaseUrlAuth) {
  await guardRls(authSql(), 'app’s sign-in connection', process.env.NODE_ENV === 'production' && edition.rlsFailClosed)
} else if (process.env.NODE_ENV === 'production' && env.databaseUrlApp !== env.databaseUrl) {
  /* No sign-in connection to be had, and the application is not the owner
     who could stand in for it: since migration 311 the application role
     holds no sign-in right, so nobody could sign in, refresh or sign out. A
     server that cannot is refused here, saying why, rather than found out
     from the first person locked out. A
     `DATABASE_URL_APP` with no password — trust, peer, `.pgpass` — lands
     here, and wants `DATABASE_URL_AUTH`. */
  console.error(
    '\n!!! DATABASE_URL_AUTH is not set, and it cannot be made from DATABASE_URL_APP (that needs the user tracker_app and a password).\n' +
      '!!! Set DATABASE_URL_AUTH to the tracker_auth role (docs/self-hosting.md). Refusing to start.\n',
  )
  process.exit(1)
}

/* And never without an address of its own: in production every link it
   mails is made from `APP_URL` (else the service's own), never from the
   request's `Host` — so a server that would have none stops here, saying
   so. `publicUrl.ts`, the security audit spec, the seventh audit. */
needSiteUrl({ appUrl: env.appUrl, vendorSite: edition.vendor?.site ?? null, live: process.env.NODE_ENV === 'production' })

/* Who letters are from, asked now so a server that would send them from
   nobody — or from the service, on your own — stops here, saying so. */
mailFrom()
/* Browser push, as `pushKey.ts` read it in `edition.ready`: the environment's
   pair, or on your own server the one it keeps. */
if (!webPushConfigured()) {
  if (Boolean(env.vapidPublicKey) !== Boolean(env.vapidPrivateKey)) {
    console.error(
      '[push] Only one of VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY is set, so browser push is off. Set both' +
        (edition.instance ? ', or neither and this server keeps a key of its own.' : '.'),
    )
  } else if (vapidPair() && edition.instance) {
    console.error(
      '[push] Browser push is off: no VAPID_SUBJECT, APP_URL is not https, and no mail sender is set up to give the push services. Set VAPID_SUBJECT=mailto:you@example.com.',
    )
  } else if (vapidPair()) {
    console.error('[push] VAPID_SUBJECT is not set, so browser push is off. Set it to mailto:you@example.com — see .env.example.')
  }
}
/* Which key it signs with, by a short name the worker's log says too. */
{
  const line = pushKeyLine('app')
  if (line) console.log(line)
}

/* Once, before listening — on the service, IndexNow told of the pages that
   changed while the live site is still the deployment before this one. */
edition.starting({ client, appUrl: env.appUrl })

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`server: http://localhost:${info.port}`)
  if (env.tryLocalhost) console.log(`try mode: for this computer only, at ${env.appUrl}, not for a server`)
  /* The Markdown workers started now rather than on the first body an
     agent sends, which would wait for them — and a worker that cannot
     start is said here, not on that request (`parsing-off-thread.md`). */
  readMarkdown('').catch((e: unknown) => console.error('[markdown]', e))
  /*
   * And where the bytes go, which is the one thing about this process that
   * cannot be told from the outside.
   *
   * A deployment with no bucket writes to the container's disk and loses
   * every upload on the next deploy — and it does that silently, because a
   * file written and read back in the same container is a file that works.
   * The fault appears a day later as a document that is gone.
   *
   * Said once at startup rather than per upload: it is a property of how
   * this was started. Where the folder is, and
   * not that it is lost: on your own server it is the `uploads` volume
   * and survives a rebuild.
   */
  console.log(
    whereBytesGo()
      ? `storage: bucket ${whereBytesGo()}`
      : `storage: the disk, ${process.env.STORAGE_DIR ?? '.storage'} — uploads are lost with it unless it is a volume`,
  )
})
injectWebSocket(server)

/*
 * On the way down, the documents being written are written — a deploy
 * stops this process with SIGTERM, and the stored body would otherwise be
 * up to ten seconds behind what people typed until somebody opened the
 * document again. Five seconds at most, then down regardless.
 */
process.once('SIGTERM', () => {
  const out = () => process.exit(0)
  setTimeout(out, 5000).unref()
  /* And the feature counts not yet written. */
  void Promise.allSettled([coedit.settleAll(), edition.usedFlush()]).finally(out)
})
