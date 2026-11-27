import { HEADS, MAKE, PLACES } from '../data/words.js'
import { PHONE_TABS as W } from '../words/phoneTabs.js'
import { INSTANCE } from '../words/instance.js'
import { Icon, type IconName } from './glyphs.jsx'
import { Panel, Hairline } from './kit.jsx'
import { Glass } from './Glass.jsx'
import { ThemeButton, WorkspaceMenu } from './TopBar.jsx'
import type { WorkspaceLook } from './WorkspaceMark.jsx'
import { useWorkspaces, waitingElsewhere } from '../data/workspaces.js'
import { TOP_BAR } from '../words/topBar.js'
import { edition } from '../edition.jsx'

/**
 * The places, along the foot of a phone.
 *
 * Drawn the way the phone's own apps draw theirs: My tasks, Projects, Chat
 * and More in one floating capsule of glass, and Search in a circle of its
 * own beside it, because it is not a place in the workspace but the way to
 * any of them. The column down the side came over the work as a drawer
 * behind a button in the bar's far corner; below 640 it is this instead,
 * and the drawer is a tablet's.
 *
 * Fixed over the foot of the work rather than under it, so a list scrolls
 * on beneath the glass; `--foot` is how far up the work's last row stands
 * so it can still be reached.
 */
const PLACES_AT = ['my', 'projects-all', 'chat', 'more'] as const

