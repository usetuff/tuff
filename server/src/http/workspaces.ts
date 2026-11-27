import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { withActor, withActorEverywhere, withoutActor } from '../db.js'
import { edition } from '../edition.js'
import { allow, type AuthContext } from '../auth/context.js'
import { newWorkspace, startSession } from '../auth/flows.js'
import { MarkIcon, MarkTint } from '@tracker/shared-schema'
import { linkFor, put } from '../storage.js'
import { rasterOf } from './files.js'
import { metaOf, spendOn } from './limits.js'
import { oneLine } from '../text.js'
import { bellsWaiting } from './inbox.js'

type Vars = { ctx: AuthContext }
export const workspaces = new Hono<{ Variables: Vars }>()

/**
 * The workspaces this person belongs to.
 *
 * One consultant works for three agencies and one person runs two companies;
 * signing out to reach the other one is the kind of friction that gets a
 * product replaced. Row-level security already answers this correctly — a
 * membership row is readable by the actor it belongs to — so the list is the
 * plain query and needs no definer function.
 */
workspaces.get('/workspaces', async (c) => {
  const ctx = c.get('ctx')
  // Not bounded to the session's workspace, because the question is which
  // workspaces there are — asked from inside one, it can only answer with
  // the one you are already in.
  const rows = await withActorEverywhere(
    ctx.actorId,
    (tx) =>
      tx<{ id: string; icon_key: string | null }[]>`select w.id, w.name, w.slug, m.role, w.mark_icon, w.mark_tint, w.icon_key,
              -- The plan, to its owner only: what a company is on is the
              -- owner's business. None where the
              -- edition has no plans.
              ${edition.plans ? tx`case when m.role = 'owner' then w.plan end` : tx`null`} as plan
       from membership m join workspace w on w.id = m.workspace_id
       where m.actor_id = ${ctx.actorId} and m.deleted_at is null and m.joined_at is not null
         /* A token made for some projects is a key to them, in this
            workspace: which others its person is in is not its to know. */
         ${ctx.tokenProjectIds.length > 0 ? tx`and w.id = ${ctx.workspaceId}` : tx``}
         /* Nor a session made on a workspace's own domain: whoever controls
            that domain's DNS tomorrow does not learn which other companies
            its person works with. */
         ${ctx.host ? tx`and w.id = ${ctx.workspaceId}` : tx``}
       order by w.name`,
  )
  /*
   * Whether each one's bell has something for this person — the dot on its
   * mark in the switcher. All of them in one
   * transaction, each read under its own workspace's policies and about
   * this person's own notes alone (`bellsWaiting`). Never through a token:
   * a token is one workspace's key, and what is waiting in another is not
   * its to know. A refusal is "nothing waiting", never a failed list.
   */
  const waits = ctx.viaMcp
    ? null
    : await bellsWaiting(
        ctx.actorId,
        rows.map((w) => w.id),
      ).catch(() => new Set<string>())
  return c.json({
    workspaces: rows.map((w) => (waits ? { ...marked(w), unread: waits.has(w.id) } : marked(w))),
    current: ctx.workspaceId,
  })
})

/**
 * Another one, and a session for it.
 *
 * Not through a token. A token is a narrower key than a session — one
 * workspace, sometimes a few projects — and answering it with a session
 * would turn the narrow key into a wide one.
 */
const ownersOnly = { error: { code: 'owners_only', message: 'Only this server’s owners can create workspaces.' } } as const

/* Named, for a session in no workspace too — `nowhere.ts`. It asks
   `can()` and the person, and reads nothing of the session's workspace. */
