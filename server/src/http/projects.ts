import { Hono } from 'hono'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import { generateKeyBetween } from 'fractional-indexing'
import {
  Tool,
  Right,
  MarkIcon,
  MarkTint,
  ProjectTemplate,
  PROJECT_TEMPLATES,
  RIGHTS_ON_JOINING,
  rightsOfItsMaker,
  STARTING_LISTS,
} from '@tracker/shared-schema'
import { withActor, type Tx } from '../db.js'
import { allow, allowedActions, allowIn, type AuthContext } from '../auth/context.js'
import { record } from './activity.js'
import { LINES, doer, notify } from '../notify.js'
import { subscribe } from './objects.js'
import { faced, linkFor, put } from '../storage.js'
import { rasterOf } from './files.js'
import { statusByAgent } from '../doing.js'
import { isMoment, pageSize, spendOn } from './limits.js'
import { LABELS_FR, SAMPLE, SAMPLE_FR, TEMPLATES_FR, doc, listName, type Label } from '../templates.js'
import { languageOf, type Language } from '../words.js'

type Vars = { ctx: AuthContext }
export const projects = new Hono<{ Variables: Vars }>()

/**
 * A missing project and a forbidden one answer the same way.
 *
 * The design asks for 404 rather than 403 on another project's object: that an
 * object exists is information too, and RLS already makes the row invisible,
 * so this is what the query naturally returns.
 */
const missing = { error: { code: 'not_found' } } as const

projects.get('/projects', async (c) => {
  const ctx = c.get('ctx')
  // A limit that is not a number is the default, not a 500.
  const limit = pageSize(c.req.query('limit'), 50, 200)
  const cursor = c.req.query('cursor')

  // Archived projects are asked for, never mixed in: a sidebar that still
  // lists what you archived is a sidebar that grows forever.
  const archived = c.req.query('archived') === 'true'

  /*
   * Keyset on the pair, because the order is a pair now.
   *
   * Placed rows come first in key order and the rest by age, so a cursor
   * carrying only the date would skip or repeat rows across a page boundary
   * the moment anybody dragged anything. The tilde stands in for "no key" on
   * both sides of the comparison: fractional keys are digits and letters, so
   * it sorts after all of them.
   */
  /* `key|at|id`: the time to the microsecond, as Postgres keeps it, and the
     id for two made in the same one. It was the row's date as JavaScript
     prints one — "Fri Oct 23 …" — which the next request handed back to
     Postgres and got a 500, so the fifty-first project was nowhere. Sent
     back as text and cast in the query: cast as a timestamp, the driver
     put it through a Date, to the millisecond, and projects made in one
     moment past the page's end were skipped. */
  const parts = cursor ? cursor.split('|') : []
  const from = {
    key: parts.length === 3 ? parts[0]! : '~',
    at: parts.length === 3 && isMoment(parts[1]!) ? parts[1]! : null,
    id: parts.length === 3 && /^[0-9a-f-]{36}$/i.test(parts[2]!) ? parts[2]! : null,
  }
  if (cursor && (!from.at || !from.id)) return c.json({ error: { code: 'invalid', message: 'Not a cursor' } }, 400)

  // Cursor pagination from the first list, not from the first slow one.
  const rows = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      tx<{ id: string; name: string; created_at: string; icon_key: string | null; cursor_at: string }[]>`
      select p.id, p.slug, p.key, p.name, p.description, p.tools, p.archived_at, p.sample,
             p.created_at, p.icon_key, p.mark_icon, p.mark_tint, sp.sort_key,
             to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_at
      from project p
      /* Where this person keeps it in their own sidebar, if they have ever
         said -- docs/specs/sidebar-order.md. Left joined because most people
         never drag anything, and an order nobody set is still an order.
         No backticks in here: this is inside a template literal, and one
         ends it. */
      left join sidebar_place sp
        on sp.object_id = p.id and sp.kind = 'project'
       and sp.actor_id = ${ctx.actorId} and sp.workspace_id = ${ctx.workspaceId}
      where p.workspace_id = ${ctx.workspaceId} and p.deleted_at is null
        -- Archiving is meant to take a project out of the way. Returning it
        -- anyway made the button do nothing anybody could see.
        ${archived ? tx`and p.archived_at is not null` : tx`and p.archived_at is null`}
        ${
          cursor
            ? tx`and (coalesce(sp.sort_key, '~') collate "C" > ${from.key}
             or (coalesce(sp.sort_key, '~') collate "C" = ${from.key}
                 and (p.created_at, p.id) < (${from.at}::text::timestamptz, ${from.id}::uuid)))`
            : tx``
        }
      order by coalesce(sp.sort_key, '~') collate "C", p.created_at desc, p.id desc
      limit ${limit}`,
  )
  return c.json({
    /*
     * The icon arrives as a link that already works.
     *
     * Signing it per render would mean a round trip before the sidebar can
     * draw, and handing out the raw key would mean a bucket anybody can read
     * by guessing. An hour is long enough that a page open all morning keeps
     * its pictures and short enough that a link out of a screenshot expires.
     */
    projects: rows.map(({ cursor_at: _, ...p }) => ({
      ...p,
      icon_url: p.icon_key ? linkFor(p.icon_key) : null,
      /*
       * What this person may do in it, with the row rather than per screen.
       *
       * Permissions are held on a project, so `GET /api/me` — which has no
       * project — cannot answer them, and a screen that asked per project
       * would ask again on every switch. It costs nothing: `can` is a pure
       * function of the rights already loaded with the session.
       */
      can: allowedActions(ctx, {
        inProject: true,
        isAuthor: true,
        rights: ctx.rights[p.id] ?? [],
        joined: ctx.rights[p.id] !== undefined,
      }),
    })),
    /* The pair the ordering is on, in one opaque string. A fractional key is
       digits and letters, so the bar cannot be in the first half of it. */
    next_cursor:
      rows.length === limit
        ? `${(rows[rows.length - 1] as { sort_key?: string | null }).sort_key ?? '~'}|${rows[rows.length - 1]!.cursor_at}|${rows[rows.length - 1]!.id}`
        : null,
  })
})

