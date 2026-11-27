import { useState, useRef, useEffect } from 'react'
import { ACTS, FACTS, MORE, PLACES } from '../../data/words.js'
import { TASKS as W } from '../../words/tasks.js'
import {
  type Label,
  type Placed,
  usePhone,
  useWide,
  Choice,
  Toggle,
  Hairline,
  Popover,
  useShown,
  SLIDING,
  Avatar,
  Over,
  inWindow,
  Fluid,
  findField,
} from '../kit.jsx'
import { Icon } from '../glyphs.jsx'
import { Glass } from '../Glass.jsx'
import { daysAfter } from '../../data/calendar.js'

/* ------------------------------------------------------------- the view */

/** What a row can carry beside its title. */
/**
 * Whether a date is close enough to be worth a column on a phone.
 *
 * Overdue, or inside a week. Further off than that and it is a fact about
 * the task rather than something about today.
 */
export function soon(due: string | null, today: string): boolean {
  if (!due) return false
  return due <= daysAfter(today, 7)
}

/*
 * What a project with no tasks says.
 *
 * Beside the screen rather than in `words.ts`, which is where `MyTasks`
 * keeps its four — these are a paragraph about one screen rather than a
 * label reused across the product. The one cost is that they are not
 * translated, which is true of every empty state here and is its own
 * backlog line rather than something to fix in passing.
 */
export const EMPTY_TASKS = {
  title: W.noTasks,
  body: W.noTasksBody,
}

export type Shows = {
  id: boolean
  due: boolean
  who: boolean
  /** Which stretch of dates it is in. */
  cycle: boolean
  /** When it was written and when it last moved. */
  dates: boolean
  /** How long it has sat where it is — the `5d` on a card. */
  age: boolean
  priority: boolean
  labels: boolean
  /** The task's first picture at the head of its card — the board only. */
  pictures: boolean
  /** The start of its description, under the title. */
  excerpt: boolean
}
/* The handle is on by default: it is the row's name in a sentence, and a
   name nobody can see is one nobody learns to use. It can be turned off
   like the rest, because in a project where nobody says "STU-41" it is a
   column of noise. */
const SHOWS_DEFAULT: Shows = {
  id: true,
  /*
   * Off until somebody asks, like the cycle beside it.
   *
   * Most tasks have no due date, so the column was mostly blank and the
   * rows it did mark were not marked by it — a date is read off the row
   * when somebody is looking for one, and the rest of the time it is a
   * column of nothing between the title and the face.
   */
  due: false,
  who: true,
  /* Off until somebody asks: a project that does not use cycles should not
     grow a column of nothing. */
  cycle: false,
  /* Off, and only on the board at all. Two dates on forty cards is four
     lines of grey under titles somebody is scanning. */
  dates: false,
  /*
   * On, because how long a card has sat still is what a board is read
   * for — a column where nothing has moved in three weeks is the thing
   * worth noticing, and it is invisible without this.
   *
   * It can be turned off like the rest: on a board that moves every day
   * it is the same small number on every card.
   */
  age: true,
  /* On, because the column is also the way a priority is set from a list and
     a switch nobody finds is a feature nobody has. */
  priority: true,
  labels: true,
  /* Off until somebody asks, and on the board alone: a board of pictures
     is a board of fewer cards, and a row has no room for one. */
  pictures: false,
  /* Off until somebody asks: a line of grey under every title is a
     list half as long on the screen. */
  excerpt: false,
}
/**
 * And what a board starts with, which is not what a list starts with.
 *
 * The two were given one set of defaults because they show the same rows,
 * and they do not read the same way. A list is scanned down a column of
 * titles, where a mostly-empty date column is noise; a card is a small
 * block with room under the title, where a due date is one of the few
 * facts worth putting there. So the board turns `due` on.
 *
 * And it turns `age` off. It was on everywhere on the argument that a
 * column where nothing has moved in three weeks is what a board is read
 * for — true of a board somebody is auditing, and not of the one they
 * work in, where it is the same small number on every card. It is one
 * switch away for the week when that is the question.
 *
 * Everything else is the list's answer: the handle, the assignee, the
 * priority and the labels on; the cycle and the two service dates off.
 */
const SHOWS_BOARD: Shows = { ...SHOWS_DEFAULT, due: true, age: false }

