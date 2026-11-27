import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { membersDoor } from '../data/doors.js'
import { warm, membersReads } from '../data/ahead.js'
import { readPutAway } from './Projects.jsx'
import { BAR, HEADS, MAKE, PLACES, SAYS } from '../data/words.js'
import { SIDEBAR as W } from '../words/sidebar.js'
import { CHAT } from '../words/chat.js'
import { Glass } from './Glass.jsx'
import { NewButton } from './New.jsx'
import { Avatar, Badge, COLUMN_MS, Fluid, GroupLabel, Over, Resizer, Row } from './kit.jsx'
import { foldSlot } from './project/fold.js'
import { ThemeButton, WorkspaceMenu } from './TopBar.jsx'
import { useReorder } from './useReorder.js'
import { cappedRows, landing } from './capped.js'
import { Icon, ProjectMark, markOf, markRadius } from './icons.jsx'

export type View =
  | 'my'
  | 'projects-all'
  | 'search'
  | 'notifications'
  | 'members'
  | 'projects'
  | 'chat'
  | 'settings'
  | 'account'
  | 'more'
  | 'admin'
  | 'instance'

export type Project = {
  id: string
  name: string
  icon_url?: string | null | undefined
  /** What somebody chose the mark to look like. */
  mark_icon?: string | null | undefined
  mark_tint?: number | null | undefined
}
export type Room = {
  id: string
  project_id: string | null
  name: string | null
  /** Who else is in it, for a direct conversation — it has no name of its own. */
  others?: string | null
  /** The one other person in a direct conversation; null for a group. */
  other_id?: string | null
  unread?: string
  /** Where that count starts — `docs/specs/history.md`. */
  read_through?: string | null
  /** How the one other person is, for a direct conversation — `docs/specs/presence.md`. */
  other_presence?: 'here' | 'away' | 'busy' | null
  /** Their picture, when it is one person — `docs/specs/avatar.md`. */
  other_avatar_url?: string | null
  /** Everybody else in a direct conversation was removed from the workspace — `docs/specs/removing-someone.md`. */
  others_gone?: boolean | null
  /** A channel rather than people talking. */
  channel?: boolean
  /** The project's own name in an address, which a channel's name begins with. */
  project_slug?: string | null
  created_by?: string | null
  /** What this reader may do to it: rename and choose its people, throw it
      away, and its incoming webhooks. */
  can?: ('edit' | 'delete' | 'hooks' | 'leave')[]
  /** A project's channel open only to the people in it. */
  chosen?: boolean
  /** An open channel this reader left: put away, muted, staying away. */
  left?: boolean
  /** How loud it is for this reader. */
  notify?: 'all' | 'mentions' | 'none'
  /** Times they were named in it and have not looked. */
  mentions?: string | number
  /** Put away under "More chats" — `docs/specs/sidebar-hide.md`. */
  hidden?: boolean
  /** A channel of a project that was archived: the project's to open, not a place in the list. */
  project_archived?: boolean
}

/**
 * A direct conversation whose everybody else has gone — removed from the
 * workspace, or their account deleted. Kept to be read, in a section of its
 * own at the foot of the Chats page, and not a place in the list:
 * `docs/specs/sidebar.md`, "The Chats page". The server's `others_gone`
 * decides it, so somebody invited back brings the conversation back to the
 * list by themselves.
 */
export function leftRoom(r: Pick<Room, 'channel' | 'project_id' | 'others_gone' | 'project_archived'>): boolean {
  return !r.project_archived && !(r.channel ?? Boolean(r.project_id)) && r.others_gone === true
}

/**
 * What a room's badge says.
 *
 * Every new message, counted, unless the room was turned down: to mentions
 * only, which counts the times you were named; or to nothing, which counts
 * nothing. What is unread there all the same is `quiet`, drawn grey on the
 * row and summed nowhere. A name is red whatever the count beside it is.
 */
export function roomCount(r: Pick<Room, 'unread' | 'mentions' | 'notify'>): {
  count: number
  urgent: boolean
  /** New words in it, whether or not they are counted. */
  fresh: boolean
  /**
   * What is unread in a room turned down — mentions only with nobody
   * naming you, or nothing — drawn on its row in grey and added to no
   * total: you can see it is there without it asking anything of you.
   */
  quiet: number
} {
  const unread = Number(r.unread ?? 0)
  const named = Number(r.mentions ?? 0)
  const level = r.notify ?? 'all'
  if (level === 'none') return { count: 0, urgent: false, fresh: false, quiet: unread }
  if (level === 'mentions') return { count: named, urgent: named > 0, fresh: unread > 0, quiet: named > 0 ? 0 : unread }
  return { count: Math.max(unread, named), urgent: named > 0, fresh: unread > 0, quiet: 0 }
}

/**
 * What a room is called wherever it is listed.
 *
 * A channel the way Slack writes one, on one line: the project's name and
 * the room's, `acme-rebrand-main`; a channel outside every project by its
 * own name. A direct conversation is the people in it.
 */
export function roomName(r: Pick<Room, 'channel' | 'project_id' | 'project_slug' | 'name' | 'others'>): string {
  const isChannel = r.channel ?? Boolean(r.project_id)
  if (!isChannel) return r.others ?? W.direct
  const own = (r.name ?? 'main').toLowerCase().replace(/\s+/g, '-')
  return r.project_slug ? `${r.project_slug}-${own}` : own
}

/**
 * One navigation model: workspace → project → tool.
 *
 * Read top to bottom it is who you are working as, what is on you, the work
 * itself, the talking about it, and the machinery — in that order, because
 * that is the order somebody opening the product in the morning needs them.
 */
