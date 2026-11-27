import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Art } from './illustrations/Art.jsx'
import { BAR, HEADS, MORE, PLACES, SAYS } from '../data/words.js'
import { TOOLS } from '../words/tools.js'
import { PALETTE as W } from '../words/palette.js'
import { INSTANCE } from '../words/instance.js'
import { AGENTS } from '../words/agents.js'
import { edition } from '../edition.jsx'
import { api } from '../data/api.js'
import { numbered } from '../data/route.js'
import { isKey } from '../data/keys.js'
import { recall, remember } from '../data/memory.js'
import { Avatar, DocMark, Hairline, Kbd, Panel, Scrim, notALogin } from './kit.jsx'
import { Icon, type IconName } from './glyphs.jsx'
import { ProjectMark, markOf } from './icons.jsx'

type Project = {
  id: string
  name: string
  /** What a sentence calls it: `STU`, for `STU-41`. */
  key: string
  icon_url?: string | null | undefined
  mark_icon?: string | null | undefined
  mark_tint?: number | null | undefined
}
const KINDS = ['task', 'post', 'file', 'message'] as const
/* Each kind by the name of the tool it lives in, and that tool's glyph. */
const KIND_SAID: Record<string, string> = { task: TOOLS.tasks, post: TOOLS.posts, file: TOOLS.files, message: W.chat }
const KIND_ICON: Record<string, IconName> = { task: 'tasks', post: 'megaphone', file: 'doc', message: 'bubble' }

type Hit =
  | {
      type: 'post' | 'task' | 'file'
      id: string
      /** What the address calls it in its project. */
      number: number
      project_id: string
      title: string
      /** Where the words were found inside rather than in the title: a piece of
          the sentence around them — `docs/specs/palette.md`. */
      snippet?: string | null
      /** What a document wears — `docs/specs/docs.md`, "A document's mark". */
      mark_icon?: string | null
      mark_tint?: number | null
    }
  | {
      /** Said in chat: the room, the thread it
          is a reply in, who said it, and the line with the words. */
      type: 'message'
      id: string
      conversation_id: string
      parent_id: string | null
      author_name: string | null
      snippet: string | null
    }

/** What a screen is called where a person reads it. */
function screenName(v: string): string {
  const said: Record<string, string> = {
    my: PLACES.myTasks,
    'projects-all': HEADS.projects,
    notifications: HEADS.notifications,
    members: PLACES.members,
    settings: W.workspaceSettings,
    account: W.accountSettings,
    ...(edition.admin ? { admin: edition.admin.label } : {}),
    instance: INSTANCE.title,
  }
  return said[v] ?? v[0]!.toUpperCase() + v.slice(1)
}

/* What a group is called where a person reads it. The rows carry the
   English name, which `data-hit` and `data-recent` are read from. */
const GROUP_SAID: Record<string, string> = {
  Recent: W.recent,
  Projects: HEADS.projects,
  People: SAYS.people,
  Chat: W.chat,
  'Go to': W.goTo,
  Results: W.results,
  Create: W.create,
  'This task': W.thisTask,
}

/* And the glyph the column and the bar draw beside it. */
const SCREEN_ICON: Record<string, IconName> = {
  my: 'tasks',
  'projects-all': 'folder',
  notifications: 'bell',
  members: 'people',
  settings: 'gear',
  account: 'person',
  admin: 'globe',
  instance: 'sliders',
}

export type Destination =
  | { kind: 'view'; view: string }
  | { kind: 'project'; id: string }
  | { kind: 'object'; projectId: string; type: string; id: string }
  | { kind: 'create'; projectId: string; title: string }
  /* The open task waits on another. */
  | { kind: 'block'; taskId: string; blockerId: string }
  | { kind: 'person'; id: string }
  | { kind: 'room'; id: string; message?: { id: string; thread: string | null } }
  /* The window that connects an agent, over People & Agents — `docs/specs/palette.md`. */
  | { kind: 'connect' }
  /* A door a workspace's own domain keeps shut, opened at usetuff.com in a
     new tab. */
  | { kind: 'away'; url: string }

/*
 * What "Connect an agent" is found by besides its own words: what somebody
 * looking for it is likely to type — the thing, the tools it is, and the
 * protocol it speaks. In both languages, whichever the screen is in.
 */
const CONNECT_FOUND_BY = ['agent', 'connect', 'ai', 'ia', 'claude', 'codex', 'cursor', 'mcp', 'connecter', 'bot', 'llm']

/** A question asked before, asked again — kept here, never a place to go. */
type Asked = { kind: 'query'; q: string }

