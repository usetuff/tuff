import { Hono } from 'hono'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { asAuthActor, withActor, withoutActor } from '../db.js'
import { allow, type AuthContext } from '../auth/context.js'
import { generateToken } from '../auth/crypto.js'
import { issueApiToken } from '../auth/flows.js'
import { publicHttps } from '../outbound.js'
import { seal } from '../auth/seal.js'
import { ROUTINE_URL } from '../webhooks.js'
import { badKey, hostOf, keyChange, keyOf } from './webhooks.js'
import { PRESET, faced, put } from '../storage.js'
import { rasterOf } from './files.js'
import { AgentFacePick } from '@tracker/shared-schema'
import { record } from './activity.js'
import { spendOn } from './limits.js'
import { publish } from '../realtime.js'
import { cleanDoing, inRoom, liveStatuses, sayDoing, statusByAgent, stopDoing } from '../doing.js'

type Vars = { ctx: AuthContext }

/**
 * Agents in the workspace.
 *
 * Connected by the owner or a member the owner lets, into projects they are
 * on, with no more than their rights there; disconnected by the owner or
 * whoever connected it. Never through a token: an agent does not connect
 * another agent.
 */
export const agents = new Hono<{ Variables: Vars }>()

const forbidden = { error: { code: 'forbidden' } }
const notTheirs = { error: { code: 'not_found', message: 'Choose projects you are on.' } }
/** What an agent holds on a project at most: making tasks and changing them. */
const AGENT_RIGHTS = ['task.create', 'edit.any']
const badRoutine = {
  error: {
    code: 'invalid',
    message: 'A routine’s URL is https://api.anthropic.com/v1/claude_code/routines/…/fire.',
  },
} as const
const routineNeedsToken = { error: { code: 'invalid', message: 'A Claude Code routine needs its token.' } } as const
/** An agent's own token lives a year; disconnecting it is the way to end it sooner. */
const TOKEN_DAYS = 365

