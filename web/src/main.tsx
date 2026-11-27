import { lazy, StrictMode, Suspense } from 'react'
import { onHost } from './data/host.js'
import { OfflineBand } from './ui/OfflineBand.jsx'
import { createRoot } from 'react-dom/client'
import { stored, Unreachable } from './data/api.js'
import { watchKeyboard } from './data/keyboard.js'
import { guardDrops } from './ui/DropFiles.jsx'
import { now } from './data/words.js'
import { front } from './edition.front.jsx'
import { wearKept } from './data/brand.js'
watchKeyboard()
guardDrops()
/* The page says which language it is in, for a screen reader's voice and
   a browser's offer to translate. */
document.documentElement.lang = now

/* The app itself, and an invitation's page, fetched only by somebody who
   opens them: the landing and the site are read by people who have
   neither, on phones, and were downloading the whole app — 700 KB
   compressed — before their page could answer a tap. */
const App = lazy(() => import('./ui/App.jsx').then((m) => ({ default: m.App })))
const Join = lazy(() => import('./ui/Join.jsx').then((m) => ({ default: m.Join })))
/* Sign-up, and the ways back into an account, fetched only by somebody who
   sees them. */
const SignUp = lazy(() => import('./ui/SignUp.jsx').then((m) => ({ default: m.SignUp })))
const Forgot = lazy(() => import('./ui/Access.jsx').then((m) => ({ default: m.Forgot })))
const Reset = lazy(() => import('./ui/Access.jsx').then((m) => ({ default: m.Reset })))
const Verify = lazy(() => import('./ui/Access.jsx').then((m) => ({ default: m.Verify })))
/* What the edition keeps or counts before anything is drawn — on the
   service the French front door and what its site remembers.
   `edition.front.tsx`. */
front.boot(location.pathname.replace(/^\/fr(?=\/|$)/, '') || '/', Boolean(stored()))
const here = location.pathname.replace(/^\/fr(?=\/|$)/, '') || '/'
/* On a workspace's own domain there is one workspace: `/` is it when signed
   in and its sign-in otherwise, and none of the site's pages are drawn. */
const host = onHost()
if (host && here === '/') history.replaceState(null, '', stored() ? `/${host.slug}` : '/signin')
/* A document shared to the web. */
const PublicDoc = lazy(() => import('./ui/PublicDoc.jsx').then((m) => ({ default: m.PublicDoc })))
const shared = /^\/d\/([A-Za-z0-9_-]+)\/?$/.exec(location.pathname)?.[1]
/* A project's feedback page, and the page its mailed link opens.
   Read by anybody, never counted. */
