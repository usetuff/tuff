import { useLayoutEffect, useRef, useState } from 'react'
import { api } from '../data/api.js'
import { remember } from '../data/memory.js'
import { writtenDay } from './kit.jsx'
import { asHours } from '../data/hours.js'
import { Icon } from './glyphs.jsx'
import { dayMonth } from '../data/words.js'
import { STATS as W } from '../words/stats.js'

/*
 * A person's numbers and weeks — on their page in Members, and on My tasks
 * for whoever is looking.
 */

/** What somebody is working on. */
export type Theirs = {
  id: string
  number: number
  title: string
  due_on: string | null
  overdue: boolean
  project_id: string
  project_name: string
  project_key: string
  icon: string | null
  color?: string | null
}

/** A person's page, read and kept — ahead, from the roster's rows. */
/** Minutes on a project, on one of its tasks or on none — thirty days. */
export type Spent = {
  project_id: string
  project_name: string
  task_id: string | null
  title: string | null
  number: number | null
  minutes: number
}

/** One day of somebody's doings — the feed's lines and their messages. */
export type Day = { day: string; n: number }

export type PersonRead = {
  projects: { id: string; name: string }[]
  open: Theirs[]
  weeks: Week[]
  hours: Spent[]
  days: Day[]
  email: string | null
  timezone: string | null
}
const reading = new Map<string, { at: number; read: Promise<PersonRead> }>()
export function readPerson(id: string, fresh = false): Promise<PersonRead> {
  /* Once per row per half minute: a pointer crossing the roster is not a
     request per name it passes. Opening the page asks again regardless —
     the read ahead draws it at once, and this puts what changed since in. */
  const hit = reading.get(id)
  if (!fresh && hit && Date.now() - hit.at < 30_000) return hit.read
  const read = readPersonNow(id)
  reading.set(id, { at: Date.now(), read })
  return read
}
/*
 * Read ahead before anybody points: the first names in the roster, one at
 * a time while nothing else is happening, so the first person opened —
 * on a phone, where nothing hovers, or by a click quicker than the answer
 * — opens whole instead of on an empty panel for a round trip. A few,
 * once each: a roster of a thousand is not a thousand requests.
 */
const warmed = new Set<string>()
const queue: string[] = []
let warming = false
export function warmPerson(id: string): void {
  if (warmed.has(id) || warmed.size >= 12) return
  warmed.add(id)
  queue.push(id)
  if (!warming) next()
}
function next(): void {
  const id = queue.shift()
  if (!id) {
    warming = false
    return
  }
  warming = true
  const go = () =>
    void readPerson(id)
      .catch(() => {})
      .finally(next)
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 2000 })
  else setTimeout(go, 200)
}
function readPersonNow(id: string): Promise<PersonRead> {
  return api<{
    projects: { id: string; name: string }[]
    open: Theirs[]
    weeks?: Week[]
    hours?: Spent[]
    days?: Day[]
    person?: { email?: string | null; timezone?: string | null }
  }>(`/people/${id}`).then((r) =>
    remember<PersonRead>(`person:${id}`, {
      projects: r.projects ?? [],
      open: r.open ?? [],
      weeks: r.weeks ?? [],
      hours: r.hours ?? [],
      days: r.days ?? [],
      email: r.person?.email ?? null,
      timezone: r.person?.timezone ?? null,
    }),
  )
}

/** A week of somebody's: what they finished and what they said. */
export type Week = { week: string; done: number; said: number }

/* Folded or not, kept on this device and one for both pages it is on:
   somebody who has folded it has said they read the work, not the charts. */
const SHUT = 'tuff:stats-shut'
const wasShut = () => {
  try {
    return localStorage.getItem(SHUT) === '1'
  } catch {
    return false
  }
}

/**
 * Four numbers and two weeks-long bars.
 *
 * The numbers are what a lead looks for first: what is open, what is late,
 * what was finished and how much was said lately. The bars say whether
 * that is a steady pace or a burst. One series each, so no legend: the
 * heading names it.
 */
