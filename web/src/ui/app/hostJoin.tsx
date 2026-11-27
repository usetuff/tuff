import { useState, type ReactNode } from 'react'
import { authHeaders, setSession, type Session } from '../../data/api.js'
import type { OnHost } from '../../data/host.js'
import { HOST_JOIN as W } from '../../words/hostJoin.js'
import { AuthShell, field, fieldLook, primaryLook } from '../Access.jsx'

/**
 * An invitation taken on a workspace's own domain.
 *
 * Never a password: whoever controls the domain's DNS could serve a copy of
 * this page. A name and an email; a new address the invitation was mailed
 * to joins at once, and anybody else is mailed a code to type here, then
 * the second factor where the account has one. The server decides which —
 * this page only follows what it answers.
 */
type Said = { error?: { code?: string; message?: string } } & Partial<Session> & { sent?: boolean }

export function HostJoin({
  token,
  host,
  where,
  invitedAs,
  mark,
}: {
  token: string
  host: OnHost
  /** The workspace's name. */
  where: string
  /** The address the invitation was sent to, when it was sent to one. */
  invitedAs: string | null | undefined
  mark: ReactNode
}) {
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(invitedAs ?? '')
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState('')
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function post(path: string, body: unknown): Promise<{ status: number; said: Said }> {
    const r = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).catch(() => null)
    return { status: r?.status ?? 0, said: ((await r?.json().catch(() => ({}))) ?? {}) as Said }
  }

  const done = (s: Session) => {
    setSession(s)
    location.assign(`/${host.slug}`)
  }

  /* What a refusal says, in the page's words; the server's own message
     where it said one (a full workspace, in the reader's language). */
  function refused(status: number, said: Said) {
    const why = said.error?.code
    if (status === 429) return setError(W.tooMany)
    if (why === 'name_required') return setError(W.enterName)
    if (why === 'email_unverified') return setError(W.confirmFirst)
    if (status === 404) return setError(W.noLonger)
    if (why === 'code_invalid' || status === 401) return setError(W.wrongCode)
    setError(said.error?.message || W.couldntJoin)
  }

  async function start() {
    if (busy) return
    setError(null)
    if (!name.trim() || !email.trim()) return setError(W.enterBoth)
    setBusy(true)
    const r = await post(`/auth/invite/${encodeURIComponent(token)}/accept`, { name: name.trim(), email: email.trim() })
    setBusy(false)
    if (r.status === 200 && r.said.access_token) return done(r.said as Session)
    if (r.status === 202) {
      setCode('')
      setAsking(false)
      setStep('code')
      return
    }
    refused(r.status, r.said)
  }

  async function again() {
    if (busy) return
    setError(null)
    const r = await post('/auth/code', { email: email.trim(), invite: token })
    if (r.status === 429) setError(W.tooMany)
  }

  async function verify() {
    if (busy) return
    setError(null)
    setBusy(true)
    const r = await post('/auth/code/verify', {
      email: email.trim(),
      code,
      invite: token,
      name: name.trim(),
      ...(asking && totp ? { totp: totp.trim() } : {}),
    })
    setBusy(false)
    if (r.status === 200 && r.said.access_token) return done(r.said as Session)
    if (r.said.error?.code === 'totp_required') {
      if (asking) setError(W.wrongCode)
      setAsking(true)
      return
    }
    refused(r.status, r.said)
  }

  return (
    <AuthShell title={W.join(where)} mark={mark}>
      <form
        data-join
        data-testid="host-join"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void (step === 'details' ? start() : verify())
        }}
      >
        {step === 'details' && (
          <>
            <input
              data-testid="host-join-name"
              autoFocus
              className={field}
              style={fieldLook}
              aria-label={W.yourName}
              placeholder={W.yourName}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              data-testid="host-join-email"
              className={field}
              style={fieldLook}
              aria-label={W.email}
              placeholder={W.email}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        )}
        {step === 'code' && (
          <>
            <p className="text-base leading-[1.4] text-ink-2">{W.sentTo(email.trim())}</p>
            <input
              autoFocus
              data-testid="host-join-code"
              className={field}
              style={fieldLook}
              aria-label={W.code}
              placeholder={W.code}
              name="code"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </>
        )}
        {asking && (
          <input
            autoFocus
            data-testid="host-join-totp"
            className={field}
            style={fieldLook}
            aria-label={W.appCode}
            placeholder={W.appCode}
            name="totp"
            autoComplete="one-time-code"
            autoCapitalize="off"
            spellCheck={false}
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
          />
        )}
        {error && (
          <p data-join-said role="alert" className="text-base leading-[1.4] text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          data-testid="host-join-submit"
          disabled={busy}
          className="mt-2 h-11 rounded-full text-md font-medium transition-transform active:scale-[0.98] disabled:opacity-40"
          style={primaryLook}
        >
          {busy ? W.joining : W.joinButton}
        </button>
        {step === 'code' && (
          <p className="mt-2 flex justify-between text-base text-ink-3">
            <button type="button" className="text-accent" onClick={() => setStep('details')}>
              {W.otherAddress}
            </button>
            <button type="button" className="text-accent" onClick={() => void again()}>
              {W.newCode}
            </button>
          </p>
        )}
        {step === 'details' && <p className="mt-2 text-center text-sm text-ink-3">{W.sameEmail}</p>}
      </form>
    </AuthShell>
  )
}