projects.post('/projects', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'project.create')) return c.json({ error: { code: 'forbidden' } }, 403)

  const body = z
    .object({
      name: z.string().min(1).max(200),
      description: z.string().max(2000).nullish(),
      tools: z.array(Tool).nonempty().optional(),
      /* First tasks to start from. */
      template: ProjectTemplate.optional(),
      /* Its mark, when the screen that made it drew one: what was shown
         before is what is made. A template's otherwise. */
      mark_icon: MarkIcon.nullish(),
      mark_tint: MarkTint.nullish(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const id = uuidv7()
  const tools = body.data.tools ?? ['posts', 'tasks', 'files', 'messages']
  /* Filled inside the transaction below. An object rather than a `let`,
     because the compiler cannot see that the closure ran. */
  const made: { slug: string | undefined; key: string | undefined } = {
    slug: undefined,
    key: undefined,
  }
  const plan = body.data.template ? PROJECT_TEMPLATES[body.data.template] : null
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    /* What it starts with is written in the language of whoever makes it. */
    const language = await languageOf(tx, ctx.actorId)
    const { slug, key, lists } = await projectWithItsPlaces(tx, ctx, {
      id,
      name: body.data.name,
      description: body.data.description ?? null,
      tools,
      /* A template's mark comes with it: the first-project screen draws the
         project with it before it is made. */
      markIcon: body.data.mark_icon ?? plan?.icon ?? null,
      markTint: body.data.mark_tint ?? plan?.tint ?? null,
      language,
    })
    made.slug = slug
    made.key = key
    /*
     * And a template's first tasks: on whoever made the project, the first
     * few in Todo and the rest in Backlog, with them subscribed as making a
     * task subscribes its author; and the document the first task asks
     * for. No line each in the feed — the project's own line says it was
     * made, and the rest are part of it.
     */
    if (plan) {
      const fr = language === 'fr' ? TEMPLATES_FR[body.data.template!] : null
      const keys = new Map<string, string | null>()
      for (const { title: english, list } of plan.tasks) {
        const title = fr?.tasks[english] ?? english
        const key = generateKeyBetween(keys.get(list) ?? null, null)
        keys.set(list, key)
        const taskId = uuidv7()
        await tx`
          insert into task (id, workspace_id, project_id, author_id, list_id, title,
                            assignee_ids, sort_key)
          values (${taskId}, ${ctx.workspaceId}, ${id}, ${ctx.actorId},
                  ${lists.get(list) ?? null}, ${title}, array[${ctx.actorId}]::uuid[], ${key})`
        await subscribe(tx, ctx, 'task', taskId)
      }
      await tx`
        insert into file (id, workspace_id, project_id, author_id, name, body)
        values (${uuidv7()}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${(fr?.doc ?? plan.doc).name},
                ${tx.json(doc(...(fr?.doc ?? plan.doc).body) as never)})`
    }
    await record(tx, ctx, 'project.create', { projectId: id, objectType: 'project', objectId: id })
  })
  return c.json({ id, name: body.data.name, tools, slug: made.slug, key: made.key }, 201)
})

/**
 * A project with what every project starts with: whoever makes it on it,
 * its own channel, the five lists and the three labels. Written once for
 * the two ways a project is made by somebody — the form, and saving a
 * board — so the second cannot start with
 * less than the first.
 */
