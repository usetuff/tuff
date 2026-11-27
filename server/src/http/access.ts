import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { SignJWT, decodeJwt, jwtVerify, createRemoteJWKSet, importPKCS8, type JWTPayload } from 'jose'
import { keyFor, legacyKey } from '../auth/keys.js'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'
import { secureAttr } from '../tryLocalhost.js'
import { edition } from '../edition.js'
import { origin } from '../publicUrl.js'
import { asAuth, bounded, outsideRequest, withActorEverywhere } from '../db.js'
import { generateToken, hashPassword, hashToken } from '../auth/crypto.js'
import {
  checkedNow,
  confirmed,
  firstWorkspace,
  ownWorkspaceName,
  planNewWorkspace,
  secondFactor,
  startNowhereSession,
  startSession,
} from '../auth/flows.js'
import { NO_WORKSPACE_YET } from './nowhere.js'
import { approveLink, confirmLink, masked, peekLink, tellWayIn } from '../auth/address.js'
import { tellInviter } from '../notify.js'
import { letter, mailOn, send } from '../mail.js'
import { heard, languageFor, say } from '../words.js'
import { clientOf, guess, metaOf, onThisMachine, spendOn } from './limits.js'
import { isClosed, orClosed, serverClaimed, SignUpClosed, signUpOpen } from '../instance.js'
import { checkIdToken, oidcName, oidcOn, provider as ownProvider, tradeCode, whoTheTokenSays } from '../auth/oidc.js'
import { hostOf } from '../host.js'

/**
 * Getting in by Google or Apple, and back in when a password is forgotten.
 *
 * Everything here runs before there is anybody to run as, so it goes through
 * the definer functions migration 087 made rather than reading tables.
 */
export const access = new Hono()

type Provider = 'google' | 'apple' | 'github' | 'oidc'
const ALL = ['google', 'apple', 'github', 'oidc'] as const

const PROVIDERS = {
  google: {
    on: () => Boolean(env.googleClientId && env.googleClientSecret),
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    keys: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
    clientId: () => env.googleClientId,
  },
  apple: {
    on: () => Boolean(env.appleClientId && env.appleTeamId && env.appleKeyId && env.applePrivateKey),
    authorize: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    issuers: ['https://appleid.apple.com'],
    keys: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
    clientId: () => env.appleClientId,
  },
} as const

/*
 * GitHub, which is not OpenID Connect: a code traded for a token, and two
 * questions asked with it.
 */
const GITHUB = {
  on: () => Boolean(env.githubSigninClientId && env.githubSigninClientSecret),
  authorize: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
  api: 'https://api.github.com',
}

const isOn = (p: string): p is Provider =>
  p === 'github' ? GITHUB.on() : p === 'oidc' ? oidcOn() : p === 'google' || p === 'apple' ? PROVIDERS[p].on() : false

/* Its own key, not `JWT_SECRET` itself — `auth/keys.ts`. */
const secret = keyFor('oauth-state')
/* A state sealed before the split, for the ten minutes it can last. */
async function unsealState(sealed: string): Promise<JWTPayload> {
  try {
    return (await jwtVerify(sealed, secret)).payload
  } catch (e) {
    let exp: number | undefined
    try {
      exp = decodeJwt(sealed).exp
    } catch {
      throw e
    }
    const old = typeof exp === 'number' ? legacyKey(exp * 1000) : null
    if (!old) throw e
    return (await jwtVerify(sealed, old)).payload
  }
}
/* `__Host-`, so no other host under the domain can plant a state of its
   own: a planted one finished somebody else's flow in the victim's browser. */
const COOKIE = '__Host-tuff_oauth'
/* The browser a ticket belongs to. `__Host-`,
   so no other host under the domain can plant one of its own. */
const HANDOFF = '__Host-tuff_handoff'
/* The ticket that adds a way to sign in, carried from Account settings to
   the start. */
export const LINK = '__Host-tuff_link'
/* A provider's sign-in begun on a workspace's own domain — set there, and
   the ticket that comes back is good only beside it. */
export const BEGIN = '__Host-tuff_begin'
const handoffKey = keyFor('host-handoff')
const sha = (s: string) => createHash('sha256').update(s).digest('base64url')

/**
 * Where a host's sign-in is to go back to: a connected domain on a branded
 * plan, by the id our own server sealed, read from the row and never from a
 * parameter — so there is no open redirect to make. Null for anything else.
 */
async function hostBack(domainId: string): Promise<{ hostname: string; workspaceId: string } | null> {
  return edition.hosts ? edition.hosts.byId(domainId) : null
}

/*
 * The same ticket made for an app, which no cookie reaches.
 * Found by the challenge the app sent, and
 * bound to it: whoever reads the challenge in the start's address holds a
 * hash, and the link is made only by the app with the secret, over the
 * session that asked.
 */
export const appLinkKey = (challenge: string) => hashToken(`app-link:${challenge}`)
export const CHALLENGE = /^[\w-]{43}$/
/**
 * The network an address belongs to, for a ceiling: an IPv4 address as it
 * is, an IPv6 one by its first four groups — one subscriber's /64, which
 * hands them every address in it.
 */
