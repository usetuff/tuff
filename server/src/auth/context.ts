import type { z } from 'zod'
import { agentHere } from '../presence.js'
import { boardPool, sql, type Sql } from '../db.js'
import { Action, can, DEFAULT_SETTINGS, WorkspaceSettings, type Role, type PermissionInput } from '@tracker/shared-schema'
import { verifyAccessToken } from './tokens.js'
import { hashToken } from './crypto.js'
import { PER_PERSON, spend, workspaceAllowance } from '../http/limits.js'
import { edition } from '../edition.js'

/**
 * Who is asking, and with what.
 *
 * Built once per request. Everything downstream asks `allow`, never the role
 * directly: the design puts the decision in one function, and a handler that
 * reads `ctx.role` is a second place it gets decided.
 */
export type AuthContext = {
  actorId: string
  workspaceId: string
  role: Role
  settings: WorkspaceSettings
  /**
   * Which open tab made the call, if it said. Opaque, set by the client,
   * and used for one thing: handed back inside the realtime event so the
   * tab that caused a change can drop its own echo while every other tab
   * — including the same person's other device — refetches. Not trusted
   * for anything else, because anything can claim any value.
   */
  tab?: string
  /**
   * Whether the call arrived through a token rather than from a person.
   *
   * Read from the token, never from a header the caller sets: a tool that
   * wanted to skip a hard stop would simply claim to be the web app.
   */
  viaMcp: boolean
  /** A change GitHub caused, made as the person who linked the repository. */
  viaGithub?: boolean
  /** Written by an import, for the import it names. */
  viaImport?: string
  /**
   * Whether this person is a guest rather than one of the team.
   *
   * Restricted on at least one project. Carried
   * on the context because every `allow` needs it and it is one `exists` on
   * a query that runs once per request anyway.
   */
  /**
   * What this person holds on each project — `project_member.rights`.
   *
   * Carried here rather than looked up per handler because it is a short
   * map, it comes off a query that runs once a request anyway, and a handler
   * that forgets to look it up is a handler that silently refuses somebody
   * who may.
   */
  rights: Record<string, string[]>
  /** What the owner said about this person — `docs/specs/member-rights.md`. */
  mayCreateProjects: boolean | null
  mayCreateChannels: boolean
  /** And about the Members screen and inviting — null follows the switch. */
  maySeeMembers: boolean | null
  mayInvitePeople: boolean | null
  mayConnectAgents: boolean
  /** An agent, not a person. */
  agent: boolean
  /** Whether the deployment trusts this person to run the product. */
  operator: boolean
  /** Whether this person owns the server. */
  instanceOwner: boolean
  /** On a server of one's own, whether sign-up is closed. */
  signUpClosed?: boolean
  /** Whether this person's address is unproved — `can` gives them a
      member's rights and no more. */
  unproved?: boolean
  /** Whether that proof is only a link handed over — `can` hands no
      workspace over from it. */
  byHand?: boolean
  /** The plan the workspace is on — `can` reads it for `agent.use`. */
  plan: string
  /** Empty means every project the person is on. Otherwise the database
      shows only these (`bounded`, migration 191) and `can` refuses the
      rest. */
  tokenProjectIds: string[]
  tokenId?: string
  /** The sign-in this request came under, when its token says — which of
      the person's devices is asking. */
  sessionId?: string
  /**
   * Whether this request was inside its ceilings, when that was asked at
   * the same moment as who is asking — `http/limits.ts`. Unset, the limiter
   * asks itself.
   */
  within?: boolean
  /**
   * A board's link, not an account. Set
   * only by `boardContext`, which only the board's routes call; `can`
   * answers it from a closed list of its own.
   */
  board?: boolean
  /**
   * A feedback page's own actor, filing what a stranger asked for.
   * Set only from a token the server signs for
   * itself (`via: 'feedback'`); `can` answers it from a closed list.
   */
  feedbackPage?: boolean
  /** That page's project, the one place its actor may file into. */
  feedbackProjectId?: string
  /**
   * When the database checked who is asking — its own clock, in the
   * statement that checked. A session or a token this request makes is
   * dated no later than it, so an account put out between the check and
   * the write leaves it ended.
   */
  checkedAt?: Date
  /**
   * The workspace's own domain the session was made on.
   * From the signed token, never a header:
   * `can` refuses it `NEVER_ON_A_HOST` wherever it is used, and on a host
   * nothing else is let in (`host.ts`, `usableHere`).
   */
  host?: string
}

type Row = {
  role: Role
  settings: WorkspaceSettings
  rights: { p: string; r: string[] }[]
  may_create_projects: boolean | null
  may_create_channels: boolean | null
  may_see_members: boolean | null
  may_invite_people: boolean | null
  may_connect_agents: boolean | null
  agent: boolean | null
  operator: boolean
  instance_owner: boolean | null
  sign_up_closed: boolean | null
  plan: string
  live: boolean
  unproved: boolean
  by_hand: boolean | null
  checked_at: Date
}

