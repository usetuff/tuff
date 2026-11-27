import { workingAgent, underWay } from '../../data/agentWorking.js'
import { HEADS } from '../../data/words.js'
import { TASKS as W } from '../../words/tasks.js'
import { WhoPick, whoOf, PriorityPick, LabelChip, RepeatMark, AgentDoing, Avatar, Status } from '../kit.jsx'
import { useWorkingOn } from '../../data/working.js'
import type { PersonInWorkspace } from '@tracker/shared-schema'
import { Icon } from '../glyphs.jsx'
import { type Task, type TaskPicture, given, days, short } from './model.jsx'
import { Waiting, waitingSaid } from './waiting.jsx'
import { type TasksProps } from '../Tasks.jsx'
import { type TaskData } from './useTaskData.js'
import { type TaskActions } from './useTaskActions.js'
import { type ListShape } from './useListShape.js'

/**
 * The card's handle, and beside it what an agent says it is doing on the
 * task. In the head, which is one line
 * already, so the card is the same height with the status and without it
 * and nothing under it moves when it comes or goes. While it is there the
 * handle keeps its width and the status takes what is left, cut short.
 */
function CardHandle({ taskId, handle, people }: { taskId: string; handle: string | null; people: PersonInWorkspace[] }) {
  const { status } = useWorkingOn(taskId)
  return (
    <>
      {handle !== null && (
        <span
          data-id
          className={`${status ? 'shrink-0' : 'min-w-0 flex-1'} truncate font-mono text-sm whitespace-nowrap text-ink-3`}
          style={{ letterSpacing: 'var(--track-body)' }}
        >
          {handle}
        </span>
      )}
      {status && <AgentDoing taskId={taskId} people={people} className="flex-1" />}
    </>
  )
}

/**
 * One card on the board, drawn from the screen's state.
 */
