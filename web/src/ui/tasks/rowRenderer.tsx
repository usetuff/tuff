import { workingAgent, underWay } from '../../data/agentWorking.js'
import { Status, LabelChip, PriorityPick, DuePick, WhoPick, whoOf, AgentDoing } from '../kit.jsx'
import { near } from '../TaskDetail.jsx'
import { type Task, short, given } from './model.jsx'
import { soon } from './view.jsx'
import { Waiting, waitingSaid } from './waiting.jsx'
import { type TasksProps } from '../Tasks.jsx'
import { type TaskData } from './useTaskData.js'
import { type BoardMoves } from './useBoardMoves.js'
import { type TaskActions } from './useTaskActions.js'
import { type ListShape } from './useListShape.js'

/**
 * One row of the list, drawn from the screen's state.
 */
export function rowRenderer({
  projectKey,
  canWrite,
  phone,
  drawn,
  setOpen,
  people,
  lists,
  cycles,
  patch,
  move,
  setPriority,
  taken,
  setTaken,
  today,
  anyLabels,
  setOnTask,
  parts,
  indexOf,
  at,
  setAt,
  take,
}: Pick<TasksProps, 'projectKey' | 'canWrite'> &
  Pick<TaskData, 'phone' | 'drawn' | 'setOpen' | 'people' | 'lists' | 'cycles' | 'patch' | 'move' | 'setPriority'> &
  Pick<BoardMoves, 'taken' | 'setTaken'> &
  Pick<TaskActions, 'today' | 'anyLabels' | 'setOnTask'> &
  Pick<ListShape, 'parts' | 'indexOf' | 'at' | 'setAt' | 'take'>) {
  function row(t: Task, depth: number) {
    const i = indexOf.get(t.id) ?? -1
    const mine = parts.get(t.id) ?? []
    const closed = mine.filter((c) => c.completed_at).length
    return (
      <div
        key={t.id}
        onContextMenu={(e) => {
          if (!canWrite) return
          e.preventDefault()
          setOnTask({ id: t.id, x: e.clientX, y: e.clientY })
        }}
        data-task
        data-part={depth > 0 ? '' : undefined}
        data-selected={i === at || undefined}
        /* Marked, not painted: one highlight slides between the rows. */
        data-lit={i === at ? '' : undefined}
        onPointerEnter={(e) => {
          /* Not while something is drawn over the list.
          
             A menu is `fixed` but it is still a child of the row it was
             opened from, so the pointer moving across an open calendar
             enters whatever rows happen to lie under it — which moved the
             cursor there and took that row's two lines away, a gap in the
             list beside a panel nobody was pointing at. `Fluid` has always
             guarded its highlight this way; the cursor had not. */
          if (document.querySelector('[data-over]')) return
          setAt(i)
          /* And read ahead: the hand is on a row for longer than a round
             trip before it presses, so the task's own screen opens on its
             words rather than on a title waiting for them. */
          near(t.id)
        }}
        /* A touch has no hover to read ahead on; the press is the first
           sign, and still a round trip before the lift opens it. */
        onPointerDown={() => near(t.id)}
        /*
         * The whole row opens it, not the title alone.
         *
         * The row is lit end to end under the pointer and then answered a
         * press on one word of it: the space after a short title, the
         * handle, the date and the face all did nothing, which is a target
         * you have to aim at inside a target that looks like one.
         *
         * Anything that is its own control is left alone — the ring that
         * sets the list is a button, and a press on a button is a press on
         * that button. The title stays a button of its own as well: it is
         * the row's accessible name and the thing a keyboard tabs onto.
         */
        data-taken={taken.has(t.id) ? '' : undefined}
        onClick={(e) => {
          /*
           * A press with a modifier takes the row instead of opening it —
           * `docs/specs/many-at-once.md`. Shift takes the run between this
           * one and the last one taken, which is how ten are taken in two
           * gestures rather than ten.
           *
           * Plain is still open, deliberately: opening is what people do far
           * more often, and the common thing does not get the harder gesture.
           */
          /* Asked before the guard below, not after: the title is a button
             and the title is most of the row, so a modifier press that waits
             its turn behind "is this a control?" never arrives. */
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            return take(t.id, 'one')
          }
          if (e.shiftKey) {
            /* The browser selects text between two shift-clicks, which is not
               what was asked for here. */
            e.preventDefault()
            window.getSelection()?.removeAllRanges()
            return take(t.id, 'range')
          }
          if ((e.target as Element).closest('button,a,input,select')) return
          if (taken.size > 0) return setTaken(new Set())
          setOpen(t.id)
        }}
        className="group relative flex items-center gap-3 py-3 pr-4"
        style={{
          // Indented by the width of the ring and its gap, so a part's title
          // starts where its parent's title starts and the column of titles
          // reads as two levels rather than as a ragged edge.
          paddingLeft: depth > 0 ? 16 + 32 : 16,
          /* Taken, which is not the same as lit: the highlight is where the
             hand is and moves with it, and a row that was chosen has to
             survive the cursor moving on. A ground of its own rather than a
             tick in a column nobody asked for. */
          ...(taken.has(t.id) ? { background: 'color-mix(in oklch, var(--accent) 12%, transparent)' } : {}),
        }}
      >
        {/* The ring shows where it is and sets it. The list is the status,
            so the thing that draws it is the thing that changes it. */}
        <Status lists={lists} value={t.list_id} said={t.title} disabled={!canWrite} onPick={(into) => move(t, into)} />
        {/* The title's line, and under it the start of the description
            when that is asked for and there is one — one line, cut with an
            ellipsis. Nothing at all when there is none, so a row without a
            description is the row it always was. */}
        <span className="flex min-w-px flex-1 flex-col">
          <span className="flex min-w-px items-center gap-2">
            <button
              data-open-task
              /* A modifier means the row is being taken, not opened — and the
               title is most of the row, so this is where most of those
               presses land. The row above does the taking.
               `docs/specs/many-at-once.md`. */
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return
                setOpen(t.id)
              }}
              /* Finished work is quieter, never struck out. A line through a
               title is drawn over the words themselves — the one thing on
               the row somebody might still be reading — and it says
               "cancelled" as readily as it says "done". The ring beside it
               has already said which, and the grey says it again. */
              /* A title is content, not a label: it is the one thing on this
               row somebody copies — into a branch name, a message, a
               commit. The row is a link, so without this it would lose
               selection with the rest of the chrome. */
              data-text
              className="min-w-px truncate text-left text-base"
              style={{
                color: t.completed_at ? 'var(--ink-3)' : 'var(--ink)',
                letterSpacing: 'var(--track-body)',
              }}
            >
              {t.title}
            </button>
            {/*
            How much of it is done, against the title rather than out in the
            columns.
            
            It is the only thing here that is about the words beside it —
            "three of these, none done" is part of reading the title, not a
            fact filed next to a date. Out on the right it needed a column
            of its own that most rows had nothing to put in.
          */}
            {mine.length > 0 && (
              <span data-parts className="shrink-0 text-base tabular-nums text-ink-3">
                {closed}/{mine.length}
              </span>
            )}
            {/* What it waits on, against the title for the reason the count
              is: it is about whether this can be started, which is part of
              reading what it is. It gives way
              before the title does. */}
            {waitingSaid(t) && (
              <span className="flex min-w-0 shrink-[4]">
                <Waiting said={waitingSaid(t)!} />
              </span>
            )}
            {/* What an agent says it is doing on it, after the title and
              giving way before it does — one line, so the row is the same
              height with it and without it. */}
            <AgentDoing taskId={t.id} people={people} className="shrink-[4]" />
          </span>
          {drawn.excerpt && t.excerpt && (
            <span data-excerpt className="min-w-px truncate text-sm text-ink-3" style={{ letterSpacing: 'var(--track-body)' }}>
              {t.excerpt}
            </span>
          )}
        </span>

        {/*
          The facts about the row, in columns.
          
          They were laid one after another as each row happened to have
          them, so nothing lined up: a date on one row and none on the next
          moved the list name, the handle and the faces sideways, and forty
          rows of that is a column of nothing in particular. Each of these
          is a fixed width now and is drawn whether or not this row has
          anything to put in it, so the eye reads down them.
          
          A column exists only if the list needs it, which is what the four
          switches in the panel decide. The count of parts is not one of
          them: it is about the words beside it rather than a fact filed
          next to a date, so it sits against the title.
        */}
        <span className="flex shrink-0 items-center gap-2">
          {/*
            What this task is called in a sentence.
            
            On the right with the other facts rather than in front of the
            title: the column the eye reads down is the titles, and a handle
            before every one of them is the same three letters forty times
            over on the way to the thing being read.
          */}
          {/*
            How urgent it is — first of the columns, so it sits nearest the
            words it is about. The rest of them are facts filed against the
            row; this one is what kind of work it is.
            
            Empty and faint until somebody answers, and only under the
            pointer: a column of grey bars down a list nobody has triaged
            says nothing about any of it. It is a control as well as a mark,
            which is why it is here at all rather than only on the task's own
            screen — triage is a pass down a list, not forty screens.
            
            `data-no-drag` because rows drag, and a press that opens a menu
            is not the start of a move.
          */}
          {/*
            The words on it, in a column of their own.
            
            They used to follow the title, so they began wherever each title
            happened to end — measured across eight rows, three different
            chips started at 733, 977 and 1015, while every fact to the
            right of them stood in a column. A thing that moves 280 pixels
            between one row and the next is one the eye has to find again on
            every line.
            
            First of the columns, because they are words about the task and
            everything after them is a fact filed against it. Two and then a
            count: a row that is half chips is a row whose title has to be
            hunted for, which is why this is capped rather than wrapped.
            
            Against the right of their column, not the left. The column has
            a fixed width and the chips in it do not, so left-aligned they
            ended wherever the words ran out — one label stopped 44 pixels
            short of the next column and two reached it, which is the same
            ragged edge the chips had before they were given a column at
            all, moved one step over. Everything to the right of them is
            right-aligned against its own column; these now are too.
          */}
          {/*
            And only on a row that has some.

            Every row held the column open, so a row with no labels — most
            of them — ended its title 150 pixels short of anything, cut at
            thirty characters beside empty space. The facts after it are
            right-aligned against the row's end, so leaving the column out
            moves none of them; it only gives the title the room. A row with
            labels still starts them where every other row's start.
          */}
          {drawn.labels && anyLabels && (t.labels?.length ?? 0) > 0 && (
            /*
             * And the chips may narrow rather than be cut.
             *
             * The column is 150 and a chip is as wide as its word, so two
             * of them plus the count overflow on ordinary names: "Bug" and
             * "Improvement" want about 160. Overflowing a `justify-end` box
             * clips at the *left*, so what showed was a first label with
             * its beginning sliced off — "ug" where "Bug" was.
             *
             * Widening the column only moves the pair that does it. So the
             * chips carry `tight` here: the first gives up width and its
             * own `truncate` ends it with an ellipsis, which is a word cut
             * short on purpose rather than a chip with a piece missing.
             */
            <span className="flex h-5 shrink-0 items-center gap-2 overflow-hidden sm:w-[150px] sm:justify-end">
              {(t.labels ?? []).slice(0, 2).map((l, i, all) => (
                /* Only the last of them gives way. Letting both shrink
                   divides the shortfall between them, so a three-letter
                   word became "B…" beside a long one that still did not
                   fit — two words spoiled to save one. The first keeps the
                   width its word needs and the one beside it is shortened
                   to what is left. */
                <LabelChip key={l.id} label={l} tight={i === all.length - 1} />
              ))}
              {(t.labels?.length ?? 0) > 2 && (
                /* How many more there are, which is a mark like the chips
                   it follows rather than a word to take. */
                <span className="shrink-0 cursor-default text-sm select-none text-ink-3">+{(t.labels?.length ?? 0) - 2}</span>
              )}
            </span>
          )}
          {drawn.priority && (
            /* Drawn whether or not it is set, like the ring and the date
               beside it: the empty bars are the shape of the answer before
               anybody has given it, and a column that appears under the
               pointer is a control nobody finds. */
            <span
              data-no-drag
              /* The row's padding taken back, like the date beside it, so
                 the mark is pressable over the row's full height and the
                 wash under it is the size of a control rather than of a
                 glyph. */
              className="relative flex h-5 w-5 shrink-0 items-center justify-center"
            >
              <PriorityPick
                value={t.priority}
                said={t.title}
                disabled={!canWrite}
                /* The size of the date's glyph two columns over, not of the
                   avatar: these are facts at the same weight. */
                size={14}
                onPick={(to) => setPriority(t, to)}
              />
            </span>
          )}
          {drawn.id && (
            <span
              data-id
              /* The mono face, because it is an identifier: `RED-1` and
                 `RED-12` in the body face are two widths of the same thing,
                 and it is the letters that differ, not only the digits. */
              /*
               * Along the left of its column, not the right.
               *
               * Right-aligned the digits stood under each other, which is
               * what a column of numbers wants — but this is not a column
               * of numbers. The key in front of them is the same three
               * letters on every row of a project, and ending the whole
               * handle at one place made that constant shift a character
               * sideways whenever the number gained a digit: `RED−8` and
               * `RED−18` start in different places and say the same thing
               * about where they are.
               *
               * So the part that never changes stands still and the digits
               * trail. Zero-padding them to `RED−08` would even the block
               * too, and it is the one thing that cannot be done here: the
               * number is the address and the thing people say out loud
               * — and a handle with two spellings
               * is the thing that spec spends its time removing. The
               * padding would also have to grow at a hundred tasks, so the
               * same task would change its name.
               */
              /* `cursor-default`, because `auto` over text is the I-beam
                 for selecting it — and this is a label on a row somebody
                 clicks, not a passage they are reading. The beam said the
                 digits were the thing to reach for, which is the one thing
                 on the strip that is not a control. */
              /* Selectable all the same: `TRA-41` is said out loud and
                 pasted into branches, which is the whole of what the
                 number is for. */
              data-text
              className="shrink-0 cursor-default font-mono text-sm sm:w-[74px] text-ink-3"
            >
              {projectKey}-{t.number}
            </span>
          )}
          {/*
           * A date, and on a phone only one that is worth the width.
           *
           * 72 and not 86: the widest thing the cell ever holds is "30 Sept"
           * at 52px, plus a 14px glyph and the 4 between them, so the old
           * width carried sixteen pixels of nothing — which read as a hole
           * between the handle and the date once the empty cell started
           * saying None instead of standing blank.
           *
           * The column is 72px whether or not there is a date in it, which
           * is right on a wide screen — the dates line up down the list and
           * a row without one leaves a gap where the eye expects nothing.
           * On 390 that gap is a quarter of the title. So here the cell is
           * only as wide as what is in it, and what is in it is a date that
           * is overdue or inside a week; anything further off is a fact for
           * the task's own screen.
           */}
          {drawn.due && (!phone || soon(t.due_on, today)) && (
            /* The cell is the control, like the face and the mark beside
               it: the date was the one fact on this strip that could only
               be set by opening the task. The same glyph and the same
               place whether or not there is a date, so the column reads as
               one question answered down the list rather than as rows that
               have a date and rows that have nothing. */
            <span
              data-no-drag
              /*
               * The row's own padding, taken back.
               *
               * `h-5` left twelve pixels of row above and below the date,
               * and a press that landed there opened the task instead of
               * the month. `h-11` fixed the hit area and made the row 68
               * tall, because a strip is as tall as the tallest thing in
               * it; `self-stretch` did nothing, because the strip centres
               * what it holds.
               *
               * So the cell bleeds into the row's `py-3` and puts it back
               * as its own padding: same height on the screen, and the
               * twelve pixels either side belong to the control rather
               * than to the link under it.
               */
              /*
               * A width on the phone too, now that the control inside is
               * laid out of the flow.
               *
               * The cell used to size itself to the date in it, which was
               * right while the date was ordinary text. An absolutely
               * positioned child gives its parent nothing to be, so the
               * cell collapsed to 8px and the date spilled left across the
               * title. Narrower than the desktop's 72 because the phone
               * only ever draws a date that is overdue or inside a week —
               * "14 Oct", never "30 Sept".
               */
              className="relative flex h-5 shrink-0 items-center justify-end sm:w-[72px]"
            >
              <DuePick
                value={t.due_on}
                said={t.title}
                disabled={!canWrite}
                format={short}
                /* The only colour in the row, and only when the date is in
                   the past — the one thing here that is wrong rather than
                   merely true. */
                tone={t.due_on && !t.completed_at && t.due_on <= today ? 'var(--due)' : 'var(--ink-3)'}
                onPick={(to) => void patch(t.id, { due_on: to }, { due_on: to })}
                /* A part repeats with its task, so it is offered on tasks
                   only. */
                {...(t.parent_id || !canWrite
                  ? {}
                  : {
                      repeat: {
                        value: t.repeat ?? null,
                        onPick: (rule, due) => {
                          const sent = { repeat: rule, ...(due ? { due_on: due } : {}) }
                          void patch(t.id, sent, sent)
                        },
                      },
                    })}
              />
            </span>
          )}
          {/* Which stretch of dates it is in, when asked for. Quiet and
              named, because a cycle answers "when, roughly" and the date
              beside it answers "when exactly". */}
          {/*
            A column of its own, drawn or not.
            
            Every other fact on this strip has a fixed width — the id 74,
            the date 86, the face 32 — and this one sized itself to the
            name in it and vanished on a task with no cycle. The strip is
            right-aligned, so one row carrying "Sprint 15" made that row's
            strip wider and pushed its date, its id and its priority left
            of where they sat on the row above. Measured on the screen it
            is four facts out of line because of a fifth.
            
            So the column is always there and always the same width; what
            changes is whether anything is written in it. That is the rule
            the priority mark and the face already follow — a fact nobody
            has set is an empty column, not a column that is not there.
          */}
          {drawn.cycle && (
            <span data-cycle-on-row className="hidden h-5 w-[72px] shrink-0 items-center justify-end truncate text-sm sm:flex text-ink-3">
              {t.cycle_id ? (cycles.find((y) => y.id === t.cycle_id)?.name ?? '') : ''}
            </span>
          )}
          {drawn.who && (
            /* The face is the control, the way the ring and the priority mark
               are: a mark that is also how what it marks is changed. It was a
               picture, so assigning meant opening the task — and a letter on
               the keyboard had nothing to open. `docs/specs/keyboard.md`.

               The empty ring is drawn, not waited for.

               It used to come up under the pointer, on the argument that a
               column of dashed circles down an unassigned list says nothing
               about any of it. True of the marks it was copying — a
               priority is absent far more often than set — and not of this
               one: the ring is the only thing saying a task has nobody on
               it, and a column that is blank until somebody sweeps a mouse
               down it reads as a column of nothing rather than a column of
               questions. The slot is held open either way, so drawing it
               costs no width. */
            <span data-no-drag className="relative flex h-5 w-8 shrink-0 items-center justify-end">
              <WhoPick
                people={people}
                value={whoOf(t)}
                said={t.title}
                disabled={!canWrite}
                task={t.id}
                working={workingAgent(t, underWay(lists.find((l) => l.id === t.list_id)?.icon), people)?.name ?? null}
                onPick={(to) => patch(t.id, { assignee_ids: to }, given(to))}
              />
            </span>
          )}
        </span>
      </div>
    )
  }
  return { row } as const
}
export type RowRenderer = ReturnType<typeof rowRenderer>
