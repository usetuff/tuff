import { Hono, type Context } from 'hono'
import { send, note, mailOn } from '../mail.js'
import { edition } from '../edition.js'
import { fullRefusal, workspaceFull } from '../ceilings.js'
import { emailOf } from '../auth/address.js'
import { brandHere, brandOfInvite } from '../brand.js'
import { oneLine } from '../text.js'
import { origin, sendChoosePassword } from './access.js'
import { guess, metaOf, spendOn } from './limits.js'
import { z } from 'zod'
import { Role, Right, RIGHTS_ON_JOINING } from '@tracker/shared-schema'
import { v7 as uuidv7 } from 'uuid'
import { asAuth, withActor, withoutActor } from '../db.js'
import { allow, type AuthContext } from '../auth/context.js'
import { generateToken, hashToken, hashPassword } from '../auth/crypto.js'
import { checkedNow, confirmed, credentials, startSession, takeInvite, type Session } from '../auth/flows.js'
import { hostOf } from '../host.js'
import { tellInviter } from '../notify.js'
import { heard, languageFor, one, say } from '../words.js'

type Vars = { ctx: AuthContext }

/**
 * Whether an invitation to an address is handed over by hand — its own link
 * shown to the inviter, to pass on themselves — rather than mailed.
 *
 * Only on a server of one's own that sends no mail: there the mail would go
 * nowhere, and before this the invitation was simply never delivered. On
 * the service, and wherever mail is set up, never — the link that proves an
 * address goes to that address and nowhere else.
 */
export function handsOver(instance: boolean, mail: boolean): boolean {
  return instance && !mail
}

/** The database's refusal of a link handed over by hand, taken with another address (migration 210). */
export function isForAnotherAddress(e: unknown): boolean {
  return (e as { message?: string } | null)?.message?.includes('invite_for_another_address') === true
}

export const FOR_ANOTHER_ADDRESS = {
  error: { code: 'wrong_email', message: 'This invitation is for a different email address.' },
} as const

/** Taken only on the workspace's own domain it was mailed to — migration 328. */
export const ON_HOST = {
  error: { code: 'invite_on_host', message: 'Accept this invitation from the link in its email.' },
} as const

/**
 * Where an invitation is taken, as its preview says.
 * One mailed to a workspace's own domain
 * is taken there and nowhere else: read anywhere but through that domain,
 * its preview names the host to go to while it answers, and says the link
 * no longer works once it does not. Anything else is answered as it was.
 */
export async function placed<T extends { state: string }>(
  c: Context,
  hash: string,
  row: T,
): Promise<(T & { host?: string }) | { state: 'invalid' }> {
  if (row.state !== 'open') return row
  const [p] = await withoutActor((tx) => tx<{ mailed_domain: string | null }[]>`select mailed_domain from invite_place(${hash})`)
  if (!p?.mailed_domain || hostOf(c)?.domainId === p.mailed_domain) return row
  const [d] = await withoutActor((tx) => tx<{ hostname: string }[]>`select hostname from host_domain(${p.mailed_domain})`)
  return d ? { ...row, host: d.hostname } : { state: 'invalid' }
}

/**
 * Invites by link.
 *
 * Outside the mutation catalogue for the same reason agent tokens are
 * (protocol.md §9): an invite is a credential, not workspace data. Its whole
 * point is to be a secret URL, it is never synced, and it is stored only as a
 * hash. Revoking it has no inverse.
 */
export const invites = new Hono<{ Variables: Vars }>()

/**
 * Inviting somebody from outside is the one row the workspace can move: an
 * agency lets its members do it, a hundred-person company does not. `can`
 * already folds that switch in, so this asks and does not re-implement it.
 */
function guard(ctx: AuthContext): string | null {
  if (ctx.viaMcp) return 'Connected tools can’t invite people.'
  if (!allow(ctx, 'people.invite')) return 'You don’t have permission to invite people.'
  return null
}

invites.get('/invites', async (c) => {
  const ctx = c.get('ctx')
  const denied = guard(ctx)
  if (denied) return c.json({ error: { code: 'forbidden', message: denied } }, 403)

  // token_hash is not selected and could not be: migration 004 revoked the
  // column grant for the application role.
  return c.json({
    invites: await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      return tx<
        {
          id: string
          role: string
          project_ids: string[]
          email: string | null
          rights: string[]
          created_at: string
          expires_at: string
          used_at: string | null
          used_by: string | null
          deleted_at: string | null
          send_again: boolean
        }[]
      >`select id, role, project_ids, email, rights, created_at, expires_at,
               used_at, used_by, deleted_at,
               -- Mailed to the workspace's own domain, which no longer opens
               -- it — released, paused, dropped or taken: taken nowhere now
               -- (migration 328), so it must be sent again. The server says
               -- so; the list does not work it out.
               (mailed_domain is not null and used_at is null and deleted_at is null and expires_at > now()
                and not exists (select 1 from host_domain(mailed_domain))) as send_again
        from invite order by created_at desc limit 100`
    }),
  })
})

