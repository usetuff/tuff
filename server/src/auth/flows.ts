import { randomBytes } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import { asAuth, asAuthActor, asAuthEverywhere, asAuthThenActor, type Tx, withActor, withActorEverywhere } from '../db.js'
import { edition } from '../edition.js'
import { orClosed } from '../instance.js'
import { hashPassword, verifyPassword, hashToken, generateToken } from './crypto.js'
import { keyFor, mac, same } from './keys.js'
import { tellInviter } from '../notify.js'
import { issueAccessToken, issueNowhereToken, ACCESS_TTL_SECONDS, REFRESH_TTL_DAYS } from './tokens.js'
import { generateRecoveryCodes, generateSecret, open, otpauthUrl, seal, totpStep } from './totp.js'

export type Session = {
  access_token: string
  refresh_token: string
  expires_in: number
  actor_id: string
  workspace_id: string
}

/** A session in no workspace. */
export type NowhereSession = Omit<Session, 'workspace_id'> & { workspace_id: null; nowhere: true }

/**
 * Its refresh row has no workspace, and its access token names none
 * (`issueNowhereToken`): nothing that asks for a workspace session takes it.
 * No line in an audit log — there is no workspace to write it in.
 */
export async function startNowhereSession(actorId: string, meta: Meta): Promise<NowhereSession> {
  const refreshToken = generateToken('rft')
  const sid = uuidv7()
  /* As the person, on the sign-in connection: `sess_write` is the sign-in
     role's alone and takes a session only for the actor of its transaction
     (migrations 306, 308). */
  await asAuthEverywhere(actorId, (tx) => writeSession(tx, { sid, actorId, workspaceId: null, refreshToken, meta, tradedFrom: null }))
  return nowhereAnswer(actorId, sid, refreshToken)
}

async function nowhereAnswer(actorId: string, sid: string, refreshToken: string): Promise<NowhereSession> {
  return {
    access_token: await issueNowhereToken({ sub: actorId, sid }),
    refresh_token: refreshToken,
    expires_in: ACCESS_TTL_SECONDS,
    actor_id: actorId,
    workspace_id: null,
    nowhere: true,
  }
}

async function sessionAnswer(
  actorId: string,
  workspaceId: string,
  sid: string,
  refreshToken: string,
  host: string | null = null,
): Promise<Session> {
  return {
    access_token: await issueAccessToken({ sub: actorId, workspace_id: workspaceId, sid, ...(host ? { host } : {}) }),
    refresh_token: refreshToken,
    expires_in: ACCESS_TTL_SECONDS,
    actor_id: actorId,
    workspace_id: workspaceId,
  }
}

/**
 * The row a session is, in a transaction on the sign-in connection whose
 * actor is `actorId` — the insert policy asks both. Its line is the one
 * `meta.from` is in, or its own. `tradedFrom` is the session whose refresh
 * token was spent for this one in the same transaction, and nothing else:
 * a refresh asked again finds its answer by it.
 */
async function writeSession(
  tx: Tx,
  s: { sid: string; actorId: string; workspaceId: string | null; refreshToken: string; meta: Meta; tradedFrom: string | null },
): Promise<void> {
  await tx`
    insert into refresh_session (id, actor_id, workspace_id, token_hash, user_agent, ip, device, expires_at, family, traded_from, created_at, host)
    values (${s.sid}, ${s.actorId}, ${s.workspaceId}, ${hashToken(s.refreshToken)},
            ${s.meta.userAgent ?? null}, ${s.meta.ip ?? null}, ${s.meta.device ?? null},
            now() + ${`${REFRESH_TTL_DAYS} days`}::interval,
            coalesce(auth_family_of(${s.actorId}, ${s.meta.from ?? null}::uuid), ${s.sid}::uuid),
            ${s.tradedFrom}::uuid,
            /* Begun: the transaction's start, or the check this session is
               made on when that was earlier (Meta.since). The database
               writes it ended when the account was put out at or after it:
               credential_after_put_out. */
            least(now(), coalesce(${s.meta.since ?? null}::timestamptz, now())),
            ${s.meta.host ?? null})`
}

/** Who is signing in from where: the address, the browser's name, and
    the id the browser keeps for itself. */
export type Meta = {
  ip?: string | null
  userAgent?: string | null
  device?: string | null
  /** The session a refresh traded — the only way into a line: it takes
      the refresh token. Its line is this one's, which is what "sign out
      other devices" keeps. Entering a workspace, making one or taking an
      invitation starts a line of its own — an access token alone, copied,
      once joined the owner's line that way. Set here, never taken from the
      client. */
  from?: string | null
  /** When the credential this session is made on was checked, by the
      database's clock, when that was before this transaction — a
      password read and verified, an access token checked as its request
      arrived (`AuthContext.checkedAt`). See `writeSession`. */
  since?: Date | null
  /** The workspace's own domain the session is made on, kept on its row
      through every refresh and never cleared.
      From `metaOf`, which reads it only from the edition's signed pair. */
  host?: string | null
}