export async function makeWorkspace(c: Context<{ Variables: Vars }>) {
  const ctx = c.get('ctx')
  if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  if (!allow(ctx, 'workspace.create')) {
    /* Said, when it is the server's rule and not the person's standing. */
    if (ctx.signUpClosed && !ctx.instanceOwner && !ctx.unproved) return c.json(ownersOnly, 403)
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  /* Ten a day for one person: each workspace is a fresh allowance of
     invitation mail and storage, and a factory of them was a way round
     every ceiling that is counted per workspace. Not for the owners of a
     server of their own, who make as many as they like on their machine;
     on the service `instance` is nobody's. */
  if (!allow(ctx, 'instance') && !(await spendOn(`workspace-new:${ctx.actorId}`, 10, 86_400))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many new workspaces today. Try again tomorrow.' } }, 429)
  }
  const body = z
    .object({
      name: z.string().max(80).transform(oneLine).pipe(z.string().min(1)),
      /* All four optional: without them it is the workspace a name alone
         has always made. */
      slug: z.string().trim().toLowerCase().max(40).nullish(),
      mark_icon: MarkIcon.nullish(),
      mark_tint: MarkTint.nullish(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  try {
    const made = await newWorkspace(
      ctx.actorId,
      body.data.name,
      { ...metaOf(c), since: ctx.checkedAt ?? null },
      {
        slug: body.data.slug || null,
        icon: body.data.mark_icon ?? null,
        tint: body.data.mark_tint ?? null,
      },
    )
    return c.json(made, 201)
  } catch (e) {
    /* Taken between being told it was free and pressing Create: said, with
       the next free one, rather than bent into it silently. */
    const said = String((e as Error).message)
    /* The database's own word for the rule `can` has already said: on a
       server of one's own with sign-up closed, only its owners make one. */
    if (said.includes('sign_up_closed')) return c.json(ownersOnly, 403)
    if (said.includes('slug_taken') || said.includes('slug_invalid')) {
      const [s] = await withoutActorFree(body.data.slug ?? body.data.name)
      return c.json(
        {
          error: {
            code: said.includes('slug_taken') ? 'taken' : 'invalid',
            message: said.includes('slug_taken') ? 'That address was just taken. Try another one.' : 'That can’t be used as an address.',
            suggestion: s,
          },
        },
        409,
      )
    }
    throw e
  }
}
workspaces.post('/workspaces', makeWorkspace)

/**
 * Whether an address is free, and the next free one — for the window a
 * workspace is made in, as it is typed.
 *
 * `?name=` alone: the address the name would get. `?want=` too: whether
 * that one is free, and if not, the nearest that is. Says nothing about
 * whose an address is — only free or not, which a sign-up page has to say
 * anyway.
 */
export async function workspaceAddress(c: Context) {
  const want = (c.req.query('want') ?? '').trim().toLowerCase()
  const name = (c.req.query('name') ?? '').trim()
  if (!want) {
    const [suggestion] = await withoutActorFree(name || 'workspace')
    return c.json({ slug: suggestion, free: true, suggestion })
  }
  const [free, suggestion] = await withoutActorFree(want, true)
  return c.json({ slug: want, free, suggestion })
}
workspaces.get('/workspaces/address', workspaceAddress)

/** The next free address from some words, and whether `want` itself is free. */
async function withoutActorFree(words: string): Promise<[string]>
async function withoutActorFree(words: string, check: true): Promise<[boolean, string]>
async function withoutActorFree(words: string, check?: true): Promise<[string] | [boolean, string]> {
  return withoutActor(async (tx) => {
    const [r] = await tx<{ next: string; free: boolean }[]>`
      select free_workspace_slug(${words}) as next, workspace_slug_free(${words}) as free`
    return check ? [r!.free, r!.next] : [r!.next]
  })
}

/** A workspace row as the switcher draws it: its mark, and its picture's link. */
function marked<T extends { icon_key: string | null }>(w: T) {
  const { icon_key, ...rest } = w
  return { ...rest, icon_url: icon_key ? linkFor(icon_key) : null }
}

/**
 * A picture for the workspace, in place of its mark — the owner's, as the
 * plan and the switches are. Small on purpose, as a project's is: it is
 * drawn at sixteen pixels.
 */
workspaces.post('/workspace/icon', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'workspace.billing')) return c.json({ error: { code: 'forbidden' } }, 403)
  /* Thirty pictures an hour a person: the bytes a changed picture leaves
     go an hour later, and a loop of uploads was storage nobody counted. */
  if (!(await spendOn(`picture:${ctx.actorId}`, 30, 3600))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many picture uploads. Try again later.' } }, 429)
  }

  const form = await c.req.formData().catch(() => null)
  const picked = form?.get('file')
  if (!(picked instanceof File)) return c.json({ error: { code: 'invalid' } }, 400)
  if (picked.size > 2 * 1024 * 1024) {
    return c.json({ error: { code: 'too_large', message: 'Images can be up to 2 MB.' } }, 413)
  }
  /* What a browser can draw, and nothing else, by its bytes — never the
     type the form says: an SVG was taken and then could not be shown, and
     from this origin, or a workspace's own domain, it would be a document
     that runs script if opened. The web turns one into a PNG before
     sending it. `data/picture.ts`, `rasterOf`. */
  const bytes = new Uint8Array(await picked.arrayBuffer())
  const type = rasterOf(bytes)
  if (!type) return c.json({ error: { code: 'invalid', message: 'Use a PNG, JPEG, GIF or WebP image.' } }, 400)
  const stored = await put(ctx.workspaceId, bytes, type)
  await withActor(ctx.actorId, ctx.workspaceId, (tx) => tx`update workspace set icon_key = ${stored.key} where id = ${ctx.workspaceId}`)
  return c.json({ ok: true, icon_url: linkFor(stored.key) })
})

workspaces.delete('/workspace/icon', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'workspace.billing')) return c.json({ error: { code: 'forbidden' } }, 403)
  await withActor(ctx.actorId, ctx.workspaceId, (tx) => tx`update workspace set icon_key = null where id = ${ctx.workspaceId}`)
  return c.json({ ok: true })
})

