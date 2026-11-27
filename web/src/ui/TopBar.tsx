import { useEffect, useRef, useState } from 'react'
import { BAR, HEADS, MAKE, MORE } from '../data/words.js'
import { TOP_BAR as W } from '../words/topBar.js'
import { INSTANCE } from '../words/instance.js'
import { doorsAway, workspaceDoor } from '../data/doors.js'
import { api, setSession, type Session } from '../data/api.js'
import { knownWorkspaces, refreshWorkspaces, useWorkspaces, waitingElsewhere, type Workspace } from '../data/workspaces.js'
import { accountReads, instanceReads, warm, workspaceSettingsReads } from '../data/ahead.js'
import { warmPush } from './Account.jsx'
import { Avatar, COLUMN_MS, Fluid, Over, Popover, SHUT } from './kit.jsx'
import { FoldToggle } from './project/foldToggle.jsx'
import { Icon, type IconName } from './glyphs.jsx'
import { Glass } from './Glass.jsx'
import { MarkWithDot, type WorkspaceLook } from './WorkspaceMark.jsx'
import { NewWorkspace } from './NewWorkspace.jsx'
import { applyTheme, readTheme, watchSystem, writeTheme, type Theme } from '../data/theme.js'
import type { Presence } from './kit.jsx'
import { edition } from '../edition.jsx'
import { securityDue, type ServerVersion } from '../data/release.js'
import { Dot } from './Instance.jsx'

/*
 * Three, and one button that steps through them.
 *
 * It was three pills in the sidebar's foot, which is a lot of furniture for
 * something pressed twice a year. The state is the glyph, so nothing has to
 * be read to know where it stands.
 */
const THEMES: Theme[] = ['system', 'light', 'dark']
const THEME_ICON: Record<Theme, IconName> = { system: 'contrast', light: 'sun', dark: 'moon' }
const THEME_SAID: Record<Theme, string> = {
  system: W.themeSystem,
  light: W.themeLight,
  dark: W.themeDark,
}

/**
 * The bar across the top.
 *
 * Who you are working as, the thing you make most, where you ask a question,
 * and at the far end what is addressed to you, how this looks and who you
 * are. All of it is about the window rather than a place in it, which is why
 * none of it is in the column any more.
 */
/**
 * Light, dark, or whatever the machine says — the bar's glyph on a wide
 * screen, a row of the side menu on a phone.
 */
export function ThemeButton({ row = false, tall = false }: { row?: boolean; tall?: boolean }) {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const next = () => {
    const to = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!
    setTheme(to)
    writeTheme(to)
  }
  if (row) {
    return (
      <button
        data-testid="theme"
        data-row
        data-theme-choice={theme}
        onClick={next}
        /* Tall in a phone's More sheet, where every row is a thumb's. */
        className={`flex w-full items-center gap-3 text-left ${tall ? 'px-4 text-md' : 'px-2 text-base'} text-ink`}
        style={{ height: tall ? 48 : 'var(--row-h)' }}
      >
        <span className="flex size-5 items-center justify-center text-ink-2">
          <Icon name={THEME_ICON[theme]} size={tall ? 18 : 16} />
        </span>
        <span className="min-w-px flex-1 truncate">{THEME_SAID[theme]}</span>
      </button>
    )
  }
  return (
    <button
      data-testid="theme"
      data-touch
      data-theme-choice={theme}
      data-control
      title={THEME_SAID[theme]}
      aria-label={THEME_SAID[theme]}
      onClick={next}
      className="flex size-8 shrink-0 items-center justify-center text-ink-2"
      style={{ borderRadius: 'var(--r-row)' }}
    >
      <Icon name={THEME_ICON[theme]} size={16} />
    </button>
  )
}

