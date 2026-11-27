import { useState } from 'react'
import type { InviteMade } from '@tracker/shared-schema'
import { api, Refused } from '../data/api.js'
import { ON_JOINING, RIGHTS, RIGHT_HINT } from '../data/rights.js'
import { SAYS } from '../data/words.js'
import { Icon } from './glyphs.jsx'
import { ProjectMark, markOf } from './icons.jsx'
import { Dialog, type Framed, notALogin, asTyped, findField } from './kit.jsx'
import { INVITE_DIALOG as W } from '../words/inviteDialog.js'
import { edition } from '../edition.jsx'

/**
 * Inviting people.
 *
 * Who, as what, onto which projects and able to do what there — decided
 * before the invitation goes, because arriving able to do everything and
 * being cut down later leaves a window exactly long enough to use. Each
 * address gets its own invitation by email; a link handed over by hand is
 * still here, as the second way, with the same answers on it.
 *
 * It was a select reading "member", a button making a link, and the six
 * rights only when "onto a project" was chosen in a second select — and no
 * way to send anything to anybody, though the mail had been there for weeks.
 */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Project = {
  id: string
  name: string
  icon_url?: string | null | undefined
  mark_icon?: string | null | undefined
  mark_tint?: number | null | undefined
  can?: string[] | undefined
}

/** Addresses typed, pasted as a list, or one by one, each a chip. */
export function EmailChips({
  emails,
  setEmails,
  typing,
  setTyping,
  refused = [],
  onSubmit,
  autoFocus = true,
}: {
  emails: string[]
  setEmails: (f: (had: string[]) => string[]) => void
  typing: string
  setTyping: (v: string) => void
  refused?: string[]
  onSubmit?: () => void
  autoFocus?: boolean
}) {
  const take = (raw: string) => {
    const found = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => EMAIL.test(s))
    if (found.length) setEmails((had) => [...new Set([...had, ...found])])
    return found.length > 0
  }
  return (
    <div
      className="flex min-h-11 flex-wrap items-center gap-1 rounded-[var(--r-row)] p-1 bg-sunken"
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
    >
      {emails.map((e) => (
        <span
          key={e}
          data-invite-email={e}
          className="flex h-8 items-center gap-1 rounded-full pr-1 pl-3 text-base text-ink"
          style={{
            background: refused.includes(e) ? 'color-mix(in oklch, var(--danger) 16%, transparent)' : 'var(--track-on)',
          }}
        >
          {e}
          <button
            type="button"
            aria-label={W.removeEmail(e)}
            onClick={() => setEmails((had) => had.filter((x) => x !== e))}
            className="flex size-6 items-center justify-center rounded-full text-ink-3"
          >
            <Icon name="close" size={10} />
          </button>
        </span>
      ))}
      <input
        inputMode="email"
        {...notALogin}
        {...asTyped}
        autoFocus={autoFocus}
        data-testid="invite-emails"
        aria-label={W.emailAddresses}
        value={typing}
        placeholder={emails.length ? '' : W.emailsExample}
        onChange={(e) => {
          const v = e.target.value
          /* A separator typed closes the address before it into a chip. */
          if (/[\s,;]$/.test(v) && take(v)) return setTyping('')
          setTyping(v)
        }}
        onPaste={(e) => {
          if (take(e.clipboardData.getData('text'))) {
            e.preventDefault()
            setTyping('')
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (typing.trim() && take(typing)) setTyping('')
            else if (!typing.trim()) onSubmit?.()
          }
          if (e.key === 'Backspace' && !typing && emails.length) setEmails((had) => had.slice(0, -1))
        }}
        className="h-8 min-w-[160px] flex-1 bg-transparent px-2 text-base outline-none text-ink"
      />
    </div>
  )
}

/**
 * Invitations this server could not mail, each with its own link to pass on
 * by hand. Here and on a new
 * workspace's invite step.
 */