const SHOWS_KEY = 'tasks-shows'
export const showsKey = (view: 'list' | 'board') => `${SHOWS_KEY}:${view}`
export const PANEL_KEY = 'tasks-view-open'
export const FOLDS_KEY = 'tasks-folds'
export const SHUT_KEY = 'board-shut'
export const OPEN_KEY = 'board-open'

/**
 * Which columns somebody has narrowed, per project.
 *
 * A board of seven lists is seven columns competing for the width, and most
 * of the time two of them are the work and the rest are where things came
 * from or went. Narrowed, a column keeps its name and its count and gives
 * the room to the ones being read — the answer to "how many are in Done"
 * without Done taking a seventh of the screen.
 *
 * On this machine and per project, beside the bands and the panel: which
 * columns somebody is not looking at today is not a thing a team has one
 * answer to, and a link somebody sends should not arrive narrowed.
 */
export function readShut(key: string = SHUT_KEY): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return new Set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/**
 * Shut until somebody opens it, and then as they left it.
 *
 * It opened by default, on the argument that answers nobody can see are no
 * use. On a first project that is a column of sorting and grouping beside
 * two tasks, standing in front of the work before there is any to sort —
 * we asked for it gone. Linear and Asana keep their
 * display options behind a button too.
 */
export function readPanel(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === '1'
  } catch {
    return false
  }
}

/** Which bands somebody has shut. Nothing, until they shut one. */
export function readFolds(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(FOLDS_KEY) ?? '[]') as unknown
    return new Set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    // Private window, blocked storage: everything open is a fine answer.
    return new Set()
  }
}

/**
 * Which fields are drawn, per view.
 *
 * A row and a card are not the same object at two sizes. A row is a strip
 * of columns that line up down a list, and a card is a block somebody
 * scans and drags; what is worth a column on one is four lines of grey on
 * the other — which is why Dates is offered on the board alone. One stored
 * answer meant turning a column on in the list and finding it on every
 * card, and turning it back off where it was wanted.
 *
 * The grouping and the ordering stay shared, because those are in the
 * address and a board and a list are two views of one set of rows. This is
 * not: it is kept on this machine, like how wide somebody's sidebar is.
 */
export function readShows(view: 'list' | 'board'): Shows {
  const base = view === 'board' ? SHOWS_BOARD : SHOWS_DEFAULT
  try {
    const saved = JSON.parse(localStorage.getItem(showsKey(view)) ?? 'null') as Partial<Shows> | null
    if (saved) return { ...base, ...saved }
    /* What the one shared answer was, for somebody who had set it before
       the two were told apart. Read once and written back under both
       names by the first change to either. */
    const old = JSON.parse(localStorage.getItem(SHOWS_KEY) ?? '{}') as Partial<Shows>
    return { ...base, ...old }
  } catch {
    // Private window, blocked storage: the default is a fine answer.
    return base
  }
}

/**
 * How the list is being looked at, in one place.
 *
 * It was four controls along the top of the work — a segmented switch, a
 * sort popup, a row of list chips and a count — on a screen the design wants
 * dense.
 *
 * The button says what is on, so a list that is filtered says so without
 * being opened: somebody who left it on "mine" yesterday and cannot find a
 * task today is looking at a product that lied to them quietly.
 */
/**
 * The same menu on both views, carrying only what means something on each.
 *
 * A board is already grouped — its columns are the grouping — and its cards
 * are put where somebody put them, so grouping, ordering and direction have
 * no answer there. Offering them anyway is the fault the project's handbook names about
 * `?view=`: a control that means nothing where it lands is a control that
 * comes back when somebody presses back. So the board is shown the four
 * questions it can answer, and the list keeps all seven.
 *
 * The hidden three are not reset on the way in. They belong to the tasks tab
 * and are waiting in the address for the list, which is where switching to
 * the board and back should leave them.
 */
type ViewProps = {
  /** Which drawing is on the screen. The people view is the board with
      assignees for columns, so it is offered what the board is. */
  on: 'list' | 'board' | 'people'
  group: string
  sort: string
  dir: string
  who: string
  /** Which labels narrow it, by id, comma-separated; empty is any. */
  labels: string
  /** The project's people, for "whose" beyond mine. */
  people: { actor_id: string; name: string; avatar_url?: string | null | undefined }[]
  /** Whose "mine" is. */
  meId?: string | undefined
  /** The project's labels, to narrow by. */
  allLabels: Label[]
  /** The lists this project has, for narrowing to one of them. */
  lists: Placed[]
  /** Which one is on, or null for every one of them. */
  list: string | null
  shows: Shows
  onShows: (s: Shows) => void
  onPick: (to: Record<string, string | null>) => void
}

