import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

/*
 * Its own file, to run without the trace: taking its snapshots, Playwright
 * reads the page in a way that counts as a press, a moment after the page
 * loads — before the app, which arrives in a file of its own, has made the
 * sound — and a sound made after a press starts at once.
 */
test.use({ trace: 'off' })

/*
 * The sound is readied without costing the first press anything —
 * `docs/specs/chime.md`. Opening the audio device takes Chrome about 200 ms
 * on the main thread, and it was done inside the first press anywhere, so a
 * card lifted as the first act of the day stood still for a fifth of a
 * second. It is made while nothing is happening and the press only starts it.
 */
test('the first press readies the sound and costs nothing', async ({ page }) => {
  await login(page)
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    const made: { at: number; ms: number; ctx: AudioContext }[] = []
    const long: { at: number; ms: number }[] = []
    w.__made = made
    w.__long = long
    w.__press = 0
    const Real = window.AudioContext
    window.AudioContext = class extends Real {
      constructor(o?: AudioContextOptions) {
        const at = performance.now()
        super(o)
        made.push({ at, ms: performance.now() - at, ctx: this })
        console.debug('audio-context-made')
      }
    }
    new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push({ at: e.startTime, ms: e.duration }))).observe({
      type: 'longtask',
      buffered: true,
    })
    addEventListener('pointerdown', () => (w.__press ||= performance.now()), { capture: true })
  })
  /* Loaded again with nobody having touched this page: signing in was a press.
     And nothing read out of the page until the sound is made: `evaluate`
     counts as a press too. */
  const madeNow = page.waitForEvent('console', { predicate: (m) => m.text() === 'audio-context-made', timeout: 30_000 })
  await page.reload()
  await madeNow
  await expect(page.getByTestId('nav-my')).toBeVisible({ timeout: 30_000 })
  type Probe = { made: { at: number; ms: number; state: string }[]; long: { at: number; ms: number }[]; press: number }
  const probe = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __made: { at: number; ms: number; ctx: AudioContext }[]
        __long: { at: number; ms: number }[]
        __press: number
      }
      return {
        made: w.__made.map((m) => ({ at: m.at, ms: m.ms, state: m.ctx.state })),
        long: w.__long,
        press: w.__press,
      } as Probe
    })
  // Made while nothing was happening, and waiting for a press to start it.
  await expect.poll(async () => (await probe()).made.map((m) => m.state)).toEqual(['suspended'])
  await page.waitForTimeout(300)
  // A press on nothing in particular: the page's heading.
  const box = (await page.locator('main h1, main h2').first().boundingBox())!
  await page.mouse.click(box.x + 4, box.y + box.height / 2)
  await expect.poll(async () => (await probe()).made.map((m) => m.state)).toEqual(['running'])
  const p = await probe()
  expect(p.press).toBeGreaterThan(0)
  expect(p.made[0]!.at, 'made before the press, not in it').toBeLessThan(p.press)
  const inPress = p.long.filter((l) => l.at <= p.press + 300 && l.at + l.ms >= p.press - 5)
  expect(inPress, 'no long task around the first press').toEqual([])
})