invites.post('/invites', async (c) => {
  const ctx = c.get('ctx')
  const body = z
    .object({
      /* A member, always: a workspace has one owner, and it is handed
         over from its settings. */
      role: Role.default('member'),
      project_ids: z.array(z.uuid()).default([]),
      email: z.email().nullish(),
      /*
       * What they may do on the projects this invite names.
       *
       * Carried on the invite rather than set afterwards: arriving able to do
       * everything and being cut down later leaves a window, and the window is
       * exactly long enough to use it.
       */
      rights: z.array(Right).default([...RIGHTS_ON_JOINING]),
      ttl_hours: z.number().int().min(1).max(720).default(168),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const denied = guard(ctx)
  if (denied) return c.json({ error: { code: 'forbidden', message: denied } }, 403)
  if (body.data.role === 'owner') {
    return c.json(
      {
        error: {
          code: 'invalid',
          message: 'A workspace has one owner. Invite them as a member, then hand the workspace over in its settings.',
        },
      },
      400,
    )
  }
  // Rights are held on a project. Naming them and naming no project is a
  // sentence with no subject — refused, rather than quietly dropped.
  if (body.data.rights.length > 0 && body.data.project_ids.length === 0) {
    return c.json({ error: { code: 'invalid', message: 'Choose at least one project for these permissions.' } }, 400)
  }
  /*
   * Only onto projects the inviter is on, in this workspace — and rights
   * beyond the ordinary two only from whoever runs those projects, as
   * adding somebody directly asks. An invitation was a way round both: a
   * member could invite themselves, from a second address, onto any
   * project and holding `manage`.
   */
  if (body.data.project_ids.length > 0) {
    const ok = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      const rows = await tx<{ ok: boolean }[]>`
        select (p.workspace_id = ${ctx.workspaceId} and p.deleted_at is null and in_project(p.id)) as ok
        from project p where p.id = any(${body.data.project_ids}::uuid[])`
      return rows.length === body.data.project_ids.length && rows.every((r) => r.ok)
    })
    if (!ok) return c.json({ error: { code: 'not_found' } }, 404)
    const beyond = body.data.rights.some((r) => !(RIGHTS_ON_JOINING as readonly string[]).includes(r))
    const runs = (p: string) => ctx.role === 'owner' || (ctx.rights[p] ?? []).includes('manage')
    if (beyond && !body.data.project_ids.every(runs)) {
      return c.json({ error: { code: 'forbidden', message: 'You can only give these permissions on projects you manage.' } }, 403)
    }
  }

  /*
   * And the plan's ceiling on people.
   *
   * `accept_invite` checks this too, and that one is the check that counts:
   * a membership is written there and an endpoint beside it is a ceiling
   * with a second way in. This one is so the refusal happens where the
   * owner is standing — being told the workspace is full while writing an
   * invitation is a different experience from a stranger following a link
   * a week later and being turned away.
   *
   * Counted with the invitations still waiting, each a place held for its
   * address (`workspace_held`): counted without them, a workspace with one place left took invitations
   * to every address typed and turned all but the first away at the door.
   *
   */
  const full = await withActor(ctx.actorId, ctx.workspaceId, (tx) => workspaceFull(tx, ctx.workspaceId))
  if (full) return c.json(fullRefusal('inviter'), 413)

  /* Decided here, once, by whoever passed `guard` above — `can()` through
     `people.invite` — and kept on the row by the sign-in role (`delivered`,
     below): the database holds such a link to its address when it is
     followed. */
  const byHand = Boolean(body.data.email) && handsOver(edition.instance, await mailOn())
  const id = uuidv7()
  const token = generateToken('inv')
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    await tx`
      insert into invite (id, workspace_id, role, project_ids, email, rights,
                          token_hash, created_by, expires_at)
      values (${id}, ${ctx.workspaceId}, ${body.data.role}::role_kind,
              ${body.data.project_ids}, ${body.data.email ?? null}, ${body.data.rights},
              ${hashToken(token)},
              ${ctx.actorId}, now() + ${`${body.data.ttl_hours} hours`}::interval)`
  })
  if (byHand) await delivered(id, token, body.data.email!, 'by hand')
  await withoutActor(
    (tx) => tx`
      insert into security_event (id, workspace_id, actor_id, kind, meta)
      values (${uuidv7()}, ${ctx.workspaceId}, ${ctx.actorId}, 'invite_created',
              ${tx.json({ invite_id: id, role: body.data.role, ...(byHand ? { by_hand: true } : {}) } as never)})`,
  )

  /*
   * An invitation with an address on it is sent there.
   * It used to be a link the inviter had to carry over themselves, which a
   * window that asks for email addresses cannot honestly be. Said with who
   * asked and where to, and the link the copy button gives.
   */
  /* A fault before the letter goes — reading the workspace's domain, the
     sender, the projects — revokes the invitation it was for, so no live
     invitation is left whose token nobody holds (S2).
     Nothing after the letter throws: `delivered` never does. */
  const mailed =
    body.data.email && !byHand && (await mayMailInvite(ctx, body.data.email))
      ? await mailInvite(
          c,
          ctx,
          { id, email: body.data.email, project_ids: body.data.project_ids, ttl_hours: body.data.ttl_hours },
          token,
        ).catch(async (e: unknown) => {
          await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
            await tx`update invite set deleted_at = now() where id = ${id}`
          }).catch(() => undefined)
          throw e
        })
      : false

  /*
   * Returned once. After this only the hash exists, which is the whole reason
   * this is not a mutation.
   *
   * A link with no address is the inviter's to hand over, so it comes back.
   * An invitation to an address comes back with its link only when it is
   * handed over by hand; otherwise the link went to the address, and only
   * there — following it proves the address, so whoever made it must not
   * hold it too. Empty rather than absent: `token` is a string in every
   * client already decoding this answer.
   */
  return c.json({ id, token: !body.data.email || byHand ? token : '', mailed })
})