export async function projectWithItsPlaces(
  tx: Tx,
  ctx: AuthContext,
  p: {
    id: string
    name: string
    description: string | null
    tools: readonly string[]
    markIcon: string | null
    markTint: number | null
    language: Language
  },
): Promise<{ slug: string | undefined; key: string | undefined; lists: Map<string, string> }> {
  const { id } = p
  await tx`
    insert into project (id, workspace_id, name, description, tools, mark_icon, mark_tint)
    values (${id}, ${ctx.workspaceId}, ${p.name},
            ${p.description}, ${p.tools as string[]}::tool_kind[],
            ${p.markIcon}, ${p.markTint})`
  // Whoever made it is on it. A project its creator cannot see is not a safer
  // default, it is a broken one.
  await tx`
    insert into project_member (id, workspace_id, project_id, actor_id, added_by, rights)
    values (${uuidv7()}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${ctx.actorId}, ${rightsOfItsMaker(ctx.role)})`

  /*
   * Where it now lives, read inside the same request.
   *
   * The slug and the key are filled by a trigger — what is free depends on
   * what is already there — so the only thing that knows them is the
   * database, and the answer used to be the id alone: every caller that
   * wanted to open the project it had just made had to fetch it again to
   * learn its address.
   *
   * Read here and not with `returning` on the insert above, which is where
   * this was first written and where row-level security refused it: a
   * returning clause is a read, and a project is visible to somebody who is
   * on it — which is true one statement later and not before.
   */
  const [row] = await tx<{ slug: string; key: string }[]>`
    select slug, key from project where id = ${id}`
  // Every project starts with the team's own channel. A conversation you
  // have to switch on per project is one nobody has.
  await tx`
    insert into conversation (id, workspace_id, project_id, name)
    values (${uuidv7()}, ${ctx.workspaceId}, ${id}, 'main')`
  // And with the lists, which are also the board's columns.
  const lists = await startingLists(tx, ctx, id, p.language)
  await startingLabels(tx, id, p.language)
  return { slug: row?.slug, key: row?.key, lists }
}

/**
 * The five lists every project starts with, which are also the board's
 * columns — answered by name, for whatever goes into them next.
 *
 * A project that has to be configured before it holds anything is a form
 * before the work — and with the list as the only placement, a project with
 * no lists has nowhere to put a task at all.
 *
 * Named in the language of whoever makes the project, and answered by the
 * English name all the same: that is what a template and the sample say
 * where a task goes.
 */
async function startingLists(tx: Tx, ctx: AuthContext, projectId: string, language: Language): Promise<Map<string, string>> {
  const made = new Map<string, string>()
  for (const [at, { name, icon, finishes, color, narrow }] of STARTING_LISTS.entries()) {
    const listId = uuidv7()
    made.set(name, listId)
    await tx`
      insert into task_list (id, workspace_id, project_id, author_id, name,
                             sort_key, icon, finishes, color, narrow)
      values (${listId}, ${ctx.workspaceId}, ${projectId}, ${ctx.actorId}, ${listName(name, language)},
              ${`a${at}`}, ${icon}, ${finishes}, ${color}, ${narrow})`
  }
  return made
}

/**
 * The three labels, in French for somebody who reads it.
 *
 * The database gives every project its three as the row goes in, whatever
 * made it (`071_a_label_belongs_to_its_project.sql`), and in English: a
 * trigger does not know who is asking in which language. So they are
 * renamed here, in the same transaction, before anybody can see them.
 */
async function startingLabels(tx: Tx, projectId: string, language: Language): Promise<void> {
  if (language !== 'fr') return
  for (const [english, french] of Object.entries(LABELS_FR)) {
    if (english === french) continue
    await tx`
      update label set name = ${french}, updated_at = now()
      where project_id = ${projectId} and name = ${english} and deleted_at is null`
  }
}

/**
 * A sample to look around in.
 *
 * One per workspace: asking again opens the one there is, with the asker put
 * on it. Made the way the seed makes its studio, row by row and without a
 * line in the feed, a notification or a subscription, because nothing in it
 * is anybody's work: no task is on anybody, and My tasks leaves it out.
 */