export function networkOf(address: string): string {
  const ip = address.replace(/^::ffff:(?=\d+\.)/i, '')
  if (!ip.includes(':')) return ip
  const [head = '', tail = ''] = ip.toLowerCase().split('::')
  const front = head ? head.split(':') : []
  const back = ip.includes('::') ? (tail ? tail.split(':') : []) : []
  const groups = ip.includes('::') ? [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back] : front
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

/** A browser's request — every browser sends one of these, an app's own client neither. */
export const fromBrowser = (c: Context) => Boolean(c.req.header('origin') || c.req.header('sec-fetch-site'))

/*
 * What a link ticket is bound to: the provider and the session that asked,
 * and for an app the challenge. Read strictly — a ticket made for the one
 * is never taken by the other's path.
 */
function linkBinding(binding: string | null | undefined): { p: string; sid: string; challenge: string | null } | null {
  const m = /^(google|apple|github|oidc):([0-9a-f-]{36})(?::app:([\w-]{43}))?$/.exec(binding ?? '')
  return m ? { p: m[1]!, sid: m[2]!, challenge: m[3] ?? null } : null
}

/* Where this deployment is, for links and redirects: one function, which in
   production reads `APP_URL` and never the request — `publicUrl.ts`. */
export { origin }

const callbackOf = (c: Context, p: Provider) => `${origin(c)}/auth/oauth/${p}/callback`
const b64url = (b: Buffer) => b.toString('base64url')

function readCookie(c: Context, name: string): string | null {
  const raw = c.req.header('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** Which providers this deployment can offer — the screens draw only these. */
/**
 * The same, written into every page the server sends — `providersMeta` —
 * so the sign-in screen draws its buttons with the page rather than a
 * request later, under the fields it had already drawn.
 */
export function offeredProviders(): string[] {
  return ALL.filter(isOn)
}

/**
 * The providers to draw now: none on your own server until somebody owns
 * it (`serverClaimed`), and an error asking is taken as not yet. On the
 * service, every one with keys.
 */
export async function providersNow(): Promise<Provider[]> {
  return (await serverClaimed().catch(() => false)) ? ALL.filter(isOn) : []
}

/** Text for an attribute of the page: `&`, `<`, `>` and both quotes as entities. */
const attr = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

/**
 * The providers to draw, said in the page — `tuff-providers` — and, when a
 * server's own provider is one of them, what its button calls it
 * (`tuff-oidc-name`), so the buttons draw with the page.
 */
export function providersMeta(on: readonly string[]): string {
  const ways = `<meta name="tuff-providers" content="${attr(on.join(' '))}" />`
  return on.includes('oidc') ? `${ways}<meta name="tuff-oidc-name" content="${attr(oidcName())}" />` : ways
}

/* And whether somebody without an invitation may sign up — false only on
   your own server with sign-up closed. */
access.get('/providers', async (c) => {
  const on = await providersNow()
  return c.json({
    google: on.includes('google'),
    apple: on.includes('apple'),
    github: on.includes('github'),
    /* A server's own provider, and what its button calls it. */
    oidc: on.includes('oidc'),
    oidc_name: on.includes('oidc') ? oidcName() : null,
    mail: await mailOn(),
    /* Your own server with no mail: the screens say so instead of promising
       a letter. False on the service. */
    no_mail: edition.instance && !(await mailOn()),
    sign_up: await signUpOpen(),
  })
})

/*
 * Off to the provider, with a state and a nonce bound to a short cookie —
 * so a callback this browser did not start is refused — and, for Google,
 * PKCE. The cookie is `SameSite=None` because Apple answers with a POST
 * from its own site, which a Lax cookie would not ride on.
 */
access.get('/oauth/:provider/start', async (c) => {
  const p = c.req.param('provider')
  if (!isOn(p)) return c.redirect('/signin?oauth=off')
  /* On a workspace's own domain: a cookie of the host's own, and off to
     usetuff.com's start with the domain and that cookie's hash sealed —
     a provider takes a fixed list of return addresses, and a hundred
     agencies are not on it. No invitation, no app, no linking from here. */
  const host = hostOf(c)
  if (host) {
    if (p === 'oidc') return c.redirect('/signin?oauth=off')
    const begin = b64url(randomBytes(32))
    const sealedFor = await new SignJWT({ d: host.domainId, h: sha(begin) })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(handoffKey)
    c.header('set-cookie', `${BEGIN}=${begin}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`, { append: true })
    return c.redirect(`${origin(c)}/auth/oauth/${p}/start?for=${encodeURIComponent(sealedFor)}`)
  }
  /* Begun on a host: only our own server can have sealed `for`, and the
     domain must still be connected. Its ticket goes back there, bound to
     the host's cookie. */
  let forHost: string | undefined
  if (c.req.query('for') !== undefined) {
    let said: JWTPayload
    try {
      said = (await jwtVerify(c.req.query('for') ?? '', handoffKey)).payload
    } catch {
      return c.redirect('/signin?oauth=expired')
    }
    const d = typeof said.d === 'string' ? said.d : ''
    const h = typeof said.h === 'string' ? said.h : ''
    if (!/^[\w-]{43}$/.test(h) || !(await hostBack(d))) return c.redirect('/signin?oauth=failed')
    forHost = `host:${d}:${h}`
  }
  /* A server's own provider is read first, before anything is spent on
     the way to it: one that cannot be read, or is not what `OIDC_ISSUER`
     says, is "couldn't reach", said where the press was. */
  const own = p === 'oidc' ? await ownProvider() : null
  if (p === 'oidc' && !own) return c.redirect(await unreachableFrom(c))
  const state = b64url(randomBytes(16))
  const nonce = b64url(randomBytes(16))
  const verifier = b64url(randomBytes(32))
  /* Following an invitation: carried there and back in the same sealed
     cookie, and taken on the way back — so somebody new joins the
     workspace they were asked into rather than one made for them, and
     somebody known joins it without a password. */
  const asked = c.req.query('invite') ?? ''
  const invite = asked.length <= 200 && /^[\w.~-]+$/.test(asked) ? asked : undefined
  /* Where the ticket will be good: an app that
     sent its secret's SHA-256, or else this browser. An app's sheet
     arrives with `Sec-Fetch-Site: none`, which no page can write; a
     challenge from anywhere else is a page's link, and the ticket stays
     this browser's. A sheet with no challenge is this browser's too: the
     apps have sent one since 8 November, and a ticket bound to nothing was
     one an App Link could hand an app — somebody's own, signing the
     victim's phone in as them. */
  const challenge = c.req.query('app_challenge')
  if (challenge !== undefined && !/^[\w-]{43}$/.test(challenge)) return c.redirect('/signin?oauth=failed')
  const sheet = c.req.header('sec-fetch-site') === 'none'
  const bind = forHost ?? (sheet && challenge ? `app:${challenge}` : 'web')
  /* Adding a way to sign in rather than signing in: the ticket only from
     the cookie Account settings left, sealed into the state this browser
     carries. */
  let link: string | undefined
  let linkApp = false
  let startMark: string | undefined
  if (forHost && (invite || c.req.query('link') || challenge)) return c.redirect('/signin?oauth=failed')
  if (c.req.query('link') === 'app') {
    /* From an app's sheet only, with the challenge its ticket was made
       for. From a page's link it is
       nothing: a page walking somebody's browser through a start made
       with the sender's challenge would leave the victim's provider
       account waiting for the sender to finish. */
    if (!sheet || !challenge) return c.redirect('/signin?ways=failed')
    const key = appLinkKey(challenge)
    const [t] = await asAuth((tx) => tx<{ binding: string | null }[]>`select auth_ticket_binding(${key}, 'link') as binding`)
    const b = linkBinding(t?.binding)
    if (!b || b.p !== p || b.challenge !== challenge) return c.redirect('/signin?ways=failed')
    /* Once: the challenge is in this address, and an address is kept in
       logs and histories. The app's own sheet opens it the moment the
       ticket is made, so somebody racing it makes the real one fail where
       the person sees it, never succeed behind their back. */
    const mark = b64url(randomBytes(16))
    const [won] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_ticket_start(${key}, 'link', ${mark}) as ok`)
    startMark = mark
    if (!won?.ok) return c.redirect('/signin?ways=failed')
    link = key
    linkApp = true
  } else if (c.req.query('link')) {
    const ticket = readCookie(c, LINK)
    const [t] = ticket
      ? await asAuth((tx) => tx<{ binding: string | null }[]>`select auth_ticket_binding(${hashToken(ticket)}, 'link') as binding`)
      : []
    /* Made for this provider, and for the web: only the hash goes on, as
       the state is signed, not sealed, and the ticket itself would be a
       way to start again in another browser. An app's ticket is never
       taken from a cookie, whatever the cookie says. */
    const b = linkBinding(t?.binding)
    if (!ticket || !b || b.p !== p || b.challenge) return c.redirect('/')
    link = hashToken(ticket)
    c.header('set-cookie', `${LINK}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, { append: true })
  } else if (sheet && challenge) {
    /* An app's sign-in starts once per challenge.
       Replayed by whoever read the address, it would end in a ticket for
       their provider account that the app's secret trades, and an app that
       took it from a link rather than its sheet would sign its person in
       as somebody else. The apps make a fresh secret every time.
       Each writes a row, so one address gets a ceiling of its own, counted
       only here — what is refused before writes nothing — and an IPv6
       address by its /64, which is what one network is given. */
    const from = clientOf(c)
    if (!onThisMachine(from) && !(await spendOn(`appstart:${networkOf(from)}`, 120, 600))) {
      return c.redirect('/signin?oauth=failed')
    }
    const [once] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_app_start_once(${challenge}) as ok`)
    if (!once?.ok) return c.redirect('/signin?oauth=failed')
  }
  const sealed = await new SignJWT({
    state,
    nonce,
    verifier,
    p,
    bind,
    ...(invite ? { invite } : {}),
    ...(link ? { link } : {}),
    ...(linkApp ? { linkApp, startMark } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .sign(secret)
  c.header('set-cookie', `${COOKIE}=${sealed}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=None`, { append: true })
  /* Only who somebody is and their addresses; the account picker, so a
     browser signed in to the wrong GitHub can choose. */
  if (p === 'github') {
    const q = new URLSearchParams({
      client_id: env.githubSigninClientId,
      redirect_uri: callbackOf(c, p),
      scope: 'user:email',
      state,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    })
    return c.redirect(`${GITHUB.authorize}?${q}`)
  }
  /* The flow Google's is: a code, PKCE, the state and the nonce. Onto
     whatever the document's endpoint already carries in its query. */
  if (p === 'oidc') {
    const to = new URL(own!.authorize)
    to.searchParams.set('client_id', env.oidcClientId)
    to.searchParams.set('redirect_uri', callbackOf(c, p))
    to.searchParams.set('response_type', 'code')
    to.searchParams.set('scope', 'openid email profile')
    to.searchParams.set('state', state)
    to.searchParams.set('nonce', nonce)
    to.searchParams.set('code_challenge', b64url(createHash('sha256').update(verifier).digest()))
    to.searchParams.set('code_challenge_method', 'S256')
    return c.redirect(to.href)
  }
  const conf = PROVIDERS[p]
  const q = new URLSearchParams({
    client_id: conf.clientId(),
    redirect_uri: callbackOf(c, p),
    response_type: 'code',
    state,
    nonce,
  })
  if (p === 'google') {
    q.set('scope', 'openid email profile')
    q.set('code_challenge', b64url(createHash('sha256').update(verifier).digest()))
    q.set('code_challenge_method', 'S256')
    q.set('prompt', 'select_account')
  } else {
    q.set('scope', 'name email')
    q.set('response_mode', 'form_post')
  }
  return c.redirect(`${conf.authorize}?${q}`)
})

/**
 * Where a start goes back to when a server's own provider could not be
 * reached: the invitation it was pressed on, Account's ways in, or the
 * sign-in screen — each of which says so.
 */
async function unreachableFrom(c: Context): Promise<string> {
  const asked = c.req.query('invite') ?? ''
  if (asked && asked.length <= 200 && /^[\w.~-]+$/.test(asked)) return `/invite/${encodeURIComponent(asked)}?oauth=unreachable`
  if (c.req.query('link') === 'app') return '/signin?ways=failed'
  if (c.req.query('link')) {
    const ticket = readCookie(c, LINK)
    const [t] = ticket
      ? await asAuth((tx) => tx<{ workspace_id: string | null }[]>`select workspace_id from auth_ticket_peek(${hashToken(ticket)}, 'link')`)
      : []
    const [w] = t?.workspace_id
      ? await asAuth((tx) => tx<{ slug: string | null }[]>`select auth_workspace_slug(${t.workspace_id}) as slug`)
      : []
    return w?.slug ? `/${encodeURIComponent(w.slug)}/account?ways=unreachable` : '/'
  }
  return '/signin?oauth=unreachable'
}

/** Apple's client secret is a short JWT signed with the team's key. */
async function appleSecret(): Promise<string> {
  const key = await importPKCS8(env.applePrivateKey, 'ES256')
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.appleKeyId })
    .setIssuer(env.appleTeamId)
    .setSubject(env.appleClientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key)
}

/** What a provider's start sealed into the cookie its callback reads. */
type OAuthBound = {
  state: string
  nonce: string
  verifier: string
  p: string
  bind?: string
  invite?: string
  link?: string
  linkApp?: boolean
  startMark?: string
}

/** Who the provider says this is, once its answer has been checked. */
type Said = { subject: string; email: string; verified: boolean; name: string; owns: boolean }

async function callback(c: Context, p: Provider, params: { code?: string; state?: string; user?: string }) {
  const fail = (why: string) => {
    c.header('set-cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`)
    return c.redirect(`/signin?oauth=${why}`)
  }
  if (!isOn(p) || !params.code || !params.state) return fail('failed')

  let bound: OAuthBound
  try {
    const sealed = readCookie(c, COOKIE) ?? ''
    bound = (await unsealState(sealed)) as unknown as typeof bound
  } catch {
    return fail('expired')
  }
  if (bound.state !== params.state || bound.p !== p) return fail('failed')
  if (bound.link) return linked(c, p, params, bound, bound.link, bound.linkApp === true)
  if (bound.bind?.startsWith('host:')) return toHost(c, p, params, bound)
  /* From here on, a sign-in that went wrong on the way to an invitation
     goes back to the invitation, which says what happened there. */
  const invite = bound.invite
  const back = (why: string | null) => {
    if (!invite) return fail(why ?? 'failed')
    c.header('set-cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`)
    return c.redirect(`/invite/${encodeURIComponent(invite)}${why ? `?oauth=${why}` : ''}`)
  }

  const said =
    p === 'github'
      ? await fromGithub(c, params.code, bound.verifier)
      : p === 'oidc'
        ? await fromOwn(c, params.code, bound)
        : await fromOidc(c, p, params, bound)
  if (said === 'unreachable') return back('unreachable')
  if (!said) return back('failed')
  const { subject, email, verified, name, owns } = said

  /* Before the account is found by what the provider said: the ticket below
     is good only if the account was not put out since — unless finding it
     was itself the proof that put its previous holder out, when the person
     here is its new holder (`seen.claimed`). Migration 317. */
  const since = await checkedNow()
  const seen: Seen = { claimed: false }
  let who: Awaited<ReturnType<typeof joinByProvider>> | Awaited<ReturnType<typeof whoIs>>
  try {
    who = invite
      ? await joinByProvider(p, invite, subject, email, verified, name, owns, seen)
      : await whoIs(p, subject, email, verified, name, owns, seen)
  } catch (e) {
    /* A new account on your own server with sign-up closed. */
    if (isClosed(e)) return back('closed')
    /* An account that should have held its address weakly and does not:
       made nothing, signed nobody in. */
    if (e instanceof NotWeak) return back('failed')
    throw e
  }
  /* Found by its address and given a new way in: the address is told, as
     it is when a way in is added from Account. */
  if (seen.byAddress && who && typeof who === 'object') await tellWayIn(origin(c), who.actorId, 'added', p, email || null)
  /* GitHub never links by address, so an address with an account here is
     told the way to link it, not that the provider did not confirm it. */
  if (who === 'conflict') return back(p === 'github' ? 'github' : 'conflict')
  if (who === 'gone') return back(null)
  if (who === 'full') return back('full')
  if (who === 'elsewhere') return back('elsewhere')
  /* A server's own provider that gave no address: told so, nothing made. */
  if (!who) return back(p === 'github' && !verified ? 'noemail' : p === 'oidc' && !email ? 'noaddress' : 'failed')

  const ticket = generateToken('hof')
  let binding: string
  if (bound.bind?.startsWith('app:')) binding = bound.bind
  else {
    const browser = generateToken('hob')
    binding = `web:${hashToken(browser)}`
    c.header('set-cookie', `${HANDOFF}=${browser}; Path=/; Max-Age=120; HttpOnly; Secure; SameSite=Lax`, { append: true })
  }
  const made = await asAuth(async (tx) => {
    /* Under the account's hold: a put-out between finding the account and
       this ticket refuses it, and one in flight is waited for. */
    await tx`select auth_not_put_out_since(${who.actorId}, ${seen.claimed ? null : since}::timestamptz)`
    await tx`select auth_ticket_make_bound(${hashToken(ticket)}, 'handoff', ${who.actorId}, ${who.workspaceId}, interval '2 minutes', ${binding})`
    return true
  }).catch((e: { code?: string }) => {
    if (e.code === '28000') return false
    throw e
  })
  if (!made) return back('failed')
  c.header('set-cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`, { append: true })
  /* Somebody known, signed in and not joined: the invitation goes back with
     the ticket, and the page opens it once signed in, to be pressed. */
  const waiting = invite && 'press' in who && who.press ? `&invite=${encodeURIComponent(invite)}` : ''
  return c.redirect(`/signin?handoff=${encodeURIComponent(ticket)}${waiting}`)
}

/**
 * A provider's account added to the account that asked in Account settings
 * — rather than anybody signed in. Whatever its
 * address: the person proved who they are before going. Never one that
 * signs somebody else in, nor a GitHub connected to somebody else.
 *
 * Asked from an app, nothing is linked here: this runs in the app's sheet,
 * or in whatever browser the start's address was opened in, so what the
 * provider said is left waiting for the app to finish with its secret,
 * over the session that asked.
 */
async function linked(
  c: Context,
  p: Provider,
  params: { code?: string; state?: string; user?: string },
  bound: { nonce: string; verifier: string; startMark?: string },
  hash: string,
  app: boolean,
) {
  c.header('set-cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`)
  const [t] = await asAuth(
    (tx) => tx<{ actor_id: string; workspace_id: string | null; binding: string | null }[]>`
      select k.*, auth_ticket_binding(${hash}, 'link') as binding from auth_ticket_peek(${hash}, 'link') k`,
  )
  if (!t) return c.redirect(app ? '/signin?ways=failed' : '/')
  const [w] =
    !app && t.workspace_id ? await asAuth((tx) => tx<{ slug: string | null }[]>`select auth_workspace_slug(${t.workspace_id}) as slug`) : []
  const back = (why: 'added' | 'taken' | 'failed' | 'unreachable') =>
    c.redirect(app ? '/signin?ways=failed' : w?.slug ? `/${w.slug}/account?ways=${why}` : '/')

  /* Still the session that asked: a password reset or signing out
     everywhere since then ends it, and the way in it was adding with it.
     And made for the path it came by — a web ticket never finishes as an
     app's, nor the other way round. */
  const b = linkBinding(t.binding)
  if (!b || b.p !== p || Boolean(b.challenge) !== app) return back('failed')
  const [alive] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_session_alive(${b.sid}) as ok`)
  if (!alive?.ok) return back('failed')

  const said =
    p === 'github'
      ? await fromGithub(c, params.code ?? '', bound.verifier)
      : p === 'oidc'
        ? await fromOwn(c, params.code ?? '', bound)
        : await fromOidc(c, p, params, bound)
  if (said === 'unreachable') return back('unreachable')
  if (!said) return back('failed')

  if (app) {
    /* From the one start this ticket allowed, and no other. */
    const [s] = await asAuth((tx) => tx<{ started: string | null }[]>`select auth_ticket_started(${hash}, 'link') as started`)
    if (!bound.startMark || s?.started !== bound.startMark) return back('failed')
    /* Who the provider named, for this link ticket and this start, once
       and briefly. The link ticket is spent when the app finishes. */
    const waiting = generateToken('lkd')
    const what = JSON.stringify({ link: hash, start: bound.startMark, p, subject: said.subject, email: said.email || null })
    await asAuth(
      (tx) =>
        tx`select auth_ticket_make_bound(${hashToken(waiting)}, 'linked', ${t.actor_id}, ${t.workspace_id}, interval '2 minutes', ${what})`,
    )
    return c.redirect(`/signin?linked=${encodeURIComponent(waiting)}`)
  }

  const [spent] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_ticket_spend(${hash}, 'link') as ok`)
  if (!spent?.ok) return back('failed')
  /* As the session that asked, as a signed-in request is: every transaction
     of the link asks whether the account changed hands since that session
     was begun, so a link finishing after a put-out writes nothing
     (`auth_still_in`, migration 317) — the provider's answer above took a
     round trip the session's check came before. */
  const outcome = await bounded({ actorId: t.actor_id, tokenProjectIds: [], sessionId: b.sid }, () =>
    attachWay(c, t.actor_id, p, said),
  ).catch((e: { code?: string }) => {
    if (e.code === '28000') return 'failed' as const
    throw e
  })
  return back(outcome)
}

/**
 * The link itself, once everything before it has been checked: never a
 * provider account that signs somebody else in, nor a GitHub connected to
 * somebody else; the address told when it is new.
 */
async function attachWay(
  c: Context,
  actorId: string,
  p: Provider,
  said: { subject: string; email: string | null },
): Promise<'added' | 'taken' | 'failed'> {
  /* Never for an address nobody has proved — refused where it starts too. */
  if (!(await confirmed(actorId))) return 'failed'
  const [known] = await asAuth((tx) => tx<{ actor: string | null }[]>`select auth_identity_actor(${p}, ${said.subject}) as actor`)
  if (known?.actor && known.actor !== actorId) return 'taken'
  if (p === 'github') {
    const [taken] = await asAuth(
      (tx) => tx<{ taken: boolean }[]>`select github_account_taken(${said.subject}::bigint, ${actorId}) as taken`,
    )
    if (taken?.taken) return 'taken'
  }
  if (!known?.actor) {
    await asAuth((tx) => tx`select auth_identity_link(${actorId}, ${p}, ${said.subject}, ${said.email || null})`)
    /* Whose it is now: two accounts linking the same one at once, the
       second did nothing and must not be told it did. */
    const [now] = await asAuth((tx) => tx<{ actor: string | null }[]>`select auth_identity_actor(${p}, ${said.subject}) as actor`)
    if (now?.actor !== actorId) return 'taken'
    await tellWayIn(origin(c), actorId, 'added', p, said.email || null)
  }
  return 'added'
}

const Waiting = z.object({
  link: z.string(),
  start: z.string().min(1),
  p: z.string(),
  subject: z.string().min(1),
  email: z.string().nullable(),
})

/**
 * An app finishing what its sheet started:
 * the `linked` ticket the callback left, the link ticket it came from,
 * both for this provider, this account and the session making this very
 * request, and the secret whose SHA-256 that ticket was made with. A
 * refusal spends nothing, so whoever holds the address cannot cancel the
 * real one; the link ticket is spent once, for the first to bring it all.
 */
export async function finishAppLink(
  c: Context,
  actorId: string,
  sessionId: string,
  p: string,
  waiting: string,
  verifier: string,
): Promise<{ outcome: 'added' | 'taken' | 'failed'; email: string | null } | 'refused'> {
  if (!isOn(p)) return 'refused'
  const key = hashToken(waiting)
  const [r] = await asAuth(
    (tx) => tx<{ actor_id: string; binding: string | null }[]>`
      select k.actor_id, auth_ticket_binding(${key}, 'linked') as binding from auth_ticket_peek(${key}, 'linked') k`,
  )
  if (!r?.binding || r.actor_id !== actorId) return 'refused'
  let parsed: unknown
  try {
    parsed = JSON.parse(r.binding)
  } catch {
    return 'refused'
  }
  const what = Waiting.safeParse(parsed)
  if (!what.success || what.data.p !== p) return 'refused'
  const link = what.data.link
  const [t] = await asAuth(
    (tx) => tx<{ actor_id: string; binding: string | null; started: string | null }[]>`
      select k.actor_id, auth_ticket_binding(${link}, 'link') as binding, auth_ticket_started(${link}, 'link') as started
      from auth_ticket_peek(${link}, 'link') k`,
  )
  const b = linkBinding(t?.binding)
  if (!t || t.actor_id !== actorId || !b || b.p !== p || !b.challenge || b.sid !== sessionId) return 'refused'
  /* From the one start the ticket allowed. */
  if (t.started !== what.data.start) return 'refused'
  const brought = Buffer.from(b64url(createHash('sha256').update(verifier).digest()))
  const made = Buffer.from(b.challenge)
  if (brought.length !== made.length || !timingSafeEqual(brought, made)) return 'refused'
  const [alive] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_session_alive(${b.sid}) as ok`)
  if (!alive?.ok) return 'refused'
  const [spent] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_ticket_spend(${link}, 'link') as ok`)
  if (!spent?.ok) return 'refused'
  await asAuth((tx) => tx`select auth_ticket_spend(${key}, 'linked')`)
  const outcome = await attachWay(c, actorId, p, { subject: what.data.subject, email: what.data.email })
  return { outcome, email: what.data.email }
}

/** Google's and Apple's answer: an ID token, checked against their keys. */
async function fromOidc(
  c: Context,
  p: 'google' | 'apple',
  params: { code?: string; user?: string },
  bound: { nonce: string; verifier: string },
): Promise<Said | null> {
  const conf = PROVIDERS[p]
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code ?? '',
    redirect_uri: callbackOf(c, p),
    client_id: conf.clientId(),
    client_secret: p === 'google' ? env.googleClientSecret : await appleSecret(),
  })
  if (p === 'google') body.set('code_verifier', bound.verifier)
  const r = await fetch(conf.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }).catch(() => null)
  if (!r?.ok) return null
  const tokens = (await r.json()) as { id_token?: string }
  if (!tokens.id_token) return null

  let claims: JWTPayload & { email?: string; email_verified?: boolean | string; nonce?: string; name?: string; hd?: string }
  try {
    claims = (await jwtVerify(tokens.id_token, conf.keys, { issuer: [...conf.issuers], audience: conf.clientId() })).payload
  } catch {
    return null
  }
  if (claims.nonce !== bound.nonce || !claims.sub) return null

  /* Apple sends a name once, on the first sign-in, beside the token rather
     than in it. */
  let name = typeof claims.name === 'string' ? claims.name : ''
  if (p === 'apple' && params.user) {
    try {
      const u = JSON.parse(params.user) as { name?: { firstName?: string; lastName?: string } }
      name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ')
    } catch {
      // A name is a courtesy; an account is made without one.
    }
  }
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : ''
  const verified = claims.email_verified === true || claims.email_verified === 'true'
  /* Whether the provider is the authority for the address, which is what
     handing it an existing account by address needs. Google's own advice:
     `email_verified` on a Google account under somebody else's domain only
     says the address was checked when the Google account was made — it is
     authoritative for gmail.com and for a Workspace account (`hd`). */
  const owns = verified && (p !== 'google' || typeof claims.hd === 'string' || /@(gmail|googlemail)\.com$/.test(email))
  return { subject: claims.sub, email, verified, name, owns }
}