invites.post('/invites/:id/revoke', async (c) => {
  const ctx = c.get('ctx')
  const denied = guard(ctx)
  if (denied) return c.json({ error: { code: 'forbidden', message: denied } }, 403)

  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update invite set deleted_at = now()
      where id = ${c.req.param('id')} and deleted_at is null and used_at is null
      returning id`
    return rows.length > 0
  })
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/** Refused inside the transaction that would have sent one again, so the old link stays. */
class FullAgain extends Error {}

/**
 * Sending one again.
 *
 * Only its hash is kept, so the link it had cannot be shown again: a new
 * one is made in its place, the old one stops in the same transaction,
 * and it holds what the old one held — the address, the role, the
 * projects and their rights — for as long again. To an address it is
 * mailed under the same ceilings as the first, and its link is returned
 * only where the first one's would have been: with no address, or handed
 * over by hand.
 */
invites.post('/invites/:id/resend', async (c) => {
  const ctx = c.get('ctx')
  const denied = guard(ctx)
  if (denied) return c.json({ error: { code: 'forbidden', message: denied } }, 403)
  const old = c.req.param('id')
  if (!z.uuid().safeParse(old).success) return c.json({ error: { code: 'not_found' } }, 404)

  /*
   * The ceilings first, before the old link is touched: past one, nothing
   * is sent, and the invitation that was out stays out with the link that
   * works. Spending them after the old one had stopped left nobody holding
   * a link at all.
   */
  const [to] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx<{ email: string | null }[]>`
      select email from invite where id = ${old} and deleted_at is null and used_at is null`,
  )
  if (!to) return c.json({ error: { code: 'not_found' } }, 404)
  /* Read back from the row, so asked as sending it first asks: only an
     address `z.email()` takes — ASCII — is mailed or handed over. A row
     the route did not write may hold anything, and an address that only
     looks like somebody's must not be mailed a link that proves theirs
     (migration 313). */
  if (to.email !== null && !z.email().safeParse(to.email).success) {
    return c.json({ error: { code: 'invalid', message: 'This invitation’s email address isn’t valid. Revoke it and invite again.' } }, 400)
  }
  const mails = Boolean(to.email) && !handsOver(edition.instance, await mailOn())
  if (mails && !(await mayMailInvite(ctx, to.email!))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many invitations sent today. Try again tomorrow.' } }, 429)
  }

  const id = uuidv7()
  const token = generateToken('inv')
  type Was = { role: string; project_ids: string[]; email: string | null; rights: string[]; ttl_hours: number }
  let was: Was | 'missing' | 'forbidden'
  try {
    was = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      const [row] = await tx<Was[]>`
        select role, project_ids, email, rights,
               greatest(1, least(720, round(extract(epoch from (expires_at - created_at)) / 3600)))::int as ttl_hours
        from invite where id = ${old} and deleted_at is null and used_at is null`
      if (!row) return 'missing' as const
      /* Onto the projects it names only by somebody who could have
         written it so — the same two questions as sending it first. */
      if (row.project_ids.length > 0) {
        const on = await tx<{ ok: boolean }[]>`
          select (p.deleted_at is null and in_project(p.id)) as ok from project p
          where p.workspace_id = ${ctx.workspaceId} and p.id = any(${row.project_ids}::uuid[])`
        if (on.length !== row.project_ids.length || !on.every((r) => r.ok)) return 'forbidden' as const
        const beyond = row.rights.some((r) => !(RIGHTS_ON_JOINING as readonly string[]).includes(r))
        const runs = (p: string) => ctx.role === 'owner' || (ctx.rights[p] ?? []).includes('manage')
        if (beyond && !row.project_ids.every(runs)) return 'forbidden' as const
      }
      /* Taken by one request only: two presses at once, and the second
         finds it gone rather than making a second invitation. */
      const [taken] = await tx`
        update invite set deleted_at = now()
        where id = ${old} and deleted_at is null and used_at is null returning id`
      if (!taken) return 'missing' as const
      /* The place the old one held is let go first and taken again here,
         so a full workspace sends one again — but not one whose first had
         lapsed and so held nothing. */
      if (await workspaceFull(tx, ctx.workspaceId)) throw new FullAgain()
      await tx`
        insert into invite (id, workspace_id, role, project_ids, email, rights,
                            token_hash, created_by, expires_at)
        values (${id}, ${ctx.workspaceId}, ${row.role}::role_kind, ${row.project_ids}, ${row.email}, ${row.rights},
                ${hashToken(token)}, ${ctx.actorId}, now() + ${`${row.ttl_hours} hours`}::interval)`
      return row
    })
  } catch (e) {
    if (e instanceof FullAgain) return c.json(fullRefusal('inviter'), 413)
    throw e
  }
  if (was === 'missing') return c.json({ error: { code: 'not_found' } }, 404)
  if (was === 'forbidden')
    return c.json({ error: { code: 'forbidden', message: 'You can only invite people onto projects you are on.' } }, 403)
  const byHand = Boolean(was.email) && handsOver(edition.instance, await mailOn())
  if (byHand) await delivered(id, token, was.email!, 'by hand')
  await withoutActor(
    (tx) => tx`
      insert into security_event (id, workspace_id, actor_id, kind, meta)
      values (${uuidv7()}, ${ctx.workspaceId}, ${ctx.actorId}, 'invite_created',
              ${tx.json({ invite_id: id, role: was.role, resent_from: old, ...(byHand ? { by_hand: true } : {}) } as never)})`,
  )
  if (was.email && !byHand) {
    const sent = await mailInvite(c, ctx, { id, email: was.email, project_ids: was.project_ids, ttl_hours: was.ttl_hours }, token).catch(
      () => false,
    )
    /* Not sent: the old one is put back and the new one stops, so the
       link that was out still works. */
    if (!sent) {
      await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
        await tx`update invite set deleted_at = now() where id = ${id}`
        await tx`update invite set deleted_at = null where id = ${old} and used_at is null`
      })
      return c.json({ error: { code: 'mail_failed', message: 'Couldn’t send the invitation. Try again.' } }, 502)
    }
    return c.json({ id, token: '', mailed: true })
  }
  return c.json({ id, token, mailed: false })
})

/**
 * Whether one more invitation may be mailed to this address, spending it
 * if so — asked before anything is sent or changed.
 */
async function mayMailInvite(ctx: AuthContext, email: string): Promise<boolean> {
  /* Fifty mailed a day for a workspace, a hundred for the person sending
     them and five to any one address: an invitation is mail from this
     product's own address to anybody, and the workspace's ceiling alone was
     a ceiling per workspace that anybody could make another of in a minute
     — fifty more to the same inbox each time. The invitation is made either
     way; past a ceiling it is not mailed, and its link is not returned
     either (below), so a link with no address is the way to reach them.
     Handed over by hand, nothing is sent and no ceiling is spent. */
  return (
    (await spendOn(`invite-to:${email.toLowerCase()}`, 5, 86_400)) &&
    (await spendOn(`invite-mail:actor:${ctx.actorId}`, 100, 86_400)) &&
    (await spendOn(`invite-mail:${ctx.workspaceId}`, 50, 86_400))
  )
}

/**
 * The server delivered this invitation's link to its address — mailed it,
 * or handed it to the inviter where there is no mail — written on the row
 * by the sign-in role, which alone may (migration 313). What following the
 * link proves about the address is read from this and nothing else: the
 * application role inserts invitations, so an address on a row it wrote
 * is only what somebody typed. Bound to the token's hash, which only this
 * request and the letter hold.
 */
async function delivered(id: string, token: string, email: string, how: 'by mail' | 'by hand'): Promise<boolean> {
  /* Never thrown: by the time a letter is marked it has gone, and failing
     the request then revoked a link the person already held (sending
     again) or answered 500 for an invitation that went. Unmarked, the
     invitation still lets its holder in; it only proves nothing. Said in
     the log, by id — never the address or the link. */
  try {
    const [r] = await asAuth(
      (tx) => tx<{ ok: boolean }[]>`select auth_invite_delivered(${hashToken(token)}, ${email}::citext, ${how === 'by hand'}) as ok`,
    )
    if (r?.ok) return true
    console.error(`[invites] invitation ${id} was delivered ${how} but could not be marked so: following it will prove nothing`)
  } catch (e) {
    console.error(`[invites] invitation ${id} was delivered ${how} but marking it failed: following it will prove nothing`, e)
  }
  return false
}

/**
 * Bound to the workspace's own domain by the sign-in role — `auth_invite_bind`,
 * migration 328, which alone may write `mailed_domain` and asks that the
 * domain is the invitation's workspace's and connected. Whether it was.
 */
async function bindTo(token: string, own: { id: string }): Promise<boolean> {
  const [bound] = await asAuth((tx) => tx<{ ok: boolean }[]>`select auth_invite_bind(${hashToken(token)}, ${own.id}::uuid) as ok`)
  return bound?.ok === true
}

/**
 * An invitation to an address, mailed there with its link — what sending
 * one and sending one again both do, once `mayMailInvite` has said yes.
 * Whether it went; once it has, the row says so (`delivered`).
 */
async function mailInvite(
  c: Context,
  ctx: AuthContext,
  inv: { id: string; email: string; project_ids: string[]; ttl_hours: number },
  token: string,
): Promise<boolean> {
  const [who, projects, brand, own] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    async (tx) =>
      [
        (
          await tx<{ name: string; workspace: string }[]>`
        select a.name, w.name as workspace from actor a, workspace w
        where a.id = ${ctx.actorId} and w.id = ${ctx.workspaceId}`
        )[0],
        /* The projects it puts them on, by name — what the invitation is
         for, when it is for a project. Checked above to be the sender's. */
        inv.project_ids.length === 0
          ? []
          : (
              await tx<{ name: string }[]>`
            select name from project
            where workspace_id = ${ctx.workspaceId} and id = any(${inv.project_ids}::uuid[])
              and deleted_at is null
            order by name limit 5`
            )
              .map((r) => oneLine(r.name))
              .filter(Boolean),
        /* The workspace's own name in Tuff's place, where its plan wears
           it. */
        await brandHere(tx, ctx.workspaceId),
        /* Its own domain, connected on a branded plan, read from the row now:
           the invitation is the workspace's letter, and is taken there. */
        edition.hosts ? await edition.hosts.domainOf(tx, ctx.workspaceId) : null,
      ] as const,
  )
  /* Bound to that host before its link leaves this server: taken nowhere
     else, usetuff.com included (migration 328). Not bound, not sent — a
     token on its way to a name somebody else's DNS decides must be good
     only there. */
  if (own) {
    if (!(await bindTo(token, own).catch(() => false))) {
      console.error(`[invites] invitation ${inv.id} could not be bound to its workspace's domain: not sent`)
      return false
    }
  }
  const url = `${own ? `https://${own.hostname}` : origin(c)}/invite/${encodeURIComponent(token)}`
  const days = Math.round(inv.ttl_hours / 24) || 1
  /*
   * Nothing anybody typed in the subject, and the sender's own address
   * beside their name. Both names are whatever the sender wrote, and an
   * invitation is mail from this product to anybody: a workspace named
   * "Your Tuff account is suspended" invited strangers from our address.
   */
  const { email: from } = await emailOf(ctx.actorId)
  /* In the sender's language: whoever it goes to has no account to have
       said one in, and is most likely somebody the sender works with in
       it. */
  const language = await languageFor(ctx.actorId, heard(c))
  const w = say(
    {
      /* A person's note, not an announcement: "You're invited" is how
           a sale opens, and Gmail reads the subject too. */
      subject: ['Invitation to join a workspace on Tuff', 'Invitation à rejoindre un espace de travail sur Tuff'],
      /* A branded workspace's: the same, with nobody's name — the
         workspace's least of all, which is what a stranger would type
         to look like somebody else. */
      subjectBranded: ['Invitation to join a workspace', 'Invitation à rejoindre un espace de travail'],
      someone: ['Someone', 'Quelqu’un'],
      theirs: ['their workspace', 'son espace de travail'],
      invited: [
        (sender: string, ws: string) => `${sender} invited you to join “${ws}” on Tuff.`,
        (sender: string, ws: string) => `${sender} vous invite à rejoindre « ${ws} » sur Tuff.`,
      ],
      invitedBranded: [
        (sender: string, ws: string) => `${sender} invited you to join “${ws}”.`,
        (sender: string, ws: string) => `${sender} vous invite à rejoindre « ${ws} ».`,
      ],
      project: [
        (names: string[]) =>
          names.length === 1
            ? `You’ll have access to the project “${names[0]}”.`
            : `You’ll have access to these projects: ${names.map((n) => `“${n}”`).join(', ')}.`,
        (names: string[]) =>
          names.length === 1
            ? `Vous aurez accès au projet « ${names[0]} ».`
            : `Vous aurez accès à ces projets : ${names.map((n) => `« ${n} »`).join(', ')}.`,
      ],
      expires: [
        (n: number) => `The invitation expires in ${n} ${n === 1 ? 'day' : 'days'}.`,
        (n: number) => `L’invitation expire dans ${n} ${one(n, 'fr') ? 'jour' : 'jours'}.`,
      ],
      join: ['Accept the invitation', 'Accepter l’invitation'],
      /* A branded invitation's foot: the product it was sent with, so a
         letter that opens a password form under a stranger's uploaded logo
         always says whose form it is. */
      sentWith: ['Sent with Tuff.', 'Envoyé avec Tuff.'],
    },
    language,
  )
  const name = oneLine(who?.name ?? '')
  const sender = `${name || w.someone}${from ? ` (${from})` : ''}`
  /*
   * From them, at our address, and answered to them: "Ana via Tuff",
   * the way a shared document's mail is. A styled letter with a button
   * from "Tuff" went to Promotions; a short note with one link
   * from a person is what Primary holds.
   */
  /* Branded: "Ana via Acme", and the letter says the workspace's name
     and not the product's. The address is ours either way. */
  const invited = brand ? w.invitedBranded : w.invited
  const sent = await send({
    to: inv.email,
    subject: brand ? w.subjectBranded : w.subject,
    ...(name ? { fromName: name } : {}),
    /* Never the brand alone: a stranger is mailed by a person, or by
       "Someone", through it. */
    ...(brand ? { via: brand.name, someone: w.someone } : {}),
    ...(from ? { replyTo: from } : {}),
    ...note(
      [invited(sender, oneLine(who?.workspace ?? '') || w.theirs), ...(projects.length > 0 ? [w.project(projects)] : [])],
      { label: w.join, url },
      [w.expires(days), ...(brand ? [w.sentWith] : [])],
      language,
    ),
  })
  if (sent) await delivered(inv.id, token, inv.email, 'by mail')
  return sent
}