export function PhoneTabs({
  view,
  waiting,
  here,
  onGo,
}: {
  view: string
  /** Unread across the rooms, for the count on Chat. */
  waiting: number
  /** The workspace this window is in, so a dot on More says another one. */
  here: string
  onGo: (view: string) => void
}) {
  /* Something waiting for this person in another workspace: a dot on More,
     where the switch is. */
  const elsewhere = waitingElsewhere(useWorkspaces(), here)
  /* Which of the four is lit. A project is inside Projects, and Members and
     Settings are reached from More, so More stays lit over them — as a
     screen pushed inside a tab does on the phone. */
  const lit =
    view === 'projects'
      ? 1
      : view === 'members' || view === 'settings' || view === 'account' || view === 'admin' || view === 'instance'
        ? 3
        : PLACES_AT.indexOf(view as never)
  const tab = (at: number, icon: IconName, label: string, count = 0, dot = false) => {
    const key = PLACES_AT[at]!
    const on = lit === at
    return (
      <button
        key={key}
        type="button"
        data-testid={`tab-${key}`}
        aria-current={on ? 'page' : undefined}
        onClick={() => onGo(key)}
        /* The word close under its glyph, one mark rather than two, and
           what is not lit steps back to the second ink — the phone's own
           tabs, measured. */
        /* Round, so the ring a keyboard draws follows the capsule. */
        className="relative z-10 flex min-w-px flex-1 flex-col items-center justify-center gap-1 rounded-full"
        style={{ color: on ? 'var(--accent)' : 'var(--ink-2)' }}
      >
        <span className="relative flex size-6 items-center justify-center">
          <Icon name={icon} size={22} />
          {count > 0 && (
            <span
              data-tab-count
              className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-badge font-semibold tabular-nums bg-danger"
              style={{ color: '#fff' }}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
          {/* A dot, not a number, over the glyph's corner and in nobody's
              flow: which workspace to look in, not how much. */}
          {dot && (
            <span
              data-testid="tab-more-waiting"
              className="absolute -top-1 -right-1 size-2 rounded-full bg-accent"
              role="img"
              aria-label={TOP_BAR.newElsewhere}
            />
          )}
        </span>
        <span className="truncate text-badge leading-3 font-medium">{label}</span>
      </button>
    )
  }
  return (
    <nav
      data-phone-tabs
      aria-label={W.places}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end gap-2 px-4"
      style={{ paddingBottom: 'var(--foot-gap)' }}
    >
      <Glass radius={32} className="pointer-events-auto relative flex h-16 min-w-px flex-1 items-stretch p-1">
        {/* The lit tab's own lighter capsule. It slides to the tab pressed
            rather than reappearing under it — the one motion in the row,
            and the story of a single thing moving rather than two
            blinking. Gone when what is lit is Search. */}
        <span
          aria-hidden
          data-tab-lens
          className="absolute top-1 bottom-1 left-1 rounded-full motion-safe:transition-[transform,opacity] motion-safe:duration-200 bg-track"
          style={{
            width: 'calc((100% - 8px) / 4)',
            transform: `translateX(${Math.max(lit, 0) * 100}%)`,
            opacity: lit < 0 ? 0 : 1,
            transitionTimingFunction: 'var(--ease-out)',
          }}
        />
        {/* "Tasks": the tab is a word under a glyph, and "My" is what the
            glyph already says — they are the ones on you. */}
        {tab(0, 'tasks', W.tasks)}
        {tab(1, 'folder', HEADS.projects)}
        {tab(2, 'bubble', W.chat, waiting)}
        {tab(3, 'ellipsis', W.more, 0, elsewhere)}
      </Glass>
      <Glass radius={32} className="pointer-events-auto flex size-16 shrink-0">
        <button
          type="button"
          data-testid="tab-search"
          aria-label={W.search}
          aria-current={view === 'search' ? 'page' : undefined}
          onClick={() => onGo('search')}
          className="flex size-full items-center justify-center rounded-full"
          style={{ color: view === 'search' ? 'var(--accent)' : 'var(--ink-2)' }}
        >
          <Icon name="search" size={22} />
        </button>
      </Glass>
    </nav>
  )
}

/**
 * A phone's More tab, as a screen: what the column and the drawer's head
 * held that is not a place gone to every hour — the workspace and its
 * switch, making a task, Members and Settings, and the theme. Grouped the
 * way the phone's own settings are, each group a panel of its own.
 */
export function MorePage({
  workspace,
  canPeople,
  canWorkspace = false,
  settingsAway = null,
  canMakeWorkspace = true,
  runsIt = false,
  instance = false,
  onGo,
  onMake,
}: {
  workspace: { id: string; name: string } & Omit<WorkspaceLook, 'id' | 'name'>
  /** Whether the Members screen is open to them — `members.read`, */
  canPeople: boolean
  /** Whether this person may open the workspace's settings — `settings.md`. */
  canWorkspace?: boolean
  /** Or their address at usetuff.com, where a workspace's own domain keeps
      them shut — `doorsAway`. */
  settingsAway?: string | null | undefined
  /** Whether this person may make a workspace — `workspace.create`. */
  canMakeWorkspace?: boolean
  /** Whether this person runs the product, where the edition has such
      people. */
  runsIt?: boolean
  /** Whether this person owns the server. */
  instance?: boolean
  onGo: (view: string) => void
  onMake?: (() => void) | undefined
}) {
  const rows = [
    ...(onMake ? [{ icon: 'compose' as IconName, label: MAKE.newTask, testId: 'more-new-task', go: onMake, away: false }] : []),
    ...(canPeople
      ? [{ icon: 'people' as IconName, label: PLACES.members, testId: 'more-members', go: () => onGo('members'), away: true }]
      : []),
    ...(canWorkspace
      ? [{ icon: 'gear' as IconName, label: W.workspaceSettings, testId: 'more-settings', go: () => onGo('settings'), away: true }]
      : []),
    { icon: 'person' as IconName, label: W.accountSettings, testId: 'more-account', go: () => onGo('account'), away: true },
    ...(runsIt && edition.admin
      ? [{ icon: 'globe' as IconName, label: edition.admin.label, testId: 'more-admin', go: () => onGo('admin'), away: true }]
      : []),
    ...(instance
      ? [{ icon: 'sliders' as IconName, label: INSTANCE.title, testId: 'more-instance', go: () => onGo('instance'), away: true }]
      : []),
  ]
  return (
    <div data-more data-foot className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[var(--gutter)] pt-3 pb-6">
      {/* A panel's look without its clipping, and above the panels after
          it: the menu hangs out of the bottom of this card, and inside a
          `Panel` it was cut to the sliver under the name. */}
      <div className="relative z-10 bg-panel" style={{ borderRadius: 'var(--r-card)' }}>
        <div className="flex h-14 items-center px-2">
          <WorkspaceMenu
            id={workspace.id}
            name={workspace.name}
            look={workspace}
            shut={false}
            onSettings={canWorkspace ? () => onGo('settings') : undefined}
            settingsAway={settingsAway}
            ground="var(--panel)"
            mayMake={canMakeWorkspace}
          />
        </div>
      </div>
      <Panel>
        {rows.map((r, i) => (
          <div key={r.testId} className="contents">
            {i > 0 && <Hairline inset={48} />}
            <MoreRow icon={r.icon} label={r.label} testId={r.testId} onPress={r.go} away={r.away} />
          </div>
        ))}
        {/* The settings a workspace's own domain keeps shut, at usetuff.com. */}
        {!canWorkspace && settingsAway && (
          <>
            {rows.length > 0 && <Hairline inset={48} />}
            <a
              data-row
              data-testid="more-settings-away"
              href={settingsAway}
              target="_blank"
              rel="noreferrer"
              title={TOP_BAR.opensAt(new URL(settingsAway).host)}
              className="flex w-full items-center gap-3 px-4 text-left text-md text-ink"
              style={{ height: 48 }}
            >
              <span className="flex size-5 items-center justify-center text-ink-2">
                <Icon name="gear" size={18} />
              </span>
              <span className="min-w-px flex-1 truncate">{W.workspaceSettings}</span>
              <span className="sr-only">{TOP_BAR.opensAt(new URL(settingsAway).host)}</span>
              <Icon name="away" size={12} className="text-ink-3" />
            </a>
          </>
        )}
      </Panel>
      <Panel>
        <ThemeButton row tall />
      </Panel>
    </div>
  )
}

function MoreRow({
  icon,
  label,
  testId,
  onPress,
  away,
}: {
  icon: IconName
  label: string
  testId: string
  onPress: () => void
  /** A screen of its own, which says so with the chevron the phone uses. */
  away: boolean
}) {
  return (
    <button
      data-row
      data-testid={testId}
      onClick={onPress}
      className="flex w-full items-center gap-3 px-4 text-left text-md text-ink"
      style={{ height: 48 }}
    >
      <span className="flex size-5 items-center justify-center text-ink-2">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-px flex-1 truncate">{label}</span>
      {away && <Icon name="chevR" size={12} className="text-ink-3" />}
    </button>
  )
}