/**
 * A session, in one workspace — and, when it is somebody signing in, the
 * line in that workspace's audit log that says so, in the same transaction.
 *
 * `signIn` is how they came in (`password`, `google`, `apple`, `github`,
 * `email_link`, `invite`, `switch`), written as `meta.method` on a `login`
 * security event for the workspace the session is for; null where a line
 * of its own is written instead (an account or a workspace made) or where
 * nobody signed in (a refresh rotating). Required, so a new way in cannot
 * forget to decide.
 */
export async function startSession(actorId: string, workspaceId: string, meta: Meta, signIn: string | null): Promise<Session> {
  const refreshToken = generateToken('rft')
  const sid = uuidv7()
  /* As the person, on the sign-in connection, as above. */
  await asAuthEverywhere(actorId, async (tx) => {
    await writeSession(tx, { sid, actorId, workspaceId, refreshToken, meta, tradedFrom: null })
    if (signIn) {
      await tx`
        insert into security_event (id, workspace_id, actor_id, kind, ip, user_agent, meta)
        values (${uuidv7()}, ${workspaceId}, ${actorId}, 'login', ${meta.ip ?? null}, ${meta.userAgent ?? null},
                ${tx.json({ method: signIn } as never)})`
    }
  })
  return sessionAnswer(actorId, workspaceId, sid, refreshToken, meta.host ?? null)
}

/**
 * A workspace just made by `register_owner`, put on the plan the edition
 * makes workspaces on — `edition.newWorkspacePlan`. Nothing on the service,
 * where the database's default is the plan; `unlimited` on your own server.
 *
 * As the new owner, after `register_owner` has committed: the update policy
 * on `workspace` lets only an owner change it, and without an actor it
 * matched nothing and changed nothing without a word — every workspace made
 * by signing up on your own server stayed on `solo`, ceilings and all. So
 * the count is checked too: a plan that did not land is an error, not a
 * workspace quietly on the wrong plan.
 */
export async function planNewWorkspace(
  actorId: string,
  workspaceId: string,
  plan: string | null = edition.newWorkspacePlan,
): Promise<void> {
  if (plan === null) return
  const changed = await withActor(actorId, workspaceId, (tx) => tx`update workspace set plan = ${plan} where id = ${workspaceId}`)
  if (changed.count !== 1) throw new Error(`the new workspace ${workspaceId} was not put on ${plan}`)
}

/**
 * What a workspace made for somebody is called when they did not name it —
 * a sign-up through a provider, or the email form, which asks only for a
 * name and an address. Renamed in
 * Settings.
 */
export function ownWorkspaceName(name: string): string {
  return `${name.trim().split(/\s+/)[0]}’s workspace`
}

type Registration = {
  email: string
  /** Only for an account made on somebody's behalf: a sign-up holds no
      password until its address is proved, and `register_owner` would drop
      one. */
  password?: string | undefined
  name: string
  workspace_name: string
  /** Left out, made from the name — the next free one, as a second
      workspace's is. */
  workspace_slug?: string | undefined
}

/**
 * The human, the workspace and the owner membership, with the address
 * confirmed or not.
 *
 * Through `register_owner`, a definer: there is no actor yet and RLS
 * requires one. The sign-in role's alone to call (migration 308).
 */
async function makeAccount(
  input: Registration,
  confirmed: boolean,
  /** Somebody asking to sign up, rather than an account made on their behalf. */
  asked: boolean,
): Promise<{ actorId: string; workspaceId: string }> {
  const actorId = uuidv7()
  const workspaceId = uuidv7()
  const passwordHash = input.password ? await hashPassword(input.password) : null
  const slug =
    input.workspace_slug ??
    (await asAuth((tx) => tx<{ slug: string }[]>`select free_workspace_slug(${input.workspace_name}) as slug`))[0]!.slug

  // The bootstrap goes through a security definer function: RLS requires a
  // membership that does not exist at registration time.
  // On your own server it decides too, in the same statement: refused
  // when sign-up is closed and this is somebody asking.
  await orClosed(
    asAuth(async (tx) => {
      await tx`select register_owner(
        ${actorId}, ${input.name}, ${input.email}, ${passwordHash},
        ${workspaceId}, ${input.workspace_name}, ${slug}, ${confirmed}, ${asked})`
    }),
  )
  await planNewWorkspace(actorId, workspaceId)
  return { actorId, workspaceId }
}

/**
 * Somebody signing up: an account whose address is not confirmed, with no
 * password and no session — the letter is where the password is chosen,
 * and choosing it is what lets them in.
 * On your own server with sign-up closed, `SignUpClosed` and no account; on
 * one nobody has claimed, the first of these to confirm their address owns
 * it.
 */
export async function signUp(input: Omit<Registration, 'password'>): Promise<string> {
  return (await makeAccount(input, false, true)).actorId
}