/**
 * The answers themselves, drawn once for the two places they are shown.
 *
 * Beside the list on a wide screen and in the menu everywhere else — two
 * surfaces for one set of questions, so there is one body and neither can
 * offer a control the other has lost.
 */
function ViewAnswers({ on, group, sort, dir, who, labels, people, meId, allLabels, lists, list, shows, onShows, onPick }: ViewProps) {
  const picked = new Set(labels ? labels.split(',').filter(Boolean) : [])
  const arranging = on === 'list'
  /*
   * A phone's list draws the tick, the title and the face, so that is
   * what it offers. Every other switch under "What a row shows" would
   * turn nothing on or off there, which is the fault the Dates switch
   * had — a control that means nothing where it lands. The board keeps
   * them all, because a card draws them at any width.
   */
  const phone = usePhone()
  /* The board's columns can be its members on a desk only. */
  const desk = useWide()
  const byMembers = group === 'who'
  const bare = phone && arranging
  /*
   * Reset is only there when there is something to undo.
   *
   * A button that puts things back is an answer to a question somebody
   * has asked, and on a panel nobody has touched it answers nothing — it
   * sits at the foot of eight controls all already saying what they say,
   * offering to change none of them. Worse, it reads as a thing that
   * might do something, so it has to be considered and dismissed every
   * time the panel is opened.
   *
   * The same comparison the dot on the button makes, against the
   * defaults of this surface rather than the list's.
   */
  const base = arranging ? SHOWS_DEFAULT : SHOWS_BOARD
  const untouched =
    who === 'all' &&
    !labels &&
    (arranging || !byMembers) &&
    (Object.keys(base) as (keyof Shows)[]).every((k) => shows[k] === base[k]) &&
    (!arranging || (list === null && group === 'list' && sort === 'manual' && dir === 'asc'))
  return (
    <>
      {arranging && lists.length > 0 && (
        /*
         * Which list, where the rest of "what am I looking at" lives.
         *
         * It was a row of pills across the top — Everything, Backlog, Todo,
         * In Progress, Done — which put one answer about the view on the
         * bar and the other five in here. A project with six lists made
         * that row the widest thing on the screen, and it still said the
         * same kind of thing as Grouping and Whose.
         */
        <Choice
          said={ACTS.list}
          testId="view-which-list"
          value={list ?? 'all'}
          onPick={(v) => onPick({ list: v === 'all' ? null : v })}
          options={[{ id: 'all', label: W.allLists }, ...lists.map((l) => ({ id: l.id, label: l.name }))]}
        />
      )}
      {arranging && (
        <>
          <Choice
            said={W.grouping}
            testId="view-group"
            value={group}
            onPick={(v) => onPick({ group: v })}
            options={[
              { id: 'list', label: ACTS.list },
              { id: 'who', label: FACTS.assignee },
              { id: 'priority', label: FACTS.priority },
              { id: 'label', label: W.label },
              { id: 'due', label: W.dueDate },
              { id: 'cycle', label: FACTS.cycle },
            ]}
          />
          {/*
        A sprint is not made from here.
        
        It was: grouping by cycle is the moment somebody wants another one,
        and the argument was that sending them to settings and back is a
        trip through two screens to type a name. That is true and it was
        not worth the form. This panel answers one kind of question — how
        am I looking at this list — and a name with two dates in the middle
        of it is a different kind of thing wearing the same clothes, under
        a heading that says Cycle and means "group by".
        
        A project has a handful of cycles and makes them four times a year.
        The place for that is the project's settings, beside its lists,
        where the other things a project *has* are made.
      */}
          <Choice
            said={W.ordering}
            testId="view-sort"
            value={sort}
            onPick={(v) => onPick({ sort: v })}
            options={[
              { id: 'manual', label: W.manual },
              { id: 'priority', label: FACTS.priority },
              { id: 'title', label: W.title },
              { id: 'due', label: W.dueDate },
              { id: 'cycle', label: FACTS.cycle },
              { id: 'recent', label: W.lastUpdated },
              { id: 'created', label: W.createdOrder },
            ]}
          />
          <Choice
            said={W.direction}
            testId="view-dir"
            value={dir}
            onPick={(v) => onPick({ dir: v })}
            options={[
              { id: 'asc', label: W.firstToLast },
              { id: 'desc', label: W.lastToFirst },
            ]}
          />
        </>
      )}
      {/*
        The board gets them too, and gives up its drag while one is on.
        
        It used to be refused here, on the argument that a card is where
        somebody put it and an order that overrides the hand makes the
        drag lie — you let a card go and it leaves. That is true and it
        is an argument against *both at once*, not against the ordering.
        
        So: pick an order and the cards answer to it, and dragging within
        a column goes quiet while it is on, because the gap under the
        pointer is no longer the gap the card lands in. `Order` puts the
        drag back. Moving a card to another column still works either
        way — that is changing which list it is in, not where it sits in
        one.
      */}
      {!arranging && (
        <>
          {/*
            What the columns are, first, because it is the question the rest
            of a board's answers sit inside: the lists, or the members. The
            same answer as the list's grouping — `?group=who` is the list
            grouped by assignee and the board with a column per member — so
            going between them keeps it.
          */}
          {desk && (
            <Choice
              said={W.columns}
              testId="view-columns"
              value={byMembers ? 'who' : 'list'}
              onPick={(v) => onPick({ group: v })}
              options={[
                { id: 'list', label: W.columnsLists, testId: 'view-columns-list' },
                { id: 'who', label: W.columnsMembers, testId: 'view-columns-members' },
              ]}
            />
          )}
          <Choice
            said={W.ordering}
            testId="view-sort"
            value={sort}
            onPick={(v) => onPick({ sort: v })}
            options={[
              { id: 'manual', label: W.manual },
              { id: 'priority', label: FACTS.priority },
              { id: 'title', label: W.title },
              { id: 'due', label: W.dueDate },
              { id: 'cycle', label: FACTS.cycle },
              { id: 'recent', label: W.lastUpdated },
              { id: 'created', label: W.createdOrder },
            ]}
          />
          <Choice
            said={W.direction}
            testId="view-dir"
            value={dir}
            onPick={(v) => onPick({ dir: v })}
            options={[
              { id: 'asc', label: W.firstToLast },
              { id: 'desc', label: W.lastToFirst },
            ]}
          />
        </>
      )}
      {/* Whose, by name. It was everyone or mine,
          which narrows a list to one person only if that person is you. */}
      <WhoFilter value={who} people={people} meId={meId} onPick={(v) => onPick({ who: v })} />
      {allLabels.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pt-3 pb-1">
          <span className="text-base text-ink-2">{FACTS.labels}</span>
          {/* Any of those picked; none picked is every task. */}
          <div className="flex flex-wrap gap-2" data-testid="view-labels">
            {allLabels.map((l) => {
              const on = picked.has(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  data-view-label={l.name}
                  onClick={() => {
                    const next = new Set(picked)
                    if (on) next.delete(l.id)
                    else next.add(l.id)
                    onPick({ labels: [...next].join(',') })
                  }}
                  className="flex h-7 items-center gap-2 rounded-full px-3 text-sm font-medium"
                  style={{
                    background: on ? 'var(--track-on)' : 'transparent',
                    boxShadow: on ? 'var(--control-shadow)' : 'inset 0 0 0 1px var(--line)',
                    color: on ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  <span className="size-2 rounded-full" style={{ background: l.color ?? 'var(--ink-3)' }} />
                  {l.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="px-4 pt-3 pb-1 text-base text-ink-3">
        {/* On this machine, not in the address: which columns somebody
            likes is not a thing a team has an answer to, and a link
            should not rearrange the rows of whoever opens it. */}
        {arranging ? W.showOnRow : W.showOnCard}
      </div>
      {/* Two by two, across the width like the answers above. Three fitted
          on one line and four do not — "Due date" folds in half at a
          quarter of 280 pixels — and a row of switches at their own sizes
          leaves a ragged second line under a column of controls that all
          end in the same place. */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 pb-3">
        {(
          [
            ...((bare ? [] : [['priority', FACTS.priority]]) as ['priority', string][]),
            ...((bare ? [] : [['labels', FACTS.labels]]) as ['labels', string][]),
            ...((bare ? [] : [['id', W.number]]) as ['id', string][]),
            ...((bare ? [] : [['due', W.dueDate]]) as ['due', string][]),
            /* Not on the board of members: its columns are the assignees,
               and a card there shows whoever else has it whatever this
               says — the one thing the column cannot. A switch that
               turns nothing off is a control that means nothing where it
               lands. */
            ...((!arranging && desk && byMembers ? [] : [['who', FACTS.assignee]]) as ['who', string][]),
            ...((bare ? [] : [['cycle', FACTS.cycle]]) as ['cycle', string][]),
            /*
             * When it was made and when it last moved — on the board only,
             * because that is the only place it has ever drawn.
             *
             * A row has no line for it: the switch sat under "What a row
             * shows" and turned nothing on or off, which is a control that
             * means nothing where it lands — the fault the project's handbook names
             * about `?view=`, in a panel instead of an address. A person
             * pressing it on a list learns the panel lies.
             */
            ...(arranging ? [] : [['dates', W.dates] as const]),
            /* Board-only, like Dates: a row has no line for how long a
               task has sat in its list, and a switch that turns nothing
               on or off is a control that means nothing where it lands. */
            ...(arranging ? [] : [['age', W.ageSwitch] as const]),
            /* Board-only for the same reason: a row has no room for a
               picture. */
            ...(arranging ? [] : [['pictures', W.images] as const]),
            /* On both: a card has room under its title for two lines of
               it, and a row for one. */
            ['excerpt', W.description] as const,
          ] as const
        ).map(([key, said]) => (
          <Toggle key={key} testId={`shows-${key}`} on={shows[key]} onChange={(on) => onShows({ ...shows, [key]: on })} wide>
            {said}
          </Toggle>
        ))}
      </div>
      {/*
        The one line in the panel, and it is here rather than between the
        questions.

        There were three: after Direction, after Whose, and this. The first
        two were drawing boundaries that the headings already draw — every
        question in this panel arrives under its own word in `--ink-3`, with
        space above it, so a rule between two of them says a second time
        what the heading said, and a column of controls separated into
        sections reads as more parts than it has.

        This one is not that. Below it is a button that does something, not
        another thing to answer, and the gap between asking and acting is
        the one boundary in the panel worth drawing.
      */}
      {/* And the line goes with it: a rule drawn between the questions and
          nothing is a boundary around an absence. */}
      {!untouched && <Hairline inset={14} />}
      {!untouched && (
        <button
          data-testid="view-reset"
          onClick={() => {
            /* Only what this surface offered. Reset on the board putting
             the list's grouping back is a button undoing something the
             person cannot see. */
            onPick(
              arranging
                ? { list: null, group: 'list', sort: 'manual', dir: 'asc', who: 'all', labels: '' }
                : /* The members back to lists, and only that: a grouping the
                     board does not draw belongs to the list and stays. */
                  { who: 'all', labels: '', ...(byMembers ? { group: 'list' } : {}) },
            )
            /* The defaults of the surface being reset, not the list's: a
             board put back to the list's answer would lose its due date
             and grow an age nobody asked for. */
            onShows(arranging ? SHOWS_DEFAULT : SHOWS_BOARD)
          }}
          className="w-full px-4 py-3 text-left text-base text-ink-2"
        >
          {MORE.reset}
        </button>
      )}
    </>
  )
}

/**
 * The button the answers live behind, and what it does at each width.
 *
 * Given `open` and `onOpen` it is a switch: the panel stands beside the work
 * or it does not, and the board can have it too because it is only taking
 * the width while somebody is using it. Without them it is a menu, which is
 * what a narrow screen gets — there is no room beside anything there.
 *
 * One button either way, and the same mark on it: a dot when an answer is
 * off its default, so "something is narrowing this list" can be read without
 * opening anything.
 *
 * It stands at the right end of the row the list chips are on, rather than
 * up on the project's own bar. That bar is what this project is and what can
 * be made in it; this row is what is being looked at, and both halves of
 * that question belong on it — which of the lists on the left, and how it is
 * drawn on the right.
 *
 * The same material as the switch beside it, at the same height, because a
 * row with two controls in two materials reads as an oversight.
 * Round rather than another pill, so it is not read
 * as one more list.
 */
export function View(
  props: ViewProps & {
    className?: string
    open?: boolean
    onOpen?: (open: boolean) => void
  },
) {
  const { on, group, sort, dir, who, list, shows, className, open, onOpen } = props
  const arranging = on === 'list'
  /*
   * Every answer this surface offered, not four of the five.
   *
   * The List filter was left out, so narrowing to one list — the answer
   * that takes the most rows off the screen — was the one change the mark
   * did not report. A dot that says "something is narrowing this" while
   * four fifths of a project is hidden is worse than no dot: it is read as
   * "nothing is", which is the thing somebody checks it for.
   *
   * `arranging` guards the four it shares with Reset, because the board is
   * not offered them and a mark for an answer somebody cannot see is the
   * same fault from the other side.
   *
   * And the columns, which the panel asks about under its own heading and
   * Reset puts back with the rest. They were the one group of answers the
   * mark did not watch, so turning four of them off left a clean button
   * over a list drawn quite differently from the one anybody else opens.
   * Per view, because the two keep their own answers now.
   */
  /* Against this surface's own defaults. Compared with the list's, a
     board showing exactly what a board starts with would wear the mark
     from the first time it was opened. */
  const drawnFrom = arranging ? SHOWS_DEFAULT : SHOWS_BOARD
  const drawnPlain = (Object.keys(drawnFrom) as (keyof Shows)[]).every((k) => shows[k] === drawnFrom[k])
  /* Members for columns is off the board's default, where it can be chosen. */
  const desk = useWide()
  const plain =
    who === 'all' &&
    !props.labels &&
    drawnPlain &&
    (arranging || !desk || group !== 'who') &&
    (!arranging || (list === null && group === 'list' && sort === 'manual' && dir === 'asc'))

  /*
   * Faders, not a list.
   *
   * The glyph was the picture of the thing being looked at rather than of
   * the looking, and beside a switch that draws the same rows as a board it
   * was simply the wrong picture. The word went with it: a round button in
   * a corner is read by its shape and its place, and "View" beside two
   * faders was the icon said twice.
   */
  const face = (
    /* The mark goes on the round thing, not on the button around it: the
       wash inherits its corners from whatever wears it, and the button is a
       square box with a circle drawn inside. */
    <span
      data-control
      className="relative flex size-9 items-center justify-center rounded-full"
      style={{
        background: open ? 'var(--track-on)' : 'var(--track)',
        boxShadow: open ? 'var(--control-shadow)' : undefined,
        color: open ? 'var(--ink)' : 'var(--ink-2)',
      }}
    >
      <Icon name="sliders" size={16} />
      {/* A mark, not a word: the button has to say "something is on" without
          growing every time another answer is chosen. */}
      {!plain && (
        <span
          data-view-changed
          aria-hidden
          /* On the rim rather than inside it, which is where a count or a
             state sits on a round control everywhere else. Inside, it had
             the glyph's own strokes behind it and read as part of the
             drawing. */
          className="absolute top-0.5 right-0.5 size-2 rounded-full bg-accent"
          style={{
            /* A ring in the colour behind the button, so the dot is held
               off whatever it overlaps — the circle's edge here, and the
               page where it hangs past it. Drawn as a shadow rather than a
               border: a border would make the dot bigger, and this one is
               two pixels of meaning. */
            boxShadow: '0 0 0 2px var(--canvas)',
          }}
        />
      )}
    </span>
  )

  if (onOpen) {
    return (
      <button
        type="button"
        data-testid="view-menu"
        aria-label={ACTS.view}
        title={ACTS.view}
        aria-pressed={open}
        onClick={() => onOpen(!open)}
        className={`flex shrink-0 ${className ?? ''}`}
      >
        {face}
      </button>
    )
  }

  return (
    <span className={className}>
      <Popover testId="view-menu" said={ACTS.view} width={300} align="right" shape="bare" label={face}>
        {() => <ViewAnswers {...props} />}
      </Popover>
    </span>
  )
}

/**
 * The same answers, standing beside the list rather than hidden behind a
 * button.
 *
 * On a wide screen there is room to the right of the work that nothing was
 * using, and a menu has to be opened before it can say what is on. Here it
 * is read at a glance. The board keeps the menu: its columns want the width.
 * A narrow screen keeps it too, because there is no room beside anything.
 */
export function ViewPanel({ open, ...props }: ViewProps & { open: boolean }) {
  const { there, shown, ref } = useShown(open, SLIDING)
  if (!there) return null
  return (
    <div
      ref={ref}
      data-testid="view-panel"
      /*
       * The room and the panel are one movement, because they are one
       * property.
       *
       * This has been three arrangements. The panel faded where it stood and
       * the list jumped three hundred pixels afterwards — two events, and the
       * one you could see was the smaller one. Then it slid its own width
       * while the list took or gave back the room in a single frame — one
       * movement and one jump, at the same moment, which is the jerk you can
       * see when they are almost but not quite the same thing.
       *
       * What animates now is this box's width, and the list beside it is
       * flexible, so its width is the same number arrived at from the other
       * end. Not two things synchronised — one thing, which is the only kind
       * of synchronised that cannot drift. The panel inside keeps its 280
       * pixels and is clipped, so its edge travels with the opening and it
       * reads as sliding in from the right.
       *
       * It costs a layout of the list on every frame, which is the thing
       * this was written three ways to avoid. Measured on a full page of
       * tasks it is around a millisecond — the list is one flex column of
       * rows with no width-dependent wrapping in it, and it never holds more
       * than the two hundred a page brings.
       */
      /* The panel used to be as tall as its own contents, so on a short screen
         its foot — Reset — hung below the window with no way to reach it. It
         is bounded now and the box inside scrolls.

         Bounded by the window rather than by the flex line it sits on: the
         line is as tall as the list beside it, and a panel whose height
         follows the list is a panel that moves whenever the list does. */
      data-view-panel
      className="hidden shrink-0 self-start overflow-hidden lg:block"
      style={{
        /* The gap belongs to this box, not to the row: a gap in the row
           stays 24 pixels wide when the panel is nothing, which is a strip
           of nothing the list cannot have back.

           It is the inner box's margin rather than this one's padding,
           because padding is a floor a border box cannot go under: shutting,
           the width stopped dead at 24 with a fifth of the movement left,
           sat there for a sixth of a second, and then the strip vanished
           when the node went. That was the jerk. */
        /* The panel plus the gap before it. Both numbers are here because
           the box is what animates — the panel inside keeps its 280 and is
           clipped, so its edge travels with the opening. */
        width: shown ? 292 : 0,
        /* The drawer curve, because it keeps moving: the house ease-out is
           nine tenths of the way through in half the time, which over this
           distance is a flick rather than a panel. */
        transition: `width ${SLIDING}ms var(--ease-drawer)`,
      }}
    >
      <div
        data-reads-down
        /* Down, never sideways: the answers are rows of a fixed width, and a
           bar along the bottom of a panel is furniture. */
        /* The same gap the three columns of the shell stand apart by. It
           was twenty-four, three times anything else on the screen, so the
           answers read as belonging to the window rather than to the list
           they are about. */
        className="ml-3 flex w-[280px] flex-col overflow-x-hidden overflow-y-auto"
        /* The toolbar above and a breath below it. */
        /*
         * A border and no ground.
         *
         * This panel stands beside the list rather than over it — nothing
         * is pushed back for it and nothing is waiting on an answer. A
         * filled surface says the opposite: a second block of ground inside
         * the sheet the list is already on, competing with it for the eye.
         *
         * The sheets outside dropped their borders because the gap between
         * them already says where one ends. There is no gap here — this is
         * inside the work's own card — so the line is the only thing that
         * can say it.
         */
        style={{
          maxHeight: 'calc(100vh - 140px)',
          borderRadius: 'var(--r-card)',
          boxShadow: 'inset 0 0 0 1px var(--line)',
        }}
      >
        <div className="px-4 pt-3 pb-1 text-base font-medium text-ink" style={{ letterSpacing: 'var(--track-body)' }}>
          {ACTS.view}
        </div>
        <ViewAnswers {...props} />
      </div>
    </div>
  )
}

/**
 * Whose tasks, picked the way a person is picked everywhere else — the
 * assignee's own menu, glass, a field to narrow, a face per row, the digits
 * — with the three answers that are not a person at its head.
 *
 * It was a native select of names, the one place in the product a person
 * was a line of text with no face and no way to find them by typing.
 */
function WhoFilter({
  value,
  people,
  meId,
  onPick,
}: {
  value: string
  people: { actor_id: string; name: string; avatar_url?: string | null | undefined }[]
  meId?: string | undefined
  onPick: (v: string) => void
}) {
  const [at, setAt] = useState<{ x: number; y: number; r: number } | null>(null)
  const [typed, setTyped] = useState('')
  const box = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!at) setTyped('')
  }, [at])
  type Row = { id: string; label: string; face?: (typeof people)[number] }
  const me = people.find((p) => p.actor_id === meId)
  const fixed: Row[] = [
    { id: 'all', label: W.everyone },
    { id: 'mine', label: W.mine, ...(me ? { face: me } : {}) },
    { id: 'none', label: W.noOne },
  ]
  /* You are "Mine", at the head: not a second time among the names. */
  const named: Row[] = people.filter((p) => p.actor_id !== meId).map((p) => ({ id: p.actor_id, label: p.name, face: p }))
  const term = typed.trim().toLowerCase()
  /* Typing finds people — you among them, as "Mine". */
  const rows = term
    ? [...(me && me.name.toLowerCase().includes(term) ? [fixed[1]!] : []), ...named.filter((r) => r.label.toLowerCase().includes(term))]
    : [...fixed, ...named]
  const now = [...fixed, ...named].find((r) => r.id === value) ?? (value === meId ? fixed[1]! : fixed[0]!)
  const pick = (id: string) => {
    setAt(null)
    onPick(id)
  }

  useEffect(() => {
    if (!at) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setAt(null)
      if (typed) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > Math.min(rows.length, 9)) return
      e.preventDefault()
      pick(rows[n - 1]!.id)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const glyph = (r: Row) =>
    r.face ? (
      <Avatar id={r.face.actor_id} name={r.face.name} url={r.face.avatar_url ?? null} size={20} />
    ) : r.id === 'none' ? (
      <span className="size-5" />
    ) : (
      <span className="flex size-5 items-center justify-center text-ink-3">
        <Icon name="people" size={16} />
      </span>
    )

  return (
    <div className="flex flex-col gap-2 px-4 pt-3 pb-1">
      <span className="text-base text-ink-2">{W.assignedTo}</span>
      <button
        ref={box}
        data-testid="view-who"
        data-who-filter={value}
        aria-haspopup="menu"
        aria-expanded={at !== null}
        onClick={() => {
          if (at) return setAt(null)
          const b = box.current?.getBoundingClientRect()
          if (b) setAt({ x: b.left, y: b.bottom, r: b.right })
        }}
        className="flex h-8 w-full items-center gap-2 rounded-[var(--r-row)] px-2 text-base bg-track text-ink"
      >
        {glyph(now)}
        <span className="min-w-px flex-1 truncate text-left">{now.label}</span>
        <Icon name="chevron" size={10} className="text-ink-3" />
      </button>
      {at && <Over onClose={() => setAt(null)} />}
      {at && (
        <div
          data-over
          data-who-menu
          role="menu"
          className="fixed z-40"
          style={{
            left: inWindow(at.x, 240, at.r),
            top: at.y + 6 + Math.min(rows.length, 7) * 36 + 48 > window.innerHeight ? undefined : at.y + 6,
            bottom: at.y + 6 + Math.min(rows.length, 7) * 36 + 48 > window.innerHeight ? window.innerHeight - at.y + 46 : undefined,
            width: 240,
          }}
        >
          <Glass radius={16} className="overflow-hidden py-1">
            <input
              {...findField}
              data-testid="view-who-find"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAt(null)
                if (e.key === 'Enter' && rows.length === 1) {
                  e.preventDefault()
                  pick(rows[0]!.id)
                }
              }}
              placeholder={PLACES.findSomebody}
              className="w-full bg-transparent px-3 py-2 text-base outline-none text-ink"
            />
            <Hairline inset={0} />
            <div className="relative max-h-[252px] overflow-y-auto py-1" data-fluid data-menu data-reads-down>
              <Fluid />
              {rows.map((r, i) => (
                <button
                  key={r.id}
                  role="menuitem"
                  data-row
                  data-who-option={r.id}
                  onClick={() => pick(r.id)}
                  className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                  style={{ height: 'var(--row-h)' }}
                >
                  {glyph(r)}
                  <span className="min-w-px flex-1 truncate">{r.label}</span>
                  {r.id === value && <Icon name="tasks" size={14} className="text-ink-2" />}
                  {!typed && i < 9 && <span className="shrink-0 text-sm text-ink-3">{i + 1}</span>}
                </button>
              ))}
              {rows.length === 0 && <div className="px-3 py-2 text-base text-ink-3">{W.noOneByThatName}</div>}
            </div>
          </Glass>
        </div>
      )}
    </div>
  )
}