const FeedbackPage = lazy(() => import('./ui/FeedbackPage.jsx').then((m) => ({ default: m.FeedbackPage })))
const FeedbackConfirm = lazy(() => import('./ui/FeedbackPage.jsx').then((m) => ({ default: m.FeedbackConfirm })))
const feedbackAt = /^\/f\/([a-z0-9][a-z0-9-]{1,38}[a-z0-9])(?:\/confirm\/([A-Za-z0-9_-]{43}))?\/?$/.exec(location.pathname)
/* An agent asking to be connected. */
const Connect = lazy(() => import('./ui/Connect.jsx').then((m) => ({ default: m.Connect })))
/* A link from a password mail. */
const resetting = /^\/reset\/([^/?#]+)/.exec(location.pathname)?.[1]
/* And from a confirmation mail. */
const confirming = /^\/verify\/([^/?#]+)/.exec(location.pathname)?.[1]
/* Your own server's first opening. `/setup`
   is the setup screen only while the server says so in the page (armed,
   nobody owns it); otherwise it is an address like any other, a workspace
   called "setup" among them. Where nothing wrote the page — the dev
   server — the link's own token says it. */
const Setup = lazy(() => import('./ui/Setup.jsx').then((m) => ({ default: m.Setup })))
const settingUp =
  here === '/setup' &&
  (document.querySelector('meta[name="tuff-setup"]')?.getAttribute('content') === 'open' ||
    (!document.querySelector('meta[name="tuff-providers"]') && new URLSearchParams(location.search).has('token')))
import './theme.css'

/* An invitation is answered before the app: whoever follows one may have no
   account, or be signed in as somebody else, and the shell would read
   `/invite/…` as a workspace called "invite" and send them somewhere else. */
const invited = /^\/invite\/([^/?#]+)/.exec(location.pathname)?.[1]

/* The edition's own pages first — on the service the landing at `/` for
   somebody with no session, the site, a board by link. Then
   `/signup` makes an account; `/oauth/authorize` is an agent asking to be
   connected. Everything else is the app, which asks for a sign-in where it
   needs one — and on your own server that is what `/` is. */
const path = here
const edition_ = host ? null : front.page(path, Boolean(stored()))
const app =
  !invited &&
  !edition_ &&
  !settingUp &&
  !['/signup', '/forgot', '/oauth/authorize'].includes(path) &&
  !shared &&
  !feedbackAt &&
  !resetting &&
  !confirming
/* A branded workspace's icon and name, as the tab last wore them, before
   the server has said again — `data/brand.ts`. */
if (app) wearKept(stored()?.workspace_id)
const page = invited ? (
  <Join token={decodeURIComponent(invited)} />
) : (
  (edition_ ??
  (settingUp ? (
    <Setup />
  ) : path === '/signup' ? (
    <SignUp />
  ) : path === '/forgot' ? (
    <Forgot />
  ) : path === '/oauth/authorize' ? (
    <Connect />
  ) : shared ? (
    <PublicDoc token={shared} />
  ) : feedbackAt ? (
    feedbackAt[2] ? (
      <FeedbackConfirm slug={feedbackAt[1]!} token={feedbackAt[2]} />
    ) : (
      <FeedbackPage slug={feedbackAt[1]!} />
    )
  ) : resetting ? (
    <Reset token={decodeURIComponent(resetting)} />
  ) : confirming ? (
    <Verify token={decodeURIComponent(confirming)} />
  ) : (
    <App />
  )))
)

/*
 * A public page arrives as HTML — and its words stay
 * on the screen while its script is fetched: the HTML is what the page waits
 * behind, rather than a blank. Not the landing for somebody signed in at
 * `/`, who is being shown the app.
 */
const rootEl = document.getElementById('root')!
const written = rootEl.querySelector<HTMLElement>('[data-prerendered]')
const kept = written && !(written.hasAttribute('data-home') && stored()) ? written.innerHTML : null

createRoot(rootEl).render(
  <StrictMode>
    {/* Above every page: the window saying it cannot reach the server. */}
    <OfflineBand />
    <Suspense fallback={kept ? <div data-prerendered dangerouslySetInnerHTML={{ __html: kept }} /> : null}>{page}</Suspense>
  </StrictMode>,
)

/*
 * The worker that keeps the app's own files, so a window opened with no
 * connection is the app — `docs/specs/offline.md`. Built copies only: under
 * the dev server the files are not hashed and change on every save.
 *
 * And only where the app is drawn. The worker keeps every file of the
 * build, the app's among them, and registered from the landing it fetched
 * all of it in the background for somebody reading a page of the site —
 * the download the landing stopped making, made anyway, and competing with
 * the page's own files on a phone's connection.
 */
if (import.meta.env.PROD && app && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
} else if (import.meta.env.PROD && !app && !stored() && 'serviceWorker' in navigator) {
  /* A worker registered from the landing before this, for somebody with no
     session — who has no app to keep and nothing to be told: let go of it,
     or its next update fetches the whole build for a reader of the site. */
  navigator.serviceWorker
    .getRegistration('/')
    .then((reg) => reg?.unregister())
    .catch(() => {})
}

/*
 * A read that could not be sent while offline is expected, not a fault.
 *
 * Most loaders are fire-and-forget — the screen keeps what it had — so their
 * rejections went unhandled and every screen opened offline printed errors
 * that said nothing anybody needed to know. Every other rejection is left
 * to be loud. `docs/specs/offline.md`.
 */
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof Unreachable) e.preventDefault()
})
