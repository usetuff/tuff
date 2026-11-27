/*
 * The service worker: a notification, and the app's own files.
 *
 * Push is the push spec. The files are `docs/specs/offline.md`: the
 * page and its build's hashed files are kept, so a window opened with no
 * connection is the app — drawing what this device last loaded — rather
 * than the browser's "You're offline".
 *
 * Still not a data cache. `/api`, `/auth` and the socket are never touched
 * here; what the screens last read is kept by the app itself, under the
 * account it belongs to, and deleted on signing out. A worker that answered
 * API requests from a cache would be a second copy of the data with its own
 * idea of what is true, which is the thing the rebuild removed on purpose.
 */
/* v3: a v2 shell could be a private file kept as the page — `page()` below
   took any navigation that answered, a PDF opened in its own tab included.
   Bumped so that copy is thrown away wherever it was kept. */
const SHELL = 'shell-v3'

/*
 * The page, and every file of its build under `/assets/`. Found by
 * following the bundles' own lists of what they load rather than listed,
 * because the names change with every build: the page names its entry, and
 * the entry names the app and every screen fetched later — which have to
 * be kept too, since the app is no longer inside the entry (the landing
 * loads without it). Whatever the old build had
 * that this one does not is thrown away, so the cache holds one version of
 * the app and not every one ever deployed.
 */
async function keepShell(page) {
  const cache = await caches.open(SHELL)
  const html = await page.clone().text()
  await cache.put('/', page)
  const wanted = new Set()
  let next = html.match(/\/assets\/[^"'\s)]+/g) ?? []
  while (next.length) {
    const found = []
    await Promise.all(
      next.map(async (path) => {
        if (wanted.has(path)) return
        wanted.add(path)
        let res = await cache.match(path, { ignoreVary: true })
        if (!res) {
          const got = await fetch(path)
          if (!got.ok) return
          await cache.put(path, got.clone())
          res = got
        }
        if (!path.endsWith('.js')) return
        for (const name of (await res.clone().text()).match(/assets\/[\w.-]+\.(?:js|css)/g) ?? []) found.push(`/${name}`)
      }),
    )
    next = found.filter((path) => !wanted.has(path))
  }
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname
    if (path.startsWith('/assets/') && !wanted.has(path)) await cache.delete(req)
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    /* The app's own page, by an address that is nothing but the app: `/`
       is the landing written out as HTML now. */
    fetch('/signin')
      .then((res) => (res.ok ? keepShell(res) : undefined))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== SHELL).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  ),
)

/*
 * The network first for the page, always: a deploy is seen on the next load,
 * as it was. The kept copy only when the network does not answer — or does
 * not answer within four seconds, because a connection that hangs is the
 * common way of having none.
 */
async function page(request) {
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000)),
    ])
    /* Only the app's page is kept as the app's page. A file opened in a
       tab, a frame or a new window is a navigation too, and keeping it
       under `/` made a confidential PDF the page every address opened to
       offline — for whoever used the machine next. */
    /* Nor a public page written out as HTML: it is
       the app's page with a page of words in it, and opened offline as
       the app it would show those words first. */
    if (res.ok && (res.headers.get('content-type') ?? '').startsWith('text/html') && !res.headers.get('x-tuff-written')) {
      const copy = res.clone()
      keepShell(copy).catch(() => {})
    }
    return res
  } catch {
    const kept = await caches.match('/', { ignoreVary: true })
    return kept ?? Response.error()
  }
}

/*
 * A hashed file never changes under its name, so the kept one is the file.
 *
 * Looked up by its address and nothing else. The page asks for its bundles
 * `crossorigin`, so the request carries an `Origin` the install's plain
 * fetch did not — and with `Vary: Origin` on the response the cache said
 * it had no such file, the bundle failed offline, and the app was a blank
 * page with a title.
 */