export function TopBar({
  me,
  title,
  waiting,
  column,
  moving = false,
  view,
  wide,
  onView,
  onMake,
  onDrawer,
  onSignOut,
  onChanged,
  phone = false,
  onBack,
}: {
  me: {
    actor: {
      id: string
      name: string
      avatar_url?: string | null
      presence?: Presence
      chosen?: 'away' | 'busy' | null
    }
    workspace: { id: string; name: string; slug: string } & Omit<WorkspaceLook, 'id' | 'name'>
    role: string
    can?: string[]
    /** On a workspace's own domain, what usetuff.com would allow — `doorsAway`. */
    can_off_host?: string[]
    /** Your own server's version, to its owners only. */
    server?: ServerVersion
  }
  /** What a phone's bar is named by: the project, or the screen. */
  title?: React.ReactNode
  /** How much is addressed to this person and unread. */
  waiting: number
  /** The column's width, or 0 when there is no column — the left block of
      the bar is as wide as the column it stands over. */
  column: number
  /** The column travelling between open and shut, so this block travels with it. */
  moving?: boolean
  view: string
  wide: boolean
  onView: (v: 'search' | 'notifications' | 'settings' | 'account' | 'admin' | 'instance') => void
  onMake: () => void
  /** The way to the column on a screen that does not have one. */
  onDrawer: () => void
  onSignOut: () => void
  /** Something about this person changed and the shell should read it again. */
  onChanged: () => Promise<void> | void
  /** A phone: the places are tabs along the foot, so neither the menu
      button nor the search glyph is up here. */
  phone?: boolean
  /** The way back out of a screen the tabs step aside for — a room. */
  onBack?: (() => void) | undefined
}) {
  const security = securityDue(me.server) && Boolean(me.can?.includes('instance'))
  /* While nobody has overruled it, follow the machine — otherwise "Auto"
     means "whatever it was when this tab opened". Applied once on the way in
     as well: the shell set the window's bar from a pair of hexes written
     before the stylesheet arrived, and this is the first moment the real
     token can be read. */
  useEffect(() => {
    applyTheme(readTheme())
    return watchSystem()
  }, [])

  return (
    <div
      data-top-bar
      data-panel
      className={`relative z-30 flex shrink-0 items-center gap-2 ${wide ? 'h-12 pr-3 pl-2' : phone ? 'px-[var(--edge)] pt-[var(--edge)] pb-[var(--lift)]' : 'h-12 px-3'} bg-canvas`}
      /*
        On a phone, in from the glass by what the work below is in from it
        — `--edge`, the shell's lift and the gutter inside it, one token so
        the two cannot drift apart again. At twelve the place's name stood
        four to the left of every line under it. And as far down from the
        top of the window as in from its sides, with the lift under it: the
        sheet starts there, and its own inset is the rest of the step to
        the work.
      */
      /*
        The window's own ground, and nothing under it.
        
        In the column's grey it read as the column grown a lid — a band of
        chrome over the work, which is the one thing it is not: what is in
        it is about the window. On the canvas everything else is drawn on,
        it is the top of the window rather than the top of the sidebar.
        
        The rule under it went with the sheets. It was there to say where
        the bar ended and the work began, and the sheets say that now by
        starting a gap below it — a line as well is the same statement
        twice, and the one that draws a seam across a window whose whole
        arrangement is things floating free of each other.
      */
    >
      {phone && onBack && (
        <button
          data-testid="bar-back"
          data-touch
          aria-label={W.back}
          onClick={onBack}
          data-control
          className="flex size-8 shrink-0 items-center justify-center text-ink-2"
          style={{ borderRadius: 'var(--r-row)' }}
        >
          <Icon name="chevL" size={16} />
        </button>
      )}
      {!wide && !phone && (
        <button
          data-testid="open-drawer"
          data-touch
          aria-label={BAR.openTheNavigation}
          onClick={onDrawer}
          data-control
          className="flex size-8 shrink-0 items-center justify-center text-ink-2"
          style={{ borderRadius: 'var(--r-row)' }}
        >
          <Icon name="list" size={16} />
        </button>
      )}

      {/*
        The left block is the column's width, so the workspace and the
        button beside it stand over the column they are about, and the line
        between them and search falls where the column's edge does.
        
        The mark inside the switcher is eighteen and ten pixels in, which is
        the glyph column every row below it stands in: a mark above a list
        of marks that is six pixels to the left of them is a column with two
        left edges.
      */}
      {/*
        On a phone the bar is named by where you are — the project, or the
        screen — and the workspace, making a task and the theme are in the
        menu down the side. They were six controls and a search squeezed
        into 390 pixels above a strip that said the project's name again.
        One band now.
      */}
      {wide ? (
        <div
          className="flex shrink-0 items-center gap-2"
          /*
           * As wide as the column it names, so search begins where the
           * column's edge is.
           *
           * Measured, not reasoned about: the bar's own twelve is what sets
           * the workspace in, and the rows below sit at twelve too — the
           * column is inset by the shell's eight and its scroller adds four.
           * A margin here would be that twelve said twice.
           *
           * It held the compose button at its right end too, and the width
           * was cut by 34 to land that over the end of the rows. The button
           * is with the glyphs on the right now, so nothing is reserved for
           * something that is no longer there.
           */
          /*
           * Except when the column is shut, where it keeps its own width.
           *
           * The block matches the column so the two line up — but a shut
           * column is 56, and a workspace called "Lifts and Conveyors" in 56
           * pixels is a letter and a chevron. The workspace is in the bar
           * rather than in the column, and the bar is not what was narrowed:
           * The top bar spec says the bar is about the window and the
           * column is about where in it you are, and this is the one place
           * that distinction has a visible consequence.
           */
          /*
           * And it travels with the column when the column changes state:
           * jumping from 248 to its own width while the column eased to 56
           * was the bar and the column disagreeing about the same moment.
           * `auto` is only interpolated where the browser allows sizes to
           * be (`interpolate-size`); elsewhere this one block still jumps.
           * `docs/specs/collapsed-sidebar.md`, "Shutting moves".
           */
          style={
            {
              width: column && column > SHUT ? column : 'auto',
              interpolateSize: 'allow-keywords',
              transition: moving ? `width ${COLUMN_MS}ms var(--ease-out)` : undefined,
            } as React.CSSProperties
          }
        >
          <WorkspaceMenu
            id={me.workspace.id}
            name={me.workspace.name}
            look={me.workspace}
            shut={column === SHUT}
            onSettings={workspaceDoor(me.can ?? []) ? () => onView('settings') : undefined}
            settingsAway={doorsAway({ ...me, can: me.can ?? [] }).settings}
            onWarmSettings={() => warm(workspaceSettingsReads(me.can ?? []))}
            mayMake={(me.can ?? []).includes('workspace.create')}
          />
          {/* The project's column folded into the sidebar and back, over
              the edge where the column begins. */}
          <span className="ml-auto flex shrink-0 pr-1">
            <FoldToggle />
          </span>
        </div>
      ) : (
        <div
          data-bar-title
          className="flex min-w-px flex-1 items-center gap-2 text-lg font-medium text-ink"
          style={{ letterSpacing: 'var(--track-title)' }}
        >
          {title}
        </div>
      )}

      {/*
        Search, in the middle, shaped like a field and behaving like a
        button: pressing it opens the palette, which is the only search in
        the product. Nothing is typed up here — a field in the bar and a
        field in the palette are two places to type one question.
      */}
      <div className={wide ? 'flex min-w-px flex-1 justify-center' : phone ? 'hidden' : 'flex shrink-0'}>
        <button
          data-control
          data-testid="nav-search"
          aria-label={BAR.search}
          title={MORE.searchTip}
          onClick={() => onView('search')}
          className={wide ? 'flex h-8 w-full max-w-[420px] items-center gap-2 px-3' : 'flex size-8 items-center justify-center'}
          style={{
            /* A glyph on a phone, like the bell beside it; a field-shaped
               button only where it has the room to look like one. */
            background: view === 'search' ? 'var(--hover)' : wide ? 'var(--track)' : undefined,
            borderRadius: 'var(--r-row)',
          }}
        >
          <Icon name="search" size={15} className="text-ink-3" />
          {/* The word and the key only where there is room and a keyboard.
              On a phone the field is a glyph's width: the word came out as
              "S", and the hint spilled out of the field onto whatever stood
              beside it. The button keeps its label for anyone not looking. */}
          {wide && (
            <>
              <span className="min-w-px flex-1 truncate text-left text-base text-ink-2">{BAR.search}</span>
              <span className="shrink-0 text-sm text-ink-3">⌘K</span>
            </>
          )}
        </button>
      </div>

      {/* Offline is said by the band across the top of the window —
          `OfflineBand`, `docs/specs/offline.md` — and only there. */}
      {/*
        Making a thing, first of the glyphs on the right.

        It stood at the right end of the workspace block, over the column's
        edge, where it was the only thing on that side of the bar that does
        something rather than saying where you are — a maker filed with the
        place names. The glyphs on the right are the ones you reach for, and
        it belongs at the head of them: the most-pressed, nearest the work.

        A glyph and no word: it is pressed many times a day by somebody who
        knows where it is. Flat, like its neighbours — raised, it was the
        one lit thing in a row of quiet ones, which is a lot of weight for a
        button standing beside a bell.
      */}
      {/* Whatever the edition says at the head of the right-hand glyphs —
          on the service, the way up a plan for whoever pays. */}
      {wide && edition.BarUpgrade && <edition.BarUpgrade me={me} />}
      {wide && (
        <button
          data-control
          data-testid="new-anything"
          data-touch
          title={MORE.newTaskTip}
          aria-label={MAKE.newTask}
          onClick={onMake}
          className="flex size-8 shrink-0 items-center justify-center text-ink-2"
          style={{ borderRadius: 'var(--r-row)' }}
        >
          <Icon name="compose" size={16} />
        </button>
      )}

      {/* Everything from here is about the person rather than about the
          work, in the order of how often it is reached for. */}
      <button
        data-control
        data-testid="nav-notifications"
        data-touch
        aria-label={waiting > 0 ? W.unread(waiting) : W.notifications}
        title={HEADS.notifications}
        onClick={() => onView('notifications')}
        className="relative flex size-8 shrink-0 items-center justify-center text-ink-2"
        style={{
          borderRadius: 'var(--r-row)',
          background: view === 'notifications' ? 'var(--hover)' : undefined,
        }}
      >
        <Icon name="bell" size={16} />
        {waiting > 0 && (
          /* The count rides the bell rather than standing beside it: a
             number in its own cell would move the two controls after it
             every time something arrived. */
          <span
            data-testid="inbox-count"
            className="absolute flex items-center justify-center text-badge font-medium tabular-nums bg-accent"
            style={{
              top: -1,
              right: -1,
              minWidth: 16,
              height: 16,
              paddingInline: 4,
              borderRadius: 8,
              color: '#fff',
              boxShadow: '0 0 0 2px var(--chrome)',
            }}
          >
            {waiting > 99 ? '99+' : waiting}
          </span>
        )}
      </button>

      {wide && <ThemeButton />}

      {/*
        You, and what used to be the sidebar's foot: your name, your role,
        how you are showing, and the way out — `docs/specs/presence.md`.
      */}
      <Popover
        shape="bare"
        width={220}
        align="right"
        testId="my-presence"
        said={W.yourAccount}
        label={
          <span className="relative flex size-8 items-center justify-center">
            {/* Yours from what you chose, and "work it out" is here: the
                person this dot is drawn for is looking at it. It read the
                server's answer, which `/me` gives before this window's
                socket has said "still here" — so a first sign-in, or a
                return after five minutes away, showed you away to
                yourself until something read `/me` again. */}
            <Avatar name={me.actor.name} id={me.actor.id} url={me.actor.avatar_url} size={24} presence={me.actor.chosen ?? 'here'} />
            {/* A security release this server does not run yet, for its
                owner — gone once it does. */}
            {security && (
              <Dot
                label={INSTANCE.updateAvailable}
                style={{ position: 'absolute', top: 4, right: 4, boxShadow: '0 0 0 2px var(--canvas)' }}
              />
            )}
          </span>
        }
      >
        {(close) => (
          <div data-menu className="py-1">
            <div className="flex items-center gap-3 px-3 pt-1 pb-2">
              <Avatar name={me.actor.name} id={me.actor.id} url={me.actor.avatar_url} size={28} />
              <span className="flex min-w-px flex-col">
                <span className="truncate text-base text-ink">{me.actor.name}</span>
                <span className="truncate text-sm text-ink-3">
                  {me.workspace.name}
                  {me.role !== 'member' && ` · ${W.role(me.role)}`}
                </span>
              </span>
            </div>
            <div className="my-1 h-px bg-line" />
            {(
              [
                [null, W.active, 'here'],
                ['away', W.away, 'away'],
                ['busy', W.busy, 'busy'],
              ] as const
            ).map(([what, said, shows]) => (
              <button
                key={said}
                data-row
                data-presence-pick={what ?? 'auto'}
                onClick={() => {
                  close()
                  void api('/me/presence', {
                    method: 'POST',
                    body: JSON.stringify({ presence: what }),
                  })
                    .then(() => onChanged())
                    .catch(() => {})
                }}
                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <Avatar name={me.actor.name} id={me.actor.id} url={me.actor.avatar_url} size={16} presence={shows} />
                <span className="min-w-px flex-1 truncate">{said}</span>
                {(me.actor.chosen ?? null) === what && <Icon name="tasks" size={14} className="text-ink-2" />}
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            {/*
              Settings is about the window too.
              
              It was the last row of the column, under the projects and the
              rooms — places in this workspace — where it is the one row
              that is not a place in it. Behind the same face as the rest of
              what is about you and this window, and the column ends with
              the work.
            */}
            <button
              data-row
              data-testid="nav-account"
              onPointerEnter={() => {
                warm(accountReads(me.can ?? []))
                void warmPush()
              }}
              onClick={() => {
                close()
                onView('account')
              }}
              className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
              style={{ height: 'var(--row-h)' }}
            >
              <Icon name="person" size={14} className="text-ink-3" />
              <span className="min-w-px flex-1 truncate">{W.accountSettings}</span>
            </button>
            {/* The screen of whoever runs the product, where the edition has
                one — about the product rather than this workspace, so here
                with the rest of what is about you, not in the column. */}
            {edition.admin && edition.admin.may(me.can ?? []) && (
              <button
                data-row
                data-testid="nav-admin"
                onClick={() => {
                  close()
                  onView('admin')
                }}
                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <Icon name="globe" size={14} className="text-ink-3" />
                <span className="min-w-px flex-1 truncate">{edition.admin.label}</span>
              </button>
            )}
            {/* Your own server's settings, for whoever owns it — about the
                machine rather than this workspace, so here, behind your own
                face. */}
            {me.can?.includes('instance') && (
              <button
                data-row
                data-testid="nav-instance"
                onPointerEnter={() => warm(instanceReads)}
                onClick={() => {
                  close()
                  onView('instance')
                }}
                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <Icon name="sliders" size={14} className="text-ink-3" />
                <span className="min-w-px flex-1 truncate">{INSTANCE.title}</span>
                {security && <Dot label={INSTANCE.updateAvailable} />}
              </button>
            )}
            {/* Help opens beside the app, so whatever was in hand stays.
                Where the edition has it. */}
            {edition.help && (
              <a
                data-row
                data-testid="nav-help"
                href="/help"
                target="_blank"
                rel="noreferrer"
                onClick={() => close()}
                className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <Icon name="doc" size={14} className="text-ink-3" />
                <span className="min-w-px flex-1 truncate">{W.help}</span>
              </a>
            )}
            <button
              data-row
              data-testid="sign-out"
              onClick={() => {
                close()
                onSignOut()
              }}
              className="flex w-full items-center gap-3 px-3 text-left text-base text-ink"
              style={{ height: 'var(--row-h)' }}
            >
              <Icon name="chevR" size={14} className="text-ink-3" />
              <span className="min-w-px flex-1 truncate">{HEADS.signOut}</span>
            </button>
            <Fluid />
          </div>
        )}
      </Popover>
    </div>
  )
}

/**
 * Switching workspace is a new session, not a setting.
 *
 * One consultant works for three agencies. Signing out to reach the second
 * one is the kind of friction that gets a product replaced — and the token
 * carries which workspace it is for, so switching means asking for another
 * token rather than telling the server a different number.
 */
export function WorkspaceMenu({
  id,
  name,
  shut,
  look,
  onSettings,
  settingsAway = null,
  onWarmSettings,
  ground = 'var(--canvas)',
  mayMake = true,
}: {
  id: string
  name: string
  /** Whether this person may make a workspace — `workspace.create`, which a
      server of one's own with sign-up closed keeps to its owners. */
  mayMake?: boolean
  /** Its mark. And, from `/api/me` as it
      came, whether its own domain stopped: a red dot on the mark and on the
      settings row, to whoever may fix it. */
  look?: (Omit<WorkspaceLook, 'id' | 'name'> & { domain_stopped?: boolean | undefined }) | undefined
  /** Whether the column below is narrowed to its glyphs, which moves what
      this has to line up with — `docs/specs/collapsed-sidebar.md`. */
  shut: boolean
  /** The way to this workspace's settings. */
  onSettings?: (() => void) | undefined
  /** Or, on a workspace's own domain that keeps them shut, their address at
      usetuff.com — `doorsAway`. */
  settingsAway?: string | null | undefined
  /** Asks what the settings will read, while the pointer is on their door. */
  onWarmSettings?: () => void
  /** What the switcher stands on, for the ring round the dot on its mark. */
  ground?: string
}) {
  const [open, setOpen] = useState(false)
  /* The list as it was last seen, so the menu opens on it rather than on
     "Loading" — and asked again once the bar is up, so the copy is fresh by
     the time anybody opens it. */
  /* One list for every switcher on the screen, asked again a moment after
     the bar is drawn, on coming back to the window and every two minutes —
     `data/workspaces.ts`. */
  const all = useWorkspaces()
  const refresh = refreshWorkspaces
  /* What this machine kept may have come back after the bar was drawn. */
  const shown = all.length ? all : knownWorkspaces()
  /* Something waiting for this person in another workspace: the dot on
     the mark. */
  const elsewhere = waitingElsewhere(all, id)
  /* Its own domain stopped, and the settings that fix it are a door here. */
  const stopped = Boolean(look?.domain_stopped && onSettings)
  /*
   * Opened whole.
   *
   * It opened on the one workspace this is and grew the others under the
   * pointer when the list came, a row arriving above the one being aimed
   * at. The shelf is read again here, because what this machine kept may
   * have come back after the bar was drawn; and with nothing known at all,
   * the list is waited for — up to the moment past which a press with no
   * answer reads as not taken — rather than drawn in two goes.
   */
  async function toggle() {
    if (open) return setOpen(false)
    if (!shown.length) {
      await Promise.race([refresh(), new Promise((r) => setTimeout(r, 400))])
    }
    setOpen(true)
  }
  /* The window a workspace is made in. */
  const [making, setMaking] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    refresh()
    /* And Escape shuts it, as it shuts every other menu. It never did: the
       press outside was the only way out, and that press was also a press on
       whatever it landed on. */
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  async function enter(w: Workspace) {
    const s = await api<Session>(`/workspaces/${w.id}/enter`, { method: 'POST' })
    setSession(s)
    /*
     * To the other workspace's address, not a reload of this one.
     *
     * A reload was the whole bug. The address names the workspace and the app
     * asks for a session for whatever it names — so taking a session for
     * Studio and then reloading `/ours` asked for ours again and landed back
     * where it started. Two `enter` calls, one screen, and a switcher that
     * looked as though it did not take the press at all.
     *
     * Its root rather than the screen being left: a project id means nothing
     * in another workspace, and a link that does mean something there is
     * answered by the same code getting a session for it.
     *
     * Still a full page load, which was the right half of the old answer:
     * everything on the screen belongs to the workspace being left, and
     * threading a change of that size through the tree is how a stale project
     * list ends up drawn under a new name.
     */
    location.assign(`/${w.slug}`)
  }

  return (
    <div ref={box} className="relative min-w-px">
      <button
        data-control
        data-testid="workspace-menu"
        /* Asked for under the pointer, so the press finds it there. */
        onPointerEnter={() => !all.length && void refresh()}
        onClick={() => void toggle()}
        /*
         * Thirty-two and an eight-pixel corner, which is every other control
         * in this column: the search button, the rows under it, all of them.
         *
         * It was thirty-six in a forty-pixel band, so the ring a keyboard
         * draws round it had two pixels above and two below — it touched the
         * top of the column and all but touched the search button beneath.
         * The band is the right height; a control filling it is not. What is
         * focused has to sit inside something, and the something here is the
         * air around it.
         */
        /* Capped rather than stretched: a workspace with a long name would
           otherwise push search out of the middle of the window. */
        /* As wide as what is in it. Filling the block pushed the chevron
           out to the far end, where it read as a control of the bar rather
           than the one mark that says this name can be changed. */
        /*
         * Twelve beside a column of names, sixteen beside a column of
         * glyphs.
         *
         * The mark has to sit over whatever the column's first thing is,
         * and that thing moves: a 20px glyph inset twelve sits at 33, a
         * 40px tile inset sixteen sits at 36. One number cannot be under
         * both — set to sixteen it was four out in the wide column, which
         * is the state somebody is in nearly all the time.
         *
         * The extra goes outside the button, not inside it: as padding the
         * hover's ground had twenty on the left and eight on the right, a
         * lopsided pill around the same mark. Eight either side, always.
         */
        className={`flex h-8 max-w-full items-center gap-3 px-2 text-left ${shut ? 'ml-3' : ''}`}
        style={{ borderRadius: 'var(--r-row)' }}
      >
        {/*
          The workspace's own mark, not the product's.
          
          It was the product's mark in the accent, on every screen of every
          workspace — a logo in the one place a person needs to know which
          company's work this is. A letter in a tinted square from the name
          and the id is the mark a person and a project already get, and a
          picture instead of it is an upload.
        */}
        {/* With a dot when another workspace has something for this
            person. Over the mark's corner, so
            the name beside it never moves for it. */}
        <MarkWithDot look={{ id, name, ...look }} size={18} waiting={elsewhere} alarm={stopped} ground={ground} />
        {stopped ? <span className="sr-only">{W.domainStopped}</span> : elsewhere && <span className="sr-only">{W.newElsewhere}</span>}
        {/* The chevron belongs to the name — four from it, where the mark
            keeps twelve. Twelve on both sides left it adrift between the
            name and nothing. */}
        <span className="flex min-w-px items-center gap-1">
          <span className="min-w-px truncate text-base font-medium text-ink" style={{ letterSpacing: 'var(--track-body)' }}>
            {name}
          </span>
          <svg className="shrink-0 text-ink-3" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2.5 4 5 6.5 7.5 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      </button>

      {/* The screen is the menu's while it is open — `Over`. Before the
          panel, so the panel is the one thing above it, and the press that
          closes it is not also a press on whatever it was covering. */}
      {open && <Over onClose={() => setOpen(false)} />}
      {open && (
        <Glass
          data-over
          data-menu
          radius={10}
          className="absolute top-full left-0 z-40 mt-1 w-[240px] overflow-hidden py-1"
          style={{ ['--r-item' as string]: '6px' }}
        >
          {/* Its own highlight, because these are its own rows — `Fluid`.
              Without one the column's light reached in and took them, and a
              row measured against the panel it sits in drawn from the
              scroller's corner is the light landing nowhere near the hand. */}
          <Fluid />
          {/* Never "Loading": until the list is known, the one workspace that
              certainly is in it — this one — stands for it. */}
          {(shown.length ? shown : [{ id, name, slug: '', role: '' }]).map((w: Workspace) => (
            <button
              key={w.id}
              data-row
              data-testid="workspace-option"
              /* Which one this window is in, for a reader that cannot see
                 the mark beside the name. */
              aria-current={w.id === id ? 'true' : undefined}
              onClick={() => void enter(w)}
              className="flex w-full items-center gap-2 px-2 text-left text-sm"
              style={{ height: 'var(--row-h)' }}
            >
              {/* By id, like the button above it. Seeded from the name the
                  menu gave one workspace a different colour from the one
                  the switcher was showing for it — the same thing in two
                  colours, a line apart. */}
              {/* The dot on the mark, for a workspace this window is not
                  in — this one's bell already says it. */}
              <MarkWithDot
                look={w}
                size={16}
                waiting={w.id !== id && w.unread === true}
                ground="var(--chrome)"
                testId="workspace-option-waiting"
              />
              <span className="truncate">{w.name}</span>
              {w.id !== id && w.unread === true && <span className="sr-only">{W.newThere}</span>}
              {/* What the edition says it is on, where this person owns it —
                  the thing an owner of three wants to know about each — and
                  their role otherwise. */}
              <span className="ml-auto shrink-0 text-badge text-ink-3">{edition.planOf?.(w) ?? W.role(w.role)}</span>
            </button>
          ))}
          {/*
            This workspace's settings, from the menu that names it — the
            first place somebody looks for "what is this workspace on". Its
            owner's only: the switches are theirs, and for anybody else the
            screen holds nothing about the workspace at all.
          */}
          {onSettings && (
            <>
              <div className="my-1 bg-line" style={{ height: 1 }} />
              <button
                data-row
                data-testid="workspace-settings"
                onPointerEnter={onWarmSettings}
                onFocus={onWarmSettings}
                onClick={() => {
                  setOpen(false)
                  onSettings()
                }}
                className="flex w-full items-center gap-2 px-2 text-left text-sm text-ink"
                style={{ height: 'var(--row-h)' }}
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-ink-3">
                  <Icon name="gear" size={14} />
                </span>
                <span className="truncate">{W.workspaceSettings}</span>
                {stopped && (
                  <span
                    data-testid="domain-stopped-dot"
                    role="img"
                    aria-label={W.domainStopped}
                    className="inline-block size-2 shrink-0 rounded-full bg-danger"
                  />
                )}
                {(() => {
                  const here = all.find((w) => w.id === id)
                  const said = here && edition.planOf?.(here)
                  return said ? <span className="ml-auto shrink-0 text-badge text-ink-3">{said}</span> : null
                })()}
              </button>
            </>
          )}
          {/* The same door on a workspace's own domain, which keeps it shut:
              a link to it at usetuff.com, saying it leaves. */}
          {!onSettings && settingsAway && (
            <>
              <div className="my-1 bg-line" style={{ height: 1 }} />
              <AwayRow
                href={settingsAway}
                label={W.workspaceSettings}
                icon="gear"
                testId="workspace-settings-away"
                onGo={() => setOpen(false)}
              />
            </>
          )}
          {/* Below the ones there are, past a line: these are places to go,
              and this is a thing to do. */}
          {mayMake && <div className="my-1 bg-line" style={{ height: 1 }} />}
          {/* A window, not a field in the menu: a name, an address and a
              mark are more than one word. */}
          {mayMake && (
            <button
              data-row
              data-testid="workspace-new"
              onClick={() => {
                setOpen(false)
                setMaking(true)
              }}
              className="flex w-full items-center gap-2 px-2 text-left text-sm text-ink-2"
              style={{ height: 'var(--row-h)' }}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <Icon name="plusThin" size={14} />
              </span>
              <span className="truncate">{HEADS.newWorkspace}</span>
            </button>
          )}
        </Glass>
      )}
      {making && <NewWorkspace onClose={() => setMaking(false)} />}
    </div>
  )
}

/**
 * A menu row that leaves for usetuff.com: a door a workspace's own domain
 * keeps shut, opened there in a new tab.
 * The arrow says it leaves.
 */
export function AwayRow({
  href,
  label,
  icon,
  testId,
  onGo,
}: {
  href: string
  label: string
  icon: IconName
  testId: string
  onGo?: () => void
}) {
  const where = new URL(href).host
  return (
    <a
      data-row
      data-testid={testId}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={W.opensAt(where)}
      onClick={onGo}
      className="flex w-full items-center gap-2 px-2 text-left text-sm text-ink"
      style={{ height: 'var(--row-h)' }}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-ink-3">
        <Icon name={icon} size={14} />
      </span>
      <span className="truncate">{label}</span>
      <span className="sr-only">{W.opensAt(where)}</span>
      <span className="ml-auto flex shrink-0 items-center text-ink-3">
        <Icon name="away" size={12} />
      </span>
    </a>
  )
}