async function load(
  actorId: string,
  workspaceId: string,
  viaMcp: boolean,
  tokenProjectIds: string[],
  sessionId: string | null = null,
  db: Sql = sql,
): Promise<AuthContext | null> {
  /* One statement and no transaction: `auth_context` answers for an actor
     and a workspace already verified above, so it needs none of the
     settings the policies read — four round trips a request became one.

     And whether the session the token came from was ended, in the same
     statement: asked on a connection of its own it was a third connection
     for every request, and a page asking six things at once held eighteen
     of the pool's twenty. */
  const [row] = await db<Row[]>`
    select c.*, (${sessionId}::uuid is null or auth_session_alive(${sessionId}::uuid)) as live,
           auth_email_confirmed(${actorId}) is false as unproved,
           auth_email_by_hand(${actorId}) as by_hand,
           statement_timestamp() as checked_at,
           /* Only where there are instance owners: the service never asks. */
           ${edition.instance ? db`instance_sign_up_open() is false` : db`false`} as sign_up_closed
    from auth_context(${actorId}, ${workspaceId}) c`
  if (!row || !row.live) return null
  return {
    actorId,
    workspaceId,
    role: row.role,
    settings: { ...DEFAULT_SETTINGS, ...row.settings },
    /* Only the token's projects, when it was made for some: what somebody
       holds elsewhere is not this request's to know. */
    rights: Object.fromEntries(
      (row.rights ?? []).filter((x) => tokenProjectIds.length === 0 || tokenProjectIds.includes(x.p)).map((x) => [x.p, x.r ?? []]),
    ),
    mayCreateProjects: row.may_create_projects ?? null,
    mayCreateChannels: row.may_create_channels !== false,
    maySeeMembers: row.may_see_members ?? null,
    mayInvitePeople: row.may_invite_people ?? null,
    mayConnectAgents: row.may_connect_agents === true,
    agent: row.agent === true,
    operator: row.operator === true,
    instanceOwner: row.instance_owner === true,
    signUpClosed: row.sign_up_closed === true,
    /* An agent has no address and is never unproved: `auth_email_confirmed`
       answers null for it. */
    unproved: row.unproved === true,
    byHand: row.by_hand === true,
    plan: row.plan,
    viaMcp,
    tokenProjectIds,
    checkedAt: row.checked_at,
  }
}

/**
 * Who a board's link acts as: its guest, or the actor an agent's name
 * stands for, in the board's own workspace.
 * The workspace and the actor come from `board_find` and `board_agent`,
 * which a secret's hash is the only way into; `authenticate` never makes
 * one of these, so a board's link reaches nothing but the board's routes.
 */
export async function boardContext(actorId: string, workspaceId: string): Promise<AuthContext | null> {
  /* On the boards' own pool, as everything a board's request asks is. */
  const ctx = await load(actorId, workspaceId, false, [], null, boardPool())
  return ctx ? { ...ctx, board: true } : null
}

/**
 * A feedback page's actor, in its own workspace — for the note its
 * followers get once the task it filed exists.
 */
export async function feedbackContext(actorId: string, workspaceId: string): Promise<AuthContext | null> {
  const [ctx, project] = await Promise.all([load(actorId, workspaceId, false, []), feedbackProjectOf(actorId)])
  return ctx && project ? { ...ctx, feedbackPage: true, feedbackProjectId: project } : null
}

/** The project a page's actor is the page of — none for anybody else. */
async function feedbackProjectOf(actorId: string): Promise<string | null> {
  const [row] = await sql<{ project: string | null }[]>`select feedback_actor_project(${actorId}) as project`
  return row?.project ?? null
}

/**
 * The same person, as they stand in another of their workspaces — for a
 * press that names a workspace other than the session's, where `can` still
 * decides. Only for a session's own person; null where they are not in it.
 */
export async function contextIn(ctx: AuthContext, workspaceId: string): Promise<AuthContext | null> {
  if (ctx.viaMcp || ctx.tokenProjectIds.length > 0) return null
  return load(ctx.actorId, workspaceId, false, [])
}