/**
 * A server's own provider's answer: the
 * code traded with its verifier at the token endpoint its document names,
 * and the ID token checked against its keys. `unreachable` when the
 * provider could not be read or did not answer.
 */
async function fromOwn(c: Context, code: string, bound: { nonce: string; verifier: string }): Promise<Said | 'unreachable' | null> {
  const p = await ownProvider()
  if (!p) return 'unreachable'
  const idToken = await tradeCode(p, code, callbackOf(c, 'oidc'), bound.verifier)
  if (idToken === 'unreachable') return 'unreachable'
  if (!idToken) return null
  const claims = await checkIdToken(p, idToken, bound.nonce)
  return claims ? whoTheTokenSays(claims) : null
}

/*
 * GitHub's answer: the code traded with its verifier, then who the token
 * is and which address GitHub has verified as their primary — and the
 * token revoked, since it was wanted for those two questions and nothing
 * after. GitHub is the authority for no address (`owns` is never true):
 * a verified one there says a mailbox was reached once, and a company's
 * mailbox goes to whoever comes next with its GitHub still holding it.
 */
async function fromGithub(c: Context, code: string, verifier: string): Promise<Said | null> {
  /* Only GitHub's two hosts, no redirect followed, ten seconds a question. */
  const ask = (url: string, init: RequestInit) =>
    fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) }).catch(() => null)
  const r = await ask(GITHUB.token, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.githubSigninClientId,
      client_secret: env.githubSigninClientSecret,
      code,
      redirect_uri: callbackOf(c, 'github'),
      code_verifier: verifier,
    }),
  })
  /* A refused code is a 200 with `error` in it, not a status. */
  const t = r?.ok ? ((await r.json().catch(() => null)) as { access_token?: unknown } | null) : null
  const token = typeof t?.access_token === 'string' ? t.access_token : ''
  if (!token) return null
  const read = async <T>(path: string): Promise<T | null> => {
    const res = await ask(`${GITHUB.api}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'Tuff',
      },
    })
    return res?.ok ? ((await res.json().catch(() => null)) as T | null) : null
  }
  const user = await read<{ id?: unknown; login?: unknown; name?: unknown }>('/user')
  const emails = await read<{ email?: unknown; primary?: unknown; verified?: unknown }[]>('/user/emails')
  void ask(`${GITHUB.api}/applications/${encodeURIComponent(env.githubSigninClientId)}/token`, {
    method: 'DELETE',
    headers: {
      authorization: `Basic ${Buffer.from(`${env.githubSigninClientId}:${env.githubSigninClientSecret}`).toString('base64')}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'Tuff',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ access_token: token }),
  })
  if (!user || typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) return null
  /* The primary, verified, and a mailbox somebody reads: GitHub's noreply
     addresses are verified and go nowhere. */
  const primary = Array.isArray(emails)
    ? emails.find(
        (e) =>
          e.primary === true &&
          e.verified === true &&
          typeof e.email === 'string' &&
          e.email.length <= 254 &&
          /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email) &&
          !/@users\.noreply\.github\.com$/i.test(e.email),
      )
    : undefined
  const name = (typeof user.name === 'string' && user.name.trim()) || (typeof user.login === 'string' ? user.login : '')
  return {
    subject: String(user.id),
    email: typeof primary?.email === 'string' ? primary.email.toLowerCase() : '',
    verified: Boolean(primary),
    name: name.slice(0, 100),
    owns: false,
  }
}