/**
 * An account made on somebody's behalf — the seed, the fixtures, a script
 * an operator runs — confirmed, and signed in at once.
 */
export async function registerUser(input: Registration & { password: string }): Promise<Session> {
  /* Never refused for closed sign-up, and never the server's owner: the
     script's password may be in the repository (`pnpm dev:account`), so an
     account it makes must not claim a fresh server. */
  const { actorId, workspaceId } = await makeAccount(input, true, false)
  return startSession(actorId, workspaceId, {}, null)
}

/**
 * Another workspace, for somebody who already has an account.
 *
 * As the table owner, like registration: the caller is about to be the
 * owner of something that has no members yet, and row-level security has
 * nothing to let them in by. The slug comes back from the database, which is
 * the only place that can say what is free.
 */
export async function newWorkspace(
  actorId: string,
  name: string,
  meta: Meta = {},
  /** What was chosen where it was made.
      An address that is not free throws `slug_taken` / `slug_invalid`. */
  chosen: { slug?: string | null; plan?: string | null; icon?: string | null; tint?: number | null } = {},
): Promise<Session & { slug: string }> {
  const workspaceId = uuidv7()
  const slug = await asAuth(async (tx) => {
    const [row] = await tx<{ slug: string }[]>`
      select new_workspace(${actorId}, ${workspaceId}, ${name}, ${chosen.slug ?? null}::text,
                           ${chosen.plan ?? edition.newWorkspacePlan}::text, ${chosen.icon ?? null}::text,
                           ${chosen.tint ?? null}::smallint) as slug`
    return row!.slug
  })
  return { ...(await startSession(actorId, workspaceId, meta, null)), slug }
}

export async function login(
  input: { email: string; password: string; totp?: string | undefined },
  meta: Meta = {},
): Promise<Session | 'totp_required' | { unconfirmed: string } | { nowhere: string; since: Date } | null> {
  /* Before the password is read: the session is dated from here, so an
     account put out while the password was being checked — the old one
     still read — leaves it ended (`Meta.since`). */
  const since = await checkedNow()
  const checked = await credentials(input)
  if (checked === null || checked === 'totp_required') return checked
  /* The right password for an address nobody has confirmed: not in yet.
     Asked after the password, so a wrong one says nothing about it. */
  if (!(await confirmed(checked))) return { unconfirmed: checked }
  const row = { actor_id: checked }

  const workspaceId = await withActorEverywhere(row.actor_id, async (tx) => {
    const [m] = await tx<{ workspace_id: string }[]>`
      select workspace_id from membership
      where actor_id = ${row.actor_id} and deleted_at is null and joined_at is not null
      order by (role = 'owner') desc, created_at limit 1`
    return m?.workspace_id ?? null
  })
  /* In no workspace: the caller decides whether this client can be given
     a session for nowhere. */
  if (!workspaceId) return { nowhere: row.actor_id, since }
  return startSession(row.actor_id, workspaceId, { ...meta, since }, 'password')
}

/** The database's clock, for `Meta.since`. */
export async function checkedNow(): Promise<Date> {
  const [r] = await asAuth((tx) => tx<{ at: Date }[]>`select statement_timestamp() as at`)
  return r!.at
}

/** Whether somebody's address has been confirmed. */
export async function confirmed(actorId: string): Promise<boolean> {
  const [r] = await asAuth((tx) => tx<{ ok: boolean | null }[]>`select auth_email_confirmed(${actorId}) as ok`)
  return r?.ok === true
}

/* A hash to spend the same time on when there is no password to check —
   of random bytes, so it can never be matched. */
const nobodysHash = hashPassword(randomBytes(32).toString('hex'))

/**
 * Whether these are somebody's email, password and — when they have one —
 * second factor: their actor id if so. Signing in asks it, and so does
 * accepting an invitation with an email that already has an account.
 */
export async function credentials(input: {
  email: string
  password: string
  totp?: string | undefined
}): Promise<string | 'totp_required' | null> {
  const row = await asAuth(async (tx) => {
    type Found = { actor_id: string; password_hash: string | null; totp_enabled: boolean }
    const [first] = await tx<Found[]>`select * from auth_lookup_user(${input.email})`
    if (!first) return first
    /* Under the account's hold, then read again: a put-out in flight is
       waited for, so the password read is the one after it — its previous
       holder's never signs anybody in at the moment it is taken away
       (migration 317). */
    await tx`select auth_hold_account(${first.actor_id})`
    const [r] = await tx<Found[]>`select * from auth_lookup_user(${input.email})`
    return r
  })

  /*
   * The comparison runs even when there is nothing to compare against, so
   * response time does not say which emails are registered — against a hash
   * made once, of a value nobody can type, and never as a way in.
   *
   * An account made through Google or Apple has no password at all, and this
   * used to put a fresh hash of "dummy" in its place and then let the match
   * through: anybody who knew the email of such an account signed in as it
   * with the password `dummy`. No password is no way in by password.
   */
  const stored = row?.password_hash ?? (await nobodysHash)
  const ok = await verifyPassword(input.password, stored)
  if (!row || !row.password_hash || !ok) return null

  /*
   * The second factor, actually checked.
   *
   * It is here, after the password, so a wrong password never reveals whether
   * an account has a second factor at all.
   *
   * This used to return `totp_required` when no code was sent and then accept
   * any string as one — nothing read the stored secret. It was not
   * exploitable only because there was no way to turn the factor on, which
   * made it worse: the day enrolment shipped, two-factor would have been
   * decorative and nothing would have said so.
   */
  if (row.totp_enabled) {
    if (!input.totp) return 'totp_required'
    if (!(await secondFactor(row.actor_id, input.email, input.totp))) return null
  }
  return row.actor_id
}