export function cardRenderer({
  projectKey,
  canWrite,
  shows,
  byKey,
  setOpen,
  people,
  lists,
  cycles,
  patch,
  move,
  setPriority,
  today,
  parts,
}: Pick<TasksProps, 'projectKey' | 'canWrite'> &
  Pick<TaskData, 'shows' | 'byKey' | 'setOpen' | 'people' | 'lists' | 'cycles' | 'patch' | 'move' | 'setPriority'> &
  Pick<TaskActions, 'today'> &
  Pick<ListShape, 'parts'>) {
  /**
   * A card, written once because it is drawn twice: in the column, and again
   * in the layer that follows the pointer. Two copies that can disagree is
   * how a dragged card ends up a different size from the one let go of.
   */
  /**
   * The board of members' head: whoever else the task is given to, as
   * faces, where the board draws the face — the column already says whose
   * it is. Nothing when it is nobody else's. Not under the Assignee switch,
   * which this board does not offer: the column already says the one face
   * the switch would hide.
   */
  function cardOthers(t: Task, whose: string) {
    const shown = whoOf(t)
      .filter((id) => id !== whose)
      .map((id) => people.find((p) => p.actor_id === id))
      .filter((p) => p !== undefined)
    if (shown.length === 0) return null
    return (
      <span data-card-others className="ml-auto flex shrink-0 items-center" title={shown.map((p) => p.name).join(', ')}>
        {shown.slice(0, 2).map((p, i) => (
          <span key={p.actor_id} className="flex rounded-full" style={{ marginLeft: i ? -4 : 0, boxShadow: '0 0 0 2px var(--card)' }}>
            <Avatar id={p.actor_id} name={p.name} url={p.avatar_url} size={20} />
          </span>
        ))}
        {shown.length > 2 && <span className="pl-1 text-sm tabular-nums text-ink-3">+{shown.length - 2}</span>}
      </span>
    )
  }
  /**
   * `whose` is the people view's column — an actor's id, or `~` / `?` —
   * and turns the head's face into the task's status: the column already
   * says whose it is.
   */
  function card(t: Task, col: string, whose?: string) {
    /* On the board of members the title stands after the status ring
       (20) and its gap (8), so what follows it starts where the title's
       words do rather than under the ring. */
    const under = whose === undefined ? '' : 'pl-7'
    return (
      <>
        {/*
          The card reads in four bands: who and which, what, about it, when.
          
          It was the title with a line of small facts under it, and every
          fact was the same weight as every other — the id, the age, the
          date and the face all grey, all 14, in one run. On a board that
          is a paragraph of metadata with a sentence on top.
          
          The bands give each kind of thing its own line: the handle and the
          person at the head where a card is identified, the status mark
          beside the title because it is what the title *is*, the properties
          as chips that can be counted at a glance, and the dates last
          because they are the thing read least.
        */}
        {shows.pictures && t.picture && <CardPicture picture={t.picture} />}
        <div className="flex items-start gap-2">
          <CardHandle taskId={t.id} handle={shows.id ? `${projectKey}-${t.number}` : null} people={people} />
          {/* At the head rather than in the run of facts: a face answers
              "whose is this", which is asked while finding the card rather
              than while reading it.
              
              And it is the control as well as the answer, the way the row's
              is — a fact somebody is looking at should be changeable where
              they are looking.
              
              Always drawn, including unassigned: `WhoPick` has a dashed
              empty ring for that, which is the shape of the answer before
              anybody has given it. Fading it in on hover left a hole where
              the ring would be and made the card's head change width under
              the pointer. */}
          {whose !== undefined && cardOthers(t, whose)}
          {whose === undefined && shows.who && (
            <span data-no-drag className="ml-auto flex shrink-0 items-center">
              <WhoPick
                people={people}
                value={whoOf(t)}
                said={t.title}
                disabled={!canWrite}
                size={20}
                task={t.id}
                working={workingAgent(t, underWay(lists.find((l) => l.id === t.list_id)?.icon), people)?.name ?? null}
                onPick={(to) => patch(t.id, { assignee_ids: to }, given(to))}
              />
            </span>
          )}
        </div>

        {whose === undefined ? (
          <button
            data-open-task
            /* A modifier means the card is being taken, not opened — and the
               title fills the top of the card, so that is where most of those
               presses land. The card beneath does the taking. */
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return
              setOpen(t.id)
            }}
            /* No list mark here. A card on a board is already inside the
               column that names its list, so the mark was the same glyph
               repeated down every card saying what the heading said once. */
            /* Broken anywhere rather than carried out of the card: a URL or
               a long word pasted as a title has nowhere to break, and the
               card is as wide as its column and no wider. */
            className="mt-1 block w-full text-left text-base font-medium [overflow-wrap:anywhere] text-ink"
            style={{ letterSpacing: 'var(--track-body)' }}
          >
            {t.title}
          </button>
        ) : (
          /*
           * On the board of members the status leads the title: the list's
           * ring, on the title's first line, and the Status picker — pressed,
           * it moves the task to another list. The column says whose it is,
           * so the list is the one fact a card has to add; a ring is how
           * every row of the product already says it, and the list's name
           * is the ring's label.
           */
          <div className="mt-1 flex items-start gap-2">
            <span data-no-drag data-card-status className="flex shrink-0 items-center text-base" style={{ height: '1lh' }}>
              <Status
                lists={lists}
                value={t.list_id}
                said={W.statusIs(lists.find((l) => l.id === t.list_id)?.name ?? '')}
                disabled={!canWrite}
                onPick={(into) => move(t, into)}
              />
            </span>
            <button
              data-open-task
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return
                setOpen(t.id)
              }}
              className="block min-w-0 flex-1 text-left text-base font-medium [overflow-wrap:anywhere] text-ink"
              style={{ letterSpacing: 'var(--track-body)' }}
            >
              {t.title}
            </button>
          </div>
        )}

        {/* What the work is, in its own words: the start of the
            description, two lines at most and cut with an ellipsis. It
            comes with the row, so the card is this tall from its first
            frame; a task with no description draws nothing here and takes
            no room. */}
        {shows.excerpt && t.excerpt && (
          <p
            data-excerpt
            className={`mt-1 line-clamp-2 ${under} text-sm [overflow-wrap:anywhere] text-ink-3`}
            style={{ letterSpacing: 'var(--track-body)' }}
          >
            {t.excerpt}
          </p>
        )}

        {/*
          What is true about it, as chips.
          
          A chip has an edge, so five of them read as five things rather
          than as a sentence of grey words — which is what a row of bare
          facts separated by gaps became once there were more than two.
        */}
        {(() => {
          /* `bare` is a chip that is already a pill — a label carries its
             own colour and edge, and putting it inside the outlined wrapper
             is a pill in a pill. */
          const chips: { node: React.ReactNode; bare?: boolean }[] = []
          /* First, because it decides whether the card can be picked up at
             all. A mark and not a move: the card stays where the board's
             people put it. */
          const waits = waitingSaid(t)
          if (waits) chips.push({ node: <Waiting key="wait" said={waits} size={12} /> })
          if (shows.priority) {
            /* Changed where it is read. A chip that only displays makes
               somebody open the task to alter a fact they are already
               looking at — the list's rows have worked this way since the
               keyboard arrived, and a card is the same fact in another
               drawing. `docs/specs/keyboard.md`. */
            chips.push({
              node: (
                <span key="pri" data-no-drag className="flex shrink-0 items-center">
                  <PriorityPick value={t.priority} said={t.title} disabled={!canWrite} size={14} onPick={(to) => setPriority(t, to)} />
                </span>
              ),
            })
          }
          if (shows.age && days(t.decided_at) > 0) {
            chips.push({
              node: (
                <span key="age" className="tabular-nums whitespace-nowrap">
                  {W.age(days(t.decided_at))}
                </span>
              ),
            })
          }
          if ((parts.get(t.id)?.length ?? 0) > 0) {
            chips.push({
              node: (
                <span key="parts" data-parts className="tabular-nums whitespace-nowrap">
                  {parts.get(t.id)!.filter((c) => c.completed_at).length}/{parts.get(t.id)!.length}
                </span>
              ),
            })
          }
          if (shows.due && t.due_on) {
            chips.push({
              node: (
                <span
                  key="due"
                  className="flex items-center gap-1 tabular-nums whitespace-nowrap"
                  /* Coloured when the date has arrived, quiet before then.
                     The design draws it warm because its example is due this
                     week; warm on every date, including one six weeks out,
                     is a colour that has stopped meaning anything. */
                  style={{
                    color: !t.completed_at && t.due_on! <= today ? 'var(--due)' : 'var(--ink-3)',
                  }}
                >
                  <Icon name="cal" size={14} />
                  {short(t.due_on)}
                </span>
              ),
            })
          }
          /* How it repeats, in words — a card has the room a row's date
             column has not. */
          if (shows.due && t.repeat) {
            chips.push({
              node: (
                <span key="repeat" data-card-repeat className="flex min-w-0 items-center text-ink-3">
                  <RepeatMark rule={t.repeat} />
                </span>
              ),
            })
          }
          if (shows.cycle && cycles.length > 0) {
            const y = cycles.find((c) => c.id === t.cycle_id)
            chips.push({
              node: (
                <span key="cyc" data-no-drag className="flex min-w-0 items-center">
                  <select
                    data-card-cycle
                    /* In a chip, so the arrow is the smaller one and the
                       pill's own padding is the gap — `theme.css`. */
                    data-in-pill
                    aria-label={W.sprintFor(t.title)}
                    className="min-w-0 max-w-full cursor-pointer appearance-none truncate bg-transparent text-sm outline-none"
                    style={{ color: y ? 'var(--ink-2)' : 'var(--ink-3)' }}
                    value={t.cycle_id ?? ''}
                    disabled={!canWrite}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const to = e.target.value || null
                      patch(t.id, { cycle_id: to }, { cycle_id: to })
                    }}
                  >
                    <option value="">{HEADS.noCycle}</option>
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </span>
              ),
            })
          }
          if (shows.labels) {
            for (const l of t.labels ?? []) {
              chips.push({ node: <LabelChip key={l.id} label={l} size={13} tight />, bare: true })
            }
          }
          if (chips.length === 0) return null
          return (
            <div className={`mt-2 flex flex-wrap items-center gap-1 ${under}`}>
              {chips.map((chip, at) => (
                <span
                  key={at}
                  /*
                   * Always there, because every one of these has an answer
                   * when it has no answer.
                   *
                   * They faded in on hover while unset, which reserved the
                   * box and left a hole: a card with no priority showed a
                   * thirty-six pixel gap that pushed its labels onto a
                   * second line, and the line moved when the pointer
                   * arrived. The empty states are real drawings — an unlit
                   * gauge, the words "No cycle" — so they are drawn.
                   */
                  /* No wider than the card: a label or a sprint with a
                     long name ends in an ellipsis on its own line instead
                     of running past the card's edge. */
                  className={
                    chip.bare
                      ? 'inline-flex min-w-0 max-w-full items-center'
                      : 'inline-flex h-6 min-w-0 max-w-full items-center gap-1 px-2 text-sm'
                  }
                  style={
                    chip.bare
                      ? undefined
                      : {
                          color: 'var(--ink-2)',
                          borderRadius: 'var(--r-pill)',
                          boxShadow: 'inset 0 0 0 1px var(--line)',
                        }
                  }
                >
                  {chip.node}
                </span>
              ))}
            </div>
          )
        })()}

        {/* When, last. Written out rather than as "7d", because a card that
            says both needs the two to be the same kind of answer.
            
            Switchable like the rest of what a card shows: two dates on
            forty cards is four lines of grey nobody is reading on a board
            somebody is scanning for titles. */}
        {shows.dates && (
          <div
            className={`mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-3 ${under}`}
            style={{ letterSpacing: 'var(--track-body)' }}
          >
            {t.created_at && <span className="whitespace-nowrap">{W.created(short(t.created_at))}</span>}
            <span className="whitespace-nowrap">{W.updated(short(t.decided_at))}</span>
          </div>
        )}
        {/*
          The keyboard's way to move a card, and only the keyboard's.

          It used to appear on hover as well, and it is absolutely positioned
          over the card — which means that at `opacity-0` it was still there
          to be pressed. On a card two lines tall the strip lands across the
          middle, so the place a person naturally takes hold of was a dead
          zone: press, drag, nothing moves. Invisible and still catching the
          pointer is the worst state a control can be in.

          Bound to focus instead — and then to a focus that came from a key.
          A click focuses as well, so pressing a card, or coming back to the
          board from the task it opened, wrote the moves across it for
          somebody using a pointer, who moves a card by dragging it.
        */}
        {canWrite && (
          <span
            data-moves
            className={`pointer-events-none absolute right-2 bottom-2 flex gap-2 pl-2 opacity-0 transition-opacity ${
              byKey ? 'group-focus-within:pointer-events-auto group-focus-within:opacity-100' : ''
            } bg-surface`}
          >
            {/*
              The two next to it, not every other list.

              It was one button per list, which fitted while a project had
              four of them and stopped when it had five: four arrows in the
              corner of a 180px card overflow it, and the first of them ends
              up off the card and unpressable. A project may have ten.

              Two is also the truer gesture. A board is stages in order and
              moving along them is what the columns are for; going from the
              first to the last in one press is the drag, or the task's own
              screen, where every list is on one menu.
            */}
            {[
              { l: lists[lists.findIndex((x) => x.id === col) - 1], arrow: '←' },
              { l: lists[lists.findIndex((x) => x.id === col) + 1], arrow: '→' },
            ].map(({ l, arrow }) =>
              l && lists.some((x) => x.id === col) ? (
                <button key={l.id} data-no-drag onClick={() => move(t, l.id)} className="hover:text-ink-2 whitespace-nowrap">
                  {arrow} {l.name}
                </button>
              ) : null,
            )}
          </span>
        )}
      </>
    )
  }
  return { card } as const
}
export type CardRenderer = ReturnType<typeof cardRenderer>

