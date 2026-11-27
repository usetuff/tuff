import { ProjectGithub } from './Github.jsx'
import { ProjectSlack } from './Slack.jsx'
import { FeedbackSettings } from './FeedbackSettings.jsx'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { InviteDialog } from './InviteDialog.jsx'
import { pictureFor } from '../data/picture.js'
import { onHost } from '../data/host.js'
import { FACTS, HEADS, MAKE, MORE, PROJECT, SAYS, now } from '../data/words.js'
import { PROJECT_SETTINGS as W } from '../words/projectSettings.js'
import type { FeedbackSettings as FeedbackSettingsRead, PersonInProject, PersonInWorkspace } from '@tracker/shared-schema'
import { api, stored } from '../data/api.js'
import { ahead, known } from '../data/ahead.js'
import { ON_JOINING, rightsFor } from '../data/rights.js'
import { ORDER } from '../data/tools.js'
import { TOOLS } from '../words/tools.js'
import { asHours } from '../data/hours.js'
import { asDollars, asTokens, sumOf } from '../data/spend.js'
import { Icon, ProjectMark, hashedMark, markOf, type IconName } from './icons.jsx'
import { Create } from './Create.jsx'
import {
  Avatar,
  Button,
  Empty,
  Hairline,
  MarkRails,
  PageTitle,
  Panel,
  SectionHead,
  Toolbar,
  quietLook,
  type Label,
  notALogin,
} from './kit.jsx'
import { Switch, Said, TriageSwitch } from './projectSettings/rights.jsx'
import { useReorder, Grip, DropLine, LabelRow, ListRow } from './projectSettings/lists.jsx'
import { ImportTasks } from './projectSettings/importTasks.jsx'
import { CycleRow, NewCycle } from './projectSettings/cycles.jsx'
import { MemberRow, AddMember } from './projectSettings/members.jsx'
import { CopyProject } from './projectSettings/copyProject.jsx'
import { EmptyChannels } from './projectSettings/emptyChannels.jsx'

/* From the contract — `shared-schema/src/responses.ts`. */
export type Member = PersonInProject
/* From the contract — `shared-schema/src/responses.ts`. */
export type Person = PersonInWorkspace
/** A named stretch of dates tasks can be put into. */
export type Cycle = { id: string; name: string; starts_on: string; ends_on: string; tasks: number }
/** A place a task can be, and the mark it wears. */
/** AI spend on the project by person and tool — `GET /api/spend`. */
type SpendRow = { actor_id: string; actor_name: string; client: string; tokens: number; cost_usd: number | null }
export type List = {
  id: string
  name: string
  icon: string
  /** What its mark is drawn in, or null for the mark's own — `Dot`. */
  color: string | null
  finishes: boolean
  /** How many are in it, counted by the server: a list is not taken away
      without saying where that many tasks go. */
  tasks: number
  /** The agent that takes its new tasks, and whether it has left the
      project since. */
  agent_id?: string | null
  agent_gone?: boolean
}

/* The four, named where the tabs are named — `web/src/words/tools.ts`. This
   was a list of its own, which is how a tool gets renamed on its tab and
   keeps its old name on the switch that turns it off. Read by the schema's
   own kind, so there is no raw `posts` to fall back to. */
const SWITCHES = ORDER.map((t) => [t, TOOLS[t]] as const)