type Row = {
  key: string
  label: string
  hint: string
  group: string
  go: Destination | Asked
  /** A person's face before their name. */
  face?: { id: string; name: string; url?: string | null | undefined }
  /** A project's own mark before its name. */
  mark?: Project
  /** A document's chosen mark — `docs/specs/docs.md`, "A document's mark". */
  doc?: { icon: string | null; tint: number | null }
  /** Or a glyph. */
  icon?: IconName
  /** What sort of thing it is, said where it is not obvious — recent rows. */
  badge?: string
  /** How many are waiting behind it — the notifications. */
  count?: number
  /** A task's handle, `TRA-111`, before its title. */
  code?: string
}

/*
 * What was opened from here lately, and what was asked — kept with the
 * rest of what this person's window remembers (`data/memory.ts`), so the
 * palette opens on the places somebody actually goes rather than on an
 * alphabet. Five places and three questions: a list of recents longer
 * than a glance is a second search.
 */
type Kept = Omit<Row, 'group' | 'go' | 'count'> & { go: Destination }
const RECENT = 'palette-recent'
const ASKED = 'palette-asked'

function badgeOf(go: Destination): string {
  if (go.kind === 'project') return W.project
  if (go.kind === 'person') return W.person
  if (go.kind === 'room') return W.room
  if (go.kind === 'view') return W.screen
  if (go.kind === 'object') return go.type === 'task' ? W.task : go.type === 'post' ? W.post : W.doc
  return ''
}

/** A key, drawn as one, for the line of keys under the list. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="flex h-5 min-w-5 items-center justify-center rounded-[var(--r-tile)] px-1 font-sans text-badge bg-sunken text-ink-2">
      {children}
    </kbd>
  )
}

/** What stands before a row's words: a face, a project's mark, or a glyph. */
function Lead({ row, size }: { row: Row; size: number }) {
  if (row.face) return <Avatar name={row.face.name} id={row.face.id} url={row.face.url ?? null} size={size} />
  if (row.mark) return <ProjectMark {...markOf(row.mark)} size={size} />
  if (row.doc) return <DocMark icon={row.doc.icon} tint={row.doc.tint} size={size} />
  return (
    <span className="flex shrink-0 items-center justify-center text-ink-3" style={{ width: size, height: size }}>
      <Icon name={row.icon ?? 'search'} size={16} />
    </span>
  )
}

