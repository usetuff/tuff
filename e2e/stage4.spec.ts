import { test, expect } from '@playwright/test'
import { add, drawnWhole, login, openProject, stillBox, swipeUp } from './helpers.js'

test('one place for everything addressed to me, split by why it arrived', async ({ page }) => {
  await login(page)
  await page.getByTestId('nav-notifications').click()
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({
    timeout: 15_000,
  })
  // No grid of checkboxes: the only division is the reason, and it is the one
  // somebody can act on.
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeVisible()
})

test('the feed names who did it and whether a tool did it', async ({ page }) => {
  await login(page)
  // Something to see: creating a project writes to the feed.
  const name = `Feed ${Date.now()}`
  await add(page, 'new-project', name)
  await expect(page.locator('aside [data-project]').filter({ hasText: name })).toBeVisible({
    timeout: 15_000,
  })

  /* The feed is a page of its own again, and for the opposite reason to the
     one that merged it: it shared a tab with Announcements on the grounds
     that what was said and what happened are one question, and a list that
     grows every time anybody touches anything pushed the announcements off
     the screen. */
  await openProject(page, name)
  await page.getByTestId('tool-activity').click()
  await expect(page.locator('[data-event]').first()).toBeVisible({ timeout: 15_000 })
  // What it says, not what it stores. `project.create` is the right key for a
  // log and the wrong thing to show a person.
  await expect(page.locator('[data-event]').first()).toContainText('created the project')
})

test('being assigned something puts it in the inbox', async ({ page }) => {
  await login(page)
  await openProject(page, 'Acme rebrand')
  await page.getByTestId('tool-tasks').click()

  // Assigning is done from the API here because the task screen has no
  // assignee picker yet; what is being tested is that the inbox hears about it.
  const title = `Assigned ${Date.now()}`
  await add(page, 'new-task', title)
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('nav-notifications').click()
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  // Your own action is never reported back to you: an inbox that does that is
  // one people learn to ignore.
  await expect(page.locator('[data-note]').filter({ hasText: title })).toHaveCount(0)
})

/*
 * Who did it, as a face with what kind of thing on it, and what is new
 * stays tinted while the panel is open — `docs/specs/inbox.md`.
 *
 * The server has everything read the moment the panel opens, and the tint
 * used to be read off that: the next answer from it, a second note arriving,
 * took every tint away while the person was still looking at them.
 */