/**
 * Whether this is a good code from somebody's second factor — a passcode or
 * one of their recovery codes. Asked by a password sign-in after the
 * password, and by a provider's sign-in before its ticket becomes a session.
 */
export async function secondFactor(actorId: string, email: string, totp: string): Promise<boolean> {
  const sealed = await asAuth(async (tx) => {
    const [r] = await tx<{ secret: string | null }[]>`
      select auth_totp_secret_for(${email}) as secret`
    return r?.secret ?? null
  })
  // No secret is no factor, and nothing to take a code for.
  if (!sealed) return false
  /*
   * A secret that will not open — sealed under a key this server no longer
   * has — still leaves the recovery codes, which are hashes and need no
   * key. They are what a lost factor is for; refusing them here turned a
   * rotated secret into accounts nobody could get into.
   */
  const secret = open(sealed)

  const given = totp.trim()
  // A recovery code is longer and hyphenated; a passcode is six digits.
  // Trying both in the same field is one thing to explain instead of two.
  const step = secret ? totpStep(secret, given) : null
  if (step !== null) return spendStep(actorId, step)
  return asAuth(async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`
      select auth_recovery_spend(${actorId}, ${hashToken(given.toLowerCase())}) as ok`
    return r?.ok ?? false
  })
}

/**
 * A passcode is taken once. The
 * step it matched is kept, and one at or below the last kept is refused,
 * in the update that reads it: two sign-ins racing one code get one yes.
 */
