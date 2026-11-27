import type { ProjectInList } from '@tracker/shared-schema'
import { numbered, type Numbered } from '../data/route.js'
import { Tasks } from './Tasks.jsx'
import { ProjectSettings } from './ProjectSettings.jsx'
import { Activity } from './Activity.jsx'
import { type DocRow } from './Docs.jsx'
import { FileDetail } from './FileDetail.jsx'
import { PostDetail } from './PostDetail.jsx'
import { Chat } from './Chat.jsx'
import { ToolbarSlot } from './kit.jsx'
import { ORDER } from '../data/tools.js'
import { type Room } from './Sidebar.jsx'
import { filesList } from './project/filesList.jsx'
import { postsList } from './project/postsList.jsx'
import { projectHead } from './project/projectHead.jsx'
import { toolsNav } from './project/toolsNav.jsx'
import { useFold } from './project/fold.js'
import { useProjectContent } from './project/useProjectContent.js'
import { useProjectFrame } from './project/useProjectFrame.js'
import { useDocDeletes } from './project/useDocDeletes.jsx'

/* From the contract — `shared-schema/src/responses.ts`. Three screens each
   kept their own Project, differing only in what they left out. */
type Project = ProjectInList
/**
 * Rows on their way into a screen, and their numbers on the way to the
 * address.
 *
 * Here rather than at each of the four places a list lands: a list that
 * forgot to say would give the one screen a link with a uuid in it, and
 * nobody would notice until they sent one.
 */
export function keep<T extends { id: string; number?: number | null }>(rows: T[], project: string, kind: Numbered): T[] {
  numbered(rows, project, kind)
  return rows
}

export type Post = {
  id: string
  title: string
  /** The whole announcement — the card is where it is read. */
  body?: unknown
  /** How many replies, which stay behind the card. */
  reply_count?: number
  /** Who wrote it, so their face is the colour it is everywhere else. */
  author_id?: string
  author_name: string
  author_avatar_url?: string | null
  created_at: string
  schedule: string | null
  /** `author` while it is its author's draft, drawn first and marked. */
  audience?: string
}
export type FileRow = DocRow & {
  author_avatar_url?: string | null
}

export const firstTool = (tools: string[]): string => ORDER.find((t) => tools.includes(t)) ?? tools[0] ?? 'tasks'

export type ProjectProps = {
  project: Project
  canWrite: boolean
  canReadActivity: boolean
  /** Every room this person is in, so the chat tab asks for nothing. */
  rooms: Room[]
  /** The rooms asked for again, after one was renamed or thrown away here. */
  onRoomsChanged?: () => Promise<void>
  /** Unread announcements here, for the badge on the tab. */
  waitingPosts: number
  /** Changes when something was made here from somewhere else. */
  revision: number
  can: string[]
  onChanged: () => Promise<void>
  onGone: () => void
  /** Which tab, which thing inside it, and how it is being looked at — all
   *  from the address bar, so every one of them can be sent to somebody. */
  tool: string
  objectId: string | null
  mode: string
  /* How the list is being looked at, from the address. */
  group: string
  sort: string
  dir: string
  who: string
  /** Which labels narrow the list, by id, comma-separated; empty is any. */
  labels: string
  /** Which one list is on the screen, or null for all of them. */
  list: string | null
  /** Which of Files' places the address names — a kind or `deleted` — or
      null for a bare `/files`. */
  kind: string | null
  onNavigate: (
    to: {
      tool?: string | undefined
      objectId?: string | null | undefined
      mode?: string | undefined
      /* How the list is being looked at. */
      group?: string | undefined
      sort?: string | undefined
      dir?: string | undefined
      who?: string | undefined
      labels?: string | undefined
      list?: string | null | undefined
      /** Files' place; `null` leaves it for a bare `/files`. */
      kind?: string | null | undefined
    },
    how?: 'settle',
  ) => void
  /** Whose echo to ignore on the socket. */
  meId: string
  /** On a workspace's own domain that keeps inviting shut, this project's
      settings at usetuff.com, for its Invite someone new — `inviteAway`. */
  inviteAway?: string | null | undefined
}