/** What stands after them: how many are waiting, what sort it is, or where. */
function Tail({ row }: { row: Row }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      {row.hint && <span className="max-w-48 truncate text-xs text-ink-3">{row.hint}</span>}
      {row.badge && <span className="flex h-5 items-center rounded-full px-2 text-badge font-medium bg-track text-ink-3">{row.badge}</span>}
      {row.count ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-badge font-semibold tabular-nums bg-track text-ink-2">
          {row.count}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Everything the keyboard reaches.
 *
 * The design asks for the keyboard to cover the product: jump between
 * projects, open any screen, find anything. One surface does all three, so
 * there is one thing to learn rather than three shortcuts to remember.
 *
 * Projects and screens are answered from memory and appear on the keystroke.
 * Search goes to the server, and its results land underneath when they
 * arrive — the list never waits for the network before showing what it
 * already knows.
 */
export function Palette({
  projects,
  people = [],
  views,
  inProject,
  openTask = null,
  canWrite,
  onGo,
  open,
  onOpenChange,
  startQ = '',
  page = false,
  onQuery,
  rooms = [],
  counts = {},
  mayConnect = false,
  away = [],
}: {
  projects: Project[]
  /**
   * The rooms this person is in, found by their names as the column lists
   * them — a direct conversation by the other person's. Somebody no longer
   * in the workspace is not among its people, and their conversation still
   * has to be findable.
   */
  rooms?: { id: string; name: string; direct: boolean; face?: { id: string; name: string; url?: string | null } }[]
  /** What is waiting behind a screen — the notifications' count, by view. */
  counts?: Record<string, number>
  /** Everybody in the workspace, found by name or what they do. */
  people?: {
    actor_id: string
    name: string
    title?: string | null | undefined
    role?: string | null | undefined
    avatar_url?: string | null | undefined
  }[]
  views: string[]
  /** The project a new task would land in: the one being looked at. */
  inProject: Project | null
  /** The task open beneath, which `blocked by RED-12` is about. */
  openTask?: string | null
  canWrite: boolean
  onGo: (to: Destination) => void
  /**
   * Held outside, because `/search?q=` opens this and closing it has to put
   * the address back. The keystroke still works from in here; it just asks
   * rather than decides.
   */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What a shared search link was asking for. */
  startQ?: string
  /**
   * Drawn as a page rather than a box over the work: a phone's Search tab.
   * The same field, filters and answers, so it is one
   * search in two layouts rather than a second place to type.
   */
  page?: boolean
  /** What is typed, as it is typed — a page keeps it in its address. */
  onQuery?: (q: string) => void
  /** Whether this person may connect an agent — `agent.connect` in `/api/me`. */
  mayConnect?: boolean
  /** The screens a workspace's own domain keeps shut, at usetuff.com —
      offered where the sidebar offers them, as links that leave. */
  away?: { key: string; label: string; url: string; icon: IconName }[]
}) {
  const [q, setQ] = useState(startQ)
  /*
   * Which kinds, and which project.
   *
   * These were a separate screen. It answered "show me everything that
   * mentions this" while the palette answered "take me to the thing I am
   * thinking of" — two questions, one word, and two places to type it. The
   * filters belong to the question, not to the screen, so they came here and
   * the screen went.
   */
  const [kinds, setKinds] = useState<string[]>([])
  const [scope, setScope] = useState('')
  /*
   * Narrowing what was said, while Chat is the one kind chosen.
   */
  const [from, setFrom] = useState('')
  const [hasLink, setHasLink] = useState(false)
  const [hasFile, setHasFile] = useState(false)
  const [inThreads, setInThreads] = useState(false)
  const [oldest, setOldest] = useState(false)
  const chatOnly = kinds.length === 1 && kinds[0] === 'message'
  const narrowedChat = chatOnly && (Boolean(from) || hasLink || hasFile || inThreads)
  const [hits, setHits] = useState<Hit[]>([])
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = 'palette-list'

  const setOpen = onOpenChange

  useEffect(() => {
    // A page is a screen, not something a key opens and shuts.
    if (page) return
    const onKey = (e: KeyboardEvent) => {
      if (isKey(e, 'k') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
      /*
       * Escape here and not only on the field.
       *
       * It used to hang off the input's own key handler, which was true
       * enough while the input was the only thing in here. With filters to
       * press, the focus is routinely on a button — and Escape did nothing,
       * which is the one key everybody presses to get out of a modal.
       */
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange, page])

  /* A page writes what is typed into its own address, which comes back as
     `startQ`; starting over on that would wipe the filters every keystroke.
     So a page starts over only when it is opened. */
  const fresh = page ? '' : startQ
  // biome-ignore lint/correctness/useExhaustiveDependencies: the question it opens with is taken when it opens, not again while somebody types
  useEffect(() => {
    if (!open) return
    setQ(startQ)
    setHits([])
    setKinds([])
    setScope('')
    setFrom('')
    setHasLink(false)
    setHasFile(false)
    setInThreads(false)
    setOldest(false)
    setAt(0)
    /* Not when a page comes back holding a question: the keyboard would
       cover the answers that were the reason for coming back. */
    if (!page || !startQ) input.current?.focus()
  }, [open, fresh])

  /**
   * Results as the query is typed.
   *
   * One question in the air at a time, and the newest one next: a key
   * pressed while an answer is on its way waits for it, and only the last
   * of the keys pressed meanwhile is asked. Every keystroke asked, so a
   * word typed quickly was eight searches of everything at once, from
   * everybody typing. The answer is kept only if nothing newer has been
   * asked since — without the sequence number a slow response for "ta"
   * lands after a fast one for "task" and the list goes backwards.
   */
  const seq = useRef(0)
  const asking = useRef(false)
  const after = useRef<(() => void) | null>(null)
  /* `blocked by RED-12` with a task open asks the search for the handle
     alone, and offers the open task's wait above what it finds.
     Only at the start, so a sentence with the
     words in it is still searched as it is. */
  const blocking = openTask ? (/^blocked\s+by\s+(\S.*)$/i.exec(q.trim())?.[1]?.trim() ?? null) : null
  useEffect(() => {
    const term = blocking ?? q.trim()
    /* Narrowed, words may be left out: "files from Lee" has none. */
    if (term.length < 2 && !narrowedChat) {
      after.current = null
      /* Newer than any answer still on its way, so one asked a moment ago
         does not land on the emptied list and fill it again. */
      ++seq.current
      setHits([])
      return
    }
    const mine = ++seq.current
    const params = new URLSearchParams({ q: term })
    /* All four named: without a type the server answers the three an app
       from before can open. */
    params.set('type', (kinds.length ? kinds : KINDS).join(','))
    if (scope) params.set('project', scope)
    if (chatOnly) {
      if (from) params.set('from', from)
      const has = [...(hasLink ? ['link'] : []), ...(hasFile ? ['file'] : [])]
      if (has.length) params.set('has', has.join(','))
      if (inThreads) params.set('in', 'thread')
      if (oldest) params.set('sort', 'oldest')
    }
    const ask = () => {
      asking.current = true
      void api<{ results: Hit[] }>(`/search?${params}`)
        .then((r) => {
          // So a result opens at an address somebody could have typed.
          numbered(r.results.filter((h) => h.type !== 'message'))
          if (mine === seq.current) setHits(r.results)
        })
        .catch(() => {
          if (mine === seq.current) setHits([])
        })
        .finally(() => {
          asking.current = false
          const next = after.current
          after.current = null
          next?.()
        })
    }
    if (asking.current) after.current = ask
    else ask()
  }, [q, kinds, scope, blocking, chatOnly, narrowedChat, from, hasLink, hasFile, inThreads, oldest])

  /* What was opened and asked lately — read when it opens, written when a
     row is run. */
  const [recent, setRecent] = useState<Kept[]>(() => recall<Kept[]>(RECENT) ?? [])
  const [asked, setAsked] = useState<string[]>(() => recall<string[]>(ASKED) ?? [])
  useEffect(() => {
    if (!open) return
    setRecent(recall<Kept[]>(RECENT) ?? [])
    setAsked(recall<string[]>(ASKED) ?? [])
  }, [open])

  const rows = useMemo<Row[]>(() => {
    const term = q.trim().toLowerCase()
    const matches = (s: string) => !term || s.toLowerCase().includes(term)
    const named = new Map(projects.map((p) => [p.id, p.name]))
    const keyOf = new Map(projects.map((p) => [p.id, p.key]))
    const known = new Set(projects.map((p) => p.id))
    /* Narrowed with nothing typed: the messages found, and nothing else. */
    const onlyHits = narrowedChat && !term

    /* A handle as typed — `red-12`, `RED12` — against one found. */
    const sameHandle = (typed: string, key: string, number: number | null | undefined) =>
      typed.replace(/[\s-]/g, '').toLowerCase() === `${key}${number ?? ''}`.toLowerCase()
    const waitsOn =
      blocking && openTask
        ? hits
            .flatMap((h) => (h.type === 'task' ? [h] : []))
            .filter((h) => h.id !== openTask && sameHandle(blocking, keyOf.get(h.project_id) ?? '', h.number))
            .slice(0, 1)
            .map<Row>((h) => ({
              key: `block:${h.id}`,
              label: W.blockedBy(`${keyOf.get(h.project_id)}-${h.number}`),
              hint: h.title,
              group: 'This task',
              icon: 'wait',
              go: { kind: 'block', taskId: openTask, blockerId: h.id },
            }))
        : []

    return [
      ...waitsOn,
      /* With nothing typed, what was asked and opened lately first — the
         places somebody goes, before the list of everywhere they could. */
      ...(term || onlyHits
        ? []
        : [
            ...asked.map<Row>((said) => ({
              key: `q:${said}`,
              label: said,
              hint: '',
              group: 'Recent',
              icon: 'search',
              badge: W.query,
              go: { kind: 'query', q: said },
            })),
            ...recent
              /* Not a project that has gone, or a place in one. */
              .filter((k) => (k.go.kind === 'project' ? known.has(k.go.id) : k.go.kind === 'object' ? known.has(k.go.projectId) : true))
              .map<Row>((k) => ({ ...k, group: 'Recent', badge: badgeOf(k.go) })),
          ]),
      ...projects
        .filter((p) => !onlyHits && matches(p.name))
        .map<Row>((p) => ({
          key: `p:${p.id}`,
          label: p.name,
          hint: '',
          group: 'Projects',
          mark: p,
          go: { kind: 'project', id: p.id },
        })),
      /* People, once something is typed: a list of everyone under an empty
         field is the members screen, and that is one row below. Found by
         name or by what they do — "design" finds the designer. */
      ...(term
        ? people
            .filter((p) => matches(p.name) || (p.title ? matches(p.title) : false))
            .slice(0, 6)
            .map<Row>((p) => ({
              key: `m:${p.actor_id}`,
              label: p.name,
              hint: p.title ?? (p.role === 'owner' ? W.owner : ''),
              group: 'People',
              go: { kind: 'person', id: p.actor_id },
              face: { id: p.actor_id, name: p.name, url: p.avatar_url },
            }))
        : []),
      /* Rooms, once something is typed, by the names the column gives them. */
      ...(term
        ? rooms
            .filter((r) => matches(r.name))
            .slice(0, 6)
            .map<Row>((r) => ({
              key: `r:${r.id}`,
              label: r.name,
              hint: '',
              group: 'Chat',
              icon: r.direct ? 'bubble' : 'hash',
              ...(r.face ? { face: r.face } : {}),
              go: { kind: 'room', id: r.id },
            }))
        : []),
      /* By the names the sidebar and the bar give them — "My", and
         "Projects-all", were the ids the router keeps. */
      ...views
        .filter((v) => !onlyHits && matches(screenName(v)))
        .map<Row>((v) => ({
          key: `v:${v}`,
          label: screenName(v),
          hint: '',
          group: 'Go to',
          icon: SCREEN_ICON[v] ?? 'search',
          ...(counts[v] ? { count: counts[v] } : {}),
          go: { kind: 'view', view: v },
        })),
      /* The doors a workspace's own domain keeps shut, at usetuff.com: its
         name beside each, so the row says where it goes. */
      ...away
        .filter((a) => !onlyHits && matches(a.label))
        .map<Row>((a) => ({
          key: `away:${a.key}`,
          label: a.label,
          hint: new URL(a.url).host,
          group: 'Go to',
          icon: a.icon,
          go: { kind: 'away', url: a.url },
        })),
      /* Connecting an agent, beside the place it is done in: people kept
         looking for it everywhere but under the place's old name, Members.
         Found by what somebody looking for it types — "claude", "mcp". */
      ...(mayConnect && !onlyHits && (matches(AGENTS.connect) || CONNECT_FOUND_BY.some((k) => term.length >= 2 && k.startsWith(term)))
        ? [
            {
              key: 'connect',
              label: AGENTS.connect,
              hint: '',
              group: 'Go to',
              icon: 'spark',
              go: { kind: 'connect' },
            } as Row,
          ]
        : []),
      /* What the server found: a task by its handle first — somebody who
         typed `TRA-111` knows exactly what they meant — then titles, then
         the words inside, each of those with the piece of sentence that
         said them. */
      ...hits.map<Row>((h) => {
        if (h.type === 'message') {
          const room = rooms.find((r) => r.id === h.conversation_id)
          return {
            key: `message:${h.id}`,
            label: (h.snippet ?? '').trim(),
            hint: [h.author_name, room?.name].filter(Boolean).join(' · '),
            group: 'Results',
            icon: 'bubble',
            go: { kind: 'room', id: h.conversation_id, message: { id: h.id, thread: h.parent_id } },
          }
        }
        const key = keyOf.get(h.project_id)
        return {
          key: `${h.type}:${h.id}`,
          label: h.title,
          hint: h.snippet ? `…${h.snippet.trim()}…` : (named.get(h.project_id) ?? h.type),
          group: 'Results',
          icon: KIND_ICON[h.type] ?? 'doc',
          ...(h.type === 'file' && (h.mark_icon != null || h.mark_tint != null)
            ? { doc: { icon: h.mark_icon ?? null, tint: h.mark_tint ?? null } }
            : {}),
          ...(h.type === 'task' && key ? { code: `${key}-${h.number}` } : {}),
          go: { kind: 'object', projectId: h.project_id, type: h.type, id: h.id },
        }
      }),
      // Last, and only with something typed: what you meant is almost always
      // something that already exists, and an offer to create sitting at the
      // top would be selected by an Enter meant for the first result.
      ...(inProject && canWrite && !blocking && q.trim().length >= 2
        ? [
            {
              key: 'new',
              label: W.newTask(q.trim()),
              hint: inProject.name,
              group: 'Create',
              icon: 'plusThin',
              go: { kind: 'create', projectId: inProject.id, title: q.trim() },
            } as Row,
          ]
        : []),
    ]
  }, [
    projects,
    people,
    rooms,
    views,
    counts,
    hits,
    q,
    inProject,
    canWrite,
    recent,
    asked,
    blocking,
    openTask,
    narrowedChat,
    mayConnect,
    away,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: onQuery and setOpen are the opener's, read when a row is run
  const run = useCallback(
    (row: Row | undefined) => {
      if (!row) return
      const go = row.go
      /* A question asked before is asked again, here, rather than gone to. */
      if (go.kind === 'query') {
        setQ(go.q)
        setAt(0)
        onQuery?.(go.q)
        input.current?.focus()
        return
      }
      /* Kept: the place, and — when something was typed to find it — the
         question. Not a task being made, which is not a place yet. */
      /* Nor connecting an agent, which is a window rather than a place, and
         a right that can be taken away after it was kept. */
      /* Nor a door that leaves for usetuff.com, which is not a place here. */
      if (go.kind !== 'create' && go.kind !== 'block' && go.kind !== 'connect' && go.kind !== 'away') {
        const { group: _g, count: _c, badge: _b, ...kept } = row
        remember(RECENT, [{ ...kept, go } as Kept, ...recent.filter((k) => k.key !== row.key)].slice(0, 5))
        const said = q.trim()
        if (said.length >= 2) remember(ASKED, [said, ...asked.filter((a) => a !== said)].slice(0, 3))
      }
      setOpen(false)
      onGo(go)
    },
    [onGo, recent, asked, q],
  )

  /* The chosen row stays in sight as the keys walk the list. */
  useEffect(() => {
    document.getElementById(`palette-${at}`)?.scrollIntoView({ block: 'nearest' })
  }, [at])

  if (!open) return null

  const type = (said: string) => {
    setQ(said)
    setAt(0)
    onQuery?.(said)
  }
  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAt((i) => Math.min(i + 1, rows.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') run(rows[at])
  }

  /*
   * The kinds and the project, under the field — and shown once there is
   * something for them to narrow. With nothing typed the palette is places
   * and screens, which they do not touch, and four buttons that did nothing
   * were four things to read past. Their row keeps its height whether shown
   * or not, so the list does not move when the first letter goes in; they
   * fade in on it, and stay while one of them is on, so it can be turned
   * off. They were hidden once before and nobody found them — then they
   * appeared at the foot of the answers; here they are where the eye is,
   * under the words being typed. `docs/specs/palette.md`.
   */
  const narrowing = Boolean(q.trim()) || kinds.length > 0 || Boolean(scope)
  /*
   * And under it, while Chat is the one kind chosen, what narrows what was
   * said: from whom, with a link or a file, in threads, which end first.
   * Grown into its height on the same curve as the row above, so the
   * answers move down in one piece.
   */
  const toggle = (on: boolean, set: (v: boolean) => void, label: string, testId: string) => (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={on}
      onClick={() => {
        set(!on)
        input.current?.focus()
      }}
      className={`flex shrink-0 items-center rounded-full font-medium ${page ? 'h-8 px-4 text-base' : 'h-7 px-3 text-sm'}`}
      style={{ background: on ? 'var(--accent)' : 'var(--track)', color: on ? 'var(--on-accent)' : 'var(--ink-2)' }}
    >
      {label}
    </button>
  )
  const chatFilters = (
    <>
      <select
        data-testid="filter-from"
        aria-label={W.from}
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className={`${page ? 'h-8 text-base' : 'h-7 text-sm'} max-w-48 shrink-0 bg-transparent px-1 outline-none`}
        style={{ color: from ? 'var(--ink)' : 'var(--ink-2)' }}
      >
        <option value="">{W.fromAnyone}</option>
        {people.map((p) => (
          <option key={p.actor_id} value={p.actor_id}>
            {p.name}
          </option>
        ))}
      </select>
      {toggle(hasLink, setHasLink, W.hasLink, 'filter-has-link')}
      {toggle(hasFile, setHasFile, W.hasFile, 'filter-has-file')}
      {toggle(inThreads, setInThreads, W.inThreads, 'filter-in-threads')}
      <select
        data-testid="filter-sort"
        aria-label={W.sortBy}
        value={oldest ? 'oldest' : 'newest'}
        onChange={(e) => setOldest(e.target.value === 'oldest')}
        className={`${page ? 'h-8 text-base' : 'h-7 text-sm'} shrink-0 bg-transparent px-1 outline-none text-ink-2`}
      >
        <option value="newest">{W.newestFirst}</option>
        <option value="oldest">{W.oldestFirst}</option>
      </select>
    </>
  )
  const chatRow = (outer: string, inner: string, style?: React.CSSProperties) => (
    <div
      className="grid transition-[grid-template-rows] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none"
      style={{ ...style, gridTemplateRows: chatOnly ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          data-palette-chat-filters
          aria-hidden={!chatOnly || undefined}
          {...(!chatOnly ? { inert: '' as unknown as boolean } : {})}
          className={`${outer} transition-opacity duration-150 motion-reduce:transition-none`}
          style={{ opacity: chatOnly ? 1 : 0 }}
        >
          <div className={inner}>{chatFilters}</div>
        </div>
      </div>
    </div>
  )
  /*
   * The row opens when there is something to narrow and closes when there is
   * not, growing into its height as the filters fade in — 150 ms, the same
   * gesture as the bar a selection brings — so the list under it moves down
   * in one piece rather than jumping. Its rule stays, between the field and
   * the list, either way.
   */
  const filterRow = (outer: string, inner: string, style?: React.CSSProperties) => (
    <div
      className="grid transition-[grid-template-rows] duration-150 ease-[var(--ease-out)] motion-reduce:transition-none"
      style={{ ...style, gridTemplateRows: narrowing ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          data-palette-filters
          aria-hidden={!narrowing || undefined}
          {...(!narrowing ? { inert: '' as unknown as boolean } : {})}
          className={`${outer} transition-opacity duration-150 motion-reduce:transition-none`}
          style={{ opacity: narrowing ? 1 : 0 }}
        >
          <div className={inner}>{filters}</div>
        </div>
      </div>
    </div>
  )
  const filters = (
    <>
      {KINDS.map((k) => {
        const on = kinds.includes(k)
        return (
          <button
            key={k}
            data-testid={`filter-${k}`}
            onClick={() => {
              setKinds((was) => (on ? was.filter((x) => x !== k) : [...was, k]))
              input.current?.focus()
            }}
            className={`flex shrink-0 items-center gap-1 rounded-full font-medium ${page ? 'h-8 px-4 text-base' : 'h-7 px-3 text-sm'}`}
            style={{
              background: on ? 'var(--accent)' : 'var(--track)',
              color: on ? 'var(--on-accent)' : 'var(--ink-2)',
            }}
          >
            <Icon name={KIND_ICON[k]!} size={14} />
            {KIND_SAID[k]}
          </button>
        )
      })}
      <select
        data-testid="filter-project"
        aria-label={PLACES.project}
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className={`${page ? 'h-8 text-base' : 'h-7 text-sm'} shrink-0 bg-transparent px-1 outline-none`}
        style={{ color: scope ? 'var(--ink)' : 'var(--ink-2)' }}
      >
        <option value="">{HEADS.everyProject}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </>
  )

  /* The answers in their groups, in the order the rows are walked. */
  const groups: { name: string; rows: { row: Row; i: number }[] }[] = []
  rows.forEach((row, i) => {
    const last = groups[groups.length - 1]
    if (last && last.name === row.group) last.rows.push({ row, i })
    else groups.push({ name: row.group, rows: [{ row, i }] })
  })
  const nothing = (
    <div className="px-4 py-3 text-base text-ink-3">{q.trim().length < 2 && !narrowedChat ? W.typeToSearch : W.noResults}</div>
  )

  if (page) {
    return (
      <div data-search-page className="flex h-full flex-col">
        <div className="shrink-0 px-[var(--gutter)] pt-3 pb-3">
          <label className="flex h-10 items-center gap-2 rounded-full pr-1 pl-4 bg-track text-ink-3">
            <Icon name="search" size={16} />
            <input
              {...notALogin}
              ref={input}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              data-testid="palette-input"
              /* Text, not `search`: the browser's own clear button would be
                 a second ✕ beside the one here. */
              type="text"
              enterKeyHint="search"
              /* Sixteen, because a phone zooms the page in on any field
                 whose text is smaller, and the screen jumps on the tap. */
              className="h-full min-w-px flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--ink-3)]"
              style={{ color: 'var(--ink)' }}
              placeholder={BAR.search}
              value={q}
              onChange={(e) => type(e.target.value)}
              onKeyDown={keys}
            />
            {q && (
              <button
                type="button"
                aria-label={MORE.clear}
                data-testid="search-clear"
                onClick={() => {
                  type('')
                  input.current?.focus()
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </label>
          {filterRow('-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] pt-3', 'flex w-max items-center gap-2')}
          {chatRow('-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] pt-2', 'flex w-max items-center gap-2')}
        </div>
        <div
          id={listId}
          role="listbox"
          data-testid="palette-list"
          data-foot
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[var(--gutter)] pb-4"
        >
          {/* A page has the room the box does not: the search with nothing
              found gets the drawing every empty screen has, the loupe on
              a blank sheet. */}
          {rows.length === 0 &&
            (q.trim().length < 2 ? (
              nothing
            ) : (
              <div data-empty="loupe" className="flex flex-col items-center gap-2 pt-12 text-center">
                <Art name="loupe" />
                <p className="mt-2 text-md text-ink-2">{W.noResults}</p>
              </div>
            ))}
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-2">
              <div className="px-4 text-xs font-medium text-ink-3">{GROUP_SAID[g.name] ?? g.name}</div>
              <Panel>
                {g.rows.map(({ row, i }, n) => (
                  <div key={row.key} className="contents">
                    {n > 0 && <Hairline inset={52} />}
                    <button
                      id={`palette-${i}`}
                      role="option"
                      aria-selected={i === at}
                      data-row
                      data-testid="palette-row"
                      data-hit={row.group === 'Results' ? '' : undefined}
                      data-recent={row.group === 'Recent' ? '' : undefined}
                      data-kind={row.go.kind}
                      onClick={() => run(row)}
                      className="flex h-12 w-full items-center gap-3 px-4 text-left text-md text-ink"
                    >
                      <Lead row={row} size={24} />
                      {row.code && <span className="shrink-0 text-sm tabular-nums text-ink-3">{row.code}</span>}
                      <span className="min-w-px flex-1 truncate">{row.label}</span>
                      <Tail row={row} />
                    </button>
                  </div>
                ))}
              </Panel>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh]"
      // A modal task: the background is pushed back so there is one thing to
      // answer. A panel that runs alongside the work would not dim.
    >
      {/* The dialogs' own dim and soft focus, as making a project has: one
          kind of box over the work, one way of pushing the work back. */}
      <Scrim onPress={() => setOpen(false)} />
      {/*
        No entrance animation, deliberately.

        This is opened by a keystroke dozens of times a day, and at that
        frequency any transition is something to sit through: the same 180 ms
        that reads as considered on a modal reads as lag here. It is simply
        there when asked for.
      */}
      {/* Solid, not glass, as the dialogs are: rows of names over the page
         swimming through them were rows to read past — we asked for
         it the way New project is. `docs/specs/palette.md`. */}
      <div
        data-palette
        className="relative flex w-[min(640px,92vw)] flex-col overflow-hidden bg-surface"
        style={{
          borderRadius: 16,
          boxShadow: 'var(--dialog-shadow), 0 0 0 1px var(--dialog-edge)',
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-3 px-4 text-ink-3">
          <Icon name="search" size={16} />
          <input
            {...notALogin}
            ref={input}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={rows[at] ? `palette-${at}` : undefined}
            data-testid="palette-input"
            className="h-full min-w-px flex-1 bg-transparent text-md outline-none placeholder:text-[var(--ink-3)]"
            style={{ color: 'var(--ink)' }}
            placeholder={PLACES.goAnywhere}
            value={q}
            onChange={(e) => type(e.target.value)}
            onKeyDown={keys}
          />
          <Key>⌘K</Key>
        </div>
        {filterRow(
          'shrink-0 px-4 pb-3',
          'flex flex-wrap items-center gap-2',
          chatOnly ? undefined : { borderBottom: '1px solid var(--line)' },
        )}
        {chatRow(
          'shrink-0 px-4 pb-3',
          'flex flex-wrap items-center gap-2',
          chatOnly ? { borderBottom: '1px solid var(--line)' } : undefined,
        )}

        <div id={listId} role="listbox" data-testid="palette-list" className="max-h-[min(420px,56vh)] overflow-y-auto p-2">
          {rows.length === 0 && nothing}
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col">
              {/* A heading only where the kind changes: a label above every
                  row is a label nobody reads. */}
              <div className="px-2 pt-2 pb-1 text-xs font-medium text-ink-3">{GROUP_SAID[g.name] ?? g.name}</div>
              {g.rows.map(({ row, i }) => (
                <button
                  key={row.key}
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === at}
                  data-row
                  data-testid="palette-row"
                  /* What the server found, as against a project or a screen
                     this already knew about. The difference matters to anyone
                     asking whether search works. */
                  data-hit={row.group === 'Results' ? '' : undefined}
                  data-recent={row.group === 'Recent' ? '' : undefined}
                  data-kind={row.go.kind}
                  /*
                   * Lit by a hand that moved, not by a list that moved under a
                   * hand at rest. Rows arriving under a still pointer set it
                   * off — the browser sends a move of nothing when the layout
                   * changes — and the Enter meant for the first result opened
                   * whatever had landed where the cursor was: typing "Acme"
                   * opened the acme room, not the Acme project.
                   */
                  onPointerMove={(e) => (e.movementX || e.movementY) && i !== at && setAt(i)}
                  onClick={() => run(row)}
                  className="flex h-10 w-full shrink-0 items-center gap-3 rounded-[var(--r-row)] px-2 text-left text-base text-ink"
                  style={{
                    background: i === at ? 'var(--hover)' : 'transparent',
                  }}
                >
                  <Lead row={row} size={20} />
                  {row.code && <span className="shrink-0 text-xs tabular-nums text-ink-3">{row.code}</span>}
                  <span className="min-w-px truncate">{row.label}</span>
                  <Tail row={row} />
                  {i === at && <Kbd>↵</Kbd>}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* The keys, said once at the foot rather than learned by trying. */}
        <div className="flex h-10 shrink-0 items-center gap-4 px-4 text-xs text-ink-3" style={{ borderTop: '1px solid var(--line)' }}>
          <span className="flex items-center gap-2">
            <Key>{W.esc}</Key>
            {W.close}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Key>↑</Key>
            <Key>↓</Key>
            {W.move}
          </span>
          <span className="flex items-center gap-2">
            <Key>↵</Key>
            {W.open}
          </span>
        </div>
      </div>
    </div>
  )
}