/**
 * Switching is a new session, not a header.
 *
 * Which workspace a request is in comes from the token, the same as who is
 * asking. A client-supplied workspace id would be a second way to say it, and
 * the two would disagree the first time something forgot to check.
 */
workspaces.post('/workspaces/:id/enter', async (c) => {
  const ctx = c.get('ctx')
  /* Not through a token, for the reason making a workspace is not: the
     answer is a session, and a token traded for one is a narrow key turned
     into a wide one that outlives the token's revocation. */
  /* Nor from an import's token, which would come out of here a full session
     that reads everything the owner can. Positively: only a session one is
     in can open another, so a kind of token added later fails closed. */
  if (!ctx.sessionId || ctx.viaMcp || ctx.viaGithub || ctx.viaImport) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  const id = c.req.param('id')
  /* Another workspace than this session's — never for an unproved address,
     whose session stays in the workspace it joined (`can`). */
  if (id !== ctx.workspaceId && !allow(ctx, 'workspace.enter')) return c.json({ error: { code: 'forbidden' } }, 403)

  // Likewise: this asks about the workspace being entered, not the one being
  // left. The membership policy answers it for the actor's own rows.
  const member = await withActorEverywhere(ctx.actorId, async (tx) => {
    const [row] = await tx<{ workspace_id: string }[]>`
      select workspace_id from membership
      where actor_id = ${ctx.actorId} and workspace_id = ${id}
        and deleted_at is null and joined_at is not null`
    return Boolean(row)
  })
  // Not a member reads as no such workspace: that one exists is information
  // about somebody else's company.
  if (!member) return c.json({ error: { code: 'not_found' } }, 404)

  /* The session this came from is kept: other tabs of the browser are
     using it. They are one line in the list of places you are signed in
     because the browser names itself (`x-device`). */
  /* A session opened into this workspace is a sign-in its owner reads —
     `method: switch`, in the log of the workspace entered. Entering the
     one it is already in opens nothing new. */
  const session = await startSession(
    ctx.actorId,
    id,
    /* A session made on a workspace's own domain stays one, wherever it is
       renewed this way. */
    { ...metaOf(c), host: ctx.host ?? metaOf(c).host, since: ctx.checkedAt ?? null },
    id !== ctx.workspaceId ? 'switch' : null,
  )
  return c.json(session)
})