/**
 * Who a provider's account is here.
 *
 * Somebody seen this way before; else the account with that email, but only
 * when the provider vouches for the email — otherwise a provider account
 * claiming somebody's address would be handed their account; else a new
 * account with a workspace of its own — or, on your own server with
 * sign-up closed, `SignUpClosed` thrown and no account.
 */
export async function whoIs(
  p: Provider,
  subject: string,
  email: string,
  verified: boolean,
  name: string,
  /** The provider is the authority for the address, not only saw it checked once. */
  owns = verified,
  /** Told whether finding the account proved its address and put its previous holder out. */
  seen: Seen = { claimed: false },
): Promise<{ actorId: string; workspaceId: string | null } | 'conflict' | null> {
  const found = await knownActor(p, subject, email, owns, seen)
  if (found === 'conflict') return 'conflict'
  let actorId = found
  if (!actorId) {
    /* A new account is made only on an address the provider vouches for:
       it is made confirmed, so it has to be. */
    if (!email || !verified) return null
    /* Asked first as well, so a server whose database was never told it is
       one of its own refuses rather than lets in. */
    if (!(await signUpOpen())) throw new SignUpClosed()
    const id = uuidv7()
    const workspaceId = uuidv7()
    const who = name.trim() || email.split('@')[0]!
    const wsName = ownWorkspaceName(who)
    /* On your own server with sign-up closed, `register_owner` refuses
       and makes nothing; the callback says so. Somebody new comes in by an
       invitation (`joinByProvider`). On a server nobody has claimed yet a
       provider makes nothing either (migration 207): only a mailed link or
       the machine's `instance:owner` claims one. */
    await orClosed(
      asAuth(async (tx) => {
        const [s] = await tx<{ slug: string }[]>`select free_workspace_slug(${wsName}) as slug`
        await tx`select register_owner(${id}, ${who}, ${email}, ${null}, ${workspaceId}, ${wsName}, ${s!.slug}, true, true)`
        if (weakly(p, owns)) await weaken(tx, id)
      }),
    )
    await planNewWorkspace(id, workspaceId)
    actorId = id
  }
  await asAuth((tx) => tx`select auth_identity_link(${actorId}, ${p}, ${subject}, ${email || null})`)
  /* In no workspace: signed in all the same, to the screen for that —
     the exchange decides whether this client can be given it. */
  return { actorId, workspaceId: await firstWorkspace(actorId) }
}

