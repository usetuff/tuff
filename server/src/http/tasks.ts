import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { RichBody } from './body.js'
import { ListColor, ListIcon, Priority, Repeat } from '@tracker/shared-schema'
import { v7 as uuidv7 } from 'uuid'
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { withActor, type Tx } from '../db.js'
import { facedAs, faceLink, linkFor, linkForReader } from '../storage.js'
import { fenced, markdown, QUOTED, type Linked } from '../prompt.js'
import { oneLine } from '../text.js'
import { origin as originOf } from './access.js'
import { allowIn, type AuthContext } from '../auth/context.js'
import { record } from './activity.js'
import { LINES, doer, linkMentionedObjects, mentionedIds, notify, shortDay, veilDocrefs, type Kind, type Line } from '../notify.js'
import { addComment, commentCursor, commentsIn, forbidden, isInProject, mayEdit, mayTakeBack, missing, subscribe } from './objects.js'
import { pageSize } from './limits.js'
import { roomFor, storageRefusal } from '../ceilings.js'
import { relationsOf, tellUnblocked, waitingOnNow, type Waiting } from './blocks.js'
import { makeNext, ruleToStore, takeNextBack, type Finished } from '../repeat.js'
import { used } from './used.js'
import { liveStatuses } from '../doing.js'

type Vars = { ctx: AuthContext }
export const tasks = new Hono<{ Variables: Vars }>()

/**
 * The words a task is being made with.
 *
 * In here rather than in `objects.ts`, where the helpers common to all four
 * entities live: a label is on a task and on nothing else, and putting it
 * beside `subscribe` would say otherwise.
 *
 * One function because there are two ways to make a task — a task and a part
 * of one — and only one of them did this. The other answered 201 with the
 * labels dropped, which a caller cannot tell from success. `PATCH` has its
 * own version of this and keeps it: it sends the set as a statement about
 * what is true afterwards, so it has to work out what to remove as well, and
 * nothing is ever on a task that is being created.
 */
/**
 * Whether every one of these is a live label of this project.
 *
 * A label is its project's, so a task can carry only its own project's —
 * an id from another project's vocabulary is refused, not quietly kept, or
 * the picker would draw a word the project does not have. `071`.
 */
export async function labelsBelong(tx: Tx, projectId: string, labels: readonly string[] | null | undefined): Promise<boolean> {
  const ids = [...new Set(labels ?? [])]
  if (!ids.length) return true
  const [found] = await tx<{ n: number }[]>`
    select count(*)::int as n from label
    where id in ${tx(ids)} and project_id = ${projectId} and deleted_at is null`
  return (found?.n ?? 0) === ids.length
}

/*
 * Whoever a task is given to is somebody on its project, or the owner, who
 * is on all of them. Any id at all was taken — somebody from another
 * company included, who was written a notification here, and the answer
 * said whether the id was anybody's.
 */
export async function assigneesBelong(
  tx: Tx,
  ctx: AuthContext,
  projectId: string,
  assignees: readonly string[] | undefined,
): Promise<boolean> {
  if (!assignees?.length) return true
  const [found] = await tx<{ n: number }[]>`
    select count(*)::int as n from membership m
    where m.workspace_id = ${ctx.workspaceId} and m.actor_id = any(${assignees as string[]}::uuid[])
      and m.deleted_at is null and m.joined_at is not null
      /* Not a feedback page's actor, which is on the project to file
         requests and is nobody to give work to. */
      and not page_actor(m.actor_id)
      and (m.role = 'owner' or exists (
        select 1 from project_member pm
        where pm.project_id = ${projectId} and pm.actor_id = m.actor_id and pm.deleted_at is null))`
  return found?.n === assignees.length
}

/**
 * The agent a list gives a task to that arrives in it with nobody on it.
 * Null when the list names none, finishes
 * work, or names an agent that has since left the project or been
 * disconnected (kept on the list and ignored, so its settings can say so);
 * and null for what is nobody's — GitHub, an import, a board's guest, a
 * feedback page — which wakes no agent either (`agents.md`). The agent is
 * asked what anybody given a task is asked (`assigneesBelong`); whoever
 * made or moved the task was asked their own right by the caller.
 */
export async function listTaker(tx: Tx, ctx: AuthContext, projectId: string, listId: string | null | undefined): Promise<string | null> {
  if (!listId) return null
  if (ctx.viaGithub || ctx.viaImport || ctx.board || ctx.feedbackPage) return null
  const [l] = await tx<{ agent_id: string }[]>`
    select l.agent_id from task_list l
    join agent g on g.actor_id = l.agent_id and g.workspace_id = l.workspace_id and g.deleted_at is null
    where l.id = ${listId} and l.project_id = ${projectId} and l.deleted_at is null and not l.finishes`
  if (!l) return null
  return (await assigneesBelong(tx, ctx, projectId, [l.agent_id])) ? l.agent_id : null
}

/**
 * Who a write puts on the task. `assignee_ids` is
 * the whole list, in order, and replaces what was there. `assignee_id` is
 * what the apps already in people's hands send: one person, which is the
 * list of that one, or nobody. Undefined is "not said", which changes
 * nothing; the same person twice is once.
 */
export function assigneesOf(d: {
  assignee_ids?: string[] | null | undefined
  assignee_id?: string | null | undefined
}): string[] | undefined {
  if (d.assignee_ids !== undefined) return [...new Set(d.assignee_ids ?? [])]
  if (d.assignee_id !== undefined) return d.assignee_id ? [d.assignee_id] : []
  return undefined
}

async function putLabelsOn(tx: Tx, ctx: AuthContext, taskId: string, labels: readonly string[] | null | undefined): Promise<void> {
  if (!labels?.length) return
  await tx`
    insert into task_label ${tx(
      labels.map((labelId) => ({
        id: uuidv7(),
        workspace_id: ctx.workspaceId,
        task_id: taskId,
        label_id: labelId,
      })),
      'id',
      'workspace_id',
      'task_id',
      'label_id',
    )}
    on conflict (task_id, label_id) do nothing`
}

/**
 * One row behind three views.
 *
 * A task, a board card and a calendar event are the same thing: the list reads
 * `list_id` and `sort_key`, the board draws those same lists as its columns,
 * the calendar reads `starts_at`. Nothing here is view-specific except which fields a view cares
 * about, which is why switching views cannot lose anything.
 */
const Body = z.object({
  title: z.string().min(1).max(300),
  body: RichBody.nullish(),
  list_id: z.uuid().nullish(),

  /* Which stretch of dates it is in, or nothing.
     Null is the ordinary state and not an unanswered question: most work in
     a product shaped like this one is not in a sprint. */
  cycle_id: z.uuid().nullish(),

  /* Whoever it is given to, in order: the whole list, replacing what was
     there. `assignee_id` is one person, from the
     apps that know only one. */
  assignee_ids: z.array(z.uuid()).max(10).nullish(),
  assignee_id: z.uuid().nullish(),
  due_on: z.iso.date().nullish(),
  /* A word, not a number. */
  priority: Priority.nullish(),
  /*
   * The whole set, not an add and a remove.
   *
   * A task carries the labels it carries; sending the set is one statement
   * about what is true, and two endpoints for "put one on" and "take one off"
   * are two ways for a screen and a server to disagree about a list nobody
   * can see.
   */
  labels: z.array(z.uuid()).nullish(),
  starts_at: z.iso.datetime({ offset: true }).nullish(),
  ends_at: z.iso.datetime({ offset: true }).nullish(),

  /*
   * The task this one is a part of.
   *
   * On create and never on `PATCH`. Re-parenting
   * is a gesture nobody asked for, and a task that can become a part of
   * anything is a task that can be moved into a project it does not belong
   * to. One level: the trigger refuses a parent that has a parent, so the
   * rule holds for whatever reaches the table next.
   */
  parent_id: z.uuid().nullish(),

  /* How it repeats, or null to stop. Stored
     whole: a part left out is read off the due date it is saved with. */
  repeat: Repeat.nullish(),
})

/** A uuid as the database writes one. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** And a moment as it writes one as text: `2026-11-14 09:30:00.123456+00`. */
const MOMENT_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/

/**
 * What each picture in a body says about itself — its file and the size it
 * was measured at — in the order they are written. Strict, because lax unwraps arrays on the
 * way down and `.**` then finds a node twice.
 */
const PICTURE_ATTRS = 'strict $.** ? (@.type == "attachment" && @.attrs.kind == "image").attrs'

type Said = { fileId?: unknown; pixelWidth?: unknown; pixelHeight?: unknown }

/*
 * A task as the project's list draws it — the list's own read, and the next
 * one of a series handed back with the move that made it, so the screen
 * draws it without reading the project again. One set of columns for both.
 */
const listColumns = (tx: Tx) => tx`
      t.id, t.number, t.title, t.list_id, t.assignee_ids, t.assignee_id, t.due_on,
             t.priority, t.starts_at, t.ends_at, t.sort_key, t.cycle_id,
             t.completed_at, t.decided_at, t.author_id, t.parent_id, t.updated_at,
             t.created_at, t.repeat,
             /* The start of its description as plain words, kept by the
                database beside the body (migration 332) -- not the body,
                which a list of ten thousand would carry whole. */
             t.excerpt,
             /* The words on it, with the list rather than behind a second
                request: a label is drawn on the row, so a screen that has the
                rows and not the labels is a screen drawn twice.
                No backticks in here -- this is inside a
                template literal, and one ends it. */
             coalesce((select json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color)
                                       order by l.name)
                       from task_label tl join label l on l.id = tl.label_id
                       where tl.task_id = t.id and l.deleted_at is null), '[]') as labels,
             /* What it waits on that is still open, by handle, and only
                what this reader can see: the table's policy hides a
                relation whose other end is out of sight. */
             coalesce((select json_agg(bp.key || '-' || b.number order by tb.created_at, b.id)
                       from task_block tb
                       join task b on b.id = tb.blocker_id
                       join project bp on bp.id = b.project_id
                       where tb.task_id = t.id and b.deleted_at is null and b.completed_at is null
                         and bp.deleted_at is null), '[]') as waiting_on`

/** A file a picture names, as this reader may open it. */
type Readable = { id: string; key: string; pixel_width: number | null; pixel_height: number | null }
/** What a row says about its pictures before the files are asked. */
type Pictured = { body_pics?: Said[]; comment_pics?: Said[] }

/* The pictures in its description, and those in its comments, the oldest
   comment first: what each says, not yet whether this reader may open it.
   No backticks in here. */
const pictureColumns = (tx: Tx) => tx`,
             jsonb_path_query_array(coalesce(t.body, '{}'::jsonb), ${PICTURE_ATTRS}::jsonpath) as body_pics,
             (select coalesce(jsonb_agg(p.a order by c.created_at, c.id, p.o), '[]'::jsonb)
              from comment c
              cross join lateral jsonb_path_query(c.body, ${PICTURE_ATTRS}::jsonpath) with ordinality p(a, o)
              where c.object_type = 'task' and c.object_id = t.id and c.deleted_at is null) as comment_pics`

/*
 * And which of those files this reader may open, in one read under their
 * own policies: a file they may not see is not answered, and the task
 * shows its next picture instead. Only a file that is a picture by its
 * bytes (uploads.md) and is still there.
 *
 * Asked apart rather than joined picture by picture: joined, the planner
 * read the files once per task through a memo keyed on the whole body, and
 * a page deep in ten thousand tasks took 800 ms under pnpm load.
 */
async function readableFiles(tx: Tx, rows: Pictured[]): Promise<Map<string, Readable>> {
  const ids = new Set<string>()
  for (const r of rows)
    for (const said of [...(r.body_pics ?? []), ...(r.comment_pics ?? [])])
      if (typeof said.fileId === 'string' && UUID_RE.test(said.fileId)) ids.add(said.fileId.toLowerCase())
  const files = ids.size
    ? await tx<Readable[]>`
        select f.id, coalesce(f.display_key, f.storage_key) as key, f.pixel_width, f.pixel_height
        from file f
        where f.id = any(${[...ids]}::uuid[]) and f.deleted_at is null and f.storage_key is not null
          and f.content_type like 'image/%'`
    : []
  return new Map(files.map((f) => [f.id, f]))
}

/* A measured size, as the editor writes it: a positive number. */
const sized = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null)

/*
 * The row with its first picture the reader may open — the description's
 * first, then the comments', in the order they were written — and without
 * what was read to find it.
 */
function withPicture<T extends Pictured>(row: T, readable: Map<string, Readable>, actorId: string) {
  const { body_pics, comment_pics, ...t } = row
  let found: { file: Readable; said: Said } | null = null
  for (const said of [...(body_pics ?? []), ...(comment_pics ?? [])]) {
    const file = typeof said.fileId === 'string' ? readable.get(said.fileId.toLowerCase()) : undefined
    if (file) {
      found = { file, said }
      break
    }
  }
  if (!found) return t
  /* The copy for showing, signed for this reader, as Docs draws it — the
     keys themselves do not leave. The file's own size, or the one measured
     when it was put in; a size only when both halves are known, because
     half a size reserves nothing. */
  const w = found.file.pixel_width ?? sized(found.said.pixelWidth)
  const h = found.file.pixel_height ?? sized(found.said.pixelHeight)
  const both = w !== null && h !== null && w > 0 && h > 0
  return {
    ...t,
    picture: {
      file_id: found.file.id,
      thumb_url: linkForReader(found.file.key, actorId),
      width: both ? w : null,
      height: both ? h : null,
    },
  }
}

/**
 * Rows of the project's list as its own read draws them, pictures and all
 * — handed back by a write, so the screen that made it puts them in place
 * rather than reading the project again. By id, in
 * the order asked, or a task's parts in theirs.
 */
export async function listRows(tx: Tx, actorId: string, which: { ids: string[] } | { parent: string }): Promise<Record<string, unknown>[]> {
  if ('ids' in which && which.ids.length === 0) return []
  const rows = await tx<(Pictured & { id: string } & Record<string, unknown>)[]>`
    select ${listColumns(tx)} ${pictureColumns(tx)}
    from task t
    where t.deleted_at is null
      and ${'ids' in which ? tx`t.id = any(${which.ids}::uuid[])` : tx`t.parent_id = ${which.parent}`}
    order by t.sort_key, t.id`
  const readable = await readableFiles(tx, rows)
  const out = rows.map((r) => withPicture(r, readable, actorId))
  if (!('ids' in which)) return out
  const at = new Map(which.ids.map((id, i) => [id, i]))
  return out.sort((a, b) => (at.get(a.id as string) ?? 0) - (at.get(b.id as string) ?? 0))
}

/*
 * One list's tasks, or the head of every list, rather than the project.
 * A board whose Done held a hundred and sixty
 * cards drew them all on a phone, and Safari ended the page.
 *
 * Only tasks that are not parts are paged, in the list's own order
 * (`sort_key`, then `id`, which is unique and orders the same way); the
 * parts of a page come after it in the same answer, whatever list they are
 * in, so a card's count of them and the list's rows under their parent are
 * whole. `total` is how many the list holds, parts left out, which is what
 * a column's head counts.
 */
const topRows = (tx: Tx) => tx`t.parent_id is null and t.deleted_at is null`

async function partsOf(tx: Tx, parents: string[], pictures: boolean) {
  if (parents.length === 0) return []
  return tx<({ id: string } & Pictured & Record<string, unknown>)[]>`
    select ${listColumns(tx)} ${pictures ? pictureColumns(tx) : tx``}
    from task t
    where t.parent_id = any(${parents}::uuid[]) and t.deleted_at is null
    order by t.parent_id, t.sort_key, t.id`
}

