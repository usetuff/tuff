import type { Repeat } from '@tracker/shared-schema'
import { repeatSaid } from '../words/repeat.js'
import { Stats, readPerson, type PersonRead } from './Stats.jsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../data/api.js'
import { Dot, EmptyState, Hairline, PageTitle, Panel, ProjectChip, Segments, useListKeys } from './kit.jsx'
import { Icon } from './glyphs.jsx'
import { near, seen, taskReady } from './TaskDetail.jsx'
import { recall, remember } from '../data/memory.js'
import { onHeard } from '../data/live.js'
import { numbered } from '../data/route.js'
import { PLACES, dayMonth } from '../data/words.js'
import { MY_TASKS as W } from '../words/myTasks.js'
import { REMIND } from '../words/remind.js'
import { today as todayHere } from '../data/calendar.js'

type Mine = {
  id: string
  /** What the address calls it in its project. */
  number: number
  title: string
  due_on: string | null
  /** The mark of the list it is in. */
  icon: string | null
  /** The list's colour, or null for the mark's own. */
  color?: string | null
  completed_at: string | null
  /** When **you** asked to be reminded of it. */
  reminder_at?: string | null
  /** How it repeats — the loop in place of the calendar, as on a project's
      row. */
  repeat?: Repeat | null
  project_id: string
  project_name: string
  /** What a sentence calls that project: `STU`, for `STU-41`. */
  project_key: string
}
/**
 * How a task is mine.
 *
 * One list with four sources rather than four screens: the row, the keys and
 * where a task opens are the same whichever way it came to be mine.
 */
export type MyTab = 'assigned' | 'created' | 'subscribed' | 'activity'
const TABS: { key: MyTab; label: string }[] = [
  { key: 'assigned', label: W.assigned },
  { key: 'created', label: W.created },
  { key: 'subscribed', label: W.subscribed },
  /* No "Activity": what you touched lately, under the name a project's
     feed has, read as that feed and was the tab nobody needed.
     An old link to it opens Assigned. */
]
/**
 * The tab an address asks for, if it is one that exists and one you may see.
 *
 * Anything else is the default rather than an error: a link to Activity sent
 * to somebody who cannot read the log should still open on their own work.
 */
export function myTab(asked: string | undefined, canActivity: boolean): MyTab {
  const known = TABS.find((t) => t.key === asked)?.key
  if (!known || (known === 'activity' && !canActivity)) return 'assigned'
  return known
}
const EMPTY: Record<MyTab, { title: string; body: string }> = {
  assigned: { title: W.noneAssigned, body: W.noneAssignedBody },
  created: { title: W.noneCreated, body: W.noneCreatedBody },
  subscribed: { title: W.noneSubscribed, body: W.noneSubscribedBody },
  activity: { title: W.noActivity, body: W.noActivityBody },
}

/** Whether the numbers over Assigned have anything in them yet. */
function somethingToCount(read: PersonRead): boolean {
  return read.open.length > 0 || read.weeks.some((w) => w.done > 0 || w.said > 0) || read.days.some((d) => d.n > 0)
}

/** `5 Oct` — `5 oct.` in French — and the year only when it is not this
    one. Shared with the person screen, which asks the same question about
    somebody else. */
export function short(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  /* The year in full when it is not this one. Two digits — `11 Feb 27` —
     read as the twenty-seventh of February. */
  return dayMonth(new Date(y, m - 1, d), y !== new Date().getFullYear())
}

/**
 * One tab's list from the server, kept for the next time it is drawn.
 */
const asking = new Map<MyTab, Promise<Mine[]>>()
function readTab(tab: MyTab): Promise<Mine[]> {
  /* A tab pressed while it is still being read ahead waits for that answer
     rather than asking twice. */
  const already = asking.get(tab)
  if (already) return already
  const p = readTabNow(tab).finally(() => asking.delete(tab))
  asking.set(tab, p)
  return p
}
async function readTabNow(tab: MyTab): Promise<Mine[]> {
  const { tasks } = await api<{ tasks: Mine[] }>(`/my/tasks?tab=${tab}`)
  // The address says the number.
  /* Each row says which project it is in, so the way back from a number
     to an id is recorded here too: opening one of these used to ask the
     server what number 3 was in a project whose list had just said. */
  numbered(tasks, undefined, 'task')
  /* And what the row says, for the screen that opens next: this one used
     to draw nothing until its own fetch landed. */
  for (const t of tasks) seen(t)
  return remember(`my:tasks:${tab}`, tasks)
}