/**
 * Whether an account a provider makes holds its address only weakly
 * (`email_by_hand`, migration 321): a server's own provider that did not
 * vouch for the address. Such a token may
 * make an account, and the address's real owner proving it later takes
 * that account, as a handed invitation's would be (migration 210).
 */
const weakly = (p: Provider, owns: boolean) => p === 'oidc' && !owns

/** An account that was to hold its address weakly and was not made so. */
class NotWeak extends Error {
  constructor() {
    super('not_weak')
  }
}

/**
 * The account just made in this transaction, held weakly — or the
 * transaction refused, and the account with it: never left fully
 * confirmed without anybody noticing. `auth_email_weak` answers false only
 * for an account it did not just make or one already not confirmed, which
 * these callers never hand it; if it ever does, nothing is made.
 */
async function weaken(tx: Parameters<Parameters<typeof asAuth>[0]>[0], actorId: string): Promise<void> {
  const [r] = await tx<{ ok: boolean }[]>`select auth_email_weak(${actorId}) as ok`
  if (r?.ok !== true) throw new NotWeak()
}

/**
 * What the callback is told about how the account was found: whether
 * finding it proved its address and put its previous holder out
 * (`claimed`), and whether it was found by its address rather than by
 * this provider's own subject (`byAddress`) — a new way in, which the
 * address is told of.
 */
type Seen = { claimed: boolean; byAddress?: boolean }

/**
 * The account a provider's answer is, if there is one: somebody seen this
 * way before, else the account with that email — but only when the provider
 * is the authority for the email, or a provider account claiming somebody's
 * address would be handed their account.
 */
async function knownActor(
  p: Provider,
  subject: string,
  email: string,
  verified: boolean,
  seen: Seen = { claimed: false },
): Promise<string | 'conflict' | null> {
  const known = await asAuth(async (tx) => {
    const [r] = await tx<{ actor: string | null }[]>`select auth_identity_actor(${p}, ${subject}) as actor`
    return r?.actor ?? null
  })
  if (known) {
    /* A provider sign-in on an account nobody proved — linked before
       the password came after the proof by whoever held a session for that address (migration 212
       took those it found). Not a way in by itself: only when this
       provider vouches for the account's own address, which is a proof and
       goes through `auth_claim_email` like any other. */
    const [acc] = await asAuth(
      (tx) => tx<{ email: string | null; weak: boolean | null }[]>`
        select auth_email_of(${known}) as email, auth_email_by_hand(${known}) as weak`,
    )
    const itsOwn = verified && Boolean(email) && acc?.email?.toLowerCase() === email.toLowerCase()
    if (await confirmed(known)) {
      /* Made weakly by a server's own provider that did not vouch for the
         address, and vouching for it now: the proof it lacked, which puts
         out anybody else the account let in meanwhile. */
      if (p === 'oidc' && acc?.weak === true && itsOwn) {
        await orClosed(asAuth((tx) => tx`select auth_claim_email(${known})`))
        seen.claimed = true
      }
      return known
    }
    if (!itsOwn) return 'conflict'
    await orClosed(asAuth((tx) => tx`select auth_claim_email(${known})`))
    seen.claimed = true
    return known
  }
  if (!email) return null
  const existing = await asAuth(async (tx) => {
    const [r] = await tx<{ actor_id: string }[]>`select actor_id from auth_lookup_user(${email})`
    return r?.actor_id ?? null
  })
  if (!existing) return null
  if (!verified) return 'conflict'
  /* The provider is the first to prove the address is theirs: an account
     nobody confirmed becomes theirs, without the password whoever made it
     chose — `auth_claim_email`. */
  /* On your own server, confirming an address that asked to sign up
     claims the server or is refused (`instance_confirming`). */
  await orClosed(asAuth((tx) => tx`select auth_claim_email(${existing})`))
  seen.claimed = true
  seen.byAddress = true
  return existing
}

/**
 * Who a provider's account is, on the way back to an invitation.
 *
 * Somebody new is made by the invitation itself, confirmed, as a member of
 * that workspace and nothing else: the workspace of their own that signing
 * up through a provider makes would be an empty second place they never
 * asked for. That is signing up by an invitation, and the person chose it
 * on the invitation's page.
 *
 * Somebody known is signed in and not joined (`press`): the callback is a
 * GET anybody can send a link to — `/auth/oauth/google/start?invite=…` —
 * and picking one's Google account is not pressing Join. It joined an
 * existing account into whoever's workspace the link was for, and a
 * workspace waiting for its person's word since the address was proved
 * along with it (H1). The page goes to the invitation
 * next, where Join is a press of its own.
 */
export async function joinByProvider(
  p: Provider,
  invite: string,
  subject: string,
  email: string,
  verified: boolean,
  name: string,
  owns = verified,
  seen: Seen = { claimed: false },
): Promise<{ actorId: string; workspaceId: string | null; press?: true } | 'conflict' | 'gone' | 'full' | 'elsewhere' | null> {
  const tokenHash = hashToken(invite)
  const found = await knownActor(p, subject, email, owns, seen)
  if (found === 'conflict') return 'conflict'
  let joined: { actorId: string; workspaceId: string | null }
  if (found) {
    /* Signed in where signing in lands — a workspace of theirs, or none —
       and sent on to the invitation's page to press Join there. */
    await asAuth((tx) => tx`select auth_identity_link(${found}, ${p}, ${subject}, ${email || null})`)
    return { actorId: found, workspaceId: await firstWorkspace(found), press: true }
  } else {
    if (!email || !verified) return null
    try {
      const [row] = await asAuth(async (tx) => {
        const rows = await tx<{ workspace_id: string; actor_id: string; created_account: boolean }[]>`
          select * from accept_invite(${tokenHash}::text, ${uuidv7()}::uuid,
                                      ${name.trim() || email.split('@')[0]!}::text, ${email}::citext, null::text,
                                      true)`
        /* Weakly, in the transaction that made it — `weakly`. */
        if (rows[0]?.created_account && weakly(p, owns)) await weaken(tx, rows[0].actor_id)
        return rows
      })
      if (!row) return 'gone'
      joined = { actorId: row.actor_id, workspaceId: row.workspace_id }
      await tellInviter(row.workspace_id, row.actor_id)
    } catch (e) {
      if ((e as { message?: string }).message?.includes('workspace_full')) return 'full'
      /* No account when `knownActor` looked, one now — a sign-up racing this
         callback. Not joined to it here: the provider's word about that
         account goes through `auth_claim_email`, which the next try's
         `knownActor` does. */
      if ((e as { code?: string }).code === '23505' || (e as { message?: string }).message?.includes('account_exists')) return 'conflict'
      /* A link handed over by hand, and the provider's address is not the
         one it names (migration 210). */
      if ((e as { message?: string }).message?.includes('invite_for_another_address')) return 'elsewhere'
      /* Mailed to a workspace's own domain: taken there, by its code, never
         here (migration 328). Left unspent. */
      if ((e as { message?: string }).message?.includes('invite_on_host')) return 'gone'
      throw e
    }
  }
  await asAuth((tx) => tx`select auth_identity_link(${joined.actorId}, ${p}, ${subject}, ${email || null})`)
  return joined
}