export function Stats({ open, weeks, days = [] }: { open: Theirs[]; weeks: Week[]; days?: Day[] }) {
  const [shut, setShut] = useState(wasShut)
  const fold = () => {
    const next = !shut
    setShut(next)
    try {
      if (next) localStorage.setItem(SHUT, '1')
      else localStorage.removeItem(SHUT)
    } catch {
      /* Private window: folded until the page goes. */
    }
  }
  const recent = weeks.slice(-4)
  const late = open.filter((t) => t.overdue).length
  const finished = recent.reduce((n, w) => n + w.done, 0)
  const tiles: [string, number, string | undefined][] = [
    [W.open, open.length, undefined],
    [W.overdue, late, late ? 'var(--due)' : undefined],
    [W.finishedFourWeeks, finished, undefined],
  ]
  return (
    /* A block of its own, as a list is on the tasks screen: its heading and
       its cards on the list's ground (`--lane`), the cards on white — and
       the block stays, as a plate with its name, when it is folded. Under
       the pointer the heading darkens the block's own ground rather than
       lighting a box inside it (`theme.css`, `[data-fold-block]`). */
    <div
      className="mt-5 flex flex-col p-1"
      data-person-stats
      data-fold-block
      style={{ background: 'var(--lane)', borderRadius: 'var(--r-card)' }}
    >
      {/* Folded, the three numbers stay as a line beside the heading:
          folding is for the charts' height, not for what they count. */}
      {/* Lit under the pointer as a row of the column is, the whole width
          of it, open or folded — and no wider than the cards under it: a
          ground that stuck out past their edge read as out of line. */}
      <button
        data-testid="stats-fold"
        aria-expanded={!shut}
        onClick={fold}
        data-fold-head
        className="flex h-10 items-center gap-2 px-3 text-left text-base font-medium text-[var(--ink-2)] transition-colors mouse:hover:text-[var(--ink)]"
        style={{ letterSpacing: 'var(--track-body)' }}
      >
        <span className="flex size-4 items-center justify-center">
          <Icon
            name="chevR"
            size={14}
            tone="quiet"
            style={{ transform: shut ? undefined : 'rotate(90deg)', transition: 'transform 140ms var(--ease-out)' }}
          />
        </span>
        {W.stats}
        {shut && (
          <span className="font-normal tabular-nums transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none text-ink-3">
            {W.nOpen(open.length)}
            {late > 0 && (
              <>
                {' · '}
                <span className="text-due">{W.nOverdue(late)}</span>
              </>
            )}
            {W.nFinishedFourWeeks(finished)}
          </span>
        )}
      </button>
      {/*
       * It opens rather than appears, and closes the way it came: the
       * grid's row grows into the height of what is in it while that fades
       * in, 200 ms on the strong ease-out — the bar that takes a selection
       * does the same. Kept drawn while shut, so the close has something to
       * close; nothing in it is reachable then.
       */}
      <div
        data-stats-body
        aria-hidden={shut || undefined}
        {...(shut ? { inert: '' as unknown as boolean } : {})}
        className="grid motion-reduce:transition-none"
        style={{ gridTemplateRows: shut ? '0fr' : '1fr', transition: 'grid-template-rows 200ms var(--ease-out)' }}
      >
        <div
          className="flex min-h-0 flex-col gap-1 overflow-hidden motion-reduce:transition-none"
          style={{ opacity: shut ? 0 : 1, transition: 'opacity 200ms var(--ease-out)' }}
        >
          <div className="grid grid-cols-3 gap-1">
            {tiles.map(([label, n, tone]) => (
              <div
                key={label}
                className="flex flex-col gap-1 px-4 py-3"
                style={{ background: 'var(--card)', borderRadius: 'calc(var(--r-card) - 4px)' }}
              >
                <span className="text-title font-medium tabular-nums" style={{ color: tone ?? 'var(--ink)' }}>
                  {n}
                </span>
                <span className="text-sm text-ink-3">{label}</span>
              </div>
            ))}
          </div>
          {days.length > 0 && <Grid days={days} />}
          {weeks.length > 0 && <Bars title={W.finishedByWeek} weeks={weeks} pick={(w) => w.done} said="finished" />}
        </div>
      </div>
    </div>
  )
}

