import { useEffect, useState } from 'react'
import { acceptInvite, api, previewInvite, setSession, stored, type Session } from '../data/api.js'
import { AuthShell, PasswordField, ProviderButtons, field, fieldLook, primaryLook, providerTrouble, useNoMail } from './Access.jsx'
import { JOIN as W } from '../words/join.js'
import type { Brand } from '@tracker/shared-schema'
import { WorkspaceMark } from './WorkspaceMark.jsx'
import { wearBrand } from '../data/brand.js'
import { onHost } from '../data/host.js'
import { HostJoin } from './app/hostJoin.jsx'

/**
 * Following an invitation.
 *
 * Somebody signed in here already joins with one press, as themselves: the
 * page asked everybody for a name, an email and a password, their own
 * included, typed again for a workspace they had been asked into. Somebody
 * already in it is shown the way in, and the link is left for whoever it was
 * meant for. Anybody else: Google or Apple, which bring them back here and
 * into the workspace — or a name, an email and a password, where an email
 * that has an account joins as that account, with its own password and its
 * code when it has one.
 */
type Seen = {
  workspace_name?: string | null | undefined
  state: string
  /** The address it was sent to, when it was sent to one. */
  email?: string | null | undefined
  /** Signed in: who they are, and whether they are in it already. */
  you?: { name: string; email: string }
  member?: boolean
  workspace_id?: string
  /** The workspace's own name and mark, where its plan wears them. */
  brand?: Brand | null | undefined
  /** Mailed to the workspace's own domain, and taken there. */
  host?: string | undefined
}