export function ProjectSettings({
  project,
  can,
  onChanged,
  onGone,
}: {
  project: {
    id: string
    name: string
    description: string | null
    tools: string[]
    archived_at: string | null
    icon_url?: string | null | undefined
    mark_icon?: string | null | undefined
    mark_tint?: number | null | undefined
    sample?: boolean | undefined
  }
  can: string[]
  onChanged: () => Promise<void>
  /** Archived or deleted: the sidebar has to stop showing it. */
  onGone: () => void
}) {
  /*
   * `null` until everything this screen shows has arrived.
   *
   * It is five sections stacked, each filling from its own request, so every
   * answer that landed pushed the ones below it down — the members alone
   * moved Hours a hundred and twenty pixels while somebody was reading it.
   * A settings page is read top to bottom once; drawing it once, whole, is
   * worth the forty milliseconds of waiting for the slowest of them.
   */
  /* Each from its last answer, so a second visit is whole at once —
     `data/ahead.ts`. */
  const [members, setMembers] = useState<Member[] | null>(
    () => known<{ members: Member[] }>(`/projects/${project.id}/members`)?.members ?? null,
  )
  const [people, setPeople] = useState<Person[]>(() => known<{ people: Person[] }>('/people')?.people ?? [])
  /* The agents that may be put on this project — the last answer first. */
  const [agentsHere, setAgentsHere] = useState<Set<string>>(
    () =>
      new Set(
        (known<{ agents: { actor_id: string; offered_project_ids: string[] }[] }>('/agents')?.agents ?? [])
          .filter((g) => g.offered_project_ids.includes(project.id))
          .map((g) => g.actor_id),
      ),
  )
  const [name, setName] = useState(project.name)
  /* Whether the mark's rails are open. */
  const [marking, setMarking] = useState(false)
  /* Why a picture was not taken, said under the name — `data/picture.ts`. */
  const [pictureSaid, setPictureSaid] = useState<string | null>(null)
  const [tools, setTools] = useState<string[]>(project.tools)
  const [hours, setHours] = useState<{ actor_id: string; actor_name: string; minutes: number }[] | null>(
    () => known<{ time: { actor_id: string; actor_name: string; minutes: number }[] }>(`/time?project=${project.id}`)?.time ?? null,
  )

  /* What AI tools reported on its tasks. */
  const [spend, setSpend] = useState<SpendRow[] | null>(() => known<{ spend: SpendRow[] }>(`/spend?project=${project.id}`)?.spend ?? null)

  const [lists, setLists] = useState<List[] | null>(() => known<{ lists: List[] }>(`/projects/${project.id}/lists`)?.lists ?? null)

  /* Read again when the feedback page added Triage. */
  const [triageBeat, setTriageBeat] = useState(0)
  /* The feedback page's section, read with the rest so it does not arrive
     after them and push what is under it down.
     False when it could not be read: the section is then left out. */
  const [feedbackRead, setFeedbackRead] = useState<FeedbackSettingsRead | null | false>(() =>
    known<FeedbackSettingsRead>(`/projects/${project.id}/feedback`),
  )
  useEffect(() => {
    void ahead<FeedbackSettingsRead>(`/projects/${project.id}/feedback`)
      .then(setFeedbackRead)
      .catch(() => setFeedbackRead(false))
  }, [project.id])

  const loadLists = useCallback(async () => {
    setLists((await ahead<{ lists: List[] }>(`/projects/${project.id}/lists`)).lists ?? [])
  }, [project.id])
  useEffect(() => void loadLists().catch(() => setLists([])), [loadLists])

  /*
   * This project's labels, with how many of its tasks carry each — looked
   * after here, under the lists.
   */
  const [labels, setLabels] = useState<(Label & { used: number })[] | null>(
    () => known<{ labels: (Label & { used: number })[] }>(`/projects/${project.id}/labels`)?.labels ?? null,
  )
  const loadLabels = useCallback(async () => {
    setLabels((await ahead<{ labels: (Label & { used: number })[] }>(`/projects/${project.id}/labels`)).labels ?? [])
  }, [project.id])
  useEffect(() => void loadLabels().catch(() => setLabels([])), [loadLabels])
  const mayLabels = can.includes('content.create')

  /* Their order, moved by hand: the screen first, then the server, then
     the answer read again. */
  const reordered = <T extends { id: string }>(had: T[] | null, id: string, after: string | null) => {
    if (!had) return had
    const moving = had.find((x) => x.id === id)
    if (!moving) return had
    const rest = had.filter((x) => x.id !== id)
    rest.splice(after === null ? 0 : rest.findIndex((x) => x.id === after) + 1, 0, moving)
    return rest
  }
  const listOrder = useReorder(
    (lists ?? []).map((l) => l.id),
    (id, after) => {
      setLists((had) => reordered(had, id, after))
      void api(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify({ after }) })
        .catch(() => null)
        .then(() => loadLists())
    },
  )
  const labelOrder = useReorder(
    (labels ?? []).map((l) => l.id),
    (id, after) => {
      setLabels((had) => reordered(had, id, after))
      void api(`/labels/${id}`, { method: 'PATCH', body: JSON.stringify({ after }) })
        .catch(() => null)
        .then(() => loadLabels())
    },
  )

  /* The project's cycles. */
  const [cycles, setCycles] = useState<Cycle[] | null>(() => known<{ cycles: Cycle[] }>(`/projects/${project.id}/cycles`)?.cycles ?? null)
  const loadCycles = useCallback(async () => {
    setCycles((await ahead<{ cycles: Cycle[] }>(`/projects/${project.id}/cycles`)).cycles ?? [])
  }, [project.id])
  useEffect(() => void loadCycles().catch(() => setCycles([])), [loadCycles])

  const loadHours = useCallback(async () => {
    const r = await ahead<{ time: { actor_id: string; actor_name: string; minutes: number }[] }>(`/time?project=${project.id}`)
    setHours(r.time ?? [])
  }, [project.id])
  useEffect(() => void loadHours().catch(() => setHours([])), [loadHours])
  useEffect(
    () =>
      void ahead<{ spend: SpendRow[] }>(`/spend?project=${project.id}`)
        .then((r) => setSpend(r.spend ?? []))
        .catch(() => setSpend([])),
    [project.id],
  )

  const meId = stored()?.actor_id ?? null

  /*
   * Whether this person runs *this* project.
   *
   * Asked of the project, not of the workspace. `/api/me` answers what
   * somebody may do with no project in mind, and running a project is a flag
   * on one project — so a member who runs this one would have been shown no
   * controls at all, having been given exactly the right to use them.
   *
   * The owner runs every project without being on it, which is why they are
   * checked separately: they need not appear in this list.
   */
  const runsIt = can.includes('workspace.billing') || members?.some((m) => m.actor_id === meId && m.rights.includes('manage')) === true

  const mayManage = runsIt
  const mayTools = runsIt
  /* Linking a GitHub repository or a Slack channel sends the work out, and
     a session made on a workspace's own domain is refused it, as it is
     the person's own repositories — so on a host the links are read, not
     chosen. */
  const mayLinkOut = mayTools && !onHost()
  const mayStaff = can.includes('project.member.add')
  /* Taking somebody off is running the project, not adding to it — the
     server's `project.member.remove`, read rather than guessed at. */
  const mayUnstaff = can.includes('project.member.remove')
  /* Whose permissions are open — one at a time, so the list stays a list. */
  const [opened, setOpened] = useState<string | null>(null)
  /* Somebody new, invited straight onto this project. */
  const [inviting, setInviting] = useState(false)
  /* Never offered against yourself. Giving up running a project, like
     ticking your own guest box, takes away the permission needed to undo it.
     The server refuses both; this is so nobody reaches for them. */
  const mayRestrict = runsIt
  /* A list is where tasks go, so it is the same permission the server asks
     for: somebody who may make tasks and not the lists to put them in can
     only add to an arrangement that is not theirs. */
  const mayLists = can.includes('task.create')
  /* Taking one away is the other right, because it is the verb that takes
     work away from everybody else as well. Somebody
     may arrange the lists without being the person who can remove one. */
  const mayDropLists = can.includes('task.delete')

  const load = useCallback(async () => {
    /* Side by side, not one after the other: two round trips were the
       slowest of this screen's reads. */
    const [m, p, a] = await Promise.all([
      ahead<{ members: Member[] }>(`/projects/${project.id}/members`),
      can.includes('people.read') ? ahead<{ people: Person[] }>('/people') : Promise.resolve(null),
      /* Which agents could come here: an agent goes only where whoever
         connected it is, and `/agents` says where that is per agent.
         Refused or failed, none is offered
         rather than one the add would refuse. */
      can.includes('people.read') && can.includes('project.member.add')
        ? ahead<{ agents: { actor_id: string; offered_project_ids: string[] }[] }>('/agents').catch(() => ({ agents: [] }))
        : Promise.resolve({ agents: [] }),
    ])
    setMembers(m.members)
    if (p) setPeople(p.people)
    setAgentsHere(new Set((a.agents ?? []).filter((g) => g.offered_project_ids.includes(project.id)).map((g) => g.actor_id)))
  }, [project.id, can])
  useEffect(() => void load(), [load])

  async function patch(body: Record<string, unknown>) {
    await api(`/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    await onChanged()
  }

  async function toggleTool(tool: string) {
    const next = tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool]
    // A project with no tools is a project with no screens. The server would
    // refuse it; refusing it here means the button simply does not act.
    if (next.length === 0) return
    // The checkbox moves now. Waiting for the project list to come back means
    // a tick where the box springs back to where it was, which reads as the
    // click not having landed.
    setTools(next)
    try {
      await patch({ tools: next })
    } catch {
      setTools(project.tools)
    }
  }

  /* Everybody not on it yet: the people, then the agents that may come. */
  const off = people.filter((p) => !(members ?? []).some((m) => m.actor_id === p.actor_id) && (!p.agent || agentsHere.has(p.actor_id)))

  /* Drawn whole or not at all. Five sections each filling from its own
     request is five chances to move the four below it. */
  /* The name on the tool's bar, where the tasks keep theirs — TRA-98 —
     drawn before the five sections arrive so the bar does not fill late. */
  const head = (
    <Toolbar>
      <span className="mr-auto flex min-w-px items-center gap-3">
        <PageTitle>{HEADS.settings}</PageTitle>
      </span>
    </Toolbar>
  )

  /* All five, labels and sprints among them: the two left out of this used
     to arrive after the rest and push Hours down as it was read. */
  if (!members || !hours || !spend || !lists || !labels || !cycles || (tools.includes('tasks') && feedbackRead === null)) return head

  return (
    /*
     * One column, scrolling, in the width the prose wants.
     *
     * This screen was written in a dialect of its own — native checkboxes, a
     * native select, `text-xs`, headings that were body text, and actions as
     * underlined words. Beside the tasks list, which is panels and hairlines
     * and pill controls at 14px, it read as a different product. Nothing here
     * is new: it is the same five sections in the vocabulary the rest of the
     * screens already use.
     */
    <div data-foot className="reads min-h-0 flex-1 overflow-y-auto">
      {head}
      <div data-whole="project-settings" className="flex max-w-[640px] flex-col gap-9 pb-10">
        <section className="flex flex-col gap-3">
          <SectionHead>{HEADS.theProject}</SectionHead>
          <Panel>
            {/*
              The mark and the name on one line, because they are one fact.
              The mark is generated from the id, so it is stable and unlike
              the project next to it whose name starts the same — a default
              rather than a placeholder.
            */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* The mark is the way to its rails: they stood open on every
                  visit, two rows of twenty-odd chips under a name that is
                  changed once. Pressed, they open under it. */}
              {mayManage && !project.icon_url ? (
                <button
                  type="button"
                  data-testid="project-mark-toggle"
                  aria-expanded={marking}
                  aria-label={W.changeIcon}
                  title={W.changeIcon}
                  onClick={() => setMarking((v) => !v)}
                  className="flex shrink-0 rounded-[var(--r-row)] transition-transform active:scale-[0.96]"
                  style={{ boxShadow: marking ? '0 0 0 2px var(--accent)' : undefined }}
                >
                  <ProjectMark {...markOf(project)} size={28} />
                </button>
              ) : (
                <ProjectMark {...markOf(project)} size={28} />
              )}
              <input
                {...notALogin}
                data-testid="project-name"
                className="min-w-px flex-1 bg-transparent text-lg font-medium outline-none text-ink"
                style={{ letterSpacing: 'var(--track-title)' }}
                value={name}
                disabled={!mayManage}
                onChange={(e) => setName(e.target.value)}
                // Read from the field rather than from state, for the reason
                // the task and document editors give: leaving it in the same
                // tick as the last keystroke sends what was there before.
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== project.name) void patch({ name: next })
                }}
              />
              {mayManage && (
                <span className="flex shrink-0 items-center gap-2">
                  <label
                    data-control
                    className="inline-flex h-7 cursor-pointer items-center rounded-full px-4 text-sm font-medium"
                    style={quietLook}
                  >
                    {project.icon_url ? W.change : W.uploadPicture}
                    <input
                      type="file"
                      accept="image/*"
                      data-testid="project-icon"
                      className="hidden"
                      onChange={async (e) => {
                        const chosen = e.target.files?.[0]
                        e.target.value = ''
                        if (!chosen) return
                        setPictureSaid(null)
                        /* Made fit first — an SVG drawn as a PNG, a big
                           photo made small — and a refusal said, where the
                           button used to do nothing at all. `data/picture.ts`. */
                        const picked = await pictureFor(chosen)
                        if ('refused' in picked) return setPictureSaid(picked.refused)
                        const form = new FormData()
                        form.append('file', picked)
                        // Not through api(): multipart sets its own content type.
                        const r = await fetch(`/api/projects/${project.id}/icon`, {
                          method: 'POST',
                          headers: {
                            'x-api-version': '1',
                            'x-tongue': now,
                            authorization: `Bearer ${stored()?.access_token ?? ''}`,
                          },
                          body: form,
                        }).catch(() => null)
                        if (!r?.ok) {
                          const body = (await r?.json().catch(() => null)) as { error?: { message?: string } } | null
                          return setPictureSaid(body?.error?.message ?? W.couldNotUpload)
                        }
                        await onChanged()
                      }}
                    />
                  </label>
                  {project.icon_url && (
                    <button
                      data-testid="drop-icon"
                      onClick={async () => {
                        await api(`/projects/${project.id}/icon`, { method: 'DELETE' })
                        await onChanged()
                      }}
                      /* Bare, as the workspace's and the account's are: the
                         way back is the lesser of the two words beside it. */
                      className="inline-flex h-7 shrink-0 items-center rounded-full px-4 text-sm font-medium text-ink-2"
                    >
                      {MORE.backToTheMark}
                    </button>
                  )}
                </span>
              )}
            </div>
            {/*
              What the mark looks like.
              
              The same two rails a list's mark is given, in the same order
              and with the same first cell on each: what the id gives, drawn
              as the thing it does rather than as a swatch. A project and a
              list are both a thing with a mark, and two vocabularies for one
              question is how a screen stops reading as one product.
              
              Not shown while a picture is set, because the picture wins and
              a rail that changes nothing on the screen reads as broken. It
              is still there underneath: dropping the picture brings back
              what was chosen, not the hash.
            */}
            {pictureSaid && (
              <p data-testid="picture-refused" className="px-4 pb-3 text-sm text-danger">
                {pictureSaid}
              </p>
            )}
            {mayManage && !project.icon_url && marking && (
              <>
                <Hairline inset={16} />
                <div className="px-4 py-3">
                  <MarkRails
                    icon={project.mark_icon ?? null}
                    tint={project.mark_tint ?? null}
                    ownIcon={hashedMark(project.id).icon}
                    ownTintIcon={(project.mark_icon as IconName | null) ?? hashedMark(project.id).icon}
                    ownTint={`var(--tint-${hashedMark(project.id).tint})`}
                    onIcon={(mark_icon) => void patch({ mark_icon })}
                    onTint={(mark_tint) => void patch({ mark_tint })}
                    iconSaid={PROJECT.itsMark}
                    tintSaid={PROJECT.itsColour}
                    ownSaid={W.default}
                    iconAttrs={{ 'data-project-mark': project.mark_icon ?? 'hashed' }}
                    tintAttrs={{ 'data-project-tint': String(project.mark_tint ?? 'hashed') }}
                  />
                </div>
              </>
            )}
          </Panel>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead>{HEADS.tools}</SectionHead>
          <Said>{W.toolsHint}</Said>
          {/* Pills, the same ones the view menu uses for what a row shows.
              A tool is on or off and there are four of them: a row of
              switches reads as one question, four checkboxes as four. */}
          <div className="flex flex-wrap gap-2 px-1">
            {SWITCHES.map(([id, label]) => (
              <Switch
                key={id}
                attr="data-tool-switch"
                on={tools.includes(id)}
                label={label}
                disabled={!mayTools}
                onChange={() => void toggleTool(id)}
              />
            ))}
          </div>
        </section>

        {/* Tasks from Jira, Asana, Linear or a spreadsheet. */}
        {tools.includes('tasks') && <ImportTasks projectId={project.id} may={mayLists} onChanged={onChanged} />}

        {/* What arrives waits to be accepted. */}
        {tools.includes('tasks') && (
          <TriageSwitch
            key={triageBeat}
            projectId={project.id}
            may={mayTools}
            onChanged={() => {
              /* The lists above, from the read the switch made after its
                 press: Triage's own list comes and goes with it. */
              setLists((had) => known<{ lists: List[] }>(`/projects/${project.id}/lists`)?.lists ?? had)
              return onChanged()
            }}
          />
        )}

        {/* A public page where anybody asks for something. */}
        {tools.includes('tasks') && feedbackRead && (
          <FeedbackSettings
            projectId={project.id}
            owner={can.includes('workspace.billing')}
            read={feedbackRead}
            onTriage={() => {
              void loadLists().then(() => setTriageBeat((n) => n + 1))
              void onChanged()
            }}
          />
        )}

        {/* Its repository on GitHub. Not for a
            sample, which anybody on it deletes for good in one press: the
            server refuses it one. */}
        {tools.includes('tasks') && !project.sample && <ProjectGithub projectId={project.id} may={mayLinkOut} />}

        {/* The Slack channel it posts its news to. */}
        <ProjectSlack projectId={project.id} may={mayLinkOut} />

        {/* Its channels nobody is in any more, to end. */}
        {tools.includes('messages') && <EmptyChannels projectId={project.id} projectName={project.name} />}

        {/*
          Where the lists are kept.
          
          They were changed from the tasks bar, by a word "rename" that
          appeared beside the chips once one of them was open — a control
          that only existed while you were already looking at the thing it
          edited, and no way at all to change a list's mark afterwards. The
          bar is for switching between them; this is where they are.
        */}
        {tools.includes('tasks') && (
          <section className="flex flex-col gap-3">
            <SectionHead>{HEADS.lists}</SectionHead>
            <Said>{W.listsHint}</Said>
            <Panel>
              <div ref={listOrder.box} className="relative">
                {lists.map((l, i) => (
                  <div key={l.id} data-reorder className="relative" style={listOrder.held?.id === l.id ? { opacity: 0.4 } : undefined}>
                    {i > 0 && <Hairline inset={14} />}
                    {/* A row the server has not answered for yet is drawn and
                      not edited: there is nothing to rename, and its answer
                      replaces it — with whatever was typed into it. The
                      rule comments already keep. */}
                    {mayLists && !l.id.startsWith('pending:') && (
                      <Grip said={l.name} held={listOrder.held?.id === l.id} {...listOrder.grip(l.id)} />
                    )}
                    <ListRow
                      list={l}
                      others={lists.filter((o) => o.id !== l.id)}
                      may={mayLists && !l.id.startsWith('pending:')}
                      mayDrop={mayDropLists && !l.id.startsWith('pending:')}
                      agents={members.filter((m) => m.agent)}
                      everyone={people}
                      mayAgent={can.includes('list.agent') && !l.id.startsWith('pending:')}
                      onChanged={loadLists}
                    />
                  </div>
                ))}
                {listOrder.held && <DropLine at={listOrder.held.line} />}
              </div>
              {mayLists && (
                <>
                  {lists.length > 0 && <Hairline inset={14} />}
                  <div className="px-4 py-2">
                    {/* A field, not a dialog: adding three lists in a row is
                        type, Enter, type, Enter. The mark is set on the row
                        it makes, which is where it can be seen. */}
                    <Create
                      label={MAKE.addAList}
                      variant="row"
                      onCreate={async (text) => {
                        setLists((had) => [
                          ...(had ?? []),
                          {
                            id: `pending:${Date.now()}`,
                            name: text,
                            icon: 'statusOpen',
                            color: null,
                            finishes: false,
                            tasks: 0,
                          } as unknown as List,
                        ])
                        await api(`/projects/${project.id}/lists`, {
                          method: 'POST',
                          body: JSON.stringify({ name: text }),
                        }).catch(() => null)
                        await loadLists()
                      }}
                    />
                  </div>
                </>
              )}
            </Panel>
          </section>
        )}

        {/*
          Labels, under the lists: the other words the work is filed under,
          and like the lists, the project's own.
        */}
        {tools.includes('tasks') && (
          <section className="flex flex-col gap-3">
            <SectionHead>{FACTS.labels}</SectionHead>
            <Said>{W.labelsHint}</Said>
            <Panel>
              <div ref={labelOrder.box} className="relative">
                {(labels ?? []).map((l, i) => (
                  <div key={l.id} data-reorder className="relative" style={labelOrder.held?.id === l.id ? { opacity: 0.4 } : undefined}>
                    {i > 0 && <Hairline inset={14} />}
                    {mayLabels && !l.id.startsWith('pending:') && (
                      <Grip said={l.name} held={labelOrder.held?.id === l.id} {...labelOrder.grip(l.id)} />
                    )}
                    <LabelRow label={l} may={mayLabels && !l.id.startsWith('pending:')} onChanged={loadLabels} />
                  </div>
                ))}
                {labelOrder.held && <DropLine at={labelOrder.held.line} />}
              </div>
              {mayLabels && (
                <>
                  {(labels ?? []).length > 0 && <Hairline inset={14} />}
                  <div className="px-4 py-2">
                    <Create
                      label={MAKE.addALabel}
                      variant="row"
                      onCreate={async (text) => {
                        setLabels((had) => [
                          ...(had ?? []),
                          { id: `pending:${Date.now()}`, name: text, color: null, used: 0 } as unknown as Label & { used: number },
                        ])
                        await api(`/projects/${project.id}/labels`, {
                          method: 'POST',
                          body: JSON.stringify({ name: text }),
                        }).catch(() => null)
                        await loadLabels()
                      }}
                    />
                  </div>
                </>
              )}
            </Panel>
          </section>
        )}

        {/*
          Cycles, under the lists.
          
          A list is where a task *is* and a cycle is *when* — two placements
          of different kinds, so they are two sections rather than one. A
          project starts with none: most work here is not in a sprint, and
          the picker on a task does not appear until there is something to
          pick.
        */}
        {mayManage && (
          <section className="flex flex-col gap-3">
            <SectionHead>{HEADS.cycles}</SectionHead>
            <Said>{W.sprintsHint}</Said>
            <Panel>
              {(cycles ?? []).map((y, at) => (
                <Fragment key={y.id}>
                  {at > 0 && <Hairline inset={14} />}
                  <CycleRow cycle={y} onChanged={loadCycles} />
                </Fragment>
              ))}
              {(cycles ?? []).length > 0 && <Hairline inset={14} />}
              <NewCycle projectId={project.id} onMade={loadCycles} />
            </Panel>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionHead>{HEADS.whoIsOnIt}</SectionHead>
          <Said>{W.peopleHint}</Said>
          <Panel>
            {members.map((m, i) => (
              <div key={m.actor_id} data-member>
                {i > 0 && <Hairline inset={14} />}
                <MemberRow
                  m={m}
                  projectId={project.id}
                  open={opened === m.actor_id}
                  onToggle={() => setOpened((was) => (was === m.actor_id ? null : m.actor_id))}
                  mayRestrict={Boolean(mayRestrict && m.role && m.role !== 'owner' && m.actor_id !== meId)}
                  mayRemove={mayUnstaff}
                  onRemove={async () => {
                    // Off the list now; the read behind it confirms.
                    setMembers((had) => (had ?? []).filter((x) => x.actor_id !== m.actor_id))
                    await api(`/projects/${project.id}/members/${m.actor_id}`, {
                      method: 'DELETE',
                    }).catch(() => null)
                    await load()
                  }}
                  onDone={load}
                />
              </div>
            ))}

            {/* The way in for more people, the same "Add …" every list on
                this screen ends with: somebody already in the workspace,
                picked; or somebody new, invited straight onto this
                project. */}
            {mayStaff && (off.length > 0 || can.includes('people.invite')) && (
              <>
                <Hairline inset={14} />
                <div className="flex flex-wrap items-center gap-3 px-4 py-2">
                  {off.length > 0 ? (
                    <AddMember
                      offered={off}
                      onPick={async (who) => {
                        // On the list now, with the rights a joiner gets —
                        // an agent's two cut to its one, as the server cuts
                        // them; the read behind it says what they really hold.
                        const rights = ON_JOINING.filter((r) => rightsFor(who.agent).some(([x]) => x === r))
                        setMembers((had) => [...(had ?? []), { ...who, rights }])
                        await api(`/projects/${project.id}/members`, {
                          method: 'POST',
                          body: JSON.stringify({ actor_id: who.actor_id }),
                        }).catch(() => null)
                        await load()
                      }}
                    />
                  ) : (
                    <span className="flex h-8 items-center gap-3 text-base text-ink-3">
                      <Icon name="plusThin" size={14} />
                      {W.everyoneIsHere}
                    </span>
                  )}
                  {can.includes('people.invite') && (
                    <button
                      type="button"
                      data-testid="project-invite"
                      onClick={() => setInviting(true)}
                      className="ml-auto text-base text-accent"
                    >
                      {W.inviteSomeoneNew}
                    </button>
                  )}
                </div>
              </>
            )}
          </Panel>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead>{HEADS.hours}</SectionHead>
          <Said>{W.hoursHint}</Said>
          {hours.length === 0 ? (
            <Empty>{SAYS.nothingLogged}</Empty>
          ) : (
            <Panel>
              {hours.map((h, i) => (
                <div key={h.actor_id} data-hours>
                  {i > 0 && <Hairline inset={14} />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={h.actor_name} id={h.actor_id} size={24} />
                    <span className="min-w-px flex-1 truncate text-base text-ink">{h.actor_name}</span>
                    <span className="shrink-0 text-base tabular-nums text-ink-2">
                      {/* `45m`, not `0h 45m`; `2h`, not `2h 0m`. */}
                      {asHours(h.minutes)}
                    </span>
                  </div>
                </div>
              ))}
            </Panel>
          )}
        </section>

        {spend.length > 0 && (
          <section className="flex flex-col gap-3" data-testid="project-ai">
            <SectionHead>{W.aiUsage}</SectionHead>
            <Said>{W.aiUsageHint}</Said>
            <Panel>
              {[{ key: 'total', name: W.aiTotal, id: null as string | null, client: null as string | null, ...sumOf(spend) }]
                .concat(
                  spend.map((s) => ({
                    key: `${s.actor_id}:${s.client}`,
                    name: s.actor_name,
                    id: s.actor_id,
                    client: s.client,
                    ...sumOf([s]),
                  })),
                )
                .map((r, i) => (
                  <div key={r.key} data-ai-row>
                    {i > 0 && <Hairline inset={14} />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {r.id && <Avatar name={r.name} id={r.id} size={24} />}
                      <span className="min-w-px flex-1 truncate text-base text-ink">
                        {r.name}
                        {r.client && <span className="text-ink-3">{` · ${r.client}`}</span>}
                      </span>
                      <span
                        data-testid={r.id ? undefined : 'project-ai-total'}
                        className="shrink-0 text-base tabular-nums"
                        style={{ color: r.id ? 'var(--ink-2)' : 'var(--ink)' }}
                      >
                        {W.tokens(asTokens(r.tokens))}
                        {r.cost != null && ` · ${asDollars(r.cost)}`}
                      </span>
                    </div>
                  </div>
                ))}
            </Panel>
          </section>
        )}

        {can.includes('project.create') && (
          <section className="flex flex-col gap-3">
            <SectionHead>{HEADS.useAsATemplate}</SectionHead>
            <CopyProject
              name={project.name}
              onCopy={async (copyName) => {
                await api(`/projects/${project.id}/copy`, {
                  method: 'POST',
                  body: JSON.stringify({ name: copyName }),
                })
                await onChanged()
              }}
            />
          </section>
        )}

        {mayManage && (
          <section className="flex flex-col gap-3">
            <SectionHead>{HEADS.archiveAndDelete}</SectionHead>
            {/*
              Two rows, each saying what it does under its own button — not a
              filled Archive beside a red word, where the filled one read as
              the button and three projects meant for the bin were archived
              one after another. `docs/specs/projects-index.md`.
            */}
            <Panel>
              <div data-archive-choice className="flex items-center gap-4 px-4 py-3">
                <span className="flex min-w-px flex-1 flex-col gap-1">
                  <span className="text-base text-ink">{project.archived_at ? W.archived : W.archive}</span>
                  <span className="text-sm text-ink-3">{project.archived_at ? W.archivedHint : W.archiveHint}</span>
                </span>
                {project.archived_at ? (
                  <Button
                    data-testid="unarchive-project"
                    onClick={async () => {
                      await api(`/projects/${project.id}/unarchive`, { method: 'POST' })
                      await onChanged()
                    }}
                  >
                    {MORE.putItBack}
                  </Button>
                ) : (
                  <Button
                    data-testid="archive-project"
                    onClick={async () => {
                      await api(`/projects/${project.id}/archive`, { method: 'POST' })
                      await onChanged()
                      onGone()
                    }}
                  >
                    {MORE.archive}
                  </Button>
                )}
              </div>
              <Hairline inset={14} />
              <div data-delete-choice className="flex items-center gap-4 px-4 py-3">
                <span className="flex min-w-px flex-1 flex-col gap-1">
                  <span className="text-base text-danger">{W.moveToBin}</span>
                  <span className="text-sm text-ink-3">{W.binHint}</span>
                </span>
                <Button
                  data-testid="delete-project"
                  tone="danger"
                  onClick={async () => {
                    await api(`/projects/${project.id}`, { method: 'DELETE' })
                    await onChanged()
                    onGone()
                  }}
                  /* The whole style, since a style given here replaces the
                     button's own: a tint of the danger colour, so it reads as
                     a button and not as a word beside one. */
                  style={{
                    height: 'var(--control-h)',
                    background: 'color-mix(in oklch, var(--danger) 12%, transparent)',
                    color: 'var(--danger)',
                  }}
                >
                  {W.moveToBin}
                </Button>
              </div>
            </Panel>
          </section>
        )}
      </div>
      {inviting && (
        <InviteDialog
          projects={[project as { id: string; name: string; can?: string[] }]}
          owner={false}
          onto={[project.id]}
          onClose={() => setInviting(false)}
          onMade={() => void load()}
        />
      )}
    </div>
  )
}
