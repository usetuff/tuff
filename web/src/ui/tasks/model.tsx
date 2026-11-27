import { generateKeyBetween } from 'fractional-indexing'
import { dayMonth } from '../../data/words.js'
import { TASKS as W } from '../../words/tasks.js'
import { type Priority, type Label, PRIORITIES } from '../kit.jsx'
import type { Repeat } from '@tracker/shared-schema'

/* What a task looks like given to these people, before the server says so:
   the list, and the first of it, which the server works out. */
export const given = (to: string[]) => ({ assignee_ids: to, assignee_id: to[0] ?? null })

export type Task = {
  id: string
  /** What the address calls it in its project. */
  number: number
  title: string
  list_id: string | null
  /** Everybody it is given to, in order; empty for nobody yet.
      Read through `whoOf`. */
  assignee_ids?: string[]
  /** The first of them, as the server works it out. */
  assignee_id: string | null
  /** When it last changed — with its list, what says an agent is at it. */
  updated_at?: string | null
  due_on: string | null
  /** How urgent, or nothing. */
  priority: Priority | null
  /** The words on it. */
  labels?: Label[]
  starts_at: string | null
  ends_at: string | null
  sort_key: string
  completed_at: string | null
  decided_at: string
  /** When it was written, for the card's own footer. */
  created_at?: string
  /** Which stretch of dates it is in. */
  cycle_id?: string | null
  /** The task this one is a part of. */
  parent_id: string | null
  /** Its first picture, for a card. */
  picture?: TaskPicture
  /** The start of its description as plain words, or nothing. */
  excerpt?: string | null
  /** The handles of what it waits on that is still open.
      Empty or absent for nothing. */
  waiting_on?: string[]
  /** How it repeats, or nothing. */
  repeat?: Repeat | null
}

/** The copy for showing, signed for this reader, and its size or nothing. */
export type TaskPicture = { file_id: string; thumb_url: string; width?: number | null; height?: number | null }

/** A date the way somebody says it out loud, not the way it is stored:
    `5 Oct`, `5 oct.` in French. */
export function short(iso: string): string {
  /* A date or a timestamp: `due_on` is `2026-10-04` and `created_at` is the
     same with a time on the end, and the day segment of the second one is
     `04T08:30:…`, which `Number` reads as nothing. Taking the first ten
     characters makes the two one question. */
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  const thisYear = new Date().getFullYear()
  return `${dayMonth(new Date(y, m - 1, d))}${y === thisYear ? '' : ` ${String(y).slice(2)}`}`
}

/*
 * Two sort keys, in the order the keys were made for.
 *
 * Not `localeCompare`. A fractional key is a string compared by code unit —
 * that is the whole of how `generateKeyBetween` works — and a locale compare
 * sorts letters alphabetically with case as an afterthought, so it puts `Zz`
 * *after* `a0` where the key means before. Every key was `a0`, `a1`, `a2`
 * while things were only ever appended, and the two orders agreed. The day a
 * new task started going to the top of the pile the keys crossed the case
 * boundary, and the list disagreed with the database about which row was
 * first — while the drag, the board and the server all still agreed with
 * each other.
 */
/** Where a priority stands, with no answer standing after all of them. */
const rank = (p: Priority | null): number => (p ? PRIORITIES.indexOf(p) : PRIORITIES.length)

export function inKeyOrder(a: { sort_key: string }, b: { sort_key: string }): number {
  if (a.sort_key < b.sort_key) return -1
  return a.sort_key > b.sort_key ? 1 : 0
}

/**
 * The keys a run of cards will have once each has been moved after the one
 * before it — the first after `after`, or to the top when that is null.
 *
 * The server's own walk, one card at a time: a card's key is between its
 * anchor's and the lowest key above that anchor among the column's cards,
 * itself left out (`PATCH /tasks/:id` in `server/src/http/tasks.ts`). Each
 * key is written back before the next card is placed, as the requests are
 * sent one after another, so a card of the run still sitting in the column
 * is a neighbour until its own turn comes — exactly as it is on the server.
 *
 * Not `generateNKeysBetween` over the drop's two neighbours, though it would
 * sort the same: the server would answer with different keys, and a key
 * replaced by another one that sorts differently against its neighbours'
 * guesses is a card that moves after it has landed.
 *
 * Every row in the column rather than the cards the board shows, because
 * the server sees every row; parts are left out, as they are there. Stops,
 * with what it has, at an anchor it cannot find or neighbours the library
 * will not sit between — the answers put those right.
 */