async function spendStep(actorId: string, step: number): Promise<boolean> {
  const [r] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_totp_spend(${actorId}, ${step}) as ok`)
  return r?.ok === true
}

/** The workspace somebody signs into: the first they joined. */
export async function firstWorkspace(actorId: string): Promise<string | null> {
  /* One of their own first: the workspace sign-up made for them, not the
     oldest place somebody else's invitation put the address. */
  return withActorEverywhere(actorId, async (tx) => {
    const [m] = await tx<{ workspace_id: string }[]>`
      select workspace_id from membership
      where actor_id = ${actorId} and deleted_at is null and joined_at is not null
      order by (role = 'owner') desc, created_at limit 1`
    return m?.workspace_id ?? null
  })
}

/** A refresh refused because its person is no longer in the workspace the
    session was in: which one, so the device can say so and clear what it
    kept of it — `docs/specs/removing-someone.md`. */
export type Removed = { removed: { id: string; name: string } }

/* The token a removal ended — only the one live when it happened. */
async function removedBy(token: string): Promise<Removed | null> {
  const [r] = await asAuth(
    (tx) => tx<{ workspace_id: string; workspace_name: string }[]>`
    select * from auth_removed_by(${hashToken(token)})`,
  )
  return r ? { removed: { id: r.workspace_id, name: r.workspace_name } } : null
}

async function removedFrom(tx: Tx, actorId: string, workspaceId: string): Promise<Removed | null> {
  const [r] = await tx<{ name: string | null }[]>`select auth_removed_from(${actorId}, ${workspaceId}) as name`
  return r?.name ? { removed: { id: workspaceId, name: r.name } } : null
}

/**
 * How long a refresh token spent a moment ago is answered with the session
 * it was spent for. The database takes no
 * more than ten seconds whatever this says (`auth_refresh_again`); tests
 * shorten it, and never wait.
 */
export const refreshGrace = { seconds: 10 }

/**
 * A refresh's successor token, made from the token spent for it and the
 * successor's id rather than at random, so the same request asked again
 * can be answered with the same token: the server keeps only its hash.
 * Nobody without the spent token and the server's key can make it. The id
 * is no secret — it is the `sid` in every access token of that session
 * and the id of its line in Signed in — so it only ties the token to its
 * row; the key is what has to stay secret, and it is `JWT_SECRET`'s,
 * whose leak signs access tokens outright.
 */
function successorToken(spent: string, sid: string): string {
  return `rft_${mac(keyFor('refresh-successor'), `${sid}.${spent}`, 'base64url')}`
}

/**
 * Rotation: the old refresh token is revoked in the same transaction that
 * issues the new one. A leaked token works until the first refresh, not
 * forever — and, asked again within a few seconds, the first refresh's
 * answer is given again rather than a second one or a refusal.
 */
export async function refresh(
  token: string,
  /* The device asking, written on the session it rotates into. It was
     left off, so every device that had been signed in a day showed as
     "Unknown device" from its first refresh on. */
  meta: Meta = {},
): Promise<Session | NowhereSession | Removed | null> {
  const hash = hashToken(token)
  /* The device the request names, before the traded session's is carried
     on: asking again is only for the browser the token was spent from. */
  const asking = meta.device ?? null
  /*
   * Spent, not looked up and then revoked.
   *
   * The second half used to be a separate `update … where id = …`, and it
   * matched nothing every time: `sess_own` applies to an UPDATE carrying a
   * `where`, and with no actor set the row is invisible. So the old token
   * kept working and rotation rotated nothing — `036_spend_refresh.sql`.
   *
   * One statement also closes the race the two-step had: `update …
   * returning` hands the row to exactly one of two requests arriving with
   * the same token.
   *
   * And the session that replaces it is written in the same transaction,
   * which holds the spent row's lock until it commits: a second request
   * with the same token waits on the first, matches nothing, and then finds
   * what the first wrote (`again`, below). Spent in one transaction and
   * replaced in another, a duplicate between the two found neither.
   */
  const traded = await asAuthThenActor(async (tx, actAs) => {
    const [row] = await tx<{ session_id: string; actor_id: string; workspace_id: string | null }[]>`
      select * from auth_spend_refresh(${hash})`
    if (!row) return 'spent' as const
    return tradeFor(tx, actAs, row, token, meta)
  })
  if (traded !== 'spent') return traded
  return (await again(token, hash, asking)) ?? removedBy(token)
}

/**
 * The same answer, asked again: the live session a token spent a moment ago
 * was spent for, by the same browser, with a fresh access token for it —
 * `auth_refresh_again`. Null for anything
 * else, which is refused as a spent token always was.
 */
async function again(token: string, hash: string, device: string | null): Promise<Session | NowhereSession | null> {
  if (!(refreshGrace.seconds > 0)) return null
  const [n] = await asAuth(
    (tx) => tx<{ session_id: string; actor_id: string; workspace_id: string | null; token_hash: string }[]>`
      select * from auth_refresh_again(${hash}, ${device}, ${refreshGrace.seconds}::float8 * interval '1 second')`,
  )
  if (!n) return null
  const made = successorToken(token, n.session_id)
  /* A successor written before 312, or by an older container mid-deploy,
     was random: nothing can be made again, and the duplicate is refused. */
  if (!same(hashToken(made), n.token_hash)) return null
  const [h] = await asAuth((tx) => tx<{ host: string | null }[]>`select auth_session_host(${n.session_id}) as host`)
  return n.workspace_id
    ? sessionAnswer(n.actor_id, n.workspace_id, n.session_id, made, h?.host ?? null)
    : nowhereAnswer(n.actor_id, n.session_id, made)
}

/** What a spent token is traded for, inside the transaction that spent it. */
async function tradeFor(
  tx: Tx,
  actAs: (actorId: string) => Promise<void>,
  row: { session_id: string; actor_id: string; workspace_id: string | null },
  token: string,
  meta: Meta,
): Promise<Session | NowhereSession | Removed | null> {
  /*
   * The workspace the session was in, not the oldest one this person is in.
   *
   * Picked by hand it was the oldest membership, which is right for exactly
   * one account in one workspace and wrong for everybody else: working in
   * the second, the access token expires, the client refreshes, and the
   * session comes back in the first. Row-level security then does what it
   * should and every read answers 200 with nothing — the project's lists
   * and its tasks both empty, no error anywhere, and a project with five
   * tasks in it saying "Nothing here yet."
   *
   * Still checked against the memberships rather than trusted: a session
   * older than somebody's removal from a workspace must not hand it back
   * to them. And null for rows written before the column existed, which
   * fall back to what the old code did.
   *
   * Removed from it, the session is not carried into another workspace:
   * it went to the oldest one, under the address of the one they had
   * lost, and nothing on the screen said why everything had changed. The
   * refusal says where they were removed from instead —
   * `docs/specs/removing-someone.md`. Only a session from before removal
   * ended sessions (172) gets this far; one since is refused above.
   */
  if (row.workspace_id) {
    const out = await removedFrom(tx, row.actor_id, row.workspace_id)
    if (out) return out
  }
  /* As the person from here, as `withActorEverywhere` was: the membership
     reads and the insert policy both ask who. */
  await actAs(row.actor_id)
  /* The domain the spent session was made on, whatever this request says:
     carried on and never cleared, so a host's session stays one wherever
     it is refreshed. */
  const [hosted] = await tx<{ host: string | null }[]>`select auth_session_host(${row.session_id}) as host`
  const host = hosted?.host ?? null
  const workspaceId = await (async () => {
    if (row.workspace_id) {
      const [still] = await tx<{ workspace_id: string }[]>`
        select workspace_id from membership
        where actor_id = ${row.actor_id} and workspace_id = ${row.workspace_id}
          and deleted_at is null and joined_at is not null`
      if (still) return still.workspace_id
      /* In it, and not joined: invited, or a row of some other kind. As
         before — nothing to explain. */
    }
    const [m] = await tx<{ workspace_id: string }[]>`
      select workspace_id from membership
      where actor_id = ${row.actor_id} and deleted_at is null and joined_at is not null
      order by (role = 'owner') desc, created_at limit 1`
    return m?.workspace_id ?? null
  })()
  /* And never renewed into another workspace than its own: out of it, it is
     nobody. */
  if (host && (!row.workspace_id || workspaceId !== row.workspace_id)) return null
  /* The browser the traded session belonged to, carried on when the request
     does not say: a session's device is what signing out and ending it from
     Account end together, and a trade that dropped it left the access
     tokens from before it running after the browser was signed out. */
  if (!meta.device) {
    const [was] = await tx<{ device: string | null }[]>`select auth_device_of(${row.actor_id}, ${row.session_id}) as device`
    if (was?.device) meta = { ...meta, device: was.device }
  }
  const sid = uuidv7()
  const refreshToken = successorToken(token, sid)
  const next = {
    sid,
    actorId: row.actor_id,
    refreshToken,
    meta: { ...meta, from: row.session_id, host },
    tradedFrom: row.session_id,
  }
  /* A session in no workspace, still in none: renewed as it was. One that
     was in a workspace and now finds none is not turned into one. */
  if (!workspaceId && !row.workspace_id) {
    const [alive] = await tx<{ name: string }[]>`select name from auth_nowhere(${row.actor_id})`
    if (!alive) return null
    await writeSession(tx, { ...next, workspaceId: null })
    return nowhereAnswer(row.actor_id, sid, refreshToken)
  }
  if (!workspaceId) return null
  /* A refresh rotating, every quarter of an hour: nobody signed in. */
  await writeSession(tx, { ...next, workspaceId })
  return sessionAnswer(row.actor_id, workspaceId, sid, refreshToken, host)
}

/**
 * Signing out, which never did.
 *
 * This matched on `token_hash`, a column the application role may not read —
 * migration 002 revoked SELECT on it deliberately, because a session row is
 * a credential. A `where` on a column you may not read is `permission
 * denied`, so `POST /auth/logout` answered 500 to every request ever made to
 * it, and the session was never ended.
 *
 * It looked like it worked: the browser throws its own copy away and the
 * screen goes to the sign-in page. What did not happen is the only part that
 * matters — a copy of that refresh token stayed valid for its whole life,
 * and pressing "sign out" on a borrowed laptop did nothing to it.
 *
 * Found by the one `✗` in a check where every test passed: the e2e sign-out
 * asserts what the browser does next, which was right either way. Rewriting
 * it as a lookup plus an update by `id` did not fix it — that is the same
 * statement `refresh` used, and it had never worked either. The whole of it
 * is in `036_spend_refresh.sql`.
 */
/**
 * Signing out ends the browser's sessions, not only its refresh token: the
 * access tokens it holds stop at their next request — `auth_end_session`,
 * migration 115.
 */
export async function logout(token: string): Promise<void> {
  await asAuth((tx) => tx`select auth_end_session(${hashToken(token)})`)
}

/**
 * A token for a tool this person connects. Returned once — after that only the
 * hash is in the database.
 *
 * Rotation without downtime: issuing does not revoke, so a person may hold two
 * valid ones while they swap.
 */
export async function issueApiToken(
  actorId: string,
  workspaceId: string,
  name: string,
  projectIds: string[] = [],
  ttlDays = 90,
  /** When the request asking for it was checked — `Meta.since`. */
  since: Date | null = null,
): Promise<string> {
  return (await mint(actorId, workspaceId, name, projectIds, ttlDays, null, since))!
}

/**
 * How many live tokens a person may hold in a workspace when making one by
 * hand (`POST /api/tokens`). Revoked,
 * expired and deleted ones do not count; every live one does, a connector's
 * included, since each is one more key somebody may have to find and revoke.
 */
export const MAX_LIVE_TOKENS = 25

/** `issueApiToken`, refused (null) when the person already holds `MAX_LIVE_TOKENS` live ones. */
export function issueOwnToken(
  actorId: string,
  workspaceId: string,
  name: string,
  projectIds: string[],
  ttlDays: number,
  since: Date | null = null,
): Promise<string | null> {
  return mint(actorId, workspaceId, name, projectIds, ttlDays, MAX_LIVE_TOKENS, since)
}

async function mint(
  actorId: string,
  workspaceId: string,
  name: string,
  projectIds: string[],
  ttlDays: number,
  most: number | null,
  since: Date | null,
): Promise<string | null> {
  const token = generateToken('tok')
  /* On the sign-in connection: a token is inserted by `tracker_auth` alone (migration 308). */
  const made = await asAuthActor(actorId, workspaceId, async (tx) => {
    /* Counted under a lock on the person, so two presses at once cannot
       both find room for the last one. */
    if (most !== null) {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`api_token:${workspaceId}:${actorId}`}, 0))`
      const [n] = await tx<{ n: number }[]>`
        select count(*)::int as n from api_token
        where actor_id = ${actorId} and workspace_id = ${workspaceId}
          and revoked_at is null and deleted_at is null and expires_at > now()`
      if ((n?.n ?? 0) >= most) return false
    }
    await tx`
      insert into api_token
        (id, workspace_id, actor_id, name, project_ids, token_hash, expires_at, created_at)
      values (${uuidv7()}, ${workspaceId}, ${actorId}, ${name}, ${projectIds},
              ${hashToken(token)}, now() + ${`${ttlDays} days`}::interval,
              /* Begun no later than the request asking was checked, as a
                 session is (writeSession). */
              least(now(), coalesce(${since}::timestamptz, now())))`
    return true
  })
  if (!made) return null
  await asAuth(
    (tx) => tx`
      insert into security_event (id, workspace_id, actor_id, kind, meta)
      values (${uuidv7()}, ${workspaceId}, ${actorId}, 'token_issued',
              ${tx.json({ name, project_ids: projectIds } as never)})`,
  )
  return token
}

