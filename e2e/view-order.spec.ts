import { test, expect, type Page } from '@playwright/test'
import { add, drawnWhole, login, make, openProject, shownAs, viewAnswers } from './helpers.js'

/* An 80 × 40 PNG of one colour: twice as wide as it is tall, so its frame
   on a card is half the card's width high. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAATklEQVR4nO3PAQ3AIADAMEAO5hCMmbv4k71VsM197viT9XXA2wzXGa4zXGe4znCd4TrDdYbrDNcZrjNcZ7jOcJ3hOsN1husM1xmuM1z3AL/zAcRgtCDyAAAAAElFTkSuQmCC',
  'base64',
)
/* A 40 × 120 one: a phone's screenshot in miniature, taller than any frame. */
const TALL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACgAAAB4CAIAAAAPEifNAAAAUElEQVR42u3NQQkAAAgEsItmNKMZzRiCDPZfqudExGKxWCwWi8VisVgsFovFYrFYLBaLxWKxWCwWi8VisVgsFovFYrFYLBaLxWKxWCwWf4sXFwchpXjSRUEAAAAASUVORK5CYII=',
  'base64',
)

/** Where the screenshots for a report go, when somebody asks for them. */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` })
}

async function api(page: Page) {
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('session')!).access_token as string)
  return { authorization: `Bearer ${token}`, 'x-api-version': '1' }
}

/**
 * Images on cards.
 * Off until it is turned on; then the card's frame is the picture's own
 * shape from the first frame, and the card never changes height after.
 */
test('a card shows its task’s picture, at its final height from the first frame', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page)
  const stamp = Date.now()
  const name = `Pictures ${stamp}`
  await add(page, 'new-project', name)
  await openProject(page, name)
  await page.getByTestId('tool-tasks').click()
  await make(page, page.getByTestId('create-new-task'), `Pictured ${stamp}`, `Plain ${stamp}`, `Tall ${stamp}`)

  /* The picture goes into the description the way the editor puts it there:
     uploaded, then an attachment node with its measured size. */
  const h = await api(page)
  const where = await page.evaluate(
    async ([hh, wanted]) => {
      const projects = (await (await fetch('/api/projects', { headers: hh })).json()) as { projects: { id: string; name: string }[] }
      const p = projects.projects.find((x) => x.name === wanted)!
      const page = (await (await fetch(`/api/projects/${p.id}/tasks`, { headers: hh })).json()) as {
        tasks: { id: string; title: string }[]
      }
      return {
        project: p.id,
        task: page.tasks.find((t) => t.title.startsWith('Pictured'))!.id,
        tall: page.tasks.find((t) => t.title.startsWith('Tall'))!.id,
      }
    },
    [h, name] as const,
  )
  const up = (await (
    await page.request.post(`/api/projects/${where.project}/uploads`, {
      headers: h,
      multipart: { file: { name: 'cover.png', mimeType: 'image/png', buffer: PNG } },
    })
  ).json()) as { id: string }
  const said = await page.request.patch(`/api/tasks/${where.task}`, {
    headers: { ...h, 'content-type': 'application/json' },
    data: {
      body: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'The broken header' }] },
          { type: 'attachment', attrs: { fileId: up.id, name: 'cover.png', kind: 'image', pixelWidth: 80, pixelHeight: 40 } },
        ],
      },
    },
  })
  expect(said.ok()).toBe(true)
  const upTall = (await (
    await page.request.post(`/api/projects/${where.project}/uploads`, {
      headers: h,
      multipart: { file: { name: 'phone.png', mimeType: 'image/png', buffer: TALL } },
    })
  ).json()) as { id: string }
  const saidTall = await page.request.patch(`/api/tasks/${where.tall}`, {
    headers: { ...h, 'content-type': 'application/json' },
    data: {
      body: {
        type: 'doc',
        content: [{ type: 'attachment', attrs: { fileId: upTall.id, name: 'phone.png', kind: 'image', pixelWidth: 40, pixelHeight: 120 } }],
      },
    },
  })
  expect(saidTall.ok()).toBe(true)
  await page.reload()

  await shownAs(page, 'board')
  const card = page.locator('[data-card]').filter({ hasText: `Pictured ${stamp}` })
  await expect(card).toBeVisible({ timeout: 20_000 })
  // Off by default: no picture until somebody asks for one.
  await expect(page.locator('[data-card-picture]')).toHaveCount(0)

  // Under "Show on each card", on the board — and turned on there.
  await viewAnswers(page, true)
  const images = page.getByTestId('shows-pictures')
  await expect(images).toBeVisible()
  await shot(page, 'view-menu-images')
  /* Drawn whole: the card with its picture has one height from the frame it
     first appears in. */
  await page.evaluate(() => {
    const w = window as unknown as { cardHeights: number[] }
    w.cardHeights = []
    const look = () => {
      const el = document.querySelector('[data-card]:has([data-card-picture])')
      const hh = el ? Math.round(el.getBoundingClientRect().height) : 0
      if (hh > 0 && w.cardHeights[w.cardHeights.length - 1] !== hh) w.cardHeights.push(hh)
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  await images.click()
  const frame = card.locator('[data-card-picture]')
  await expect(frame).toBeVisible({ timeout: 10_000 })
  await expect(frame.locator('img')).toHaveJSProperty('complete', true, { timeout: 10_000 })
  expect(await frame.locator('img').evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => (window as unknown as { cardHeights: number[] }).cardHeights)).toHaveLength(1)
  // The picture's own shape: twice as wide as it is tall.
  const box = (await frame.boundingBox())!
  expect(Math.abs(box.height - box.width / 2)).toBeLessThanOrEqual(1)
  /* A picture taller than the frame: the frame keeps the card's whole width
     at 160, and the picture stands whole in its middle — not a narrow frame
     at the card's left. */
  const tallCard = page.locator('[data-card]').filter({ hasText: `Tall ${stamp}` })
  const tallFrame = (await tallCard.locator('[data-card-picture]').boundingBox())!
  const tallBox = (await tallCard.boundingBox())!
  expect(Math.abs(tallFrame.width - tallBox.width)).toBeLessThanOrEqual(2)
  expect(Math.round(tallFrame.height)).toBe(160)
  expect(await tallCard.locator('[data-card-picture] img').evaluate((i) => getComputedStyle(i).objectFit)).toBe('contain')
  // A task with no picture keeps its card as it was.
  await expect(
    page
      .locator('[data-card]')
      .filter({ hasText: `Plain ${stamp}` })
      .locator('[data-card-picture]'),
  ).toHaveCount(0)
  await viewAnswers(page, false)
  await shot(page, 'board-with-pictures')

  /*
   * And from the first paint of a fresh visit, with the picture's bytes held
   * back: the frame stands at its height before they arrive, so the card's
   * height is one number from the frame it is drawn in to after the bytes.
   */
  await page.addInitScript(() => {
    const w = window as unknown as { cardHeights: number[] }
    w.cardHeights = []
    const look = () => {
      const el = document.querySelector('[data-card]:has([data-card-picture])')
      const hh = el ? Math.round(el.getBoundingClientRect().height) : 0
      if (hh > 0 && w.cardHeights[w.cardHeights.length - 1] !== hh) w.cardHeights.push(hh)
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.route('**/api/blob/**', async (r) => {
    await new Promise((ok) => setTimeout(ok, 800))
    await r.continue().catch(() => {})
  })
  await page.reload()
  await expect(frame.locator('img')).toHaveJSProperty('complete', true, { timeout: 15_000 })
  expect(await frame.locator('img').evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => (window as unknown as { cardHeights: number[] }).cardHeights)).toHaveLength(1)
  await page.unroute('**/api/blob/**')
})

/**
 * Ordered by when it was made. Newest first on the
 * list and on the board, and Direction turns it round.
 */
test('tasks ordered by Created stand newest first, in the list and on the board', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page)
  const stamp = Date.now()
  const name = `Created ${stamp}`
  await add(page, 'new-project', name)
  await openProject(page, name)
  await page.getByTestId('tool-tasks').click()
  /* Made one after another, so each is newer than the last — and their
     titles are not in that order, so Title and Manual cannot pass for it. */
  await make(page, page.getByTestId('create-new-task'), `Bravo ${stamp}`, `Charlie ${stamp}`, `Alpha ${stamp}`)
  await expect(page.locator('[data-task]')).toHaveCount(3, { timeout: 15_000 })

  const newest = [`Alpha ${stamp}`, `Charlie ${stamp}`, `Bravo ${stamp}`]
  const rows = () => page.locator('[data-task] [data-open-task]').allTextContents()
  const cards = () => page.locator('[data-card] [data-open-task]').allTextContents()
  const mine = (all: string[]) => all.filter((t) => t.endsWith(String(stamp)))

  await viewAnswers(page, true)
  await page.getByTestId('view-sort').selectOption('created')
  await expect(page).toHaveURL(/sort=created/)
  await expect.poll(async () => mine(await rows())).toEqual(newest)
  await shot(page, 'list-ordered-by-created')

  // Direction turns it round: oldest first.
  await page.getByTestId('view-dir').locator('[data-pick="desc"]').click()
  await expect.poll(async () => mine(await rows())).toEqual([...newest].reverse())
  await page.getByTestId('view-dir').locator('[data-pick="asc"]').click()
  await viewAnswers(page, false)

  // The board takes the same order from the address, newest at the top.
  await shownAs(page, 'board')
  await expect(page.locator('[data-card]').first()).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => mine(await cards())).toEqual(newest)
  await shot(page, 'board-ordered-by-created')

  // And it survives a reload, because the address is where it is.
  await page.reload()
  await expect(page.locator('[data-card]').first()).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => mine(await cards())).toEqual(newest)
})

/**
 * The start of a description under the title.
 * Off until it is turned on, each view its own answer; on, a card says two
 * lines of it at most and a row one, a task with none takes no room, the
 * card is drawn whole, and this machine remembers.
 */
test('a card and a row say the start of the description, when asked', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page)
  const stamp = Date.now()
  const name = `Excerpts ${stamp}`
  await add(page, 'new-project', name)
  await openProject(page, name)
  await page.getByTestId('tool-tasks').click()
  await make(page, page.getByTestId('create-new-task'), `Described ${stamp}`, `Bare ${stamp}`)

  const said =
    'The logo overlaps the menu on a phone, and the header jumps by eight pixels when the search opens. ' +
    'Check it on the smallest iPhone and on an Android of the same width before calling it done.'
  const h = await api(page)
  const id = await page.evaluate(
    async ([hh, wanted]) => {
      const projects = (await (await fetch('/api/projects', { headers: hh })).json()) as { projects: { id: string; name: string }[] }
      const p = projects.projects.find((x) => x.name === wanted)!
      const page = (await (await fetch(`/api/projects/${p.id}/tasks`, { headers: hh })).json()) as {
        tasks: { id: string; title: string }[]
      }
      return page.tasks.find((t) => t.title.startsWith('Described'))!.id
    },
    [h, name] as const,
  )
  /* Split by a mark, as the editor writes bold into the middle of a line. */
  const patched = await page.request.patch(`/api/tasks/${id}`, {
    headers: { ...h, 'content-type': 'application/json' },
    data: {
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: said.slice(0, 40) },
              { type: 'text', text: said.slice(40), marks: [{ type: 'bold' }] },
            ],
          },
        ],
      },
    },
  })
  expect(patched.ok()).toBe(true)
  await page.reload()

  // The list, off by default.
  await shownAs(page, 'list')
  const row = page.locator('[data-task]').filter({ hasText: `Described ${stamp}` })
  const bareRow = page.locator('[data-task]').filter({ hasText: `Bare ${stamp}` })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-excerpt]')).toHaveCount(0)
  const bareHeight = (await bareRow.boundingBox())!.height

  await viewAnswers(page, true)
  const toggle = page.getByTestId('shows-excerpt')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const rowSays = row.locator('[data-excerpt]')
  await expect(rowSays).toHaveText(/^The logo overlaps the menu on a phone, and the header/)
  // One line on a row, cut with an ellipsis.
  const rowLine = await rowSays.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    line: Number.parseFloat(getComputedStyle(el).lineHeight),
    ellipsis: getComputedStyle(el).textOverflow,
  }))
  expect(rowLine.height).toBeLessThanOrEqual(rowLine.line + 1)
  expect(rowLine.ellipsis).toBe('ellipsis')
  // A task with no description takes no room.
  await expect(bareRow.locator('[data-excerpt]')).toHaveCount(0)
  expect((await bareRow.boundingBox())!.height).toBe(bareHeight)
  await shot(page, 'list-with-descriptions')
  await viewAnswers(page, false)

  // The board keeps its own answer: still off there.
  await shownAs(page, 'board')
  const card = page.locator('[data-card]').filter({ hasText: `Described ${stamp}` })
  const bareCard = page.locator('[data-card]').filter({ hasText: `Bare ${stamp}` })
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-excerpt]')).toHaveCount(0)
  const bareCardHeight = (await bareCard.boundingBox())!.height
  await viewAnswers(page, true)
  await expect(page.getByTestId('shows-excerpt')).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('shows-excerpt').click()
  const cardSays = card.locator('[data-excerpt]')
  await expect(cardSays).toHaveText(/^The logo overlaps the menu on a phone/)
  // Two lines at most on a card, and the rest cut.
  const cardLines = await cardSays.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    line: Number.parseFloat(getComputedStyle(el).lineHeight),
    cut: el.scrollHeight > el.clientHeight,
  }))
  expect(cardLines.height).toBeLessThanOrEqual(cardLines.line * 2 + 1)
  expect(cardLines.height).toBeGreaterThan(cardLines.line * 1.5)
  expect(cardLines.cut).toBe(true)
  await expect(bareCard.locator('[data-excerpt]')).toHaveCount(0)
  expect((await bareCard.boundingBox())!.height).toBe(bareCardHeight)
  await shot(page, 'board-with-descriptions')
  await viewAnswers(page, false)

  // Drawn whole: from the list to the board, the card is one height from its first frame.
  await shownAs(page, 'list')
  await expect(row.locator('[data-excerpt]')).toBeVisible()
  const heights = await drawnWhole(page, '[data-card]:has([data-excerpt])', () => shownAs(page, 'board'))
  expect(heights).toHaveLength(1)

  // And from the first paint of a fresh visit, remembered on this machine.
  await page.addInitScript(() => {
    const w = window as unknown as { excerptHeights: number[] }
    w.excerptHeights = []
    const look = () => {
      const el = document.querySelector('[data-card]:has([data-excerpt])')
      const hh = el ? Math.round(el.getBoundingClientRect().height) : 0
      if (hh > 0 && w.excerptHeights[w.excerptHeights.length - 1] !== hh) w.excerptHeights.push(hh)
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  await page.reload()
  await expect(card.locator('[data-excerpt]')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => (window as unknown as { excerptHeights: number[] }).excerptHeights)).toHaveLength(1)
  await shownAs(page, 'list')
  await expect(row.locator('[data-excerpt]')).toBeVisible({ timeout: 20_000 })

  // Turned off, it is gone at once.
  await viewAnswers(page, true)
  await page.getByTestId('shows-excerpt').click()
  await expect(page.locator('[data-excerpt]')).toHaveCount(0)
})