async function byList(c: Context<{ Variables: Vars }>, listId: string | null) {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')!
  const pictures = c.req.query('pictures') === '1'
  const limit = pageSize(c.req.query('limit'), 50, 200)
  const cursor = c.req.query('cursor')
  let at: { key: string; id: string } | null = null
  if (cursor) {
    const cut = cursor.lastIndexOf('|')
    if (listId === null || cut === -1 || !UUID_RE.test(cursor.slice(cut + 1))) return c.json({ error: { code: 'invalid' } }, 400)
    at = { key: cursor.slice(0, cut), id: cursor.slice(cut + 1) }
  }
  type Row = { id: string; sort_key: string; list_id: string } & Pictured & Record<string, unknown>
  const answer = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    /* The list has to be this project's and in sight: another project's
       list, or one this reader cannot see, is not there — a 404, not a
       403, as everywhere. */
    const lists = await tx<{ id: string; total: number }[]>`
      select l.id,
             (select count(*)::int from task t where t.list_id = l.id and ${topRows(tx)}) as total
      from task_list l
      where l.project_id = ${projectId} and l.deleted_at is null
        ${listId ? tx`and l.id = ${listId}` : tx``}
      order by l.sort_key`
    if (listId && lists.length === 0) return null
    /* One more than the page, to know whether there is a next one without
       handing out a cursor to an empty page. */
    const rows = listId
      ? await tx<Row[]>`
          select ${listColumns(tx)} ${pictures ? pictureColumns(tx) : tx``}
          from (
            select t.* from task t
            where t.list_id = ${listId} and ${topRows(tx)}
              ${at ? tx`and (t.sort_key, t.id) > (${at.key}, ${at.id}::uuid)` : tx``}
            order by t.sort_key, t.id
            limit ${limit + 1}
          ) t
          order by t.sort_key, t.id`
      : /* Every list's first page in one read: the board's first draw is
           one round trip, not one per column. */
        await tx<Row[]>`
          select ${listColumns(tx)} ${pictures ? pictureColumns(tx) : tx``}
          from task_list l
          cross join lateral (
            select t.* from task t
            where t.list_id = l.id and ${topRows(tx)}
            order by t.sort_key, t.id
            limit ${limit + 1}
          ) t
          where l.project_id = ${projectId} and l.deleted_at is null
          order by l.sort_key, t.sort_key, t.id`
    /* Each list's page and whether it ran over. */
    const pages = new Map<string, { rows: Row[]; more: boolean }>()
    for (const r of rows) {
      const page = pages.get(r.list_id) ?? { rows: [], more: false }
      if (page.rows.length < limit) page.rows.push(r)
      else page.more = true
      pages.set(r.list_id, page)
    }
    const kept = [...pages.values()].flatMap((p) => p.rows)
    const parts = await partsOf(
      tx,
      kept.map((r) => r.id),
      pictures,
    )
    const readable = pictures ? await readableFiles(tx, [...kept, ...parts]) : new Map<string, Readable>()
    return { lists, pages, kept, parts, readable }
  })
  if (!answer) return c.json(missing, 404)
  const { lists, pages, kept, parts, readable } = answer
  const drawn = [...kept, ...parts].map((t) => (pictures ? withPicture(t, readable, ctx.actorId) : t))
  const next = (id: string) => {
    const page = pages.get(id)
    const last = page?.rows[page.rows.length - 1]
    return page?.more && last ? `${last.sort_key}|${last.id}` : null
  }
  if (listId) return c.json({ tasks: drawn, next_cursor: next(listId), total: lists[0]!.total })
  return c.json({ tasks: drawn, lists: lists.map((l) => ({ id: l.id, total: l.total, next_cursor: next(l.id) })) })
}

tasks.get('/projects/:projectId/tasks', async (c) => {
  /* By list. Not with `order=created`,
     which is the project's own order across every list. */
  const oneList = c.req.query('list')
  if (oneList !== undefined || c.req.query('by') === 'list') {
    if (c.req.query('order') === 'created') return c.json({ error: { code: 'invalid' } }, 400)
    if (oneList !== undefined && !UUID_RE.test(oneList)) return c.json({ error: { code: 'invalid' } }, 400)
    return byList(c, oneList?.toLowerCase() ?? null)
  }
  const ctx = c.get('ctx')
  const limit = pageSize(c.req.query('limit'), 200, 500)
  /*
   * Newest first, by when each was made.
   * Absent is the order the rows were put in, which is
   * what every client already in somebody's hands reads.
   */
  const created = c.req.query('order') === 'created'
  const oldest = created && c.req.query('dir') === 'asc'
  /* A card's picture, only when asked: a client that does not draw one
     does not pay for finding it. */
  const pictures = c.req.query('pictures') === '1'
  /*
   * `key|id`, and a bare key from an older client still works.
   *
   * A cursor written before this change carries only the key. Paired with
   * the zero uuid it means "after this key and the lowest possible id",
   * so the rows that share that key are included rather than skipped —
   * which is the behaviour that was wanted all along. The worst it can do
   * is repeat a row the old client had already seen, and repeating is the
   * safe direction for a cursor to be wrong in.
   *
   * Ordered by creation it is `created_at|id`, the time as the database
   * wrote it, to the microsecond: a time read back through a JavaScript
   * date loses three digits, and the page boundary with them. Sent back as
   * text and cast in the query, for the same reason: cast as a timestamp,
   * the driver put it through a Date.
   */
  /*
   * Open work first: in the order the rows were put in, every task not done
   * comes before every task done, so the first page holds what the board
   * and the list draw before anybody scrolls to Done. A project of two
   * hundred and ten drew two hundred and then, a second later, the in-
   * progress card the page boundary had cut. The cursor says which side of
   * that line it stopped on — `o:` or `d:` before `key|id`; one without
   * either is an older client's, read as still among the open.
   */
  const cursor = c.req.query('cursor')
  const at = cursor
    ? (() => {
        const side = cursor.startsWith('d:') ? true : cursor.startsWith('o:') ? false : null
        const rest = side === null ? cursor : cursor.slice(2)
        const cut = rest.lastIndexOf('|')
        return {
          done: side ?? false,
          ...(cut === -1
            ? { key: rest, id: '00000000-0000-0000-0000-000000000000' }
            : { key: rest.slice(0, cut), id: rest.slice(cut + 1) }),
        }
      })()
    : null
  if (created && at && (!UUID_RE.test(at.id) || !MOMENT_RE.test(at.key))) {
    return c.json({ error: { code: 'invalid' } }, 400)
  }
  type Row = { id: string; sort_key: string; created_mark?: string } & Pictured & Record<string, unknown>
  const [rows, readable] = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const order = () =>
      !created
        ? tx`order by (t.completed_at is not null), t.sort_key, t.id`
        : oldest
          ? tx`order by t.created_at, t.id`
          : tx`order by t.created_at desc, t.id desc`
    const page = await tx<Row[]>`
      select ${listColumns(tx)}
             ${created ? tx`, t.created_at::text as created_mark` : tx``}
             ${pictures ? pictureColumns(tx) : tx``}
      /*
       * The page first, and only then what is read for each row of it.
       *
       * Asked of every row the cursor leaves and sorted afterwards, what is
       * read for each row was worked out for the whole rest of the project
       * to keep five hundred of it, where the first page's index order let
       * the limit stop early. No backticks in here.
       */
      from (
        select t.* from task t
        where t.project_id = ${c.req.param('projectId')} and t.deleted_at is null
          ${
            !at
              ? tx``
              : !created
                ? tx`and ((t.completed_at is not null), t.sort_key, t.id) > (${at.done}, ${at.key}, ${at.id}::uuid)`
                : oldest
                  ? tx`and (t.created_at, t.id) > (${at.key}::text::timestamptz, ${at.id}::uuid)`
                  : tx`and (t.created_at, t.id) < (${at.key}::text::timestamptz, ${at.id}::uuid)`
          }
        ${order()}
        limit ${limit}
      ) t
      ${order()}`
    if (!pictures) return [page, new Map<string, Readable>()] as const
    return [page, await readableFiles(tx, page)] as const
  })
  const last = rows[rows.length - 1]
  return c.json({
    tasks: rows.map(({ created_mark: _mark, ...t }) => (pictures ? withPicture(t, readable, ctx.actorId) : t)),
    /*
     * The key and the id, because the key alone is no longer unique here.
     *
     * A `sort_key` is unique inside a column and deliberately repeats
     * across them — two columns both start at `a0`. This query spans the
     * project, so `sort_key > cursor` stepped over every row that shared
     * its key with the last row of a page. Measured on a project with
     * three keys repeated across columns: 49 of 52 tasks came back, three
     * missing, and the cards that vanished were the ones whose order
     * looked wrong.
     *
     * `(sort_key, id)` is unique by construction and orders the same way,
     * so the page boundary cannot swallow a row. The id is the tiebreak
     * only; nothing reads it as an order.
     */
    next_cursor:
      rows.length === limit && last
        ? created
          ? `${last.created_mark}|${last.id}`
          : `${last.completed_at ? 'd' : 'o'}:${last.sort_key}|${last.id}`
        : null,
  })
})

tasks.post('/projects/:projectId/tasks', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  // `task.create`, not the general write: it is held on this project and can
  // be taken away here without taking away posting.
  if (!allowIn(ctx, 'task.create', projectId)) return c.json(forbidden, 403)

  const body = Body.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const id = uuidv7()
  let number: number | null = null
  const made = await flat(() =>
    withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      if (!(await isInProject(tx, projectId))) return 'missing' as const
      /* Not while Linear's issues are still coming: the number a task made
       now would take is one a page still to come needs, and its old link
       would open this instead. */
      const [busy] = await tx<{ on: boolean }[]>`select project_importing(${projectId}) as on`
      if (busy?.on) return 'importing' as const
      /*
       * A part is keyed among its parent's parts, not among the project's
       * tasks. Keyed globally it would sort to the end of the project and the
       * list would have to re-find it under its parent every draw.
       */
      const parent = body.data.parent_id ?? null
      /*
       * A new task goes to the top; a new part goes to the end.
       *
       * Not the same answer, because they are not the same thing. A list or a
       * column is a pile, and the row somebody has just typed is the one they
       * are looking for — appended, it landed under sixteen others and off the
       * bottom of the column, so making one looked like making nothing. Parts
       * are the steps of one task, written in the order they happen, and a
       * step that jumps above the one before it is the list rearranging what
       * somebody said.
       */
      /* A part inherits where its parent lives: a subtask in a different list
       from its parent cannot be drawn under it, and the list is the board's
       column now too. */
      const [into] = parent
        ? await tx<{ list_id: string | null; parent_id: string | null }[]>`
          select list_id, parent_id from task
          where id = ${parent} and project_id = ${projectId} and deleted_at is null
          /* Held while this is made: a parent being put under another task
             at the same moment waits, then sees this subtask and refuses. */
          for share`
        : [undefined]
      if (parent && !into) return 'missing' as const
      /* Asked here as well as in the trigger. The trigger is what makes the
       rule true for the importer and the seed; this is what makes it an
       answer rather than a 500 — a constraint reaching the caller as a
       stack trace is a rule nobody can act on. */
      if (into?.parent_id) return 'nested' as const
      /* A part's steps come with its task; a part does not repeat on its own. */
      if (parent && body.data.repeat) return 'part_repeat' as const
      if (!(await labelsBelong(tx, projectId, body.data.labels))) return 'labels' as const
      const assignees = assigneesOf(body.data) ?? []
      if (!(await assigneesBelong(tx, ctx, projectId, assignees))) return 'assignee' as const
      /* A sprint of this project, the way the labels are this project's: a
       task in another project's sprint is drawn in neither. */
      if (body.data.cycle_id) {
        const [ours] = await tx`
        select 1 from cycle
        where id = ${body.data.cycle_id} and project_id = ${projectId} and deleted_at is null`
        if (!ours) return 'cycle' as const
      }

      /*
       * Somewhere to be, always.
       *
       * The list is the only placement now, so a task without one is a task
       * that is in no column of the board and under no heading in the list —
       * it exists and is nowhere. Whoever asks names a list or gets the first
       * one, and the rule lives here rather than in each of the three clients.
       */
      /* And with Triage on, what a token makes — an agent, GitHub — waits
       there to be accepted; what a person makes by hand does not, and goes
       to the first list after it. */
      const lists = await tx<{ id: string; intake: boolean }[]>`
      select id, intake from task_list
      where project_id = ${projectId} and deleted_at is null
      order by sort_key`
      const intake = lists.find((l) => l.intake)
      /* And what a feedback page files. */
      const fromOutside = ctx.viaMcp || Boolean(ctx.viaGithub) || ctx.feedbackPage === true
      const firstList = (fromOutside && intake) || lists.find((l) => !l.intake) || lists[0]
      const into_list = into ? into.list_id : (body.data.list_id ?? firstList?.id ?? null)
      /* Made with nobody on it in a list an agent takes: given to that
         agent, as the person's own assignment.
         Never a subtask, which is a step of its task. */
      if (!parent && assignees.length === 0) {
        const taker = await listTaker(tx, ctx, projectId, into_list)
        if (taker) assignees.push(taker)
      }

      /*
       * The edge of the column it is going into, not of the project.
       *
       * This asked the whole project for its topmost key and put the new
       * task above that — which gives every column the same answer, so a
       * task made in each of ten columns got the same `sort_key` in all
       * ten. Measured on the demo data: one key shared by ten cards in ten
       * different columns, and the same for the four keys under it.
       *
       * Inside one column that was invisible, because the duplicates were
       * in other columns. Carrying a card into one of them is what shows
       * it: the card arrives holding a key another card already has, the
       * order between two equal keys is whatever Postgres returns, and the
       * card appears to jump somewhere nobody put it.
       *
       * A key is only ever compared against the keys in its own column, so
       * the edge has to be read there. A part is still keyed among its
       * siblings, which is the same rule — the group it is ordered within.
       */
      const [edge] = await tx<{ sort_key: string }[]>`
      select sort_key from task
      where project_id = ${projectId} and deleted_at is null
        ${parent ? tx`and parent_id = ${parent}` : tx`and parent_id is null and list_id is not distinct from ${into_list}`}
      order by sort_key ${parent ? tx`desc` : tx`asc`} limit 1`
      // A fractional key, so dragging one card rewrites one row rather than half
      // the table.
      const sortKey = parent ? generateKeyBetween(edge?.sort_key ?? null, null) : generateKeyBetween(null, edge?.sort_key ?? null)

      const rule = await ruleToStore(tx, ctx, body.data.repeat ?? null, body.data.due_on ?? null)
      /* A draft it names is named without its title. */
      if (body.data.body) body.data.body = await veilDocrefs(tx, body.data.body)
      await tx`
      insert into task (id, workspace_id, project_id, author_id, parent_id, list_id,
                        title, body, assignee_ids, due_on, priority, starts_at, ends_at,
                        cycle_id, sort_key, repeat)
      values (${id}, ${ctx.workspaceId}, ${projectId}, ${ctx.actorId}, ${parent},
              ${into_list},
              ${body.data.title}, ${body.data.body ? tx.json(body.data.body as never) : null},
              ${assignees}::uuid[], ${body.data.due_on ?? null},
              ${body.data.priority ?? null}::task_priority,
              ${body.data.starts_at ?? null}, ${body.data.ends_at ?? null},
              /* Validated and then dropped, as the labels once were: the
                 sprint was in the schema and never in the row. */
              ${body.data.cycle_id ?? null}, ${sortKey}, ${rule ? tx.json(rule as never) : null})`
      /*
       * The words on it, which this did not write.
       *
       * `labels` was in the schema, validated, and then dropped on the floor:
       * the request answered 201 and the task had none. Making a part — the
       * handler further down this file — has written them since it was added,
       * so the fault was one endpoint of two, in the one direction that
       * matters: every client and the MCP layer create tasks through here.
       *
       * Found by creating thirty-six tasks against the deployed app and
       * counting the labels, which is also the only way it could be found: a
       * 201 with nothing missing from it looks exactly like success.
       */
      await putLabelsOn(tx, ctx, id, body.data.labels)
      await subscribe(tx, ctx, 'task', id)
      /* What a feedback page files is a stranger's words, and words only: an
       `@<id>` or a `/tasks/<id>` spelled out in them mentions nobody and
       links nothing. Nobody outside may ring a
       member's phone by knowing their id. */
      const said = ctx.feedbackPage ? undefined : body.data.body
      await linkMentionedObjects(tx, ctx, { type: 'task', id }, said)
      const who = await doer(tx, ctx.actorId)
      await notify(tx, ctx, {
        objectType: 'task',
        objectId: id,
        body: said,
        assignees,
        whatFor: { assigned: (l) => LINES(l).gaveYou(who(l)) },
      })
      /* With who it was given to, by id: an agent's week counts what it
         took from these lines. */
      await record(tx, ctx, 'task.create', {
        projectId,
        objectType: 'task',
        objectId: id,
        ...(assignees.length ? { meta: { given_ids: assignees } } : {}),
      })
      /* Its number, which the trigger gave it, so the screen that made it can
       open it at the address a person reads. */
      const [n] = await tx<{ number: number }[]>`select number from task where id = ${id}`
      number = n?.number ?? null
      return 'ok' as const
    }),
  )
  if (made === 'has_subtasks' || made === 'invalid_nest') return c.json(missing, 404)
  if (made === 'importing') {
    return c.json({ error: { code: 'conflict', message: 'This project is still being imported. Try again when it’s done.' } }, 409)
  }
  if (made === 'nested') {
    return c.json({ error: { code: 'invalid', message: 'A subtask can’t have subtasks.' } }, 400)
  }
  if (made === 'labels') return c.json({ error: { code: 'invalid', message: 'That label belongs to another project.' } }, 400)
  if (made === 'assignee') return c.json(notOnIt, 400)
  if (made === 'part_repeat') return c.json(partRepeats, 400)
  if (made === 'cycle') return c.json({ error: { code: 'invalid', message: 'That sprint belongs to another project.' } }, 400)
  return made === 'ok' ? c.json({ id, number }, 201) : c.json(missing, 404)
})

/* A subtask is repeated with its task, never on its own. */
const partRepeats = { error: { code: 'invalid', message: 'A subtask repeats with its task.' } }

/* One level, from each end. */
const subtaskNested = { error: { code: 'nested', message: 'A subtask can’t have subtasks.' } }
const hasSubtasks = { error: { code: 'nested', message: 'A task with subtasks can’t be a subtask.' } }

/*
 * The trigger's refusals, as the answers the endpoint gives. The endpoint
 * asks first; the trigger is what holds when two requests race past that,
 * and its exception reaching the caller would be a 500 for a rule.
 */