export function Sidebar({
  wide,
  onLeave,
  view,
  project,
  room,
  projects,
  rooms,
  loaded,
  can,
  onView,
  onProject,
  onProjectNear,
  onRoom,
  onRoomNear,
  onRoomBeside,
  besideRoom,
  onCreateProject,
  people,
  onNewChat,
  canChannel,
  onPlaceProject,
  onPlaceRoom,
  onHideRoom,
  onMoveRoom,
  width,
  setWidth,
  shut,
  onReset,
  onDone,
  onGrab,
  moving,
  workspace,
  onMake,
  onWorkspaceSettings,
  workspaceSettingsAway = null,
}: {
  view: View
  project: string | null
  /** The room on the screen, from the column or a project's Chat tab. */
  room: string | null
  projects: Project[]
  rooms: Room[]
  /** Whether the lists have arrived. Empty and not-yet-known are different. */
  loaded: boolean
  /** Unread notifications, shown against the one item that is about them. */
  can: string[]
  /** Whether there is room for it as a column — `docs/specs/narrow.md`. */
  wide: boolean
  /** One number for the column, the bar's left block and the resizer. */
  width: number
  setWidth: (n: number, key?: boolean) => void
  /** Narrowed to its glyphs — `docs/specs/collapsed-sidebar.md`. */
  shut: boolean
  onReset: (key?: boolean) => void
  onDone: () => void
  onGrab: () => void
  /** Travelling between open and shut, so the width eases; a drag does not. */
  moving: boolean
  /** Said when something in here was chosen, so a drawer can shut itself. */
  onLeave: () => void
  /** On a phone the drawer carries what the bar carries on a wide screen:
      the workspace, making a task, the theme. */
  workspace?: { id: string; name: string; mark_icon?: string | null; mark_tint?: number | null; icon_url?: string | null }
  onMake?: () => void
  /** This workspace's settings, for whoever may change something there. */
  onWorkspaceSettings?: (() => void) | undefined
  /** Or their address at usetuff.com, where a workspace's own domain keeps
      them shut — `doorsAway`. */
  workspaceSettingsAway?: string | null | undefined
  onView: (v: View) => void
  onProject: (id: string) => void
  /**
   * The pointer arriving on a row, a moment before the click.
   *
   * A cold project opens on its chrome and fills a frame later, because the
   * data cannot be there before it is asked for. So it is asked for while
   * somebody is still moving towards it: the gap between a pointer landing
   * on a row and the button going down is longer than the request.
   */
  onProjectNear: (id: string) => void
  /** The same, for a room: its conversation is what takes the longest. */
  onRoomNear: (id: string) => void
  onRoom: (id: string) => void
  /** A room opened beside the work: ⌥-pressed, or from its menu. */
  onRoomBeside?: ((id: string) => void) | undefined
  /** Whether a room is one that opens beside. */
  besideRoom?: ((id: string) => boolean) | undefined
  /** Called after one was made, to bring the new list in. */
  onCreateProject: () => Promise<void>
  /** The global create: one door, wherever you are. `c` opens the same one. */
  /** Everybody in the workspace, so a conversation can be started with one. */
  people: { actor_id: string; name: string }[]
  /** The window that starts a channel or a direct message. */
  onNewChat: () => void
  /** Whether a channel outside every project is this person's to open. */
  canChannel?: boolean | undefined
  /**
   * Where somebody dragged a project or a conversation to, in their own
   * sidebar — `docs/specs/sidebar-order.md`. The row, and the one it now sits
   * behind, or null when it went to the top.
   */
  onPlaceProject: (id: string, after: string | null) => void
  onPlaceRoom: (id: string, after: string | null) => void
  /** Put a room away under "More chats", or bring it back. */
  onHideRoom: (id: string, hidden: boolean) => void
  /**
   * A room dragged across the "Hidden" label or onto "n more": whether it is
   * put away now, and its neighbours in the part it was dropped into —
   * `docs/specs/sidebar-hide.md`.
   */
  onMoveRoom: (id: string, to: Move) => void
  /** A channel left: the list is read again. */
}) {
  /*
   * How many rows the column has room for, so a list is cut only when it
   * would not fit. It stopped at eight whatever the screen, and a tall
   * window with three free rows under "1 more chat" was hiding a chat for
   * no reason. Measured: the column's height over a row's.
   */
  const column = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState(0)
  /* Before paint, or the column draws cut at eight and grows a frame later. */
  useLayoutEffect(() => {
    const el = column.current
    if (!el) return
    const measure = () => {
      const row = el.querySelector<HTMLElement>('[data-project]')?.offsetHeight || 36
      /* The fixed rows — My tasks, Members, two headings, a "more" — and
         the space between rows. */
      setSpace(Math.max(0, Math.floor(el.clientHeight / (row + 4)) - 6))
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  /* Every way out of here also shuts the drawer. Wrapped once rather than
     at each row: a way out that stays open is a way out somebody presses
     twice. */
  /* The menu a right press opens on a room. */
  const [menu, setMenu] = useState<{ id: string; hidden: boolean; beside: boolean; x: number; y: number } | null>(null)
  /* A press near the foot of the column opens the menu upward, so its last
     row is not drawn under the window's edge. Measured before paint. */
  const menuBox = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = menuBox.current
    if (!menu || !box) return
    const h = box.offsetHeight
    if (menu.y + h > window.innerHeight - 8) box.style.top = `${Math.max(8, menu.y - h)}px`
  }, [menu])
  /* The channel being left, asked about first. */
  const leaving =
    <T,>(go: (v: T) => void) =>
    (v: T) => {
      go(v)
      onLeave()
    }
  /*
   * How big a glyph is, which is a different answer in a column of glyphs.
   *
   * Twenty beside a name and forty when the name is gone: at twenty a
   * project's mark in a 56px column is a dot with a lot of air round it,
   * and the mark is the only thing left saying which project this is.
   * `docs/specs/collapsed-sidebar.md`.
   *
   * Worked out here rather than passed down: every glyph in this column is
   * built in this component, so a prop through `Capped` and `Item` would be
   * a value travelling two levels to arrive where it started.
   */
  const glyphSize = shut ? 32 : 20

  /*
   * The two plain glyphs, given the box the marks have.
   *
   * A project's mark is a 32px tile with its glyph inset; My tasks and
   * Members were bare glyphs beside them, and a bare glyph at 32 reads as
   * larger than a tile at 32 because the tile spends some of itself on the
   * field around its own glyph. Same box, same optical size.
   *
   * The ground is the sunken grey rather than a colour: a project's tile is
   * coloured because the colour is how that project is told from the next
   * one, and these two are not one of a set. It also leaves the lit row's
   * own ground still readable behind it.
   */
  const Tile = ({ children }: { children: React.ReactNode }) => (
    <span className="flex shrink-0 items-center justify-center bg-sunken" style={{ width: 32, height: 32, borderRadius: markRadius(32) }}>
      {children}
    </span>
  )

  const caps = share(space, projects.length, rooms.filter((r) => !r.hidden).length)
  return (
    <aside
      data-panel
      className="group/sidebar relative flex shrink-0 flex-col"
      /* No border down the right of its own: the sidebar and the page are
         different greys, and a line between two different greys is a third
         edge drawn over one that was already there. The resizer draws the
         only line here, and only because it has to be aimed at.
         
         The scrolling happens one level in. An `overflow` clips absolutely
         positioned children, so with it on the panel itself the outer half of
         the resize handle was cut away and the edge could only be caught from
         inside — half a target, and the half nobody aims at. */
      /* One width below the breakpoint, and no handle: dragging a 320px
         drawer inside a 390px window is an argument about nothing. */
      data-shut={wide && shut ? '' : undefined}
      data-moving={wide && moving ? '' : undefined}
      style={{
        width: wide ? width : 288,
        /*
         * The width travels when it is a state change and jumps when it is
         * a drag.
         *
         * A column that eases while the hand is on the handle lags behind
         * the pointer, which is the one thing a resize must not do. It used
         * to say so with the hand itself — off while held — and that turned
         * the travel off for the one change that is not a size: the drag
         * across the threshold, which is always held, so the column jumped
         * from 150 to 56 in a frame. Now the travel is on for the length of
         * a change of state and off otherwise, held or not, and off for an
         * arrow key, whose answer is not animated.
         *
         * The house ease-out, on the same 200 ms as the project's column
         * folding into this one, so two columns moving at once read as one
         * movement. `docs/specs/collapsed-sidebar.md`, "Shutting moves".
         */
        transition: moving ? `width ${COLUMN_MS}ms var(--ease-out)` : 'none',
        /*
         * On the ground, not a sheet on it.
         *
         * This column is where you are in the workspace, and the two things
         * to its right are what you are looking at. Giving all three a card
         * made the window a row of three equal panes and said nothing about
         * which is the frame and which is the picture. So the outermost one
         * recedes into the ground and the lift begins at the project.
         *
         * Narrow is the exception twice over: there is no ground behind it
         * because it is a drawer over the whole window, so it keeps a
         * surface of its own to be read against what it covers.
         */
        ...(wide ? {} : { background: 'var(--chrome)' }),
      }}
    >
      {wide && (
        <Resizer
          label={BAR.sidebarWidth}
          width={width}
          onChange={setWidth}
          onReset={onReset}
          onDone={onDone}
          onGrab={onGrab}
          min={200}
          max={380}
        />
      )}
      {/* One highlight for the whole column, travelling between the rows —
          `Fluid`, and the view spec. It is measured against this box,
          so it has to be the positioned one and it has to be the scroller:
          the rows move under the pointer when the column scrolls. */}
      <div
        ref={column}
        data-fluid
        /*
         * The same head the column beside it holds.
         *
         * Twenty, which is what puts the project's name on the line the
         * screen's name is on — and this column follows it rather than the
         * other way round, because the three names across the window have
         * to agree and the work's title is the one with the least room to
         * move. Two columns agreeing while the third does not is the thing
         * anybody notices.
         *
         * The foot keeps more, because a list ending flush with the bottom
         * of a column reads as cut off rather than finished.
         */
        /* Four at the sides. The row carries twelve of its own, which is
           what sets the text in; this is only the gap between a lit row's
           ground and the column's edge, and four is enough for it to read
           as a ground rather than a stripe running off the side. */
        /* Shut, the gutter widens from four to eight so a 32px glyph lands
           under the workspace mark in the bar above — measured, not guessed:
           the mark's centre is 33 and the rows were on 30.
           `docs/specs/collapsed-sidebar.md`. */
        className={`relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pt-2 pb-4 group-data-[shut]/sidebar:px-2 [scrollbar-gutter:stable] ${wide ? '' : 'px-1'}`}
      >
        <Fluid />
        {/* The column begins with the work. What used to stand above it —
          the mark, the workspace, search and the button that makes a task —
          is the bar across the top now, because none of it is a place in
          this workspace. */}
        {/*
        On a phone, what the bar carries on a wide screen: which workspace,
        making a task, the theme. The bar there is the place's name and the
        three things reached for most; these are reached for less, and the
        drawer is one press away.
      */}
        {!wide && workspace && (
          <div data-drawer-head className="flex flex-col gap-1 px-1 pb-2">
            <div className="px-1 py-1">
              <WorkspaceMenu
                id={workspace.id}
                name={workspace.name}
                look={workspace}
                shut={false}
                ground="var(--chrome)"
                mayMake={can.includes('workspace.create')}
                onSettings={
                  onWorkspaceSettings
                    ? () => {
                        onWorkspaceSettings()
                        onLeave()
                      }
                    : undefined
                }
                settingsAway={workspaceSettingsAway}
              />
            </div>
            {onMake && (
              <button
                data-testid="drawer-new-task"
                data-row
                onClick={() => {
                  onLeave()
                  onMake()
                }}
                className="flex w-full items-center gap-3 px-2 text-left text-base text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <span className="flex size-5 items-center justify-center text-ink-2">
                  <Icon name="compose" size={16} />
                </span>
                <span className="min-w-px flex-1 truncate">{MAKE.newTask}</span>
              </button>
            )}
            <ThemeButton row />
          </div>
        )}
        <Group first>
          <Item
            testId="nav-my"
            glyph={
              shut ? (
                <Tile>
                  <Icon name="tasks" size={18} />
                </Tile>
              ) : (
                <Icon name="tasks" />
              )
            }
            label={PLACES.myTasks}
            on={view === 'my'}
            onClick={() => leaving(onView)('my')}
          />
          {/* The screen, not the people: `members.read` is the fourth switch,
            and who is in the workspace is still in every picker.
            Somebody who may connect agents
            has it for the Agents tab. */}
          {membersDoor(can) && (
            <Item
              testId="nav-members"
              glyph={
                shut ? (
                  <Tile>
                    <Icon name="people" size={18} />
                  </Tile>
                ) : (
                  <Icon name="people" />
                )
              }
              label={PLACES.members}
              on={view === 'members'}
              /* What the screen waits for, asked while the pointer is on
                 the way to it — `data/ahead.ts`. */
              onNear={() => warm(membersReads(can))}
              onClick={() => leaving(onView)('members')}
            />
          )}
        </Group>

        {/* The heading is the way to the index: a sidebar is for the handful
          you are in this week, not for all of them. */}
        {/* The way to make one goes with the heading it hangs off: in a
          column of glyphs a bare plus is a button with nothing saying what
          it would make, and `c` and the bar both still make projects.
          `docs/specs/collapsed-sidebar.md`. */}
        <Heading
          action={
            !shut &&
            can.includes('project.create') && (
              <NewButton label={MAKE.newProject} variant="bare" what={{ kind: 'project' }} onMade={onCreateProject} />
            )
          }
        >
          <button
            data-testid="nav-projects-all"
            /* What the index folds under its list, asked on the way to it. */
            onPointerEnter={() => void readPutAway(can.includes('project.archive')).catch(() => {})}
            onClick={() => leaving(onView)('projects-all')}
            /* Hidden with the word it is: at 56 it was 24…77, which is a
             button hanging twenty pixels out of its own column. Lit under
             the pointer like every other thing in the column that goes
             somewhere: a heading that opens a page and looks like a label
             was a door nobody found. */
            className="-mx-2 -my-1 rounded-[var(--r-row)] px-2 py-1 text-left transition-colors group-data-[shut]/sidebar:hidden mouse:hover:bg-[var(--hover)] mouse:hover:text-[var(--ink-2)]"
          >
            {HEADS.projects}
          </button>
        </Heading>
        <Capped
          items={projects}
          cap={caps.projects}
          /* The open project is always in the column, with its tools under
             it. */
          pinned={view === 'projects' ? project : null}
          more={W.moreProjects}
          onPlace={onPlaceProject}
          render={(p, drag) => (
            <Fragment key={p.id}>
              <Item
                id={p.id}
                kind="project"
                drag={drag}
                glyph={<ProjectMark {...markOf(p)} size={glyphSize} />}
                label={p.name}
                on={view === 'projects' && project === p.id}
                onClick={() => leaving(onProject)(p.id)}
                onNear={() => onProjectNear(p.id)}
              />
              {/*
                Where the open project's tools go when its column is folded
                away — under its own row, as Linear keeps a team's views
                under the team. The project screen draws into it, so the
                tools, their counts and the one that is lit are said in one
                place. The open project's row is always drawn, behind
                "n more" or not (`Capped`'s `pinned`), so its tools always
                have somewhere to fold into.
              */}
              {wide && view === 'projects' && project === p.id && (
                <div ref={foldSlot} data-fold-slot className="relative -mt-1 flex shrink-0 flex-col" />
              )}
            </Fragment>
          )}
        />
        {/* Nothing yet, and nothing said about it to somebody who may start
          one: the plus on the heading is the way, and the screen beside it
          is the first project's name and button. A New project row under
          the heading was a third door to the same room. */}
        {loaded && projects.length === 0 && !can.includes('project.create') && <Empty>{SAYS.noneYet}</Empty>}

        {/*
        Every room this person is in, flat.
        A channel lives in its project and is reached from it too, but nobody
        opens four projects to find out who said something — the reason to
        come back to a conversation is the conversation.
      */}
        <Heading
          action={
            (people.length > 0 || canChannel) && (
              /* One plus for both things a chat starts: it opens a window with
               a channel first and a direct message second.
               "Start a conversation" and not
               "Message somebody": the composer is labelled Message, and two
               things whose names share a word are two things a test and a
               screen reader cannot tell apart. */
              /* The same control as the projects' plus above it — its
                 ground under the pointer included (`data-control`). */
              <button
                data-control
                data-testid="start-dm"
                aria-label={PLACES.startAConversation}
                title={PLACES.startAConversation}
                onClick={() => onNewChat()}
                className="flex size-6 shrink-0 items-center justify-center text-ink-3"
                style={{ borderRadius: 'var(--r-field)' }}
              >
                <Icon name="plusThin" size={16} />
              </button>
            )
          }
        >
          {/* The way to every room, the way Projects' heading is the way to
            every project — `docs/specs/sidebar.md`, "The Chats page". The
            same button, lit under the pointer the same way. */}
          <button
            data-testid="nav-chats"
            onClick={() => leaving(onView)('chat')}
            className="-mx-2 -my-1 rounded-[var(--r-row)] px-2 py-1 text-left transition-colors group-data-[shut]/sidebar:hidden mouse:hover:bg-[var(--hover)] mouse:hover:text-[var(--ink-2)]"
          >
            {W.chat}
          </button>
        </Heading>
        <Capped
          items={rooms.filter((r) => !r.hidden)}
          cap={caps.rooms}
          /* The open room too, among the ones shown. One somebody put away
             stays under Hidden while it is read: putting it away was the
             choice, and reading it again does not take that back. */
          pinned={room}
          tail={rooms.filter((r) => r.hidden)}
          more={W.moreChats}
          onPlace={onPlaceRoom}
          onMove={onMoveRoom}
          render={(r, drag) => (
            /* A right press puts a room away or brings it back —
             `docs/specs/sidebar-hide.md`. */
            <div
              key={r.id}
              className="contents"
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ id: r.id, hidden: Boolean(r.hidden), beside: Boolean(besideRoom?.(r.id)), x: e.clientX, y: e.clientY })
              }}
              /* ⌥ and a press: the room beside the work rather than in
                 place of it. */
              onClickCapture={(e) => {
                if (!e.altKey || !onRoomBeside || !besideRoom?.(r.id)) return
                e.preventDefault()
                e.stopPropagation()
                leaving(onRoomBeside)(r.id)
              }}
            >
              <Item
                key={r.id}
                id={r.id}
                kind="room"
                drag={drag}
                /* The same face the row is about: the project's mark for its
               channel, the person's avatar for a conversation with them. */
                glyph={
                  (r.channel ?? Boolean(r.project_id)) ? (
                    /* A channel is a hash, as in Slack, whichever project it is
                   in: its name already says which. */
                    <span className="flex shrink-0 items-center justify-center text-ink-2" style={{ width: glyphSize, height: glyphSize }}>
                      <Icon name="hash" size={16} />
                    </span>
                  ) : (
                    <Avatar
                      name={r.others ?? W.direct}
                      size={glyphSize}
                      {...(r.other_id ? { id: r.other_id } : {})}
                      url={r.other_avatar_url ?? null}
                      {...(r.other_presence ? { presence: r.other_presence } : {})}
                    />
                  )
                }
                /* One line, the way Slack lists them: `acme-rebrand-main`. */
                label={roomName(r)}
                badge={roomCount(r).count || roomCount(r).quiet}
                urgent={roomCount(r).urgent}
                quiet={roomCount(r).count === 0 && roomCount(r).quiet > 0}
                fresh={roomCount(r).fresh}
                muted={r.notify === 'none'}
                /* The room being read, from the column or from its project's
               Chat tab: the caller says which from the address. */
                on={room === r.id}
                onClick={() => leaving(onRoom)(r.id)}
                onNear={() => onRoomNear(r.id)}
              />
            </div>
          )}
        />
        {menu && <Over onClose={() => setMenu(null)} />}
        {menu && (
          <div
            data-over
            ref={menuBox}
            data-room-menu
            role="menu"
            className="fixed z-40"
            style={{ left: Math.min(menu.x, window.innerWidth - 196), top: menu.y, width: 180 }}
          >
            <Glass data-fluid data-menu radius={16} className="overflow-hidden py-1">
              {/* Its own light: the menu is drawn inside the column, whose
                  rows travel one light of their own and leave a row of this
                  menu unlit under the hand. */}
              <Fluid />
              {menu.beside && onRoomBeside && (
                <button
                  role="menuitem"
                  data-row
                  data-testid="room-beside"
                  onClick={() => {
                    setMenu(null)
                    leaving(onRoomBeside)(menu.id)
                  }}
                  className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                  style={{ height: 'var(--row-h)' }}
                >
                  <Icon name="panel" size={16} className="text-ink-2" style={{ transform: 'scaleX(-1)' }} />
                  {CHAT.openBeside}
                </button>
              )}
              <button
                role="menuitem"
                data-row
                data-testid={menu.hidden ? 'room-show' : 'room-hide'}
                onClick={() => {
                  onHideRoom(menu.id, !menu.hidden)
                  setMenu(null)
                }}
                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <Icon name={menu.hidden ? 'eye' : 'eyeOff'} size={16} className="text-ink-2" />
                {menu.hidden ? W.showInList : W.hide}
              </button>
            </Glass>
          </div>
        )}
        {/* Said only once it is known. "No conversations" while they are still
          arriving is a claim the interface is not in a position to make. */}
        {loaded && rooms.length === 0 && <Empty>{SAYS.noConversations}</Empty>}

        {/* Nothing under the work. Settings was the last row of the
          column and is the one row in it that is not a place in this
          workspace, so it went up to the bar with the rest of what is
          about the window. */}
      </div>
    </aside>
  )
}

