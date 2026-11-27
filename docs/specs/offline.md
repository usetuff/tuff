# Offline

What a window shows when the server cannot be reached.

## What it was

The browser's "You're offline" page. The service worker kept nothing, so
there was no app to open; and when there was a page, a failed `/me` was
read as a session that had ended and the sign-in was drawn — which cannot
work either. Every screen already kept its last answer in memory
(`data/memory.ts`), but only for the life of the tab.

## What it is

**Reading, not writing.** A window opened with no connection is the app,
drawing what this device last loaded for this account in this workspace,
and the top bar says Offline. Nothing else changes: a change made while
offline fails the way a change fails when the server refuses it. Queuing
writes to send later is a different thing — an order of operations, a
merge, a way back — and it is the part the rebuild removed. It is not done here.

**The files.** `public/sw.js` keeps the page and every hashed file of its
build, found by following what each bundle says it loads: the page names
its entry, and the entry names the app and every screen fetched later.
The app is not inside the entry since the landing stopped downloading it,
so keeping only what the page named left
the app out, and a window opened offline was a blank page. The page is
fetched from the network first, every time — a deploy is seen on the next
load — and the kept copy is used only when the network does not answer
within four seconds. A bundle never changes under its name, so the kept
one is the file. What the old build had that the new one does not is
deleted, so one version of the app is kept, not every one.
`/api`, `/auth` and the socket are never touched by the worker.

**The answers.** `remember()` also writes to IndexedDB, a second after the
last answer to the same question, under `<actor>:<workspace>`. They are
read back only when a request could not be sent at all (`Unreachable` in
`data/api.ts`) — a server that answers, even with an error, is not
offline. With a connection the server's answer is the only one drawn.
Signing out deletes them — which it said and did not do: `forget()` was
written for it and called by nothing, so the next person on a shared
machine was drawn the last one's sidebar, inbox and searches, and IndexedDB
kept what they had read. Signing out, or a session ended from elsewhere,
now waits for the copy to be cleared, removes the drafts and rooms kept
under `tracker:`, drops this device's push subscription, asks the browser
to drop the files it cached (`Clear-Site-Data: "cache"` on `/auth/logout`),
and starts the page again at `/signin`. Removed from the workspace, the
same happens and the sign-in says why — `removing-someone.md`, "On their
devices".

**What the worker keeps is the page and nothing else.** A file opened in
its own tab, a frame or a window is a navigation too, and the worker kept
any navigation that answered as the page — a PDF became what every address
opened to offline, for whoever came next. `/api`, `/auth`, `/ws`, `/hooks`
and `/health` are left to the network whatever the request, only a
`text/html` answer is kept, and the cache is `shell-v3` so a v2 that held a
file is thrown away.

`/me`, the projects, the people, the rooms and the inbox are kept together
as `shell`, because they are the frame every other screen is drawn into. A
window opened offline with nothing kept for whoever was last signed in
says so in a line instead of drawing an empty app.

**Unreachable is not refused.** A loader that blanked its screen on any
error now keeps it when the server could not be asked (`unlessOffline`):
a column list emptied because the train went into a tunnel is the screen
lying about the work. An attachment that cannot be fetched says "not
available offline", not "no longer here", and asks again when the
connection is back.

**Coming back.** The browser's `online` event, or any request that gets an
answer, clears the indicator, reloads the frame and asks every screen
again — the same refetch a reload does.

## What is not kept

What was never opened on this device; a task's own screen beyond what the
list shows; pictures and files (their addresses are signed and short-lived,
and the bytes are not stored). Search needs the server.

## Said across the top of the window

The top bar's "Offline" pill was one control among five, the size of a
search button, and easy to read past — and a list that looks live and is
ten minutes old is the thing worth being told about. It is a band across
the very top of the window now, above everything, on every page the app
draws — the workspace, signing in, an invitation — and the pill is gone, so
it is said in one place.

- **Offline**: a band of twenty-eight pixels in the ground of the window,
  "You're offline — showing what this device last loaded. Changes won't be
  saved until you're back." It pushes the window down rather than covering
  its top bar, so nothing under it is hidden.
- **Back**: when the connection returns the band says "Back online" in green
  for two seconds and folds away — the moment somebody can trust the screen
  again is worth a word too.
- It appears and goes in one frame, with the window moving down and back
  by its height: a band sliding while the whole window resizes under it was
  two motions for one fact.

## What a device keeps

The lists and the shell are one answer each and are kept whole. What is
about one thing — a task, a document, a post, a person, a room's messages —
is kept for the last sixty in memory and the last hundred and twenty on the
disk, the oldest let go as new ones come (`data/memory.ts`). At a start only
the lists and the shell are read back; the rest is read when the server
cannot be reached. Kept without a bound, a phone that had opened a few
hundred tasks and documents read every one back at every start, and Safari
ended the tab, and ended it again on reload, on a board that held none of it.