/*
 * An action in the selection bar is its control and its word, as one thing
 * to press — `docs/specs/many-at-once.md`.
 *
 * The word sat beside the control and did nothing, so the target was the
 * twenty-pixel glyph and the word that named it was dead space a hand
 * reached for first. The whole chip lights under the pointer and a press
 * anywhere on it is a press on its control, so the menu opens from the
 * control as it always has.
 */
export const ACT = 'flex h-8 cursor-default items-center gap-2 rounded-[var(--r-row)] pr-3 pl-2 transition-colors hover:bg-[var(--hover)]'
export function pressInside(e: React.MouseEvent<HTMLElement>): void {
  /* Not a press that came out of the control's own menu or the sheet under
     it: those are drawn inside the chip, so their clicks rise through it,
     and taking them for a press on the chip pressed the control again — the
     menu shut on every tick, or opened again after a pick. */
  if ((e.target as Element).closest('[role="menu"], [data-over]')) return
  const control = e.currentTarget.querySelector('button')
  if (control && !control.contains(e.target as Node)) control.click()
}

export function chainKeys(rows: Task[], column: string, run: Task[], after: string | null): Map<string, string> {
  const keys = new Map<string, string>()
  for (const t of rows) if (!t.parent_id && t.list_id === column) keys.set(t.id, t.sort_key)
  const out = new Map<string, string>()
  let under: string | null = null
  if (after !== null) {
    const found = keys.get(after)
    if (found === undefined) return out
    under = found
  }
  for (const { id } of run) {
    let over: string | null = null
    for (const [other, k] of keys) {
      if (other === id || (under !== null && k <= under)) continue
      if (over === null || k < over) over = k
    }
    let key: string
    try {
      key = generateKeyBetween(under, over)
    } catch {
      return out
    }
    keys.set(id, key)
    out.set(id, key)
    under = key
  }
  return out
}

/**
 * The orders a list or a board can be put in.
 *
 * Out here rather than inside the list's memo, because the board sorts
 * its columns by the same answers: two copies of "by due date" is two
 * chances for a list and a board to disagree about what that means.
 */
const ORDERS: Record<string, (a: Task, b: Task) => number> = {
  // Undated work sits after dated work rather than being hidden by it.
  due: (a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'),
  recent: (a, b) => b.decided_at.localeCompare(a.decided_at),
  /* Newest first, and by id between two made in the same instant — ids
     are made in time order too, so the order is total and nothing a row
     has done to it moves it. */
  created: (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || (b.id < a.id ? -1 : b.id > a.id ? 1 : 0),
  /* Untriaged work after triaged work, never hidden by it — the same
     answer the dates give. */
  priority: (a, b) => rank(a.priority) - rank(b.priority),
  title: (a, b) => a.title.localeCompare(b.title),
  manual: inKeyOrder,
}

/** What each order is called, for the board to say while a card is held. */
export const SORT_SAID: Record<string, string> = {
  due: W.sortDue,
  recent: W.sortRecent,
  priority: W.sortPriority,
  title: W.sortTitle,
  cycle: W.sortCycle,
  created: W.sortCreated,
}

/** In the order asked for, and the other way up if that is what was asked. */
export function inOrder(rows: Task[], sort: string, dir: string): Task[] {
  const sorted = [...rows].sort(ORDERS[sort] ?? ORDERS.manual!)
  /* Reversed rather than given a second comparator each: "the other way"
     is one answer about an order, not five more orders. */
  return dir === 'desc' ? sorted.reverse() : sorted
}

/** The board's own column for what nobody has sorted yet. */
/*
 * There is no fixed set of columns any more.
 *
 * The board draws the project's lists, in their order — a list is where a
 * task is and the only place that says so.
 */
export type List = {
  id: string
  name: string
  progress: number | null
  finishes: boolean
  /** How far round the ring its work has gone. */
  icon: string
  /** What that mark is drawn in, or null for the one the mark works out. */
  color: string | null
  /** Drawn narrowed until somebody opens it — Canceled, in a new project. */
  narrow?: boolean
  /** The project's triage. */
  intake?: boolean
  /** The agent that takes its new tasks, and whether it has left the
      project. */
  agent_id?: string | null
  agent_gone?: boolean
}

/**
 * Who a task moved into this list is given to, said before the server
 * answers: the list's agent, for a task with nobody on it coming from
 * another list. The server decides; its
 * answer settles the row.
 */
export function takenBy(
  into: List | undefined,
  t: { list_id: string | null; assignee_ids?: string[]; parent_id?: string | null },
): Partial<Task> {
  if (!into?.agent_id || into.agent_gone || into.finishes) return {}
  if (t.list_id === into.id || t.parent_id || (t.assignee_ids ?? []).length > 0) return {}
  return given([into.agent_id])
}

export function days(since: string): number {
  return Math.floor((Date.now() - Date.parse(since)) / 86_400_000)
}