/**
 * The task's first picture, at the head of its card.
 *
 * The frame is the picture's own shape from the first frame, read from the
 * size the server sent with it, the card's width and no taller than 160 —
 * so the card is its final height before a byte of the picture is in. The
 * frame is always the card's whole width, out to its edges, as a cover is;
 * a picture taller than that frame — a phone's screenshot — stands whole in
 * its middle, on the card's own ground, rather than in a narrow frame on the
 * left. The width is said outright: with `auto`, `aspect-ratio` under a
 * `max-height` narrows the box instead of capping it. A picture nobody
 * measured gets 16 by 9.
 *
 * Fetched as it scrolls into view, decoded off the main thread, and drawn
 * when it is in with no fade. One that fails leaves the frame empty rather
 * than taking it away, which would move every card under it.
 */
function CardPicture({ picture }: { picture: TaskPicture }) {
  const { width, height } = picture
  const shape = width && height ? `${width} / ${height}` : '16 / 9'
  return (
    <div
      data-card-picture
      className="relative -mx-4 -mt-3 mb-3 max-h-40 min-h-12 overflow-hidden"
      style={{
        width: 'calc(100% + 2rem)',
        aspectRatio: shape,
        borderTopLeftRadius: 'var(--r-card)',
        borderTopRightRadius: 'var(--r-card)',
      }}
    >
      <img
        src={picture.thumb_url}
        alt=""
        loading="lazy"
        decoding="async"
        /* A card is carried by the pointer, and a picture the browser
           lets you drag would carry a ghost of itself instead. */
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full object-contain"
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
    </div>
  )
}