agents.get('/agents', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'people.read') || ctx.agent) return c.json(forbidden, 403)
  /* Whether the reader may put anybody on a project at all; where, per
     agent, is asked below. */
  const adds = allow(ctx, 'project.member.add')
  /* With what each says it is doing now. */
  const [rows, doing] = await withActor(ctx.actorId, ctx.workspaceId, (tx) =>
    Promise.all([
      tx<
        {
          actor_id: string
          name: string
          avatar_key: string | null
          reach: string
          created_by: string
          created_by_name: string
          created_at: Date
          project_ids: string[]
          offered_project_ids: string[]
          active_at: Date | null
          authorization_set: boolean | null
          webhook_shape: string | null
          webhook_url: string | null
          webhook_stopped: boolean | null
          connections: { id: string; client: string; created_at: string; linked_by_name: string }[]
          stopped: boolean
        }[]
      >`
      select g.actor_id, a.name, a.avatar_key, g.reach, g.created_by, b.name as created_by_name, g.created_at,
             /* Stopped when whoever connected it was put out of the account:
                its tokens revoked, its webhook off; a new token starts it
                again. */
             g.stopped_at is not null as stopped,
             coalesce((select array_agg(pm.project_id order by pm.project_id) from project_member pm
                       where pm.actor_id = g.actor_id and pm.deleted_at is null), '{}') as project_ids,
             /* Where the reader could put it: a live project they are on,
                that its connector is on (any, when the owner connected
                it), and that it is not on yet — what
                POST /projects/:id/members would take. */
             case when ${adds} then coalesce((
               select array_agg(p.id order by p.name) from project p
               where p.workspace_id = ${ctx.workspaceId} and p.deleted_at is null and p.archived_at is null
                 and in_project(p.id)
                 and (exists (select 1 from membership o where o.workspace_id = g.workspace_id
                                and o.actor_id = g.created_by and o.role = 'owner' and o.deleted_at is null)
                      or exists (select 1 from project_member c where c.project_id = p.id
                                   and c.actor_id = g.created_by and c.deleted_at is null))
                 and not exists (select 1 from project_member pm where pm.project_id = p.id
                                   and pm.actor_id = g.actor_id and pm.deleted_at is null)), '{}')
             else '{}'::uuid[] end as offered_project_ids,
             h.active_at,
             /* Whether its webhook holds the receiver's key, and how it is
                sent — to whoever manages it; null to anybody else. */
             k.authorization_set, k.shape as webhook_shape, k.url as webhook_url,
             /* Turned off when whoever connected it was put out of the account:
                its address then is not said, and only its reach set again
                sends anything (agent_reach, migration 317). */
             k.stopped as webhook_stopped,
             /* Tuff's connector signed in as it — to whoever manages it;
                none to anybody else (agent_oauth_connections). */
             (select coalesce(json_agg(json_build_object('id', o.id, 'client', o.client, 'created_at', o.created_at,
                                                         'linked_by_name', o.linked_by_name)), '[]')
              from agent_oauth_connections(g.actor_id) o) as connections
      from agent g
      join actor a on a.id = g.actor_id
      join actor b on b.id = g.created_by
      left join agents_last_here() h on h.actor_id = g.actor_id
      left join lateral (select * from agent_webhook_said(g.actor_id)) k
        on g.reach = 'webhook'
      where g.workspace_id = ${ctx.workspaceId} and g.deleted_at is null
      order by a.name`,
      statusByAgent(tx),
    ]),
  )
  return c.json({
    agents: rows.map((r) => {
      /* Its face, name, token and reach are its connector's alone
         (`agent.manage`); taking it away is the owner's too (`agent.remove`). */
      const manage = allow(ctx, 'agent.manage', { connectedIt: r.created_by === ctx.actorId })
      const remove = allow(ctx, 'agent.remove', { connectedIt: r.created_by === ctx.actorId })
      const { authorization_set, webhook_shape, webhook_url, webhook_stopped, connections, ...rest } = r
      return {
        ...faced(rest),
        ...(manage && authorization_set !== null ? { authorization_set } : {}),
        ...(manage && webhook_shape !== null ? { webhook_shape } : {}),
        /* Where it is sent, so its page can change it — migration 268. */
        ...(manage && webhook_url !== null ? { webhook_url } : {}),
        ...(manage && webhook_stopped ? { webhook_stopped: true } : {}),
        /* What was signed in as it, to whoever may end it. */
        ...(remove
          ? {
              connections: connections.map((o) => ({
                id: o.id,
                client: o.client,
                created_at: new Date(o.created_at).toISOString(),
                linked_by_name: o.linked_by_name,
              })),
            }
          : {}),
        created_at: r.created_at.toISOString(),
        active_at: r.active_at ? r.active_at.toISOString() : null,
        can_disconnect: remove,
        can_manage: manage,
        status: doing.get(r.actor_id) ?? null,
      }
    }),
  })
})

const Connect = z.discriminatedUnion('reach', [
  z.object({
    name: z.string().trim().min(1).max(60),
    project_ids: z.array(z.uuid()).min(1).max(50),
    reach: z.literal('webhook'),
    url: z.url().max(2000),
    /* How it is sent: Tuff's signed JSON, or a Claude Code routine's
       trigger. */
    shape: z.enum(['tuff', 'claude_routine']).default('tuff'),
    /* The receiver's own key, read by `keyOf`. */
    authorization: z.unknown().optional(),
  }),
  /* Through MCP alone: it comes for its tasks with its token, from where it
     works. Nothing to give but the projects. */
  z.object({
    name: z.string().trim().min(1).max(60),
    project_ids: z.array(z.uuid()).min(1).max(50),
    reach: z.literal('mcp'),
  }),
])

/**
 * Connecting one. Answers, once, the token it reads and writes with through
 * MCP and the secret its webhook is signed with; after this only their
 * hashes are kept, as for a person's token and a webhook's secret.
 */