/**
 * Revoking is immediate and has no inverse: a credential that may have leaked
 * must not be un-revocable. That is also why it is not a mutation.
 */
export async function revokeApiToken(actorId: string, workspaceId: string, tokenId: string, anyOwner: boolean): Promise<boolean> {
  /* `revoked_at` is the sign-in role's to write (migration 308). */
  return asAuthActor(actorId, workspaceId, async (tx) => {
    // An owner or admin may revoke somebody else's; everyone else only their
    // own, and RLS keeps the row invisible either way.
    const rows = anyOwner
      ? await tx<{ id: string; workspace_id: string }[]>`
          update api_token set revoked_at = now()
          where id = ${tokenId} and revoked_at is null returning id, workspace_id`
      : await tx<{ id: string; workspace_id: string }[]>`
          update api_token set revoked_at = now()
          where id = ${tokenId} and actor_id = ${actorId} and revoked_at is null
          returning id, workspace_id`
    if (!rows.length) return false
    await tx`
      insert into security_event (id, workspace_id, actor_id, kind, meta)
      values (${uuidv7()}, ${rows[0]!.workspace_id}, ${actorId}, 'token_revoked',
              ${tx.json({ token_id: tokenId } as never)})`
    return true
  })
}

/* --------------------------------------------------------- second factor */

