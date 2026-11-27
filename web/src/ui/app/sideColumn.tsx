import { doorsAway, workspaceDoor } from '../../data/doors.js'
import { api } from '../../data/api.js'
import { type Route } from '../../data/route.js'
import { Sidebar } from '../Sidebar.jsx'
import { NewChat } from '../Channels.jsx'
import { rearranged } from './model.js'
import { WindowTitle } from './shell.jsx'
import { type AppState } from './useAppState.js'
import { type AppPlace } from './useAppPlace.js'
import { type ShellParts } from './shellParts.jsx'

/**
 * The column down the side: the sidebar, in a drawer below a laptop's width.
 */
export function sideColumn({
  me,
  projects,
  setProjects,
  people,
  channelDraft,
  setChannelDraft,
  navigate,
  view,
  rooms,
  setRooms,
  loaded,
  drawer,
  setDrawer,
  wide,
  column,
  setMaking,
  onProject,
  projectNear,
  roomNear,
  created,
  current,
  reading,
  reloadRooms,
  startDirect,
  roomBeside,
  besideRoom,
  listed,
  tabTitle,
}: Pick<
  AppState,
  | 'projects'
  | 'setProjects'
  | 'people'
  | 'channelDraft'
  | 'setChannelDraft'
  | 'navigate'
  | 'view'
  | 'rooms'
  | 'setRooms'
  | 'loaded'
  | 'drawer'
  | 'setDrawer'
  | 'wide'
  | 'column'
  | 'setMaking'
> & { me: NonNullable<AppState['me']> } & Pick<AppPlace, 'onProject' | 'projectNear' | 'roomNear'> &
  Pick<
    ShellParts,
    'created' | 'current' | 'reading' | 'reloadRooms' | 'startDirect' | 'roomBeside' | 'besideRoom' | 'listed' | 'tabTitle'
  >): React.ReactNode {
  return (
    <div
      className={wide ? 'contents' : 'fixed inset-y-0 left-0 z-40 flex'}
      /*
       * Shut, it is out of the way and out of reach.
       *
       * Slid off the edge it was still on the screen as far as everything
       * but the eye was concerned: Tab walked into it, a reader read it,
       * and the first test written against it could not tell it was
       * closed. `visibility` after the slide, so the slide is still
       * visible; `inert` for the rest.
       */
      {...(!wide && !drawer ? { inert: '' as unknown as boolean } : {})}
      style={
        wide
          ? undefined
          : {
              transform: drawer ? 'translateX(0)' : 'translateX(-100%)',
              visibility: drawer ? 'visible' : 'hidden',
              transition: drawer ? 'transform 180ms var(--ease-out)' : 'transform 180ms var(--ease-out), visibility 0s 180ms',
            }
      }
    >
      <Sidebar
        wide={wide}
        width={column.width}
        setWidth={column.drag}
        shut={column.shut}
        onReset={column.reset}
        onDone={column.done}
        onGrab={column.grab}
        moving={column.moving}
        /*
         * The order is one person's and lives on the server, so the sidebar
         * moves first and the request follows — the same bargain every other
         * write in here makes. `docs/specs/sidebar-order.md`.
         */
        onPlaceProject={(id, after) => {
          setProjects((was) => rearranged(was, id, after))
          void api(`/projects/${id}/place`, { method: 'POST', body: JSON.stringify({ after }) })
        }}
        onHideRoom={(id, hidden) => {
          /* Moved at once; the list is asked again after, which also puts
             it back if the server said no. `docs/specs/sidebar-hide.md`. */
          setRooms((was) => was.map((r) => (r.id === id ? { ...r, hidden } : r)))
          void api(`/conversations/${id}/hidden`, { method: 'PUT', body: JSON.stringify({ hidden }) })
            .catch(() => {})
            .finally(() => void reloadRooms())
        }}
        onPlaceRoom={(id, after) => {
          setRooms((was) => rearranged(was, id, after))
          void api(`/conversations/${id}/place`, { method: 'POST', body: JSON.stringify({ after }) })
        }}
        /*
         * Dragged across the "Hidden" label, or dropped on "n more" —
         * `docs/specs/sidebar-hide.md`. Moved at once, both ways; then the
         * two writes go out one after the other, hidden first and the place
         * second, so the order a reload reads is the one that was dropped.
         * Whatever the server says, the list is asked again after, which
         * puts it back if either was refused.
         *
         * The neighbours are the ones drawn in the dropped-into part of the
         * list. The order on the server is one list, shown and hidden rooms
         * mixed, so a drop at the head of a part — nothing drawn above it —
         * lands right before the row below it, which in the one list is
         * behind whatever is in front of that row.
         */
        onMoveRoom={(id, to) => {
          const order = rooms.map((r) => r.id).filter((x) => x !== id)
          const after = to.after ?? (to.before ? (order[order.indexOf(to.before) - 1] ?? null) : undefined)
          const was = rooms.find((r) => r.id === id)
          if (!was) return
          setRooms((had) => {
            const flipped = had.map((r) => (r.id === id ? { ...r, hidden: to.hidden } : r))
            return after === undefined ? flipped : rearranged(flipped, id, after)
          })
          void (async () => {
            if (Boolean(was.hidden) !== to.hidden)
              await api(`/conversations/${id}/hidden`, { method: 'PUT', body: JSON.stringify({ hidden: to.hidden }) })
            if (after !== undefined) await api(`/conversations/${id}/place`, { method: 'POST', body: JSON.stringify({ after }) })
          })()
            .catch(() => {})
            .finally(() => void reloadRooms())
        }}
        onLeave={() => setDrawer(false)}
        workspace={me.workspace}
        onMake={() => setMaking(true)}
        {...(workspaceDoor(me.can) ? { onWorkspaceSettings: () => navigate({ view: 'settings' }) } : {})}
        workspaceSettingsAway={doorsAway(me).settings}
        view={view}
        project={current}
        room={reading}
        projects={projects}
        /*
         * The room on the screen has nothing unread in it.
         *
         * It is true the moment it is opened, and the server agrees about a
         * second later: reading the first page is what marks it read, and
         * the word comes back round the socket. Waiting for that meant
         * pressing a conversation and watching its badge sit there for one
         * and a third seconds — measured, not guessed — which reads as a
         * press that did not land.
         *
         * Said as a rule rather than remembered as a change: whatever the
         * last fetch said, the room being read has no unread. So there is
         * nothing to undo if the server is slow and nothing to go stale if
         * it never answers.
         */
        rooms={listed.map((r) => (r.id === reading ? { ...r, unread: '0', mentions: 0 } : r))}
        loaded={loaded}
        can={me.can}
        onView={(v) => navigate({ view: v } as Route)}
        /*
          The project you are already in keeps the tab you are reading.
          
          It went to `/p/<id>` with no tool, which is a different address
          from `/p/<id>/tasks`, so pressing the project you are already on
          unmounted every tool, let the screen fall to a fifth of itself, and
          then an effect wrote the tab back and mounted it again. One click,
          two round trips through empty.
        */
        onProjectNear={projectNear}
        onProject={(id) =>
          navigate(
            id === current && onProject
              ? /* The tab you are reading, but not the thing open on top of
                   it: pressing the project takes you to the project. Keeping
                   the object as well meant the row you pressed left the task
                   detail exactly where it was. */
                {
                  view: 'projects',
                  projectId: id,
                  ...(onProject.tool ? { tool: onProject.tool } : {}),
                  ...(onProject.mode ? { mode: onProject.mode } : {}),
                }
              : { view: 'projects', projectId: id },
          )
        }
        onRoom={(id) => navigate({ view: 'chat', roomId: id })}
        onRoomNear={roomNear}
        onRoomBeside={wide ? roomBeside : undefined}
        besideRoom={besideRoom}
        onCreateProject={created}
        people={people.filter((p) => p.actor_id !== me.actor.id)}
        onNewChat={() => setChannelDraft(true)}
        canChannel={me.can.includes('channel.create.workspace')}
      />
      <WindowTitle title={tabTitle} />
      {channelDraft && (
        <NewChat
          canChannel={me.can.includes('channel.create.workspace')}
          people={people.filter((p) => p.actor_id !== me.actor.id)}
          onClose={() => setChannelDraft(false)}
          onDirect={(actorId) => {
            setChannelDraft(false)
            void startDirect(actorId)
          }}
          onMade={async (id) => {
            await reloadRooms()
            navigate({ view: 'chat', roomId: id })
          }}
        />
      )}
    </div>
  )
}