agents.post('/agents', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json(forbidden, 403)
  if (!allow(ctx, 'agent.connect')) {
    return c.json({ error: { code: 'forbidden', message: 'Only the owner, or somebody the owner allows, can connect an agent.' } }, 403)
  }
  const raw = await c.req.json().catch(() => ({}))
  const body = Connect.safeParse(raw)
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const url = body.data.reach === 'webhook' ? body.data.url : null
  const shape = body.data.reach === 'webhook' ? body.data.shape : null
  const keyed = body.data.reach === 'webhook' ? keyOf(raw) : undefined
  if (keyed === 'invalid') return c.json(badKey, 400)
  if (shape === 'claude_routine') {
    /* Anthropic's address and nothing else, and its token: a routine is
       fired with both or not at all. Its host is fixed by the pattern, so
       it is not looked up here; `outward` still checks it at the socket. */
    if (!url || !ROUTINE_URL.test(url)) return c.json(badRoutine, 400)
    if (!keyed) return c.json(routineNeedsToken, 400)
  } else if (url !== null && !(await publicHttps(url))) {
    return c.json({ error: { code: 'invalid', message: 'An agent’s webhook needs a public https URL.' } }, 400)
  }
  const projects = [...new Set(body.data.project_ids)]
  const id = uuidv7()
  const secret = url === null ? null : generateToken('whs')
  const made = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`
      select agent_connect(${id}, ${body.data.name}, ${projects}::uuid[], ${body.data.reach}, ${AGENT_RIGHTS}::text[],
                           ${url}, ${secret}) as ok`
    if (!r?.ok) return false
    if (shape === 'claude_routine') await tx`select agent_webhook_shape(${id}, ${shape})`
    if (keyed) await tx`select * from agent_webhook_authorization(${id}, ${seal('webhook', keyed)})`
    /* Whether it holds the receiver's key, never the key. */
    await record(tx, ctx, 'agent.connect', {
      meta: {
        agent_id: id,
        name: body.data.name,
        ...(shape === 'claude_routine' ? { shape } : {}),
        ...(keyed ? { authorization: 'set' } : {}),
      },
    })
    return true
  })
  /* The same answer for a project somebody is not on as for one that is not
     there: which projects exist is not this endpoint's to tell. */
  if (!made) return c.json(notTheirs, 404)
  /* No list on its token: what an agent reaches is its places, which its
     page changes after this. A list here
     would now bound it to the projects it was born with — migration 191. */
  const token = await issueApiToken(id, ctx.workspaceId, body.data.name, [], TOKEN_DAYS, ctx.checkedAt ?? null)
  return c.json({ agent_id: id, token, ...(secret ? { secret } : {}) }, 201)
})

agents.delete('/agents/:id', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json(forbidden, 403)
  const id = c.req.param('id')
  /* Asked of `can()` first, and again on the row by `agent_disconnect`.
     Not this one's to end is said as not there, as it always was. */
  if ((await mayManage(ctx, id, 'agent.remove')) !== 'yes') return c.json({ error: { code: 'not_found' } }, 404)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`select agent_disconnect(${id}) as ok`
    if (!r?.ok) return false
    await record(tx, ctx, 'agent.disconnect', { meta: { agent_id: id } })
    return true
  })
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/**
 * Renaming one. Whoever manages it, in a
 * session of their own; `agent_rename` asks the same again on the row.
 */