async function flat<T>(run: () => Promise<T>): Promise<T | 'nested' | 'has_subtasks' | 'invalid_nest'> {
  try {
    return await run()
  } catch (e) {
    const said = e instanceof Error ? e.message : ''
    if (said.includes('a subtask cannot have subtasks')) return 'nested'
    if (said.includes('a task with subtasks cannot be a subtask')) return 'has_subtasks'
    if (said.includes('cannot be its own parent') || said.includes('a parent belongs to another project')) return 'invalid_nest'
    throw e
  }
}

/* One answer for anybody given a task they cannot be given. */
const notOnIt = { error: { code: 'invalid', message: 'Somebody you chose isn’t on this project.' } }

/*
 * Tasks by the handles people say them by — `ACM-41` — for a body written
 * as Markdown to name them as chips. At most fifty, one query, and only the tasks the
 * reader's own policies return: a handle into a project they are not on is
 * not answered, so it stays the words it was.
 *
 * And only where every reader may read the task, because a chip carries
 * its title. Going into a project — a task, an announcement, a document —
 * that is a task of that project (`project=`). Going into a room
 * (`conversation=`), the room says: a task of its project for a project's
 * room, and for a room outside every project a task each of its joined
 * people may read (`task_visible_to_all`, migration 272). A room the
 * writer does not see is 404. Anywhere else a handle stays its words.
 */
const HANDLE = /^([A-Z]{1,3}[0-9]*)-([1-9][0-9]{0,8})$/

tasks.get('/task-handles', async (c) => {
  const ctx = c.get('ctx')
  const asked = [...new Set((c.req.query('handles') ?? '').split(',').filter(Boolean))]
  const parsed = asked.map((h) => HANDLE.exec(h))
  const project = z.uuid().safeParse(c.req.query('project'))
  const room = z.uuid().safeParse(c.req.query('conversation'))
  const given = [c.req.query('project'), c.req.query('conversation')].filter((v) => v !== undefined).length
  if (given !== 1 || !(project.success || room.success) || asked.length === 0 || asked.length > 50 || parsed.some((m) => !m)) {
    return c.json(
      {
        error: {
          code: 'invalid',
          message: 'Give a project or a conversation, and 1 to 50 task handles like ACM-41, separated by commas.',
        },
      },
      400,
    )
  }
  const keys = parsed.map((m) => m![1]!)
  const numbers = parsed.map((m) => Number(m![2]))
  type Row = { id: string; project_id: string; number: number; key: string; title: string }
  const rows = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (project.success) {
      return tx<Row[]>`
        select t.id, t.project_id, t.number, p.key, t.title
        from unnest(${keys}::text[], ${numbers}::int[]) as h(key, number)
        join project p on p.workspace_id = ${ctx.workspaceId} and p.id = ${project.data} and p.key = h.key and p.deleted_at is null
        join task t on t.project_id = p.id and t.number = h.number and t.deleted_at is null
        where t.workspace_id = ${ctx.workspaceId}`
    }
    const [seen] = await tx<{ ok: boolean }[]>`select can_see_conversation(${room.data!}) as ok`
    if (!seen?.ok) return null
    /* The writer's own policies first, then the room's readers. */
    return tx<Row[]>`
      select t.id, t.project_id, t.number, p.key, t.title
      from unnest(${keys}::text[], ${numbers}::int[]) as h(key, number)
      join project p on p.workspace_id = ${ctx.workspaceId} and p.key = h.key and p.deleted_at is null
      join task t on t.project_id = p.id and t.number = h.number and t.deleted_at is null
      where t.workspace_id = ${ctx.workspaceId} and task_visible_to_all(t.id, ${room.data!})`
  })
  if (!rows) return c.json(missing, 404)
  return c.json({ tasks: rows.map((t) => ({ handle: `${t.key}-${t.number}`, ...t })) })
})

/**
 * A task as a card — what a message that names it draws under itself:
 * its handle, title, where it stands, who has
 * it and when it is due. Small on purpose: a room naming five tasks asks
 * five times, and the full read carries comments and hours nobody looks at
 * there. A task the reader may not see is 404, as everywhere.
 */
tasks.get('/tasks/:id/card', async (c) => {
  const ctx = c.get('ctx')
  const [row] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      tx`
      select t.id, t.number, t.title, t.project_id, t.due_on, t.priority, t.completed_at,
             t.created_at, t.decided_at, t.repeat,
             p.key as project_key, p.slug as project_slug, p.name as project_name,
             l.name as list_name, l.icon as list_icon, l.color as list_color,
             t.assignee_id, a.name as assignee_name, a.avatar_key as assignee_avatar,
             /* Everybody on it, in order; the three above are the first,
                for the apps that draw one face. */
             coalesce((select json_agg(json_build_object('id', p2.id, 'name', p2.name, 'avatar', p2.avatar_key)
                                       order by x.at)
                       from unnest(t.assignee_ids) with ordinality as x(id, at)
                       join actor p2 on p2.id = x.id), '[]') as assignees,
             y.name as cycle_name,
             coalesce((select json_agg(json_build_object('id', lb.id, 'name', lb.name, 'color', lb.color)
                                       order by lb.name)
                       from task_label tl join label lb on lb.id = tl.label_id
                       where tl.task_id = t.id and lb.deleted_at is null), '[]') as labels
      from task t
      join project p on p.id = t.project_id
      left join task_list l on l.id = t.list_id
      left join actor a on a.id = t.assignee_id
      left join cycle y on y.id = t.cycle_id and y.deleted_at is null
      where t.id = ${c.req.param('id')} and t.deleted_at is null`,
  )
  if (!row) return c.json(missing, 404)
  const card = facedAs(row as Record<string, unknown>, 'assignee_avatar', 'assignee_avatar_url')
  card.assignees = (card.assignees as { id: string; name: string; avatar: string | null }[]).map(({ avatar, ...a }) => ({
    ...a,
    avatar_url: avatar ? faceLink(avatar) : null,
  }))
  return c.json({ card })
})

/* The comments before the ones a task's read carried — `comments_earlier`,
   Not readable is not there. */
tasks.get('/tasks/:id/comments', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const before = c.req.query('before') ?? null
  if (before !== null && !commentCursor(before)) return c.json({ error: { code: 'invalid' } }, 400)
  const page = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [t] = await tx`select 1 from task where id = ${id} and deleted_at is null`
    return t ? commentsIn(tx, 'task', id, before) : null
  })
  if (!page) return c.json(missing, 404)
  return c.json({ comments: page.comments, next_cursor: page.earlier })
})

tasks.get('/tasks/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  /*
   * Everything the screen shows, in one transaction and sent side by side.
   *
   * It was five queries one after another and the comments in a second
   * transaction — a dozen round trips to the database for one open task,
   * each paid in full wherever the database is further than the next rack.
   * Asked together they cost one. A task that is not there still answers
   * nothing: the other four come back empty under the same policies, and
   * the answer is decided by the first.
   */
  const row = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [found, steps, time, watched, comments, pictures, pulls, issue, spend, asked, reminded, working] = await Promise.all([
      tx`
      select t.*, a.name as author_name,
             /* The words on it, with the task rather than behind a second
                request -- the same join the list makes, for the same reason.
                Its absence here is why a task that showed two labels on the
                row showed none when opened: every other screen reads them
                from the list query, and the one that reads this answer got a
                task with no labels on it at all.
                No backticks in here -- this is inside
                a template literal, and one ends it. */
             coalesce((select json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color)
                                       order by l.name)
                       from task_label tl join label l on l.id = tl.label_id
                       where tl.task_id = t.id and l.deleted_at is null), '[]') as labels,
             /* The tasks it is inside, outermost first, so a part's screen
                can say where it sits and step back up.
                One today, since a part cannot have parts; walked as a chain
                anyway, bounded at ten, so the answer does not change shape
                if that ever does. */
             coalesce((
               with recursive up as (
                 select p.id, p.number, p.title, p.parent_id, 1 as depth
                 from task p where p.id = t.parent_id and p.deleted_at is null
                 union all
                 select q.id, q.number, q.title, q.parent_id, up.depth + 1
                 from task q join up on q.id = up.parent_id
                 where q.deleted_at is null and up.depth < 10
               )
               select json_agg(json_build_object('id', id, 'number', number, 'title', title)
                               order by depth desc)
               from up), '[]') as ancestors
      from task t join actor a on a.id = t.author_id
      where t.id = ${id} and t.deleted_at is null`,
      /*
       * Its parts, which used to be `task_step` and are tasks now.
       * Named `steps` in the answer because three
       * clients read that key and renaming a field is a separate change from
       * changing what is behind it.
       */
      tx`
      select t.id, t.title, t.completed_at as done_at, t.sort_key, t.assignee_ids, t.assignee_id,
             t.due_on, l.icon, l.color
      from task t left join task_list l on l.id = t.list_id
      where t.parent_id = ${id} and t.deleted_at is null order by t.sort_key`,
      /*
       * The hours logged against it, in the same answer as its parts and its
       * comments. One screen is one read: a number in the corner of a panel is
       * not worth a second request, and a second request is a second spinner
       * on a screen that is otherwise drawn at once.
       *
       * Its own, not its parts'. A parent showing the sum of its subtasks
       * shows a number nobody wrote.
       */
      tx`
      select e.id, e.actor_id, a.name as actor_name, e.minutes, e.spent_on, e.note
      from time_entry e join actor a on a.id = e.actor_id
      where e.object_type = 'task' and e.object_id = ${id} and e.deleted_at is null
      order by e.spent_on, e.created_at`,
      /*
       * Whether **you** are watching it, which is the only answer this reader
       * is entitled to. The policy on `subscription` is
       * `actor_id = current_actor()` for select, so this query can only ever
       * see the caller's own row — which is the rule rather than a limitation
       * of the query.
       */
      tx<{ id: string }[]>`
      select id from subscription
      where object_type = 'task' and object_id = ${id} and deleted_at is null
      limit 1`,
      commentsIn(tx, 'task', id),
      /*
       * The links for every file its body and its comments hold, signed here.
       *
       * Each picture asked for its own link after the screen drew — one round
       * trip per picture across the distance to the server, before its first
       * byte could be asked for — so a description with five screenshots
       * filled in one by one. Answered with the task, the pictures' bytes are
       * asked for the moment the body is drawn. Read under the same policies
       * as everything else here: a file the reader may not see is not in it.
       */
      tx<{ id: string; storage_key: string; display_key: string | null; size_bytes: string | null }[]>`
      select f.id, f.storage_key, f.display_key, f.size_bytes from file f
      where f.deleted_at is null and f.storage_key is not null and f.id in (
        /* By the file's own key, not its id as text, which no index has:
           every file was read to find a task's pictures. A fileId that is
           not an id is nothing, rather than a failed cast. */
        select case when v #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    then (v #>> '{}')::uuid end
        from (select v from task t, jsonb_path_query(t.body, '$.**.fileId') v
              where t.id = ${id}
              union all
              select v from comment c, jsonb_path_query(c.body, '$.**.fileId') v
              where c.object_type = 'task' and c.object_id = ${id} and c.deleted_at is null) ids(v))`,
      /* The pull requests that name it, as GitHub last said they stand.
       Newest first. */
      tx`
      select p.number, p.title, p.url, p.state, p.draft, p.review, p.checks,
             p.author_login, p.author_avatar, p.head_ref, pt.closes, l.repo_name
      from github_pull_task pt
      join github_pull p on p.id = pt.pull_id
      join github_link l on l.id = p.link_id
      where pt.task_id = ${id}
      order by p.updated_at desc
      limit 20`,
      /* And the issue it is, where its project keeps issues in sync. */
      tx<{ number: number; repo_name: string }[]>`
      select i.number, l.repo_name from github_issue i join github_link l on l.id = i.link_id
      where i.task_id = ${id} and l.deleted_at is null`,
      /* What AI tools spent on it, beside its hours and read with them.
       Its own, not its parts', as with hours. */
      tx`
      select s.id, s.actor_id, a.name as actor_name, s.client, s.model,
             s.tokens::float8 as tokens, s.cost_usd::float8 as cost_usd, s.created_at, s.updated_at
      from task_spend s join actor a on a.id = s.actor_id
      where s.task_id = ${id} and s.deleted_at is null
      order by s.created_at`,
      /* Who asked for it on the project's feedback page. */
      tx<{ email: string | null }[]>`
      select pe.email::text as email from feedback_item fi
      left join feedback_person pe on pe.id = fi.person_id
      where fi.task_id = ${id}`,
      /* Your own reminder on it, and only yours: the policy is the person. */
      tx<{ at: Date }[]>`
      select at from task_reminder where task_id = ${id} and actor_id = ${ctx.actorId}`,
      /* The agents saying they are at it now. */
      liveStatuses(tx, { task: id }),
    ])
    const [whole] = found
    if (!whole) return null
    /* What it waits on and what waits on it.
       After the task is known to be there, and as the reader. */
    const related = await relationsOf(tx, id)
    /* Not its words drawn out for search: the body is here already, and
       `said` is the index's, not the contract's. */
    const { said: _said, ...t } = whole as Record<string, unknown>
    const files = Object.fromEntries(pictures.map((f) => [f.id, linkForReader(f.storage_key, ctx.actorId)]))
    /* The copies to draw, for the pictures that have one — the original
       stays in `files`, for opening full size. */
    const displays = Object.fromEntries(
      pictures.filter((f) => f.display_key).map((f) => [f.id, linkForReader(f.display_key!, ctx.actorId)]),
    )
    /* And their sizes, said under a file's name — a file put in before the
       body recorded its size still has one in its row. */
    const sizes = Object.fromEntries(pictures.filter((f) => f.size_bytes !== null).map((f) => [f.id, Number(f.size_bytes)]))
    /* The address only for whoever may change the task, and never through
       a token: an agent has no use for a customer's customers' addresses. */
    const seesWho = !ctx.viaMcp && mayEdit(ctx, String(t.author_id), String(t.project_id))
    const feedback = asked[0] ? { email: seesWho ? asked[0].email : null } : null
    const my_reminder = reminded[0] ? { at: reminded[0].at.toISOString() } : null
    return {
      task: { ...t, subscribed: Boolean(watched[0]), my_reminder, ...related },
      feedback,
      steps,
      time,
      spend,
      working,
      comments: comments.comments,
      /* Where the comments not carried here start. */
      comments_earlier: comments.earlier,
      files,
      displays,
      sizes,
      github: {
        pulls,
        issue: issue[0] ? { ...issue[0], url: `https://github.com/${issue[0].repo_name}/issues/${issue[0].number}` } : null,
      },
    }
  })
  if (!row) return c.json(missing, 404)
  return c.json(row)
})

/**
 * The task written out for an agent.
 *
 * Its pictures and files go out as links that open without signing in, for
 * an hour: the point is to hand them to a tool that is not this browser, and
 * the person pressing Copy is choosing to. Every other file link in the
 * product is its reader's own.
 */