access.get('/oauth/google/callback', (c) => callback(c, 'google', { code: c.req.query('code') ?? '', state: c.req.query('state') ?? '' }))
access.get('/oauth/github/callback', (c) => callback(c, 'github', { code: c.req.query('code') ?? '', state: c.req.query('state') ?? '' }))
access.get('/oauth/oidc/callback', (c) => callback(c, 'oidc', { code: c.req.query('code') ?? '', state: c.req.query('state') ?? '' }))
access.post('/oauth/apple/callback', async (c) => {
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, string>)
  return callback(c, 'apple', {
    code: String(form.code ?? ''),
    state: String(form.state ?? ''),
    user: typeof form.user === 'string' ? form.user : '',
  })
})

/**
 * A provider's answer for a sign-in begun on a workspace's own domain.
 * Exactly `sign-in.md`'s who-is-this, with
 * one difference: nobody new is made, since a host signs up nobody. The
 * account must be in that workspace. The ticket is bound to the domain and
 * the host's cookie, and goes to the hostname read from the row.
 */
async function toHost(c: Context, p: Provider, params: { code?: string; state?: string; user?: string }, bound: OAuthBound) {
  const [, d = '', h = ''] = (bound.bind ?? '').split(':')
  const back = await hostBack(d)
  c.header('set-cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`, { append: true })
  if (!back) return c.redirect('/signin?oauth=failed')
  const there = (q: string) => c.redirect(`https://${back.hostname}/signin?${q}`)
  const said =
    p === 'github' ? await fromGithub(c, params.code!, bound.verifier) : p === 'oidc' ? null : await fromOidc(c, p, params, bound)
  if (!said) return there('oauth=failed')
  const since = await checkedNow()
  const seen: Seen = { claimed: false }
  const found = await knownActor(p, said.subject, said.email, said.owns, seen).catch((e: unknown) => {
    if (isClosed(e)) return null
    throw e
  })
  if (found === 'conflict') return there('oauth=conflict')
  if (!found) return there('oauth=notin')
  const member = await withActorEverywhere(found, async (tx) => {
    const [m] = await tx<{ ok: boolean }[]>`
      select true as ok from membership
      where actor_id = ${found} and workspace_id = ${back.workspaceId}
        and deleted_at is null and joined_at is not null and role in ('owner', 'member')`
    return m?.ok === true
  })
  if (!member) return there('oauth=notin')
  await asAuth((tx) => tx`select auth_identity_link(${found}, ${p}, ${said.subject}, ${said.email || null})`)
  /* Found by its address and given a new way in: the address is told, as
     the usetuff.com callback tells it. */
  if (seen.byAddress) await tellWayIn(origin(c), found, 'added', p, said.email || null)
  const ticket = generateToken('hof')
  const made = await asAuth(async (tx) => {
    await tx`select auth_not_put_out_since(${found}, ${seen.claimed ? null : since}::timestamptz)`
    await tx`select auth_ticket_make_bound(${hashToken(ticket)}, 'handoff', ${found}, ${back.workspaceId}, interval '2 minutes', ${`host:${d}:${h}`})`
    return true
  }).catch((e: { code?: string }) => {
    if (e.code === '28000') return false
    throw e
  })
  if (!made) return there('oauth=failed')
  return there(`handoff=${encodeURIComponent(ticket)}`)
}

/**
 * The page trades the ticket the callback left in its address for a
 * session. An account with a second factor is asked for it first, and the
 * ticket stays good until it is spent or runs out.
 */
access.post('/oauth/exchange', async (c) => {
  const body = z
    .object({
      handoff: z.string().min(10),
      totp: z.string().optional(),
      invite: z.string().min(10).optional(),
      verifier: z.string().min(43).max(128).optional(),
      /* The client can show the screen of a session in no workspace. */
      nowhere: z.boolean().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const hash = hashToken(body.data.handoff)
  /* Only where the sign-in began — before the second factor, so a ticket
     that is not yours does not learn whether there is one. */
  const proof = await broughtBy(c, hash, body.data.verifier)
  if (proof === 'burn') await asAuth((tx) => tx`select auth_ticket_spend(${hash}, 'handoff')`)
  if (proof !== 'ok') return c.json({ error: { code: 'unauthorized' } }, 401)
  const [t] = await asAuth(
    (tx) => tx<{ actor_id: string; workspace_id: string | null }[]>`select * from auth_ticket_peek(${hash}, 'handoff')`,
  )
  if (!t) return c.json({ error: { code: 'unauthorized' } }, 401)

  const [u] = await asAuth(
    (tx) => tx<{ totp_enabled: boolean; email: string }[]>`
      select l.totp_enabled, auth_email_of(${t.actor_id}) as email
      from auth_lookup_user(auth_email_of(${t.actor_id})) l`,
  )
  if (u?.totp_enabled) {
    if (!body.data.totp) return c.json({ error: { code: 'totp_required' } }, 401)
    /* Wrong codes counted as signing in counts them, on the same keys: the
       ticket lives two minutes, but a code is six digits. */
    const tried = await guess(u.email, c)
    if (!tried.ok) {
      return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
    }
    if (!(await secondFactor(t.actor_id, u.email, body.data.totp))) {
      return c.json({ error: { code: 'totp_required', message: 'That code didn’t match. Try again.' } }, 401)
    }
    await tried.right()
  }
  const [spent] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_ticket_spend(${hash}, 'handoff') as ok`)
  if (!spent?.ok) return c.json({ error: { code: 'unauthorized' } }, 401)
  /* An invitation is never taken here: `invite` is accepted and ignored.
     Somebody known signed in through a provider presses Join on the
     invitation's own page afterwards — the page goes there (H1). */
  const workspaceId = t.workspace_id
  if (!workspaceId) {
    /* Signed in, past the second factor, and in no workspace. */
    c.header('set-cookie', `${HANDOFF}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, { append: true })
    if (body.data.nowhere) return c.json(await startNowhereSession(t.actor_id, metaOf(c)))
    return c.json(NO_WORKSPACE_YET, 403)
  }
  c.header('set-cookie', `${HANDOFF}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, { append: true })
  const host = hostOf(c)
  if (host) {
    c.header('set-cookie', `${BEGIN}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, { append: true })
    if (workspaceId !== host.workspaceId) return c.json({ error: { code: 'unauthorized' } }, 401)
  }
  return c.json(await startSession(t.actor_id, workspaceId, metaOf(c), 'provider'))
})

/**
 * Whether this request is where the ticket's sign-in began: the browser
 * with its cookie, or the app with the secret it sent the SHA-256 of.
 *
 * A browser never trades an app's ticket: only an app's own client, which
 * sends neither `Origin` nor `Sec-Fetch-Site`, may. A browser that
 * brings one is a page that was handed it — somebody's own, sent to sign
 * a victim into it, or the victim's, from a start somebody else built —
 * and the ticket is spent so it is good to nobody.
 */
async function broughtBy(c: Context, hash: string, verifier: string | undefined): Promise<'ok' | 'refuse' | 'burn'> {
  const [row] = await asAuth((tx) => tx<{ binding: string | null }[]>`select auth_ticket_binding(${hash}, 'handoff') as binding`)
  const binding = row?.binding
  /* Begun on a workspace's own domain: traded only through that domain,
     beside the cookie its start set there — and spent by the first
     exchange that fails that, whichever way. A ticket from anywhere else
     is never traded on a host. */
  const host = hostOf(c)
  if (binding?.startsWith('host:') || host) {
    if (!binding?.startsWith('host:') || !host) return 'burn'
    const [, d, h] = binding.split(':')
    const begin = readCookie(c, BEGIN)
    if (d !== host.domainId || !begin) return 'burn'
    const brought = sha(begin)
    return brought.length === h!.length && timingSafeEqual(Buffer.from(brought), Buffer.from(h!)) ? 'ok' : 'burn'
  }
  const browser = Boolean(c.req.header('origin') || c.req.header('sec-fetch-site'))
  /* None is made bound to nothing any more; one from before is no
     request's to trade, and a page that brings one is spent. */
  if (binding == null) return browser ? 'burn' : 'refuse'
  let brought: string | null = null
  if (binding.startsWith('app:')) {
    if (browser) return 'burn'
    if (verifier) brought = `app:${b64url(createHash('sha256').update(verifier).digest())}`
  }
  if (binding.startsWith('web:')) {
    const cookie = readCookie(c, HANDOFF)
    if (cookie) brought = `web:${hashToken(cookie)}`
  }
  if (!brought || brought.length !== binding.length) return 'refuse'
  return timingSafeEqual(Buffer.from(brought), Buffer.from(binding)) ? 'ok' : 'refuse'
}