agents.patch('/agents/:id', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json(forbidden, 403)
  const id = c.req.param('id')
  const may = await mayManage(ctx, id)
  if (may === 'gone') return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  const raw = await c.req.json().catch(() => null)
  /* Its webhook's key: a string sets or replaces
     it, null takes it off, absent leaves it. */
  const keyed = keyOf(raw)
  if (keyed === 'invalid') return c.json(badKey, 400)
  const named = raw && typeof raw === 'object' && 'name' in raw
  if (!named && keyed === undefined) return c.json({ error: { code: 'invalid', message: 'Give it a name.' } }, 400)
  const body = z.object({ name: z.string().trim().min(1).max(60).optional() }).safeParse(raw)
  if (!body.success || (named && body.data.name === undefined)) {
    return c.json({ error: { code: 'invalid', message: 'Give it a name.' } }, 400)
  }
  const name = body.data.name
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (keyed !== undefined) {
      const [hook] = await tx<{ shape: string }[]>`select shape from agent_webhook_said(${id})`
      if (!hook) return 'no_webhook' as const
      if (keyed === null && hook.shape === 'claude_routine') return 'routine' as const
      const [h] = await tx<{ id: string; url: string; had: boolean }[]>`
        select * from agent_webhook_authorization(${id}, ${keyed === null ? null : seal('webhook', keyed)})`
      if (!h) return 'no_webhook' as const
      const change = keyChange(h.had, keyed)
      /* In the audit log as a webhook changed, by its host, saying what
         happened to the key and never what it is. */
      if (change) await record(tx, ctx, 'webhook.update', { meta: { id: h.id, host: hostOf(h.url), agent_id: id, authorization: change } })
    }
    if (name !== undefined) {
      const [was] = await tx<{ name: string }[]>`select name from actor where id = ${id}`
      const [r] = await tx<{ ok: boolean }[]>`select agent_rename(${id}, ${name}) as ok`
      if (!r?.ok) return false
      if (was && was.name !== name) {
        await record(tx, ctx, 'agent.rename', { meta: { agent_id: id, was: was.name, renamed: name } })
      }
    }
    return true
  })
  if (done === 'no_webhook') return c.json({ error: { code: 'invalid', message: 'This agent has no webhook.' } }, 400)
  if (done === 'routine') return c.json(routineNeedsToken, 400)
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/** How a reach change is asked: MCP, or a webhook at an address in a shape. */
const Reach = z.discriminatedUnion('reach', [
  z.object({ reach: z.literal('mcp') }),
  z.object({
    reach: z.literal('webhook'),
    url: z.url().max(2000),
    shape: z.enum(['tuff', 'claude_routine']).default('tuff'),
    authorization: z.unknown().optional(),
  }),
])
/** Rolls the change back when a routine would be left without its token. */
class NoRoutineToken extends Error {}
/** What the audit line calls a reach: the shape stands for a webhook's. */
const reachName = (reach: string, shape: string | null) => (reach === 'webhook' ? (shape ?? 'tuff') : reach)

/**
 * How it is reached, changed after connecting.
 * MCP, a webhook or a Claude Code routine, and the
 * address. Whoever manages it, from a signed-in session of their own, as
 * connecting is: a token that could point an agent's deliveries somewhere
 * else could send its work anywhere.
 *
 * The address takes the same checks as at connecting. A new address or a
 * new shape takes the stored key off (`agent_reach`, migration 268) before
 * any key given here is set; a routine must end with one. A webhook made
 * here, or moved, is signed with a new secret, answered once, and what was
 * queued for the old receiver is not sent to the new one.
 */