const Group = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  // Two pixels between rows: flush together they read as one block, and a
  // real gap reads as a list of separate things.
  //
  // The eight above a group is what sets it apart from the one before it,
  // so the first group has nothing to be set apart from — and those eight
  // pixels put the column's first row below the first row of the column
  // beside it, which has a heading standing in that space instead.
  //
  // Said by the caller rather than by a CSS position: the glow `Fluid`
  // paints is a plain div and comes first, so neither `:first-child` nor
  // `:first-of-type` picks out the first group. Both were tried, and both
  // matched nothing — which looks exactly like the rule working and the
  // number being wrong.
  <div className={`flex shrink-0 flex-col gap-1 ${first ? '' : 'pt-2'}`}>{children}</div>
)

/** How many of a growing list the sidebar shows at the least, whatever room. */
const SHOWN = 8

/**
 * The room shared between the two lists: all of both when they fit, and
 * when they do not, each at least `SHOWN` and the projects no more than
 * half, so a workspace with sixty projects still shows its chats.
 */
function share(room: number, projects: number, rooms: number) {
  if (projects + rooms <= room) return { projects, rooms }
  const forProjects = Math.max(SHOWN, Math.min(projects, room - Math.min(rooms, Math.floor(room / 2))))
  return { projects: forProjects, rooms: Math.max(SHOWN, room - Math.min(projects, forProjects)) }
}

