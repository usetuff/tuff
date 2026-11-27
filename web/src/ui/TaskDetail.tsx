import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PersonDoorsContext } from './PersonCard.jsx'
import { CHAT } from '../words/chat.js'
import { FEEDBACK } from '../words/feedback.js'
import { underWay, workingAgent } from '../data/agentWorking.js'
import { FACTS, HEADS, LOCALE, MAKE, MORE, SAYS, dayMonthLong } from '../data/words.js'
import { TASK_DETAIL as W } from '../words/taskDetail.js'
import type { Changed, TaskData } from './tasks/useTaskData.js'
import type { Task as Row } from './tasks/model.jsx'
import { type PullOnTask, excerptOf } from '@tracker/shared-schema'
import { GITHUB } from '../words/github.js'
import { PullsOnTask } from './Github.jsx'
import { api, isGone, untilAnswered } from '../data/api.js'
import { onABoard } from '../data/boardApi.js'
import {
  Avatar,
  Dot,
  Hairline,
  Panel,
  Popover,
  SectionHead,
  Status,
  PRIORITY_SAID,
  PriorityPick,
  LabelPick,
  WhoPick,
  whoOf,
  namesOf,
  DateButton,
  RepeatMark,
  writtenDay,
  type RepeatField,
  CyclePick,
  LabelChip,
  Toolbar,
  usePhone,
  useWide,
  type Label,
  type Placed,
  AgentDoing,
} from './kit.jsx'
import { Icon } from './glyphs.jsx'
import { plain } from '../data/doc.js'
import { printAsPdf } from '../data/print.js'
import { primeUrls } from '../data/files.js'
import { recall, remember } from '../data/memory.js'
import { Editor, type EditorHandle } from './Editor.jsx'
import { DropHere, useDropFiles } from './DropFiles.jsx'
import { EDITOR } from '../words/editor.js'
import { Discussion, type Comment } from './Comments.jsx'
import { setDetail } from '../data/title.js'
import { goTo } from '../data/route.js'
import { CopyTaskDialog } from './CopyTask.jsx'
import { RemindMe, ahead } from './RemindMe.jsx'
import {
  type Person,
  type Read,
  type Full,
  type Step,
  type Spent,
  type AiSpent,
  type Cycle,
  newerThanEdit,
  editedAt,
  wholeRead,
  readHistory,
  readingTask,
  waitedFor,
} from './taskDetail/model.js'
import { readAside, keepAside, QUICK, branchName, Triage } from './taskDetail/triage.jsx'
import { Round, RoundFace, Fact, Aside } from './taskDetail/aside.jsx'
import { HistoryPanel } from './taskDetail/history.jsx'
import { Time } from './taskDetail/time.jsx'
import { NewSubtask } from './taskDetail/newSubtask.jsx'
import { Blockers } from './taskDetail/blockers.jsx'
export { seen, near, taskReady } from './taskDetail/model.js'
export { RoundFace, Round, Fact } from './taskDetail/aside.jsx'

/** The list behind the task's screen, as the screen writes through it. */
export type Behind = Pick<TaskData, 'write' | 'lay' | 'takeOff' | 'settle'>

/*
 * A change to the task as its row in the list says it: the body is not on
 * a row, the first of whoever it is given to is, and a move is a decision
 * made now. The server's row replaces all of it when it answers.
 */
function asRow(change: Partial<Full>): Partial<Row> {
  const { body: _body, ...rest } = change
  const out = { ...rest } as unknown as Partial<Row>
  /* The row says the start of it, worked out here by the server's own
     rule so the card under the panel says what was just written. */
  if (change.body !== undefined) out.excerpt = excerptOf(change.body)
  if (change.assignee_ids) out.assignee_id = change.assignee_ids[0] ?? null
  if (change.list_id !== undefined) out.decided_at = new Date().toISOString()
  return out
}

/**
 * The task itself.
 *
 * Without this a task from the web could only ever be a title and a checkbox:
 * the due date, the assignees, the description and the checklist all existed
 * in the schema and in the contract, and there was nowhere to set any of
 * them.
 */