tasks.get('/tasks/:id/prompt', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  /* Ours, not the sender's: `X-Forwarded-Host` is whatever the request
     says, as the reset and invitation links learned. */
  const origin = originOf(c)
  const read = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [t] = await tx<
      {
        number: number
        title: string
        body: unknown
        due_on: string | null
        priority: string | null
        completed_at: string | null
        list: string | null
        assignees: string[]
        cycle: string | null
        project_slug: string
        project_key: string
        workspace_slug: string
        labels: string[]
      }[]
    >`
      select t.number, t.title, t.body, t.due_on, t.priority, t.completed_at,
             l.name as list, y.name as cycle,
             coalesce((select array_agg(pa.name order by x.at)
                       from unnest(t.assignee_ids) with ordinality as x(id, at)
                       join actor pa on pa.id = x.id), '{}') as assignees,
             p.slug as project_slug, p.key as project_key, w.slug as workspace_slug,
             coalesce((select array_agg(lb.name order by lb.name) from task_label tl
                       join label lb on lb.id = tl.label_id
                       where tl.task_id = t.id and lb.deleted_at is null), '{}') as labels
      from task t
      join project p on p.id = t.project_id
      join workspace w on w.id = t.workspace_id
      left join task_list l on l.id = t.list_id
      left join cycle y on y.id = t.cycle_id
      where t.id = ${id} and t.deleted_at is null`
    if (!t) return null
    const [parts, said, stored] = await Promise.all([
      tx<{ number: number; title: string; completed_at: string | null }[]>`
        select number, title, completed_at from task
        where parent_id = ${id} and deleted_at is null order by sort_key`,
      /* The day as text: the driver hands a timestamp back as a Date, and
         `.slice` on one made every task with a comment fail to copy. */
      tx<{ id: string; parent_id: string | null; author: string; body: unknown; day: string }[]>`
        select c.id, c.parent_id, a.name as author, c.body,
               to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD') as day
        from comment c join actor a on a.id = c.author_id
        where c.object_type = 'task' and c.object_id = ${id} and c.deleted_at is null
        order by c.created_at`,
      tx<{ id: string; storage_key: string | null; size_bytes: string | null }[]>`
        select f.id, f.storage_key, f.size_bytes from file f
        where f.deleted_at is null and f.id in (
          select case when v #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then (v #>> '{}')::uuid end
          from (select v from task t, jsonb_path_query(t.body, '$.**.fileId') v where t.id = ${id}
                union all
                select v from comment c, jsonb_path_query(c.body, '$.**.fileId') v
                where c.object_type = 'task' and c.object_id = ${id} and c.deleted_at is null) ids(v))`,
    ])
    return { t, parts, said, stored }
  })
  if (!read) return c.json(missing, 404)
  const { t, parts, said, stored } = read
  const keys = new Map(stored.filter((f) => f.storage_key).map((f) => [f.id, f.storage_key as string]))
  const link = (fileId: string) => {
    const key = keys.get(fileId)
    if (!key) return null
    const url = linkFor(key, 3600)
    return url.startsWith('/') ? `${origin}${url}` : url
  }
  const files: Linked[] = []
  const handle = `${t.project_key}-${t.number}`
  const facts = [
    `Status: ${t.list ?? (t.completed_at ? 'Done' : 'Open')}`,
    t.priority ? `Priority: ${t.priority}` : null,
    t.due_on ? `Due: ${t.due_on}` : null,
    t.assignees.length ? `${t.assignees.length > 1 ? 'Assignees' : 'Assignee'}: ${t.assignees.join(', ')}` : null,
    t.labels.length ? `Labels: ${t.labels.join(', ')}` : null,
    t.cycle ? `Sprint: ${t.cycle}` : null,
  ].filter((f): f is string => Boolean(f))
  const out: string[] = [
    `# ${handle}: ${oneLine(t.title)}`,
    `${origin}/${t.workspace_slug}/${t.project_slug}/tasks/${t.number}`,
    oneLine(facts.join(' · ')),
  ]
  const description = markdown(t.body, link, files)
  if (description || said.length) out.push(QUOTED)
  if (description) out.push('## Description', fenced(description))
  if (parts.length) {
    out.push(
      '## Sub-tasks',
      parts.map((p) => `- [${p.completed_at ? 'x' : ' '}] ${t.project_key}-${p.number} ${oneLine(p.title)}`).join('\n'),
    )
  }
  if (said.length) {
    const tops = said.filter((s) => !s.parent_id)
    const lines: string[] = []
    for (const top of tops) {
      lines.push(`**${oneLine(top.author)}**, ${top.day}:\n${fenced(markdown(top.body, link, files))}`)
      for (const r of said.filter((s) => s.parent_id === top.id)) {
        lines.push(`↳ **${oneLine(r.author)}** answered, ${r.day}:\n${fenced(markdown(r.body, link, files))}`)
      }
    }
    out.push('## Comments', lines.join('\n\n'))
  }
  if (files.length) {
    out.push(
      '## Attachments',
      `Links open without signing in for one hour.\n\n${files.map((f) => `- ${oneLine(f.name)} (${oneLine(f.kind)}): ${f.url}`).join('\n')}`,
    )
  }
  return c.json({ text: out.join('\n\n') })
})

const Patch = Body.partial().omit({ parent_id: true }).extend({
  /*
   * Put under another task of the same project, or `null` to stand on its
   * own. It was refused here
   * while nothing asked for it; GitHub's sub-issues do, and what
   * GitHub may do through this endpoint a person may too. Alone in its
   * request: it decides the list and the place, so a `list_id`, `after`
   * or `completed` beside it would be two answers to one question.
   */
  parent_id: z.uuid().nullable().optional(),
  completed: z.boolean().optional(),
  /**
   * Where it lands when dragged, as the task it should sit behind.
   *
   * The id of a task, or `null` for the top of the column. The key between
   * the neighbours is computed here, not sent: ordering is one rule, and
   * three clients each generating their own keys is three clients that
   * disagree about order the first time two people drag at once.
   */
  after: z.string().nullish(),
})

tasks.patch('/tasks/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = Patch.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  /* What the change was, for the operators' counts. */
  const d = body.data
  used(
    c,
    d.after !== undefined || d.list_id !== undefined
      ? 'task.move'
      : d.completed !== undefined
        ? 'task.complete'
        : d.assignee_ids !== undefined || d.assignee_id !== undefined
          ? 'task.assign'
          : 'task.edit',
  )

  const result = await flat(() =>
    withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      /* Put under another: both rows held, in one order, before either is
       read — so A put under B while B is put under A waits for the other
       and then sees it, instead of both passing (or deadlocking). */
      if (body.data.parent_id) {
        await tx`select id from task where id in (${id}, ${body.data.parent_id}) order by id for update`
      }
      const [row] = await tx<
        {
          author_id: string
          project_id: string
          list_id: string | null
          assignee_ids: string[]
          due_on: string | null
          priority: string | null
          title: string
          body: unknown
          completed_at: string | null
          starts_at: string | null
          ends_at: string | null
          sort_key: string
          parent_id: string | null
          repeat: unknown
          repeat_next_id: string | null
        }[]
      >`
      select author_id, project_id, list_id, assignee_ids, due_on, priority, title, body,
             completed_at, starts_at, ends_at, sort_key, parent_id, repeat, repeat_next_id
      from task where id = ${id} and deleted_at is null
      /* Held until this is written: two presses of done at once make one
         next task, not two — the second finds it finished. */
      for update`
      if (!row) return 'missing' as const
      if (!mayEdit(ctx, row.author_id, row.project_id)) return 'forbidden' as const
      if (body.data.repeat && row.parent_id) return 'part_repeat' as const
      /* Before anything is written: a refusal half-way through is a save that
       half happened. */
      if (body.data.labels !== undefined && !(await labelsBelong(tx, row.project_id, body.data.labels))) {
        return 'labels' as const
      }
      /* Only the people new to it are asked about: somebody who has left the
       project since stays on until they are taken off. */
      let assignees = assigneesOf(body.data)
      /* Moved with nobody on it into a list an agent takes, the request not
         saying who: given to that agent, as the mover's own assignment.
         A move that says who is that answer. */
      if (
        assignees === undefined &&
        row.parent_id === null &&
        row.assignee_ids.length === 0 &&
        body.data.list_id &&
        body.data.list_id !== row.list_id
      ) {
        const taker = await listTaker(tx, ctx, row.project_id, body.data.list_id)
        if (taker) assignees = [taker]
      }
      const added = (assignees ?? []).filter((x) => !row.assignee_ids.includes(x))
      const removed = assignees ? row.assignee_ids.filter((x) => !assignees.includes(x)) : []
      if (added.length && !(await assigneesBelong(tx, ctx, row.project_id, added))) {
        return 'assignee' as const
      }
      /* Under another task, or out from under one — after every other
       refusal, since returning from here commits what was written: a
       refusal after the move was a move that half happened. */
      let nested: { under: number | null; from: number | null } | null = null
      if (body.data.parent_id !== undefined && body.data.parent_id !== row.parent_id) {
        const d = body.data
        if (d.list_id !== undefined || d.after !== undefined || d.completed !== undefined) return 'invalid_nest' as const
        const to = d.parent_id ?? null
        const was = row.parent_id
        const numberOf = async (task: string | null) => {
          if (!task) return null
          const [n] = await tx<{ number: number }[]>`select number from task where id = ${task}`
          return n?.number ?? null
        }
        if (to) {
          if (row.repeat || d.repeat) return 'part_repeat' as const
          /* The same project's, standing on its own, and not this one. */
          const [parent] = await tx<{ list_id: string | null; parent_id: string | null }[]>`
          select list_id, parent_id from task
          where id = ${to} and project_id = ${row.project_id} and deleted_at is null and id <> ${id}`
          if (!parent) return 'invalid_nest' as const
          /* One level, from both ends: the trigger says it too. */
          const [kids] = await tx`select 1 from task where parent_id = ${id} and deleted_at is null limit 1`
          if (parent.parent_id) return 'nested' as const
          if (kids) return 'has_subtasks' as const
          const [last] = await tx<{ sort_key: string }[]>`
          select sort_key from task where parent_id = ${to} and deleted_at is null order by sort_key desc limit 1`
          /* At the end of its parent's subtasks, in its parent's list, as a
           subtask made there would be — and finished or not as it was: the
           list it joins does not decide that for a subtask. */
          await tx`
          update task set parent_id = ${to}, list_id = ${parent.list_id},
                          sort_key = ${generateKeyBetween(last?.sort_key ?? null, null)}
          where id = ${id}`
          await tx`update task set completed_at = ${row.completed_at} where id = ${id}`
        } else {
          await tx`update task set parent_id = null where id = ${id}`
          /* Standing on its own, where it is decides whether it is finished:
           a finished subtask goes to the first list that finishes, an open
           one out of a finishing list — and to the top of its column. */
          const lists = await tx<{ id: string; finishes: boolean; icon: string; intake: boolean }[]>`
          select id, finishes, icon, intake from task_list
          where project_id = ${row.project_id} and deleted_at is null order by sort_key, id`
          const here = lists.find((l) => l.id === row.list_id)
          const done = row.completed_at !== null
          const move =
            here && done !== here.finishes
              ? done
                ? (lists.find((l) => l.finishes && l.icon === 'done') ?? lists.find((l) => l.finishes))
                : (lists.find((l) => !l.finishes && !l.intake && l.icon === 'open') ?? lists.find((l) => !l.finishes && !l.intake))
              : undefined
          if (move) d.list_id = move.id
          else d.after = null
          row.parent_id = null
        }
        nested = { under: await numberOf(to), from: await numberOf(was) }
      }

      const d = body.data
      /*
       * `completed` on a task in a list is a move, not a stamp.
       *
       * Where a task is decides whether it is finished, and the stamp is what
       * the list writes. `completed` alone wrote the
       * stamp and left the task where it was, so an agent finishing a task
       * through MCP left it finished in Backlog — ticked in the list, drawn
       * open on the board. Now it goes to the project's first finishing list
       * marked done (Canceled only if there is no other), and back to the
       * first open one — Todo, else the first that does not finish and is not
       * Triage. A part
       * has no list of its own and keeps the tick; a project with no
       * finishing list keeps the old stamp, since nothing there finishes.
       */
      if (d.completed !== undefined && d.list_id === undefined && row.list_id && !row.parent_id) {
        const lists = await tx<{ id: string; finishes: boolean; icon: string; intake: boolean }[]>`
        select id, finishes, icon, intake from task_list
        where project_id = ${row.project_id} and deleted_at is null order by sort_key, id`
        const here = lists.find((l) => l.id === row.list_id)
        const to = d.completed
          ? here?.finishes
            ? null
            : (lists.find((l) => l.finishes && l.icon === 'done') ?? lists.find((l) => l.finishes))
          : here && !here.finishes
            ? null
            : (lists.find((l) => !l.finishes && !l.intake && l.icon === 'open') ?? lists.find((l) => !l.finishes && !l.intake))
        if (to) d.list_id = to.id
      }
      /* Whole, read off the date it is saved beside. */
      const rule =
        d.repeat !== undefined ? await ruleToStore(tx, ctx, d.repeat, (d.due_on !== undefined ? d.due_on : row.due_on) ?? null) : undefined
      // The board shows age since the last decision rather than since creation,
      // so moving a card is what resets the clock — a card nobody has touched is
      // the one worth seeing.
      const decided = d.list_id !== undefined && d.list_id !== row.list_id

      /*
       * A drag names its landing place, and the key falls out of it.
       *
       * The card being moved is excluded from the search for neighbours —
       * without that, a move inside its own list finds itself and lands
       * between itself and nothing.
       */
      /*
       * A card changing columns is always re-keyed, named place or not.
       *
       * The key was only recomputed when the caller said `after`, so a move
       * that just names a list — which the API allows, and which anything
       * other than a drag does — carried the old key into the new column.
       * Two columns can perfectly well hold the same key, because a key is
       * only compared within its own column, so the card arrived holding
       * one another card already had and the order between them became
       * whatever the planner returned.
       *
       * With no `after`, the top of the destination is meant, which is
       * where a card dropped on a column rather than between two of them
       * goes anyway.
       */
      const moving = d.list_id !== undefined && d.list_id !== row.list_id
      let sortKey: string | null = null
      if (d.after !== undefined || moving) {
        const into = d.list_id !== undefined ? d.list_id : row.list_id
        const [anchor] = d.after
          ? await tx<{ sort_key: string }[]>`
            select sort_key from task where id = ${d.after} and deleted_at is null`
          : []
        if (d.after && !anchor) return 'invalid' as const
        /*
         * Among the cards, not among the rows.
         *
         * A part lives in its parent's list and the board does not draw it —
         * `byColumn` skips anything with a `parent_id`, because four cards
         * for one task's parts is noise at the scale of a column. So the
         * caller names the card it was dropped after, counted among the
         * cards it can see, and this looked for the next row among all of
         * them: with a part sitting between two cards, the key landed
         * between the card and the part instead of between the two cards,
         * and the card came back somewhere else.
         *
         * Measured: 10 hidden parts in one 25-card column, 3 in another, so
         * the two sides really were counting different rows. Whether this is
         * what anybody saw is NOT established — the drops reachable in that
         * column happened not to land beside a part, and removing this line
         * again did not reproduce a fault. It is here because the caller's
         * neighbour and this neighbour have to be the same row, not because
         * a bug was traced to it.
         *
         * A part is ordered among its siblings, under its parent — never
         * against the cards of a column — so excluding them here is the
         * same rule read from the other side.
         */
        const [next] = await tx<{ sort_key: string }[]>`
        select sort_key from task
        where project_id = ${row.project_id} and deleted_at is null and id <> ${id}
          and parent_id is null
          and list_id is not distinct from ${into}
          ${anchor ? tx`and sort_key > ${anchor.sort_key}` : tx``}
        order by sort_key limit 1`
        sortKey = generateKeyBetween(anchor?.sort_key ?? null, next?.sort_key ?? null)
      }

      if (d.body) d.body = await veilDocrefs(tx, d.body)
      await tx`
      update task set
        title = coalesce(${d.title ?? null}, title),
        body = coalesce(${d.body ? tx.json(d.body as never) : null}, body),
        list_id = coalesce(${d.list_id ?? null}, list_id),
        -- Nullable and optional are two answers: absent leaves the person
        -- alone, null takes them off it. coalesce cannot tell them apart,
        -- so this one is written out, the same as a list's colour.

        assignee_ids = case when ${assignees !== undefined} then ${assignees ?? []}::uuid[]
                            else assignee_ids end,
        -- And the date: null clears it. It was a coalesce, so "no date"
        -- was read as "leave it", and a cleared date came back on the next
        -- read, on the web and on the phone alike.
        due_on = case when ${d.due_on !== undefined} then ${d.due_on ?? null}::date
                      else due_on end,
        -- Nullable and optional again: absent leaves the cycle alone, null
        -- takes the task out of it.
        cycle_id = case when ${d.cycle_id !== undefined} then ${d.cycle_id ?? null}
                        else cycle_id end,
        -- Nullable and optional are two answers, the same as the assignee:
        -- absent leaves it alone, null takes the priority off.
        priority = case when ${d.priority !== undefined}
                        then ${d.priority ?? null}::task_priority
                        else priority end,
        starts_at = coalesce(${d.starts_at ?? null}, starts_at),
        ends_at = coalesce(${d.ends_at ?? null}, ends_at),
        sort_key = coalesce(${sortKey}, sort_key),
        -- Set here only when nothing moved. Where a task is decides whether
        -- it is finished, and the trigger writes the stamp on the way in, so
        -- this must not write over it. The lists spec
        completed_at = case
          when ${d.list_id ?? null}::uuid is not null then completed_at
          when ${d.completed ?? null}::boolean is null then completed_at
          when ${d.completed ?? false} then now()
          else null end,
        decided_at = case when ${decided} then now() else decided_at end,
        repeat = case when ${rule !== undefined} then ${rule ? tx.json(rule as never) : null}::jsonb
                      else repeat end
      where id = ${id}`

      /*
       * Moving a task takes its parts with it.
       *
       * A part in a different list from the task it belongs to cannot be drawn
       * under it, and the list is the board's column now, so it could not be
       * drawn there either.
       */
      if (d.list_id !== undefined && d.list_id !== null) {
        await tx`
        update task set list_id = ${d.list_id}
        where parent_id = ${id} and deleted_at is null`
      }
      if (d.body) await linkMentionedObjects(tx, ctx, { type: 'task', id }, d.body)
      /*
       * What changed, not merely that something did.
       *
       * "Dev moved a task" is a line that answers nothing: moved where, given
       * to whom, due when. The log is immutable and reads months later, so it
       * keeps the **names as they were at the time** rather than ids to look
       * up — a list renamed or deleted since would otherwise turn an entry
       * into a blank, and what happened is that it was moved to the list
       * called Doing.
       */
      const named = async (listId: string | null | undefined) => {
        if (!listId) return null
        const [l] = await tx<{ name: string }[]>`select name from task_list where id = ${listId}`
        return l?.name ?? null
      }
      const whose = async (actorId: string | null | undefined) => {
        if (!actorId) return null
        const [a] = await tx<{ name: string }[]>`select name from actor where id = ${actorId}`
        return a?.name ?? null
      }
      const meta: Record<string, unknown> = {}
      if (d.list_id !== undefined && d.list_id !== row.list_id) {
        meta.moved_to = await named(d.list_id)
        meta.moved_from = await named(row.list_id)
      }
      /* Who came on, or who went off when nobody came on: the feed's line is
       one of the two, as it was for one person. */
      const names = async (ids: string[]) => (await Promise.all(ids.map(whose))).filter(Boolean).join(', ')
      /* And their ids beside the names, which two agents both called
         Claude Code share. */
      if (added.length) {
        meta.given_to = await names(added)
        meta.given_ids = added
      } else if (removed.length) meta.taken_off = (await names(removed)) || null
      if (d.due_on !== undefined && d.due_on !== row.due_on) meta.due = d.due_on ?? null
      if (d.priority !== undefined && d.priority !== row.priority) meta.priority = d.priority ?? null
      if (d.title !== undefined && d.title !== row.title) {
        meta.renamed = d.title
        /* The name it had. The log joins the object's *current* title, so
         without this a rename reads "renamed X to “X”" — the new name twice
         and the old one nowhere, which is the half nobody can reconstruct. */
        meta.was = row.title
      }
      /* The editor saves the whole body, so the words have to be compared or
       every time somebody opens a task and leaves it the log says they wrote
       on it. */
      if (d.body !== undefined && JSON.stringify(d.body) !== JSON.stringify(row.body)) meta.wrote = true
      if (d.completed !== undefined && d.completed !== (row.completed_at !== null)) {
        if (d.completed) meta.finished = true
        else meta.reopened = true
      }
      /* Under which task it went, or out from under which, by number. */
      if (nested) {
        meta.nested_under = nested.under
        meta.nested_from = nested.from
      }
      if (d.starts_at !== undefined && d.starts_at !== row.starts_at) meta.starts = d.starts_at ?? null
      if (d.ends_at !== undefined && d.ends_at !== row.ends_at) meta.ends = d.ends_at ?? null
      /* A drag inside one column is arrangement, not history — but it is a
       change, and a line that says nothing is worse than one that says it was
       only reordered. */
      if (sortKey !== null && !meta.moved_to) meta.reordered = true
      /* Compared by its keys in order: jsonb hands an object back with its keys
       re-sorted, and the same rule is not a change. */
      const canon = (v: unknown) => (v && typeof v === 'object' ? JSON.stringify(v, Object.keys(v).sort()) : 'null')
      if (rule !== undefined && canon(rule) !== canon(row.repeat ?? null)) meta.repeat = rule

      /*
       * Done makes the next one, undone takes it back.
       *
       * Read off the row as it is now, because a move into a finishing list is
       * done by the trigger, not by anything this request said.
       */
      const [now] = await tx<
        {
          completed_at: string | null
          list_id: string | null
          repeat: unknown
          number: number
          title: string
          body: unknown
          assignee_ids: string[]
          priority: string | null
          due_on: string | null
          starts_at: string | null
          ends_at: string | null
        }[]
      >`select completed_at, list_id, repeat, number, title, body, assignee_ids, priority, due_on,
             starts_at, ends_at
      from task where id = ${id}`
      let nextId: string | null = null
      let withdrawn: string | null = null
      if (now && row.completed_at === null && now.completed_at !== null && now.repeat && row.parent_id === null) {
        const finished: Finished = {
          id,
          project_id: row.project_id,
          author_id: row.author_id,
          number: now.number,
          title: now.title,
          body: now.body,
          assignee_ids: now.assignee_ids,
          priority: now.priority,
          due_on: now.due_on,
          starts_at: now.starts_at,
          ends_at: now.ends_at,
          repeat: now.repeat,
          list_before: row.list_id,
          key_before: row.sort_key,
          list_now: now.list_id,
        }
        nextId = await makeNext(tx, ctx, finished)
        if (nextId) {
          const [n] = await tx<{ number: number }[]>`select number from task where id = ${nextId}`
          meta.next_number = n?.number ?? null
        }
      } else if (now && row.completed_at !== null && now.completed_at === null && row.repeat_next_id) {
        withdrawn = await takeNextBack(tx, ctx, id)
      }
      /*
       * Finished or reopened just now: whatever waited on it alone hears it
       * can start, and the tasks it blocks are answered with what they wait
       * on now, so the screen that moved it puts their marks right in place
       * rather than reading the project again.
       * Beside the next occurrence, not instead of it: a repeating task that
       * blocks something does both.
       */
      let rewaits: Waiting[] = []
      if (now && (row.completed_at === null) !== (now.completed_at === null)) {
        if (now.completed_at !== null) await tellUnblocked(tx, ctx, id)
        rewaits = await waitingOnNow(tx, id)
      }

      /*
       * The labels, as a set: what is sent is what is true afterwards.
       *
       * Compared against what was there so that a save which changes nothing
       * writes nothing — the rule the whole log was fixed of — and so the line
       * can say which words were put on rather than that something happened.
       */
      if (d.labels !== undefined) {
        const was = await tx<{ label_id: string; name: string }[]>`
        select tl.label_id, l.name from task_label tl join label l on l.id = tl.label_id
        where tl.task_id = ${id}`
        const wanted = new Set(d.labels ?? [])
        const had = new Set(was.map((w) => w.label_id))
        const added = [...wanted].filter((x) => !had.has(x))
        const gone = was.filter((w) => !wanted.has(w.label_id))
        if (added.length) {
          await tx`
          insert into task_label ${tx(
            added.map((labelId) => ({
              id: uuidv7(),
              workspace_id: ctx.workspaceId,
              task_id: id,
              label_id: labelId,
            })),
            'id',
            'workspace_id',
            'task_id',
            'label_id',
          )}
          on conflict (task_id, label_id) do nothing`
        }
        if (gone.length) {
          await tx`
          delete from task_label
          where task_id = ${id} and label_id in ${tx(gone.map((g) => g.label_id))}`
        }
        if (added.length || gone.length) {
          const names = await tx<{ name: string }[]>`
          select name from label where id in ${tx([...wanted].length ? [...wanted] : [id])}
            and deleted_at is null order by name`
          meta.labelled = [...wanted].length ? names.map((n) => n.name) : []
        }
      }

      /*
       * And nothing at all when nothing changed.
       *
       * Every field above is compared against the row as it was, because the
       * screens save what is in their fields: `coalesce` means a value set to
       * the one it already held still updates the row, so a task opened and
       * closed again wrote a line that said somebody changed it and could not
       * say what.
       */
      /*
       * Who hears, read off the same comparison — `docs/specs/notifications.md`.
       *
       * Somebody newly on the task hears that it is theirs; the people
       * watching hear what happened, in a line, and only for what is worth
       * telling — moved, finished, given, dated, written on. A rename, a
       * label or a drag up the column is in the task's activity for whoever
       * looks. A save that changed nothing tells nobody; it used to tell
       * everybody watching that "something" happened, every time.
       */
      /* Written for each reader in their own language, which `notify` asks. */
      const who = await doer(tx, ctx.actorId)
      const what: Line = meta.finished
        ? (l) => LINES(l).finished(who(l))
        : meta.reopened
          ? (l) => LINES(l).reopened(who(l))
          : meta.moved_to
            ? (l) => LINES(l).moved(who(l), String(meta.moved_to))
            : meta.given_to
              ? (l) => LINES(l).gave(who(l), String(meta.given_to))
              : meta.taken_off !== undefined
                ? (l) => LINES(l).tookOff(who(l), meta.taken_off ? String(meta.taken_off) : null)
                : meta.due !== undefined
                  ? meta.due
                    ? (l) => LINES(l).dated(who(l), shortDay(String(meta.due), l))
                    : (l) => LINES(l).undated(who(l))
                  : meta.wrote
                    ? (l) => LINES(l).wrote(who(l))
                    : null
      /* The same choice, named, for the glyph the inbox draws it with. */
      const kind: Kind | undefined = meta.finished
        ? 'finished'
        : meta.reopened
          ? 'reopened'
          : meta.moved_to
            ? 'moved'
            : meta.given_to
              ? 'gave'
              : meta.taken_off !== undefined
                ? 'took_off'
                : meta.due !== undefined
                  ? meta.due
                    ? 'dated'
                    : 'undated'
                  : meta.wrote
                    ? 'wrote'
                    : undefined
      const given = added
      /* Only the names the description did not have: every save of a body
       told everybody named in it again. */
      const before = new Set(mentionedIds(row.body))
      const fresh = meta.wrote ? mentionedIds(d.body).filter((x) => !before.has(x)) : []
      const calledIn = fresh.length ? { type: 'doc', content: fresh.map((x) => ({ type: 'mention', attrs: { id: x } })) } : undefined
      if (what || given.length || calledIn) {
        await notify(tx, ctx, {
          objectType: 'task',
          objectId: id,
          body: calledIn,
          assignees: given,
          what,
          watchers: what !== null,
          ...(kind ? { kind } : {}),
          whatFor: { assigned: (l) => LINES(l).gaveYou(who(l)) },
        })
      }
      if (Object.keys(meta).length > 0) {
        await record(tx, ctx, 'task.update', {
          projectId: row.project_id,
          objectType: 'task',
          objectId: id,
          meta,
        })
      }
      /*
       * The key it was given, so the caller can stop guessing.
       *
       * Where a task sits is `sort_key` and the server is what computes it —
       * the client sends "after this one" and never sees a key, which is the
       * rule that keeps three clients from inventing their own orders. But
       * answering `{ok: true}` left the board and the list disagreeing: the
       * board had spliced the card into place optimistically and read array
       * order, while the list sorts by `sort_key` and still had the old one.
       * Measured, a card dragged to the top of a column was first on the
       * board and last in the list until the page was reloaded.
       *
       * So the one thing the caller cannot work out is handed back.
       */
      /* The next one as the list draws it, so the screen that finished this
       one can put it in place without reading the project again. */
      const [next] = nextId ? await tx`select ${listColumns(tx)} from task t where t.id = ${nextId}` : []
      /* And its parts, which are rows of the list too, and the rule this one
       carries now — taken off when the next was made, given back when it
       was withdrawn. With these the screen needs no second read of the
       project, which on ten thousand tasks was half a second. */
      const nextParts = nextId
        ? await tx`select ${listColumns(tx)} from task t where t.parent_id = ${nextId} and t.deleted_at is null order by t.sort_key`
        : []
      const [carries] = nextId || withdrawn ? await tx<{ repeat: unknown }[]>`select repeat from task where id = ${id}` : []
      /*
       * And the task itself as the list draws it, after the change, with its
       * parts when it moved and took them along. The
       * screen behind the task's own screen puts that one row in place from
       * this; it read the whole project again after every edit there, which
       * on ten thousand tasks was half a second for a title.
       */
      const [changed] = await listRows(tx, ctx.actorId, { ids: [id] })
      const parts = d.list_id !== undefined && d.list_id !== null ? await listRows(tx, ctx.actorId, { parent: id }) : undefined
      return {
        ok: true as const,
        sort_key: sortKey ?? null,
        next: next ?? null,
        next_parts: nextParts,
        withdrawn,
        ...(carries ? { repeat: carries.repeat ?? null } : {}),
        rewaits,
        ...(changed ? { task: changed } : {}),
        ...(parts ? { parts } : {}),
      }
    }),
  )
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'part_repeat') return c.json(partRepeats, 400)
  if (result === 'labels') return c.json({ error: { code: 'invalid', message: 'That label belongs to another project.' } }, 400)
  if (result === 'assignee') return c.json(notOnIt, 400)
  if (result === 'nested') return c.json(subtaskNested, 400)
  if (result === 'has_subtasks') return c.json(hasSubtasks, 400)
  if (result === 'invalid_nest') {
    return c.json({ error: { code: 'invalid', message: 'Couldn’t put the task there. Try again.' } }, 400)
  }
  // A card dropped behind something that is no longer there: refused rather
  // than quietly landed somewhere else, so the board and the database do not
  // disagree about where it went.
  if (result === 'invalid') {
    return c.json({ error: { code: 'invalid', message: 'Couldn’t move the task there. Try again.' } }, 400)
  }
  return c.json(result)
})