test('a note shows who did it and stays new while the panel is open', async ({ page, browser }) => {
  await login(page)
  await page.goto('/')
  const stamp = Date.now()
  const made = await page.evaluate(async (n) => {
    const s = JSON.parse(localStorage.getItem('session') ?? 'null') as { access_token: string }
    const ask = (path: string, body?: unknown) =>
      fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${s.access_token}`, 'x-api-version': '1', 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }).then((r) => r.json())
    const me = await ask('/api/me')
    const project = ((await ask('/api/projects')).projects as { id: string }[])[0]!.id
    const task = await ask(`/api/projects/${project}/tasks`, { title: `Hero crop ${n}` })
    const invite = (await ask('/api/invites', { project_ids: [project] })).token as string
    return { me: me.actor.id as string, task: (task.id ?? task.task?.id) as string, invite }
  }, stamp)

  // Somebody else, in by the link, says something to the owner on the task.
  const them = await (await browser.newContext()).newPage()
  await them.goto(`/invite/${made.invite}`)
  await them.getByTestId('join-name').fill(`Kit ${stamp}`)
  await them.getByTestId('join-email').fill(`kit${stamp}@example.com`)
  await them.getByTestId('join-password').fill('correct-horse-battery-staple')
  await them.getByTestId('join').click()
  await expect(them.locator('aside [data-project]').first()).toBeVisible({ timeout: 20_000 })
  const say = (words: string) =>
    them.evaluate(
      async ({ task, me, words }) => {
        const s = JSON.parse(localStorage.getItem('session') ?? 'null') as { access_token: string }
        const r = await fetch(`/api/tasks/${task}/comments`, {
          method: 'POST',
          headers: { authorization: `Bearer ${s.access_token}`, 'x-api-version': '1', 'content-type': 'application/json' },
          body: JSON.stringify({
            body: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'mention', attrs: { id: me, label: 'you' } },
                    { type: 'text', text: ` ${words}` },
                  ],
                },
              ],
            },
          }),
        })
        return r.status
      },
      { task: made.task, me: made.me, words },
    )
  /*
   * Heard before the panel is opened, so what is measured is the panel
   * opening and not a note arriving into it.
   *
   * Heard as this note, not as the bell lit: Kit's joining lights it too,
   * and so does anything an earlier test left unread in this studio. The
   * full run opened the panel on that while this note was still a second
   * from being read. Waited for as the shell's answer that holds
   * it, and the bell drawn from that answer.
   */
  const heard = page.waitForResponse(
    async (r) => r.url().endsWith('/api/inbox') && (await r.text().catch(() => '')).includes(`Hero crop ${stamp}`),
    { timeout: 15_000 },
  )
  expect(await say('the crop is too tight on the left')).toBeLessThan(300)
  const { unread } = (await (await heard).json()) as { unread: Record<string, string> }
  const waiting = Object.values(unread).reduce((n, v) => n + Number(v), 0)
  await expect(page.getByTestId('nav-notifications').getByTestId('inbox-count')).toHaveText(String(waiting))
  /* This attempt's task by name: a retry runs in the same studio, and its
     first attempt's note says the same words. */
  const first = page
    .locator('[data-note]')
    .filter({ hasText: `Hero crop ${stamp}` })
    .filter({ hasText: 'the crop is too tight' })
  /* Drawn whole: the list arrives with the panel, not after it. */
  const heights = await drawnWhole(page, '[data-notes-panel] [data-fluid]', () => page.getByTestId('nav-notifications').click())
  expect(heights).toHaveLength(1)
  await expect(first).toBeVisible({ timeout: 15_000 })
  // Their face, with the kind of thing on it, and their name in the line.
  await expect(first.locator('[data-note-by]')).toHaveText(`Kit ${stamp}`)
  await expect(first.locator('[data-note-glyph]')).toHaveCount(1)
  await expect(first).toHaveAttribute('data-unread', 'true')
  const ground = await first.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(ground).not.toBe('rgba(0, 0, 0, 0)')

  /* A second note arrives while it is open, and the inbox is read again
     behind it: the first is read on the server by now, and still new here. */
  expect(await say('and the logo wants more room')).toBeLessThan(300)
  await expect(
    page
      .locator('[data-note]')
      .filter({ hasText: `Hero crop ${stamp}` })
      .filter({ hasText: 'the logo wants more room' }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(first).toHaveAttribute('data-unread', 'true')

  // Shut and opened again, it is read and plain.
  await page.getByTestId('close-notes').click()
  await expect(page.locator('[data-notes-panel]')).toHaveCount(0, { timeout: 15_000 })
  await page.getByTestId('nav-notifications').click()
  await expect(first).toBeVisible({ timeout: 15_000 })
  await expect(first).not.toHaveAttribute('data-unread', 'true')

  /* Opened from the inbox, Back leaves for where the inbox was opened
     from, not into the inbox again. */
  await first.click()
  await expect(page.locator('[data-notes-panel]')).toHaveCount(0, { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/notifications$/)
  await page.goBack()
  await expect(page).not.toHaveURL(/\/notifications$/)
  await expect(page.locator('[data-notes-panel]')).toHaveCount(0)
})

/*
 * On a phone the notifications would not scroll — and not only on a
 * phone. The list is a `Panel`, which clips what is in it for its corners,
 * inside a column scroller; a flex item that clips may shrink below its
 * content, so it shrank to the scroller and cut the rows off itself, and the
 * scroller had nothing past its own height to move.
 *
 * Thirty notes from the inbox, enough for any screen: what is under test is
 * the panel's layout, not how a note comes to be.
 */
test.describe('a phone with a long inbox', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the notifications scroll to the last one under a finger', async ({ page }) => {
    const notes = Array.from({ length: 30 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      reason: 'due',
      object_type: 'task',
      object_id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`,
      project_id: null,
      title: `Note ${i + 1} of a long inbox`,
      read_at: new Date().toISOString(),
      created_at: new Date(Date.now() - i * 60_000).toISOString(),
    }))
    await page.route('**/api/inbox', (route) =>
      route.fulfill({
        json: { notifications: notes, unread: { mentioned: '0', assigned: '0', subscribed: '0' } },
      }),
    )
    await login(page)
    await page.getByTestId('nav-notifications').first().click()
    const list = page.locator('[data-notes-panel] [data-reads-down]')
    await expect(page.locator('[data-note]')).toHaveCount(30, { timeout: 15_000 })
    const last = page.locator('[data-note]').last()

    // There is more than a screen of it, and the scroller knows so.
    const room = await list.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }))
    expect(room.scroll).toBeGreaterThan(room.client + 400)

    /* A finger drags it up until it stops moving — on the panel where it
       came to rest, not where it was in the middle of sliding in. */
    const box = await stillBox(list)
    const at = () => list.evaluate((el) => el.scrollTop)
    for (let i = 0; i < 16; i++) {
      const before = await at()
      await swipeUp(page, { x: box.x + box.width / 2, y: box.y + box.height * 0.75 }, 500)
      await page.waitForTimeout(300)
      if ((await at()) === before) break
    }
    expect(await at()).toBeGreaterThan(0)
    // At its end, and the last note stands whole inside the glass.
    const end = await list.evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))
    expect(end).toBeLessThanOrEqual(1)
    const lastBox = (await last.boundingBox())!
    expect(lastBox.y).toBeGreaterThanOrEqual(box.y)
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y + box.height)
    // And the window itself never moved — only the list did.
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

