import { SAYS, MORE } from '../../data/words.js'
import { APP as W } from '../../words/app.js'
import { api } from '../../data/api.js'
import { Project as ProjectScreen } from '../Project.jsx'
import { inviteAway } from '../../data/doors.js'
import { format } from '../../data/route.js'
import { EmptyState } from '../kit.jsx'
import { Icon } from '../glyphs.jsx'
import { type AppState } from './useAppState.js'
import { type AppLoad } from './useAppLoad.js'
import { type AppPlace } from './useAppPlace.js'
import { type ShellParts } from './shellParts.jsx'

/**
 * Projects: the index, or the one open.
 */
export function projectsScreen({
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
}: Pick<AppState, 'projects' | 'navigate' | 'replace' | 'beneath' | 'view' | 'rooms' | 'loaded' | 'revision' | 'found' | 'notes'> & {
  me: NonNullable<AppState['me']>
} & Pick<AppLoad, 'load'> &
  Pick<AppPlace, 'onProject' | 'look' | 'at' | 'key' | 'carriedAt'> &
  Pick<ShellParts, 'project' | 'reloadRooms' | 'canCreate'>): React.ReactNode {
  return (
    view === 'projects' &&
    /*
     * A number in the address that nothing in this project answers to.
     *
     * Said here rather than by the screen below, which would have to
     * be handed an id it could not be given: the address named a thing
     * by its number and there is no such thing, so this is the same
     * answer as a project that is not here, one floor down.
     */
    (key && found[key] === '' ? (
      <div className="flex h-full flex-col px-[var(--gutter)] pt-7">
        <EmptyState art="plinth" title={`${SAYS.nothingIsNumber} ${at}.`}>
          {SAYS.mayBeInAnother}
          <button
            data-testid="to-project"
            onClick={() =>
              navigate({
                view: 'projects',
                ...(beneath.view === 'projects' && beneath.projectId ? { projectId: beneath.projectId } : {}),
                tool: beneath.view === 'projects' ? (beneath.tool ?? 'tasks') : 'tasks',
              })
            }
            className="block pt-2 text-base font-medium text-accent"
          >
            {MORE.backToTheProject}
          </button>
        </EmptyState>
      </div>
    ) : project ? (
      <div className="flex h-full min-h-0 flex-col">
        {/* Archived, and still itself: the work is all here, and the way
                back is one press. `docs/specs/projects-index.md`. */}
        {project.archived_at && (
          <div
            data-archived-banner
            className="mx-[var(--gutter)] mt-3 flex shrink-0 items-center gap-3 rounded-[var(--r-row)] px-4 py-2 text-sm bg-track text-ink-2"
          >
            <Icon name="folder" size={14} />
            <span className="min-w-px flex-1 truncate">{W.archivedBanner}</span>
            {(project.can ?? me.can).includes('project.archive') && (
              <button
                data-testid="banner-put-back"
                onClick={async () => {
                  await api(`/projects/${project.id}/unarchive`, { method: 'POST' })
                  await load()
                }}
                className="shrink-0 font-medium text-accent"
              >
                {MORE.putItBack}
              </button>
            )}
          </div>
        )}
        {/* A sample says so, and goes in one press — for good, not to
                the bin. A band with its
                button standing as one: a line of small type over the
                tasks read as part of the page, and nobody took the
                project for anything but their own. */}
        {project.sample && (
          <div
            data-sample-banner
            className="mt-3 flex shrink-0 flex-wrap items-center gap-4 rounded-t-[var(--r-card)] px-4 pt-3 pb-7"
            /* Behind the project, not over it: open at the foot, so the
                   screen under it reads as standing in it. Grey, so the
                   accent is left to the button that ends it. */
            style={{ background: 'var(--badge)' }}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent" style={{ color: '#fff' }}>
              <Icon name="spark" size={16} />
            </span>
            <span className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-base font-medium text-ink">{W.sample}</span>
              <span className="text-sm text-ink-2">{W.sampleBody}</span>
            </span>
            <button
              data-testid="sample-delete"
              onClick={async () => {
                await api(`/projects/${project.id}/sample`, { method: 'DELETE' })
                navigate({ view: 'my' })
                await load()
              }}
              className="flex h-8 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-transform active:scale-[0.97] bg-accent"
              style={{ color: '#fff' }}
            >
              <Icon name="trash" size={14} />
              {W.deleteSample}
            </button>
          </div>
        )}
        {/* Standing in front of the band, a little into it. */}
        <div className={`min-h-0 flex-1 ${project.sample ? 'relative -mt-4' : ''}`}>
          <ProjectScreen
            key={project.id}
            project={project}
            canWrite={me.can.includes('content.create')}
            canReadActivity={me.can.includes('activity.read')}
            rooms={rooms}
            onRoomsChanged={reloadRooms}
            /* How many announcements in this project are addressed to you
                 and not read. The inbox has carried the project on every
                 notification since it was written; nothing new is asked
                 for. */
            waitingPosts={(notes ?? []).filter((n) => n.object_type === 'post' && !n.read_at && n.project_id === project.id).length}
            revision={revision}
            /* This project's answers, not the workspace's. A button hidden
                 by the wrong list is a button somebody is allowed to press
                 and cannot find. */
            can={project.can ?? me.can}
            meId={me.actor.id}
            /* On a workspace's own domain that keeps inviting shut, this
               project's settings at usetuff.com. */
            inviteAway={inviteAway(me, format({ view: 'projects', projectId: project.id, tool: 'settings' }))}
            onChanged={load}
            /*
             * Somewhere definite, in one move.
             *
             * This used to go to a bare `/p`, which formats to `/` and is
             * then resolved to the first project by an effect once the list
             * comes back. Two navigations, both after the fact — so
             * anything clicked in that window was overwritten by the second
             * one, and deleting a project and immediately opening the bin
             * put you back on the home screen with no sign of why.
             *
             * The index is also the right place to land: you have just
             * removed something, and that is the screen with the bin on it.
             */
            onGone={() => navigate({ view: 'projects-all' })}
            tool={beneath.view === 'projects' ? (beneath.tool ?? '') : ''}
            objectId={
              beneath.view === 'projects'
                ? /* Known on this device already, it opens with the first
                     frame rather than after the effect that asks. */
                  (beneath.objectId ?? (key ? (found[key] ?? carriedAt(key)) : null))
                : null
            }
            /* Defaults live here, in the one place that reads the
                 address, so no screen has to remember them. */
            mode={beneath.view === 'projects' ? (beneath.mode ?? look.mode ?? 'list') : 'list'}
            group={beneath.view === 'projects' ? (beneath.group ?? look.group ?? 'list') : 'list'}
            sort={beneath.view === 'projects' ? (beneath.sort ?? look.sort ?? 'manual') : 'manual'}
            dir={beneath.view === 'projects' ? (beneath.dir ?? look.dir ?? 'asc') : 'asc'}
            /* Absent is every list, which is why this one has no default
                 word to fall back to. */
            list={beneath.view === 'projects' ? (beneath.list ?? look.list ?? null) : null}
            who={beneath.view === 'projects' ? (beneath.who ?? 'all') : 'all'}
            labels={beneath.view === 'projects' ? (beneath.labels ?? '') : ''}
            /* Files' place; `''` while the address names a thing inside
                 the tool instead, so nothing settles a kind over it. */
            kind={beneath.view === 'projects' ? (beneath.kind ?? (beneath.at || beneath.objectId ? '' : null)) : null}
            onNavigate={(to, how) => {
              /* From the screen underneath, which is this one: a
                   navigation made while the palette is open is a
                   navigation of the project it is open over. */
              const was = onProject?.projectId
              if (!was) return
              const tool = to.tool ?? onProject?.tool
              // `objectId: null` means close it; leaving it out means keep
              // whatever is open. Those are different requests and a single
              // optional field cannot say both.
              const objectId = to.objectId === null ? undefined : (to.objectId ?? onProject?.objectId)
              const mode = to.mode ?? onProject?.mode
              /* The rest of how the list is being looked at, carried
                   through unless this navigation says otherwise. */
              const look = { group: 'group', sort: 'sort', dir: 'dir', who: 'who', labels: 'labels' } as const
              const kept: Record<string, string> = {}
              for (const key of Object.values(look)) {
                const said = (to as Record<string, string | undefined>)[key] ?? onProject?.[key]
                if (said) kept[key] = said
              }
              /* Which list, where `null` means every one of them and
                   leaving it out means keep the one that is on — the same
                   two different requests `objectId` has, and the same reason
                   one optional field cannot say both. */
              const list = to.list === null ? undefined : (to.list ?? onProject?.list)
              /* Files' place, kept while nothing else is asked for on the
                   same tool: opening a file drops it from the address
                   (`format` lets the file win) and back brings it back. */
              const kind =
                to.kind === null
                  ? undefined
                  : (to.kind ?? (tool === onProject?.tool && to.objectId === undefined ? onProject?.kind : undefined))
              /* A default the screen settled on — which room the Chat tab
                   opened on — is the same place said more precisely, not a
                   step for back to walk through. */
              ;(how === 'settle' ? replace : navigate)({
                view: 'projects',
                projectId: was,
                ...(tool ? { tool } : {}),
                ...(objectId ? { objectId } : {}),
                ...(mode ? { mode } : {}),
                ...(list ? { list } : {}),
                ...(kind && tool === 'files' ? { kind } : {}),
                ...kept,
              })
            }}
          />
        </div>
      </div>
    ) : (
      /*
       * Three different answers, and this said the same one to all of
       * them: "No projects yet", under a sidebar listing four.
       *
       * An address outlives what it points at — a project deleted, a
       * link from somebody who is on it to somebody who is not, a
       * workspace switched underneath a tab left open — and the screen
       * has to say which of those it is. Saying the workspace is empty
       * when it is not sends somebody looking for a bug in their
       * account.
       */
      <div className="flex h-full flex-col px-[var(--gutter)] pt-7">
        {!loaded ? null : projects.length === 0 ? (
          <EmptyState art="crate" title={SAYS.noProjectsYet}>
            {canCreate ? W.projectsBody : W.addedYouBody}
          </EmptyState>
        ) : (
          <EmptyState art="plinth" title={SAYS.projectNotHere}>
            {SAYS.mayBeOneYouAreNotOn}
            <button
              data-testid="to-projects"
              onClick={() => navigate({ view: 'projects-all' })}
              className="block pt-2 text-base font-medium text-accent"
            >
              {MORE.seeTheProjects}
            </button>
          </EmptyState>
        )}
      </div>
    ))
  )
}