agents.put('/agents/:id/reach', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json(forbidden, 403)
  const id = c.req.param('id')
  const may = await mayManage(ctx, id)
  if (may === 'gone') return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  const raw = await c.req.json().catch(() => ({}))
  const body = Reach.safeParse(raw)
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const url = body.data.reach === 'webhook' ? body.data.url : null
  const shape = body.data.reach === 'webhook' ? body.data.shape : null
  const keyed = body.data.reach === 'webhook' ? keyOf(raw) : undefined
  if (keyed === 'invalid') return c.json(badKey, 400)
  if (shape === 'claude_routine') {
    if (!url || !ROUTINE_URL.test(url)) return c.json(badRoutine, 400)
  } else if (url !== null && !(await publicHttps(url))) {
    return c.json({ error: { code: 'invalid', message: 'An agent’s webhook needs a public https URL.' } }, 400)
  }
  /* Made whether or not it is needed: kept only by a webhook made here or
     moved to a new address or shape (`agent_reach`, migration 268). */
  const secret = url === null ? null : generateToken('whs')
  try {
    const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      const [r] = await tx<
        {
          was_reach: string
          was_url: string | null
          was_shape: string | null
          had_key: boolean
          cleared: boolean
          hook_id: string | null
          new_secret: boolean
        }[]
      >`select * from agent_reach(${id}, ${body.data.reach}, ${url}, ${shape}, ${secret})`
      if (!r) return null
      /* What the key is after the change, before anything given here. */
      const kept = r.had_key && !r.cleared && body.data.reach === 'webhook'
      if (keyed !== undefined && r.hook_id) {
        await tx`select * from agent_webhook_authorization(${id}, ${keyed === null ? null : seal('webhook', keyed)})`
      }
      const holds = typeof keyed === 'string' || (kept && keyed !== null)
      if (shape === 'claude_routine' && !holds) throw new NoRoutineToken()
      const was = reachName(r.was_reach, r.was_shape)
      const now = reachName(body.data.reach, shape)
      const moved = was !== now || (url !== null && url !== r.was_url)
      const key =
        r.had_key && (r.cleared || keyed === null)
          ? typeof keyed === 'string'
            ? 'changed'
            : 'removed'
          : typeof keyed === 'string'
            ? kept
              ? 'changed'
              : 'set'
            : null
      /* By its host and what happened to the key, never the address's
         path, which can carry a receiver's secret, nor the key. */
      if (moved || key) {
        const [a] = await tx<{ name: string }[]>`select name from actor where id = ${id}`
        await record(tx, ctx, 'agent.reach', {
          meta: {
            agent_id: id,
            name: a?.name ?? '',
            was,
            reach: now,
            ...(r.was_url && was !== 'mcp' ? { was_host: hostOf(r.was_url) } : {}),
            ...(url ? { host: hostOf(url) } : {}),
            ...(key ? { authorization: key } : {}),
          },
        })
      }
      /* A new secret is said once, for a webhook Tuff signs; a routine
         is not signed, so it has none to show. */
      return { rekeyed: r.new_secret && shape === 'tuff', cleared: r.cleared }
    })
    if (!done) return c.json({ error: { code: 'not_found' } }, 404)
    return c.json({
      ok: true,
      authorization_cleared: done.cleared,
      ...(done.rekeyed && secret ? { secret } : {}),
    })
  } catch (e) {
    if (e instanceof NoRoutineToken) return c.json(routineNeedsToken, 400)
    throw e
  }
})

/**
 * A new token, the old one ended in the same press.
 * Shown once, as at connecting: after this only its hash is kept. For a
 * token that leaked, or a setup lost; the agent keeps its places, its
 * tasks and its webhook.
 */
agents.post('/agents/:id/token', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json(forbidden, 403)
  const id = c.req.param('id')
  const may = await mayManage(ctx, id)
  if (may === 'gone') return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  /* On the sign-in connection: ending tokens is `tracker_auth`'s (migration 308). */
  const name = await asAuthActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`select agent_end_tokens(${id}) as ok`
    if (!r?.ok) return null
    const [a] = await tx<{ name: string }[]>`select name from actor where id = ${id}`
    await record(tx, ctx, 'agent.token', { meta: { agent_id: id } })
    return a?.name ?? 'Agent'
  })
  if (name === null) return c.json({ error: { code: 'not_found' } }, 404)
  const token = await issueApiToken(id, ctx.workspaceId, name, [], TOKEN_DAYS, ctx.checkedAt ?? null)
  return c.json({ token }, 201)
})

/**
 * One connection Tuff's connector made as this agent, ended — its tokens
 * and its refresh.
 * The agent's other tokens and connections stay.
 */
agents.delete('/agents/:id/connections/:grant', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp || !ctx.sessionId) return c.json(forbidden, 403)
  const id = c.req.param('id')
  const grant = c.req.param('grant')
  const may = await mayManage(ctx, id, 'agent.remove')
  if (may === 'gone' || !z.uuid().safeParse(grant).success) return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  const client = await asAuthActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ client: string | null }[]>`select agent_oauth_end(${id}, ${grant}) as client`
    return r?.client ?? null
  })
  if (client === null) return c.json({ error: { code: 'not_found' } }, 404)
  await withoutActor(
    (tx) => tx`
      insert into security_event (id, workspace_id, actor_id, kind, meta)
      values (${uuidv7()}, ${ctx.workspaceId}, ${ctx.actorId}, 'agent_unlinked',
              ${tx.json({ actor_id: id, agent_id: id, client } as never)})`,
  )
  return c.json({ ok: true })
})