/**
 * The invitation, read by somebody signed in.
 *
 * Who they are, so the page can offer to join as them without a password
 * typed again; and whether they are in the workspace already, so a member
 * pressing their own link is shown the way in rather than spending it.
 */
invites.get('/invite/:token', async (c) => {
  const ctx = c.get('ctx')
  const hash = hashToken(c.req.param('token'))
  const [row] = await withoutActor(
    (tx) => tx<{ workspace_name: string; role: string; email: string | null; state: string }[]>`
      select * from preview_invite(${hash})`,
  )
  if (!row || row.state === 'revoked') return c.json({ state: 'invalid' })
  const where = await placed(c, hash, row)
  if (where.state === 'invalid' || 'host' in where) return c.json(where)
  const [seen, me, { email }, brand] = await Promise.all([
    withActor(ctx.actorId, ctx.workspaceId, (tx) => tx<{ workspace_id: string; member: boolean }[]>`select * from invite_for_me(${hash})`),
    withActor(ctx.actorId, ctx.workspaceId, (tx) => tx<{ name: string }[]>`select name from actor where id = ${ctx.actorId}`),
    emailOf(ctx.actorId),
    edition.brands && row.state === 'open' ? withoutActor((tx) => brandOfInvite(tx, hash)) : null,
  ])
  const member = seen[0]?.member === true
  return c.json({
    ...row,
    brand,
    you: { name: me[0]?.name ?? '', email },
    member,
    ...(member ? { workspace_id: seen[0]!.workspace_id } : {}),
  })
})

