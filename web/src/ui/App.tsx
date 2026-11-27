import { edition } from '../edition.jsx'
import { onHost } from '../data/host.js'
import { HostSecurity, HostSignIn } from './app/hostSignIn.jsx'
import { UndoToast } from './UndoToast.jsx'
import { MorePage, PhoneTabs } from './PhoneTabs.jsx'
import { Chats } from './chat/Chats.jsx'
import { doorsAway, membersDoor, workspaceDoor } from '../data/doors.js'
import { PLACES } from '../data/words.js'
import { APP as W } from '../words/app.js'
import { api, AFTER_SIGN_IN, signOut, stored } from '../data/api.js'
import { Nowhere } from './Nowhere.jsx'
import { Unconfirmed, type Waiting as Unanswered } from './Unconfirmed.jsx'
import { useEffect, useState } from 'react'
import { forget, setBeside, useBeside, type Route } from '../data/route.js'
import { Beside } from './app/beside.jsx'
import { Palette } from './Palette.jsx'
import { NewDialog } from './New.jsx'
import { roomCount } from './Sidebar.jsx'
import { MyTasks, myTab } from './MyTasks.jsx'
import { FirstProject } from './FirstProject.jsx'
import { Projects } from './Projects.jsx'
import { Face, Notifications, SecondFactor, YourData, Sessions, Tokens, Tongue } from './Account.jsx'
import { LeaveWorkspace } from './Leaving.jsx'
import { WaysIn } from './WaysIn.jsx'
import { AddMembers } from './AddMembers.jsx'
import { Empty, PageTitle, ProjectMarksContext } from './kit.jsx'
import { Instance } from './Instance.jsx'
import { INSTANCE } from '../words/instance.js'
import { AuditLog, AuditTitle } from './AuditLog.jsx'
import { GithubAccount } from './Github.jsx'
import { Chat } from './Chat.jsx'
import { PersonDoorsContext, PersonWindow } from './PersonCard.jsx'
import { AgentIdsContext } from './Origin.jsx'
import { TopBar } from './TopBar.jsx'
import { inboxCount } from './app/model.js'
import { NotesPanel } from './app/notes.jsx'
import { SignIn } from './app/signIn.jsx'
import { RoomBar } from './app/shell.jsx'
import { settingsScreen } from './app/settingsScreen.jsx'
import { membersScreen } from './app/membersScreen.jsx'
import { projectsScreen } from './app/projectsScreen.jsx'
import { sideColumn } from './app/sideColumn.jsx'
import { shellParts } from './app/shellParts.jsx'
import { useAppPlace } from './app/useAppPlace.js'
import { useAppEvents } from './app/useAppEvents.js'
import { useAppLoad } from './app/useAppLoad.js'
import { useAppState } from './app/useAppState.js'