/**
 * Whether the one asking may do this to this agent, decided in `can()`:
 * `agent.manage` — its face, its name, its token, its reach — is whoever
 * connected it; `agent.remove` — disconnecting it, ending a connection made
 * as it — is the owner too. `gone` for an agent not in this workspace.
 */
export async function mayManage(
  ctx: AuthContext,
  id: string,
  action: 'agent.manage' | 'agent.remove' = 'agent.manage',
): Promise<'gone' | 'no' | 'yes'> {
  if (!z.uuid().safeParse(id).success) return 'gone'
  const [g] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx<{ created_by: string }[]>`
    select created_by from agent where actor_id = ${id} and workspace_id = ${ctx.workspaceId} and deleted_at is null`,
  )
  if (!g) return 'gone'
  return allow(ctx, action, { connectedIt: g.created_by === ctx.actorId }) ? 'yes' : 'no'
}

/**
 * An agent's face. A person's own picture
 * (`/api/me/avatar`, `docs/specs/avatar.md`) with its limits, set by
 * whoever manages the agent. The row is written by `agent_face`, which
 * asks the same again: the actor table lets a person write only their own.
 */
agents.post('/agents/:id/avatar', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const may = await mayManage(ctx, id)
  if (may === 'gone') return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  /* The person's allowance, shared with their own picture: the bytes a
     changed picture leaves go an hour later. */
  if (!(await spendOn(`picture:${ctx.actorId}`, 30, 3600))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many picture uploads. Try again later.' } }, 429)
  }
  const form = await c.req.formData().catch(() => null)
  const picked = form?.get('file')
  if (!(picked instanceof File)) return c.json({ error: { code: 'invalid' } }, 400)
  if (picked.size > 2 * 1024 * 1024) {
    return c.json({ error: { code: 'too_large', message: 'Images can be up to 2 MB.' } }, 413)
  }
  /* By its bytes, never the type the form says (`rasterOf`). */
  const bytes = new Uint8Array(await picked.arrayBuffer())
  const type = rasterOf(bytes)
  if (!type) return c.json({ error: { code: 'invalid', message: 'Use a PNG, JPEG, GIF or WebP image.' } }, 400)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const stored = await put(ctx.workspaceId, bytes, type)
    const [r] = await tx<{ ok: boolean }[]>`select agent_face(${id}, ${stored.key}) as ok`
    return r?.ok === true
  })
  /* Not recorded, as a person's face is not. */
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/**
 * One of the premade faces. The same
 * allowance as a picture, and no bytes: the key is `preset:<id>`, and only
 * the ids the product draws are taken.
 */
agents.put('/agents/:id/avatar', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const may = await mayManage(ctx, id)
  if (may === 'gone') return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  if (!(await spendOn(`picture:${ctx.actorId}`, 30, 3600))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many picture uploads. Try again later.' } }, 429)
  }
  const body = AgentFacePick.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: { code: 'invalid', message: 'Pick one of the faces.' } }, 400)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`select agent_face(${id}, ${PRESET + body.data.preset}) as ok`
    return r?.ok === true
  })
  /* Not recorded, as a picture is not. */
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/** Back to its letters. */
agents.delete('/agents/:id/avatar', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const may = await mayManage(ctx, id)
  if (may === 'gone') return c.json({ error: { code: 'not_found' } }, 404)
  if (may === 'no') return c.json(forbidden, 403)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`select agent_face(${id}, null) as ok`
    return r?.ok === true
  })
  return done ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404)
})

/**
 * What an agent says it is doing now. The
 * caller's own and nobody else's: only an agent (`agent.status`), and the
 * row's policy holds it to the caller besides. `doing: null` takes it away.
 * The task must be one it can see, as any read of it would be.
 */