projects.post('/projects/sample', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'project.create') || ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)

  const opened = async (projectId: string, status: 200 | 201) => {
    const [p] = await withActor(
      ctx.actorId,
      ctx.workspaceId,
      (tx) =>
        tx<{ id: string; name: string; slug: string; key: string; tools: string[] }[]>`
        select id, name, slug, key, tools from project where id = ${projectId}`,
    )
    return p ? c.json({ ...p, sample: true }, status) : c.json(missing, 404)
  }
  const there = async () => {
    const [r] = await withActor(ctx.actorId, ctx.workspaceId, (tx) => tx<{ id: string | null }[]>`select join_sample() as id`)
    return r?.id ?? null
  }

  const had = await there()
  if (had) return opened(had, 200)

  const id = uuidv7()
  try {
    await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      /* Written in French for somebody who reads it, and not translated
         for whoever is put on it after. */
      const language = await languageOf(tx, ctx.actorId)
      const sample = language === 'fr' ? SAMPLE_FR : SAMPLE
      await tx`
        insert into project (id, workspace_id, name, description, tools, sample)
        values (${id}, ${ctx.workspaceId}, ${sample.name}, ${sample.description},
                ${['posts', 'tasks', 'files', 'messages']}::tool_kind[], true)`
      await tx`
        insert into project_member (id, workspace_id, project_id, actor_id, added_by, rights)
        values (${uuidv7()}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${ctx.actorId}, ${rightsOfItsMaker(ctx.role)})`
      const room = uuidv7()
      await tx`
        insert into conversation (id, workspace_id, project_id, name)
        values (${room}, ${ctx.workspaceId}, ${id}, 'main')`
      const lists = await startingLists(tx, ctx, id, language)
      await startingLabels(tx, id, language)
      // The three labels a project starts with, made by the insert above.
      const labels = new Map(
        (
          await tx<{ id: string; name: string }[]>`
          select id, name from label where project_id = ${id} and deleted_at is null`
        ).map((l) => [l.name, l.id]),
      )
      const labelled = (l: Label) => labels.get(language === 'fr' ? LABELS_FR[l] : l)

      const day = 86_400_000
      const keys = new Map<string, string | null>()
      const made = new Map<string, string>()
      for (const t of sample.tasks) {
        const key = generateKeyBetween(keys.get(t.list) ?? null, null)
        keys.set(t.list, key)
        const taskId = uuidv7()
        made.set(t.title, taskId)
        const finished = t.doneDaysAgo === undefined ? null : new Date(Date.now() - t.doneDaysAgo * day)
        const dueOn = t.dueIn === undefined ? null : new Date(Date.now() + t.dueIn * day).toISOString().slice(0, 10)
        await tx`
          insert into task (id, workspace_id, project_id, author_id, list_id, title, body,
                            priority, due_on, completed_at, sort_key)
          values (${taskId}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${lists.get(t.list) ?? null},
                  ${t.title}, ${t.body ? tx.json(doc(...t.body) as never) : null},
                  ${t.priority ?? null}::task_priority, ${dueOn}, ${finished}, ${key})`
        const label = t.label ? labelled(t.label) : undefined
        if (label) {
          await tx`
            insert into task_label (id, workspace_id, task_id, label_id)
            values (${uuidv7()}, ${ctx.workspaceId}, ${taskId}, ${label})`
        }
        let partKey: string | null = null
        for (const part of t.parts ?? []) {
          partKey = generateKeyBetween(partKey, null)
          const partId = uuidv7()
          await tx`
            insert into task (id, workspace_id, project_id, author_id, parent_id, list_id, title, sort_key)
            values (${partId}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${taskId},
                    ${lists.get(t.list) ?? null}, ${part.title}, ${partKey})`
          /* Ticked after it is in: a part sits in its parent's list, and
             a list that does not finish clears a finish given on the way
             in — `task_finished_follows_list`. */
          if (part.done) {
            await tx`update task set completed_at = now() - interval '1 day' where id = ${partId}`
          }
        }
      }

      /*
       * A channel and a few tasks that have been talked about — a project
       * with nothing said in it read as one nobody uses. Written as the
       * person who made it, back-dated over a couple of days, with no feed
       * lines and no notes, as the rest of the sample has none.
       */
      const hour = 3_600_000
      const named = new Map(
        (
          await tx<{ id: string; number: number; title: string; key: string }[]>`
          select t.id, t.number, t.title, p.key from task t join project p on p.id = t.project_id
          where t.project_id = ${id} and t.parent_id is null`
        ).map((t) => [t.title, t]),
      )
      for (const c of sample.comments) {
        const on = made.get(c.task)
        if (!on) continue
        await tx`
          insert into comment (id, workspace_id, project_id, object_type, object_id, author_id, body, created_at)
          values (${uuidv7()}, ${ctx.workspaceId}, ${id}, 'task', ${on}, ${ctx.actorId},
                  ${tx.json(doc(c.text) as never)}, ${new Date(Date.now() - c.ago * hour)})`
      }
      for (const m of sample.chat) {
        const t = m.task ? named.get(m.task) : undefined
        const line = [
          { type: 'text', text: m.text },
          ...(t
            ? [
                { type: 'text', text: ' ' },
                { type: 'taskref', attrs: { id: t.id, projectId: id, number: t.number, key: t.key, title: t.title } },
              ]
            : []),
        ]
        const body = {
          type: 'doc',
          content: [
            { type: 'paragraph', content: line },
            ...(m.list
              ? [
                  {
                    type: 'bulletList',
                    content: m.list.map((x) => ({
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: x }] }],
                    })),
                  },
                ]
              : []),
          ],
        }
        const said = uuidv7()
        await tx`
          insert into message (id, workspace_id, conversation_id, author_id, body, created_at)
          values (${said}, ${ctx.workspaceId}, ${room}, ${ctx.actorId}, ${tx.json(body as never)},
                  ${new Date(Date.now() - m.ago * hour)})`
        if (m.reply) {
          await tx`
            insert into message (id, workspace_id, conversation_id, author_id, parent_id, body, created_at)
            values (${uuidv7()}, ${ctx.workspaceId}, ${room}, ${ctx.actorId}, ${said},
                    ${tx.json(doc(m.reply.text) as never)}, ${new Date(Date.now() - m.reply.ago * hour)})`
        }
      }

      await tx`
        insert into file (id, workspace_id, project_id, author_id, name, body)
        values (${uuidv7()}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${sample.doc.name},
                ${tx.json(doc(...sample.doc.body) as never)})`
      await tx`
        insert into post (id, workspace_id, project_id, author_id, title, body, published_at)
        values (${uuidv7()}, ${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${sample.post.title},
                ${tx.json(doc(...sample.post.body) as never)}, now())`
    })
  } catch (e) {
    /* Two presses at once: the index lets one sample through, and the
       other opens it. */
    const since = await there()
    if (since) return opened(since, 200)
    throw e
  }
  return opened(id, 201)
})

