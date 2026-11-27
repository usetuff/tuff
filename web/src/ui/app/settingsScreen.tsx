import { edition } from '../../edition.jsx'
import { doorsAway, workspaceDoor } from '../../data/doors.js'
import { APP as W } from '../../words/app.js'
import { api } from '../../data/api.js'
import { PageTitle, Empty } from '../kit.jsx'
import { Icon } from '../glyphs.jsx'
import { Webhooks } from '../Admin.jsx'
import { AuditDoor } from '../AuditLog.jsx'
import { GithubSection } from '../Github.jsx'
import { SlackSection } from '../Slack.jsx'
import { ImportFrom } from '../ImportFrom.jsx'
import { Identity, Switches, Handover, DeleteWorkspace } from '../WorkspaceSettings.jsx'
import { type AppState } from './useAppState.js'
import { type AppLoad } from './useAppLoad.js'

/**
 * The workspace's settings.
 */
export function settingsScreen({
  me,
  setMe,
  navigate,
  view,
  audit,
  settingsWhole,
  load,
}: Pick<AppState, 'setMe' | 'navigate' | 'view' | 'audit' | 'settingsWhole'> & { me: NonNullable<AppState['me']> } & Pick<
    AppLoad,
    'load'
  >): React.ReactNode {
  return (
    view === 'settings' &&
    !audit && (
      /* The workspace's settings. In the
             middle, at the measure My Tasks and a project's Docs read at,
             with its title over the same left edge as everything under it. */
      <div className="flex h-full flex-col px-[var(--gutter)] pt-7 max-sm:pt-3">
        <div className="mx-auto w-full max-w-[800px]">
          <PageTitle>{W.workspaceSettings}</PageTitle>
        </div>
        <div data-steady data-foot className="min-h-0 flex-1 overflow-y-auto pt-5 pb-16">
          <div className="mx-auto w-full max-w-[800px]">
            {settingsWhole && (
              <div data-whole="settings">
                {/* Said plainly to somebody who followed a link here, rather
                than an empty page: nobody else is offered the door. */}
                {!workspaceDoor(me.can) &&
                  (() => {
                    /* The owner on a workspace's own domain, which keeps the
                       settings shut: where they are changed, and the way there. */
                    const at = doorsAway(me).settings
                    if (!at) return <Empty>{W.ownerOnlySettings}</Empty>
                    const where = new URL(at).host
                    return (
                      <Empty>
                        <span className="flex flex-col items-start gap-2">
                          <span>{W.settingsElsewhere(where)}</span>
                          <a
                            data-testid="settings-away"
                            href={at}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent"
                          >
                            {W.openSettingsThere(where)}
                            <Icon name="away" size={12} />
                          </a>
                        </span>
                      </Empty>
                    )
                  })()}

                {/* What it is called and looks like, then what the edition
                says it is on, then the switches. */}
                {me.can.includes('workspace.billing') && (
                  <>
                    <Identity key={me.workspace.id} look={me.workspace} onChanged={load} />
                    {edition.Domain && me.can.includes('workspace.domain') && <edition.Domain look={me.workspace} onChanged={load} />}
                    {edition.Plan && <edition.Plan />}
                    <Switches
                      settings={me.settings as Record<string, string>}
                      onChange={async (k, next) => {
                        // The switch moves first. It used to snap back to the
                        // old value until a full reload of /me returned, which
                        // reads as the click not having landed — and a reload
                        // in that window cancelled the request outright.
                        setMe((prev) => (prev ? { ...prev, settings: { ...prev.settings, [k]: next } } : prev))
                        try {
                          await api('/workspace', { method: 'PATCH', body: JSON.stringify({ [k]: next }) })
                        } finally {
                          await load()
                        }
                      }}
                    />
                  </>
                )}

                {/* The company's machinery. */}
                {/* GitHub, the owner's to connect. */}
                {me.can.includes('audit.read') && <GithubSection />}
                {/* Slack, the owner's to connect. */}
                {me.can.includes('audit.read') && <SlackSection />}
                {/* From Linear, Jira or Asana. */}
                {me.can.includes('audit.read') && <ImportFrom onChanged={load} />}
                {me.can.includes('audit.read') && <Webhooks />}
                {/* The import from Basecamp, Asana or Trello is not offered: it
                has failed on every file since a column it writes went, and
                writes as people the database will not let it write as.
                Back when it works. */}
                {/* Who did what across the workspace, on a page of its own. */}
                {me.can.includes('audit.read') && <AuditDoor onOpen={() => navigate({ view: 'settings', audit: true })} />}

                {/* The one way a workspace changes hands — last, as the rarest
                thing on the page and the one with the most behind it. */}
                {me.can.includes('workspace.transfer') && <Handover meId={me.actor.id} />}
                {/* And after it, the one thing past handing it over: closing it. */}
                {me.can.includes('workspace.delete') && <DeleteWorkspace />}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  )
}