const Say = z.object({
  task_id: z.uuid().nullable().optional(),
  /* The room it is said for, and the thread in it: the room
     says "Grok · reading the triage…" under its line while it lasts. */
  conversation_id: z.uuid().nullable().optional(),
  thread_id: z.uuid().nullable().optional(),
  /* Long enough to be cleaned and cut rather than refused: an agent that
     says too much is cut to 120, not turned away mid-work. */
  doing: z.string().max(2000).nullable(),
})
agents.put('/me/status', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'agent.status')) return c.json(forbidden, 403)
  const body = Say.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const doing = body.data.doing === null ? null : cleanDoing(body.data.doing)
  if (doing === '') return c.json({ error: { code: 'invalid', message: 'Say what you are doing, or null to stop.' } }, 400)
  const taskId = body.data.task_id ?? null
  const room = body.data.conversation_id ?? null
  /* A thread is in a room; named alone it is refused, not guessed. */
  if (!room && body.data.thread_id) return c.json({ error: { code: 'invalid', message: 'A thread needs its conversation_id.' } }, 400)
  const thread = room ? (body.data.thread_id ?? null) : null
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (doing === null) {
      const { tell, rooms } = await stopDoing(tx, ctx.actorId)
      for (const p of tell) await publish(`project:${p}`, 'agent.status', { agent_id: ctx.actorId, task_id: null }, tx)
      for (const r of rooms) await publish(`conversation:${r}`, 'agent.working', { conversation_id: r, agent_id: ctx.actorId }, tx)
      return { status: null }
    }
    if (taskId) {
      const [seen] = await tx`select 1 from task where id = ${taskId} and deleted_at is null`
      if (!seen) return null
    }
    /* The room as any read of it would be: one it cannot open is not there.
       And the thread one of its messages, a thread's head. */
    if (room) {
      const [seen] = await tx<{ ok: boolean }[]>`select can_see_conversation(${room}) as ok`
      if (!seen?.ok) return null
      if (thread) {
        const [head] = await tx`
          select 1 from message where id = ${thread} and conversation_id = ${room} and parent_id is null and deleted_at is null`
        if (!head) return null
      }
    }
    const { status, tell, rooms } = await sayDoing(tx, ctx.actorId, ctx.workspaceId, { task: taskId, room, thread }, doing)
    /* The task's id only to the project it is in: a move from A to B tells
       A too, and B's task is nothing A may know exists. */
    for (const p of tell)
      await publish(`project:${p}`, 'agent.status', { agent_id: ctx.actorId, task_id: p === status?.project_id ? taskId : null }, tx)
    /* And a room's only on the room's own topic — never the project's, so a
       chosen room's people alone hear that anything is happening there. */
    for (const r of rooms) await publish(`conversation:${r}`, 'agent.working', { conversation_id: r, agent_id: ctx.actorId }, tx)
    return { status }
  })
  if (!done) return c.json({ error: { code: 'not_found' } }, 404)
  return c.json(done)
})

/**
 * The live statuses the reader may see, in one short answer — what a screen
 * asks again when its project's socket says one changed, instead of the
 * whole roster.
 */
agents.get('/working', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'people.read')) return c.json(forbidden, 403)
  const working = await withActor(ctx.actorId, ctx.workspaceId, (tx) => liveStatuses(tx))
  return c.json({ working })
})

/**
 * The agents at work in one room — woken there for a message, or saying
 * they are. What the room
 * reads again when its socket says `agent.working`. A room the reader
 * cannot open is not there.
 */
agents.get('/conversations/:id/working', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  if (!z.uuid().safeParse(id).success) return c.json({ error: { code: 'not_found' } }, 404)
  const working = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [seen] = await tx<{ ok: boolean }[]>`select can_see_conversation(${id}) as ok`
    return seen?.ok ? inRoom(tx, id) : null
  })
  if (!working) return c.json({ error: { code: 'not_found' } }, 404)
  return c.json({ working })
})