/**
 * What is on me, across every project.
 *
 * The first question of the day, and it does not belong to a project — which
 * is why it is a screen rather than a filter somebody applies in each project
 * in turn and then forgets in one of them.
 *
 * It was half a screen for a while: a switch turned it into the overview —
 * what is late across the company, by five lenses — which is a different
 * question asked at a different time of day, on a screen whose name then
 * described one of its halves. It had no address either, so "what is
 * overdue" could not be sent to anybody, reloaded into, or left by pressing
 * back.
 *
 * `/api/overview` is still there and still tested; the screen it belongs to
 * is stage 6 in the design and will come back with a row and an address of
 * its own.
 */
export function MyTasks({
  tab,
  meId,
  canActivity,
  onTab,
  onOpen,
}: {
  tab: MyTab
  /** Whose numbers the head of Assigned shows. */
  meId: string
  /** The tab is built from the activity log, and asks what the log asks. */
  canActivity: boolean
  onTab: (tab: MyTab) => void
  /**
   * Open the task itself.
   *
   * It opened the project and left you on its list to find the row again —
   * a screen whose whole point is "what is on me" handing back "here is
   * where it lives". The task has an address of its own; this is it.
   */
  onOpen: (projectId: string, taskId: string) => void
}) {
  /* `null` until the first answer — see `Empty` in the kit. "Nothing is on
     you" is a good thing to read and a bad thing to read by mistake. */
  /* Your own numbers and weeks, the ones your page in Members shows —
     kept, so they are there with the list. */
  /* Kept under `my:stats` as well: `person:` is one thing's answer, which a
     start does not read back off the disk (`hydrate`, light), so the list
     came back at once from last time and the numbers over it waited for
     the server — the whole block held, then drawn late. */
  const [mineRead, setMineRead] = useState<PersonRead | null>(() => recall(`person:${meId}`) ?? recall(`my:stats:${meId}`))
  const [settled, setSettled] = useState(mineRead !== null)
  useEffect(() => {
    void readPerson(meId, true)
      .then((r) => setMineRead(remember(`my:stats:${meId}`, r)))
      .catch(() => {})
      .finally(() => setSettled(true))
  }, [meId])
  const key = `my:tasks:${tab}`
  const [mine, setMine] = useState<Mine[] | null>(() => recall(key))
  /* Each tab keeps its last answer, so switching back draws at once and then
     refreshes, rather than showing an empty list while it asks. */
  const load = useCallback(
    async (signal: { stale: boolean }) => {
      const tasks = await readTab(tab)
      // An answer for the tab you have already left is not this tab's answer.
      if (!signal.stale) setMine(tasks)
    },
    [tab],
  )
  useEffect(() => {
    setMine(recall(key))
    const signal = { stale: false }
    void load(signal)
    return () => {
      signal.stale = true
    }
  }, [key, load])
  /* And the other tabs read ahead as the screen opens, so pressing one draws
     its list whole. Asked only when pressed, a tab opened the first time on
     nothing — or on what it held last session — and its rows came in a
     moment later under the reader. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per visit to the screen, not on every tab change
  useEffect(() => {
    for (const t of TABS) if (t.key !== tab) void readTab(t.key).catch(() => {})
  }, [])

  /*
   * And again when something addressed to this person happens.
   *
   * This screen is the one place that crosses projects, so the per-project
   * socket cannot carry it: a task somebody puts on you in a project you are
   * not looking at arrived on the next reload. The shell holds the socket for
   * what is addressed to a person and says so.
   */
  useEffect(() => {
    let again: ReturnType<typeof setTimeout> | null = null
    /* A word about the inbox — a task put on you, a thread you follow —
       not every message said in every room, which read this list again
       for each of them. */
    const off = onHeard((kind) => {
      if (kind !== 'notification') return
      if (again) return
      again = setTimeout(() => {
        again = null
        void load({ stale: false }).catch(() => {})
        /* The tabs you are not on too: kept answers that the news has
           made wrong would be drawn the moment one is pressed. */
        for (const t of TABS) if (t.key !== tab) void readTab(t.key).catch(() => {})
      }, 1000)
    })
    return () => {
      if (again) clearTimeout(again)
      off()
    }
  }, [load, tab])

  /* Finishing a task is the most common thing done to one, so a list of what
     I touched keeps what I finished. The other three are about work still to
     do, and count the finished rather than list it. */
  const everything = tab === 'activity'
  const open = (mine ?? []).filter((t) => everything || !t.completed_at)
  const tabs = TABS
  const today = todayHere()
  /*
   * Opened when it can be drawn: the press waits for the task's read — up
   * to 400 ms, and usually not at all, since the pointer resting on the row
   * asked for it — with this list still on the screen. Navigated at once,
   * the task's screen drew nothing until that read landed, and on a slow
   * machine that was the whole window blank for four to seven frames.
   * The last press is the one that opens, and none once the
   * list has gone.
   */
  const going = useRef<string | null>(null)
  useEffect(
    () => () => {
      going.current = null
    },
    [],
  )
  const openTask = (t: Mine) => {
    if (going.current === t.id) return
    going.current = t.id
    void taskReady(t.id).then(() => {
      if (going.current !== t.id) return
      going.current = null
      onOpen(t.project_id, t.id)
    })
  }
  const { at, setAt } = useListKeys(open, openTask)
  /* Read ahead on the row the keys are on, as on the one under the pointer. */
  useEffect(() => {
    const t = at >= 0 ? open[at] : undefined
    if (t) near(t.id)
  }, [at, open])

  return (
    <div className="flex h-full flex-col">
      {/* One scroller for the whole screen, the title and the tabs going up
          with the list — the way Projects reads. Held still over a list of
          their own, they were a lid over the one long thing on the screen,
          and the list scrolled in a box under them. */}
      {/* The highlight goes out with the pointer — see the tasks list. */}
      {/*
        The width is capped inside the scroller, not on it, so the scrollbar
        stays at the window's edge.
      */}
      {/* The scrollbar's room kept on both sides whether or not a tab's
          list is long enough to need it, so going from a short tab to a
          long one does not slide the column sideways — on a mouse, where
          the bar takes room. */}
      <div
        data-reads-down
        data-steady
        data-foot
        className="min-h-0 flex-1 overflow-y-auto px-[var(--gutter)] pt-7 pb-6 max-sm:pt-3"
        onPointerLeave={() => setAt(-1)}
      >
        <div className="mx-auto w-full max-w-[800px]">
          {/* The same words the sidebar uses to get here. A door and the room
            behind it with different names on them is two places to somebody
            reading the screen, and the name of the person is not news to the
            person reading it. */}
          <PageTitle>{PLACES.myTasks}</PageTitle>
          {/* Scrolls sideways rather than running off a phone's edge. */}
          <div className="flex overflow-x-auto pt-5 [scrollbar-width:none] max-sm:pt-0">
            <Segments items={tabs} value={tab} onPick={onTab} />
          </div>
        </div>

        {/* Drawn with the numbers or not at all: the list arriving first
            and then pushed down by them is the screen moving under the
            reader. Remembered from the last time, it is at once. */}
        <div className="mx-auto max-w-[800px] pt-5" hidden={tab === 'assigned' && !settled}>
          {/* How your weeks have gone, over what is on you — on Assigned,
                the tab that is about you. Only when there is something to
                count: three zeros and an empty year read as a broken
                screen, not a fresh one. */}
          {tab === 'assigned' && mineRead && somethingToCount(mineRead) && (
            <div className="mb-5 [&>[data-person-stats]]:mt-0">
              <Stats open={mineRead.open} weeks={mineRead.weeks} days={mineRead.days ?? []} />
            </div>
          )}
          {mine && open.length === 0 && (
            <EmptyState art="inbox" title={EMPTY[tab].title}>
              {EMPTY[tab].body}
            </EmptyState>
          )}
          {/* The keyboard walks these, so the highlight follows its
                cursor when the pointer is somewhere else — `Fluid`. */}
          <Panel also="[data-lit]">
            {open.map((t, i) => (
              <div key={t.id} className="contents">
                {/* Not beside the lit row — the same rule the project's list
                  keeps, because it is the same list of tasks. */}
                {i > 0 && <Hairline away={at === i || at === i - 1} />}
                <div
                  data-mine
                  data-row
                  data-selected={i === at || undefined}
                  /* Marked, not painted: the panel's one highlight travels
                   between these the way it does in a project's list. The
                   cursor is still said, because the keyboard walks it. */
                  data-lit={i === at ? '' : undefined}
                  onPointerEnter={() => {
                    setAt(i)
                    /* Read ahead, the way a project's list does: the words
                     then arrive with the screen rather than after it. */
                    near(t.id)
                  }}
                  onPointerDown={() => near(t.id)}
                  /* The whole row opens it, the same as a project's list: a
                   row lit end to end that answers a press on one word of
                   it is a target inside a target. */
                  onClick={(e) => {
                    if ((e.target as Element).closest('button,a,input,select')) return
                    openTask(t)
                  }}
                  /* The row a project's list draws, to the pixel: its gap,
                   its padding and its height, so the two screens are the
                   same list seen from two places. A thirty-two pixel row
                   here against a forty-four pixel one there read as a
                   smaller product on the screen you open first. */
                  className="flex items-center gap-3 py-3 pr-4"
                  style={{ paddingLeft: 16 }}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <Dot icon={t.icon} color={t.color} />
                  </span>
                  <button
                    data-open-mine
                    onClick={() => openTask(t)}
                    className="flex min-w-px flex-1 flex-col text-left text-base text-ink"
                    style={{ letterSpacing: 'var(--track-body)' }}
                  >
                    <span className="flex min-w-px items-center gap-2">
                      <span className="truncate">{t.title}</span>
                      {/* A reminder of yours waits on it: a bell and no more,
                        since the time is in the task. */}
                      {t.reminder_at && Date.parse(t.reminder_at) > Date.now() && (
                        <span data-reminder title={REMIND.reminder} className="flex shrink-0 text-ink-3">
                          <Icon name="bell" size={12} />
                        </span>
                      )}
                    </span>
                    {/* A phone has no room for the columns, so the handle and
                      the project go under the title — the title was the
                      thing squeezed to nothing. */}
                    <span className="truncate text-xs sm:hidden text-ink-3">
                      {t.project_key}-{t.number} · {t.project_name}
                    </span>
                  </button>
                  {/*
                  The facts, in the columns a project's list puts them in.
                  
                  They were a caption under the title, on the grounds that a
                  column on the right cut the title to make room for a date
                  it had nothing to do with. What that cost is the thing
                  this screen is for: four projects' work read as one list,
                  and a list is read down its columns. The same two widths
                  as `Tasks` — the handle at 74 and the date at 86 — so the
                  two screens line up with each other, and the project after
                  them because here it is the one fact that is not on every
                  row of the same project.
                */}
                  <span data-id className="w-[74px] shrink-0 font-mono text-sm max-sm:hidden text-ink-3">
                    {t.project_key}-{t.number}
                  </span>
                  <span className="flex h-5 w-[86px] shrink-0 items-center justify-end max-sm:w-auto">
                    {t.due_on && (
                      <span
                        data-due={t.due_on}
                        {...(t.repeat ? { 'data-repeats': repeatSaid(t.repeat), title: repeatSaid(t.repeat) } : {})}
                        className="flex items-center gap-1 text-base tabular-nums"
                        style={{
                          // The only colour on the screen, and only for the one
                          // thing here that is wrong rather than merely true.
                          color: t.due_on <= today ? 'var(--due)' : 'var(--ink-3)',
                        }}
                      >
                        <Icon name={t.repeat ? 'repeat' : 'cal'} size={14} />
                        {short(t.due_on)}
                      </span>
                    )}
                  </span>
                  {/*
                   * Which project it is in, which is the whole point of this
                   * screen — the tasks on it come from everywhere.
                   *
                   * A fixed 150 lines the chips up down the list on a wide
                   * screen and runs off the right of a phone. Below 640 it
                   * takes what it needs and no more: the column is gone, and
                   * what is left is a chip at the end of the row.
                   */}
                  <span className="flex w-auto shrink-0 items-center overflow-hidden max-sm:hidden sm:w-[150px]">
                    <ProjectChip id={t.project_id} name={t.project_name} />
                  </span>
                </div>
              </div>
            ))}
          </Panel>
          {/* No "n finished" under the list: the numbers over it say what
                was finished, and a count with nothing to open was a line
                to read past. */}
        </div>
      </div>
    </div>
  )
}