/**
 * Watching a task, and stopping.
 *
 * Both idempotent, because the caller is asking for a state rather than
 * performing an act: subscribing twice is subscribed once — the unique index
 * says so — and unsubscribing from something you are not watching is `ok`
 * rather than `404`.
 *
 * Soft, like everything else, and the partial unique index is on
 * `deleted_at is null`, so coming back clears the stamp rather than leaving a
 * second row the index would refuse.
 */
tasks.post('/tasks/:id/subscription', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [t] = await tx<{ id: string }[]>`
      select id from task where id = ${id} and deleted_at is null`
    if (!t) return false
    /*
     * Revive first, then insert if there was nothing to revive.
     *
     * `on conflict` cannot do this on its own: the unique index is partial on
     * `deleted_at is null`, so a row somebody gave up on is outside it and
     * the insert does not conflict with anything — it just adds a second row
     * the index then refuses the next time. Two statements say it plainly.
     */
    const back = await tx<{ id: string }[]>`
      update subscription set deleted_at = null, updated_at = now()
      where object_type = 'task' and object_id = ${id}
        and actor_id = ${ctx.actorId} and deleted_at is not null
      returning id`
    if (back.length === 0) {
      await tx`
        insert into subscription (id, workspace_id, object_type, object_id, actor_id)
        values (${uuidv7()}, ${ctx.workspaceId}, 'task'::object_kind, ${id}, ${ctx.actorId})
        on conflict do nothing`
    }
    return true
  })
  return done ? c.json({ ok: true }) : c.json(missing, 404)
})

tasks.delete('/tasks/:id/subscription', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    await tx`
      update subscription set deleted_at = now(), updated_at = now()
      where object_type = 'task' and object_id = ${id}
        and actor_id = ${ctx.actorId} and deleted_at is null`
  })
  /* Not 404 on a task that is gone either: the caller wants to stop hearing
     about it, and a task they cannot see is a task they will not hear about. */
  return c.json({ ok: true })
})

/* ------------------------------------------------------------- remind me */

/**
 * A reminder for yourself on a task.
 *
 * Yours alone, as a subscription is: the policy on `task_reminder` is the
 * person and the workspace, so nothing here can set, read or clear anybody
 * else's, and nothing about it reaches the activity feed or a webhook.
 *
 * `at` is an instant; written with no offset it is a time on the clock of
 * the zone the account keeps, the one the due-date reminder uses. The three
 * presets are worked out there too, for an agent that does not know where
 * its person is. The web works them out itself, in the same zone, so its
 * chip can move before the answer.
 */
const PRESETS = ['later_today', 'tomorrow', 'next_week'] as const
/* Far more than anybody keeps in mind; few enough that the worker's
   twenty-second pass cannot be held by one account for long. */
const REMINDERS_WAITING = 500
const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/
const ReminderBody = z.union([z.object({ at: z.string().max(40) }).strict(), z.object({ preset: z.enum(PRESETS) }).strict()])

tasks.put('/tasks/:id/reminder', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = ReminderBody.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid', message: 'Choose a time for the reminder.' } }, 400)
  const wall = 'at' in body.data && WALL.test(body.data.at) ? body.data.at : null
  const given = 'at' in body.data && !wall ? body.data.at : null
  /* A year the database cannot read — `+100000-…`, or one before the
     epoch — is refused here, where it costs a 400 and not the transaction. */
  if (
    given !== null &&
    (!/^\d{4}-/.test(given) ||
      !/([zZ]|[+-]\d{2}:?\d{2})$/.test(given) ||
      Number.isNaN(Date.parse(given)) ||
      new Date(given).getUTCFullYear() < 1970 ||
      new Date(given).getUTCFullYear() > 9999)
  ) {
    return c.json({ error: { code: 'invalid', message: 'That isn’t a valid time.' } }, 400)
  }
  /* A day that does not exist — the thirtieth of February — is refused
     here rather than by the database, which would end the transaction. */
  if (wall !== null) {
    const [y, m, d, h, mi, s] = wall.split(/[-T:]/).map(Number) as [number, number, number, number, number, number | undefined]
    const back = new Date(Date.UTC(y, m - 1, d, h, mi))
    if (
      back.getUTCMonth() !== m - 1 ||
      back.getUTCDate() !== d ||
      back.getUTCHours() !== h ||
      back.getUTCMinutes() !== mi ||
      (s !== undefined && !(s >= 0 && s < 60))
    ) {
      return c.json({ error: { code: 'invalid', message: 'That isn’t a valid time.' } }, 400)
    }
  }
  const instant = given === null ? null : new Date(given).toISOString()
  const preset = 'preset' in body.data ? body.data.preset : null

  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [t] = await tx<{ project_id: string }[]>`
      select project_id from task where id = ${id} and deleted_at is null`
    if (!t) return 'missing' as const
    if (!allowIn(ctx, 'task.remind', t.project_id)) return 'forbidden' as const
    /* The account's zone, or UTC for one the database does not know. */
    const [zone] = await tx<{ tz: string }[]>`
      select coalesce(
        (select u.timezone from app_user u
         where u.actor_id = ${ctx.actorId}
           and exists (select 1 from pg_timezone_names z where z.name = u.timezone)),
        'UTC') as tz`
    const tz = zone?.tz ?? 'UTC'
    const [when] = await tx<{ at: Date; past: boolean; far: boolean }[]>`
      with l as (select now() at time zone ${tz} as here)
      select x.at, x.at <= now() as past, x.at > now() + interval '5 years' as far
      from l, lateral (select case ${preset}::text
        /* Three hours on, to the nearest hour. */
        when 'later_today' then date_trunc('hour', l.here + interval '3 hours 30 minutes') at time zone ${tz}
        when 'tomorrow' then ((l.here::date + 1) + time '09:00') at time zone ${tz}
        /* Monday of next week — a week on, from a Monday — and never
           tomorrow: from a Sunday, the Monday after, or it is Tomorrow twice. */
        when 'next_week' then ((l.here::date + (case when extract(isodow from l.here)::int = 7 then 8 else 8 - extract(isodow from l.here)::int end)) + time '09:00') at time zone ${tz}
        /* Through text: a parameter typed as a timestamp is turned into a
           Date by the driver, in this process's zone, before it leaves. */
        else coalesce(${wall}::text::timestamp at time zone ${tz}, ${instant}::text::timestamptz)
      end as at) x`
    if (!when) return 'invalid' as const
    if (when.past) return 'past' as const
    if (when.far) return 'invalid' as const
    /* A ceiling on what one person has waiting, so one account cannot set
       every task it sees for the same minute and hold the shared worker
       for everybody else. Moving one already set is never refused. */
    const [count] = await tx<{ n: number; mine: boolean }[]>`
      select count(*)::int as n, bool_or(task_id = ${id}) as mine
      from task_reminder where actor_id = ${ctx.actorId}`
    if (count && count.n >= REMINDERS_WAITING && !count.mine) return 'full' as const
    await tx`
      insert into task_reminder (workspace_id, task_id, actor_id, at)
      values (${ctx.workspaceId}, ${id}, ${ctx.actorId}, ${when.at})
      on conflict (task_id, actor_id) do update set at = excluded.at`
    return { at: when.at }
  })
  if (done === 'missing') return c.json(missing, 404)
  if (done === 'forbidden') return c.json(forbidden, 403)
  if (done === 'full') return c.json({ error: { code: 'invalid', message: 'You have too many reminders set. Remove some first.' } }, 400)
  if (done === 'past') return c.json({ error: { code: 'invalid', message: 'That time has passed.' } }, 400)
  if (done === 'invalid') return c.json({ error: { code: 'invalid', message: 'That isn’t a valid time.' } }, 400)
  return c.json({ reminder: { at: done.at.toISOString() } })
})