export function App() {
  const {
    me,
    setMe,
    projects,
    setProjects,
    archivedProjects,
    setArchivedProjects,
    people,
    setPeople,
    shownPerson,
    setShownPerson,
    channelDraft,
    setChannelDraft,
    route,
    navigate,
    replace,
    phone,
    under,
    beneath,
    view,
    audit,
    settingsWhole,
    auditWhole,
    accountWhole,
    instanceWhole,
    rooms,
    setRooms,
    roomsNow,
    loaded,
    setLoaded,
    revision,
    setRevision,
    found,
    setFound,
    palette,
    setPalette,
    drawer,
    setDrawer,
    wide,
    agents,
    loadAgents,
    membersWhole,
    column,
    making,
    setMaking,
    notes,
    setNotes,
    newHere,
    setNewHere,
    unread,
    setUnread,
    signedIn,
    setSignedIn,
    findPeople,
    setFindPeople,
    adding,
    setAdding,
    shutGroups,
    foldGroup,
    invites,
    setInvites,
    loadInvites,
  } = useAppState()
  const { load, shelve, stranded, setStranded, kept, fromShelf } = useAppLoad({
    setMe,
    setProjects,
    setArchivedProjects,
    setPeople,
    setRooms,
    setLoaded,
    setNotes,
    setUnread,
  })
  useAppEvents({
    me,
    projects,
    route,
    replace,
    setRooms,
    roomsNow,
    setRevision,
    setNotes,
    setUnread,
    signedIn,
    setSignedIn,
    load,
    shelve,
    setStranded,
    fromShelf,
  })
  const { onProject, forgetProject, goTab, look, keepLook, at, key, carriedAt, projectNear, roomNear, shell, agentIds, projectMarks } =
    useAppPlace({
      me,
      projects,
      archivedProjects,
      people,
      route,
      navigate,
      replace,
      phone,
      beneath,
      view,
      rooms,
      loaded,
      found,
      setFound,
      setMaking,
      unread,
      signedIn,
      loadInvites,
      stranded,
      kept,
    })

  /*
   * An announcement opened is its notes read. The Announcements tab counts
   * the unread notes about this project's posts, and the only thing that
   * read them was the bell: somebody opened the post the number was about,
   * read it, and the number stayed. A room is read by being looked at; so
   * is a post. Each note by its id, so nothing else in the bell is touched.
   */
  /* The address says the post's number; its id is what the screen resolved
     it to, the same way the project screen is handed it. */
  const openPost =
    beneath.view === 'projects' && beneath.tool === 'posts' ? (beneath.objectId ?? (key ? (found[key] ?? carriedAt(key)) : null)) : null
  useEffect(() => {
    if (!openPost) return
    const open = openPost
    const waiting = (notes ?? []).filter((n) => !n.read_at && n.object_type === 'post' && n.object_id === open)
    if (waiting.length === 0) return
    const ids = new Set(waiting.map((n) => n.id))
    const now = new Date().toISOString()
    setNotes((had) => had && had.map((n) => (ids.has(n.id) ? { ...n, read_at: n.read_at ?? now } : n)))
    for (const id of ids) void api('/inbox/read', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => null)
  }, [openPost, notes, setNotes])

  /* A conversation beside the work. An id
     that is none of this reader's rooms leaves the address once the rooms
     are known: a link from another workspace, a conversation since gone. */
  const besideId = useBeside()
  useEffect(() => {
    if (besideId && loaded && rooms.length > 0 && !rooms.some((r) => r.id === besideId)) setBeside(null)
  }, [besideId, loaded, rooms])

  /*
   * Workspaces joined before the address was confirmed — `ui/Unconfirmed.tsx`,
   * Asked beside the rest rather than
   * before it, so a load that has none waits for nothing; when there are
   * some, their screen comes first. A session in no workspace asks on its
   * own screen (`Nowhere.tsx`).
   */
  const [unanswered, setUnanswered] = useState<Unanswered[]>([])
  useEffect(() => {
    if (!signedIn || stored()?.workspace_id == null) return
    void api<{ waiting: Unanswered[] }>('/me/unconfirmed')
      .then((r) => setUnanswered(r.waiting))
      .catch(() => {})
  }, [signedIn])

  /* On a workspace's own domain: a code or a provider, never a password. */
  const host = onHost()
  if (!signedIn && host) return <HostSignIn host={host} onDone={() => setSignedIn(true)} />
  if (!signedIn)
    return (
      <SignIn
        onDone={() => {
          /* Sent to sign in by a page that wants them back — an agent
             asking to be connected (`Connect.tsx`). Only a path here. */
          let back: string | null = null
          try {
            back = sessionStorage.getItem(AFTER_SIGN_IN)
            sessionStorage.removeItem(AFTER_SIGN_IN)
          } catch {
            /* No storage: the app, as always. */
          }
          /* Or where the edition kept for the tab a sign-in by Google or
             Apple comes back to. */
          back ??= edition.returnTo()
          if (back?.startsWith('/') && !back.startsWith('//')) location.assign(back)
          else setSignedIn(true)
        }}
      />
    )
  /* In no workspace: the one screen such a session has. */
  if (stored()?.workspace_id === null) return <Nowhere />
  /* Every one answered: on into the workspace, read again when one was joined. */
  if (unanswered.length > 0)
    return (
      <Unconfirmed
        waiting={unanswered}
        onDone={(joined) => {
          if (joined) location.reload()
          else setUnanswered([])
        }}
      />
    )
  /* Nothing of its own until `/me` answers: the frame under the app is
     what is on the screen, and it is the right thing to be looking at. */
  if (!me && stranded)
    return (
      <div className="grid h-[calc(var(--app-h)-var(--above))] place-items-center px-6 text-center text-ink-3">{W.strandedOffline}</div>
    )
  if (!me) return null
  const {
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
    findable,
    waitingIn,
    go,
  } = shellParts({
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
  })

  return (
    <PersonDoorsContext.Provider value={doors}>
      <AgentIdsContext.Provider value={agentIds}>
        <ProjectMarksContext.Provider value={projectMarks}>
          {/* Somebody's window, over whatever screen this is — the one window
          every face and name opens. `docs/specs/person-card.md`. */}
          {shownPerson && <PersonWindow actorId={shownPerson} meId={me.actor.id} doors={doors} onClose={() => setShownPerson(null)} />}
          <div
            ref={shell}
            data-app-shell
            /* Less the writing dock while it is on the keys, so what is being
         written in ends on the dock, not under it — `--dock-h`. */
            className="flex h-[calc(var(--app-h)-var(--above)-var(--dock-h))] flex-col text-base leading-shell"
            /* Nothing stands clear of tabs that are not there — inside a room,
         or on anything wider than a phone. */
            /* No tabs inside a room, but still the home indicator: the line to
         write on stands clear of it. */
            style={tabs ? undefined : ({ '--foot': 'env(safe-area-inset-bottom, 0px)' } as React.CSSProperties)}
          >
            {/*
        One horizon across the window.
        
        Above the sidebar as well as the work, because what is in it is
        about the window rather than a place in it: the workspace everything
        is inside of, the thing this product makes most of, the search over
        all of it, what is addressed to you, how it looks, and you.
      */}
            {/* Not over a room on a phone: the room's own head says where you
          are and has the way back, and a second band above it was two
          strips of chrome over the conversation. */}
            {!(phone && view === 'chat' && room) && (
              <TopBar
                me={me}
                title={barTitle}
                /* The bar's left block is the column's width, so the workspace and
             what it opens stand over the column they are about. */
                column={wide ? column.width : 0}
                moving={wide && column.moving}
                waiting={inboxCount(unread)}
                view={view}
                wide={wide}
                onView={(v) => navigate({ view: v } as Route)}
                onMake={() => setMaking(true)}
                onDrawer={() => setDrawer(true)}
                phone={phone}
                /* The way out of a screen pushed inside a tab: a room back to the
             rooms, Members and Settings back to More. */
                onBack={
                  !phone
                    ? undefined
                    : view === 'chat' && room
                      ? () => navigate({ view: 'chat' })
                      : /* A project back to all of them, and Projects forgets it. */
                        /* The Chat tab's room is the tab's own state said in the
                     address, not something opened over it. */
                        view === 'projects' && onProject && (!onProject.objectId || onProject.tool === 'messages')
                        ? () => {
                            forgetProject()
                            navigate({ view: 'projects-all' })
                          }
                        : (view === 'members' && !(beneath.view === 'members' && beneath.actorId)) ||
                            view === 'settings' ||
                            view === 'account'
                          ? () => navigate({ view: 'more' })
                          : undefined
                }
                onChanged={load}
                onSignOut={() =>
                  void signOut().then(() => {
                    /* The names go with the session, so the address falls back to
                 `/`. It was left wherever the
                 person had got to, so the next sign-in on that browser opened
                 the last one's project. And a fresh page: the last person's
                 people, projects and rooms were still in this one, and the
                 next to sign in was drawn them until their own arrived. */
                    forget()
                    location.replace('/signin')
                  })
                }
              />
            )}
            {/*
        The columns float on the ground rather than butting against it.
        
        One gap on all four sides and between each column, so the three —
        the sidebar, a project's tools and the work — read as three sheets
        laid on the window rather than three regions of one. The gap and the
        corner are `--lift` and `--r-lift`, said once, because three columns
        each carrying their own number is three chances to disagree.
      */}
            <div className="flex min-h-0 flex-1" style={{ gap: 'var(--lift)', padding: 'var(--lift)', paddingTop: 0 }}>
              {/*
        Search is this, and only this.
        
        There was a screen as well, with the filters on it, and a palette with
        the same word in it — two places to type one question. The filters
        came here and the screen went. `/search?q=` is still an address, so a
        search can be sent to somebody; it opens this over whatever screen was
        there rather than replacing the screen, and closing it puts the
        address back.
      */}
              {/*
        One key for it, and the same dialog the buttons open.
        
        `c` and not ⌘N: the browser owns that one, and a shortcut the browser
        takes first is a shortcut that works on one platform in one window
        state. A bare letter is only free while nobody is typing, which is
        what the guard below is for.
      */}
              <NewDialog
                open={making}
                what={{
                  kind: 'task',
                  projectId: current,
                  list: null,
                }}
                onClose={() => setMaking(false)}
                onMade={async () => {
                  /* Where it landed is opened by the window itself — the task, at
             its own address; what is left here is
             telling the lists behind it. */
                  await load()
                  setRevision((r) => r + 1)
                }}
              />
              <Palette
                projects={projects}
                people={people}
                rooms={findable}
                counts={waitingIn}
                views={reachable}
                away={away}
                inProject={beneath.view === 'projects' ? project : null}
                openTask={beneath.view === 'projects' && beneath.tool === 'tasks' ? (beneath.objectId ?? null) : null}
                canWrite={me.can.includes('content.create')}
                onGo={(to) => void go(to)}
                mayConnect={mayConnect}
                /* The real address, not the screen underneath: `view` is what is
           drawn and that is deliberately never `search` — the palette is
           the one thing that has to know the address says it. */
                open={palette || (route.view === 'search' && !phone)}
                startQ={route.view === 'search' ? (route.q ?? '') : ''}
                onOpenChange={(next) => {
                  setPalette(next)
                  /*
                   * Opened by a keystroke it is not an address; arrived at by one
                   * it is, and closing has to give the address back or the URL
                   * keeps claiming a screen that is no longer open.
                   *
                   * Back to the screen it opened over, not to My tasks. It sent
                   * somebody home from a project they had not left — the palette
                   * closed and took the screen underneath with it, which is the
                   * same fault as drawing nothing behind it, arriving a moment
                   * later.
                   */
                  if (!next && route.view === 'search') replace(under.current)
                }}
              />
              {/*
        What is addressed to you, over the screen it was asked for from.

        The same bargain as the palette above and closed the same way: the
        address goes back to the screen underneath, so shutting the panel is
        not a navigation to somewhere nobody asked for. `replace` and not
        `push`, because back should leave the screen rather than walk through
        the inbox being opened and shut.
      */}
              <NotesPanel
                open={route.view === 'notifications'}
                notes={notes}
                newHere={newHere}
                onClose={() => replace(under.current)}
                onReadAll={async () => {
                  /* Asked for, so it goes now rather than when the panel shuts. */
                  setNewHere(new Set())
                  /* Read on the screen first; the shell is read again behind it. */
                  setNotes((had) => (had ?? []).map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
                  setUnread({ mentioned: '0', assigned: '0', subscribed: '0' })
                  await api('/inbox/read', { method: 'POST', body: '{}' }).catch(() => null)
                  void load()
                }}
                onGo={(n) => {
                  /* Where it is about, as the address would say it; the panel goes
             because the screen it opens is the answer.

             In the inbox's place, not on top of it: pushed, Back
             from the task walked into the inbox again and opened the panel
             over the screen it had been left from. The inbox is a box over
             a screen, not a step anybody wants to go back through. */
                  setNotes((had) => had && had.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x)))
                  if (n.object_type === 'conversation') return replace({ view: 'chat', roomId: n.object_id })
                  if (n.object_type === 'actor') {
                    if (canMembers) return replace({ view: 'members', actorId: n.object_id })
                    replace(under.current)
                    return setShownPerson(n.object_id)
                  }
                  if (n.object_type === 'project') return replace(keepLook({ view: 'projects', projectId: n.object_id, tool: 'tasks' }))
                  if (!n.project_id) return replace(under.current)
                  const tool = n.object_type === 'task' ? 'tasks' : n.object_type === 'post' ? 'posts' : 'files'
                  replace(keepLook({ view: 'projects', projectId: n.project_id, tool, objectId: n.object_id }))
                }}
              />
              {/*
        Three columns are a luxury of width. Below the breakpoint the sidebar
        leaves the layout and comes back over the work when it is asked for,
        so the work gets the screen — `docs/specs/narrow.md`.
      */}
              {!wide && !phone && drawer && (
                <div
                  data-drawer-scrim
                  className="fixed inset-0 z-40 bg-scrim"
                  style={{
                    backdropFilter: 'blur(var(--scrim-blur))',
                    WebkitBackdropFilter: 'blur(var(--scrim-blur))',
                  }}
                  onPointerDown={() => setDrawer(false)}
                />
              )}
              {sideColumn({
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
              })}

              {/*
        Every screen that is not a project is a sheet too.
        
        An open project brings a second column, so it lays its own two
        sheets and this one stays a plain box around them — otherwise the
        tools column would sit inside the work's card rather than beside
        it. Every other screen, the list of all projects included, is one
        column and gets its sheet here.
      */}
              <main
                /* A sheet whose contents arrive — unless a project is open on a
           wide screen, where what is inside is two sheets of the project's
           own, and they carry the mark: faded from here, the sheets would
           fade with their contents. `docs/specs/arrival.md`. */
                data-panel={wide && (onProject || view === 'members') ? undefined : ''}
                className="flex min-w-0 flex-1 flex-col overflow-y-auto"
                style={
                  wide && !onProject && view !== 'members'
                    ? {
                        background: 'var(--chrome)',
                        borderRadius: 'var(--r-lift)',
                      }
                    : undefined
                }
              >
                {view === 'admin' &&
                  (edition.admin?.may(me.can) ? (
                    <edition.admin.Screen {...(beneath.view === 'admin' && beneath.path ? { path: beneath.path } : {})} onGo={navigate} />
                  ) : (
                    /* Not somebody who runs the product, or nobody does: the
                       same nothing a wrong address gets. */
                    <div className="px-[var(--gutter)] py-6 text-ink-3">{W.nothingHere}</div>
                  ))}
                {view === 'instance' &&
                  (me.can.includes('instance') ? (
                    /* Your own server's. Drawn when its
               answer is in, so it opens whole. */
                    <div className="flex h-full flex-col px-[var(--gutter)] pt-7 max-sm:pt-3">
                      <div className="mx-auto w-full max-w-[800px]">
                        <PageTitle>{INSTANCE.title}</PageTitle>
                      </div>
                      <div data-steady data-foot className="min-h-0 flex-1 overflow-y-auto pt-5 pb-16">
                        <div className="mx-auto w-full max-w-[800px]">{instanceWhole && <Instance meId={me.actor.id} />}</div>
                      </div>
                    </div>
                  ) : (
                    /* Not an owner, or the service: the same nothing a wrong address gets. */
                    <div className="px-[var(--gutter)] py-6 text-ink-3">{W.nothingHere}</div>
                  ))}
                {view === 'more' && (
                  <MorePage
                    workspace={me.workspace}
                    canPeople={membersDoor(me.can)}
                    canWorkspace={workspaceDoor(me.can)}
                    settingsAway={doorsAway(me).settings}
                    canMakeWorkspace={me.can.includes('workspace.create')}
                    runsIt={edition.admin?.may(me.can) === true}
                    instance={me.can.includes('instance')}
                    onGo={(v) => navigate({ view: v } as Route)}
                    onMake={me.can.includes('task.create') || projects.length > 0 ? () => setMaking(true) : undefined}
                  />
                )}
                {view === 'search' && phone && (
                  /* A phone's Search tab: the palette, laid out as the page. What is
             typed goes into the address, so coming back finds it asked. */
                  <Palette
                    page
                    open
                    onOpenChange={() => {}}
                    projects={projects}
                    people={people}
                    rooms={findable}
                    counts={waitingIn}
                    views={reachable}
                    away={away}
                    inProject={null}
                    canWrite={me.can.includes('content.create')}
                    onGo={(to) => void go(to)}
                    mayConnect={mayConnect}
                    startQ={route.view === 'search' ? (route.q ?? '') : ''}
                    onQuery={(q) => replace({ view: 'search', ...(q ? { q } : {}) })}
                  />
                )}
                {view === 'projects-all' && (
                  <Projects
                    projects={projects}
                    loaded={loaded}
                    canManage={me.can.includes('project.archive')}
                    meId={me.actor.id}
                    owner={me.can.includes('workspace.billing')}
                    onOpen={(id) => navigate({ view: 'projects', projectId: id })}
                    onCreate={created}
                    onChanged={load}
                  />
                )}

                {/* An empty workspace's home is its first project rather than three
            zeros and an empty year — for somebody who may start one. */}
                {view === 'my' && loaded && canCreate && projects.length === 0 && archivedProjects.length === 0 && (
                  <div className="flex h-full flex-col overflow-y-auto px-[var(--gutter)]">
                    <FirstProject
                      me={{ id: me.actor.id, name: me.actor.name }}
                      onMade={async (projectId) => {
                        await load()
                        navigate({ view: 'projects', projectId, tool: 'tasks' })
                      }}
                    />
                  </div>
                )}

                {view === 'my' && !(loaded && canCreate && projects.length === 0 && archivedProjects.length === 0) && (
                  <MyTasks
                    meId={me.actor.id}
                    tab={myTab(beneath.view === 'my' ? beneath.tab : undefined, me.can.includes('activity.read'))}
                    canActivity={me.can.includes('activity.read')}
                    onTab={(tab) => navigate({ view: 'my', tab })}
                    onOpen={(projectId, taskId) => navigate({ view: 'projects', projectId, tool: 'tasks', objectId: taskId })}
                  />
                )}

                {view === 'chat' &&
                  (room ? (
                    // A room needs the height to lay itself out: the feed scrolls and
                    // the composer sits at the bottom of it, not at the bottom of the
                    // page. Inside the project screen it inherits that from the tool
                    // panel; here there is nothing above it to inherit from.
                    <RoomBar>
                      <Chat
                        key={room}
                        conversationId={room}
                        all={rooms}
                        meId={me.actor.id}
                        /* What the room's project lets this person do, as inside the
                   project: a message became a task there and not here, the
                   same channel opened from the column. */
                        canMakeTask={(() => {
                          const at = rooms.find((r) => r.id === room)?.project_id
                          const project = at ? projects.find((p) => p.id === at) : null
                          return (project?.can ?? []).includes('task.create')
                        })()}
                        onRoomsChanged={reloadRooms}
                        onRoomGone={() => navigate({ view: 'chat' })}
                        onBack={phone ? () => navigate({ view: 'chat' }) : undefined}
                        at={
                          beneath.view === 'chat' && beneath.messageId
                            ? { id: beneath.messageId, thread: beneath.threadId ?? null }
                            : undefined
                        }
                      />
                    </RoomBar>
                  ) : (
                    /* Every room, and the ones with people who left at the
                       foot: the column's Chat heading opens it, and on a
                       phone it is the Chat tab — `docs/specs/sidebar.md`. */
                    <Chats
                      rooms={listed}
                      left={left}
                      loaded={loaded}
                      onOpen={(id) => navigate({ view: 'chat', roomId: id })}
                      onNew={() => setChannelDraft(true)}
                    />
                  ))}

                {projectsScreen({
                  me,
                  projects,
                  navigate,
                  replace,
                  beneath,
                  view,
                  rooms,
                  loaded,
                  revision,
                  found,
                  notes,
                  load,
                  onProject,
                  look,
                  at,
                  key,
                  carriedAt,
                  project,
                  reloadRooms,
                  canCreate,
                })}

                {view === 'members' && !membersDoor(me.can) && (
                  /* Said plainly to somebody who followed a link here, as Settings
             says it: the screen is the owner's in this workspace. */
                  <div className="flex h-full flex-col px-[var(--gutter)] pt-7 max-sm:pt-3">
                    <div className="mx-auto w-full max-w-[800px]">
                      <PageTitle>{PLACES.members}</PageTitle>
                      <div data-members-closed className="pt-5">
                        <Empty>{W.ownerOnlyMembers}</Empty>
                      </div>
                    </div>
                  </div>
                )}

                {membersScreen({
                  me,
                  projects,
                  people,
                  navigate,
                  beneath,
                  view,
                  wide,
                  agents,
                  loadAgents,
                  membersWhole,
                  findPeople,
                  setFindPeople,
                  setAdding,
                  shutGroups,
                  foldGroup,
                  setInvites,
                  loadInvites,
                  load,
                  startDirect,
                  canMembers,
                  mayConnect,
                  mayInvite,
                  agentsHeld,
                  openedId,
                  agentOpen,
                  onAgents,
                  open_,
                })}

                {adding && (mayInvite || mayConnect) && (
                  <AddMembers
                    projects={projects}
                    owner={me.role === 'owner'}
                    mayInvite={mayInvite}
                    mayConnect={mayConnect}
                    {...(agentsHeld ? { locked: agentsHeld } : {})}
                    start={adding}
                    onClose={() => setAdding(null)}
                    onInvited={() => void loadInvites()}
                    onConnected={(agentId) => {
                      void load()
                      void loadAgents().then(() => navigate({ view: 'members', actorId: agentId }))
                    }}
                  />
                )}

                {audit && (
                  /* The audit log, a page under the settings at the same measure.
             Its filters are in the address and
             replace it: back leaves the log rather than undoing a filter. */
                  <div className="flex h-full flex-col px-[var(--gutter)] pt-7 max-sm:pt-3">
                    <div className="mx-auto w-full max-w-[800px]">
                      <AuditTitle onBack={() => navigate({ view: 'settings' })} />
                    </div>
                    <div data-steady data-foot className="min-h-0 flex-1 overflow-y-auto pt-5 pb-16">
                      <div className="mx-auto w-full max-w-[800px]">
                        {auditWhole && (
                          <div data-whole="audit">
                            <AuditLog
                              type={audit.type}
                              who={audit.who}
                              allowed={me.can.includes('audit.read')}
                              onNarrow={(type, who) =>
                                replace({
                                  view: 'settings',
                                  audit: true,
                                  ...(type ? { type } : {}),
                                  ...(who ? { who } : {}),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {settingsScreen({ me, setMe, navigate, view, audit, settingsWhole, load })}

                {view === 'account' && (
                  /* The person's own. Theirs in every
             workspace they are in, and everybody has it. */
                  <div className="flex h-full flex-col px-[var(--gutter)] pt-7 max-sm:pt-3">
                    <div className="mx-auto w-full max-w-[800px]">
                      <PageTitle>{W.account}</PageTitle>
                    </div>
                    <div data-steady data-foot className="min-h-0 flex-1 overflow-y-auto pt-5 pb-16">
                      <div className="mx-auto w-full max-w-[800px]">
                        {accountWhole && (
                          <div data-whole="account">
                            {/* Your own face first: the one thing somebody most often came
                here to change. */}
                            <Face me={me} onChanged={load} />
                            <Tongue />
                            {/* This device's notifications are push, which a workspace's
                own domain does not offer. */}
                            {!host && <Notifications />}
                            {/* On a workspace's own domain, what belongs to the account is
                changed at usetuff.com. */}
                            {host ? (
                              <HostSecurity host={host} />
                            ) : (
                              <>
                                <SecondFactor />
                                {/* What else signs this account in. */}
                                <WaysIn />
                                <Sessions />
                                <Tokens
                                  agents={me.can.includes('agent.use')}
                                  {...(me.can.includes('workspace.billing') ? { onSettings: () => navigate({ view: 'settings' }) } : {})}
                                />
                                {/* Who you are on GitHub. */}
                                <GithubAccount />
                              </>
                            )}
                            {/* The narrower way out before the widest. */}
                            <LeaveWorkspace
                              workspace={me.workspace}
                              owner={me.role === 'owner'}
                              may={me.can.includes('workspace.leave')}
                              onHandOver={me.can.includes('workspace.transfer') ? () => navigate({ view: 'settings' }) : undefined}
                            />
                            {/* Last, as the thing least often come here for and the one that
                cannot be undone. */}
                            {!host && <YourData />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </main>
              {/* Not over the room it is: the same conversation twice on one
                  window is two lines to type in and nothing more. */}
              <Beside
                id={wide && besideId && reading !== besideId && rooms.some((r) => r.id === besideId) ? besideId : null}
                rooms={rooms}
                meId={me.actor.id}
                /* What the room's project lets this person do, as in the column. */
                canMakeTask={(() => {
                  const at = rooms.find((r) => r.id === besideId)?.project_id
                  return (projects.find((p) => p.id === at)?.can ?? []).includes('task.create')
                })()}
                onClose={() => setBeside(null)}
                onFull={(id) => {
                  setBeside(null)
                  navigate({ view: 'chat', roomId: id })
                }}
                onRoomsChanged={reloadRooms}
              />
            </div>
            {/* The way back from a delete whose screen has closed — an
                announcement's, a room's, a comment's. */}
            <UndoToast />
            {tabs && (
              <PhoneTabs
                view={view}
                waiting={listed.reduce((n, r) => (r.hidden ? n : n + roomCount(r).count), 0)}
                here={me.workspace.id}
                onGo={goTab}
              />
            )}
          </div>
        </ProjectMarksContext.Provider>
      </AgentIdsContext.Provider>
    </PersonDoorsContext.Provider>
  )
}