export function TaskDetail({
  taskId,
  projectId,
  projectKey,
  people,
  revision,
  allLabels,
  onMakeLabel,
  canWrite,
  canEditAny,
  canDelete,
  canRemind = false,
  meId,
  lists,
  triageStart,
  canReadActivity,
  onAllActivity,
  onOpen,
  onPrev,
  onNext,
  onClose,
  onDelete,
  behind,
}: {
  taskId: string
  /** Where a picture or a file inserted into the body becomes a row. */
  projectId: string
  /** What a sentence calls this project: `STU`, for `STU-41`. */
  projectKey: string
  people: Person[]
  /**
   * Bumped when the project heard that something changed — the same number
   * the list behind this screen reloads on.
   */
  revision: number
  /** Every label in the workspace, for the picker. */
  allLabels: Label[]
  onMakeLabel: (name: string, color?: string | null) => Promise<Label | null>
  canWrite: boolean
  /** `content.edit.said`: whether somebody else's words are yours to change. */
  canEditAny: boolean
  /* Somebody else's. Your own is yours whatever the project says — the same
     shape as editing, about a stronger verb. */
  canDelete: boolean
  /** `task.remind` — a reminder for yourself on it. */
  canRemind?: boolean
  meId: string
  /** Where this task can be, which is the whole of its status. */
  lists: Placed[]
  /** Opened from the list's menu to mark it a duplicate. */
  triageStart?: 'duplicate' | null
  /** Whether this task's own history is drawn. */
  canReadActivity: boolean
  /** The way to the rest of it, which is the project's own feed. */
  onAllActivity: () => void
  /** A part has an address of its own, so the screen can move to it. */
  onOpen: (taskId: string) => void
  /**
   * The task before and after this one in the list it was opened from, for
   * ← and → — `docs/specs/keyboard.md`. Absent at an end, or where this task
   * is not a row of that list.
   */
  onPrev?: (() => void) | undefined
  onNext?: (() => void) | undefined
  onClose: () => void
  /**
   * Deleting it, by the list behind: off the screen and out of the list at
   * once, and offered back in the list's own toast and on ⌘Z — the board's
   * delete, from here.
   */
  onDelete?: ((id: string, title: string) => void) | undefined
  /**
   * The list or board this screen was opened from, which every write here
   * goes through: its row moves with the screen, the answer settles it in
   * place, and a refusal puts both back. Nothing here reads the project
   * again.
   */
  behind: Behind
}) {
  /*
   * Opened on what is already known about it.
   *
   * This screen drew nothing until its own fetch landed. From a project's
   * list that is barely visible — the list is already on the screen and the
   * task is a panel beside it — but from My tasks it is a whole screen of
   * nothing for the length of a round trip: measured, the list went at 79ms
   * and the task appeared at 253. A hundred and seventy milliseconds of
   * blank is the "jerk" somebody feels and cannot name.
   *
   * Every list that draws a task remembers it by id, so the title, the
   * ring, the date and the project are there in the first frame and the
   * body, the comments and the time fill in behind them. The design asks for
   * navigation without spinners; this is the same answer the sidebar and
   * the rooms already give.
   */
  const [task, setTask] = useState<Full | null>(() => recall<Read>(`task:${taskId}`)?.task ?? null)
  const [steps, setSteps] = useState<Step[]>(() => recall<Read>(`task:${taskId}`)?.steps ?? [])
  const [pulls, setPulls] = useState<PullOnTask[]>(() => recall<Read>(`task:${taskId}`)?.github?.pulls ?? [])
  const [issue, setIssue] = useState(() => recall<Read>(`task:${taskId}`)?.github?.issue ?? null)
  const [asked, setAsked] = useState(() => recall<Read>(`task:${taskId}`)?.feedback ?? null)
  /* The tab says which task, as Linear's does: `ACM-41 Homepage hero`.
     `docs/specs/window-title.md`. */
  const tabSays = task ? `${projectKey}-${task.number} ${task.title}`.trim() : null
  useEffect(() => {
    setDetail(tabSays)
  }, [tabSays])
  useEffect(() => () => setDetail(null), [])
  const [comments, setComments] = useState<Comment[]>(() => recall<Read>(`task:${taskId}`)?.comments ?? [])
  const [spent, setSpent] = useState<Spent[]>(() => recall<Read>(`task:${taskId}`)?.time ?? [])
  const [ai, setAi] = useState<AiSpent[]>(() => recall<Read>(`task:${taskId}`)?.spend ?? [])
  /* The project's cycles, for the picker below. Loaded here rather than
     passed down: this is the only screen that sets one, and a project with
     no cycles pays a request that returns an empty list once. */
  /* From what the list behind already read, so the Sprint row is drawn with
     the screen rather than appearing a moment later and pushing what is
     under it down; read again behind it. */
  const [cycles, setCycles] = useState<Cycle[]>(() => recall<Cycle[]>(`cycles:${projectId}`) ?? [])
  useEffect(() => {
    if (!projectId) return
    void api<{ cycles: Cycle[] }>(`/projects/${projectId}/cycles`)
      .then((r) => setCycles(remember(`cycles:${projectId}`, r.cycles)))
      .catch(() => {})
  }, [projectId])

  /*
   * Escape shuts the task, which is what the button at the top does.
   *
   * Bound here and not in the shell. A global "Escape goes back" was
   * tried and taken out: the key already closes things all over the
   * product, most of those handlers leave no sign they ran, and firing
   * anyway shut a menu and left the screen on one press. A screen that
   * knows it is open has no such problem.
   *
   * Three things are nearer than this one and each answers first:
   *
   * — anything laid over the page, which says so with `[data-over]`:
   *   the sheet behind a menu, the scrim behind a modal;
   * — the palette, which lays no sheet at all. That is the fact five
   *   earlier attempts missed — `[data-over]` was the test and the
   *   palette was invisible to it, so Escape over a task shut the
   *   palette *and* left the task;
   * — a field, because Escape in one gives up what is being typed. A
   *   comment being edited focuses an `INPUT`, which this catches.
   */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const it = document.activeElement
      if (it instanceof HTMLElement && (it.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(it.tagName))) {
        return
      }
      /*
       * Asked in the capture phase, before anything has shut itself.
       *
       * The bubble phase is too late: the palette's own handler runs
       * there, closes itself and lets React flush synchronously, so by
       * the time a second bubble listener looks, the palette it should
       * have deferred to is already gone from the document. Waiting does
       * not help — everything it would wait for has happened.
       *
       * Capture runs before any of them, while what is open is still
       * open. The answer is then deferred a frame, so that whatever was
       * open gets its own press and this one does nothing.
       */
      const covered = !!document.querySelector('[data-over],[data-testid="palette-input"]')
      if (covered) return
      requestAnimationFrame(() => onClose())
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [onClose])

  /*
   * ← and → page through the list the task was opened from —
   * `docs/specs/keyboard.md`, "Paging through an open task".
   *
   * Bound here for the reason Escape is: the screen knows it is open. In
   * the bubble phase, so whatever is nearer has had the key first and said
   * so — a resize handle or the calendar moves by it and prevents the
   * default. A field keeps its arrows for the caret, and anything laid over
   * the task (a menu, a dialog, the palette, a picture opened large) keeps
   * them for itself. One press, one task: a held key does not run down the
   * list, filling the history with addresses nobody read.
   */
  const paging = useRef({ onPrev, onNext })
  paging.current = { onPrev, onNext }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const it = document.activeElement
      if (it instanceof HTMLElement && (it.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(it.tagName))) {
        return
      }
      const covered = document.querySelector('[data-over],[data-lightbox],[role="menu"],[role="dialog"],[data-testid="palette-input"]')
      if (covered) return
      const go = e.key === 'ArrowLeft' ? paging.current.onPrev : paging.current.onNext
      if (!go) return
      e.preventDefault()
      go()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  /*
   * The body, and whose it is.
   *
   * The screen stays mounted from one task to the next, and the body was a
   * bare value: for the render that changed the task it still held the last
   * one's, a read of the last task still on its way could put its body back
   * after the step, and the editor ignored a `null` — so a task with no
   * description, reached by the arrow, showed the description of the task
   * before it, and a press into it and away saved that description onto
   * the wrong task. A body is only ever this task's: one held for another
   * is not drawn, and the remembered copy stands in until this one's
   * arrives. `docs/specs/keyboard.md`.
   */
  const [held, setHeld] = useState<{ of: string; doc: unknown }>(() => ({
    of: taskId,
    doc: recall<Read>(`task:${taskId}`)?.task.body ?? null,
  }))
  const body = held.of === taskId ? held.doc : (recall<Read>(`task:${taskId}`)?.task.body ?? null)
  const setBody = (doc: unknown) => setHeld({ of: taskId, doc })
  /* The task on the screen now, for a read that answers after a step. */
  const showing = useRef(taskId)
  showing.current = taskId
  /*
   * The history or the hours, beside the task, behind a round button each.
   *
   * They were a column of facts down the right with the history under it —
   * a second column on every task, holding what is read once a week beside
   * what is read every time. The facts somebody acts on went under the
   * title; these two are opened when they are wanted, the way the list's
   * view is. One at a time: they are two answers to "what happened to it",
   * and two panels side by side would be a column again.
   */
  /* Remembered on this device, like the column widths: whether one person
     likes the history open is not a question a team has an answer to. */
  /*
   * The task as a prompt, on the clipboard.
   *
   * Written with the clipboard's promise form, so the write is begun inside
   * the press and the text arrives after: Safari refuses a write that starts
   * once a request has come back, the gesture being over by then.
   */
  const [copied, setCopied] = useState<string | null>(null)
  const copyPrompt = useCallback(async () => {
    const text = api<{ text: string }>(`/tasks/${taskId}/prompt`).then((r) => r.text)
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })) })])
      } else {
        await navigator.clipboard.writeText(await text)
      }
      setCopied(W.copiedAsPrompt)
    } catch {
      setCopied(W.couldNotCopy)
    }
    setTimeout(() => setCopied(null), 1800)
  }, [taskId])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyP') {
        e.preventDefault()
        void copyPrompt()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [copyPrompt])

  /* The form for a new part, when the plus beside the heading opened it. */
  const [adding, setAdding] = useState(false)
  /* The search for what it waits on, when the button beside Add a sub-task
     opened it. */
  const [blocking, setBlocking] = useState(false)
  let [aside, setAsideState] = useState<'history' | 'time' | null>(readAside)
  const setAside = (to: 'history' | 'time' | null) => {
    /* The press is what the column's slide answers — not the task arriving
       with a panel already open, nor the window being resized. */
    pressed.current = true
    setAsideState(to)
    keepAside(to)
  }
  /* The history is only there for somebody who may read it, whatever this
     device remembers. */
  if (aside === 'history' && !canReadActivity) aside = null
  /* Which one was open, so the panel keeps its contents while it closes. */
  const lastAside = useRef<'history' | 'time'>('time')
  if (aside) lastAside.current = aside
  const wide = useWide()
  /* The facts as one row of chips on a phone — TRA-99. */
  const chips = usePhone()
  /* The conversation with an agent it is given to, beside the task. */
  const doors = useContext(PersonDoorsContext)
  /*
   * Whether the panel fits beside the task without moving it.
   *
   * Opening the history slid the whole task sideways to make room, on a
   * screen that had room to spare either side of an 800-wide column. Where
   * the margin takes the panel, the panel stands in the margin and the task
   * stays where it is being read; only where it does not does the task make
   * way.
   */
  const shell = useRef<HTMLDivElement | null>(null)
  const [roomy, setRoomy] = useState(false)
  /*
   * Where there is no margin, the task makes way — and slides there.
   *
   * The panel takes its room in one step and the column is moved from where
   * it was to where it now is, by its transform: the room was a widening
   * box, which uncovered the panel through a mask as it grew.
   */
  const [taken, setTaken] = useState(false)
  const column = useRef<HTMLDivElement | null>(null)
  const was = useRef<number | null>(null)
  const pressed = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the column slides when somebody takes or lets go of the task, which is what taken says
  useLayoutEffect(() => {
    const el = column.current
    if (!el) return
    const now = el.getBoundingClientRect().left
    const before = was.current
    was.current = now
    /* Only after a press on one of the round buttons. Opening a task with a
       panel remembered open settled its layout over the first frames — the
       panel measured, the margin found — and each settling slid part of the
       task across the screen as it arrived. */
    if (!pressed.current) return
    if (before === null || Math.abs(before - now) < 1) return
    el.animate([{ transform: `translateX(${before - now}px)` }, { transform: 'none' }], {
      duration: QUICK,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
    })
  }, [taken])
  /* Where it stands before anything has moved it, once it is drawn. */
  useLayoutEffect(() => {
    if (was.current === null && column.current) was.current = column.current.getBoundingClientRect().left
  })
  /* Before the first paint, so a task opened with a panel open is drawn
     with the panel where it belongs rather than moved there a frame later. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the scroller exists once the task does
  useLayoutEffect(() => {
    const el = shell.current
    if (!el) return
    const measure = () => {
      const css = getComputedStyle(el)
      const inner = el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
      setRoomy((inner - 800) / 2 >= 292 + 16)
      /* A resize moves the column too; it is not a movement to animate. */
      if (column.current) was.current = column.current.getBoundingClientRect().left
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
    // The scroller exists once the task does.
  }, [task !== null])

  /* Whether what is in the field is the person's and not the server's. The
     same guard as the document editor, for the same reason: a read landing a
     moment after the first typed word must not replace the paragraph. */
  const touched = useRef(false)
  /** The body, for the title to hand the caret down to. */
  const into = useRef<EditorHandle | null>(null)
  /* Files held anywhere over the task go into its description —
     `docs/specs/drop-files.md`. */
  const drop = useDropFiles(canWrite, (files) => into.current?.files?.(files))
  const titleField = useRef<HTMLTextAreaElement | null>(null)
  /* The title's height follows its lines: measured after every change and
     whenever the column it stands in changes width. */
  useLayoutEffect(() => {
    const el = titleField.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el.parentElement ?? el)
    return () => watch.disconnect()
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different task is a different draft
  useEffect(() => {
    touched.current = false
  }, [taskId])

  /*
   * A read that did not work has to say so.
   *
   * This screen rendered `null` until the task arrived, and if it never
   * arrived it rendered `null` for ever — a direct link to something deleted,
   * or to a project you are not on, opened a blank column with no word on it.
   * The design asks for 404 on the object rather than 403; that is the server
   * half, and this is the half somebody actually sees.
   */
  const [gone, setGone] = useState(false)
  /* The window that copies it to a project. */
  const [copying, setCopying] = useState(false)

  /*
   * How many times this task has been read, which is what the history
   * beside it follows.
   *
   * It followed `revision` — the project's socket — and a change made on
   * this screen does not move that: the patch goes out, the task reloads,
   * and the panel saying what was done to it kept showing the state before
   * it. You set the date and its own history did not mention the date.
   */
  const [beat, setBeat] = useState(0)

  /** One read of the task, on the screen. */
  const show = (r: Read) => {
    setTask(r.task)
    setSteps(r.steps)
    setPulls(r.github?.pulls ?? [])
    setIssue(r.github?.issue ?? null)
    setAsked(r.feedback ?? null)
    setComments(r.comments)
    setSpent(r.time ?? [])
    setAi(r.spend ?? [])
    if (!touched.current) setBody(r.task.body ?? null)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: show and setBody are new on every render and close over taskId, which is listed
  const load = useCallback(async () => {
    const askedAt = Date.now()
    const r = await api<Read>(`/tasks/${taskId}`)
    // Before the body is drawn, so its pictures find their links in hand.
    primeUrls(r.files, r.sizes, r.displays)
    /* The screen has gone on to another task, and this answer drawn there
       would be the last task over the next one. */
    if (showing.current !== taskId) return
    /* Older than a change made here since it was asked for: the screen
       already holds something newer, and so does the memory. */
    if (!newerThanEdit(taskId, askedAt)) return
    remember<Read>(`task:${taskId}`, { ...r, time: r.time ?? [] })
    show(r)
    setBeat((n) => n + 1)
    if (landed.current?.id === taskId) landed.current.done()
  }, [taskId])
  /*
   * What is on this screen is what is remembered — every change, as it is
   * made, not only what the server last said.
   *
   * A title fixed or a line added, then back, then the task opened again:
   * it opened on what the last read had said, before the change, and then
   * jumped to the change when the new read came back. The screen held the
   * truth and the memory held the past. Linear's answer is a local store
   * every write goes through; this is the same rule at the size of one
   * task — the remembered copy follows the screen, so reopening draws what
   * was left. `data/memory.ts` batches the writes to the disk.
   */
  useEffect(() => {
    if (!task || task.id !== taskId) return
    const had = recall<Read>(`task:${taskId}`)
    remember<Read>(`task:${taskId}`, {
      ...(had ?? {}),
      task: { ...task, body: (body ?? task.body ?? null) as Full['body'] },
      steps,
      comments,
      time: spent,
      spend: ai,
    })
  }, [task, body, steps, comments, spent, ai, taskId])

  /* And it is read from its head. The screen stays mounted from one task to
     the next — a part opened from its parent, the next task paged to — so
     the scroller kept the last one's place, and the next task opened
     somewhere down its comments. Before the paint, so it is never seen. */
  const firstTask = useRef(taskId)
  useLayoutEffect(() => {
    if (firstTask.current === taskId) return
    firstTask.current = taskId
    if (shell.current) shell.current.scrollTop = 0
  }, [taskId])

  /*
   * Drawn whole, or not yet.
   *
   * A task opened from a row the pointer never rested on — a key, a link,
   * a notification, the palette — had only the row to start from: its
   * title and facts drew at once, and its words, its parts and its
   * comments arrived with the read a round trip later and pushed everything
   * under the title down. Invisible on a laptop, where the round trip is a
   * few milliseconds, and a block popping in on the deployment, where it is
   * two hundred. So a task that is only a seed waits for its read — and its
   * history, when that panel is the one kept open — up to four hundred
   * milliseconds, and then draws whatever it has.
   */
  const landed = useRef<{ id: string; done: () => void } | null>(null)
  const historyOpen = aside === 'history'
  /* Or the press that opened it has already waited — `taskReady`. */
  const wholeNow = (id: string) =>
    (wholeRead(recall<Read>(`task:${id}`)) && (!historyOpen || recall(`history:${id}`) !== null)) || waitedFor(id)
  const [whole, setWhole] = useState(() => wholeNow(taskId))
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different task is a different wait; the panel is read as it is when the task opens
  useLayoutEffect(() => {
    if (wholeNow(taskId)) {
      setWhole(true)
      return
    }
    setWhole(false)
    let live = true
    const read = new Promise<void>((done) => {
      landed.current = { id: taskId, done }
    })
    /* The hover's read, when the pointer asked first: it lands before the
       screen's own, and the screen draws on it. */
    const early = readingTask(taskId)?.then(
      (r) => {
        if (live && showing.current === taskId && wholeRead(r)) show(r)
      },
      () => new Promise<void>(() => {}),
    )
    const history = historyOpen && recall(`history:${taskId}`) === null ? readHistory(taskId).catch(() => {}) : null
    void Promise.race([Promise.all([early ? Promise.race([read, early]) : read, history]), new Promise((r) => setTimeout(r, 400))]).then(
      () => live && setWhole(true),
    )
    return () => {
      live = false
    }
  }, [taskId])

  /* A different task is a different screen: what was remembered about this
     one, while what it really says is on its way. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: setBody is new on every render and closes over taskId, which is listed
  useEffect(() => {
    setGone(false)
    const had = recall<Read>(`task:${taskId}`)
    setTask(had?.task ?? null)
    setSteps(had?.steps ?? [])
    setPulls(had?.github?.pulls ?? [])
    setIssue(had?.github?.issue ?? null)
    setAsked(had?.feedback ?? null)
    setComments(had?.comments ?? [])
    setSpent(had?.time ?? [])
    setAi(had?.spend ?? [])
    setBody(had?.task.body ?? null)
    /* Gone only when the server says so — a 404 or a 403. Anything else (a
       restart, a 500, a dropped connection) is asked again: it said "this
       task is not here" about a task that was, whenever the server was busy
       restarting. `docs/specs/not-there.md`. */
    return untilAnswered(load, () => setGone(true))
  }, [taskId, load])

  /*
   * And again when the project says something changed.
   *
   * The list behind this screen has followed the project's socket since it
   * was written; the task's own screen did not, so a title somebody else
   * fixed, a list they moved it to or a comment they left sat there until
   * this was closed and opened again — on the one screen two people are most
   * likely to be looking at together.
   *
   * Not while the body is being written in. The editor holds what has been
   * typed and not yet saved, and a refetch under it is the one thing that
   * cannot be undone here.
   */
  useEffect(() => {
    if (revision === 0) return
    if (touched.current) return
    /* A refetch that fails keeps what is on the screen, unless the answer is
       that the task has gone. */
    void load().catch((e: unknown) => isGone(e) && setGone(true))
  }, [revision, load])

  /*
   * The title is kept as it is typed — half a second after the last key,
   * at once on leaving the field, and on leaving the task however that
   * happens.
   *
   * It was kept on blur alone, and leaving the task does not always blur
   * the field: Escape, the browser's Back, a swipe back on a phone — the
   * screen went and took the new title with it. `docs/specs/task-screen.md`.
   */
  const titleSent = useRef<string | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleWanted = useRef<string | null>(null)
  const sendTitle = () => {
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = null
    const title = titleWanted.current?.trim()
    if (!title || title === titleSent.current) return
    titleSent.current = title
    void patch({ title }, { title })
  }
  const keepTitle = (value: string, after: number) => {
    /* Typing is a change: a read that set off before it answers with the
       title before it, and must not put that back under the caret. */
    if (value.trim() !== titleSent.current) editedAt.set(taskId, Date.now())
    titleWanted.current = value
    if (titleTimer.current) clearTimeout(titleTimer.current)
    if (after === 0) sendTitle()
    else titleTimer.current = setTimeout(sendTitle, after)
  }
  /* What the title was when it arrived, so leaving an untouched field
     sends nothing. */
  useEffect(() => {
    if (task && titleSent.current === null) titleSent.current = task.title.trim()
  }, [task])
  const sendTitleRef = useRef(sendTitle)
  sendTitleRef.current = sendTitle
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different task is a different title to send
  useEffect(() => {
    titleSent.current = null
    titleWanted.current = null
    const away = () => sendTitleRef.current()
    window.addEventListener('pagehide', away)
    return () => {
      window.removeEventListener('pagehide', away)
      // The task being left: whatever is still waiting goes now.
      sendTitleRef.current()
    }
  }, [taskId])

  /* How it repeats, set from the due date's calendar — on a task, never on
     a part, which repeats with its task. */
  const repeatFieldFor = (t: Full): RepeatField | undefined =>
    !canWrite || t.parent_id || (t.ancestors ?? []).length
      ? undefined
      : {
          value: t.repeat ?? null,
          onPick: (rule, due) => {
            const sent = { repeat: rule, ...(due ? { due_on: due } : {}) }
            void patch(sent, sent)
          },
        }

  async function patch(change: Partial<Full>, sent: Record<string, unknown>) {
    editedAt.set(taskId, Date.now())
    /* What it was, for putting back. */
    const had: Partial<Full> = {}
    if (task) for (const k of Object.keys(change) as (keyof Full)[]) (had as Record<string, unknown>)[k] = task[k]
    // The screen moves first and the server catches up, the same as the list.
    setTask((t) => (t ? { ...t, ...change } : t))
    /* And the row behind it, through the list's own write: the answer
       settles that one row in place. */
    let said: Changed
    try {
      said = await behind.write(taskId, asRow(change), () =>
        api<Changed>(`/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(sent),
        }),
      )
    } catch {
      /*
       * Refused: put back what this change moved, here as the list behind
       * has already done, unless something newer has moved it since. Not
       * the body, which is in the editor under the caret — taking the words
       * back out of it is the one thing that cannot be undone here.
       */
      setTask((t) => {
        if (!t || t.id !== taskId) return t
        const out = { ...t } as Record<string, unknown>
        for (const k of Object.keys(had))
          if (k !== 'body' && out[k] === (change as Record<string, unknown>)[k]) out[k] = (had as Record<string, unknown>)[k]
        return out as Full
      })
      /* A refused title is one that was not sent, so the next keystroke
         sends it again. */
      if (change.title !== undefined && had.title !== undefined) titleSent.current = had.title.trim()
      return
    }
    /* Finished, it handed its rule to the next one; reopened, it may have
       had it back. The server's word on it. */
    if (said?.next || said?.withdrawn) {
      const rule = said.repeat !== undefined ? said.repeat : said.next ? null : undefined
      if (rule !== undefined) setTask((t) => (t ? { ...t, repeat: rule } : t))
    }
    /* Again once the server has it: a read that set off while the change
       was on its way answers with the task before it. */
    editedAt.set(taskId, Date.now())
    /* And the history beside it, which has just gained a line about this.
       Not a reread of the task — the screen already holds what it sent, and
       the only thing the server knows that it does not is what it wrote in
       the log. */
    setBeat((n) => n + 1)
  }

  /*
   * Your own reminder: the chip moves when it is pressed, and goes back if
   * the server says no. Nothing else on the screen hears of it — it is in
   * no history and nobody else's answer.
   */
  async function remindAt(at: Date | null) {
    const had = task?.my_reminder ?? null
    setTask((t) => (t ? { ...t, my_reminder: at ? { at: at.toISOString() } : null } : t))
    try {
      if (at) {
        const r = await api<{ reminder: { at: string } }>(`/tasks/${taskId}/reminder`, {
          method: 'PUT',
          body: JSON.stringify({ at: at.toISOString() }),
        })
        setTask((t) => (t ? { ...t, my_reminder: r.reminder } : t))
      } else {
        await api(`/tasks/${taskId}/reminder`, { method: 'DELETE' })
      }
    } catch {
      setTask((t) => (t ? { ...t, my_reminder: had } : t))
    }
  }

  if (gone) {
    return (
      <div className="flex h-full flex-col">
        <Toolbar>
          <Round icon="chevL" label={W.backToTasks} testId="close-task" on={false} onPress={onClose} />
        </Toolbar>
        <p className="mt-6 text-sm text-ink-2">{W.notFound}</p>
      </div>
    )
  }
  if (!task || !whole) return null

  const assigned = whoOf(task)
  /* The first agent it is given to, to talk to without leaving it. */
  /* Who a message beside the task goes to: an agent on it first, as it
     always was — it is the one asked about its work — and otherwise
     somebody else on it, so the person the task is given to is one press
     away too. Never yourself. */
  const onIt = assigned.map((id) => people.find((p) => p.actor_id === id)).filter((p) => p && p.actor_id !== meId)
  const talkTo = doors?.beside ? (onIt.find((p) => p?.agent) ?? onIt[0]) : undefined
  /* An agent at it now. */
  const working = workingAgent(task, underWay(lists.find((l) => l.id === task.list_id)?.icon), people)

  const historyBody = (roomy = false) => (
    <HistoryPanel
      roomy={roomy}
      taskId={taskId}
      revision={beat}
      onAll={onAllActivity}
      subscribed={Boolean(task.subscribed)}
      onSubscribe={async () => {
        const next = !task.subscribed
        // The screen moves first, as everything else here does.
        setTask((t) => (t ? { ...t, subscribed: next } : t))
        /* Yours alone, and on no row of the list: nothing behind hears. */
        await api(`/tasks/${taskId}/subscription`, { method: next ? 'POST' : 'DELETE' }).catch(() =>
          setTask((t) => (t ? { ...t, subscribed: !next } : t)),
        )
      }}
    />
  )
  /* How long it took. */
  const timeBody = (roomy = false) => (
    <Time
      entries={spent}
      projectId={projectId}
      taskId={taskId}
      meId={meId}
      meName={people.find((p) => p.actor_id === meId)?.name ?? ''}
      canWrite={canWrite}
      onSpent={setSpent}
      onChanged={load}
      roomy={roomy}
      ai={ai}
      onAi={setAi}
    />
  )
  const asideBody = (aside ?? lastAside.current) === 'history' ? historyBody() : <div className="flex flex-col py-1">{timeBody()}</div>

  return (
    /*
     * The words at 800, their facts beside them, and the two stood in the
     * middle together.
     *
     * A task is a column of words with its facts beside it, and across a
     * wide screen the first became a line forty words long while the second
     * sat out at the far edge; reading one meant losing the other. It was
     * held to 1200 for the pair, which let the words run to 850; 640 was
     * tried and was narrow beside the pictures a description carries. 800
     * for the words, 320 for the facts and the 32 between them is 1152.
     *
     * Here and not on the pane. The pane holds every tool that is a column
     * of words to this measure, and lets the tasks screen take the width —
     * the board needs it, and the list cannot be narrower than the board
     * without the two views of one screen moving sideways past each other.
     * An open task is a screen within that one, so it holds itself.
     *
     * The scrolling stays on the outside, so the bar is at the edge of the
     * window where every other one is, not at the edge of the text.
     */
    /* Out to the pane's edges, padded back in: the scrollbar belongs at the
       edge of the window, and inside the tool's gutter it stood a gutter
       away from it, in the middle of nothing. */
    <div className="relative flex min-h-0 flex-1 flex-col" {...drop.handlers}>
      {drop.held && <DropHere bleed said={EDITOR.dropIntoDescription} />}
      <div
        ref={shell}
        /*
        A block, with the task centred in it by its margins, so it ends with
        the `[data-foot]` every other screen's scroller ends with.

        It was a row, ended by padding as tall as a phone's tabs. A row
        stretches the task to the scroller's own height, the task's words
        overflow that, and a scroller's end padding is added after its
        children's boxes rather than after what spills out of them — so on
        a phone the padding was never reached, and the last comment and the
        line to write one stayed under the tabs.
      */
        data-foot
        className="min-h-0 flex-1 overflow-y-auto pt-4 -mx-[var(--gutter)] px-[var(--gutter)]"
      >
        <div data-task-body className="relative mx-auto flex w-full max-w-[1092px] justify-center">
          {/* The task on the left and its facts on the right. They were one
          column, with the properties as a row of chips under the title —
          which put the least-read thing on the screen directly in the path of
          the most-read one. */}
          <div ref={column} className="flex max-w-[800px] min-w-px flex-1 flex-col gap-6">
            {/*
          The way back and the task's handle, on the project's own bar.

          They were a row of their own under that bar, which was empty while
          a task was open — so the title stood a bar and a row lower than the
          list's own name did, and opening a task pushed everything down. On
          the bar they are where "Tasks" was, and the title starts where the
          list did. Across the whole width, with a light line under it:
          this is the task's head, not the first line of its column.
        */}
            <Toolbar>
              <div className="flex w-full items-center">
                <div className="flex min-w-px flex-1 items-center gap-3">
                  {/* Round, as the controls at the other end of this bar are: the
                  word "Tasks" beside it said what the tab already says. */}
                  <Round icon="chevL" label={W.backToTasks} testId="close-task" on={false} onPress={onClose} />
                  {/*
                Where this one sits: the task it is a part of, then its own
                handle. A part opened from its parent showed only its own
                number, so the way back up was the browser's back button or
                the list. The parent is a link to it.
              */}
                  <span className="flex min-w-px items-center gap-2 text-sm">
                    {(task.ancestors ?? []).map((a) => (
                      <span key={a.id} className="flex min-w-px items-center gap-2">
                        <button
                          data-testid="task-ancestor"
                          onClick={() => onOpen(a.id)}
                          title={a.title}
                          className="flex min-w-px items-center gap-2 rounded-[var(--r-row)] px-1 transition-colors mouse:hover:bg-[var(--hover)]"
                        >
                          <span className="shrink-0 font-mono text-ink-3">
                            {projectKey}-{a.number}
                          </span>
                          <span className="max-w-[240px] truncate text-ink-2">{a.title}</span>
                        </button>
                        <Icon name="chevR" size={12} className="text-ink-3" />
                      </span>
                    ))}
                    {/* The handle for this one, where somebody reading it would
                    reach to copy it. */}
                    <span data-id className="shrink-0 font-mono select-all text-ink-3">
                      {projectKey}-{task.number}
                    </span>
                  </span>
                  {/*
                The way out of a task made by mistake.
          
                `DELETE /api/tasks/:id` has always been there, soft with a restore
                window like everything else, and nothing in the product called
                it. A task could be finished or left open for ever, and a typo
                made on the board was a row somebody looked at every day.
          
                No confirmation: it is reversible on the server and asking twice
                about a reversible thing is how people learn to click through the
                asking. The list it goes back to offers it back, in the toast
                and on ⌘Z.
          
                Behind a menu, though, and not standing on the bar in red. It was
                the only coloured word on the screen and it sat at the top of the
                one surface somebody reads most often — the rarest action in the
                loudest place. A menu is where a thing goes when it must be
                reachable and must not be in the way.
              */}
                  <span className="ml-auto flex items-center gap-2">
                    {copied && (
                      <span data-copied className="text-sm text-ink-3" role="status">
                        {copied}
                      </span>
                    )}
                    {/* Yours alone, so on the bar with what is about the task for
                    you rather than in its facts, which everybody shares. */}
                    {canRemind && (
                      <RemindMe
                        round
                        value={ahead(task.my_reminder) ? task.my_reminder.at : null}
                        said={task.title}
                        onPick={(at) => void remindAt(at)}
                      />
                    )}
                    {wide ? (
                      <>
                        <Round
                          icon="clock"
                          label={SAYS.time}
                          testId="open-time"
                          on={aside === 'time'}
                          onPress={() => setAside(aside === 'time' ? null : 'time')}
                        />
                        {canReadActivity && (
                          <Round
                            icon="history"
                            label={MORE.history}
                            testId="open-history"
                            on={aside === 'history'}
                            onPress={() => setAside(aside === 'history' ? null : 'history')}
                          />
                        )}
                      </>
                    ) : (
                      /* On a phone there is no room beside the task, so each opens
                     as a sheet from the foot of the screen — the menus there
                     do the same, and the sheet is where a thumb already is. */
                      <>
                        <Popover shape="bare" testId="open-time" said={SAYS.time} label={<RoundFace icon="clock" on={false} />}>
                          {/* Below the sheet's own way out, which stands in its
                          top corner over where the first row's end would be. */}
                          {() => <div className="flex flex-col pt-8 pb-2">{timeBody(true)}</div>}
                        </Popover>
                        {canReadActivity && (
                          <Popover shape="bare" testId="open-history" said={MORE.history} label={<RoundFace icon="history" on={false} />}>
                            {() => <div className="pt-8">{historyBody(true)}</div>}
                          </Popover>
                        )}
                      </>
                    )}
                  </span>
                  {
                    <span className="flex">
                      {/* Round, as its neighbours on this bar are; and on a phone
                      a menu under it rather than a sheet — two short rows
                      under a button in the corner. */}
                      <Popover
                        shape="bare"
                        width={232}
                        align="right"
                        testId="task-menu"
                        said={W.more}
                        sheet={false}
                        label={<RoundFace icon="ellipsis" on={false} />}
                      >
                        {(close) => (
                          <div data-menu className="py-1">
                            {/* The same two the list's right-click offers, in the
                            same order and with the same glyphs. The copy is
                            opened: duplicating the task on the screen is
                            starting the next one, and the next thing done to
                            a copy is renaming it. */}
                            {!onABoard() && (
                              <button
                                data-row
                                data-testid="copy-prompt"
                                onClick={() => {
                                  close()
                                  void copyPrompt()
                                }}
                                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                                style={{ height: 'var(--row-h)' }}
                              >
                                <Icon name="prompt" size={16} className="text-ink-2" />
                                <span className="flex-1">{W.copyAsPrompt}</span>
                                <span className="text-xs text-ink-3">⌘⌥P</span>
                              </button>
                            )}
                            {/* The branch it is worked on, named so GitHub finds
                            the task by it. */}
                            <button
                              data-row
                              data-testid="copy-branch"
                              onClick={() => {
                                close()
                                const me = people.find((p) => p.actor_id === meId)?.name.split(' ')[0] ?? ''
                                void navigator.clipboard?.writeText(branchName(me, projectKey, task.number, task.title))
                              }}
                              className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                              style={{ height: 'var(--row-h)' }}
                            >
                              <Icon name="github" size={16} className="text-ink-2" />
                              {GITHUB.copyBranch}
                            </button>
                            {/* The task as a PDF, through the browser's own
                            printing — `docs/specs/export.md`. */}
                            <button
                              data-row
                              data-testid="export-pdf"
                              onClick={() => {
                                close()
                                const who = namesOf(people, whoOf(task))
                                printAsPdf({
                                  title: task.title,
                                  facts: [
                                    `${projectKey}-${task.number}`,
                                    lists.find((l) => l.id === task.list_id)?.name ?? '',
                                    task.completed_at ? W.done : '',
                                    who ? W.assignedTo(who) : '',
                                    task.due_on ? W.dueOn(dayMonthLong(new Date(`${task.due_on}T00:00:00`), true)) : '',
                                    (task.labels ?? []).map((l) => l.name).join(', '),
                                  ].filter(Boolean),
                                  body:
                                    document.querySelector('[data-testid="task-body"] .ProseMirror') ??
                                    document.querySelector('[data-testid="task-body"]'),
                                  after: [
                                    { heading: MORE.subTasks, items: steps.map((x) => ({ text: x.title, done: Boolean(x.done_at) })) },
                                    {
                                      heading: HEADS.comments,
                                      items: comments.map((c) => ({
                                        head: `${c.author_name}, ${new Date(c.created_at).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
                                        text: plain(c.body),
                                      })),
                                    },
                                  ],
                                })
                              }}
                              className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                              style={{ height: 'var(--row-h)' }}
                            >
                              <Icon name="download" size={16} className="text-ink-2" />
                              {W.exportPdf}
                            </button>
                            {canWrite && !onABoard() && (
                              <button
                                data-row
                                data-testid="duplicate-task"
                                onClick={async () => {
                                  close()
                                  const made = await api<{ id: string; tasks?: Row[] }>(`/tasks/${taskId}/duplicate`, {
                                    method: 'POST',
                                  }).catch(() => null)
                                  if (!made) return
                                  /* The copy and its parts join the list behind
                                 from the answer, and the screen goes to it. */
                                  behind.lay(made.tasks ?? [])
                                  onOpen(made.id)
                                }}
                                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                                style={{ height: 'var(--row-h)' }}
                              >
                                <Icon name="copy" size={16} className="text-ink-2" />
                                {MORE.duplicateTask}
                              </button>
                            )}
                            {/* Into any project this person makes tasks in;
                            the window lists them. Not a part: it is copied
                            with its task. */}
                            {!task.ancestors?.length && !onABoard() && (
                              <button
                                data-row
                                data-testid="copy-task"
                                onClick={() => {
                                  close()
                                  setCopying(true)
                                }}
                                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                                style={{ height: 'var(--row-h)' }}
                              >
                                <Icon name="folder" size={16} className="text-ink-2" />
                                {W.copyToProject}
                              </button>
                            )}
                            {(canDelete || task.author_id === meId) && (
                              <button
                                data-row
                                data-testid="delete-task"
                                onClick={async () => {
                                  close()
                                  /* The list behind deletes it, and offers it
                                     back. */
                                  if (onDelete) {
                                    onClose()
                                    onDelete(taskId, task.title)
                                    return
                                  }
                                  /* Off the screen and out of the list behind at
                               once, its parts with it; put back if the server
                               refuses. One of a series skipped makes the next,
                               which the answer carries. */
                                  const putBack = behind.takeOff(taskId)
                                  onClose()
                                  void api<Changed>(`/tasks/${taskId}`, { method: 'DELETE' }).then(
                                    (said) => behind.settle(taskId, { next: said?.next ?? null, next_parts: said?.next_parts ?? [] }),
                                    putBack,
                                  )
                                }}
                                className="flex w-full items-center gap-3 px-3 text-left text-base text-danger"
                                style={{ height: 'var(--row-h)' }}
                              >
                                <Icon name="trash" size={16} />
                                {MORE.deleteTask}
                              </button>
                            )}
                          </div>
                        )}
                      </Popover>
                    </span>
                  }
                </div>
              </div>
            </Toolbar>

            {/*
          The title and what it is about, as one block.

          They were two items of the column, 24 apart, with a ground that
          came up under each on the pointer — and a ground needs room round
          the words to stand in, so the body had twelve more above it. With
          the grounds gone the room is too, and the description reads as the
          paragraph after its heading rather than the next section.
        */}
            <div className="flex shrink-0 flex-col gap-2">
              {/*
            As many lines as the title takes.

            It was an input, one line however long the title, so on a phone
            the end of most titles was cut off at the screen's edge with no
            way to read it but to put the caret in and walk along. A text
            area of one row that grows with what is in it; Enter still goes
            into the body rather than starting a second line, and a pasted
            line break becomes a space — a title is one sentence.
          */}
              <textarea
                ref={titleField}
                rows={1}
                data-testid="task-title"
                /* Down from the title, or Enter at the end of it, is into the
               body — the way every editor with a title over its text has it.
               Not while a word is still being composed: Enter there accepts
               the composition. */
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    // Leaving the title saves it, as any blur does.
                    into.current?.enter()
                  }
                }}
                className="block w-full resize-none overflow-hidden bg-transparent text-xl leading-[1.3] font-medium outline-none text-ink"
                style={{
                  letterSpacing: 'var(--track-title)',
                }}
                value={task.title}
                disabled={!canWrite}
                onChange={(e) => {
                  const next = e.target.value.replace(/\s*\n\s*/g, ' ')
                  setTask({ ...task, title: next })
                  keepTitle(next, 500)
                }}
                // From the field, not from state: the handler closes over the
                // render it was made in, and leaving the field before React has
                // caught up sends the title as it was before it was typed.
                onBlur={(e) => keepTitle(e.target.value, 0)}
              />

              {/* Waiting in Triage: yes, no, or "we have that already".
              Each is a move through the same door
              a drag uses. */}
              {/* Not on a part: it lives in its parent's list, and is accepted
              with it. */}
              {canWrite && !(task.ancestors ?? []).length && lists.find((l) => l.id === task.list_id)?.intake && (
                <Triage
                  lists={lists}
                  projectId={projectId}
                  projectKey={projectKey}
                  taskId={taskId}
                  number={task.number}
                  start={triageStart ?? null}
                  onMove={(into) => {
                    const l = lists.find((x) => x.id === into)
                    return patch({ list_id: into, completed_at: l?.finishes ? new Date().toISOString() : null }, { list_id: into })
                  }}
                />
              )}
              {/*
            What somebody acts on, under the title it is about.

            It was a column of facts down the right, with the history and the
            hours under it — a second column on every task, and the eye went
            across the screen and back for each answer. These five are the
            ones a task is triaged by, so they stand where the reading starts,
            two to a row; when it starts is gone from here, and the history
            and the hours open beside the task when they are wanted.
          */}
              {/*
            On a phone, a row of chips rather than a table.

            Five lines of label and value stood between the title and what
            the task says — half a phone's screen before the description.
            Linear puts them in one wrapping row, each chip its control and
            its value, an empty one saying what it would hold. TRA-99,
            `docs/specs/task-screen.md`.
          */}
              <div
                data-task-facts
                data-chips={chips || undefined}
                className={chips ? 'flex flex-wrap gap-2 py-1' : 'grid grid-cols-1 gap-x-8 py-1 sm:grid-cols-2'}
              >
                <Fact chip={chips} icon="statusDoing" label={MORE.status}>
                  {/* The same ring and the same menu the list row has. */}
                  <Status
                    lists={lists}
                    value={task.list_id}
                    said={task.title}
                    disabled={!canWrite}
                    onPick={(into) => {
                      const l = lists.find((x) => x.id === into)
                      void patch(
                        {
                          list_id: into,
                          completed_at: l?.finishes ? (task.completed_at ?? new Date().toISOString()) : null,
                        },
                        { list_id: into },
                      )
                    }}
                  />
                  <span className="truncate">{lists.find((l) => l.id === task.list_id)?.name ?? W.noList}</span>
                </Fact>
                {/* Everybody it is given to: pressing a person puts them on or
                takes them off, and Nobody takes everybody off.
                The menu every row has. */}
                <Fact
                  chip={chips}
                  icon="person"
                  label={MORE.assigned}
                  testId="task-assignees"
                  after={
                    talkTo && (
                      <button
                        type="button"
                        data-testid="talk-beside"
                        aria-label={CHAT.messageWho(talkTo.name)}
                        title={CHAT.messageWho(talkTo.name)}
                        onClick={() => doors?.beside?.open(talkTo.actor_id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-[color,background-color,transform] bg-track active:scale-[0.94] mouse:hover:bg-[var(--hover)] mouse:hover:text-ink"
                      >
                        <Icon name="bubble" size={16} />
                      </button>
                    )
                  }
                >
                  <WhoPick
                    people={people}
                    value={assigned}
                    said={task.title}
                    size={20}
                    disabled={!canWrite}
                    task={task.id}
                    working={working?.name ?? null}
                    onPick={(to) => void patch({ assignee_ids: to }, { assignee_ids: to, assignee_id: to[0] ?? null })}
                  />
                  {/* What an agent says it is doing on it, in the same line,
                      while it lasts. */}
                  <AgentDoing
                    taskId={task.id}
                    people={people}
                    named
                    otherwise={
                      <span className="truncate" style={{ color: assigned.length ? 'var(--ink)' : 'var(--ink-3)' }}>
                        {/* Said in words beside the turning ring, while it lasts. */}
                        {working ? W.agentWorking(working.name) : namesOf(people, assigned) || (chips ? MORE.assigned : W.noOne)}
                      </span>
                    }
                  />
                </Fact>
                <Fact chip={chips} snug={(task.labels ?? []).length === 1} icon="tag" label={FACTS.labels}>
                  <LabelPick
                    all={allLabels}
                    value={task.labels ?? []}
                    said={task.title}
                    disabled={!canWrite}
                    /* As a chip: one label is itself, more are a count, none is
                   the word — a chip three labels wide is a row of its own. */
                    {...(chips
                      ? {
                          face:
                            (task.labels ?? []).length === 1 ? (
                              <LabelChip label={task.labels![0]!} size={14} />
                            ) : (
                              <span
                                className="flex items-center gap-2"
                                style={{ color: (task.labels ?? []).length ? 'var(--ink)' : 'var(--ink-3)' }}
                              >
                                <Icon name="tag" size={14} />
                                {(task.labels ?? []).length ? W.nLabels(task.labels!.length) : FACTS.labels}
                              </span>
                            ),
                        }
                      : {})}
                    onMake={onMakeLabel}
                    onPick={(next) => void patch({ labels: next }, { labels: next.map((l) => l.id) })}
                  />
                </Fact>
                <Fact chip={chips} icon="flag" label={FACTS.priority}>
                  <PriorityPick
                    value={task.priority}
                    said={task.title}
                    disabled={!canWrite}
                    onPick={(to) => void patch({ priority: to }, { priority: to })}
                  />
                  <span style={{ color: task.priority ? 'var(--ink)' : 'var(--ink-3)' }}>
                    {task.priority ? PRIORITY_SAID[task.priority] : chips ? FACTS.priority : W.noPriority}
                  </span>
                </Fact>
                <Fact chip={chips} lead icon="cal" label={FACTS.due}>
                  <DateButton
                    testId="task-due"
                    said={W.dueDateOf(task.title)}
                    {...(chips ? { empty: FACTS.due } : {})}
                    value={task.due_on ?? null}
                    disabled={!canWrite}
                    onPick={(to) => void patch({ due_on: to }, { due_on: to })}
                    {...(repeatFieldFor(task) ? { repeat: repeatFieldFor(task)! } : {})}
                  >
                    {/* How it repeats, beside the date it repeats from, in one
                        row — a row of its own said the date's rule twice over,
                        under a loop that looked like the sprint's. */}
                    {task.repeat && task.due_on ? (
                      <span data-testid="task-repeat" className="flex min-w-0 items-center gap-2">
                        <span>{writtenDay(task.due_on)}</span>
                        <span className="flex min-w-0 text-ink-3">
                          <RepeatMark rule={task.repeat} />
                        </span>
                      </span>
                    ) : undefined}
                  </DateButton>
                </Fact>
                {/* Only where there are sprints to pick — a project that does not
                use them should not grow a row of None. */}
                {cycles.length > 0 && (
                  <Fact chip={chips} lead icon="cycle" label={FACTS.cycle} testId="task-cycle">
                    <CyclePick
                      cycles={cycles}
                      value={task.cycle_id ?? null}
                      said={task.title}
                      disabled={!canWrite}
                      onPick={(to) => void patch({ cycle_id: to }, { cycle_id: to })}
                      face={
                        <span className="truncate" style={{ color: task.cycle_id ? 'var(--ink)' : 'var(--ink-3)' }}>
                          {cycles.find((y) => y.id === task.cycle_id)?.name ?? (chips ? FACTS.cycle : HEADS.none)}
                        </span>
                      }
                    />
                  </Fact>
                )}
              </div>

              {/*
            A document, written in as one.
          
            It was a textarea that wrote `asDoc(text)` — one paragraph, one text
            node — into a column that has held a document since the first
            migration. `docs/specs/rich-text.md`.
          */}
              <div className="shrink-0">
                {/* At 15, a step up from the 14 of everything around it: on a
                task's own screen the description is what is being read, and
                it was set like a caption under its title. 17 was tried and
                was too large beside the 14 of the properties next to it. */}
                {/* And a shade under the title's ink, so the title leads and the
                description reads as what follows it. */}
                {/* One editor per task: what is typed, uploading or open in its
                menus belongs to the task it was opened on, and none of it can
                be carried to the next one and saved there. */}
                <Editor
                  key={taskId}
                  testId="task-body"
                  handle={into}
                  onUp={() => {
                    // Back to the title, the caret at the end of what it says.
                    const f = titleField.current
                    if (!f) return
                    f.focus()
                    f.setSelectionRange(f.value.length, f.value.length)
                  }}
                  size={15}
                  tone="color-mix(in oklch, var(--ink) 72%, var(--ink-2))"
                  value={body}
                  projectId={projectId}
                  people={people}
                  editable={canWrite}
                  placeholder={MAKE.whatIsThisAbout}
                  onChange={(next) => {
                    editedAt.set(taskId, Date.now())
                    touched.current = true
                    setBody(next)
                  }}
                  onSettle={(next) => {
                    touched.current = false
                    void patch({ body: next as Full['body'] }, { body: next })
                  }}
                />
              </div>
            </div>

            {/*
          Sub-tasks, and the word the spec has always used.
          
          The screen said "Parts" while the subtasks spec said subtasks
          from its title down — the one place the product disagreed with
          itself about what these are. They are tasks inside a task; that is
          what they are called.
        */}
            {/* Not on a part: a part cannot have parts — the database refuses
            it — so offering to add one was a button that could only fail. */}
            {(task.ancestors?.length ?? 0) === 0 && !onABoard() && (
              <section className="flex shrink-0 flex-col gap-3">
                {/* With parts already, the way to add one more is beside the
              heading that names them, not a second button under the list. */}
                {steps.length > 0 && (
                  <div className="flex items-center justify-between">
                    <SectionHead>{MORE.subTasks}</SectionHead>
                    {canWrite && (
                      <Round icon="plusThin" label={MORE.addSubTask} testId="add-subtask" on={adding} onPress={() => setAdding(!adding)} />
                    )}
                  </div>
                )}
                {steps.length > 0 && (
                  <Panel>
                    {steps.map((s, i) => (
                      <div key={s.id} className="contents">
                        {i > 0 && <Hairline />}
                        <div data-step className="group flex items-center gap-3 px-4 py-3">
                          <button
                            role="checkbox"
                            aria-checked={Boolean(s.done_at)}
                            aria-label={s.title}
                            disabled={!canWrite}
                            className="flex size-5 shrink-0 items-center justify-center"
                            onClick={async () => {
                              const at = s.done_at ? null : new Date().toISOString()
                              const mark = (to: string | null) =>
                                setSteps((prev) => prev.map((x) => (x.id === s.id ? { ...x, done_at: to } : x)))
                              mark(at)
                              /* It is a row in the list, and the count on its
                             parent: moved there too, settled by the answer,
                             and both put back if the server refuses. */
                              await behind
                                .write(s.id, { completed_at: at }, () =>
                                  api<Changed>(`/steps/${s.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ done: Boolean(at) }),
                                  }),
                                )
                                .catch(() => mark(s.done_at))
                            }}
                          >
                            <Dot icon={s.icon} color={s.color} />
                          </button>
                          {/* It has an address of its own now, so it opens. A part
                      that can be ticked and not read is a task hiding as a
                      checkbox. */}
                          <button
                            data-open-part
                            onClick={() => onOpen(s.id)}
                            /* Quieter, never struck out — the same as a task in the
                       list, because it is one. */
                            className="min-w-px flex-1 truncate text-left text-base"
                            style={{ color: s.done_at ? 'var(--ink-3)' : 'var(--ink)' }}
                          >
                            {s.title}
                          </button>
                          {s.due_on && (
                            <span className="shrink-0 text-base tabular-nums text-ink-3">
                              {s.due_on.slice(8, 10)}.{s.due_on.slice(5, 7)}
                            </span>
                          )}
                          {whoOf(s).map((id) => (
                            <Avatar
                              key={id}
                              id={id}
                              name={people.find((x) => x.actor_id === id)?.name ?? '?'}
                              url={people.find((x) => x.actor_id === id)?.avatar_url}
                              size={20}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </Panel>
                )}
                {/* Nothing under the description yet: the two things to add
                    there sit side by side, one row, not one above the other. */}
                {canWrite && steps.length === 0 && (!adding || ((task.blocked_by ?? []).length === 0 && !blocking)) && (
                  <div className="flex flex-wrap gap-2">
                    {!adding && (
                      <button
                        type="button"
                        data-testid="add-subtask"
                        onClick={() => setAdding(true)}
                        className="flex h-8 items-center gap-2 rounded-[var(--r-row)] bg-[var(--track)] pr-3 pl-2 text-base transition-colors mouse:hover:bg-[var(--badge)] text-ink-2"
                      >
                        <Icon name="plusThin" size={16} />
                        {MORE.addSubTask}
                      </button>
                    )}
                    {(task.blocked_by ?? []).length === 0 && !blocking && (
                      <button
                        type="button"
                        data-testid="add-blocker"
                        onClick={() => setBlocking(true)}
                        className="flex h-8 items-center gap-2 rounded-[var(--r-row)] bg-[var(--track)] pr-3 pl-2 text-base transition-colors mouse:hover:bg-[var(--badge)] text-ink-2"
                      >
                        <Icon name="wait" size={16} />
                        {W.addBlocker}
                      </button>
                    )}
                  </div>
                )}
                {canWrite && (
                  <NewSubtask
                    open={adding}
                    onOpen={setAdding}
                    bare
                    lists={lists}
                    people={people}
                    allLabels={allLabels}
                    onMakeLabel={onMakeLabel}
                    onMake={async (made) => {
                      const r = await api<{ id: string; task?: Row }>(`/tasks/${taskId}/steps`, {
                        method: 'POST',
                        body: JSON.stringify(made),
                      })
                      /* The list behind this screen too. A part used to be a
                   checklist row that existed nowhere else; it is a task now,
                   so a list that does not hear about it is a list missing a
                   row. Put in from the answer, not by reading the project
                   again; this screen reads only itself. */
                      if (r.task) behind.lay([r.task])
                      await load()
                    }}
                  />
                )}
              </section>
            )}

            {/* What it waits on and what waits on it. */}
            {!onABoard() && (
              <Blockers
                taskId={taskId}
                blockedBy={task.blocked_by ?? []}
                blocks={task.blocks ?? []}
                canWrite={canWrite}
                {...(canWrite && steps.length === 0 && (task.ancestors?.length ?? 0) === 0
                  ? { adding: blocking, onAdding: setBlocking, bare: true }
                  : {})}
                keyOf={(id) =>
                  id === projectId
                    ? projectKey
                    : (recall<{ projects?: { id: string; key?: string | null }[] }>('shell')?.projects?.find((p) => p.id === id)?.key ??
                      null)
                }
                onChange={(next) => {
                  editedAt.set(taskId, Date.now())
                  setTask((t) => (t && t.id === taskId ? { ...t, blocked_by: next } : t))
                  /* The row's mark, worked out from the same list the server
                     keeps it from: the open ones, by handle, oldest first. */
                  behind.settle(taskId, null, {
                    waiting_on: next.filter((b) => !b.completed_at && b.project_key).map((b) => `${b.project_key}-${b.number}`),
                  })
                }}
              />
            )}

            {/* Who asked for it on the feedback page — the address only for
            whoever may change the task. */}
            {asked && (
              <p data-testid="task-asked" className="px-1 text-sm text-ink-3" style={{ overflowWrap: 'anywhere' }}>
                {asked.email ? FEEDBACK.askedBy(asked.email) : FEEDBACK.asked}
              </p>
            )}

            {/* What GitHub says about it, above what people say about it. */}
            <PullsOnTask pulls={pulls} issue={issue} />

            <Discussion
              title={HEADS.comments}
              comments={comments}
              meId={meId}
              canWrite={canWrite}
              canEditAny={canEditAny}
              projectId={projectId}
              post={`/tasks/${taskId}/comments`}
              onChanged={load}
              people={people}
            />
          </div>

          {wide && (
            <Aside open={aside !== null} floating={roomy} onRoom={setTaken}>
              {asideBody}
            </Aside>
          )}
        </div>
      </div>
      {copying && (
        <CopyTaskDialog
          taskId={taskId}
          handle={`${projectKey}-${task.number}`}
          projectId={projectId}
          onClose={() => setCopying(false)}
          onCopied={(to) => {
            setCopying(false)
            /* To the copy — the next thing done to one is changing it — and
             back returns to the original, which is where it still is. */
            /* Copied into this project, it is a row of the list behind. */
            if (to.projectId === projectId && to.tasks) behind.lay(to.tasks as Row[])
            goTo({ view: 'projects', projectId: to.projectId, tool: 'tasks', objectId: to.id })
          }}
        />
      )}
    </div>
  )
}