/* Clearing one there is not is `ok`, as unsubscribing is: the caller asks
   for a state. A task they cannot see is 404, as everywhere. */
tasks.delete('/tasks/:id/reminder', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [t] = await tx<{ project_id: string }[]>`
      select project_id from task where id = ${id} and deleted_at is null`
    if (!t) return 'missing' as const
    if (!allowIn(ctx, 'task.remind', t.project_id)) return 'forbidden' as const
    await tx`delete from task_reminder where task_id = ${id} and actor_id = ${ctx.actorId}`
    return 'ok' as const
  })
  if (done === 'missing') return c.json(missing, 404)
  if (done === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true })
})

/**
 * A copy of the plan, not of what happened to it.
 *
 * Title, description, list, priority, labels, assignee, due date and the
 * checklist — and none of the record: no comments, no history, no
 * attachments, no subscribers, and not finished however finished the
 * original is. A duplicate is the next piece of work, and one that arrives
 * already discussed and already done is not one.
 *
 * The steps come with it, because a task whose steps are the same every
 * time is the commonest reason to duplicate one: the release, the
 * handover, the onboarding week. Copying the parent and leaving them
 * behind would answer a question nobody asked.
 *
 * `task.create`, because a duplicate is a task being made by another road.
 */
tasks.post('/tasks/:id/duplicate', async (c) => {
  const ctx = c.get('ctx')
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const made = await copyTask(tx, ctx, c.req.param('id'), { duplicate: true, dry: false })
    if (typeof made === 'string' || !made.id) return made
    /* The copy and its parts as the list draws them, so the screen that
       asked puts them in place rather than reading the project again. */
    const rows = [...(await listRows(tx, ctx.actorId, { ids: [made.id] })), ...(await listRows(tx, ctx.actorId, { parent: made.id }))]
    return { id: made.id, tasks: rows }
  })
  if (typeof result === 'string') return refused(c, result)
  return c.json({ id: result.id, tasks: 'tasks' in result ? result.tasks : [] }, 201)
})

/**
 * A copy of a task in another project, or in this one.
 *
 * The original stays where it is, untouched; the copy is a task made in the
 * project it goes to, by the person copying, so everything about it is
 * asked the way making a task is: the original is theirs to read (row-level
 * security — another project's, another workspace's or outside a limited
 * token is 404), and `task.create` where it goes, through `can()`. Nothing
 * here reaches past the policies, so there is no definer to say them again.
 *
 * `dry` answers what the copy would be and makes nothing — the window reads
 * it before the press, from the same function the copy is then made by.
 */
const CopyBody = z.object({
  project_id: z.uuid(),
  /* Where in it; unsaid, the list of the same name, else the first open one. */
  list_id: z.uuid().nullish(),
  dry: z.boolean().optional(),
})

/* An id as a body carries one — the same pattern `claimFiles` reads with,
   so a node with something else in it is just not a file. */
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* The files a body shows, by the id its nodes carry (`attrs.fileId`). */
function fileIdsIn(body: unknown, into = new Set<string>()): Set<string> {
  if (!body || typeof body !== 'object') return into
  const node = body as { attrs?: { fileId?: unknown }; content?: unknown }
  if (typeof node.attrs?.fileId === 'string' && FILE_ID.test(node.attrs.fileId)) into.add(node.attrs.fileId)
  if (Array.isArray(node.content)) for (const n of node.content) fileIdsIn(n, into)
  return into
}

/* The same body, its files swapped for the copies' — every other node as it was. */
function withFiles(body: unknown, swap: Map<string, string>): unknown {
  if (!body || typeof body !== 'object') return body
  const node = body as { attrs?: Record<string, unknown>; content?: unknown[] }
  const id = node.attrs?.fileId
  return {
    ...node,
    ...(typeof id === 'string' && swap.has(id) ? { attrs: { ...node.attrs, fileId: swap.get(id) } } : {}),
    ...(Array.isArray(node.content) ? { content: node.content.map((n) => withFiles(n, swap)) } : {}),
  }
}

type Refusal = 'missing' | 'forbidden' | 'archived' | 'list' | 'subtask' | 'importing' | 'full'

function refused(c: Context, why: Refusal) {
  if (why === 'missing') return c.json(missing, 404)
  if (why === 'forbidden') return c.json(forbidden, 403)
  if (why === 'archived') return c.json({ error: { code: 'invalid', message: 'That project is archived.' } }, 400)
  if (why === 'list') return c.json({ error: { code: 'invalid', message: 'That list belongs to another project.' } }, 400)
  if (why === 'subtask') return c.json({ error: { code: 'invalid', message: 'A subtask is copied with its task.' } }, 400)
  if (why === 'full') return c.json(storageRefusal(), 413)
  return c.json({ error: { code: 'conflict', message: 'This project is still being imported. Try again when it’s done.' } }, 409)
}

/**
 * The one way a task is written from a task: a copy into a project, and a
 * duplicate beside the original, which is a
 * copy into its own project placed under the original, keeping its list,
 * its sprint and its parts' places, and saying nothing more than that a
 * task was made. Two writers of the same thing were two chances for them to
 * disagree about what a copy carries.
 */
async function copyTask(
  tx: Tx,
  ctx: AuthContext,
  id: string,
  o: { duplicate: true; dry: false } | { duplicate?: false; target: string; listId?: string | null; dry: boolean },
) {
  type Row = {
    id: string
    project_id: string
    parent_id: string | null
    list_id: string | null
    title: string
    body: unknown
    number: number
    assignee_ids: string[]
    due_on: string | null
    priority: string | null
    cycle_id: string | null
    completed_at: string | null
    starts_at: string | null
    ends_at: string | null
    sort_key: string
  }
  const columns = tx`id, project_id, parent_id, list_id, title, body, number, assignee_ids, due_on, priority,
                     cycle_id, completed_at, starts_at, ends_at, sort_key`
  /* Read as the person, so what they cannot see is not there. */
  const [from] = await tx<Row[]>`select ${columns} from task where id = ${id} and deleted_at is null`
  if (!from) return 'missing' as const
  const target = o.duplicate ? from.project_id : o.target
  const same = target === from.project_id
  const [to] = await tx<{ name: string; archived_at: string | null }[]>`
    select name, archived_at from project where id = ${target} and deleted_at is null`
  if (!to) return 'missing' as const
  /* Making a task there, which is what a copy is. */
  if (!allowIn(ctx, 'task.create', target)) return 'forbidden' as const
  if (!o.duplicate && to.archived_at) return 'archived' as const
  /* A part is copied with its task; on its own it would be a part with no
     task, or a task that was a part. Duplicated,
     it is the next part beside it. */
  if (!o.duplicate && from.parent_id) return 'subtask' as const
  const [busy] = await tx<{ on: boolean }[]>`select project_importing(${target}) as on`
  if (busy?.on) return 'importing' as const

  const parts = await tx<Row[]>`
    select ${columns} from task where parent_id = ${id} and deleted_at is null order by sort_key asc`

  /* Its list by name — Doing to Doing — else the first open one. In its own
     project that is its own list. */
  const lists = await tx<{ id: string; name: string; finishes: boolean; intake: boolean }[]>`
    select id, name, finishes, intake from task_list
    where project_id = ${target} and deleted_at is null order by sort_key`
  const [was] = from.list_id ? await tx<{ name: string }[]>`select name from task_list where id = ${from.list_id}` : []
  let into: { id: string; name: string } | null =
    (same ? lists.find((l) => l.id === from.list_id) : undefined) ??
    lists.find((l) => was && l.name.toLowerCase() === was.name.toLowerCase()) ??
    lists.find((l) => !l.finishes && !l.intake) ??
    lists.find((l) => !l.intake) ??
    lists[0] ??
    null
  if (!o.duplicate && o.listId) {
    const chosen = lists.find((l) => l.id === o.listId)
    if (!chosen) return 'list' as const
    into = chosen
  }

  /* Its words by name; a word the project does not have stays behind. */
  const labels = await tx<{ task_id: string; name: string }[]>`
    select tl.task_id, l.name::text as name from task_label tl join label l on l.id = tl.label_id
    where tl.task_id = any(${[id, ...parts.map((p) => p.id)]}::uuid[]) and l.deleted_at is null`
  const theirs = await tx<{ id: string; name: string }[]>`
    select id, name::text as name from label where project_id = ${target} and deleted_at is null`
  const labelFor = new Map(theirs.map((l) => [l.name.toLowerCase(), l.id]))
  const names = (xs: string[]) => [...new Set(xs)].sort()
  const kept = names(labels.filter((l) => labelFor.has(l.name.toLowerCase())).map((l) => l.name))
  const dropped = names(labels.filter((l) => !labelFor.has(l.name.toLowerCase())).map((l) => l.name))

  /* Whoever has it and is on the project it goes to; the rest are not
     given a task they could not open. */
  const everyone = [...new Set([from, ...parts].flatMap((t) => t.assignee_ids))]
  const onIt = await tx<{ actor_id: string }[]>`
    select m.actor_id from membership m
    where m.workspace_id = ${ctx.workspaceId} and m.actor_id = any(${everyone}::uuid[])
      and m.deleted_at is null and m.joined_at is not null
      and (m.role = 'owner' or exists (
        select 1 from project_member pm
        where pm.project_id = ${target} and pm.actor_id = m.actor_id and pm.deleted_at is null))`
  const stays = new Set(onIt.map((r) => r.actor_id))
  const notOn = everyone.filter((a) => !stays.has(a))
  const notOnNames = notOn.length
    ? await tx<{ actor_id: string; name: string }[]>`
        select id as actor_id, name from actor where id = any(${notOn}::uuid[]) order by name`
    : []

  /*
   * The files that are the original project's own — put there, not sent in
   * a room — each get a row of the project the copy goes to, over the same
   * bytes, so who may open it is that project's question. Only those: a
   * body can name any file id at all, and somebody who wrote another
   * project's file into a task would otherwise have it carried, by
   * whoever copied the task, into a project they can read. Every other
   * reference keeps the id it had, and opens for whoever it opened for.
   * Copied within its own project nothing is re-homed: the files are
   * already that project's.
   */
  const shown = new Set<string>()
  for (const t of [from, ...parts]) fileIdsIn(t.body, shown)
  const files =
    shown.size && !same
      ? await tx<Record<string, unknown>[]>`
        select id, name, body, storage_key, content_type, size_bytes, uploaded_at, checksum, url,
               display_key, display_bytes, pixel_width, pixel_height
        from file
        where id = any(${[...shown]}::uuid[]) and deleted_at is null
          and project_id = ${from.project_id} and conversation_id is null
          -- Only what the project has: a copy is the project's, and a
          -- document kept to some people, or a picture put into one, must
          -- not become everybody's by being copied. A file put into any
          -- document is that document's and is never re-homed.
          and audience = 'project' and held_by is null`
      : []

  const [cycle] = from.cycle_id
    ? await tx<{ name: string }[]>`select name from cycle where id = ${from.cycle_id} and deleted_at is null`
    : []
  const [github] = await tx<{ on: boolean }[]>`
    select exists (select 1 from github_link where project_id = ${target} and issues and deleted_at is null) as on`
  const said = {
    id: null as string | null,
    from_project_id: from.project_id,
    project_id: target,
    number: null as number | null,
    list_id: into?.id ?? null,
    list_name: into?.name ?? null,
    subtasks: parts.length,
    labels_kept: kept,
    labels_dropped: dropped,
    cycle: cycle?.name ?? null,
    assignees_dropped: notOnNames,
    files: files.length,
    github_to: github?.on === true,
  }
  if (o.dry) return said

  /* The bytes it adds count against the plan as an upload's would, asked
     under the same lock (`roomFor`). */
  const bytes = files.reduce((n, f) => n + Number(f.size_bytes ?? 0) + Number(f.display_bytes ?? 0), 0)
  if (bytes > 0 && !(await roomFor(tx, ctx.workspaceId, bytes))) return 'full' as const

  /* A duplicate directly under the original, where the eye already is; a
     copy at the top of the list it lands in, where a new task goes. */
  let sortKey: string
  if (o.duplicate) {
    const [below] = await tx<{ sort_key: string }[]>`
      select sort_key from task
      where project_id = ${from.project_id} and deleted_at is null and sort_key > ${from.sort_key}
        ${from.parent_id ? tx`and parent_id = ${from.parent_id}` : tx`and parent_id is null`}
      order by sort_key asc limit 1`
    sortKey = generateKeyBetween(from.sort_key, below?.sort_key ?? null)
  } else {
    const [edge] = await tx<{ sort_key: string }[]>`
      select sort_key from task
      where project_id = ${target} and deleted_at is null and parent_id is null
        and list_id is not distinct from ${into?.id ?? null}
      order by sort_key asc limit 1`
    sortKey = generateKeyBetween(null, edge?.sort_key ?? null)
  }

  const madeId = uuidv7()
  const swap = new Map<string, string>()
  for (const f of files) swap.set(f.id as string, uuidv7())
  const keepOn = (ids: string[]) => ids.filter((a) => stays.has(a))
  const write = async (newId: string, t: Row, parent: string | null, key: string) => {
    const words = t.body ? withFiles(t.body, swap) : null
    /* Its own list and sprint when duplicated beside itself; the list it
       was given and no sprint when copied. */
    const list = o.duplicate ? t.list_id : (into?.id ?? null)
    const sprint = o.duplicate ? t.cycle_id : null
    await tx`
      insert into task (id, workspace_id, project_id, author_id, parent_id, list_id, cycle_id,
                        title, body, assignee_ids, due_on, priority, starts_at, ends_at, sort_key)
      values (${newId}, ${ctx.workspaceId}, ${target}, ${ctx.actorId}, ${parent}, ${list}, ${sprint},
              ${t.title}, ${words ? tx.json(words as never) : null},
              ${keepOn(t.assignee_ids)}::uuid[], ${t.due_on}, ${t.priority}::task_priority,
              ${t.starts_at}, ${t.ends_at}, ${key})`
    if (words) await linkMentionedObjects(tx, ctx, { type: 'task', id: newId }, words)
  }
  await write(madeId, from, o.duplicate ? from.parent_id : null, sortKey)
  /* Its parts, in the order they were written. Copied, each as finished as
     it was — a part is finished or not on its own, and the list it lands in
     would otherwise decide it on the way in. Duplicated, the plan without
     the record, as it always was. */
  let at: string | null = null
  const madeParts: string[] = []
  for (const part of parts) {
    at = generateKeyBetween(at, null)
    const partId = uuidv7()
    madeParts.push(partId)
    await write(partId, part, madeId, at)
    if (!o.duplicate) {
      await tx`update task set completed_at = ${part.completed_at} where id = ${partId}
               and completed_at is distinct from ${part.completed_at}`
    }
  }
  /* The files, as rows of this project's over the same bytes. The clear-out
     takes bytes only when no row is left that names them. */
  for (const f of files) {
    await tx`
      insert into file (id, workspace_id, project_id, author_id, name, body, storage_key, content_type, size_bytes,
                        uploaded_at, checksum, url, display_key, display_bytes, pixel_width, pixel_height,
                        origin_type, origin_id)
      values (${swap.get(f.id as string)!}, ${ctx.workspaceId}, ${target}, ${ctx.actorId}, ${f.name as string},
              ${f.body ? tx.json(f.body as never) : null}, ${f.storage_key as string | null}, ${f.content_type as string | null}, ${f.size_bytes as number | null},
              ${f.uploaded_at as string | null}, ${f.checksum as string | null}, ${f.url as string | null},
              ${f.display_key as string | null}, ${f.display_bytes as number | null},
              ${f.pixel_width as number | null}, ${f.pixel_height as number | null}, 'task', ${madeId})`
  }
  const byOld = new Map([[id, madeId], ...parts.map((p, i) => [p.id, madeParts[i]!] as [string, string])])
  const wanted = labels
    .filter((l) => labelFor.has(l.name.toLowerCase()))
    .map((l) => ({
      id: uuidv7(),
      workspace_id: ctx.workspaceId,
      task_id: byOld.get(l.task_id)!,
      label_id: labelFor.get(l.name.toLowerCase())!,
    }))
  if (wanted.length) {
    await tx`insert into task_label ${tx(wanted, 'id', 'workspace_id', 'task_id', 'label_id')}
             on conflict (task_id, label_id) do nothing`
  }

  const [made] = await tx<{ number: number }[]>`select number from task where id = ${madeId}`
  if (o.duplicate) {
    /* What a duplicate always said: a task was made. */
    await record(tx, ctx, 'task.create', { projectId: target, objectType: 'task', objectId: madeId })
    return { ...said, id: madeId, number: made?.number ?? null }
  }
  await subscribe(tx, ctx, 'task', madeId)
  /*
   * A line on each. The copy's says where it came from, and the original's
   * where it went; each names the other project by id, so a reader who is
   * not on it reads "another project" — and the original's line is not
   * shown at all to whoever cannot see the copy (`/activity`), nor sent to
   * its screens.
   */
  await record(tx, ctx, 'task.copy', {
    projectId: target,
    objectType: 'task',
    objectId: madeId,
    meta: { from_task_id: id, from_project_id: from.project_id, from_number: from.number },
  })
  await record(tx, ctx, 'task.copied', {
    projectId: from.project_id,
    objectType: 'task',
    objectId: id,
    feedOnly: true,
    meta: { to_task_id: madeId, to_project_id: target, to_number: made?.number ?? null },
  })
  /* Whoever is given it or one of its parts hears so, as from a task made
     there; nobody else is told anything. */
  const who = await doer(tx, ctx.actorId)
  for (const [t, newId] of [[from, madeId], ...parts.map((p, i) => [p, madeParts[i]!] as const)] as [Row, string][]) {
    const given = keepOn(t.assignee_ids).filter((a) => a !== ctx.actorId)
    if (given.length) {
      await notify(tx, ctx, {
        objectType: 'task',
        objectId: newId,
        assignees: given,
        watchers: false,
        whatFor: { assigned: (l) => LINES(l).gaveYou(who(l)) },
      })
    }
  }
  return { ...said, id: madeId, number: made?.number ?? null }
}