/**
 * Joining as whoever is signed in: one press, no password. They proved who
 * they are when they signed in, and asking again was the page treating a
 * colleague as a stranger. Never through a token — a tool does not take
 * its person into another company.
 */
/* Named, for a session in no workspace too — `nowhere.ts`. */
export async function joinAsMe(c: Context<{ Variables: Vars }>) {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) {
    return c.json({ error: { code: 'forbidden', message: 'Connected tools can’t join workspaces.' } }, 403)
  }
  /* A press on the invitation's own page: a workspace waiting for this
     person's word (`password-after-proof.md`) is joined by it. */
  const took = await takeInvite(hashToken(c.req.param('token') ?? ''), ctx.actorId, true)
  if (took === 'elsewhere') return c.json(FOR_ANOTHER_ADDRESS, 403)
  if (took === 'on_host') return c.json(ON_HOST, 403)
  /* A session for an address nobody proved — a link with no address,
     followed with somebody's — takes no invitation as that address: */
  if (took === 'unconfirmed') {
    return c.json({ error: { code: 'email_unverified', message: 'Confirm your email first. Check your inbox for the link.' } }, 403)
  }
  if (took === 'full') return c.json(fullRefusal('invited'), 413)
  if (took === 'gone') return c.json({ error: { code: 'not_found', message: 'This link is no longer valid.' } }, 404)
  return c.json(
    await startSession(
      ctx.actorId,
      took.workspaceId,
      { ...metaOf(c), host: ctx.host ?? metaOf(c).host, since: ctx.checkedAt ?? null },
      'invite',
    ),
  )
}
invites.post('/invite/:token/join', joinAsMe)