/** The sample out for good, at once — not to the bin, which is for work. */
projects.delete('/projects/:id/sample', async (c) => {
  const ctx = c.get('ctx')
  if (ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  const [r] = await withActor(ctx.actorId, ctx.workspaceId, (tx) => tx<{ ok: boolean }[]>`select drop_sample(${c.req.param('id')}) as ok`)
  return r?.ok ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * The bin, and coming back out of it.
 *
 * Deleting says it is reversible and nothing could reverse it: the row was
 * there, the window was there, and there was no way for a person to see or
 * undo it. A promise the product does not keep is worse than asking twice.
 */
/**
 * A picture for a project, replacing the generated mark.
 *
 * Small on purpose: this is drawn at eighteen pixels in a sidebar, and a
 * four-megabyte photograph of an office is four megabytes nobody sees.
 */
projects.post('/projects/:id/icon', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  /* Thirty pictures an hour a person: the bytes a changed picture leaves
     go an hour later, and a loop of uploads was storage nobody counted. */
  if (!(await spendOn(`picture:${ctx.actorId}`, 30, 3600))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many picture uploads. Try again later.' } }, 429)
  }
  if (!allowIn(ctx, 'project.archive', id)) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }

  const form = await c.req.formData().catch(() => null)
  const picked = form?.get('file')
  if (!(picked instanceof File)) return c.json({ error: { code: 'invalid' } }, 400)
  if (picked.size > 2 * 1024 * 1024) {
    return c.json({ error: { code: 'too_large', message: 'Images can be up to 2 MB.' } }, 413)
  }
  /* What a browser can draw, and nothing else, by its bytes — never the
     type the form says: an SVG was taken and then could not be shown, and
     from this origin it would be a document that runs script if opened.
     The web turns one into a PNG before sending it. `data/picture.ts`,
     `rasterOf`. */
  const bytes = new Uint8Array(await picked.arrayBuffer())
  const type = rasterOf(bytes)
  if (!type) return c.json({ error: { code: 'invalid', message: 'Use a PNG, JPEG, GIF or WebP image.' } }, 400)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const stored = await put(ctx.workspaceId, bytes, type)
    const rows = await tx<{ id: string }[]>`
      update project set icon_key = ${stored.key}
      where id = ${id} and deleted_at is null returning id`
    /* Its own action, not "changed the project": a picture is a thing
       somebody can see changing, and a log that calls it the same as a rename
       is one more line that cannot say what it was. */
    if (rows.length) await record(tx, ctx, 'project.icon', { projectId: id })
    return rows.length > 0
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/** Back to the mark that needs no upload. */
projects.delete('/projects/:id/icon', async (c) => {
  const ctx = c.get('ctx')
  if (!allowIn(ctx, 'project.archive', c.req.param('id'))) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update project set icon_key = null
      where id = ${c.req.param('id')} and icon_key is not null
      returning id`
    /* Taking the picture off was not recorded at all — a change anybody can
       see, and nothing in the project's own history saying it happened. */
    if (rows.length) await record(tx, ctx, 'project.icon.remove', { projectId: c.req.param('id') })
  })
  return c.json({ ok: true })
})

projects.get('/projects/deleted', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'project.archive')) return c.json({ error: { code: 'forbidden' } }, 403)
  // Row-level security hides deleted projects from everybody, which is right
  // everywhere except here — so this one reads with the owner's own function.
  const rows = await withActor(ctx.actorId, ctx.workspaceId, (tx) => tx`select * from deleted_projects(${ctx.workspaceId})`)
  return c.json({ projects: rows })
})

projects.post('/projects/:id/restore', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'project.archive')) return c.json({ error: { code: 'forbidden' } }, 403)
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`
      select restore_project(${ctx.workspaceId}, ${id}) as ok`
    return r?.ok === true
  })
  if (done) {
    await withActor(ctx.actorId, ctx.workspaceId, (tx) => record(tx, ctx, 'project.restore', { projectId: id }))
  }
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * Out of the bin for good — `docs/specs/projects-index.md`. Only a project
 * already in the bin, and only by the workspace's owner: `purge_project`
 * asks both itself, and answers no for anything else.
 */
projects.delete('/projects/:id/forever', async (c) => {
  const ctx = c.get('ctx')
  if (!allow(ctx, 'project.archive') || ctx.viaMcp) return c.json({ error: { code: 'forbidden' } }, 403)
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [r] = await tx<{ ok: boolean }[]>`select purge_project(${id}) as ok`
    return r?.ok === true
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/*
 * Declared above `/projects/:id` on purpose: routes match in the order they
 * are added, so a literal path registered after a parameterised one never
 * runs — "deleted" arrives as an id and the database is asked to read it as
 * a uuid.
 */
/**
 * A project, and what this person may do in it.
 *
 * `can` comes with it because `GET /api/me` cannot answer these. Permissions
 * are held on a project now, and a workspace-wide list has no project to
 * hold them against — it would say "no" about a project somebody runs.
 *
 * The front end uses this to hide buttons, which is a convenience. Every
 * endpoint asks again, and the endpoint's answer is the one that counts.
 */
/**
 * What number 41 is, in this project.
 *
 * The address says `/studio/website/tasks/41` and the screen needs the id
 * behind it. One counter per project means one
 * answer whatever the kind, so this is one question rather than three, and
 * the kind comes back with the id because a link that says `tasks/41` about
 * a post is a link that is wrong and should say so.
 *
 * Row-level security bounds it to the workspace; the project bounds it to
 * the project. A number from somebody else's project is `404`, like anything
 * else they cannot see.
 */
projects.get('/projects/:id/at/:number', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('id')
  const number = Number(c.req.param('number'))
  if (!Number.isInteger(number) || number < 1) return c.json({ error: { code: 'invalid' } }, 400)

  /* Of one kind when the address says which — tasks count on their own
     now, so 41 can be a task and a document both. Without it, a task is
     the answer first: `KEY-41` is what a task is called. */
  const kind = c.req.query('kind')
  const wants = (k: string) => !kind || kind === k
  const [row] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      tx<{ id: string; kind: string }[]>`
      select id, kind from (
        select id, 'task' as kind, 0 as rank from task
        where ${wants('task')} and project_id = ${projectId} and number = ${number} and deleted_at is null
        union all
        select id, 'post', 1 from post
        where ${wants('post')} and project_id = ${projectId} and number = ${number} and deleted_at is null
        union all
        select id, 'file', 2 from file
        where ${wants('file')} and project_id = ${projectId} and number = ${number} and deleted_at is null
      ) found order by rank limit 1`,
  )
  return row ? c.json(row) : c.json(missing, 404)
})

projects.get('/projects/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const row = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [p] = await tx`
      select id, slug, key, name, description, tools, archived_at, sample, created_at,
             /* Its instructions for agents, read as the asker reads any
                document of the project. */
             (select json_build_object('id', f.id, 'number', f.number, 'name', f.name) from file f
              where f.project_id = project.id and f.for_agents and f.deleted_at is null) as for_agents
      from project where id = ${id} and deleted_at is null`
    return p
  })
  if (!row) return c.json(missing, 404)
  return c.json({
    ...row,
    can: allowedActions(ctx, { inProject: true, isAuthor: true, rights: ctx.rights[id] ?? [], joined: ctx.rights[id] !== undefined }),
  })
})

projects.patch('/projects/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  /* Sent-as-null and not-sent are the same thing to `coalesce` and opposite
     things for the mark: the first says "back to the hash", the second says
     "leave it". Read once, here, because that difference only exists before
     the schema has had it. */
  const sent = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const setsIcon = 'mark_icon' in sent
  const setsTint = 'mark_tint' in sent
  const body = z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullish(),
      tools: z.array(Tool).nonempty().optional(),
      /* What the mark looks like. */
      mark_icon: MarkIcon.nullish(),
      mark_tint: MarkTint.nullish(),
    })
    .safeParse(sent)
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  if (body.data.tools && !allowIn(ctx, 'project.tools', id)) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }

  const updated = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [was] = await tx<
      {
        name: string
        description: string | null
        tools: string[]
        mark_icon: string | null
        mark_tint: number | null
      }[]
    >`
      select name, description, tools, mark_icon, mark_tint from project
      where id = ${id} and deleted_at is null`
    const rows = await tx<{ id: string }[]>`
      update project set
        name = coalesce(${body.data.name ?? null}, name),
        description = coalesce(${body.data.description ?? null}, description),
        tools = coalesce(${body.data.tools ?? null}::tool_kind[], tools),
        mark_icon = ${setsIcon ? (body.data.mark_icon ?? null) : tx`mark_icon`},
        mark_tint = ${setsTint ? (body.data.mark_tint ?? null) : tx`mark_tint`}
      where id = ${id} and deleted_at is null
      returning id`
    /* Which of the three, and the new name if it is that one. "Dev changed
       the project" eight times over is a log that records that something
       happened and nothing else. */
    const meta: Record<string, unknown> = {}
    if (body.data.name && was && body.data.name !== was.name) {
      meta.renamed = body.data.name
      meta.was = was.name
    }
    /* Empty and never-written are the same emptiness to whoever reads the
       line, so clearing a description that was never there is not a change. */
    const text = body.data.description ?? ''
    if (body.data.description !== undefined && text !== (was?.description ?? '')) {
      meta.described = text.length > 0
    }
    if (body.data.tools && was && body.data.tools.join() !== was.tools.join()) {
      meta.tools = body.data.tools
    }
    /* Which half of the mark moved, and only if it did: picking the colour
       it already was is not a change. */
    if (setsIcon && was && (body.data.mark_icon ?? null) !== was.mark_icon) {
      meta.mark_icon = body.data.mark_icon ?? null
    }
    if (setsTint && was && (body.data.mark_tint ?? null) !== was.mark_tint) {
      meta.mark_tint = body.data.mark_tint ?? null
    }
    /*
     * And nothing is written when nothing changed.
     *
     * `coalesce` means a field set to the value it already had still updates
     * a row, so a screen that saves on blur wrote a line into the log every
     * time somebody put the cursor in a field and took it out again. Eight of
     * them in a row said "changed the project" and could not say what,
     * because there was nothing to say: a log entry that cannot name what it
     * was is one that should not have been written.
     */
    if (rows.length && Object.keys(meta).length > 0) {
      await record(tx, ctx, 'project.update', { projectId: id, meta })
    }
    return rows.length > 0
  })
  return updated ? c.json({ ok: true }) : c.json(missing, 404)
})

projects.post('/projects/:id/archive', async (c) => {
  const ctx = c.get('ctx')
  if (!allowIn(ctx, 'project.archive', c.req.param('id'))) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update project set archived_at = now()
      where id = ${id} and deleted_at is null and archived_at is null
      returning id`
    if (rows.length) await record(tx, ctx, 'project.archive', { projectId: id })
    return rows.length > 0
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * Out of the archive, and out of the list.
 *
 * The design asks for an archive, a bin and restoring from both, so neither of
 * these is the end of anything: archiving hides a project from the sidebar,
 * deleting hides it everywhere, and both are one row's timestamp. Permanent
 * removal is a scheduled job, not a button — a button that cannot be undone
 * is pressed by somebody who meant the other one.
 */
projects.post('/projects/:id/unarchive', async (c) => {
  const ctx = c.get('ctx')
  if (!allowIn(ctx, 'project.archive', c.req.param('id'))) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update project set archived_at = null
      where id = ${id} and deleted_at is null and archived_at is not null
      returning id`
    if (rows.length) await record(tx, ctx, 'project.unarchive', { projectId: id })
    return rows.length > 0
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * Deleting a project is the same permission as archiving it.
 *
 * The permission matrix has one row for both — "archive and delete a project",
 * owner and admin — so this is not a new action, and inventing one would put
 * a row in the matrix that the design does not have.
 */
projects.delete('/projects/:id', async (c) => {
  const ctx = c.get('ctx')
  if (!allowIn(ctx, 'project.archive', c.req.param('id'))) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update project set deleted_at = now()
      where id = ${id} and deleted_at is null
      returning id`
    if (rows.length) await record(tx, ctx, 'project.delete', { projectId: id })
    return rows.length > 0
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * Whether this person runs this project.
 *
 * Staffing a project — who is on it, who is a guest on it, who else runs it
 * — is part of running it. Routed through the owner instead, they would be
 * the bottleneck for work they are not doing.
 */
const mayRun = (ctx: AuthContext, projectId: string): boolean =>
  /* Never through a token: who is on a project and what they may do there
     is a person's decision, the way roles and invitations are. */
  !ctx.viaMcp && allowIn(ctx, 'project.tools', projectId)

/* ------------------------------------------------------- who is on it */

projects.get('/projects/:id/members', async (c) => {
  const ctx = c.get('ctx')
  /* With what each agent says it is doing now. */
  const [rows, doing] = await withActor(ctx.actorId, ctx.workspaceId, (tx) =>
    Promise.all([
      tx`select pm.actor_id, a.name, a.avatar_key, m.role, pm.rights,
              exists (select 1 from agent g where g.actor_id = pm.actor_id and g.deleted_at is null) as agent,
              /* Whose agent it is: who connected it — the panel that chooses
                 a document's people says it under the agent's name. */
              (select c.name from agent g join actor c on c.id = g.created_by
                where g.actor_id = pm.actor_id and g.deleted_at is null) as connected_by_name,
              h.active_at
       from project_member pm
       join actor a on a.id = pm.actor_id
       left join membership m on m.actor_id = pm.actor_id
         and m.workspace_id = ${ctx.workspaceId} and m.deleted_at is null
       left join agents_last_here() h on h.actor_id = pm.actor_id
       where pm.project_id = ${c.req.param('id')} and pm.deleted_at is null
         /* Not the project's feedback page, which is on it only to file
            requests. */
         and not page_actor(pm.actor_id)
       /* People first, the agents under them. */
       order by 6, a.name`,
      statusByAgent(tx),
    ]),
  )
  /* An agent's last visit, which a task it is working on shows. */
  return c.json({
    members: rows.map(({ active_at, connected_by_name, ...r }) => ({
      ...faced(r),
      ...(r.agent
        ? {
            active_at: active_at ? (active_at as Date).toISOString() : null,
            status: doing.get(String(r.actor_id)) ?? null,
            connected_by_name: connected_by_name ?? null,
          }
        : {}),
    })),
  })
})

projects.post('/projects/:id/members', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  if (!allow(ctx, 'project.member.add', { inProject: true })) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }
  const body = z.object({ actor_id: z.uuid(), rights: z.array(Right).optional() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  // Adding a colleague is a member's to do; deciding what they may do here
  // belongs to whoever runs the project. Left out, they arrive with the
  // ordinary two.
  if (body.data.rights && !mayRun(ctx, id)) {
    return c.json({ error: { code: 'forbidden' } }, 403)
  }

  const added = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    /*
     * Only somebody on this project — or the owner — staffs it, and only a
     * project of this workspace. The check above was asked with "on the
     * project" taken as given, and the policy under the insert asks only
     * for a role in the workspace, so any member could put themselves on
     * any project and read everything in it.
     */
    const [on] = await tx<{ ok: boolean }[]>`
      select exists (select 1 from project where id = ${id} and workspace_id = ${ctx.workspaceId}
                       and deleted_at is null) and in_project(${id}) as ok`
    if (!on?.ok) return false
    // A member may only add people who are already in the workspace: bringing
    // somebody new in is people.invite, which they do not have.
    const [already] = await tx<{ actor_id: string }[]>`
      select actor_id from membership
      where workspace_id = ${ctx.workspaceId} and actor_id = ${body.data.actor_id}
        and deleted_at is null`
    if (!already) return false
    /* An agent goes only where whoever connected it is: it is their eyes
       there. The rows' own trigger holds this too. */
    const [outside] = await tx<{ out: boolean }[]>`
      select not (
        exists (select 1 from membership m where m.workspace_id = ${ctx.workspaceId}
                  and m.actor_id = g.created_by and m.role = 'owner' and m.deleted_at is null)
        or exists (select 1 from project_member pm where pm.project_id = ${id}
                     and pm.actor_id = g.created_by and pm.deleted_at is null)) as out
      from agent g where g.actor_id = ${body.data.actor_id} and g.deleted_at is null`
    if (outside?.out) return 'agent' as const
    const fresh = await tx`
      insert into project_member (id, workspace_id, project_id, actor_id, added_by, rights)
      values (${uuidv7()}, ${ctx.workspaceId}, ${id}, ${body.data.actor_id}, ${ctx.actorId},
              ${body.data.rights ?? [...RIGHTS_ON_JOINING]})
      on conflict do nothing
      returning id`
    /* Put on a project, and told so — once, not again for being put on it
       twice. `docs/specs/notifications.md`. */
    if (fresh.length) {
      const who = await doer(tx, ctx.actorId)
      await notify(tx, ctx, {
        objectType: 'project',
        objectId: id,
        watchers: false,
        what: (l) => LINES(l).addedYou(who(l)),
        kind: 'added',
        also: { ids: [body.data.actor_id], reason: 'added' },
      })
    }
    await record(tx, ctx, 'project.member.add', { projectId: id, meta: { actor_id: body.data.actor_id } })
    return true
  })
  if (added === 'agent') {
    return c.json({ error: { code: 'forbidden', message: 'An agent can only join projects the person who connected it is on.' } }, 403)
  }
  return added ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * What somebody may do on this project.
 *
 * A list of permissions, not a sort of person. Client, then guest, then
 * admin were each a category, and each was taken back: what anybody wants
 * to say is "this person may delete tasks here", and now that is what is
 * stored.
 *
 * Settled by whoever already runs the project, because deciding who may do
 * what is part of running it, and by the owner, who runs all of them.
 *
 * Not on yourself: giving up `manage` takes away the permission needed to
 * take it back, which is a door that locks behind whoever walks through it.
 * The first person that happened to was the only owner of the workspace,
 * one click after the box existed.
 *
 * And not on an owner. There is nobody above them to undo it, and they hold
 * everything everywhere already.
 */
projects.patch('/projects/:id/members/:actorId', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  if (!mayRun(ctx, id)) return c.json({ error: { code: 'forbidden' } }, 403)
  const body = z.object({ rights: z.array(Right) }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const actorId = c.req.param('actorId')
  if (actorId === ctx.actorId) {
    return c.json({ error: { code: 'invalid', message: 'You can’t change your own permissions.' } }, 400)
  }
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [them] = await tx<{ role: string }[]>`
      select role from membership
      where workspace_id = ${ctx.workspaceId} and actor_id = ${actorId}
        and deleted_at is null`
    if (them?.role === 'owner') return 'owner'
    const rows = await tx`
      update project_member set rights = ${body.data.rights}, updated_at = now()
      where project_id = ${id} and actor_id = ${actorId} and deleted_at is null
      returning id`
    if (!rows.length) return false
    await record(tx, ctx, 'project.member.rights', {
      projectId: id,
      meta: { actor_id: actorId, rights: body.data.rights },
    })
    return true
  })
  if (done === 'owner') {
    return c.json({ error: { code: 'invalid', message: 'Owners already have every permission.' } }, 400)
  }
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * Taking somebody off a project.
 *
 * `project.member.remove`, which is running the project rather than adding
 * to it. It asked `project.member.add` for a while, while the row's policy
 * under the update (`pm_update`) asked whether the caller runs the project
 * — so a member who may add and does not run it was answered 200 and
 * nobody left.
 *
 * The owner does it without being on the project. Somebody who is not on
 * it, or a project that is not here, is 404: a removal that removed nobody
 * is not a success.
 */
projects.delete('/projects/:id/members/:actorId', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const target = c.req.param('actorId')
  /*
   * Yourself is leaving, which is anybody's on the project — `project.leave`,
   * Whoever runs it may
   * still take themselves off as they take off anybody else.
   */
  const leaving = target === ctx.actorId
  const joined = ctx.rights[id] !== undefined
  const removes = allowIn(ctx, 'project.member.remove', id)
  /* Leaving a project you are not on removes nobody — 404, as a removal
     that removed nobody is, and the same answer a project that is not
     yours gets. */
  if (leaving && !joined && !removes) return c.json(missing, 404)
  const may = removes || (leaving && allowIn(ctx, 'project.leave', id, { joined }))
  if (!may) return c.json({ error: { code: 'forbidden' } }, 403)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const gone = await tx`
      update project_member set deleted_at = now()
      where workspace_id = ${ctx.workspaceId} and project_id = ${id}
        and actor_id = ${target} and deleted_at is null
      returning id`
    if (!gone.length) return false
    // A line in the feed only for a removal that happened.
    await record(tx, ctx, leaving ? 'project.leave' : 'project.member.remove', {
      projectId: id,
      /* Whom, for the audit log's "by or about". */
      meta: { actor_id: target },
    })
    return true
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})