async function file(request) {
  const kept = await caches.match(new URL(request.url).pathname, { ignoreVary: true })
  if (kept) return kept
  const res = await fetch(request)
  if (res.ok) {
    const cache = await caches.open(SHELL)
    cache.put(new URL(request.url).pathname, res.clone()).catch(() => {})
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  /* The data and the doors are the network's, even when opened as a page:
     a file at `/api/blob/…` in its own tab, a provider's callback. And the
     blog, which is another site's pages at this address — kept as the
     app's page, a post would be what the app opened to offline; and the
     digest's own page, for the same reason. */
  if (/^\/(api|auth|ws|hooks|health|blog|digest)(\/|$)/.test(url.pathname)) return
  if (req.mode === 'navigate') return e.respondWith(page(req))
  if (url.pathname.startsWith('/assets/')) return e.respondWith(file(req))
})

/*
 * Which of two reasons about one thing is the one worth saying.
 *
 * Work you have been given outranks being named in a sentence, which
 * outranks something you are merely watching. It matters because several
 * notifications about one task become one notification — see the tag below —
 * and without an order the last one wins, so "given to you" was being
 * replaced by "somebody mentioned you" and the one to act on was the one
 * that disappeared.
 */
const WEIGHT = { assigned: 3, mentioned: 2, subscribed: 1 }

self.addEventListener('push', (event) => {
  /*
   * A push with no readable payload still means something happened. Better a
   * notification that says little than silence, because silence is
   * indistinguishable from the feature not working.
   */
  /* In the language the browser reads: the person's own choice is kept by
     the page, where a worker cannot reach it, and a push that arrives whole
     was already written in theirs by the server. */
  const fr = String((self.navigator && self.navigator.language) || '').slice(0, 2).toLowerCase() === 'fr'
  let told = { title: 'Tuff', body: fr ? 'Du nouveau pour vous' : 'Something for you', url: '/' }
  try {
    told = { ...told, ...event.data.json() }
  } catch (e) {
    /* keep the fallback */
  }

  event.waitUntil(
    Promise.all([
      /*
       * The number on the icon, set from here because the app is usually not
       * running when a push lands — which is the whole reason the icon
       * carries it. Silent in a tab, which has no icon to put it on.
       */
      typeof told.unread === 'number' && self.navigator.setAppBadge
        ? told.unread > 0
          ? self.navigator.setAppBadge(told.unread)
          : self.navigator.clearAppBadge()
        : Promise.resolve(),
      /*
       * What is already on the screen about this same thing, so the stronger
       * reason survives the replacement rather than the later one.
       */
      self.registration
        .getNotifications({ tag: told.tag || told.url })
        .then((already) => {
          const before = already[0] && already[0].data
          const keep =
            before && (WEIGHT[before.reason] || 0) > (WEIGHT[told.reason] || 0) ? before : told
          return self.registration.showNotification(keep.title || told.title, {
            body: keep.body,
            /* PNG and not the SVG the page uses for its favicon: Chrome does
               not draw an SVG in a notification, and an icon that silently
               fails to load is one nobody can tell from one nobody chose. */
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            /*
             * One notification per object, replaced rather than stacked:
             * three comments on one task while somebody is at lunch is one
             * thing to come back to, not three. How many there are is on the
             * icon; which one matters is in here.
             */
            tag: told.tag || told.url,
            /* Replaced and said again, because a replacement nobody is told
               about is a notification that arrived while they were looking
               away and then never existed. */
            renotify: true,
            data: { url: keep.url || told.url, reason: keep.reason, title: keep.title },
          })
        }),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  /* Only ever somewhere on this site: a link that resolves to another
     origin — `//elsewhere/…` — opens the app's root instead. */
  const asked = event.notification.data?.url || '/'
  let url = '/'
  try {
    const at = new URL(asked, self.location.origin)
    if (at.origin === self.location.origin) url = at.pathname + at.search + at.hash
  } catch (e) {
    url = '/'
  }
  /*
   * The tab that is already open, if there is one.
   *
   * Everything in this product has an address, so there is somewhere exact to
   * go — and opening a second tab on a workspace somebody already has open is
   * the notification losing them their place.
   */
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (new URL(tab.url).origin === self.location.origin) {
          return tab.focus().then(() => tab.navigate(url)).catch(() => tab.focus())
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
