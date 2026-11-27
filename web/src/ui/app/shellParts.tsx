import { edition } from '../../edition.jsx'
import { doorsAway, membersDoor, workspaceDoor } from '../../data/doors.js'
import { PLACES, HEADS } from '../../data/words.js'
import { LABEL } from '../../data/tools.js'
import { APP as W } from '../../words/app.js'
import { api } from '../../data/api.js'
import { type Route, setBeside } from '../../data/route.js'
import { ProjectMark, markOf } from '../icons.jsx'
import { type Destination } from '../Palette.jsx'
import { type IconName } from '../glyphs.jsx'
import { type Room, leftRoom, roomName as nameOfRoom } from '../Sidebar.jsx'
import { INSTANCE } from '../../words/instance.js'
import { type PersonDoors } from '../PersonCard.jsx'
import { inboxCount } from './model.js'
import { type AppState } from './useAppState.js'
import { type AppLoad } from './useAppLoad.js'
import { type AppPlace } from './useAppPlace.js'

/**
 * What the shell works out once somebody is signed in: the project and
 * room open, what they may do here, the titles, and the way to a place.
 */
export function shellParts({
  me,
  projects,
  archivedProjects,
  people,
  setShownPerson,
  navigate,
  phone,
  wide,
  beneath,
  view,
  audit,
  rooms,
  setRooms,
  setRevision,
  agents,
  unread,
  invites,
  load,
  onProject,
  keepLook,
  setAdding,
}: Pick<
  AppState,
  | 'projects'
  | 'archivedProjects'
  | 'people'
  | 'setShownPerson'
  | 'navigate'
  | 'phone'
  | 'wide'
  | 'beneath'
  | 'view'
  | 'audit'
  | 'rooms'
  | 'setRooms'
  | 'setRevision'
  | 'agents'
  | 'unread'
  | 'invites'
  | 'setAdding'
> & { me: NonNullable<AppState['me']> } & Pick<AppLoad, 'load'> &
  Pick<AppPlace, 'onProject' | 'keepLook'>) {
  /* The dialog makes it and hands back the id; this only has to bring the
     new one into the lists the sidebar and the index read from. */
  async function created() {
    await load()
  }

  const current = beneath.view === 'projects' ? (beneath.projectId ?? null) : null
  const room = beneath.view === 'chat' ? (beneath.roomId ?? null) : null
  /*
   * The room on the screen, wherever it was opened from: the column's room,
   * or a project's Chat tab, whose address names its room too. One row lit
   * in the column's Chat list either way. Not `room`, which is the
   * column's own screen and decides the phone's bar and the head over it.
   */
  const reading = room ?? (beneath.view === 'projects' && beneath.tool === 'messages' ? (beneath.objectId ?? null) : null)
  const project = projects.find((p) => p.id === current) ?? archivedProjects.find((p) => p.id === current) ?? null

  /* Opening a conversation with somebody, from the sidebar and from their
     own screen. One function, because it is one action. */
  /* The rooms alone, after one was made, renamed or thrown away: the whole
     shell read again for that is four queries for one list. */
  const reloadRooms = async () => {
    const r = await api<{ conversations: Room[] }>('/conversations')
    setRooms(r.conversations)
  }

  async function startDirect(actorId: string, beside = false) {
    /* Beside the work where there is room for it;
       as a screen where there is not, exactly as before. */
    const into = (id: string) => (beside && wide ? setBeside(id) : navigate({ view: 'chat', roomId: id }))
    /* The conversation with them that is already in the list opens as it
       is: a second one beside it is the same person twice. The server says
       the same if this list is behind. */
    const known = rooms.find((r) => !(r.channel ?? Boolean(r.project_id)) && r.other_id === actorId)
    if (known) {
      into(known.id)
      return
    }
    const r = await api<{ id: string }>('/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ actor_ids: [actorId] }),
    })
    /* Into the room as soon as it exists. It waited for the whole shell to
       be read again first — projects, people, rooms and the inbox — to open
       one conversation. The room is in the list at once with the name it
       will have; the read that follows fills in the rest. */
    const who = people.find((p) => p.actor_id === actorId)
    setRooms((had) =>
      had.some((x) => x.id === r.id)
        ? had
        : [...had, { id: r.id, project_id: null, name: null, others: who?.name ?? null, other_id: actorId }],
    )
    into(r.id)
    void load()
  }

  /* Whether somebody is an agent, whose conversation opens beside. */
  const isAgent = (actorId: string) => Boolean(people.find((p) => p.actor_id === actorId)?.agent)
  /* Any room from the column, ⌥-pressed or from its menu — a channel, a
     direct or a group conversation: beside the work where there is room,
     as a screen where there is not. */
  const besideRoom = (roomId: string) => rooms.some((x) => x.id === roomId)
  const roomBeside = (roomId: string) => (wide && besideRoom(roomId) ? setBeside(roomId) : navigate({ view: 'chat', roomId }))

  /* The Members screen, which the fourth switch can keep to the owner —
     the screen and not the people, who stay in every picker. */
  const canMembers = me.can.includes('members.read')
  /*
   * Members' one list, people and agents in a group each.
   * The agents are listed to whoever sees
   * Members once there is one, and to whoever may connect one; somebody
   * who has the screen only for that sees the agents and nothing else.
   * Beside the list, a person's page or an agent's, by who is open.
   */
  const mayConnect = me.can.includes('agent.connect')
  const mayInvite = me.can.includes('people.invite')
  /* On a workspace's own domain, the doors it keeps shut that the person's
     role opens at usetuff.com: links there. */
  const awayDoors = doorsAway(me)
  const away: { key: string; label: string; url: string; icon: IconName }[] = [
    ...(awayDoors.settings ? [{ key: 'settings', label: W.workspaceSettings, url: awayDoors.settings, icon: 'gear' as IconName }] : []),
    ...(awayDoors.invite ? [{ key: 'invite', label: W.invitePeople, url: awayDoors.invite, icon: 'people' as IconName }] : []),
  ]
  /* Where the edition holds agents back, somebody who may invite but not
     connect still finds the agents tab, saying what the edition says.
     `can` refuses connecting as before; the tab only says so. */
  const agentsHeld = (!mayConnect && mayInvite && edition.agentsLocked?.when(me)) || undefined
  const openedId = beneath.view === 'members' ? (beneath.actorId ?? null) : null
  const agentOpen = (openedId && agents?.find((a) => a.actor_id === openedId)) || null
  const onAgents = !canMembers || !!agentOpen || !!(openedId && people.find((p) => p.actor_id === openedId)?.agent)
  /* Somebody's page where the screen is open, their card where it is not:
     a name found in the palette or a note about a person still opens
     something about them. */
  const openPerson = (actorId: string) => (canMembers ? navigate({ view: 'members', actorId }) : setShownPerson(actorId))

  /* The doors a person's card opens, wherever their face is —
     `docs/specs/person-card.md`. */
  const doors: PersonDoors = {
    ...(canMembers ? { open: (actorId: string) => navigate({ view: 'members', actorId }) } : {}),
    show: (actorId) => setShownPerson(actorId),
    message: (actorId) => void startDirect(actorId),
    openTask: (projectId, taskId) => navigate(keepLook({ view: 'projects', projectId, tool: 'tasks', objectId: taskId })),
    openFile: (projectId, fileId) => navigate({ view: 'projects', projectId, tool: 'files', objectId: fileId }),
    openPost: (projectId, postId) => navigate({ view: 'projects', projectId, tool: 'posts', objectId: postId }),
    openRoom: (roomId) => navigate({ view: 'chat', roomId }),
    beside: { is: isAgent, open: (actorId) => void startDirect(actorId, true) },
  }

  const canCreate = me.can.includes('project.create')

  /*
   * What a phone's bar is named by: the project, with its mark, or the
   * screen. The project's name used to be a band of its own under the bar,
   * which is the band a phone gave up for it.
   */
  const onRoom = room ? rooms.find((r) => r.id === room) : undefined
  /*
   * The rooms that are places in the list: not a channel of a project that
   * was archived. Those go with their project — still there inside it, to
   * be read, and back in the list when it is brought back — rather than
   * sitting in the column as rooms of a project nobody can see there.
   */
  /*
   * And not a conversation whose everybody else has left — removed, or
   * their account deleted. Those are kept at the foot of the Chats page, in
   * a section of their own, and come back here by themselves when somebody
   * is invited back. `docs/specs/sidebar.md`, "The Chats page".
   */
  const listed = rooms.filter((r) => !r.project_archived && !leftRoom(r))
  const left = rooms.filter(leftRoom)
  const roomTitle = onRoom ? nameOfRoom(onRoom) : null
  /* The places along a phone's foot — stepped aside inside a room, whose
     line to write on is the foot there. */
  const tabs = phone && !(view === 'chat' && room)
  const barTitle: React.ReactNode = project ? (
    <>
      <ProjectMark {...markOf(project)} size={20} />
      <span className="min-w-px truncate">{project.name}</span>
    </>
  ) : (
    <span className="min-w-px truncate">
      {view === 'my'
        ? PLACES.myTasks
        : view === 'members'
          ? PLACES.members
          : view === 'projects-all'
            ? HEADS.projects
            : view === 'chat'
              ? (roomTitle ?? W.chat)
              : view === 'settings'
                ? audit
                  ? HEADS.securityLog
                  : W.workspaceSettings
                : view === 'account'
                  ? W.account
                  : view === 'notifications'
                    ? HEADS.notifications
                    : view === 'more'
                      ? W.more
                      : view === 'search'
                        ? W.search
                        : view === 'admin' && edition.admin
                          ? edition.admin.label
                          : view === 'instance'
                            ? INSTANCE.title
                            : PLACES.myTasks}
    </span>
  )

  /* The tab says where you are — `docs/specs/window-title.md`. A project and
     its tool, a room by its name, a person on the members screen. */
  const theirName =
    view === 'members' && beneath.view === 'members' && beneath.actorId
      ? people.find((p) => p.actor_id === beneath.actorId)?.name
      : undefined
  const tabTitle = project
    ? [project.name, LABEL[onProject?.tool ?? 'tasks']].filter(Boolean).join(' › ')
    : view === 'chat'
      ? onRoom
        ? (onRoom.channel ?? Boolean(onRoom.project_id))
          ? `# ${roomTitle}`
          : (roomTitle ?? W.chat)
        : W.chat
      : view === 'members'
        ? [PLACES.members, theirName].filter(Boolean).join(' › ')
        : view === 'projects-all'
          ? HEADS.projects
          : view === 'settings'
            ? audit
              ? HEADS.securityLog
              : W.workspaceSettings
            : view === 'account'
              ? W.account
              : view === 'notifications'
                ? HEADS.notifications
                : view === 'more'
                  ? W.more
                  : view === 'search'
                    ? W.search
                    : view === 'admin' && edition.admin
                      ? edition.admin.label
                      : view === 'instance'
                        ? INSTANCE.title
                        : PLACES.myTasks

  /* Still standing: not used, not revoked, not expired. A used invitation is
     history, and this is a list of things to act on. */
  const open_ = invites.filter((i) => !i.used_at && !i.deleted_at && Date.parse(i.expires_at) > Date.now())

  /**
   * Every screen the sidebar would let this person through to.
   *
   * Taken from the same permission answers the sidebar uses rather than
   * listed again: a palette that offers a door the sidebar hides is how a
   * client finds the people screen.
   */
  const reachable =
    /* No 'search' here: it is this palette, and a row inside it offering to
       open itself is a door back into the room you are standing in. */
    (['my', 'projects-all', 'notifications', 'members', 'settings', 'account', 'admin', 'instance'] as const).filter((v) => {
      if (v === 'instance') return me.can.includes('instance')
      if (v === 'members') return membersDoor(me.can)
      if (v === 'settings') return workspaceDoor(me.can)
      if (v === 'admin') return edition.admin?.may(me.can) === true
      return true
    })

  /* The rooms as the palette finds them: by the names the column gives
     them, a direct conversation with the other person's face. */
  const findable = listed.map((r) => {
    const direct = !(r.channel ?? Boolean(r.project_id))
    return {
      id: r.id,
      name: nameOfRoom(r),
      direct,
      ...(direct && r.other_id ? { face: { id: r.other_id, name: r.others ?? nameOfRoom(r) } } : {}),
    }
  })
  /* What is waiting behind a screen, said beside it in the palette. */
  const waitingIn = { notifications: inboxCount(unread) }

  async function go(to: Destination) {
    /* A door a workspace's own domain keeps shut: the same screen at
       usetuff.com, in a new tab. */
    if (to.kind === 'away') window.open(to.url, '_blank', 'noopener,noreferrer')
    if (to.kind === 'view') navigate({ view: to.view } as Route)
    if (to.kind === 'project') navigate({ view: 'projects', projectId: to.id })
    if (to.kind === 'person') openPerson(to.id)
    /* Connecting an agent: its window, over the place agents are kept, so
       closing it leaves somebody where they will find them next time. */
    if (to.kind === 'connect') {
      navigate({ view: 'members' })
      setAdding('agents')
    }
    if (to.kind === 'room') {
      const m = to.message
      navigate({ view: 'chat', roomId: to.id, ...(m ? { messageId: m.id, ...(m.thread ? { threadId: m.thread } : {}) } : {}) })
    }
    // Quick create: the task is made and you are put where it landed, rather
    // than told it worked and left where you were.
    if (to.kind === 'create') {
      await api(`/projects/${to.projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title: to.title, column: 'Unsorted' }),
      })
      navigate(keepLook({ view: 'projects', projectId: to.projectId, tool: 'tasks' }))
      setRevision((r) => r + 1)
    }
    /* The open task waits on the one named, and the task's screen and the
       list behind it read again. */
    if (to.kind === 'block') {
      await api(`/tasks/${to.taskId}/blocked-by`, { method: 'POST', body: JSON.stringify({ task_id: to.blockerId }) }).catch(() => {})
      setRevision((r) => r + 1)
    }
    // A hit inside a project opens the project it belongs to. Deep-linking to
    // the row itself is the next thing this wants and needs a route to land
    // on, which the app does not have yet.
    // A hit opens the thing itself, which is what a stable URL is for.
    if (to.kind === 'object') {
      const tool = to.type === 'task' ? 'tasks' : to.type === 'file' ? 'files' : 'posts'
      navigate(keepLook({ view: 'projects', projectId: to.projectId, tool, objectId: to.id }))
    }
  }
  return {
    created,
    current,
    room,
    reading,
    project,
    reloadRooms,
    startDirect,
    roomBeside,
    besideRoom,
    canMembers,
    mayConnect,
    mayInvite,
    agentsHeld,
    openedId,
    agentOpen,
    onAgents,
    doors,
    canCreate,
    listed,
    left,
    tabs,
    barTitle,
    tabTitle,
    open_,
    reachable,
    away,
    awayDoors,
    findable,
    waitingIn,
    go,
  } as const
}
export type ShellParts = ReturnType<typeof shellParts>