export function Project({
  project,
  canWrite,
  canReadActivity,
  rooms,
  onRoomsChanged,
  waitingPosts,
  revision,
  can,
  onChanged,
  onGone,
  tool,
  objectId,
  mode,
  group,
  sort,
  dir,
  who,
  labels,
  list,
  kind,
  onNavigate: navigate,
  meId,
  inviteAway = null,
}: ProjectProps) {
  const {
    canSettings,
    resolving,
    onNavigate,
    posts,
    setPosts,
    folder,
    beat,
    setBeat,
    slot,
    setSlot,
    toolsWidth,
    setToolsWidth,
    toolsInitial,
    wide,
    phone,
    shown,
    held,
    setThreadWide,
    objectHead,
    barHeld,
    waiting,
    warmRooms,
    asked,
  } = useProjectFrame({
    project,
    canReadActivity,
    rooms,
    waitingPosts,
    can,
    tool,
    objectId,
    navigate,
  })
  /* Folded into the sidebar only where the sidebar has a place for it:
     below the breakpoint, or before the sidebar has drawn the project's
     row, the column stays. */
  const { folded: foldWanted, moving: foldMoving, slot: foldPlace } = useFold()
  const folded = wide && foldWanted && !!foldPlace
  const {
    load,
    files,
    setFiles,
    kinds,
    answered,
    found,
    findSettled,
    more,
    readMore,
    newDocument,
    doors,
    docsFilter,
    setDocsFilter,
    docsWhose,
    setDocsWhose,
    inBin,
    openBin,
    docsWords,
    setDocsWords,
    linking,
    setLinking,
    picker,
    going,
    dropping,
    setDropping,
    sendUp,
    putUp,
    stopUp,
    addLink,
  } = useProjectContent({
    project,
    canWrite,
    revision,
    objectId,
    meId,
    resolving,
    onNavigate,
    setPosts,
    folder,
    beat,
    setBeat,
    shown,
    asked,
    kind,
  })

  /* A row in Docs deleted, and offered back.
     Your own always; somebody else's with `file.delete`. */
  const docDeletes = useDocDeletes({ setFiles, load, active: shown === 'files' })
  const mayDeleteFile = (authorId: string | undefined) => authorId === meId || can.includes('file.delete')

  /**
   * Opening something to the client is a deliberate act on that object.
   *
   * Not a project-wide mode and not a screen of checkboxes elsewhere: the
   * decision belongs where the thing is, so nobody has to remember what a
   * separate settings page said.
   */

  return (
    /* The gap between the two columns this screen owns. The shell sets the
       one between the sidebar and here; this is the same token, so all
       three sheets stand the same distance apart. */
    /* No gap of its own: the gap after the tools column is the column's,
       so it can fold away with it. */
    <div className="flex h-full">
      {/*
        The tools as a column of their own, not a row of tabs.
        
        One navigation model everywhere: workspace → project → tool, and now
        each of the three is a step to the right rather than two steps down
        and one across. A tab bar puts the tools in the path of the content —
        a board starts under them, a room starts under them — and it has room
        for their names and nothing else. A column has room to say more: what
        is unread, what is overdue, which channel.
        
        It costs 212px of width, which is the whole argument against it. The
        board is the screen that feels it.
      */}
      {/*
        The tools as a column, while there is width for one.
        
        Below the breakpoint they go back to being a row of tabs above the
        work — which is what they were before the column and what the design
        calls them. The column costs 212px and the whole argument for it was
        that 212px were there to spend. `docs/specs/narrow.md`.
      */}
      {toolsNav({
        project,
        canReadActivity,
        rooms,
        can,
        canSettings,
        onNavigate,
        toolsWidth,
        setToolsWidth,
        toolsInitial,
        wide,
        shown,
        waiting,
        warmRooms,
        folded,
        moving: foldMoving,
        slot: foldPlace,
      })}

      {/* The work, the third sheet. The two columns beside it are chrome and
          this is what they are chrome for, so it is the one that is lighter
          — `--surface` against their `--chrome`. */}
      <div
        data-panel
        className="flex min-w-px flex-1 flex-col overflow-hidden bg-chrome"
        /* A sheet on a phone too, with its corners: the work stood straight
           on the window's black there, while the same screen on a desk is a
           card — one product drawn two ways. */
        style={{
          borderRadius: 'var(--r-lift)',
        }}
      >
        {/*
          The same four, as a row, when there is no column for them. The
          project's name comes with them: the column carried it, and without
          either there is nothing on the screen saying which project this is.
        */}

        {/*
          The tool's own bar: what it is called on the left, what it can do on
          the right.
          
          Always there and always the same height, whether or not the tool
          puts anything on it. Sized to its contents it collapsed on Settings
          and stood up on Tasks, so switching tabs moved everything below it
          by thirty-two pixels — the second-largest jump in the product, and
          one nobody would think to look for in an empty div.
          
          It is a full-width slot rather than a right-aligned one, because it
          was a strip of nothing with a button at the far end of it once the
          view switch moved into the panel. A tool that has something to say
          on the left says it with `mr-auto`.
        */}
        {/*
          Held to 1200 and stood in the middle, like an open task.
          
          A list of tasks is a column of sentences, and across a 2700px
          window a title at the far left and a button at the far right had a
          metre of nothing between them while the row underneath ran the
          whole way. The measure is the same one `TaskDetail` uses, and it
          is on the bar as well as the work, or the name of the screen sits
          somewhere its contents do not.
          
          Except the board, which takes the width. The rule is about reading:
          a line of text past a certain length is one the eye loses its place
          in, and columns of cards are not lines. Held to 1200 a board of
          five lists showed three of them on a screen with room for six,
          which is taking something away and giving nothing back.
        */}
        {/* The gutter goes inside the measure, on the bar as on the work
            below it. Outside it, the two boxes were both 1200 but one of
            them counted the gutter and the other did not, so the button
            that makes a task sat thirty-two pixels right of where the tasks
            end — the one alignment this is for. */}
        {/* Over an open task the bar is the task's own head — its way back,
            its handle and its controls across the whole width — and a light
            line under it says where the head ends and the task begins. */}
        {projectHead({
          project,
          canReadActivity,
          canSettings,
          onNavigate,
          setSlot,
          wide,
          phone,
          shown,
          objectHead,
          barHeld,
        })}

        <ToolbarSlot value={slot}>
          <div
            data-tool-body
            /* Twelve at the head. The title and the controls ride on this too,
           which is why the number is here rather than on the list — they
           are one block and it is the block being placed.
           
           It was nothing for a moment, which put the sheet level with the
           Tasks tab in the column beside it and pressed it against the
           title above. Level with a thing in another column is worth less
           than room between two things in this one. */
            /*
             * The same gutter on both sides, now that nothing is reserved.
             *
             * This used to be the gutter minus twelve. The pane inside reserved
             * twelve down its right for the scrollbar whether or not it was
             * scrolling, the sheet was painted inside that reservation, and so
             * the list stopped twelve short of where the bar above it ended
             * while its left edge sat where it should. Paying the reservation
             * back here put the two sides level again.
             *
             * `scrollbar-gutter` is gone — `theme.css` says why, and the short
             * of it is that a thumb which is transparent until the pointer
             * arrives takes no space to reserve against. With the reservation
             * went the reason for the compensation, and a compensation left
             * behind is an error of exactly the size it used to fix: the sheet
             * now reached twelve *past* the bar.
             */
            /*
             * No gutter on a phone: the sheet is the margin.
             *
             * The gutter is the inset from a column's edge to what is in it,
             * which is right where the column has room either side. On 390 it
             * stacked on the shell's own twelve and put the card at 28 — the
             * list reading as a narrow strip down the middle with two margins
             * nobody asked for. The shell's inset is the only one a phone
             * needs.
             */
            /* No padding of its own on a phone, on any side. The shell's
           twelve is the whole margin there — the sides were dropped when
           the card was put at twelve, and the foot kept a twenty-four that
           sat under it and read as the list stopping short of the screen.
           The chat's foot is its typing slot's twenty and four more: the
           twenty-four under the line to write on read as a gap. */
            className={`mx-auto flex min-h-0 w-full flex-1 flex-col px-[var(--gutter)] pt-3 ${shown === 'messages' ? 'pb-1' : 'pb-6'} max-sm:pb-[var(--gutter)] ${held}`}
          >
            {shown === 'tasks' && (
              <Tasks
                /*
                 * A new project is a new screen, not the old one rewritten.
                 *
                 * Without this the component kept the project it was last on
                 * while the new one's lists were still arriving — so the bar drew
                 * the previous project's chips, and the travelling highlight slid
                 * across to the new ones a moment later. A segmented control's
                 * chip moves between *answers*, which is what it is for; a screen
                 * arriving is not somebody choosing, and nothing should move on
                 * the way in.
                 *
                 * It costs the lists being refetched rather than shown from
                 * memory for one frame, which `recall` keyed by project gives
                 * back immediately anyway.
                 */
                key={project.id}
                projectId={project.id}
                projectKey={project.key}
                canWrite={canWrite}
                canEditAny={can.includes('content.edit.said')}
                /* This project's answers. Making tasks and deleting them are two
               permissions given one at a time — so
               the buttons follow them separately rather than following one
               workspace-wide "may write". */
                canMake={can.includes('task.create')}
                canDelete={can.includes('task.delete')}
                canRemind={can.includes('task.remind')}
                /* A task's own history is drawn beside it, behind the same
               permission as the project's feed. */
                canReadActivity={canReadActivity}
                list={list}
                revision={revision + beat}
                openId={objectId}
                mode={mode}
                group={group}
                sort={sort}
                dir={dir}
                who={who}
                labels={labels}
                onNavigate={onNavigate}
                meId={meId}
              />
            )}

            {/* An announcement, opened. There was a Reply button on every card
            that put the post's id in the address and rendered nothing. */}
            {shown === 'posts' && objectId && (
              <PostDetail
                /* One announcement's draft is not the next one's, and it
                   opens on what was read ahead for it. */
                key={objectId}
                postId={objectId}
                projectId={project.id}
                canWrite={canWrite}
                canEditAny={can.includes('content.edit.said')}
                canDeleteAny={can.includes('content.edit.said')}
                meId={meId}
                onClose={() => onNavigate({ objectId: null })}
                onChanged={() => setBeat((b) => b + 1)}
                /* Gone from the list at once; Undo reads it again. */
                onGone={(id, gone) => {
                  if (gone) setPosts((had) => had && had.filter((x) => x.id !== id))
                }}
              />
            )}

            {postsList({ project, canWrite, objectId, onNavigate, posts, setPosts, shown, load })}

            {shown === 'files' && objectId && (
              <FileDetail
                /* One document's draft is not the next one's — and the screen
               opens on what was read ahead for it. */
                key={objectId}
                meId={meId}
                fileId={objectId}
                projectId={project.id}
                projectKey={project.key ?? null}
                canMakeTasks={can.includes('task.create')}
                canWrite={canWrite}
                canEditAny={can.includes('content.edit.said')}
                mayDelete={mayDeleteFile}
                onDelete={(f) => {
                  /* Back to the list it was in, which no longer has it,
                     with the way to take it back at the foot. */
                  onNavigate({ objectId: null })
                  docDeletes.remove(f)
                }}
                onClose={() => onNavigate({ objectId: null })}
                onChanged={load}
              />
            )}
            {docDeletes.toast}

            {filesList({
              canWrite,
              objectId,
              onNavigate,
              files,
              setFiles,
              kinds,
              answered,
              found,
              findSettled,
              more,
              readMore,
              shown,
              load,
              newDocument,
              doors,
              docsFilter,
              setDocsFilter,
              docsWhose,
              setDocsWhose,
              inBin,
              openBin,
              projectId: project.id,
              /* Anybody who may write here may delete their own, and so
                 may have something to put back. */
              mayBin: canWrite || can.includes('file.delete'),
              meId,
              docsWords,
              setDocsWords,
              linking,
              setLinking,
              picker,
              going,
              dropping,
              setDropping,
              sendUp,
              putUp,
              stopUp,
              addLink,
              mayDelete: mayDeleteFile,
              onDelete: docDeletes.remove,
            })}

            {shown === 'messages' && (
              <Chat
                projectId={project.id}
                all={rooms}
                meId={meId}
                canMake={can.includes('channel.create')}
                canDelete={can.includes('channel.delete')}
                canMakeTask={can.includes('task.create')}
                canDeleteSaid={can.includes('content.edit.said')}
                onRoomsChanged={onRoomsChanged}
                onWide={setThreadWide}
                /* The room on the screen is the address's: `/messages/<room>`.
               A press on another room is a step; the room the tab settles
               on when the address names none is the same place said more
               precisely. So the sidebar, which reads only the address,
               lights the same room. */
                {...(objectId ? { open: objectId } : {})}
                onRoom={(id, how) => onNavigate({ objectId: id }, how)}
              />
            )}

            {shown === 'activity' && (
              <Activity projectId={project.id} revision={revision + beat} onOpen={(t, id) => onNavigate({ tool: t, objectId: id })} />
            )}

            {shown === 'settings' && (
              <ProjectSettings project={project} can={can} onChanged={onChanged} onGone={onGone} inviteAway={inviteAway} />
            )}
          </div>
        </ToolbarSlot>
      </div>
    </div>
  )
}
