import { doorsAway, membersDoor } from '../../data/doors.js'
import { TOP_BAR } from '../../words/topBar.js'
import { PLACES, HEADS, LOCALE } from '../../data/words.js'
import { APP as W } from '../../words/app.js'
import { api } from '../../data/api.js'
import { useState } from 'react'
import { linkOf } from '../InviteDialog.jsx'
import { type Invitation, type Project } from './model.js'
import { reachOf, NoAgents, AgentPage } from '../Agents.jsx'
import { readAgentWork } from '../AgentWeek.jsx'
import { AGENTS } from '../../words/agents.js'
import { readPerson } from '../Stats.jsx'
import { PageTitle, Fluid, Avatar, Empty, GroupLabel, findField } from '../kit.jsx'
import { Icon } from '../glyphs.jsx'
import { Person } from './person.jsx'
import { MembersGroup } from './members.jsx'
import { type AppState } from './useAppState.js'
import { type AppLoad } from './useAppLoad.js'
import { type ShellParts } from './shellParts.jsx'

/**
 * Members: the people down the side, and the one picked open beside them.
 */
export function membersScreen({
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
}: Pick<
  AppState,
  | 'projects'
  | 'people'
  | 'navigate'
  | 'beneath'
  | 'view'
  | 'wide'
  | 'agents'
  | 'loadAgents'
  | 'membersWhole'
  | 'findPeople'
  | 'setFindPeople'
  | 'setAdding'
  | 'shutGroups'
  | 'foldGroup'
  | 'setInvites'
  | 'loadInvites'
> & { me: NonNullable<AppState['me']> } & Pick<AppLoad, 'load'> &
  Pick<
    ShellParts,
    'startDirect' | 'canMembers' | 'mayConnect' | 'mayInvite' | 'agentsHeld' | 'openedId' | 'agentOpen' | 'onAgents' | 'open_'
  >): React.ReactNode {
  return (
    view === 'members' &&
    membersDoor(me.can) && (
      /*
       * Two sheets, as a project is: the people down the side, found by
       * name, and the one picked open beside them with what they may
       * do, how to reach them, what is on them and how their weeks have
       * gone. It was one sheet with the invite controls over a roster
       * and the person squeezed beside it.
       */
      <div className="flex h-full min-h-0" style={wide ? { gap: 'var(--lift)' } : undefined}>
        <nav
          data-members-column
          className={`relative flex w-[300px] shrink-0 flex-col max-sm:w-full ${beneath.view === 'members' && beneath.actorId ? 'max-sm:hidden' : ''}`}
          style={wide ? { background: 'var(--chrome)', borderRadius: 'var(--r-lift)' } : undefined}
        >
          <div className="flex shrink-0 items-center gap-2 px-4 pt-5 pb-3">
            <PageTitle>{PLACES.members}</PageTitle>
            <span className="flex-1" />
            {/* Bringing anybody in: one window, with a tab for each
                    way the reader may — a person invited, an agent
                    connected. */}
            {(mayInvite || mayConnect) && (
              <button
                data-control
                data-testid="members-add"
                aria-label={mayInvite && (mayConnect || agentsHeld) ? W.inviteOrConnect : mayInvite ? W.invitePeople : AGENTS.connect}
                title={mayInvite && (mayConnect || agentsHeld) ? W.inviteOrConnect : mayInvite ? W.invitePeople : AGENTS.connect}
                onClick={() => setAdding(mayInvite ? 'people' : 'agents')}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-track text-ink-2"
              >
                <Icon name="plusThin" size={15} />
              </button>
            )}
            {/* On a workspace's own domain, which keeps inviting shut: the
                same "+" as a link to this screen at usetuff.com, with the
                arrow that says it leaves. */}
            {!mayInvite &&
              !mayConnect &&
              (() => {
                const at = doorsAway(me).invite
                if (!at) return null
                const said = `${W.invitePeople} — ${TOP_BAR.opensAt(new URL(at).host)}`
                return (
                  <a
                    data-control
                    data-testid="members-add-away"
                    href={at}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={said}
                    title={said}
                    className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-full bg-track px-3 text-ink-2"
                  >
                    <Icon name="plusThin" size={15} />
                    <Icon name="away" size={12} />
                  </a>
                )
              })()}
          </div>
          {/* Found by name — a workspace is not a short list. */}
          <div className="shrink-0 px-3 pb-2">
            <input
              {...findField}
              data-testid="find-members"
              value={findPeople}
              onChange={(e) => setFindPeople(e.target.value)}
              placeholder={PLACES.findSomebody}
              className="h-8 w-full rounded-full px-3 text-base outline-none placeholder:text-[var(--ink-3)] bg-track"
              style={{ color: 'var(--ink)' }}
            />
          </div>
          {/* The left column's spacing, row for row: 32 tall, four
                  between, fourteen-point names — the two columns are lists
                  of places side by side and read as one. */}
          <div data-fluid data-foot className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
            <Fluid />
            {(() => {
              /* Drawn whole: the people, the invitations and the agents
                 together, not the people and then two groups growing in
                 under them a round trip later — `useWhole`. */
              if (!membersWhole) return null
              const q = findPeople.trim().toLowerCase()
              const row = (p: Person) => (
                <button
                  key={p.actor_id}
                  data-person
                  data-row
                  data-actor={p.actor_id}
                  /* A person has an address of their own, so linking to one
                     is linking to them rather than to the list they are in. */
                  data-selected={(beneath.view === 'members' && beneath.actorId === p.actor_id) || undefined}
                  onClick={() => navigate({ view: 'members', actorId: p.actor_id })}
                  /* Read ahead under the pointer, so the page opens whole. */
                  onPointerEnter={() => void readPerson(p.actor_id).catch(() => {})}
                  className="flex w-full shrink-0 items-center gap-3 rounded-[var(--r-row)] px-2 text-left"
                  style={{
                    height: 'var(--nav-h)',
                    letterSpacing: 'var(--track-body)',
                    background: beneath.view === 'members' && beneath.actorId === p.actor_id ? 'var(--hover)' : undefined,
                  }}
                >
                  <Avatar
                    name={p.name}
                    id={p.actor_id}
                    url={p.avatar_url}
                    size={20}
                    on="var(--panel)"
                    {...(p.presence ? { presence: p.presence } : {})}
                  />
                  <span className="truncate text-base text-ink">{p.name}</span>
                  <span className="ml-auto shrink-0 text-badge text-ink-3">
                    {/* Only what sets somebody apart — with one owner and
                        everybody else a member, "member" said nothing. */}
                    {p.agent ? W.agent : p.role !== 'member' && W.role(p.role)}
                  </span>
                </button>
              )
              const agentRow = (a: NonNullable<typeof agents>[number]) => (
                <button
                  key={a.actor_id}
                  data-agent={a.actor_id}
                  data-row
                  data-selected={openedId === a.actor_id || undefined}
                  onClick={() => navigate({ view: 'members', actorId: a.actor_id })}
                  /* Read ahead under the pointer, as a person's row
                       does, so its page opens whole. */
                  onPointerEnter={() => {
                    void readPerson(a.actor_id).catch(() => {})
                    /* And its week. */
                    void readAgentWork(a.actor_id, 'week').catch(() => {})
                  }}
                  className="flex w-full shrink-0 items-center gap-3 rounded-[var(--r-row)] px-2 text-left"
                  style={{
                    height: 'var(--nav-h)',
                    letterSpacing: 'var(--track-body)',
                    background: openedId === a.actor_id ? 'var(--hover)' : undefined,
                  }}
                >
                  <Avatar name={a.name} id={a.actor_id} url={a.avatar_url ?? null} size={20} on="var(--panel)" />
                  <span className="truncate text-base text-ink">{a.name}</span>
                  <span className="ml-auto shrink-0 text-badge text-ink-3">{reachOf(a)}</span>
                </button>
              )
              /* Invited and not in yet: nearly a member, so with the
                   people rather than under whoever happens to be open. */
              const out = canMembers ? open_.filter((i) => !q || (i.email ?? W.anyoneWithTheLinkFound).toLowerCase().includes(q)) : []
              const humans = canMembers ? people.filter((p) => !p.agent && (!q || p.name.toLowerCase().includes(q))) : []
              /* Agents beside the people, not among them: in that list
                   an agent would have empty fields and the wrong buttons. */
              const bots = (agents ?? []).filter((a) => !q || a.name.toLowerCase().includes(q))
              /* A group with nothing in it is not drawn; a search that
                   finds nothing anywhere says so once. */
              if (!humans.length && !out.length && !bots.length) {
                if (q)
                  return (
                    <div className="px-2 pt-2">
                      <Empty>{W.noOneByThatName}</Empty>
                    </div>
                  )
                /* Somebody here only to connect agents, before there is one. */
                if (!canMembers && agents)
                  return (
                    <div className="px-2 pt-2">
                      <NoAgents canConnect={mayConnect} onConnect={() => setAdding('agents')} />
                    </div>
                  )
                return null
              }
              /* Folded is folded until a search: what was asked for is
                   shown whichever group it is in. */
              const shut = (g: string) => !q && shutGroups.includes(g)
              const head = (g: 'people' | 'agents', said: string, n: number) => (
                <MembersGroup key={`head-${g}`} group={g} said={said} count={n} shut={shut(g)} onFold={() => foldGroup(g)} />
              )
              return (
                <>
                  {(humans.length > 0 || out.length > 0) && (
                    <>
                      {head('people', W.groupPeople, humans.length + out.length)}
                      {!shut('people') && humans.map(row)}
                      {!shut('people') && out.length > 0 && (
                        <>
                          <GroupLabel>{HEADS.invitationsOut}</GroupLabel>
                          {out.map((i) => (
                            <OutInvite
                              key={i.id}
                              invite={i}
                              projects={projects}
                              onRevoke={async () => {
                                setInvites((had) => (had ?? open_).filter((x) => x.id !== i.id))
                                await api(`/invites/${i.id}/revoke`, { method: 'POST' }).catch(() => null)
                                await loadInvites()
                              }}
                              onAgain={loadInvites}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {bots.length > 0 && (
                    <>
                      {head('agents', W.groupAgents, bots.length)}
                      {!shut('agents') && bots.map(agentRow)}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </nav>

        {/* Forty above the person on a wide screen, as we asked:
                at twenty their name sat against the top of the sheet. A phone
                keeps twenty, under its way back to the list. */}
        <section
          data-foot
          className={`min-w-0 flex-1 overflow-y-auto px-[var(--gutter)] pt-10 pb-8 max-sm:pt-5 ${beneath.view === 'members' && beneath.actorId ? '' : 'max-sm:hidden'}`}
          style={wide ? { background: 'var(--chrome)', borderRadius: 'var(--r-lift)' } : undefined}
        >
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
            {onAgents ? (
              agentOpen && (
                <AgentPage
                  key={agentOpen.actor_id}
                  agent={agentOpen}
                  projects={projects}
                  canStaff={me.can.includes('project.member.add')}
                  onBack={() => navigate({ view: 'members' })}
                  onGone={() => {
                    navigate({ view: 'members' })
                    void loadAgents()
                    void load()
                  }}
                  /* Its face is in every list of people, and its places
                       in the project's own members: both asked again. */
                  onChanged={async () => {
                    await Promise.all([loadAgents(), load()])
                  }}
                  onProject={(projectId) => navigate({ view: 'projects', projectId, tool: 'tasks' })}
                  onOpen={(projectId, taskId) => navigate({ view: 'projects', projectId, tool: 'tasks', objectId: taskId })}
                  onOpenIn={(projectId, tool, objectId) => navigate({ view: 'projects', projectId, tool, objectId })}
                  onMessage={(actorId) => void startDirect(actorId, true)}
                />
              )
            ) : (
              <Person
                who={people.find((p) => p.actor_id === (beneath.view === 'members' ? beneath.actorId : null)) ?? null}
                meId={me.actor.id}
                can={me.can}
                openLinks={open_.filter((i) => i.email === null).length}
                onChanged={async () => {
                  await Promise.all([load(), loadInvites()])
                  navigate({ view: 'members' })
                }}
                onReload={load}
                onBack={() => navigate({ view: 'members' })}
                onMessage={(actorId) => void startDirect(actorId)}
                onOpen={(projectId, taskId) => navigate({ view: 'projects', projectId, tool: 'tasks', objectId: taskId })}
                onProject={(projectId) => navigate({ view: 'projects', projectId, tool: 'tasks' })}
                allProjects={projects}
              />
            )}
          </div>
        </section>
      </div>
    )
  )
}

/**
 * An invitation still out, with what can be done to it: revoked, or sent
 * again. Only its hash is
 * kept, so its link cannot be shown again: a link with no address is
 * copied new, and the screen says the old one stopped.
 */
const told = new Map<string, string>()

function OutInvite({
  invite: i,
  projects,
  onRevoke,
  onAgain,
}: {
  invite: Invitation
  projects: Project[]
  onRevoke: () => Promise<void>
  onAgain: () => Promise<void>
}) {
  /* What was said about the one this replaced: sent again, it is a new
     invitation with a new id, and the row drawn for it is a new row. */
  const [said, setSaid] = useState<string | null>(() => told.get(i.id) ?? null)
  const [busy, setBusy] = useState(false)
  async function again() {
    if (busy) return
    setBusy(true)
    setSaid(null)
    try {
      const r = await api<{ id: string; token: string; mailed: boolean; host?: string }>(`/invites/${i.id}/resend`, { method: 'POST' })
      if (r.token) await navigator.clipboard?.writeText(linkOf(r.token, r.host)).catch(() => undefined)
      const now = r.token ? W.newLinkCopied : r.mailed ? W.sentAgain : W.couldntSendAgain
      told.set(r.id, now)
      setSaid(now)
      await onAgain()
    } catch {
      setSaid(W.couldntSendAgain)
    } finally {
      setBusy(false)
    }
  }
  /* Behind the pointer where there is one; a finger has no hover, so there it stays. */
  const quiet =
    'shrink-0 text-xs transition-opacity group-focus-within:opacity-100 mouse:opacity-0 mouse:on-group-hover:opacity-100 text-ink-3'
  return (
    <div data-invite className="group flex w-full shrink-0 items-start gap-3 rounded-[var(--r-row)] px-2 py-2">
      <span className="mt-px size-5 shrink-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 1px var(--ink-3)', opacity: 0.6 }} />
      <span className="flex min-w-px flex-1 flex-col gap-1">
        {/* What can be done on the name's line, so what the invitation
            holds has the whole width under it. */}
        <span className="flex items-center gap-2">
          <span className="min-w-px flex-1 truncate text-base text-ink">{i.email ?? W.anyoneWithTheLink}</span>
          {/* Its link went with the workspace's own domain: the press it
              needs is in sight, not behind the pointer. */}
          <button
            data-testid="resend-invite"
            data-send-again={i.send_again ? '' : undefined}
            title={i.email ? undefined : W.copyNewLinkHint}
            disabled={busy}
            className={i.send_again ? 'shrink-0 text-xs text-accent' : quiet}
            onClick={() => void again()}
          >
            {i.send_again && i.email ? W.sendAgain : i.email ? W.resend : W.copyNewLink}
          </button>
          <button data-testid="revoke-invite" className={quiet} onClick={() => void onRevoke()}>
            {W.revoke}
          </button>
        </span>
        <span data-invite-said={said ? '' : undefined} className="truncate text-badge text-ink-3">
          {said ??
            (i.send_again ? (i.email ? W.linkStopped : W.linkStoppedCopy) : null) ??
            [
              i.role === 'owner' ? W.owner : W.member,
              i.project_ids.length
                ? i.project_ids
                    .map((id) => projects.find((p) => p.id === id)?.name)
                    .filter(Boolean)
                    .join(', ') || W.nProjects(i.project_ids.length)
                : W.noProjectsYet,
              W.until(new Date(i.expires_at).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })),
            ].join(' · ')}
        </span>
      </span>
    </div>
  )
}