/*
 * On an iPhone a board's column would not scroll from part of every
 * card. A card is `touch-action: none` to its last child and the board
 * performs both pans itself (`useDrag.ts`), but a finger landing on one of
 * the card's own controls — the face, the priority — was turned away before
 * the pan was set up, so neither the browser nor the board moved anything.
 * And a pan that ended without a throw outlived its finger and took the next
 * one, wherever it landed.
 *
 * Checked by hand in Safari on the iOS simulator; this is the same gesture
 * in the phone this suite runs, through the touches a finger sends.
 */
test.describe('a phone reading down a board', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('a column scrolls from anywhere on a card, its face included, and the face still opens', async ({ page }) => {
    await login(page)
    const ws = new URL(page.url()).pathname.split('/')[1]!
    const made = await page.evaluate(async (name) => {
      const s = JSON.parse(localStorage.getItem('session') ?? 'null') as { access_token: string }
      const ask = (path: string, body?: unknown) =>
        fetch(path, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { authorization: `Bearer ${s.access_token}`, 'x-api-version': '1', 'content-type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }).then((r) => r.json() as Promise<{ id: string; slug: string }>)
      const p = await ask('/api/projects', { name })
      for (let i = 0; i < 16; i++) await ask(`/api/projects/${p.id}/tasks`, { title: `Card ${i + 1}` })
      return p
    }, `Tall board ${Date.now()}`)
    await page.goto(`/${ws}/${made.slug}/tasks?view=board`)
    const column = page.locator('[data-column-scroll]').first()
    await expect(column.locator('[data-card]')).toHaveCount(16, { timeout: 15_000 })
    const top = () => column.evaluate((el) => el.scrollTop)
    const room = await column.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(room).toBeGreaterThan(400)

    const cdp = await page.context().newCDPSession(page)
    /* A finger's drag, as the touches it sends: down, twelve moves, a moment
       still so it is a drag and not a throw, up. */
    const drag = async (from: { x: number; y: number }, dx: number, dy: number) => {
      const at = (i: number) => [{ x: Math.round(from.x + (dx * i) / 12), y: Math.round(from.y + (dy * i) / 12) }]
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) })
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i) })
        await page.waitForTimeout(16)
      }
      await page.waitForTimeout(200)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(300)
    }
    const card = column.locator('[data-card]').nth(1)
    const middle = async (part: ReturnType<typeof card.locator>) => {
      const b = (await part.boundingBox())!
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    }
    const title = card.locator('[data-open-task]')
    const face = card.locator('[data-no-drag]').first()

    // From the title, the way it always worked.
    await drag(await middle(title), 0, -200)
    expect(await top()).toBeGreaterThan(150)
    await column.evaluate((el) => (el.scrollTop = 0))

    /* And that gesture is over once the finger is up. It ended standing
       still, so it threw nothing — and a pan that threw nothing used to
       outlive its finger and take the next one, wherever it landed: here
       the empty ground of the next column, which is the browser's to pan. */
    const board = page.locator('[data-board]')
    const ground = (await page.locator('[data-column-scroll]').nth(1).boundingBox())!
    await drag({ x: ground.x + 40, y: ground.y + 200 }, -150, 0)
    expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100)
    expect(await top()).toBe(0)
    await board.evaluate((el) => (el.scrollLeft = 0))

    // From the card's face, which moved nothing.
    await drag(await middle(face), 0, -200)
    expect(await top()).toBeGreaterThan(150)
    await column.evaluate((el) => (el.scrollTop = 0))

    // And sideways from it, the board.
    await drag(await middle(face), -150, 0)
    expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100)
    await board.evaluate((el) => (el.scrollLeft = 0))

    // A tap on the face is still a press on it.
    await expect(page.getByRole('menu')).toHaveCount(0)
    await face.tap()
    await expect(page.getByRole('menu')).toBeVisible()
  })
})