/**
 * Start enrolling: a secret is stored but the factor is not on yet.
 *
 * Nobody is left with the factor enabled and a secret they never managed to
 * scan — that is an account its owner cannot get into, which is worse than
 * one without a second factor.
 */
export async function beginTotp(actorId: string, email: string): Promise<{ secret: string; url: string } | null> {
  const secret = generateSecret()
  /* Null when the factor is on: the write asks, not only the route before
     it, so an enable landing in between is not undone (migration 243). */
  const [r] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_totp_begin(${actorId}, ${seal(secret)}) as ok`)
  if (!r?.ok) return null
  return { secret, url: otpauthUrl(secret, email) }
}

/**
 * Turn it on, but only for somebody who can already produce a code — and
 * only from off: `on` when it already was, and no new recovery codes then.
 */
export async function enableTotp(actorId: string, code: string): Promise<string[] | 'on' | 'expired' | null> {
  const sealed = await asAuth(async (tx) => {
    const [r] = await tx<{ secret: string | null }[]>`
      select auth_totp_secret(${actorId}) as secret`
    return r?.secret ?? null
  })
  const secret = sealed ? open(sealed) : null
  const step = secret ? totpStep(secret, code) : null
  /* Spent here as at signing in: the code that turned it on does not sign
     in a moment later. */
  if (step === null || !(await spendStep(actorId, step))) return null

  const codes = generateRecoveryCodes()
  /* `expired` for a secret begun more than a quarter of an hour ago: one
     begun and left, or begun before beginning asked who it was, is not a
     way to turn the factor on with a code alone (migration 243). */
  const turned = await asAuth(async (tx) => {
    /* Only the secret the code was checked against (migration 317). */
    const [r] = await tx<{ how: 'ok' | 'on' | 'expired' }[]>`select auth_totp_enable(${actorId}, ${sealed}) as how`
    if (r?.how !== 'ok') return r?.how ?? 'expired'
    await tx`select auth_recovery_replace(${actorId}, ${codes.map((c) => hashToken(c))})`
    return 'ok'
  })
  if (turned !== 'ok') return turned
  // Returned once. They are stored hashed, so this is the only moment they
  // exist in readable form anywhere.
  return codes
}

/**
 * Turning it off asks for the password again, and for a code from the
 * factor itself — a passcode, or a recovery code for a phone that is gone.
 *
 * Otherwise a borrowed unlocked laptop removes the factor that was there to
 * make a borrowed unlocked laptop not enough; and with the password alone,
 * whoever had learned it took the factor off and needed nothing else after.
 */
export async function disableTotp(
  actorId: string,
  proof: { password?: string | undefined; emailCode?: string | undefined },
  code: string,
): Promise<'ok' | 'wrong_password' | 'wrong_email_code' | 'wrong_code'> {
  const stored = await asAuth(async (tx) => {
    const [r] = await tx<{ hash: string | null; email: string | null }[]>`
      select auth_password_hash(${actorId}) as hash, auth_email_of(${actorId})::text as email`
    return r ?? null
  })
  /* An account with no password — made through a provider — turned it on
     with six digits from its inbox and could never turn it off: this asked
     a password it did not have. Six digits sent for this (`twofa-off`)
     stand in the password's place. */
  if (stored?.hash) {
    if (!proof.password || !(await verifyPassword(proof.password, stored.hash))) return 'wrong_password'
  } else {
    const { codeFromInbox } = await import('./address.js')
    if (!(await codeFromInbox(actorId, proof.emailCode, 'twofa-off'))) return 'wrong_email_code'
  }
  if (!stored?.email || !code.trim() || !(await secondFactor(actorId, stored.email, code))) return 'wrong_code'
  await asAuth((tx) => tx`select auth_totp_disable(${actorId})`)
  return 'ok'
}

export async function totpState(actorId: string): Promise<{ enabled: boolean; recovery_left: number }> {
  /*
   * As the person, not as nobody. `app_user` is read by its own actor and
   * nobody else (`u_read`), and asked as nobody the row was not there: the
   * factor read as off however it stood. The screen took a factor just
   * turned on for one that was not, showed its recovery codes beside "Set
   * up" with no way past them — and beginning again over a factor that was
   * on, which is refused so a borrowed session cannot swap it, was let
   * through and switched it off.
   */
  return withActorEverywhere(actorId, async (tx) => {
    const [r] = await tx<{ enabled: boolean; left: number }[]>`
      select (select totp_enabled from app_user where actor_id = ${actorId}) as enabled,
             auth_recovery_left(${actorId}) as left`
    return { enabled: Boolean(r?.enabled), recovery_left: Number(r?.left ?? 0) }
  })
}

/**
 * An invitation taken by somebody who has an account already — signed in,
 * or vouched for by Google or Apple on the way back from them.
 *
 * `accept_invite` finds the account by its address, as it always has for
 * somebody joining with their password; here the address is the account's
 * own, so it is that account that joins. Spent, expired or revoked is
 * `gone`; a workspace at its plan's ceiling is `full`, and a link handed
 * over by hand to another address is `elsewhere` (migration 210) — both
 * leave the invitation as it was.
 *
 * An address nobody has proved is `unconfirmed`, and the invitation is not
 * touched: an invitation mailed to that address belongs to whoever reads
 * the inbox, not to whoever holds a session for the account.
 */
export async function takeInvite(
  tokenHash: string,
  actorId: string,
  /** The person pressed Join on the invitation's own page — only that
      confirms a workspace waiting for their word (migration 315). Anything else finds it `gone`. */
  pressed = false,
): Promise<{ workspaceId: string } | 'gone' | 'full' | 'elsewhere' | 'unconfirmed' | 'on_host'> {
  const [u] = await asAuth((tx) => tx<{ email: string | null }[]>`select auth_email_of(${actorId}) as email`)
  if (!u?.email) return 'gone'
  if (!(await confirmed(actorId))) return 'unconfirmed'
  try {
    const [row] = await asAuth(
      (tx) => tx<{ workspace_id: string; actor_id: string }[]>`
        select * from accept_invite(${tokenHash}::text, ${uuidv7()}::uuid, ''::text, ${u.email}::citext, null::text,
                                    false, ${pressed}::boolean)`,
    )
    if (!row || row.actor_id !== actorId) return 'gone'
    await tellInviter(row.workspace_id, actorId)
    return { workspaceId: row.workspace_id }
  } catch (e) {
    if ((e as { message?: string }).message?.includes('workspace_full')) return 'full'
    /* A link handed over by hand is for its own address, and this account's
       is another (migration 210). Left unspent. */
    if ((e as { message?: string }).message?.includes('invite_for_another_address')) return 'elsewhere'
    /* The workspace waits for the person's own Join, and this was not it.
       Left unspent. */
    if ((e as { message?: string }).message?.includes('membership_waiting')) return 'gone'
    /* Mailed to a workspace's own domain, and taken only there (migration
       328). Left unspent, for the link in its letter. */
    if ((e as { message?: string }).message?.includes('invite_on_host')) return 'on_host'
    throw e
  }
}
