import { bounded, withActor } from './db.js'
import type { AuthContext } from './auth/context.js'

/*
 * What a socket may listen to. Apart from the
 * server that holds the sockets so it can be asked without one.
 */

/**
 * The same predicate the HTTP read uses, asked of the database.
 *
 * A socket must not be able to listen to a room the person could not open over
 * HTTP, and the way to guarantee that is to ask the same function rather than
 * to reimplement the rule here.
 */
export async function mayListen(ctx: AuthContext, conversationId: string): Promise<boolean> {
  /* Bounded as the request would be: a token made for some projects does
     not listen to a room it could not open. */
  return bounded(ctx, () =>
    withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      const rows = await tx<{ ok: boolean }[]>`
      select can_see_conversation(${conversationId}) as ok`
      return rows[0]?.ok === true
    }),
  )
}

/**
 * Row-level security answers this one: a project you cannot read is a project
 * that does not come back, so an empty result is the refusal.
 */
export async function mayWatch(ctx: AuthContext, projectId: string): Promise<boolean> {
  return bounded(ctx, () =>
    withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      const rows = await tx<{ id: string }[]>`
      select id from project where id = ${projectId} and deleted_at is null`
      return rows.length > 0
    }),
  )
}

/*
 * The kinds of thing a note can be about that are each kept in a table of
 * that name, for asking whether one is in the token's workspace.
 */
const HOMES = new Set(['task', 'post', 'file', 'message', 'conversation', 'project'])

/**
 * Whether a session made on a workspace's own domain hears one word on
 * `/ws/me`: only a word said in its own workspace. Its person is in others,
 * which a session bound to this one is never in (the eighth audit); a plain session hears them all, being the person. By
 * the word's `workspace_id`, which every word on the topic carries: no
 * question of the database per word. Within its workspace it hears what
 * the person would — a host's session is the person there, not a token.
 */
export function hostHears(ctx: AuthContext, e: { kind: string; payload: unknown }): boolean {
  return ((e.payload ?? {}) as { workspace_id?: unknown }).workspace_id === ctx.workspaceId
}

/**
 * Whether a token hears one word on `/ws/me`.
 * Every token, not only one made for some projects: the topic is the
 * person's, and the person is in other workspaces the token was not made
 * for (the night audit, 4). The words are
 * ids, not rows, but which rooms elsewhere are busy is not its to hear.
 * Each is asked of the database as the request would be: the room, the
 * note, or what a note is about — in this workspace, and inside the
 * token's projects when it has some. A word it cannot place is left out.
 *
 * Every word on the topic says the workspace it was said in, and one from
 * another is refused before anything is asked: "X joined" was heard by a
 * token of A when X, a member of A, joined B.
 */
export async function tokenHears(ctx: AuthContext, e: { kind: string; payload: unknown }): Promise<boolean> {
  const p = (e.payload ?? {}) as {
    conversation_id?: string
    id?: string
    object_type?: string
    object_id?: string
    workspace_id?: string
  }
  if (p.workspace_id !== ctx.workspaceId) return false
  const uuid = /^[0-9a-f-]{36}$/i
  if (p.conversation_id && uuid.test(p.conversation_id)) return mayListen(ctx, p.conversation_id)
  return bounded(ctx, () =>
    withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      if (e.kind === 'notification' && p.object_type && p.object_id && uuid.test(p.object_id)) {
        /* Somebody who joined this workspace — a note no limited token
           hears, since it is about no project. */
        if (p.object_type === 'actor') {
          if (ctx.tokenProjectIds.length > 0) return false
          const [m] = await tx`
            select 1 from membership
            where workspace_id = ${ctx.workspaceId} and actor_id = ${p.object_id} and deleted_at is null`
          return Boolean(m)
        }
        if (!HOMES.has(p.object_type)) return false
        const [r] = await tx<{ ok: boolean }[]>`
          select token_reaches(${p.object_type}::object_kind, ${p.object_id})
                 and exists (select 1 from ${tx(p.object_type)} x where x.id = ${p.object_id} and x.workspace_id = ${ctx.workspaceId}) as ok`
        return r?.ok === true
      }
      if (e.kind === 'read' && p.id && uuid.test(p.id)) {
        const [r] = await tx`select 1 from notification where id = ${p.id} and workspace_id = ${ctx.workspaceId}`
        return Boolean(r)
      }
      return false
    }),
  )
}