tasks.post('/tasks/:id/copy', async (c) => {
  const ctx = c.get('ctx')
  const body = CopyBody.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const made = await copyTask(tx, ctx, c.req.param('id'), {
      target: body.data.project_id,
      listId: body.data.list_id ?? null,
      dry: body.data.dry === true,
    })
    if (typeof made === 'string' || !made.id) return made
    /* The copy and its parts as its project's list draws them: copied into
       the project it came from, the list behind puts them in place rather
       than reading the project again. */
    return {
      ...made,
      tasks: [...(await listRows(tx, ctx.actorId, { ids: [made.id] })), ...(await listRows(tx, ctx.actorId, { parent: made.id }))],
    }
  })
  if (typeof result === 'string') return refused(c, result)
  return c.json(result, body.data.dry ? 200 : 201)
})

tasks.delete('/tasks/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<
      {
        author_id: string
        project_id: string
        title: string
        body: unknown
        number: number
        assignee_ids: string[]
        priority: string | null
        due_on: string | null
        starts_at: string | null
        ends_at: string | null
        repeat: unknown
        list_id: string | null
        sort_key: string
        parent_id: string | null
        completed_at: string | null
      }[]
    >`
      select author_id, project_id, title, body, number, assignee_ids, priority, due_on, starts_at, ends_at,
             repeat, list_id, sort_key, parent_id, completed_at
      from task where id = ${id} and deleted_at is null for update`
    if (!row) return 'missing' as const
    /*
     * Your own, always. Somebody else's needs `task.delete`.
     *
     * The same shape as editing — own is free, any is granted — because it
     * is the same question about a stronger verb. Throwing away a typo you
     * made a second ago is not a permission anybody should have to be given.
     */
    if (row.author_id !== ctx.actorId && !allowIn(ctx, 'task.delete', row.project_id)) {
      return 'forbidden' as const
    }
    /* Never through a token, one's own included: deleting is one of the
       things a tool acting for somebody does not do.
       The own-task branch skipped the check that says so. */
    if (ctx.viaMcp) return 'forbidden' as const
    /* Its steps go with it. They are tasks with a parent, so nothing else
       would take them, and a checklist left behind by the task it belongs
       to is a row with no row above it. */
    /* And who did it, so Undo is theirs. */
    /* Only steps still standing: one deleted before, by whoever, keeps who
       deleted it and stays deleted when this one is put back. */
    await tx`
      update task set deleted_at = now(), deleted_by = ${ctx.actorId}
      where id = ${id} or (parent_id = ${id} and deleted_at is null)`
    /* Named as it was: once it is gone the feed has nothing else to read
       its name from. */
    await record(tx, ctx, 'task.delete', {
      projectId: row.project_id,
      objectType: 'task',
      objectId: id,
      meta: { title: row.title },
    })
    /*
     * Deleting one of a series is skipping it, not stopping it: the next one
     * is made as if this one were done, and putting this one back takes it
     * back. Stopping is clearing the rule.
     */
    const nextId =
      row.repeat && row.parent_id === null && row.completed_at === null
        ? await makeNext(tx, ctx, { ...row, id, list_before: row.list_id, key_before: row.sort_key, list_now: null })
        : null
    /* The one it made, with its parts, as the list draws them — so the
       screen that deleted puts it in place without reading the project
       again, as finishing one does. */
    if (!nextId) return {}
    const [next] = await listRows(tx, ctx.actorId, { ids: [nextId] })
    return next ? { next, next_parts: await listRows(tx, ctx.actorId, { parent: nextId }) } : {}
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true, ...result })
})

/**
 * Putting one back, which is what the toast's Undo presses.
 *
 * Deleting is soft — `deleted_at` is set and the clear-out takes the row
 * some days later — so for as long as that window lasts the row is still
 * there to un-delete. This is the only thing in the product that reverses
 * a mutation, and it is narrow on purpose: one object, by its id, by
 * somebody who could have deleted it.
 *
 * The project's handbook is right that reversibility cannot be added later as a
 * feature. This is not that — it is one verb with an opposite, not an
 * op-log — and the difference is worth keeping clear.
 */
tasks.post('/tasks/:id/restore', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const result = await flat(() =>
    withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
      const [row] = await tx<{ deleted_by: string | null; project_id: string; completed_at: string | null }[]>`
      select t.deleted_by, t.project_id, t.completed_at from task t
      join project p on p.id = t.project_id and p.deleted_at is null
      where t.id = ${id} and t.workspace_id = ${ctx.workspaceId} and t.deleted_at is not null
      for update of t`
      if (!row) return 'missing' as const
      /* Whoever deleted it, or whoever may delete anybody's — not its author
       as such: a task somebody else took down is not its author's to bring
       back a week later. Never through a token. */
      if (!mayTakeBack(ctx, row.deleted_by, row.project_id, 'task.delete')) return 'forbidden' as const
      /*
       * A subtask whose parent was put under another task while it was in
       * Trash comes back standing on its own: under its old parent it would
       * be two levels deep, which the trigger refuses — and refusing to put
       * it back at all would lose it. The parent is held while this is read.
       */
      const [under] = await tx<{ nested: boolean }[]>`
      select p.parent_id is not null as nested from task t join task p on p.id = t.parent_id
      where t.id = ${id} for share of p`
      if (under?.nested) await tx`update task set parent_id = null where id = ${id}`
      /* Its steps that went with it — deleted in the same statement, by the
       same person — and not one deleted on its own before. */
      await tx`
      update task t set deleted_at = null, deleted_by = null
      from task p
      where p.id = ${id}
        and (t.id = p.id
             or (t.parent_id = p.id and t.deleted_at = p.deleted_at
                 and t.deleted_by is not distinct from p.deleted_by))`
      await record(tx, ctx, 'task.create', {
        projectId: row.project_id,
        objectType: 'task',
        objectId: id,
      })
      /* The next one its deleting made goes, and the rule comes back with it.
       A finished one's next was made by finishing it, and stays. */
      if (row.completed_at === null) await takeNextBack(tx, ctx, id)
      return 'ok' as const
    }),
  )
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'nested' || result === 'invalid_nest') return c.json(subtaskNested, 400)
  if (result === 'has_subtasks') return c.json(hasSubtasks, 400)
  return c.json({ ok: true })
})

tasks.post('/tasks/:id/comments', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z
    .object({
      body: RichBody,
      parent_id: z.uuid().nullish(),
      said_as: z.string().max(120).nullish(),
      /* A question with choices. */
      choices: z
        .array(z.object({ label: z.string().trim().min(1).max(80), recommended: z.boolean().optional() }))
        .min(2)
        .max(4)
        .optional(),
      to: z.array(z.uuid()).min(1).max(10).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const { choices, to } = body.data
  /* A question starts a thread, has at most one choice recommended, and
     `to` means nothing without choices. */
  if ((to && !choices) || (choices && (body.data.parent_id || choices.filter((x) => x.recommended).length > 1)))
    return c.json({ error: { code: 'invalid' } }, 400)
  const projectId = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ project_id: string }[]>`
      select project_id from task where id = ${id} and deleted_at is null`
    return row?.project_id ?? null
  })
  if (!projectId) return c.json(missing, 404)
  if (choices && !allowIn(ctx, 'question.ask', projectId, { inProject: true }))
    return c.json({ error: { code: 'forbidden', message: 'Only an agent asks a question with choices.' } }, 403)
  const made = await addComment(
    ctx,
    'task',
    id,
    projectId,
    body.data.body,
    body.data.parent_id ?? null,
    body.data.said_as ?? null,
    null,
    choices ? { choices, to: to ?? null } : null,
  )
  if (made === 'nobody_to_ask')
    return c.json({ error: { code: 'nobody_to_ask', message: 'No one who can see this task can be asked.' } }, 409)
  return made && typeof made === 'object' ? c.json(made, 201) : c.json(forbidden, 403)
})

/* -------------------------------------------------------------- subtasks */

/**
 * A part of a task.
 *
 * The same row as any other task, so everything already written about a task
 * applies to it: an assignee, a date, an address, comments, a soft delete.
 * This endpoint exists because adding one from inside its parent is worth a
 * shorter way to say it than the full create.
 */