/*
 * The browser that signed up, named by a cookie.
 * The confirmation link signs in only that browser: followed anywhere else
 * it confirms the address and asks for the password, so a link of one's
 * own sent to somebody else does not swap their session for one's account.
 */
const BIND = 'tuff_bind'

export async function bindBrowser(c: Context, actorId: string): Promise<void> {
  const token = generateToken('bnd')
  await asAuth((tx) => tx`select auth_ticket_make(${hashToken(token)}, 'bind', ${actorId}, ${null}, interval '1 day')`)
  /* Without `Secure` only on a computer trying Tuff over plain http — `tryLocalhost.ts`. */
  c.header('set-cookie', `${BIND}=${token}; Path=/auth; Max-Age=86400; HttpOnly${secureAttr()}; SameSite=Lax`, { append: true })
}

async function boundTo(c: Context): Promise<string | null> {
  const token = readCookie(c, BIND)
  if (!token) return null
  const [b] = await asAuth((tx) => tx<{ actor_id: string }[]>`select actor_id from auth_ticket_peek(${hashToken(token)}, 'bind')`)
  return b?.actor_id ?? null
}

/**
 * Somebody signed up with an address that already has an account. The
 * screen said what it says to everybody; the address's own inbox is told
 * the truth.
 *
 * A confirmed account is told how to get in. One nobody has confirmed gets
 * a link that confirms it and sets its password in one step: whoever chose
 * the password it has may not be whoever reads this inbox, and a plain
 * confirmation would let the one who typed the address in.
 */
export async function sendAlreadyHere(c: Context, actorId: string, email: string): Promise<void> {
  /* Three an hour to one address: signing up again and again with
     somebody's address was a way to fill their inbox from ours. */
  if (!(await spendOn(`mail:already:${actorId}`, 3, 3600))) return
  const language = await languageFor(actorId, heard(c))
  if (await confirmed(actorId)) {
    const w = say(
      {
        subject: ['You already have a Tuff account', 'Vous avez déjà un compte Tuff'],
        what: [
          'Someone tried to sign up for Tuff with this email address, but it already has an account.',
          'Quelqu’un a essayé de s’inscrire à Tuff avec cette adresse e-mail, mais un compte existe déjà.',
        ],
        how: [
          `Sign in with this address. If you’ve forgotten your password, set a new one at ${origin(c)}/forgot.`,
          `Connectez-vous avec cette adresse. Si vous avez oublié votre mot de passe, choisissez-en un nouveau sur ${origin(c)}/forgot.`,
        ],
        then: [
          'If this wasn’t you, nothing has changed and you don’t need to do anything.',
          'Si ce n’était pas vous, rien n’a changé et vous n’avez rien à faire.',
        ],
        signIn: ['Sign in', 'Se connecter'],
      },
      language,
    )
    await send({
      to: email,
      subject: w.subject,
      ...letter([w.what, w.how, w.then], { label: w.signIn, url: `${origin(c)}/signin` }, language),
    })
    return
  }
  await sendChoosePassword(c, actorId, email, language)
}

/**
 * The letter that confirms an address and sets its password in one step —
 * the only letter an address nobody has proved is sent: a sign-up, a
 * second sign-up with the same address (`sendAlreadyHere`), signing in
 * with a password from before the password came after the proof, and an account a link with no
 * address made.
 *
 * A reset ticket, good for a day as the confirmation link was, so the
 * apps' own "Set a new password" screen takes it as it is. Its token
 * starts `chs_`, which tells the web's screen to say "Choose a password";
 * the server treats it as any reset. At most five reset links an hour.
 */
export async function sendChoosePassword(
  c: Context,
  actorId: string,
  email: string,
  language?: Awaited<ReturnType<typeof languageFor>>,
): Promise<void> {
  language ??= await languageFor(actorId, heard(c))
  const [n] = await asAuth((tx) => tx<{ n: number }[]>`select auth_ticket_recent(${actorId}, 'reset') as n`)
  if ((n?.n ?? 0) >= 5) return
  const token = await chooseTicket(actorId)
  const w = say(
    {
      subject: ['Confirm your email for Tuff', 'Confirmez votre adresse e-mail pour Tuff'],
      what: [
        'Welcome to Tuff. Confirm your email and choose a password to finish signing up.',
        'Bienvenue sur Tuff. Confirmez votre adresse e-mail et choisissez un mot de passe pour terminer votre inscription.',
      ],
      then: [
        'The link expires in 24 hours. If you didn’t sign up for Tuff, ignore this email. Nothing happens until the link is used.',
        'Le lien expire dans 24 heures. Si vous ne vous êtes pas inscrit à Tuff, ignorez cet e-mail. Rien ne se passe tant que le lien n’est pas utilisé.',
      ],
      confirm: ['Choose a password', 'Choisir un mot de passe'],
    },
    language,
  )
  await send({
    to: email,
    subject: w.subject,
    ...letter([w.what, w.then], { label: w.confirm, url: `${origin(c)}/reset/${encodeURIComponent(token)}` }, language),
  })
}

/** A reset ticket of a day for choosing a first password — `chs_`, see above. */
async function chooseTicket(actorId: string): Promise<string> {
  const token = generateToken('chs')
  await asAuth((tx) => tx`select auth_ticket_make(${hashToken(token)}, 'reset', ${actorId}, ${null}, interval '1 day')`)
  return token
}

/**
 * What a link from a change of address is about, before anything is
 * pressed — the page it opens says it. Reads and changes nothing. The account is
 * named by its name and its address masked, enough for its owner to know
 * it and for anybody else to know it is not theirs; its id, so the page can
 * tell whether the browser is signed in to it.
 */