export async function authenticate(header: string | undefined): Promise<AuthContext | null> {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  if (token.startsWith('tok_')) {
    // The secrets table is not selectable by the application role for anyone,
    // so the lookup goes through a security definer function.
    // One statement, so no transaction around it.
    const [row] = await sql<
      { actor_id: string; workspace_id: string; token_id: string; project_ids: string[] }[]
    >`select * from auth_lookup_api_token(${hashToken(token)})`
    if (!row) return null
    const ctx = await load(row.actor_id, row.workspace_id, true, row.project_ids ?? [])
    /* An agent calling with its token is an agent at work: its dot is green
       while it is — `presence.ts`, `agentHere`. Not awaited: a dot is never
       a reason for a request to wait. */
    if (ctx?.agent) void agentHere(row.actor_id, row.workspace_id)
    return ctx ? { ...ctx, tokenId: row.token_id } : null
  }

  const claims = await verifyAccessToken(token)
  if (!claims) return null
  /*
   * Who is asking and whether they are inside their ceilings, side by side.
   *
   * The ceiling is per person and per workspace, and a signed token already
   * says both, so the limiter need not wait for this answer to ask its own:
   * two statements on two connections, one round trip. A limiter that
   * cannot reach the database lets the request through, as it always has.
   */
  /*
   * And whether the session the token came from was ended — signed out,
   * ended from Account, a password reset. The token is signed for fifteen
   * minutes and nothing asked again, so an ended session went on working
   * until it ran out. Asked inside who is asking (`load`), so it costs no
   * round trip and no connection of its own. Migration 115,
   */
  const [ctx, within, feedbackProject] = await Promise.all([
    load(claims.sub, claims.workspace_id, false, [], claims.sid ?? null),
    spend(`a:${claims.sub}`, PER_PERSON, `w:${claims.workspace_id}`, workspaceAllowance(claims.workspace_id)).catch(() => true),
    /* A feedback page's actor is held to its page's project. */
    claims.via === 'feedback' ? feedbackProjectOf(claims.sub) : Promise.resolve(null),
  ])
  /* Signed for a page that is gone: it is nobody now. */
  if (claims.via === 'feedback' && !feedbackProject) return null
  /* Made on a workspace's own domain that no longer opens this workspace —
     removed, paused, taken: nobody, here as there. Its session was ended
     when the name stopped (migration 326); this holds before the worker
     has written so. */
  if (claims.host && !(edition.hosts && (await edition.hosts.answers(claims.host, claims.workspace_id).catch(() => false)))) return null
  return ctx
    ? {
        ...ctx,
        within,
        ...(claims.sid ? { sessionId: claims.sid } : {}),
        ...(claims.host ? { host: claims.host } : {}),
        ...(claims.via === 'github' ? { viaGithub: true } : {}),
        ...(claims.via === 'import' && claims.imp ? { viaImport: claims.imp } : {}),
        ...(claims.via === 'feedback' ? { feedbackPage: true, feedbackProjectId: feedbackProject! } : {}),
      }
    : null
}

/**
 * The same person, read again — what they hold now rather than when the
 * context was made. For a connection that outlives a request: a document's
 * socket asks it before an edit when its reading is more than a few seconds
 * old. Null when the session was ended or the
 * person is no longer in the workspace. Only what `load` reads is read
 * again; what the token said about how it came in is kept.
 */
export async function again(ctx: AuthContext): Promise<AuthContext | null> {
  if (ctx.board || ctx.feedbackPage) return null
  const fresh = await load(ctx.actorId, ctx.workspaceId, ctx.viaMcp, ctx.tokenProjectIds, ctx.sessionId ?? null)
  return fresh ? { ...ctx, ...fresh } : null
}

/**
 * Somebody who is not asking: what they hold in a workspace, for the
 * server to act as them on their own earlier edit — a document's stored
 * body written from the state they left behind.
 * Not a session, and never handed to a request.
 */
export async function contextOf(actorId: string, workspaceId: string): Promise<AuthContext | null> {
  return load(actorId, workspaceId, false, [])
}

async function sessionAlive(sid: string): Promise<boolean> {
  const [r] = await sql<{ ok: boolean }[]>`select auth_session_alive(${sid}) as ok`
  return r?.ok === true
}

/**
 * Whether what a context was made from still stands: its session not ended,
 * its token not revoked. Asked again by a socket that has been open a while,
 * which otherwise went on hearing everything after its person signed out.
 */
export async function alive(ctx: AuthContext): Promise<boolean> {
  /* Made on a workspace's own domain that no longer opens this workspace —
     the plan dropped, the name removed or taken: the same question the API
     asks (`authenticate`), so a socket does not outlive what a request may
     not do. */
  if (ctx.host && !(edition.hosts && (await edition.hosts.answers(ctx.host, ctx.workspaceId).catch(() => false)))) return false
  /* And still in the workspace: removing somebody left a socket of theirs
     open as long as the session behind it lived —
     `docs/specs/removing-someone.md`. */
  const [m] = await sql<{ ok: boolean }[]>`select member_alive(${ctx.actorId}, ${ctx.workspaceId}) as ok`
  if (m?.ok !== true) return false
  if (ctx.tokenId) {
    const [r] = await sql<{ ok: boolean }[]>`select auth_token_alive(${ctx.tokenId}) as ok`
    return r?.ok === true
  }
  return ctx.sessionId ? sessionAlive(ctx.sessionId) : true
}