tasks.post('/tasks/:id/steps', async (c) => {
  const ctx = c.get('ctx')
  const parentId = c.req.param('id')
  /*
   * A subtask is a task, so making one takes what making a task takes.
   *
   * It used to take a title and nothing else, which was right while a part
   * was a tick in a checklist and wrong since it stopped being one: the thing
   * being made has an assignee, a date, a priority and a place, and a form
   * that cannot say any of them is a form that makes you open what you just
   * made.
   */
  const body = z
    .object({
      title: z.string().min(1).max(300),
      body: RichBody.nullish(),
      list_id: z.uuid().nullish(),
      assignee_ids: z.array(z.uuid()).max(10).nullish(),
      assignee_id: z.uuid().nullish(),
      due_on: z.iso.date().nullish(),
      priority: Priority.nullish(),
      labels: z.array(z.uuid()).nullish(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const id = uuidv7()
  const made = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [t] = await tx<{ project_id: string; list_id: string | null }[]>`select project_id, list_id from task
      where id = ${parentId} and parent_id is null and deleted_at is null for share`
    // Not found and "that is itself a part" answer the same way: a subtask of
    // a subtask is refused by the trigger too, and which it was is not
    // information this endpoint owes anybody.
    if (!t) return 'missing' as const
    if (!allowIn(ctx, 'task.create', t.project_id)) return 'forbidden' as const
    if (!(await labelsBelong(tx, t.project_id, body.data.labels))) return 'labels' as const
    const assignees = assigneesOf(body.data) ?? []
    if (!(await assigneesBelong(tx, ctx, t.project_id, assignees))) return 'assignee' as const

    const [last] = await tx<{ sort_key: string }[]>`
      select sort_key from task where parent_id = ${parentId} and deleted_at is null
      order by sort_key desc limit 1`
    /* As a task is made: a draft it names without its title, and its files
       and links recorded. */
    if (body.data.body) body.data.body = await veilDocrefs(tx, body.data.body)
    await tx`
      insert into task (id, workspace_id, project_id, author_id, parent_id,
                        list_id, title, body, assignee_ids, due_on, priority, sort_key)
      values (${id}, ${ctx.workspaceId}, ${t.project_id}, ${ctx.actorId}, ${parentId},
              /* Its parent's list when nothing says otherwise: a part of
                 something in Doing is being done. */
              ${body.data.list_id ?? t.list_id}, ${body.data.title},
              ${body.data.body ? tx.json(body.data.body as never) : null},
              ${assignees}::uuid[], ${body.data.due_on ?? null},
              ${body.data.priority ?? null}::task_priority,
              ${generateKeyBetween(last?.sort_key ?? null, null)})`
    await putLabelsOn(tx, ctx, id, body.data.labels)
    await subscribe(tx, ctx, 'task', id)
    if (body.data.body) await linkMentionedObjects(tx, ctx, { type: 'task', id }, body.data.body)
    /* A part given to somebody is theirs as much as a task is. */
    const who = await doer(tx, ctx.actorId)
    await notify(tx, ctx, {
      objectType: 'task',
      objectId: id,
      body: body.data.body,
      assignees,
      whatFor: { assigned: (l) => LINES(l).gaveYou(who(l)) },
    })
    await record(tx, ctx, 'task.create', {
      projectId: t.project_id,
      objectType: 'task',
      objectId: id,
      ...(assignees.length ? { meta: { given_ids: assignees } } : {}),
    })
    /* The part as the list draws it, so the list behind its parent's screen
       gains the row, and the parent its count, without reading the project
       again. */
    const [row] = await listRows(tx, ctx.actorId, { ids: [id] })
    return { row }
  })
  if (made === 'labels') return c.json({ error: { code: 'invalid', message: 'That label belongs to another project.' } }, 400)
  if (made === 'assignee') return c.json(notOnIt, 400)
  if (made === 'forbidden') return c.json(forbidden, 403)
  return made === 'missing' ? c.json(missing, 404) : c.json({ id, ...(made.row ? { task: made.row } : {}) }, 201)
})

/**
 * Ticking one off from inside its parent.
 *
 * `PATCH /api/tasks/:id { completed_at }` does the same thing and is what
 * the list uses. This is kept because it is the shape the checklist had, and
 * because "done" is a boolean here rather than a timestamp the caller has to
 * invent.
 */
tasks.patch('/steps/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z.object({ done: z.boolean() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ author_id: string; project_id: string; completed_at: string | null }[]>`
      select author_id, project_id, completed_at from task
      where id = ${id} and parent_id is not null and deleted_at is null`
    if (!row) return 'missing' as const
    if (!mayEdit(ctx, row.author_id, row.project_id)) return 'forbidden' as const
    await tx`
      update task set completed_at = ${body.data.done ? tx`now()` : null},
                      decided_at = now()
      where id = ${id}`
    /* A part can be waited on like any task. */
    if (body.data.done && row.completed_at === null) await tellUnblocked(tx, ctx, id)
    /* Written down like finishing any task, so the feed has it and a synced
       subtask's issue closes with it — it went nowhere before. */
    if ((row.completed_at === null) === body.data.done) {
      await record(tx, ctx, 'task.update', {
        projectId: row.project_id,
        objectType: 'task',
        objectId: id,
        meta: body.data.done ? { finished: true } : { reopened: true },
      })
    }
    /* And the part as the list draws it, with the tasks it blocks as they
       wait now, the same as a PATCH of the task answers — so nothing is
       read again for one tick. */
    const rewaits = (row.completed_at === null) === body.data.done ? await waitingOnNow(tx, id) : []
    const [changed] = await listRows(tx, ctx.actorId, { ids: [id] })
    return { changed, rewaits }
  })
  if (result === 'forbidden') return c.json(forbidden, 403)
  return result === 'missing'
    ? c.json(missing, 404)
    : c.json({ ok: true, ...(result.changed ? { task: result.changed } : {}), rewaits: result.rewaits })
})

/* ------------------------------------------------------------------ lists */

/**
 * The cycles a project has, newest first.
 *
 * Counted the way the lists are — the picker says how many are in each, and
 * the only other way to know is to fetch the tasks and count. One join over
 * the index made for it.
 */
tasks.get('/projects/:projectId/cycles', async (c) => {
  const ctx = c.get('ctx')
  const rows = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      tx`select y.id, y.name, y.starts_on, y.ends_on,
              count(t.id)::int as tasks
       from cycle y
       left join task t on t.cycle_id = y.id and t.deleted_at is null
       where y.project_id = ${c.req.param('projectId')} and y.deleted_at is null
       group by y.id
       /* By when it runs, not by when it was written: a cycle somebody adds
          late for a stretch already past belongs where its dates put it. */
       order by y.starts_on desc`,
  )
  return c.json({ cycles: rows })
})

tasks.post('/projects/:projectId/cycles', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  /* A cycle is where tasks go, so it is the permission tasks have — the same
     reasoning as a list. */
  if (!allowIn(ctx, 'task.create', projectId)) return c.json(forbidden, 403)
  const body = z
    .object({
      name: z.string().min(1).max(200),
      starts_on: z.string().min(10).max(10),
      ends_on: z.string().min(10).max(10),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  /* The one rule the dates have. Nothing starts a cycle and nothing closes
     one, but a stretch that ends before it begins is a typo rather than a
     decision. */
  if (body.data.ends_on < body.data.starts_on) {
    return c.json({ error: { code: 'invalid', message: 'The end date can’t be before the start date.' } }, 400)
  }

  const id = uuidv7()
  const made = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (!(await isInProject(tx, projectId))) return 'missing' as const
    await tx`
      insert into cycle (id, workspace_id, project_id, author_id, name, starts_on, ends_on)
      values (${id}, ${ctx.workspaceId}, ${projectId}, ${ctx.actorId}, ${body.data.name},
              ${body.data.starts_on}::date, ${body.data.ends_on}::date)`
    await record(tx, ctx, 'cycle.create', { projectId })
    return 'made' as const
  })
  if (made === 'missing') return c.json(missing, 404)
  return c.json({ id }, 201)
})

/**
 * A sprint renamed or moved in time — its name and its two dates.
 *
 * The same permission that made it, and the same one rule the dates have.
 */
tasks.patch('/cycles/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z
    .object({
      name: z.string().min(1).max(200).optional(),
      starts_on: z.string().min(10).max(10).optional(),
      ends_on: z.string().min(10).max(10).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [y] = await tx<{ project_id: string; starts_on: string; ends_on: string }[]>`
      select project_id, starts_on, ends_on from cycle where id = ${id} and deleted_at is null`
    if (!y) return 'missing' as const
    if (!allowIn(ctx, 'task.create', y.project_id)) return 'forbidden' as const
    const from = body.data.starts_on ?? y.starts_on
    const to = body.data.ends_on ?? y.ends_on
    if (to < from) return 'backwards' as const
    await tx`
      update cycle set name = coalesce(${body.data.name ?? null}, name),
                       starts_on = ${from}::date, ends_on = ${to}::date, updated_at = now()
      where id = ${id}`
    return 'ok' as const
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'backwards') {
    return c.json({ error: { code: 'invalid', message: 'The end date can’t be before the start date.' } }, 400)
  }
  return c.json({ ok: true })
})

/**
 * A sprint taken away.
 *
 * Softly, like everything else. The tasks in it are not deleted with it —
 * a sprint is when, not what — they simply stop being in one, the same
 * answer a task gives that was never put in a sprint.
 */
tasks.delete('/cycles/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [y] = await tx<{ project_id: string }[]>`
      select project_id from cycle where id = ${id} and deleted_at is null`
    if (!y) return 'missing' as const
    if (!allowIn(ctx, 'task.create', y.project_id)) return 'forbidden' as const
    await tx`update task set cycle_id = null where cycle_id = ${id}`
    await tx`update cycle set deleted_at = now() where id = ${id}`
    return 'ok' as const
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true })
})

tasks.get('/projects/:projectId/lists', async (c) => {
  const ctx = c.get('ctx')
  const rows = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      /*
       * How many are in each, counted here rather than by the caller.
       *
       * The settings screen has to say "this one holds seven" before it takes a
       * list away, and the only other way to know is to fetch the project's
       * tasks and count them — ten thousand rows to write one number. One join
       * over the index that already exists for the board.
       */
      tx`select l.id, l.name, l.sort_key, l.progress, l.finishes, l.icon, l.color, l.narrow, l.intake,
              l.agent_id,
              /* Its agent left the project or was disconnected: kept, and
                 said, and given nothing. */
              (l.agent_id is not null and not exists (
                select 1 from agent g
                join project_member pm on pm.actor_id = g.actor_id and pm.project_id = l.project_id and pm.deleted_at is null
                where g.actor_id = l.agent_id and g.deleted_at is null)) as agent_gone,
              count(t.id)::int as tasks
       from task_list l
       left join task t on t.list_id = l.id and t.deleted_at is null
       where l.project_id = ${c.req.param('projectId')} and l.deleted_at is null
       group by l.id
       order by l.sort_key`,
  )
  return c.json({ lists: rows })
})

tasks.post('/projects/:projectId/lists', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  // A list is where tasks go, so it is the same permission. A person who may
  // make tasks and not the list to put them in can only add to somebody
  // else's arrangement.
  if (!allowIn(ctx, 'task.create', projectId)) return c.json(forbidden, 403)
  const body = z
    .object({
      name: z.string().min(1).max(200),
      /* Chosen when the list is made, because that is when somebody knows
         what the list is for. An empty ring if they
         do not say. */
      icon: ListIcon.default('open'),
      /* Left alone here on purpose. The mark is
         asked for when a list is made because that is when somebody knows
         what it is for; a colour is not that kind of fact, and null means
         the mark decides, which is a good default. It is accepted for the
         clients that want to send one. */
      color: ListColor.nullish(),
      /** Whether work that lands here is finished. */
      finishes: z.boolean().default(false),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const id = uuidv7()
  const made = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (!(await isInProject(tx, projectId))) return 'missing' as const
    const [last] = await tx<{ sort_key: string }[]>`
      select sort_key from task_list where project_id = ${projectId} and deleted_at is null
      order by sort_key desc limit 1`
    await tx`
      insert into task_list (id, workspace_id, project_id, author_id, name, sort_key,
                             icon, color, finishes)
      values (${id}, ${ctx.workspaceId}, ${projectId}, ${ctx.actorId}, ${body.data.name},
              ${generateKeyBetween(last?.sort_key ?? null, null)},
              ${body.data.icon}, ${body.data.color ?? null}, ${body.data.finishes})`
    return true
  })
  return made ? c.json({ id }, 201) : c.json(missing, 404)
})

/**
 * Triage on, inside a transaction already open: the list at the head of the
 * project, named *Triage*, or the one it has. Asked by the switch below and
 * by a feedback page turned on, whose requests
 * arrive there. Whoever calls it has asked `project.tools` or something
 * that carries it, and whether an import is still running.
 */
export async function triageOn(tx: Tx, ctx: AuthContext, projectId: string): Promise<string | null> {
  const lists = await tx<{ id: string; sort_key: string; intake: boolean }[]>`
    select id, sort_key, intake from task_list where project_id = ${projectId} and deleted_at is null order by sort_key`
  const intake = lists.find((l) => l.intake)
  if (intake) return intake.id
  /* Two at once are one: the second meets the index and takes the first's. */
  await tx`
    insert into task_list (id, workspace_id, project_id, author_id, name, sort_key, icon, finishes, intake)
    values (${uuidv7()}, ${ctx.workspaceId}, ${projectId}, ${ctx.actorId}, 'Triage',
            ${generateKeyBetween(null, lists[0]?.sort_key ?? null)}, 'backlog', false, true)
    on conflict (project_id) where intake and deleted_at is null do nothing`
  const [made] = await tx<{ id: string }[]>`
    select id from task_list where project_id = ${projectId} and intake and deleted_at is null`
  return made?.id ?? null
}

/**
 * Triage on or off. On, a list for it at the head
 * of the project; off, what waits there goes to the first list after it,
 * and the list goes. Whoever runs the project's tools, by hand.
 */
tasks.put('/projects/:projectId/triage', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  if (ctx.viaMcp || ctx.viaGithub || ctx.viaImport || !allowIn(ctx, 'project.tools', projectId)) return c.json(forbidden, 403)
  const body = z.object({ on: z.boolean() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (!(await isInProject(tx, projectId))) return 'missing' as const
    /* Not while Linear's issues are still coming: its pages find the
       Triage list by name. */
    const [busy] = await tx<{ on: boolean }[]>`select project_importing(${projectId}) as on`
    if (busy?.on) return 'importing' as const
    const lists = await tx<{ id: string; sort_key: string; intake: boolean }[]>`
      select id, sort_key, intake from task_list where project_id = ${projectId} and deleted_at is null order by sort_key`
    const intake = lists.find((l) => l.intake)
    if (body.data.on) return triageOn(tx, ctx, projectId)
    if (!intake) return null
    const next = lists.find((l) => !l.intake)
    /* Every task in it, deleted ones too, as taking a list away moves them:
       one restored later would come back into a list that is gone. */
    await tx`update task set list_id = ${next?.id ?? null}, updated_at = now() where list_id = ${intake.id}`
    await tx`update task_list set deleted_at = now(), updated_at = now() where id = ${intake.id}`
    await record(tx, ctx, 'list.delete', { projectId, meta: { list_id: intake.id, into: next?.id ?? null } })
    return null
  })
  if (done === 'missing') return c.json(missing, 404)
  if (done === 'importing') {
    return c.json({ error: { code: 'conflict', message: 'This project is still being imported. Try again when it’s done.' } }, 409)
  }
  return c.json({ list_id: done })
})

/**
 * The progress curve is a field on the list with a history, not an object.
 * Moving it is a decision somebody makes by hand — nothing infers it.
 */
tasks.patch('/lists/:id', async (c) => {
  const ctx = c.get('ctx')
  const body = z
    .object({
      name: z.string().min(1).max(200).optional(),
      icon: ListIcon.optional(),
      /* Nullable and optional are two different answers here: absent leaves
         the colour alone, null gives the mark its own back. Everything else
         on this row is written with `coalesce`, which cannot tell them
         apart, so this one is written out. */
      color: ListColor.nullable().optional(),
      progress: z.number().min(0).max(1).nullish(),
      /* Whether work in this list is finished. Not
         the name and not the position: both are the person's to change, and
         a rule reading either breaks the first time somebody renames "Done"
         to "Shipped" or drags it up the board. */
      finishes: z.boolean().optional(),
      /* Where it goes in the project's order: after this list, or first
         when null. */
      after: z.uuid().nullable().optional(),
      /* The agent that takes its new tasks, null for nobody — absent leaves
         it alone. */
      agent_id: z.uuid().nullable().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  const id = c.req.param('id')
  const done = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    /*
     * The same permission making one needs, asked before the write.
     *
     * It was asked nowhere: the row was reachable by anybody in the
     * workspace whose project it was, so a person given everything except
     * `task.create` could still rename the columns of somebody else's board.
     * The screen hid the control, which is not the same as the server
     * refusing it.
     */
    const [list] = await tx<{ project_id: string; finishes: boolean; agent_id: string | null }[]>`
      select project_id, finishes, agent_id from task_list where id = ${id} and deleted_at is null`
    if (!list) return 'missing' as const
    if (!allowIn(ctx, 'task.create', list.project_id)) return 'forbidden' as const
    /*
     * Who takes its new tasks: a person's press, by whoever may arrange
     * the lists (`list.agent`), and only an agent on this project now, on
     * a list that does not finish work.
     */
    const naming = body.data.agent_id
    if (naming !== undefined) {
      if (!allowIn(ctx, 'list.agent', list.project_id)) return 'forbidden' as const
      if (naming !== null) {
        if (body.data.finishes ?? list.finishes) return 'finishes' as const
        const [agent] = await tx`
          select 1 from agent where actor_id = ${naming} and workspace_id = ${ctx.workspaceId} and deleted_at is null`
        if (!agent || !(await assigneesBelong(tx, ctx, list.project_id, [naming]))) return 'not_agent' as const
      }
    }

    const rows = await tx<{ project_id: string }[]>`
      update task_list set
        name = coalesce(${body.data.name ?? null}, name),
        icon = coalesce(${body.data.icon ?? null}, icon),
        color = case when ${body.data.color !== undefined} then ${body.data.color ?? null}
                     else color end,
        progress = coalesce(${body.data.progress ?? null}, progress),
        finishes = coalesce(${body.data.finishes ?? null}, finishes),
        -- A list made to finish work takes no agent: it is let go in the
        -- same write. Otherwise absent leaves it, null takes it off.
        agent_id = case when ${body.data.finishes === true} then null
                        when ${naming !== undefined} then ${naming ?? null}::uuid
                        else agent_id end
      where id = ${id} and deleted_at is null
      returning project_id`
    if (!rows.length) return 'missing' as const
    /*
     * Moved in the order: the whole order written again rather than one key
     * squeezed between two. A project has a handful of lists, and this way
     * no two can ever share a key, whatever was there before.
     */
    if (body.data.after !== undefined) {
      const all = await tx<{ id: string }[]>`
        select id from task_list where project_id = ${rows[0]!.project_id} and deleted_at is null
        order by sort_key, id`
      const rest = all.map((l) => l.id).filter((x) => x !== id)
      const at = body.data.after === null ? 0 : rest.indexOf(body.data.after) + 1
      if (body.data.after !== null && at === 0) return 'missing' as const
      rest.splice(at, 0, id)
      const keys = generateNKeysBetween(null, null, rest.length)
      for (let i = 0; i < rest.length; i++) {
        await tx`update task_list set sort_key = ${keys[i]!} where id = ${rest[i]!}`
      }
    }
    /* The tasks already in it follow: a list that starts finishing work does
       so for what is in it, not only for what arrives next. */
    if (body.data.finishes !== undefined) {
      await tx`
        update task set completed_at = ${body.data.finishes ? tx`now()` : null}
        where list_id = ${id} and deleted_at is null
          and completed_at is ${body.data.finishes ? tx`null` : tx`not null`}`
    }
    if (naming !== undefined && naming !== list.agent_id) {
      await record(tx, ctx, 'list.agent', { projectId: rows[0]!.project_id, meta: { list_id: id, agent_id: naming } })
    }
    if (body.data.progress !== undefined && body.data.progress !== null) {
      await record(tx, ctx, 'list.progress', {
        projectId: rows[0]!.project_id,
        meta: { list_id: id, progress: body.data.progress },
      })
    }
    return 'ok' as const
  })
  if (done === 'forbidden') return c.json(forbidden, 403)
  if (done === 'finishes') {
    return c.json({ error: { code: 'invalid', message: 'A list that finishes tasks can’t have an agent.' } }, 400)
  }
  if (done === 'not_agent') return c.json({ error: { code: 'invalid', message: 'Choose an agent on this project.' } }, 400)
  return done === 'ok' ? c.json({ ok: true }) : c.json(missing, 404)
})

/**
 * A list goes, and the work that was in it has to be somewhere.
 *
 * `?into=<list id>` moves the tasks there; `?into=nowhere` leaves them with no
 * list, where the tasks screen shows them under "No list". The destination is
 * **required** while the list holds anything — a list emptied into nowhere by
 * default is a board that quietly lost a column and an afternoon spent
 * working out where seven tasks went.
 *
 * `task.delete`, not `task.create`: this is the verb that takes work away
 * from everybody, and it is one of the actions a token may never perform.
 */
tasks.delete('/lists/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const into = c.req.query('into') ?? null

  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ project_id: string }[]>`
      select project_id from task_list where id = ${id} and deleted_at is null`
    if (!row) return 'missing' as const
    if (!allowIn(ctx, 'task.delete', row.project_id)) return 'forbidden' as const

    const [count] = await tx<{ n: number }[]>`
      select count(*)::int as n from task
      where list_id = ${id} and deleted_at is null`
    if ((count?.n ?? 0) > 0 && into === null) return 'where' as const

    let dest: string | null = null
    if (into !== null && into !== 'nowhere') {
      /* In this project, not this list, and still there. A destination that
         fails any of those is refused rather than read as "nowhere": losing
         the tasks to a typo in a query string is the fault this whole
         argument is about. */
      const [other] = await tx<{ id: string }[]>`
        select id from task_list
        where id = ${into} and project_id = ${row.project_id}
          and deleted_at is null and id <> ${id}`
      if (!other) return 'invalid' as const
      dest = other.id
    }

    /*
     * Every task in it, the thrown-away ones included.
     *
     * A soft-deleted task still points at the list, and the clear-out deletes
     * by age table by table — a list emptied of only its live tasks is a row
     * the purge cannot remove while a task deleted last week still references
     * it. Moving all of them means nothing is left pointing here.
     *
     * `completed_at` follows by itself: the trigger on `list_id` stamps a
     * task moving into a finishing list and clears one moving out.
     */
    await tx`update task set list_id = ${dest} where list_id = ${id}`
    await tx`update task_list set deleted_at = now() where id = ${id}`
    await record(tx, ctx, 'list.delete', {
      projectId: row.project_id,
      meta: { list_id: id, moved: count?.n ?? 0, into: dest },
    })
    return 'ok' as const
  })

  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'invalid') {
    return c.json({ error: { code: 'invalid', message: 'Choose another list to move the tasks to.' } }, 400)
  }
  if (result === 'where') {
    return c.json({ error: { code: 'conflict', message: 'Choose where to move this list’s tasks.' } }, 409)
  }
  return c.json({ ok: true })
})