/**
 * The two public routes. Whoever follows an invite link has no account yet, so
 * these sit with the other bootstrap routes and carry no authentication.
 */
export const publicInvites = new Hono()

const ALREADY_HERE = {
  error: { code: 'unauthorized', message: 'That email already has an account. Use its password to join.' },
}

publicInvites.get('/invite/:token', async (c) => {
  const [row] = await withoutActor(async (tx) => {
    return tx<
      { workspace_name: string; role: string; email: string | null; state: string }[]
    >`select * from preview_invite(${hashToken(c.req.param('token'))})`
  })
  // A wrong token and a revoked one look the same from outside: whether a
  // workspace exists is not something a stranger should be able to probe.
  if (!row || row.state === 'revoked') {
    return c.json({ state: 'invalid' })
  }
  /* Mailed to a workspace's own domain: the host to go to, or nothing. */
  const where = await placed(c, hashToken(c.req.param('token')), row)
  if (where.state === 'invalid') return c.json(where)
  /* The workspace's own mark above "Join", where its plan wears it. */
  const brand =
    edition.brands && row.state === 'open' ? await withoutActor((tx) => brandOfInvite(tx, hashToken(c.req.param('token')))) : null
  return c.json({ ...where, brand })
})

publicInvites.post('/invite/:token/accept', async (c) => {
  /* Through a workspace's own domain: never a password, and always the
     host's code — decided by the edition. A host is only ever set
     by the edition that has hosts. */
  const host = hostOf(c)
  if (host) {
    return edition.hosts ? edition.hosts.acceptInvite(c, host, c.req.param('token')) : c.json({ error: { code: 'not_found' } }, 404)
  }
  const body = z
    .object({
      name: z.string().min(1).max(200),
      email: z.email(),
      password: z.string().min(1),
      totp: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'validation_failed' } }, 400)

  /*
   * The invitation first, before any password is looked at.
   *
   * The password of an existing account was checked before the link was,
   * so any string in the address — no invitation at all — made this a way
   * to try somebody's password with none of the ceiling signing in has,
   * and the answers told a right one from a wrong one. A link that is not
   * open is said to be so here, whatever else was sent.
   */
  const [open] = await withoutActor((tx) => tx<{ state: string }[]>`select state from preview_invite(${hashToken(c.req.param('token'))})`)
  if (open?.state !== 'open') {
    return c.json({ error: { code: 'not_found', message: 'This link is no longer valid.' } }, 404)
  }
  /* And before any password too: one mailed to a workspace's own domain is
     taken there, never here. `accept_invite` refuses it as well. */
  const where = await placed(c, hashToken(c.req.param('token')), open)
  if (where.state !== 'open' || 'host' in where) return c.json(ON_HOST, 403)

  /*
   * An email that already has an account joins as that account — and only
   * with that account's password, and its second factor when it has one.
   *
   * It did not ask. `accept_invite` attached the invitation to whoever owned
   * the email and the session that came back was theirs, so anybody holding
   * an invite link could type somebody else's address and be signed in as
   * them.
   */
  const existing = await asAuth(async (tx) => {
    const [r] = await tx<{ actor_id: string }[]>`select actor_id from auth_lookup_user(${body.data.email})`
    return r ?? null
  })
  /* Before an existing account's password is read: the session is dated
     from here, as signing in's is (`Meta.since`). */
  const since = existing ? await checkedNow() : null
  if (existing) {
    /* The same ceilings as signing in, counted on the same keys. */
    const tried = await guess(body.data.email, c)
    if (!tried.ok) {
      return c.json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } }, 429)
    }
    const who = await credentials(body.data)
    if (who === 'totp_required') {
      if (!body.data.totp) await tried.right()
      return c.json({ error: { code: 'totp_required', message: 'Enter the code from your authenticator app.' } }, 401)
    }
    if (who !== existing.actor_id) return c.json(ALREADY_HERE, 401)
    await tried.right()
    /* And confirmed, as signing in asks: an address nobody has confirmed is
       sent its letter and waits for it, invitation or not. Confirming takes
       the password just checked (migration 212), so the letter asks for one. */
    if (!(await confirmed(existing.actor_id))) {
      await sendChoosePassword(c, existing.actor_id, body.data.email.toLowerCase())
      return c.json({ error: { code: 'email_unverified', message: 'Confirm your email first. Check your inbox for the link.' } }, 403)
    }
  } else if (body.data.password.length < 12) {
    return c.json({ error: { code: 'validation_failed', message: 'Your password needs at least 12 characters.' } }, 400)
  }

  const passwordHash = await hashPassword(body.data.password)
  let row: { workspace_id: string; actor_id: string; created_account: boolean } | undefined
  try {
    ;[row] = await asAuth(async (tx) => {
      return tx<{ workspace_id: string; actor_id: string; created_account: boolean }[]>`
        select * from accept_invite(
          ${hashToken(c.req.param('token'))}::text, ${uuidv7()}::uuid,
          ${body.data.name}::text, ${body.data.email}::citext, ${passwordHash}::text,
          ${!existing}::boolean,
          -- Join pressed beside the account's own password and code: the
          -- person's word about a workspace that waits for it (315).
          ${Boolean(existing)}::boolean)`
    })
  } catch (e) {
    /*
     * The workspace filled up between the invitation and the link being
     * followed, which is the case the check in the endpoint above cannot
     * cover.
     *
     * The invite is not spent: the function puts `used_at` back, so once
     * the owner makes room the same link works rather than having to be
     * issued again.
     *
     * Only on that one error. A bare catch here would tell somebody their
     * invitation is to a full workspace when the real fault was anything
     * else, and they have no account yet and no way to report it.
     */
    /* A link handed over by hand, taken with another address — given back
       unspent, for the person it names (migration 210). */
    if (isForAnotherAddress(e)) return c.json(FOR_ANOTHER_ADDRESS, 403)
    /* Mailed to a workspace's own domain, and taken only there (328). Given back unspent. */
    if ((e as { message?: string }).message?.includes('invite_on_host')) return c.json(ON_HOST, 403)
    /* No account when we looked, one by the time the invitation was taken
       — a sign-up racing this request. The invitation is given back and no
       session is made: nobody checked a password for that account. Said as
       an address with an account is said above. */
    if ((e as { code?: string }).code === '23505' || (e as { message?: string }).message?.includes('account_exists')) {
      return c.json(ALREADY_HERE, 401)
    }
    if ((e as { message?: string }).message?.includes('workspace_full')) return c.json(fullRefusal('invited'), 413)
    throw e
  }

  // Spent, expired or unknown — the function claims the invite and returns
  // nothing if it could not, so there is no separate check to race against.
  if (!row) return c.json({ error: { code: 'not_found', message: 'This link is no longer valid.' } }, 404)
  /* `accept_invite` refuses this itself (`p_must_be_new`); asked again here
     because a session handed to an account nobody checked is the hole. */
  if (!existing && !row.created_account) return c.json(ALREADY_HERE, 401)
  await tellInviter(row.workspace_id, row.actor_id)

  /*
   * A new account is confirmed only when the server delivered the
   * invitation to the address it was made with — mailed it there, or
   * handed it over for it where there is no mail (weakly) — which the
   * sign-in role alone writes on the row (`delivered`, migration 313); an
   * address on an invitation is otherwise only what its writer typed.
   * `accept_invite` decided it as the account was written, and this asks
   * the same. Otherwise a letter goes to the address, and signing in
   * by password waits for it — the holder of a link handed round is let
   * into the workspace now, but the address they typed is not yet known to
   * be theirs.
   *
   * The password typed here is not the account's way in until then: signing
   * in with it only says to confirm, and confirming takes it (migration
   * 212) — so a password typed for somebody else's address never survives
   * its owner's confirmation. The letter is the one that asks for a
   * password.
   */
  if (row.created_account) {
    const [ok] = await asAuth(
      (tx) => tx<{ yes: boolean }[]>`select auth_confirm_if_invited(${row!.actor_id}, ${hashToken(c.req.param('token'))}) as yes`,
    )
    if (!ok?.yes) await sendChoosePassword(c, row.actor_id, body.data.email.toLowerCase())
  }
  const session: Session = await startSession(row.actor_id, row.workspace_id, { ...metaOf(c), since }, 'invite')
  return c.json({ ...session, created_account: row.created_account })
})