/**
 * A section with a ceiling.
 *
 * The sidebar had none: projects and rooms both grew without limit, so at
 * fifteen projects Settings was already below the fold and at forty the whole
 * thing was unusable. A list of eight and a way to see the rest is the shape
 * that still works at four hundred.
 */
function Capped<T extends { id: string }>({
  items,
  cap = SHOWN,
  pinned = null,
  tail = [],
  render,
  more,
  onPlace,
  onMove,
}: {
  items: T[]
  /** How many to show before "more" — as many as the column has room for. */
  cap?: number
  /** The row that is open, drawn even when its place is behind "more". */
  pinned?: string | null | undefined
  /** Rows that are always behind "more", whatever room there is above —
      the ones somebody put away. */
  tail?: T[]
  render: (item: T, drag: { held: boolean; drop: 'above' | 'below' | null }) => React.ReactNode
  /** What the last row says when there are more. */
  more: (n: number) => React.ReactNode
  /** Where a row was dragged to, if this list can be rearranged at all. */
  onPlace?: ((id: string, after: string | null) => void) | undefined
  /** A row dragged into the tail or out of it — only a list that has one. */
  onMove?: ((id: string, to: Move) => void) | undefined
}) {
  const [all, setAll] = useState(false)
  const rest = Math.max(0, items.length - cap) + tail.length
  /*
   * Only what is on the screen can be rearranged — and the tail is a place.
   *
   * This said "n more" was a way in and not a place to put things: a row
   * cannot be dropped behind something nobody can see. The author reversed
   * that — `docs/specs/sidebar-hide.md`. Open, the rooms put away are drawn
   * under a "Hidden" label, and a room dragged below it is put away, one
   * dragged above it brought back. Shut, "n more" itself is what a room is
   * dropped on to put it away. A list without a tail — the projects — has
   * neither, and drags exactly as it did.
   */
  const marked = all && tail.length > 0 && !!onMove
  /*
   * The open row, when its place is behind "more", takes the last place
   * before it.
   *
   * Opened from the palette, from a link or from the open list, a project
   * past the cap had no row in the column — and so nowhere for its tools to
   * fold into, which kept its own column open on a window that had folded
   * it. Now the list draws one fewer of the order and then the open row:
   * the column is as tall as it was, everything above keeps its place, and
   * the one row that gives way is the last. "n more" counts the same,
   * because what is behind it is the same number of rows.
   *
   * Drawn out of place, it is still at its place in the order — so a gap
   * beside it is not a place in the order either. The gap above it is the
   * gap between the two rows drawn there; the gap below it would put a row
   * behind the far-off one it stands for, out of sight, so it is the same
   * gap as the one above.
   */
  const head = cappedRows(items, cap, all ? null : pinned)
  const lifted = !all && head.lifted
  const shown = all ? [...items, ...tail] : head.shown
  const order = marked ? [...items.map((i) => i.id), MARK, ...tail.map((i) => i.id)] : shown.map((i) => i.id)
  const target = !all && rest > 0 && !!onMove
  const reorder = useReorder({
    ids: order,
    enabled: !!onPlace,
    onDrop: (id, after, at) => {
      if (!marked) {
        const behind = landing(order, lifted, pinned, id, after)
        if (behind !== undefined) onPlace?.(id, behind)
        return
      }
      /* Which part the gap is in, and its neighbours there — not across the
         label, which is the line between the two parts. */
      const v = items.length
      const hidden = at > v
      const lo = hidden ? v + 1 : 0
      const hi = hidden ? order.length : v
      const prev = at - 1 >= lo ? order[at - 1]! : null
      const next = at < hi ? order[at]! : null
      onMove?.(id, { hidden, after: prev, before: next })
    },
    onDropOn: (id) => onMove?.(id, { hidden: true, after: null, before: null }),
  })
  const lit = reorder.on === MORE
  /* The gap below a lifted row is drawn as the one above it, which is where
     a row let go there lands. */
  const gap = lifted && reorder.at === order.length && reorder.id !== pinned ? order.length - 1 : reorder.at
  return (
    <div data-order-list {...(onPlace ? reorder.handlers : {})} className="contents">
      {shown.map((item, i) => {
        /* Where the row stands among what is drawn, the label counted. */
        const k = marked && i >= items.length ? i + 1 : i
        return (
          <Fragment key={item.id}>
            {marked && i === items.length && <HiddenMark line={gap === items.length} />}
            {render(item, {
              held: reorder.id === item.id,
              /* The line goes above the row the gap is above, and below the
                 last row when the gap is past the end. Drawn by the row
                 because the rows are the only boxes here — the list itself
                 has none. The gap just above the label is the label's. */
              drop: gap === k ? 'above' : gap === order.length && k === order.length - 1 ? 'below' : null,
            })}
          </Fragment>
        )
      })}
      {rest > 0 && (
        /* A row like the ones above it, lit by the same travelling light
           and with a glyph where theirs are, so it reads as a thing to
           press rather than a caption under the list.

           While a room is carried and the list is shut, it is where the
           room goes to be put away, lit in the drop line's colour — a ring
           and a tint, which take no room, so nothing under it moves. */
        <Row
          data-testid="show-more"
          aria-expanded={all}
          {...(target ? { 'data-order-target': MORE } : {})}
          {...(lit ? { 'data-lit': '' } : {})}
          onClick={() => setAll((v) => !v)}
          className="group relative flex w-full shrink-0 items-center gap-3 px-2 text-left text-base group-data-[shut]/sidebar:size-10 group-data-[shut]/sidebar:justify-center group-data-[shut]/sidebar:px-0"
          style={{
            minHeight: 'var(--nav-h)',
            borderRadius: 'var(--r-row)',
            letterSpacing: 'var(--track-body)',
            color: lit ? 'var(--accent)' : 'var(--ink-2)',
            ...(lit
              ? {
                  boxShadow: 'inset 0 0 0 2px var(--accent)',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                }
              : {}),
          }}
        >
          <span className="flex size-5 shrink-0 items-center justify-center" style={{ color: lit ? 'var(--accent)' : 'var(--ink-3)' }}>
            <Icon
              name="chevR"
              size={14}
              style={{ transform: all ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 160ms ease-out' }}
            />
          </span>
          <span className="truncate group-data-[shut]/sidebar:hidden">{all ? W.showLess : more(rest)}</span>
        </Row>
      )}
    </div>
  )
}

/** Where a row was dropped across the tail's edge: put away or not, and between which two. */
export type Move = { hidden: boolean; after: string | null; before: string | null }

/** The ids the label and "n more" stand under in a drag — never a row's. */
const MARK = 'hidden-mark'
const MORE = 'show-more'

/**
 * Where the rooms put away begin, in an open list.
 *
 * The column's group label, closer in its spacing: it is a line inside one
 * list rather than the head of another. Counted in a drag, so the gap above
 * it and the gap below it are two places — shown, and put away — and the
 * drop line is drawn at its top when the gap above it is the one. Shut, a
 * short rule, as a heading is.
 */
const HiddenMark = ({ line }: { line: boolean }) => (
  <div data-order-mark={MARK} data-testid="hidden-mark" className="relative shrink-0">
    {line && (
      <span
        data-drop="above"
        aria-hidden
        className="pointer-events-none absolute right-0 left-0 flex items-center"
        style={{ top: -3, height: 2 }}
      >
        <span className="shrink-0 rounded-full bg-accent" style={{ width: 6, height: 6 }} />
        <span className="h-1 flex-1 bg-accent" />
      </span>
    )}
    <div
      className="px-2 pt-2 pb-1 text-base group-data-[shut]/sidebar:hidden"
      style={{ color: 'var(--ink-3)', letterSpacing: 'var(--track-body)' }}
    >
      {W.hidden}
    </div>
    <div aria-hidden className="mx-auto my-2 hidden h-px w-8 bg-line group-data-[shut]/sidebar:block" />
  </div>
)
/**
 * A section's name, with the way to add to it at the other end.
 *
 * The same shape a band's strip has in a list of tasks: the heading says
 * what these are, and the plus makes one of them here. They were rows at
 * the foot of each section — "New Project" under the projects, "+ Message
 * somebody" under the rooms — which reads as one more of the things above
 * it, is the furthest point from the heading it belongs to, and moves every
 * time the list above it grows.
 */
const Heading = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <>
    <div className="flex shrink-0 items-end pr-2 group-data-[shut]/sidebar:hidden">
      {/* The label's own inset is the one every other screen's group uses;
        here it stands in the column's glyph line, which is eight in. */}
      <span className="min-w-px flex-1 [&>*]:px-2">
        <GroupLabel>{children}</GroupLabel>
      </span>
      {action && <span className="shrink-0 pb-1">{action}</span>}
    </div>
    {/* Shut, a group's heading is a line: its name has gone with the
      column's words, and a lone plus between the projects and the rooms
      read as a thing to press rather than as where one list ends. */}
    <div aria-hidden className="mx-auto my-2 hidden h-px w-8 shrink-0 group-data-[shut]/sidebar:block bg-line" />
  </>
)
const Empty = ({ children }: { children: React.ReactNode }) => <div className="px-2 py-1 text-base text-ink-3">{children}</div>

function Item({
  label,
  hint,
  badge = 0,
  urgent = false,
  fresh = false,
  muted = false,
  quiet = false,
  on,
  onClick,
  onNear,
  testId,
  kind,
  glyph,
  id,
  drag,
}: {
  label: string
  hint?: string | undefined
  badge?: number
  /** The count is for somebody naming you — red. */
  urgent?: boolean
  /** Something new in it, counted or not — the name is heavier. */
  fresh?: boolean
  /** Told to say nothing — the name is quieter. */
  muted?: boolean
  /** The count is a turned-down room's — grey, asking nothing. */
  quiet?: boolean
  on: boolean
  onClick: () => void
  /** The pointer arriving, for a row that is worth getting ready. */
  onNear?: (() => void) | undefined
  testId?: string
  /** What sort of row this is, so a project and a room in it are tellable apart. */
  kind?: 'project' | 'room'
  glyph?: React.ReactNode
  /** The id the order is kept under, on the rows that can be rearranged. */
  id?: string
  /** Whether this is the row being carried, and how far. */
  drag?: { held: boolean; drop: 'above' | 'below' | null }
}) {
  return (
    <Row
      selected={on}
      onClick={onClick}
      onPointerEnter={onNear}
      data-order={id}
      data-project={kind === 'project' ? '' : undefined}
      data-room={kind === 'room' ? '' : undefined}
      data-testid={testId}
      /* The name, for when the label is not drawn. Always set rather than
         only when shut: a row whose title appears and disappears is a
         tooltip that behaves differently depending on a width. */
      title={label}
      /*
       * Shut, the row is a square around its tile rather than a strip the
       * width of what is in it.
       *
       * It was 28 wide against a 32 tile — the tile hung two pixels out
       * either side, and the travelling highlight, which copies the row's
       * own box, came out narrower than the thing it was lighting and read
       * as a vertical pill. `docs/specs/collapsed-sidebar.md`.
       */
      className={`group relative flex w-full shrink-0 items-center gap-3 px-2 text-left text-base group-data-[shut]/sidebar:size-10 group-data-[shut]/sidebar:justify-center group-data-[shut]/sidebar:gap-0 group-data-[shut]/sidebar:px-0`}
      style={{
        /* A minimum rather than a height: a row with a project under its name
           is two lines tall, and every other row in the sidebar is one. */
        minHeight: 'var(--nav-h)',
        paddingBlock: hint ? 5 : 0,
        borderRadius: 'var(--r-row)',
        letterSpacing: 'var(--track-body)',
        /* Full strength whatever the state, like every other row — the
           ground under the open one is what says which it is. */
        color: 'var(--ink)',
        /* The row being carried stays where it is and goes quiet: what
           answers "where will this land" is the line, and a row that is also
           moving is a second answer to the one question. */
        ...(drag?.held ? { opacity: 0.4, cursor: 'grabbing' } : {}),
        /* Vertical panning is left alone, so a finger can still scroll the
           sidebar. Which means a drag with a finger is not this gesture —
           that wants a long press, and is not built. */
        touchAction: id ? 'pan-y' : undefined,
        /* Selection is the whole row, not a bar at its edge. The rail was
           there to mark a row without changing its ground; with a ground to
           change, it is a second answer to the same question. */
        background: on ? 'var(--hover)' : undefined,
      }}
    >
      {/*
        Where it will land, drawn over the rows and taking no space.
        
        That is the whole difference from the line the board refused: one
        inserted into the flow moved everything below it by two pixels, which
        changed what was under the pointer, which moved the line. This one
        moves nothing. The dot at the left end is what tells it from a
        hairline between two rows.
      */}
      {drag?.drop && (
        <span
          data-drop={drag.drop}
          aria-hidden
          className="pointer-events-none absolute right-0 left-0 flex items-center"
          style={{ [drag.drop === 'above' ? 'top' : 'bottom']: -3, height: 2 }}
        >
          <span className="shrink-0 rounded-full bg-accent" style={{ width: 6, height: 6 }} />
          <span className="h-1 flex-1 bg-accent" />
        </span>
      )}
      {/* On a two-line row the glyph hangs from the top of the first line,
          not between the two: it is the project's or the person's, and that
          is what the first line names. Its top meets the top of the capitals,
          which sit 5px into a 20px line of 14px text — the edge of the line
          box is invisible, and lining up with it reads as sitting too high. */}
      {/*
        The accent says where you are, not what everything is.
        
        All four of these glyphs were the accent at all times, so the column
        had four permanent blue spots carrying no information — and the one
        thing colour was wanted for, which row you are on, had to be said by
        the ground alone. The project's own tabs, one column to the right,
        have always done it the other way: accent on the tool you are in,
        quiet on the rest. This is that rule, applied where it was missing.
        
        A mark of its own — a project's, a person's — ignores this and keeps
        its colour, which is the point of having one.
      */}
      {glyph && (
        <span
          /*
           * Hung from the top of a two-line row and centred in a one-line
           * one — and shut, every row is one line.
           *
           * A room carries its project as a second line, so the hint was
           * set and the glyph took the top alignment it is for: in the
           * narrow column that pushed the tile nine pixels below its own
           * row and one past the bottom of it, which is the "chats are out
           * of line" this had. The rule is about the second line, so it
           * goes when the second line does.
           */
          className="relative flex shrink-0 group-data-[shut]/sidebar:!mt-0 group-data-[shut]/sidebar:!self-center"
          style={{
            color: on ? 'var(--accent)' : 'var(--ink-3)',
            ...(hint ? { alignSelf: 'flex-start', marginTop: 4 } : {}),
          }}
        >
          {glyph}
          {/*
            How much is waiting, on the tile, when there is no row left to
            put it at the end of.
            
            The top corner and not the bottom one, which the chat bubble
            already has: a count is news and is looked for, a bubble says
            what kind of row this is and is read in passing. Two marks on a
            32px tile is tight, and they are on opposite corners for that
            reason. `docs/specs/collapsed-sidebar.md`.
          */}
          {badge > 0 && (
            <span
              data-shut-badge
              aria-hidden
              className="pointer-events-none absolute -top-1 -right-1 hidden h-4 min-w-4 items-center justify-center px-1 text-badge font-medium tabular-nums group-data-[shut]/sidebar:flex"
              style={{
                background: urgent ? 'var(--danger)' : quiet ? 'var(--track)' : 'var(--accent)',
                color: urgent ? '#fff' : quiet ? 'var(--ink-3)' : 'var(--on-accent)',
                borderRadius: 8,
                /* Held off the tile and off whatever it overhangs, in the
                   colour of the column behind it. */
                boxShadow: '0 0 0 2px var(--chrome)',
              }}
            >
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
      )}
      {/*
        Two lines when the room belongs to a project, and the project is the
        first of them.
        
        It was one line with the project's name pushed to the right edge, and
        the thing that tells three rooms called Team apart was the furthest
        word on the row from the one being read. Down the left is where a
        list is read; across to the right is where it is searched.
        
        A direct conversation has no project and gets no second line. An empty
        one would be a row pretending to the height of something it does not
        have.
      */}
      {/*
        The name, and nothing where the name was when the column is shut.
        
        Hidden with CSS rather than left out of the tree: the row is the same
        row either way, and a column that renders differently in the two
        states is two rows to keep working. The browser's own tooltip on the
        row carries the name — late by about a second, which is right for
        something that confirms a guess rather than something to read.
        `docs/specs/collapsed-sidebar.md`.
      */}
      <span className="flex min-w-px flex-1 flex-col justify-center group-data-[shut]/sidebar:hidden">
        {/* Named, so a test can read the row's name without reading the
            row: the count and the project line are in the same box, and
            scraping the text and stripping the rest broke the moment the
            shut column learned to carry a count. */}
        <span
          data-name
          data-muted={muted || undefined}
          /* Where you are, and what has something new, at full ink; every
             other place quieter (`--side-ink`), so the column reads as the
             one place lit and the rest waiting. Under the pointer it comes
             up — `theme.css`, `[data-side-name]`. */
          data-side-name={on || fresh ? undefined : ''}
          className={`truncate ${fresh && !on ? 'font-semibold' : ''}`}
          style={muted ? { color: 'var(--ink-3)' } : on || fresh ? undefined : { color: 'var(--side-ink)' }}
        >
          {label}
        </span>
        {hint && <span className="truncate text-sm leading-[1.35] text-ink-3">{hint}</span>}
      </span>
      <span className="group-data-[shut]/sidebar:hidden">
        <Badge count={badge} urgent={urgent} quiet={quiet} testId="inbox-count" />
      </span>
    </Row>
  )
}