/** Twelve weeks as bars on a baseline, each answering its week under the pointer. */
function Bars({ title, weeks, pick, said }: { title: string; weeks: Week[]; pick: (w: Week) => number; said: string }) {
  const [on, setOn] = useState<number | null>(null)
  const top = Math.max(1, ...weeks.map(pick))
  const H = 96
  return (
    <figure
      className="flex flex-col gap-2 px-4 py-3"
      style={{ background: 'var(--card)', borderRadius: 'calc(var(--r-card) - 4px)' }}
      data-bars={said}
    >
      {/* One line, whatever is hovered: the readout grew the heading onto
          a second line and the chart jumped under the pointer. */}
      <figcaption className="flex h-5 items-baseline gap-2 text-sm whitespace-nowrap text-ink-2">
        <span className="min-w-px flex-1 truncate">{title}</span>
        <span className="shrink-0 tabular-nums text-ink-3">
          {on !== null ? `${pick(weeks[on]!)} · ${writtenDay(weeks[on]!.week)}` : W.inTwelveWeeks(weeks.reduce((n, w) => n + pick(w), 0))}
        </span>
      </figcaption>
      <div
        className="flex items-end gap-1"
        style={{ height: H }}
        onPointerLeave={() => setOn(null)}
        role="img"
        aria-label={W.chart(title, weeks.map((w) => `${writtenDay(w.week)} ${pick(w)}`).join(', '))}
      >
        {weeks.map((w, i) => {
          const n = pick(w)
          return (
            <div key={w.week} data-week={w.week} onPointerEnter={() => setOn(i)} className="flex h-full flex-1 items-end">
              <div
                className="w-full transition-opacity"
                style={{
                  height: n === 0 ? 2 : Math.max(4, Math.round((n / top) * H)),
                  background: n === 0 ? 'var(--line)' : 'var(--accent)',
                  borderRadius: '4px 4px 0 0',
                  opacity: on === null || on === i ? 1 : 0.5,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-ink-3">
        <span>{weeks[0] ? writtenDay(weeks[0].week) : ''}</span>
        <span>{W.thisWeek}</span>
      </div>
    </figure>
  )
}

/**
 * Where somebody's hours went these thirty days — by project, and by task
 * under each, the largest first.
 */
export function Hours({ hours, onOpen }: { hours: Spent[]; onOpen?: (projectId: string, taskId: string) => void }) {
  if (hours.length === 0) return null
  const projects = new Map<string, { name: string; minutes: number; rows: Spent[] }>()
  for (const h of hours) {
    const p = projects.get(h.project_id) ?? { name: h.project_name, minutes: 0, rows: [] }
    p.minutes += h.minutes
    p.rows.push(h)
    projects.set(h.project_id, p)
  }
  const all = [...projects.entries()].sort((a, b) => b[1].minutes - a[1].minutes)
  const top = Math.max(...all.map(([, p]) => p.minutes))
  return (
    <section className="mt-5 flex flex-col gap-2" data-person-hours>
      <div className="flex items-baseline px-1 text-sm text-ink-3">
        <span className="flex-1">{W.hoursThirtyDays}</span>
        <span className="tabular-nums">{asHours(hours.reduce((n, h) => n + h.minutes, 0))}</span>
      </div>
      <div className="flex flex-col gap-2">
        {all.map(([id, p]) => (
          <div key={id} className="flex flex-col px-4 py-3 bg-panel" style={{ borderRadius: 'var(--r-card)' }} data-hours-project={p.name}>
            <div className="flex items-center gap-3 text-base">
              <span className="min-w-px flex-1 truncate font-medium text-ink">{p.name}</span>
              <span className="shrink-0 tabular-nums text-ink-2">{asHours(p.minutes)}</span>
            </div>
            {/* The project's share of the month, as a bar under its name. */}
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((p.minutes / top) * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-col">
              {p.rows
                .sort((a, b) => b.minutes - a.minutes)
                .map((r) => (
                  <div key={r.task_id ?? 'none'} className="flex items-center gap-3 py-1 text-sm">
                    {r.task_id && onOpen ? (
                      <button
                        data-hours-task
                        onClick={() => onOpen(r.project_id, r.task_id!)}
                        className="min-w-px flex-1 truncate text-left text-ink"
                      >
                        {r.title ?? W.aTask}
                      </button>
                    ) : (
                      <span className="min-w-px flex-1 truncate" style={{ color: r.task_id ? 'var(--ink)' : 'var(--ink-3)' }}>
                        {r.task_id ? (r.title ?? W.aTask) : W.notOnATask}
                      </span>
                    )}
                    <span className="shrink-0 tabular-nums text-ink-3">{asHours(r.minutes)}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** A month's short name, the one `dayMonth` writes: `Sep`, `sept.`. */
const month = (on: string) => dayMonth(new Date(Number(on.slice(0, 4)), Number(on.slice(5, 7)) - 1, 1)).split(' ')[1]

/**
 * Half a year of somebody's days, a square each, darker the more they did —
 * the grid a code host draws. A week is a column, Monday at the top; the
 * days before the first Monday are left blank rather than shifted.
 */
export function Grid({ days }: { days: Day[] }) {
  const [on, setOn] = useState<Day | null>(null)
  /* Columns from Monday: pad the front so the first day sits on its row. */
  const first = new Date(`${days[0]!.day}T00:00:00`)
  const lead = (first.getDay() + 6) % 7
  const cells: (Day | null)[] = [...Array.from({ length: lead }, () => null), ...days]
  const all: (Day | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) all.push(cells.slice(i, i + 7))
  /*
   * As many whole weeks as the card holds at sixteen pixels a column, the
   * latest of them — so the grid fills its card at any width rather than
   * sitting in the left half of a wide one, and never scrolls or cuts a
   * week in two. Measured before it is painted. The squares and the gaps
   * stay as they are: squares that grew with the width made the grid's
   * height follow the column's, and gaps that grew moved every week
   * sideways when a scroll bar came and took fifteen pixels.
   */
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(26)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setFit(Math.max(1, Math.floor((el.clientWidth + 4) / 16)))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const weeks = all.slice(-fit)
  const shown = weeks.flat().filter((d): d is Day => d !== null)
  /* Four steps over nothing, by the busiest day — one hue, light to dark. */
  const top = Math.max(1, ...shown.map((d) => d.n))
  const step = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / top) * 4)))
  const SHADE = [
    'var(--line)',
    'color-mix(in oklch, var(--accent) 30%, var(--panel))',
    'color-mix(in oklch, var(--accent) 55%, var(--panel))',
    'color-mix(in oklch, var(--accent) 78%, var(--panel))',
    'var(--accent)',
  ]
  const total = shown.reduce((n, d) => n + d.n, 0)
  const active = shown.filter((d) => d.n > 0).length
  return (
    <figure
      className="flex flex-col gap-2 px-4 py-3"
      style={{ background: 'var(--card)', borderRadius: 'calc(var(--r-card) - 4px)' }}
      data-person-grid
    >
      <figcaption className="flex h-5 items-baseline gap-2 text-sm whitespace-nowrap text-ink-2">
        <span className="min-w-px flex-1 truncate">{W.activity}</span>
        <span className="shrink-0 tabular-nums text-ink-3">
          {on ? `${on.n} · ${writtenDay(on.day)}` : `${W.activeDays(active)} · ${W.actions(total)}`}
        </span>
      </figcaption>
      <div
        ref={box}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}
        onPointerLeave={() => setOn(null)}
        role="img"
        aria-label={W.activityOver(weeks.length, W.activeDays(active), W.actions(total))}
      >
        {weeks.map((w, i) => {
          const firstOfMonth = w.find((d) => d && d.day.endsWith('-01'))
          return (
            <div key={i} className="flex flex-col gap-1">
              {/* The month hangs off its column rather than widening it:
                  as the column's own width, "May" pushed every week after
                  it out of step. */}
              <span className="relative h-4">
                {firstOfMonth && (
                  <span className="absolute top-0 left-0 text-badge leading-4 whitespace-nowrap text-ink-3">{month(firstOfMonth.day)}</span>
                )}
              </span>
              {Array.from({ length: 7 }, (_, r) => {
                const d = w[r] ?? null
                return (
                  <span
                    key={r}
                    data-day={d?.day}
                    onPointerEnter={() => d && setOn(d)}
                    className="size-3 rounded-[4px]"
                    style={{
                      background: d ? SHADE[step(d.n)] : 'transparent',
                      outline: d && on?.day === d.day ? '1px solid var(--ink-2)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1 text-xs text-ink-3">
        <span className="mr-1">{W.less}</span>
        {SHADE.map((c, i) => (
          <span key={i} className="size-3 rounded-[4px]" style={{ background: c }} />
        ))}
        <span className="ml-1">{W.more}</span>
      </div>
    </figure>
  )
}