/**
 * What is on me, everywhere.
 *
 * The one question a person asks before anything else, and it does not belong
 * to a project — which is why it is a screen of its own rather than a filter
 * somebody has to apply in each project in turn.
 *
 * Row-level security decides which projects are in scope, so this is not
 * filtered by project here and cannot accidentally reach past them.
 *
 * `?tab=` is how the work is mine: assigned to me, created by me, watched by
 * me, or touched by me lately.
 */
const TABS = ['assigned', 'created', 'subscribed', 'activity'] as const
type Tab = (typeof TABS)[number]

workspaces.get('/my/tasks', async (c) => {
  const ctx = c.get('ctx')
  const tab = (c.req.query('tab') ?? 'assigned') as Tab
  if (!TABS.includes(tab)) return c.json({ error: { code: 'invalid' } }, 400)
  // The activity log is not served to a client, and a list built from it is
  // the log by another name.
  if (tab === 'activity' && !allow(ctx, 'activity.read')) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }

  const rows = await withActor(ctx.actorId, ctx.workspaceId, (tx) => {
    const select = tx`
      select t.id, t.number, t.title, t.due_on, t.completed_at, t.repeat,
             t.project_id, p.name as project_name, p.key as project_key, p.slug as project_slug,
             -- The mark comes from the list the task is in, which is a fact
             -- about this row rather than about the screen drawing it, and
             -- its colour with it.
             l.icon, l.color, l.name as list_name,
             -- Your own reminder on it, by the key the table is kept by.
             (select r.at from task_reminder r where r.task_id = t.id and r.actor_id = ${ctx.actorId}) as reminder_at
      -- Not a project that was put away: its work is not on anybody any
      -- more, until it is brought back. Nor the sample, which is nobody's
      -- work at all.
      from task t join project p on p.id = t.project_id and p.archived_at is null and not p.sample
      left join task_list l on l.id = t.list_id`
    switch (tab) {
      /* Each tab names the workspace as well as the person: row-level
         security keeps the answer to this one, and the index that starts
         with the person is what keeps the reading to it. */
      case 'created':
        return tx`${select}
          where t.workspace_id = ${ctx.workspaceId} and t.deleted_at is null and t.author_id = ${ctx.actorId}
          order by t.completed_at nulls first, t.created_at desc
          limit 200`
      case 'subscribed':
        return tx`${select}
          join subscription s
            on s.object_type = 'task' and s.object_id = t.id
           and s.actor_id = ${ctx.actorId} and s.deleted_at is null
          where t.workspace_id = ${ctx.workspaceId} and t.deleted_at is null
          order by t.completed_at nulls first, t.due_on nulls last, t.created_at
          limit 200`
      case 'activity':
        return tx`${select}
          join (
            select object_id, max(at) as last_at from activity_event
            where workspace_id = ${ctx.workspaceId} and actor_id = ${ctx.actorId}
              and object_type = 'task'
            group by object_id
          ) mine on mine.object_id = t.id
          where t.deleted_at is null
          order by mine.last_at desc
          limit 200`
      default:
        return tx`${select}
          where t.workspace_id = ${ctx.workspaceId} and t.deleted_at is null and t.assignee_ids @> array[${ctx.actorId}]::uuid[]
          -- Undated work sits after dated work rather than being hidden by it.
          order by t.completed_at nulls first, t.due_on nulls last, t.created_at
          limit 200`
    }
  })
  return c.json({ tasks: rows })
})