export function Join({ token }: { token: string }) {
  const [seen, setSeen] = useState<Seen | null>(null)
  const noMail = useNoMail()
  /* "Use another account": the form, though somebody is signed in here. */
  const [elsewise, setElsewise] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [asking, setAsking] = useState(false)
  /* What a provider said when it sent somebody back here without joining. */
  const [said, setSaid] = useState<string | null>(() => providerTrouble(new URLSearchParams(location.search).get('oauth')))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    /* Read as whoever is signed in here, when somebody is; a session that
       has run out reads it as anybody does. */
    const asMe = stored() ? api<Seen>(`/invite/${encodeURIComponent(token)}`).catch(() => null) : Promise.resolve(null)
    void asMe.then(async (mine) => {
      const read = mine?.state ? mine : await previewInvite(token)
      /* Mailed to the workspace's own domain: taken there and nowhere else,
         so this page goes there, the address and all. */
      if (read.host && !onHost()) {
        location.replace(`https://${read.host}/invite/${encodeURIComponent(token)}`)
        return
      }
      setSeen(read)
      if (read.email) setEmail(read.email)
      /* The workspace's name on the tab, and its mark, where it wears them. */
      if (read.brand) {
        document.title = W.docTitleIn(read.brand.name)
        wearBrand(read.brand)
      }
    })
  }, [token])
  /* The same face as signing up, which is what this is for somebody new. */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    /* On the workspace's own domain, never Tuff's name in the tab. */
    const own = onHost()
    document.title = own ? W.docTitleIn(own.name) : W.docTitle
  }, [])

  /* Into the workspace the new session is for; the address resolves it. */
  async function into(asked: Promise<Session>) {
    if (busy) return
    setBusy(true)
    setSaid(null)
    try {
      setSession(await asked)
      location.assign('/')
    } catch (e) {
      /* An address nobody has proved takes no invitation as itself:
         said plainly, with what to do. */
      const code = (e as { said?: { error?: { code?: string } } }).said?.error?.code
      setSaid(code === 'email_unverified' ? (noMail ? W.confirmFirstNoMail : W.confirmFirst) : (e as Error).message || W.couldntJoin)
      setBusy(false)
    }
  }

  async function submit() {
    if (busy) return
    setSaid(null)
    if (!name.trim() || !email.trim() || !password) {
      setSaid(W.enterAll)
      return
    }
    setBusy(true)
    try {
      await acceptInvite(token, {
        name: name.trim(),
        email: email.trim(),
        password,
        ...(asking && code.trim() ? { totp: code.trim() } : {}),
      })
      location.assign('/')
    } catch (e) {
      const why = (e as Error & { code?: string }).code
      if (why === 'totp_required') {
        if (asking) setSaid(W.codeMismatch)
        setAsking(true)
      } else {
        setSaid((e as Error).message)
      }
    } finally {
      setBusy(false)
    }
  }

  /* Whose mark stands above: nobody's until the link is read, then the
     workspace's where it wears one, else Tuff's. */
  if (seen === null)
    return (
      <AuthShell title="" mark={null}>
        {null}
      </AuthShell>
    )
  const mark = seen.brand ? <WorkspaceMark look={seen.brand} size={56} /> : undefined
  if (seen.state !== 'open')
    return (
      <AuthShell title={W.noLonger} mark={mark}>
        <p data-join className="text-center text-md leading-[1.5] text-ink-2">
          {W.noLongerBody}
        </p>
      </AuthShell>
    )
  const where = seen.workspace_name ?? W.theWorkspace
  const quiet = 'h-11 text-md font-medium'
  const line = 'text-center text-md leading-[1.5]'
  /* On the workspace's own domain: somebody already in it is shown the way
     in, as here; anybody else gives a name and an email, never a password. */
  const host = onHost()
  if (host && !(seen.you && seen.member)) {
    return <HostJoin token={token} host={host} where={where} invitedAs={seen.email} mark={mark} />
  }

  if (seen.you && !elsewise) {
    const you = seen.you
    if (seen.member)
      return (
        <AuthShell title={W.alreadyIn(where)} mark={mark}>
          <div data-join className="flex flex-col gap-3">
            <p className={`${line} text-ink-2`}>{W.signedInAnd(you.name, where)}</p>
            {said && (
              <p data-join-said role="alert" className="text-base text-danger">
                {said}
              </p>
            )}
            <button
              data-testid="join-open"
              onClick={() =>
                /* On its own domain the session is in it already, and entering
                   a workspace is never a host's. */
                host
                  ? location.assign(`/${host.slug}`)
                  : void into(api<Session>(`/workspaces/${seen.workspace_id}/enter`, { method: 'POST' }))
              }
              disabled={busy}
              className="mt-2 h-11 rounded-full text-md font-medium transition-transform active:scale-[0.98] disabled:opacity-40"
              style={primaryLook}
            >
              {W.open(where)}
            </button>
          </div>
        </AuthShell>
      )
    return (
      <AuthShell title={W.join(where)} mark={mark}>
        <div data-join className="flex flex-col gap-3">
          <p data-join-as className={`${line} text-ink-2`}>
            {W.signedInAs(you.name, you.email)}
          </p>
          {seen.email && seen.email.toLowerCase() !== you.email.toLowerCase() && (
            <p className="text-center text-base leading-[1.5] text-ink-3">{W.sentTo(seen.email)}</p>
          )}
          {said && (
            <p data-join-said role="alert" className="text-base text-danger">
              {said}
            </p>
          )}
          <button
            data-testid="join-as-me"
            onClick={() => void into(api<Session>(`/invite/${encodeURIComponent(token)}/join`, { method: 'POST' }))}
            disabled={busy}
            className="mt-2 h-11 rounded-full text-md font-medium transition-transform active:scale-[0.98] disabled:opacity-40"
            style={primaryLook}
          >
            {busy ? W.joining : W.join(where)}
          </button>
          <button data-testid="join-elsewise" onClick={() => setElsewise(true)} className={`${quiet} text-ink-2`}>
            {W.anotherAccount}
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={W.join(where)} mark={mark}>
      {/* A form, so a password manager offers the account it keeps for this
          address, or to keep the new one. */}
      <form
        data-join
        method="post"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <ProviderButtons invite={token} />
        <p className="pb-1 text-center text-md leading-[1.5] text-ink-2">{W.newOrNot}</p>
        <input
          data-testid="join-name"
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
          data-testid="join-email"
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
        {/* Either an existing account's password or a new one's, so the
            rule is said as the rule for a new one. */}
        <PasswordField testId="join-password" rule="either" value={password} onChange={setPassword} />
        {asking && (
          <input
            data-testid="join-code"
            autoFocus
            className={field}
            style={fieldLook}
            placeholder={W.code}
            name="code"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        {said && (
          <p data-join-said role="alert" className="text-base text-danger">
            {said}
          </p>
        )}
        <button
          type="submit"
          data-testid="join"
          disabled={busy}
          className="mt-2 h-11 rounded-full text-md font-medium transition-transform active:scale-[0.98] disabled:opacity-40"
          style={primaryLook}
        >
          {busy ? W.joining : W.joinButton}
        </button>
      </form>
    </AuthShell>
  )
}