/** The refusal an unproved address hears. */
export const UNPROVED = {
  error: { code: 'email_unverified', message: 'Confirm your email first. Check your inbox for the link.' },
} as const

/**
 * The plan `can()` is told, as the edition says plans count — `edition.ts`.
 *
 * Where the edition has plans, the workspace's. On your own server,
 * nothing: a plan unsaid holds nothing back, so no plan refuses anything there.
 * Asked here and nowhere else, so every
 * question about a plan goes through the edition once.
 */
export function planAsked(ctx: Pick<AuthContext, 'plan'>): string | undefined {
  return edition.plans ? ctx.plan : undefined
}

/** The same, as the part of `can()`'s input it is: absent when unsaid. */
export function planSaid(ctx: Pick<AuthContext, 'plan'>): { plan?: string } {
  const plan = planAsked(ctx)
  return plan === undefined ? {} : { plan }
}

/**
 * The one place access is decided on the server.
 *
 * It is the same function the client uses to decide which buttons to draw, fed
 * the same inputs. The client asking is a convenience; this is the answer.
 */
export function allow(ctx: AuthContext, action: z.infer<typeof Action>, about: Partial<PermissionInput> = {}): boolean {
  return can(action, {
    role: ctx.role,
    settings: ctx.settings,
    viaMcp: ctx.viaMcp,
    mayCreateProjects: ctx.mayCreateProjects,
    mayCreateChannels: ctx.mayCreateChannels,
    maySeeMembers: ctx.maySeeMembers,
    mayInvitePeople: ctx.mayInvitePeople,
    mayConnectAgents: ctx.mayConnectAgents,
    agent: ctx.agent,
    /* Only where the edition has operators at all: the table is in every
       database, and an edition without `/admin` reads nobody into it. */
    operator: edition.operators && ctx.operator,
    /* And only where the edition has instance owners: the service's
       database has the table and never anybody in it, but says so twice. */
    instanceOwner: edition.instance && ctx.instanceOwner,
    signUpClosed: edition.instance && ctx.signUpClosed === true,
    ...planSaid(ctx),
    tokenLimited: ctx.tokenProjectIds.length > 0,
    ...about,
    /* After what the handler says: nothing asked about an object turns a
       board's link back into a member. */
    board: ctx.board === true,
    feedbackPage: ctx.feedbackPage === true,
    /* Nor a tool a person: a token, GitHub, an import — whatever the
       handler passed. */
    viaTool: ctx.viaMcp || ctx.viaGithub === true || Boolean(ctx.viaImport),
    /* And nothing a handler says makes an unproved address a proved one. */
    unproved: ctx.unproved === true,
    byHand: ctx.byHand === true,
    /* And nothing a handler says lifts what a host's session may not do. */
    onAHost: Boolean(ctx.host),
  })
}

/**
 * The same question, asked about one project.
 *
 * Running a project is a flag on the membership of that project, so every
 * check about a project has to say which one. Written once so a handler
 * cannot pass the action and forget the project — which reads as the
 * permission simply not working for whoever was given it.
 */
export function allowIn(
  ctx: AuthContext,
  action: z.infer<typeof Action>,
  projectId: string | null | undefined,
  about: Partial<PermissionInput> = {},
): boolean {
  return allow(ctx, action, {
    inProject: true,
    rights: projectId ? (ctx.rights[projectId] ?? []) : [],
    /* No project at all is outside every list as well. */
    outsideToken: ctx.tokenProjectIds.length > 0 && !(projectId && ctx.tokenProjectIds.includes(projectId)),
    ...about,
    /* After what the handler says, as `board` is: a page's actor is on its
       page's project or nowhere. */
    onItsPage: Boolean(ctx.feedbackProjectId && projectId === ctx.feedbackProjectId),
  })
}

/** Everything this actor may do, for a client that wants to hide buttons. */
export function allowedActions(ctx: AuthContext, about: Partial<PermissionInput> = {}): z.infer<typeof Action>[] {
  return Action.options.filter((a) => allow(ctx, a, about))
}

/**
 * On a session made on a workspace's own domain, what the same person may
 * do at usetuff.com and this session may not — `NEVER_ON_A_HOST` and
 * nothing else, since `can()` is asked twice with every other input the
 * same. Empty off a host. For the app to point to usetuff.com where it
 * would otherwise hide a door; every endpoint still decides.
 */
export function offHostActions(ctx: AuthContext, about: Partial<PermissionInput> = {}): z.infer<typeof Action>[] {
  if (!ctx.host) return []
  const { host: _onIt, ...off } = ctx
  return Action.options.filter((a) => !allow(ctx, a, about) && allow(off, a, about))
}
