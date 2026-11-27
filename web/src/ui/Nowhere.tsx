import { useEffect, useState } from 'react'
import { api, setSession, signOut, type Session } from '../data/api.js'
import { NOWHERE as W } from '../words/nowhere.js'
import { watchSystem } from '../data/theme.js'
import { AuthShell, primaryLook } from './Access.jsx'
import { NewWorkspace } from './NewWorkspace.jsx'
import { YourData } from './account/yourData.jsx'
import { Unconfirmed, type Waiting as Unanswered } from './Unconfirmed.jsx'

/**
 * No workspaces — the one screen a session in no workspace has,
 * Create one, join one you were invited to, or go:
 * sign out, or delete the account. Drawn once both reads have answered, so
 * the invitations do not arrive under the button a moment later.
 */
type NowhereMe = { email: string; can: string[] }
type Waiting = { id: string; workspace_name: string; host?: string }

export function Nowhere() {
  const [me, setMe] = useState<NowhereMe | null>(null)
  const [waiting, setWaiting] = useState<Waiting[]>([])
  const [making, setMaking] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  /* Workspaces joined before the address was confirmed, asked about first —
     `ui/Unconfirmed.tsx`. */
  const [unanswered, setUnanswered] = useState<Unanswered[]>([])

  /* The machine's light or dark, followed as the bar follows it in a
     workspace — there is no bar here. */
  useEffect(() => watchSystem(), [])

  useEffect(() => {
    void Promise.all([
      api<NowhereMe>('/me'),
      api<{ invitations: Waiting[] }>('/me/invitations').catch(() => ({ invitations: [] as Waiting[] })),
      api<{ waiting: Unanswered[] }>('/me/unconfirmed').catch(() => ({ waiting: [] as Unanswered[] })),
    ])
      .then(([m, i, u]) => {
        setWaiting(i.invitations)
        setUnanswered(u.waiting)
        setMe(m)
      })
      .catch(() => {})
  }, [])

  const join = async (id: string) => {
    setJoining(id)
    setSaid(null)
    try {
      const s = await api<Session>(`/me/invitations/${id}/accept`, { method: 'POST' })
      setSession(s)
      location.assign('/')
    } catch (e) {
      setSaid((e as Error).message && (e as Error).message !== 'unauthorized' ? (e as Error).message : W.couldntJoin)
      setJoining(null)
    }
  }

  if (!me) return null
  /* A Join answers a session and goes; every one left, this screen is next. */
  if (unanswered.length > 0) return <Unconfirmed waiting={unanswered} onDone={() => setUnanswered([])} />
  const mayCreate = me.can.includes('workspace.create')
  return (
    <div data-testid="nowhere" data-whole="nowhere">
      <AuthShell title={W.title}>
        <p className="text-center text-md text-ink-2">{W.body}</p>
        {mayCreate ? (
          <button
            type="button"
            data-testid="nowhere-create"
            onClick={() => setMaking(true)}
            className="mt-4 h-11 w-full rounded-[10px] text-md font-medium"
            style={primaryLook}
          >
            {W.create}
          </button>
        ) : (
          <p className="text-center text-md text-ink-2">{W.cantCreate}</p>
        )}
        {waiting.length > 0 && (
          <section className="mt-6 flex flex-col gap-2" data-testid="nowhere-invitations">
            <h2 className="text-sm font-medium text-ink-3">{W.invited}</h2>
            {waiting.map((w) => (
              <div
                key={w.id}
                className="flex h-12 items-center gap-3 rounded-[10px] px-4"
                style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
              >
                <span className="min-w-px flex-1 truncate text-md text-ink">{w.workspace_name}</span>
                {/* Mailed to that workspace's own domain: taken there, from
                    the email, not here — said rather than refused. */}
                {w.host ? (
                  <span data-testid="nowhere-from-email" className="shrink-0 truncate text-base text-ink-3">
                    {W.fromEmail(w.host)}
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid="nowhere-join"
                    disabled={joining !== null}
                    onClick={() => void join(w.id)}
                    className="h-8 rounded-full px-4 text-base font-medium"
                    style={primaryLook}
                  >
                    {joining === w.id ? W.joining : W.join}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
        {said && (
          <p role="alert" className="text-center text-sm text-danger">
            {said}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-2 text-sm text-ink-3">
          <span>{W.signedInAs(me.email)}</span>
          <div className="flex gap-4">
            <button
              type="button"
              data-testid="nowhere-sign-out"
              onClick={() => void signOut().then(() => location.assign('/signin'))}
              className="text-ink-2"
            >
              {W.signOut}
            </button>
            <button type="button" data-testid="nowhere-delete" onClick={() => setDeleting((d) => !d)} className="text-danger">
              {W.deleteAccount}
            </button>
          </div>
        </div>
        {deleting && <YourData deleteOnly />}
      </AuthShell>
      {making && <NewWorkspace onClose={() => setMaking(false)} />}
    </div>
  )
}