export function HandedLinks({ handed }: { handed: { email: string; link: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  if (handed.length === 0) return null
  return (
    <div data-testid="invite-by-hand" className="flex flex-col gap-3 rounded-[var(--r-row)] p-3 bg-sunken">
      <div className="flex flex-col gap-1">
        <span className="text-base font-medium text-ink">{W.byHandTitle}</span>
        <span className="text-sm text-ink-3">{W.byHandHint}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {handed.map((h) => (
          <li key={h.link} data-invite-by-hand={h.email} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-2">{h.email}</span>
            <div className="flex items-center gap-2">
              <span className="min-w-px flex-1 font-mono text-xs break-all select-all text-ink">{h.link}</span>
              <button
                type="button"
                aria-label={W.copyLinkFor(h.email)}
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(h.link)
                    .then(() => setCopied(h.link))
                    .catch(() => undefined)
                }
                className="flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium bg-track-on text-ink"
              >
                <Icon name={copied === h.link ? 'check' : 'copy'} size={14} />
                {W.copy}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The link an invitation answer carries, when it carries one. */
export const linkOf = (token: string) => `${location.origin}/invite/${token}`

function Part({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink-2">{title}</span>
        {hint && <span className="text-sm text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function InviteDialog(props: InviteProps) {
  const f = useInvite(props)
  return (
    <Dialog title={f.title} testId={f.testId} onClose={props.onClose} footer={f.footer}>
      {f.body}
    </Dialog>
  )
}

type InviteProps = {
  projects: Project[]
  /** Projects already ticked — opened from a project's settings, that one. */
  onto?: string[]
  /** Whether the one inviting may appoint an owner — an owner. */
  owner: boolean
  onClose: () => void
  /** An invitation was made: the list of the ones out reads itself again. */
  onMade: () => void
  /** Whether the addresses' field takes the caret as it opens. */
  autoFocus?: boolean
}

/** What the window holds, apart from the window — also the plus's first tab. */
export function useInvite({ projects, owner, onClose, onMade, onto: from = [], autoFocus = true }: InviteProps): Framed {
  const [emails, setEmails] = useState<string[]>([])
  const [typing, setTyping] = useState('')
  const [onto, setOnto] = useState<string[]>(from)
  const [rights, setRights] = useState<string[]>([...ON_JOINING])
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string[] | null>(null)
  const [refused, setRefused] = useState<{ email: string; why: string; full?: boolean }[]>([])
  const [link, setLink] = useState<string | null>(null)
  /* Invitations this server could not mail, each with its own link to pass
     on by hand. */
  const [handed, setHanded] = useState<{ email: string; link: string }[]>([])
  const [find, setFind] = useState('')

  const all = [...emails, ...(EMAIL.test(typing.trim()) ? [typing.trim().toLowerCase()] : [])]
  /* Rights past the ordinary two are given only by whoever runs every
     project named — the server asks the same. */
  const runsAll = owner || onto.every((id) => projects.find((p) => p.id === id)?.can?.includes('project.tools'))
  const ordinary = (r: string) => (ON_JOINING as readonly string[]).includes(r)
  /* A member, always: a workspace has one owner, who hands it over from
     its settings. */
  const body = () => ({
    role: 'member',
    project_ids: onto,
    // Rights are held on a project; with none named, none are sent.
    rights: onto.length === 0 ? [] : rights.filter((r) => runsAll || ordinary(r)),
  })

  async function send() {
    if (all.length === 0 || busy) return
    setBusy(true)
    const went: string[] = []
    const byHand: { email: string; link: string }[] = []
    const failed: { email: string; why: string; full?: boolean }[] = []
    for (const email of all) {
      try {
        const r = await api<InviteMade>('/invites', { method: 'POST', body: JSON.stringify({ ...body(), email }) })
        /* The server answers an invitation to an address with its link only
           when it cannot mail it, for the inviter to pass on. */
        if (r.token) byHand.push({ email, link: linkOf(r.token) })
        else if (r.mailed) went.push(email)
        else failed.push({ email, why: W.notMailed })
      } catch (e) {
        /* Full by its status as well as its words: the words are the
           reader's language now, and only the English says "full". */
        const why = (e as Error).message || W.notSent
        failed.push({ email, why, full: /full/i.test(why) || (e instanceof Refused && e.status === 413) })
      }
    }
    setBusy(false)
    onMade()
    setRefused(failed)
    setSent(went)
    setHanded((had) => [...had, ...byHand])
    setEmails(failed.map((f) => f.email))
    setTyping('')
  }

  async function makeLink() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api<InviteMade>('/invites', { method: 'POST', body: JSON.stringify(body()) })
      setLink(`${location.origin}/invite/${r.token}`)
      onMade()
    } catch (e) {
      const why = (e as Error).message || W.linkNotMade
      setRefused([{ email: W.theLink, why, full: /full/i.test(why) || (e instanceof Refused && e.status === 413) }])
    } finally {
      setBusy(false)
    }
  }

  const done = sent !== null && refused.length === 0

  /* Drawn whole with the answers that made it, never filled in after. */
  const byHandLinks = <HandedLinks handed={handed} />
  return {
    title: W.invitePeople,
    testId: 'invite',
    footer: done ? (
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          data-testid="invite-more"
          onClick={() => {
            setSent(null)
            setHanded([])
            setEmails([])
          }}
          className="h-8 px-3 text-base font-medium text-ink-2"
        >
          {W.inviteMore}
        </button>
        <button onClick={onClose} className="flex h-8 items-center rounded-full px-4 text-base font-medium bg-accent text-on-accent">
          {W.done}
        </button>
      </div>
    ) : (
      <div className="flex flex-1 items-center gap-2">
        <button
          data-testid="invite-link"
          disabled={busy}
          onClick={() => void makeLink()}
          className="flex h-8 items-center gap-2 px-3 text-base font-medium disabled:opacity-40 text-ink-2"
        >
          <Icon name="link" size={14} />
          {W.linkInstead}
        </button>
        <span className="flex-1" />
        <button
          data-testid="invite-send"
          disabled={all.length === 0 || busy}
          onClick={() => void send()}
          className="flex h-8 items-center rounded-full px-4 text-base font-medium disabled:opacity-40 bg-accent text-on-accent"
        >
          {busy ? W.sending : all.length > 1 ? W.sendMany(all.length) : W.sendOne}
        </button>
      </div>
    ),
    body: done ? (
      <div className="flex flex-col gap-4 px-4 pt-2 pb-4">
        {sent!.length > 0 && (
          <div data-invite-sent className="flex flex-col items-center gap-3 pt-2 pb-2 text-center">
            <span
              className="flex size-12 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in oklch, #30d158 18%, transparent)', color: '#30d158' }}
            >
              <Icon name="check" size={20} />
            </span>
            <p className="text-md text-ink">{sent!.length === 1 ? W.sentTo(sent![0]!) : W.sentToMany(sent!.length)}</p>
            <p className="text-sm text-ink-3">{W.expires}</p>
          </div>
        )}
        {byHandLinks}
      </div>
    ) : (
      <div className="flex flex-col gap-5 px-4 pt-2 pb-4">
        {byHandLinks}
        <Part title={W.people} hint={W.peopleHint}>
          <EmailChips
            emails={emails}
            setEmails={setEmails}
            typing={typing}
            setTyping={setTyping}
            refused={refused.map((r) => r.email)}
            onSubmit={() => void send()}
            autoFocus={autoFocus}
          />
          {refused.length > 0 && (
            <ul data-testid="invite-refused" className="flex flex-col gap-1 text-sm text-danger">
              {refused.map((r) => (
                <li key={r.email}>{W.refusedLine(r.email, r.why)}</li>
              ))}
            </ul>
          )}
          {/* Full is said with the way out of it, for whoever can take it,
                where the edition has one. */}
          {owner && refused.some((r) => r.full) && edition.InviteFull && <edition.InviteFull />}
        </Part>

        <Part title={W.projects} hint={onto.length ? null : W.projectsHint}>
          {/* A workspace of forty projects is a list that scrolls in its
                own box, with a field to narrow it — not a window taller
                than the screen with its buttons under the fold. */}
          {projects.length > 8 && (
            <input
              {...findField}
              data-testid="invite-find-project"
              aria-label={W.findProject}
              placeholder={W.findProject}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              className="h-8 rounded-full px-3 text-base outline-none placeholder:text-[var(--ink-3)] bg-sunken"
              style={{ color: 'var(--ink)' }}
            />
          )}
          <div className="flex max-h-[240px] flex-col overflow-y-auto rounded-[var(--r-row)] bg-sunken">
            {projects.length === 0 && <span className="px-3 py-3 text-sm text-ink-3">{W.noProjects}</span>}
            {projects
              .filter((p) => onto.includes(p.id) || !find.trim() || p.name.toLowerCase().includes(find.trim().toLowerCase()))
              .map((p) => {
                const on = onto.includes(p.id)
                return (
                  <label
                    key={p.id}
                    data-invite-project={p.name}
                    className="flex h-10 shrink-0 cursor-pointer items-center gap-3 px-3 text-base mouse:hover:bg-[var(--hover)] text-ink"
                  >
                    <input
                      type="checkbox"
                      aria-label={p.name}
                      checked={on}
                      onChange={(e) => setOnto((had) => (e.target.checked ? [...had, p.id] : had.filter((x) => x !== p.id)))}
                      className="size-4 shrink-0 accent-[var(--accent)]"
                    />
                    <ProjectMark {...markOf(p)} size={20} />
                    <span className="min-w-px flex-1 truncate">{p.name}</span>
                  </label>
                )
              })}
          </div>
        </Part>

        {onto.length > 0 && (
          <Part title={W.permissions} hint={runsAll ? null : W.permissionsHint}>
            <div data-invite-rights className="flex flex-wrap gap-2">
              {RIGHTS.map(([right, said]) => {
                const on = rights.includes(right)
                const locked = !runsAll && !ordinary(right)
                return (
                  <label
                    key={right}
                    className="relative flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium"
                    style={{
                      background: on && !locked ? 'var(--accent-soft)' : 'var(--sunken)',
                      color: on && !locked ? 'var(--accent)' : 'var(--ink-2)',
                      opacity: locked ? 0.4 : 1,
                    }}
                  >
                    {/* The chip is the checkbox: laid over it, unseen, so a
                          press anywhere on it is a press on the box. */}
                    <input
                      type="checkbox"
                      title={RIGHT_HINT[right]}
                      className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
                      aria-label={said}
                      disabled={locked}
                      checked={on && !locked}
                      onChange={(e) => setRights((was) => (e.target.checked ? [...was, right] : was.filter((r) => r !== right)))}
                    />
                    {on && !locked && <Icon name="check" size={12} />}
                    {said}
                  </label>
                )
              })}
            </div>
          </Part>
        )}

        {link && (
          <div data-testid="invite-made-link" className="flex flex-col gap-2 rounded-[var(--r-row)] p-3 bg-sunken">
            <span className="text-sm text-ink-3">{SAYS.singleUse}</span>
            <span className="font-mono text-xs break-all select-all text-ink">{link}</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(link).catch(() => undefined)}
              className="flex h-8 items-center gap-2 self-start rounded-full px-3 text-sm font-medium bg-track-on text-ink"
            >
              <Icon name="copy" size={14} />
              {W.copy}
            </button>
          </div>
        )}
      </div>
    ),
  }
}