access.post('/verify/peek', async (c) => {
  const body = z.object({ token: z.string().min(10).max(512) }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const about = await peekLink(body.data.token)
  if (!about) return c.json({ error: { code: 'gone', message: 'This link has already been used or has expired.' } }, 410)
  return c.json({
    kind: about.kind,
    email: about.email,
    account: { id: about.actorId, name: about.name, email: masked(about.current) },
    needs_session: about.needsSession,
  })
})

/**
 * The new address confirmed by a press, and the answer — for both doors:
 * `POST /api/me/email/confirm` with the account's session, and
 * `POST /auth/verify` with none for an account nobody proved (`session`
 * null). The database decides which may: `auth_email_confirm`,
 * migration 316. When the previous holder was put out with it, the
 * password went too, so the new address is sent the letter that chooses
 * one, or the person is left with no way in.
 */
export async function answerConfirmation(c: Context, token: string, session: string | null) {
  /* Outside the request's scope: confirming an unproved account's address
     from its own session puts the previous holder out — that session's
     holder among them — and what follows is the confirmation's own, which
     `auth_still_in` would otherwise refuse (`db.ts`). The database asks
     who may press (`auth_email_confirm`). */
  return outsideRequest(() => confirmationAnswered(c, token, session))
}

async function confirmationAnswered(c: Context, token: string, session: string | null) {
  const done = await confirmLink(origin(c), token, session, heard(c))
  if (done.kind === 'not_this_account') {
    return c.json(
      {
        error: {
          code: 'not_this_account',
          message: 'This link is for another account. Sign in to the account that asked for the change, then confirm.',
        },
      },
      403,
    )
  }
  if (done.kind === 'gone') return c.json({ error: { code: 'gone', message: 'This link has already been used or has expired.' } }, 410)
  if (done.kind === 'taken') {
    return c.json({ error: { code: 'conflict', message: 'That email address already has an account.' } }, 409)
  }
  if (done.kind === 'changed' && done.putOut) await sendChoosePassword(c, done.actorId, done.email)
  return c.json({ changed: true, email: done.email })
}

/**
 * A confirmation link from before the password came after the proof, followed — a letter still in
 * somebody's inbox. It confirms the address, and the password the account
 * held goes with it, in the database (`app_user_proved`, migration 212):
 * whoever chose it may not be whoever reads this inbox. The link proved
 * the inbox, so whoever followed it chooses the password now, with a ticket
 * the answer carries, and gets no session until they have.
 */
access.post('/verify', async (c) => {
  const body = z
    .object({ token: z.string().min(10).max(512), pressed: z.literal(true).optional() })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  /*
   * A link from a change of address comes here too, and nothing it says
   * is taken from opening it. The old address's yes (`approve`) only
   * from a press, said in the body. The new address's confirmation is
   * pressed from the account's own session, at `POST /api/me/email/confirm`
   * — except for an account nobody proved, which has no way to sign in
   * elsewhere: its press comes here with no session, and the database puts
   * the previous holder out with it. One proved only by hand signs in
   * anywhere and is asked for its session like any other. The apps from before
   * open the link and post it at once, without `pressed`; they are told no,
   * and nothing changes.
   */
  const about = await peekLink(body.data.token)
  if (about?.kind === 'email' && !about.needsSession) {
    if (body.data.pressed) return answerConfirmation(c, body.data.token, null)
    return c.json({ error: { code: 'press_required', message: 'Open this link in a browser and confirm the change there.' } }, 403)
  }
  if (about?.kind === 'email') {
    return c.json(
      {
        error: {
          code: 'confirm_from_account',
          message: 'Open this link in a browser signed in to the account that asked for the change, and confirm it there.',
        },
      },
      403,
    )
  }
  if (about?.kind === 'approve') {
    if (!body.data.pressed) {
      return c.json({ error: { code: 'press_required', message: 'Open this link in a browser and approve the change there.' } }, 403)
    }
    const approved = await approveLink(origin(c), body.data.token, heard(c))
    if (!approved) return c.json({ error: { code: 'gone', message: 'This link has already been used or has expired.' } }, 410)
    return c.json({ approved: true, email: approved.email })
  }
  const hash = hashToken(body.data.token)
  const [t] = await asAuth((tx) => tx<{ actor_id: string }[]>`select * from auth_ticket_peek(${hash}, 'verify')`)
  if (!t) return c.json({ error: { code: 'gone', message: 'This link has already been used or has expired.' } }, 410)
  const [spent] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_ticket_spend(${hash}, 'verify') as ok`)
  if (!spent?.ok) return c.json({ error: { code: 'gone' } }, 410)
  /* On your own server, confirming an applicant claims it or is refused
     (`instance_confirming`): `sign_up_closed`, said by the error handler. */
  await asAuth((tx) => tx`select auth_confirm_email(${t.actor_id})`)
  const [pw] = await asAuth((tx) => tx<{ none: boolean }[]>`select auth_password_hash(${t.actor_id}) is null as none`)
  if (pw?.none) return c.json({ confirmed: true, choose_password: await chooseTicket(t.actor_id) })
  /* Confirmed before, by another way, with a password chosen since. */
  return c.json({ confirmed: true })
})

/*
 * A forgotten password. The answer is the same whether or not there is an
 * account, and the link is good for an hour, once.
 */
access.post('/password/forgot', async (c) => {
  const body = z.object({ email: z.email() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const email = body.data.email.toLowerCase()
  const [u] = await asAuth((tx) => tx<{ actor_id: string }[]>`select actor_id from auth_lookup_user(${email})`)
  if (u) {
    const [n] = await asAuth((tx) => tx<{ n: number }[]>`select auth_ticket_recent(${u.actor_id}, 'reset') as n`)
    if ((n?.n ?? 0) < 5) {
      const token = generateToken('rst')
      await asAuth((tx) => tx`select auth_ticket_make(${hashToken(token)}, 'reset', ${u.actor_id}, ${null}, interval '1 hour')`)
      const url = `${origin(c)}/reset/${encodeURIComponent(token)}`
      /* Sent, not waited for: waiting on the mail service only when there
         is an account made the answer slower for addresses that have one,
         which is the very thing the same answer for every address hides.
         The language is asked first all the same — one more query of our
         own, not a wait on somebody else's service. */
      const language = await languageFor(u.actor_id, heard(c))
      const w = say(
        {
          subject: ['Set a new password for Tuff', 'Choisissez un nouveau mot de passe pour Tuff'],
          what: [
            'Someone asked to set a new password for your Tuff account.',
            'Quelqu’un a demandé à changer le mot de passe de votre compte Tuff.',
          ],
          then: [
            'The link expires in 1 hour and can only be used once. If this wasn’t you, ignore this email and nothing will change.',
            'Le lien expire dans 1 heure et ne peut servir qu’une fois. Si ce n’était pas vous, ignorez cet e-mail et rien ne changera.',
          ],
          set: ['Set a new password', 'Choisir un nouveau mot de passe'],
        },
        language,
      )
      void send({ to: email, subject: w.subject, ...letter([w.what, w.then], { label: w.set, url }, language) })
    }
  }
  return c.json({ ok: true })
})

/** Whether a workspace the account was in waits for its Join or Leave — `confirming.ts`. */
async function waitingAnswer(actorId: string): Promise<boolean> {
  const rows = await withActorEverywhere(actorId, (tx) => tx`select 1 from memberships_unconfirmed() limit 1`)
  return rows.length > 0
}

/**
 * The link's token and the new password; every session is signed out.
 *
 * For an address nobody had proved — the sign-up letter, or any reset that
 * an unconfirmed account follows — setting it is the proof, and in the
 * browser that signed up it signs in, into the account's first workspace,
 * as following the confirmation link used to.
 * Anywhere else the answer is `{ ok: true }` and the screen says to sign
 * in: a link that signed in whoever opened it would let somebody hand
 * their own account to a person already signed in.
 */
access.post('/password/reset', async (c) => {
  const body = z.object({ token: z.string().min(10), password: z.string().min(12) }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const hash = hashToken(body.data.token)
  const [t] = await asAuth((tx) => tx<{ actor_id: string }[]>`select * from auth_ticket_peek(${hash}, 'reset')`)
  if (!t) return c.json({ error: { code: 'gone', message: 'This link has already been used or has expired.' } }, 410)
  const passwordHash = await hashPassword(body.data.password)
  const [was] = await asAuth(
    (tx) => tx<{ email: string; had: boolean; proved: boolean }[]>`
      select auth_email_of(${t.actor_id}) as email, auth_password_hash(${t.actor_id}) is not null as had,
             coalesce(auth_email_confirmed(${t.actor_id}), false) as proved`,
  )
  /* Asked before the password is set: setting it for an address nobody
     proved spends every open ticket, the browser's among them. */
  const here = !was?.proved && (await boundTo(c)) === t.actor_id
  /* Spent in the transaction that sets the password: a reset that fails —
     a put-out waiting longer than its hold allows — leaves the link good
     (migration 317). */
  const spent = await asAuth(async (tx) => {
    const [s] = await tx<{ ok: boolean }[]>`select auth_ticket_spend(${hash}, 'reset') as ok`
    if (!s?.ok) return false
    await tx`select auth_set_password(${t.actor_id}, ${passwordHash})`
    return true
  })
  if (!spent) return c.json({ error: { code: 'gone' } }, 410)
  /* And every Google or Apple sign-in: a reset shuts the doors somebody
     thinks are open, and those were open beside the password. A provider
     that vouches for the address links again on the next sign-in. */
  await asAuth((tx) => tx`select auth_identity_forget(${t.actor_id}, ${null})`)
  /* The first password, chosen from the letter: the proof and the sign-in. */
  if (was && !was.proved) {
    const workspaceId = here ? await firstWorkspace(t.actor_id) : null
    if (workspaceId) return c.json({ ok: true, ...(await startSession(t.actor_id, workspaceId, metaOf(c), 'email_link')) })
    /* Every workspace it was in waits for the person's word now — joined
       before the proof (`password-after-proof.md`). In the same browser, the
       question is the next screen, in a session in no workspace, rather
       than "sign in". */
    if (here && (await waitingAnswer(t.actor_id))) {
      return c.json({ ok: true, ...(await startNowhereSession(t.actor_id, metaOf(c))) })
    }
    return c.json({ ok: true })
  }
  /* Said to the address, as a change from Account is: a reset is the way
     somebody who has the inbox, or an old link, would take an account, and
     the owner should hear of it somewhere other than the screen they were
     just shut out of. Not waited for. Not for the first password of an
     address just proved: whoever reads the inbox is who chose it. */
  if (was?.email) {
    const language = await languageFor(t.actor_id, heard(c))
    const support = edition.vendor?.support ?? null
    const w = say(
      {
        subject: ['Your Tuff password was reset', 'Le mot de passe de votre compte Tuff a été réinitialisé'],
        reset: [
          'The password for your Tuff account was just reset. Every device was signed out, and tokens for connected tools were revoked.',
          'Le mot de passe de votre compte Tuff vient d’être réinitialisé. Tous les appareils ont été déconnectés, et les jetons des outils connectés ont été révoqués.',
        ],
        set: [
          'A password was just set for your Tuff account. Every device was signed out.',
          'Un mot de passe vient d’être défini pour votre compte Tuff. Tous les appareils ont été déconnectés.',
        ],
        /* The service's own address, or on your own server its owner — `edition.vendor`. */
        then: support
          ? [
              `If this wasn’t you, reset your password again and email ${support}.`,
              `Si ce n’était pas vous, réinitialisez de nouveau votre mot de passe et écrivez à ${support}.`,
            ]
          : [
              'If this wasn’t you, reset your password again and tell the owner of this server.',
              'Si ce n’était pas vous, réinitialisez de nouveau votre mot de passe et prévenez le propriétaire de ce serveur.',
            ],
        again: ['Reset password', 'Réinitialiser le mot de passe'],
      },
      language,
    )
    void send({
      to: was.email,
      subject: w.subject,
      ...letter([was.had ? w.reset : w.set, w.then], { label: w.again, url: `${origin(c)}/forgot` }, language),
    })
  }
  return c.json({ ok: true })
})
