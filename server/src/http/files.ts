import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { RichBody } from './body.js'
import { DocTemplate, MAX_FILE_BYTES, MarkIcon, MarkTint, fillTemplate, templateDoc } from '@tracker/shared-schema'
import { v7 as uuidv7 } from 'uuid'
import { randomBytes } from 'node:crypto'
import { pixelsOf } from '../pixels.js'
import { withActor, type Tx } from '../db.js'
import { allow, allowIn, type AuthContext } from '../auth/context.js'
import { record } from './activity.js'
import { FILE_COOKIE, linkFor, linkForReader, open, put, readFileCookie, remove, verifyKey, verifyKeyFor } from '../storage.js'
import { authenticate } from '../auth/context.js'
import { origin as originOf } from './access.js'
import { fits, roomFor, storageRefusal } from '../ceilings.js'
import { isMoment, pageSize } from './limits.js'
import { purgeAfterDays } from '../env.js'
import {
  addComment,
  apart,
  commentCursor,
  commentsIn,
  follow,
  forbidden,
  isInProject,
  listComments,
  mayEdit,
  missing,
  subscribe,
} from './objects.js'
import { todayFor } from '../day.js'
import { anchorReady, anchorThread, mergeBody, Refused, storePatched, topicOf, type Anchor } from '../coedit.js'
import { carryRich, threadsIn } from '../yjson.js'
import { publish } from '../realtime.js'
import { LINES, doer, notify } from '../notify.js'
import { keepVersion } from '../versions.js'

type Vars = { ctx: AuthContext }
export const files = new Hono<{ Variables: Vars }>()

/** An original drawn as a list's tile only up to this size; past it, only
    its copy for showing is. */
export const THUMB_ORIGINAL_BYTES = 512 * 1024

/**
 * A document, an upload, a link and a folder are one entity.
 *
 * A folder is the fourth of those: a row with none of the three places to
 * read from, which is exactly what a folder is — a name other rows point at.
 * `is_folder` on create says so; nothing else about it differs.
 *
 * People think of them as three things and they are the same row with a
 * different place to read from: `body` is written here, `storage_key` is
 * uploaded here, `url` is kept elsewhere. So a folder holds all three, a
 * comment works on all three, and client visibility is decided once.
 */
/**
 * A pinned document's first lines, for the page drawn on its card —
 * `docs/specs/docs.md`, "A pinned document is a page". Headings and
 * paragraphs as plain text, at most six lines and 600 characters in all,
 * and the first picture's file id: bounded, so a pinned five-megabyte
 * document costs the list a few hundred bytes.
 */
export function previewOf(blocks: unknown): { lines: { h: number; t: string }[]; picture: string | null } {
  const lines: { h: number; t: string }[] = []
  let picture: string | null = null
  let room = 600
  const textOf = (n: unknown): string => {
    const node = n as { text?: unknown; content?: unknown } | null
    if (typeof node?.text === 'string') return node.text
    return Array.isArray(node?.content) ? node.content.map(textOf).join(' ') : ''
  }
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const node = b as { type?: string; attrs?: Record<string, unknown> } | null
    if (node?.type === 'attachment') {
      const id = node.attrs?.fileId
      if (!picture && node.attrs?.kind === 'image' && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) picture = id
      continue
    }
    if (lines.length >= 6 || room <= 0) continue
    const t = textOf(b).replace(/\s+/g, ' ').trim().slice(0, Math.min(room, 160))
    if (!t) continue
    room -= t.length
    const level = node?.type === 'heading' ? Number(node.attrs?.level ?? 1) || 1 : 0
    lines.push({ h: Math.min(3, Math.max(0, level)), t })
  }
  return { lines, picture }
}

const Body = z.object({
  name: z.string().min(1).max(300),
  is_folder: z.boolean().optional(),
  body: RichBody.nullish(),
  // http(s) only. A file: or javascript: link is a link somebody else in the
  // project clicks, and the rule belongs where the value is accepted.
  url: z
    .url()
    .refine((u) => /^https?:/i.test(u), 'Only http and https')
    .nullish(),
  folder_id: z.uuid().nullish(),
})

/*
 * The list's cursor: the last row's pin (or `-`), its last change to the
 * microsecond, and its id — opaque to a client. A place in the order, not a
 * row, so a row restored, deleted or changed between pages does not end the
 * list.
 */
const STAMP = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z`
const listCursor = (pinned: string | null, updated: string, id: string) =>
  Buffer.from(`${pinned ?? '-'}|${updated}|${id}`).toString('base64url')
function readListCursor(raw: string): { pinned: string | null; updated: string; id: string } | null {
  const m = new RegExp(`^(-|${STAMP})\\|(${STAMP})\\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`, 'i').exec(
    Buffer.from(raw, 'base64url').toString(),
  )
  if (!m || !isMoment(m[2]!) || (m[1] !== '-' && !isMoment(m[1]!))) return null
  return { pinned: m[1] === '-' ? null : m[1]!, updated: m[2]!, id: m[3]! }
}

/* The four kinds the screen's tabs are — `docs/specs/docs.md`, "Four kinds
   and whose". Written with what the read policy lets go first (a null
   test, `^@`, `=`), so each narrows the rows before the policy is asked
   about them. A folder left from before is in none. */
const LIST_KINDS = ['docs', 'images', 'uploads', 'links'] as const
type ListKind = (typeof LIST_KINDS)[number]
const kindIs = (tx: Tx, kind: ListKind) =>
  kind === 'docs'
    ? tx`f.url is null and f.storage_key is null and f.body is not null`
    : kind === 'images'
      ? tx`f.url is null and f.storage_key is not null and f.content_type ^@ 'image/'`
      : kind === 'uploads'
        ? tx`f.url is null and f.storage_key is not null and (f.content_type is null or not f.content_type ^@ 'image/')`
        : tx`f.url is not null`

/*
 * A project's Files. Asked with `limit` or
 * `cursor`, a page, pinned first and then the latest change; asked with
 * neither, every row in the order it always had, for the apps installed
 * before pages. `kind`, `whose` and `q` narrow both.
 */
files.get('/projects/:projectId/files', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  if (!isId(projectId)) return c.json(missing, 404)
  const rawCursor = c.req.query('cursor')
  const cursor = rawCursor === undefined ? null : readListCursor(rawCursor)
  if (rawCursor !== undefined && !cursor) return c.json({ error: { code: 'invalid' } }, 400)
  const paged = rawCursor !== undefined || c.req.query('limit') !== undefined
  const limit = paged ? pageSize(c.req.query('limit'), 100, 500) : null
  const rawKind = c.req.query('kind')
  const kind = rawKind === undefined ? null : (LIST_KINDS as readonly string[]).includes(rawKind) ? (rawKind as ListKind) : undefined
  const rawWhose = c.req.query('whose')
  const whose = rawWhose === undefined ? null : rawWhose === 'mine' || rawWhose === 'others' ? rawWhose : undefined
  const words = (c.req.query('q') ?? '').trim().slice(0, 200)
  if (kind === undefined || whose === undefined) return c.json({ error: { code: 'invalid' } }, 400)
  const like = `%${words.replace(/[\\%_]/g, (x) => `\\${x}`)}%`

  const { rows, kinds, pictures } = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    /* The rows this page is, in the list's order and nothing joined but
       what narrows them: read from the head of `file_listed` and stopped
       once there is a page. Where each was first put is joined below, for
       the page alone. */
    const narrowed = tx`
      f.project_id = ${projectId} and f.deleted_at is null
      ${kind ? tx`and ${kindIs(tx, kind)}` : tx``}
      ${whose === 'mine' ? tx`and f.author_id = ${ctx.actorId}` : whose === 'others' ? tx`and f.author_id <> ${ctx.actorId}` : tx``}
      ${
        words
          ? tx`and (f.name ilike ${like} or f.url ilike ${like}
              or exists (select 1 from actor fa where fa.id = f.author_id and fa.name ilike ${like})
              or (f.origin_type = 'message' and exists (
                select 1 from message wm join conversation wc on wc.id = wm.conversation_id
                left join project wp on wp.id = wc.project_id
                where wm.id = f.origin_id
                  and (wc.name ilike ${like}
                       or ('#' || coalesce(wp.slug || '-', '') || regexp_replace(lower(wc.name), '[[:space:]]+', '-', 'g')) ilike ${like}
                       or (wc.channel = false and exists (
                         select 1 from conversation_member wcm join actor wpa on wpa.id = wcm.actor_id
                         where wcm.conversation_id = wc.id and wcm.deleted_at is null
                           and wcm.actor_id <> ${ctx.actorId} and wpa.name ilike ${like})))))
              or (f.origin_type = 'task' and exists (
                select 1 from task wt join project wtp on wtp.id = wt.project_id
                where wt.id = f.origin_id and wt.deleted_at is null
                  and (wt.title ilike ${like} or (coalesce(wtp.key, '') || '-' || wt.number) ilike ${like})))
              or (f.origin_type = 'post' and exists (
                select 1 from post wpo where wpo.id = f.origin_id and wpo.deleted_at is null and wpo.title ilike ${like})))`
          : tx``
      }`
    /* `::text` first: a parameter the driver knows is a timestamp goes
       through a JavaScript Date, which keeps milliseconds — and rows of one
       moment past the first page were skipped. */
    const after = !cursor
      ? tx``
      : cursor.pinned
        ? tx`and (f.pinned_at is null
                  or (f.pinned_at, f.updated_at, f.id) < (${cursor.pinned}::text::timestamptz, ${cursor.updated}::text::timestamptz, ${cursor.id}::uuid))`
        : tx`and f.pinned_at is null and (f.updated_at, f.id) < (${cursor.updated}::text::timestamptz, ${cursor.id}::uuid)`
    const rows = await tx<Record<string, unknown>[]>`
      select f.id, f.number, f.name, f.folder_id, f.content_type, f.size_bytes, f.version,
             f.author_id, a.name as author_name, f.updated_at,
             f.url, f.has_body as is_document,
             /* Shared to the web. */
             f.is_public,
             /* Saved as a template. */
             f.template_at,
             /* Who it is for: author, chosen or project. */
             f.audience,
             /* The project's instructions for agents. */
             f.for_agents,
             /* What it wears -- docs/specs/docs.md, "A document's mark". */
             f.mark_icon, f.mark_tint,
             f.head_blocks,
             f.storage_key, f.display_key, f.pinned_at, f.created_at,
             f.pinned_key, f.updated_key,
             f.origin_type,
             /* Never the id of a document the reader cannot open. */
             case when f.origin_type = 'file' and not exists (select 1 from file od where od.id = f.origin_id)
                  then null
                  /* Nor of an announcement still somebody's draft. */
                  when f.origin_type = 'post' and not exists (select 1 from post opx where opx.id = f.origin_id)
                  then null else f.origin_id end as origin_id,
             /* Where it was first put, named and addressable: the room a
                message was in, the task or the announcement it was on.
                docs/specs/docs.md. No backticks in here. */
             om.conversation_id as origin_room,
             coalesce(oc.name, oc_people.names) as origin_room_name, oc.channel as origin_room_channel,
             op.slug as origin_room_project_slug,
             ot.number as origin_task_number, ot.title as origin_task_title, otp.key as origin_task_key,
             opo.title as origin_post_title,
             f.kind
      from (
        select f.id, f.number, f.name, f.folder_id, f.content_type, f.size_bytes, f.version,
               f.author_id, f.updated_at, f.url, f.body is not null as has_body,
               (f.public_token is not null) as is_public, f.template_at, f.audience, f.for_agents,
               f.mark_icon, f.mark_tint,
               /* The head of a pinned document, for its card's page: the
                  first eight blocks, cut short below. docs/specs/docs.md,
                  "A pinned document is a page". */
               case when f.pinned_at is not null and f.body is not null and f.url is null
                    then jsonb_path_query_array(f.body, '$.content[0 to 7]') end as head_blocks,
               f.storage_key, f.display_key, f.pinned_at, f.created_at, f.origin_type, f.origin_id,
               to_char(f.pinned_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as pinned_key,
               to_char(f.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_key,
               case when f.url is not null then 'link'
                    when f.storage_key is not null then 'upload'
                    when f.body is null then 'folder'
                    else 'document' end as kind
        from file f
        where ${narrowed} ${after}
        ${
          limit === null
            ? /* Pinned first, the latest pin at the top; then the newest
                 first -- the order the installed apps were given. */
              tx`order by f.pinned_at desc nulls last, f.created_at desc`
            : /* The screen's order, which is the index's -- and the id, so
                 rows written in one moment keep one order across pages. */
              tx`order by f.pinned_at desc nulls last, f.updated_at desc, f.id desc limit ${limit + 1}`
        }
      ) f
      join actor a on a.id = f.author_id
      left join message om on f.origin_type = 'message' and om.id = f.origin_id
      left join conversation oc on oc.id = om.conversation_id
      left join project op on op.id = oc.project_id
      left join lateral (
        select string_agg(pa.name, ', ' order by pa.name) as names
        from conversation_member cm join actor pa on pa.id = cm.actor_id
        where cm.conversation_id = oc.id and cm.deleted_at is null and cm.actor_id <> ${ctx.actorId}
          and oc.channel = false
      ) oc_people on true
      left join task ot on f.origin_type = 'task' and ot.id = f.origin_id and ot.deleted_at is null
      left join project otp on otp.id = ot.project_id
      left join post opo on f.origin_type = 'post' and opo.id = f.origin_id and opo.deleted_at is null
      ${
        limit === null
          ? tx`order by f.pinned_at desc nulls last, f.created_at desc`
          : tx`order by f.pinned_at desc nulls last, f.updated_at desc, f.id desc`
      }`
    /* Which kinds hold anything this reader may see, whoever's — on the
       first page, for the screen to tell an empty project from an empty
       kind from an empty choice of whose. One row each, stopped at the
       first. */
    const kinds =
      paged && !cursor
        ? await tx<Record<ListKind, boolean>[]>`
            select exists (select 1 from file f where f.project_id = ${projectId} and f.deleted_at is null and ${kindIs(tx, 'docs')}) as docs,
                   exists (select 1 from file f where f.project_id = ${projectId} and f.deleted_at is null and ${kindIs(tx, 'images')}) as images,
                   exists (select 1 from file f where f.project_id = ${projectId} and f.deleted_at is null and ${kindIs(tx, 'uploads')}) as uploads,
                   exists (select 1 from file f where f.project_id = ${projectId} and f.deleted_at is null and ${kindIs(tx, 'links')}) as links`.then(
            ([r]) => LIST_KINDS.filter((k) => r?.[k]),
          )
        : null
    /* The first picture of each pinned document on the page, for its card —
       read under the file's own policy, so a picture the reader may not
       open has no link. It was found among the list's other rows, which a
       page of Docs does not hold. */
    const wanted = [
      ...new Set(
        rows.slice(0, limit ?? rows.length).flatMap((r) => {
          const p = r.head_blocks ? previewOf(r.head_blocks).picture : null
          return p ? [p] : []
        }),
      ),
    ]
    const pictures = wanted.length
      ? await tx<
          { id: string; storage_key: string | null; display_key: string | null; content_type: string | null; size_bytes: string | null }[]
        >`
          select id, storage_key, display_key, content_type, size_bytes from file
          where id = any(${wanted}::uuid[]) and deleted_at is null`
      : []
    return { rows, kinds, pictures }
  })

  const more = limit !== null && rows.length > limit
  const page = more ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]
  const thumbs = new Map(pictures.map((p) => [p.id, thumbFor(p, ctx.actorId)]))
  /* A picture is shown in the list, not behind a click — its copy for
     showing, signed for this reader, beside the row. The keys themselves do
     not leave. `docs/specs/docs.md`. Only the page's. */
  return c.json({
    files: page.map(({ storage_key, display_key, head_blocks, pinned_key: _p, updated_key: _u, ...r }) => {
      const preview = head_blocks ? previewOf(head_blocks) : null
      return {
        ...r,
        ...(preview ? { preview: { ...preview, picture_url: preview.picture ? (thumbs.get(preview.picture) ?? null) : null } } : {}),
        thumb_url: thumbFor({ storage_key, display_key, content_type: r.content_type, size_bytes: r.size_bytes }, ctx.actorId),
      }
    }),
    next_cursor: more && last ? listCursor((last.pinned_key as string | null) ?? null, String(last.updated_key), String(last.id)) : null,
    ...(kinds ? { kinds } : {}),
  })
})

/* The copy for showing, or the original only when it is small. A list of
   pictures uploaded with no copy — by an agent, which has no browser to
   make one — drew every original, eight megabytes and four thousand pixels
   each, as a 48-pixel tile; Safari on a phone ran out of memory on the list
   and reloaded it over and over. Past the line the row shows the picture's
   mark. */
function thumbFor(
  f: { storage_key: unknown; display_key: unknown; content_type: unknown; size_bytes: unknown },
  actorId: string,
): string | null {
  if (typeof f.content_type !== 'string' || !f.content_type.startsWith('image/') || !f.storage_key) return null
  if (f.display_key) return linkForReader(String(f.display_key), actorId)
  return Number(f.size_bytes ?? Number.POSITIVE_INFINITY) <= THUMB_ORIGINAL_BYTES ? linkForReader(String(f.storage_key), actorId) : null
}

/*
 * What a new document starts from: one of the four built in, or a document
 * saved as a template, by its id. With a
 * template the name may be left out (the template's is taken), and a body
 * sent beside it is written after the template's own.
 */
const Made = Body.extend({
  name: z.string().min(1).max(300).optional(),
  template: z.union([DocTemplate, z.uuid()]).optional(),
  /* A draft, its author's alone, or the project's. */
  audience: z.enum(['author', 'project']).optional(),
}).refine((b) => b.name !== undefined || b.template !== undefined, 'A name or a template')

type Doc = { type: string; content?: unknown[] }

files.post('/projects/:projectId/files', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  if (!allow(ctx, 'content.create', { inProject: true })) return c.json(forbidden, 403)
  const body = Made.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const template = body.data.template
  if (template && (body.data.is_folder || body.data.url)) return c.json({ error: { code: 'invalid' } }, 400)
  /* Only a written document is a draft, and only one somebody may then
     publish: a token, an agent, an import or a board asking for one is
     refused rather than handed a document nobody could ever see. */
  if (body.data.audience === 'author') {
    if (body.data.is_folder || body.data.url) return c.json({ error: { code: 'invalid' } }, 400)
    if (!allow(ctx, 'file.share', { inProject: true, isAuthor: true }) || ctx.viaImport || ctx.viaGithub) return c.json(forbidden, 403)
  }

  const id = uuidv7()
  const made = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (!(await isInProject(tx, projectId))) return 'missing' as const
    let name = body.data.name ?? ''
    let written: unknown = body.data.is_folder ? null : (body.data.body ?? {})
    if (template) {
      const [where] = await tx<{ project: string; today: string; language: string }[]>`
        select (select name from project where id = ${projectId}) as project,
               ${todayFor(tx, ctx.actorId)}::text as today, language_of(${ctx.actorId}) as language`
      const fr = where?.language === 'fr'
      /* A saved one is read as the asker, so only a template in a project
         they can read is one they can start from. */
      const from = DocTemplate.safeParse(template).success
        ? templateDoc(template as DocTemplate, fr ? 'fr' : 'en')
        : (
            await tx<{ name: string; body: Doc }[]>`
              select name, body from file
              where id = ${template} and template_at is not null and deleted_at is null
                and body is not null and storage_key is null and url is null`
          )[0]
      if (!from) return 'no_template' as const
      const date = new Date(`${where?.today ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`).toLocaleDateString(
        fr ? 'fr-FR' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
      )
      const said = { date, project: where?.project ?? '' }
      const start = fillTemplate(from.body, said)
      const after = (body.data.body as Doc | undefined)?.content ?? []
      const content = [...(start.content ?? []), ...after]
      written = { ...start, type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
      name = (body.data.name ?? fillTemplate(from.name, said)).slice(0, 300)
    }
    /*
     * A written document a person makes in the product starts as theirs
     * alone, a draft until they publish it.
     * The client that draws Publish asks for it (`audience: "author"`): a
     * phone on a build from before has no way to publish, and a draft made
     * there would be stranded. One made through a token, by an agent, an
     * import, GitHub, a board or a feedback page is the project's, and
     * asking otherwise is refused above: none of them can press Publish
     * (`file.share`), and what an agent writes in Docs is written for the
     * project to read. An upload, a link and a folder are the project's
     * whoever puts them there.
     */
    const draft = body.data.audience === 'author'
    await tx`
      insert into file (id, workspace_id, project_id, author_id, name, body, url, folder_id, audience)
      values (${id}, ${ctx.workspaceId}, ${projectId}, ${ctx.actorId}, ${name},
              ${written === null ? null : tx.json(written as never)},
              ${body.data.url ?? null},
              ${body.data.folder_id ?? null},
              ${draft ? 'author' : 'project'})`
    await subscribe(tx, ctx, 'file', id)
    await record(tx, ctx, 'file.create', { projectId, objectType: 'file', objectId: id })
    return 'made' as const
  })
  if (made === 'missing') return c.json(missing, 404)
  if (made === 'no_template') return c.json({ error: { code: 'not_found', message: 'No such template.' } }, 404)
  return c.json({ id }, 201)
})

/**
 * The documents saved as templates that the asker can read, across the
 * workspace, newest first. The file's own
 * policy says which: a template in a project somebody is not on is not
 * theirs to see.
 */
files.get('/doc-templates', async (c) => {
  const ctx = c.get('ctx')
  const templates = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      tx`select f.id, f.name, f.project_id, p.name as project_name, f.template_at
         from file f join project p on p.id = f.project_id and p.deleted_at is null
         where f.workspace_id = ${ctx.workspaceId} and f.template_at is not null and f.deleted_at is null
           and f.body is not null and f.storage_key is null and f.url is null
         order by f.template_at desc
         limit 100`,
  )
  return c.json({ templates })
})

/*
 * A written document saved as a template, or taken back — whoever may edit
 * it decides, as editing and sharing to the web do. Only a written
 * document: an upload or a link has no words to start from.
 */
files.put('/files/:id/template', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z.object({ template: z.boolean() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ author_id: string; project_id: string; written: boolean; template_at: string | null }[]>`
      select author_id, project_id, template_at,
             (body is not null and storage_key is null and url is null) as written
      from file where id = ${id} and deleted_at is null`
    if (!row) return 'missing' as const
    if (!mayEdit(ctx, row.author_id, row.project_id)) return 'forbidden' as const
    if (!row.written) return 'not_document' as const
    if (body.data.template === (row.template_at !== null)) return { template_at: row.template_at }
    const [saved] = await tx<{ template_at: string | null }[]>`
      update file set template_at = ${body.data.template ? tx`now()` : null}
      where id = ${id}
      returning template_at`
    await record(tx, ctx, body.data.template ? 'file.template' : 'file.untemplate', {
      projectId: row.project_id,
      objectType: 'file',
      objectId: id,
    })
    return { template_at: saved?.template_at ?? null }
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'not_document')
    return c.json({ error: { code: 'not_document', message: 'Only a written document can be a template.' } }, 409)
  return c.json({ ok: true, ...result })
})

/*
 * The project's instructions for agents: one written document marked so, or
 * the mark taken off. Whoever may change the
 * document and run the project, in person (`file.for_agents`); only a
 * document the whole project reads, since every agent on it must be able
 * to. Marking a second takes the mark off the first in the same write.
 */
files.put('/files/:id/for-agents', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z
    .object({ for_agents: z.boolean() })
    .strict()
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const on = body.data.for_agents
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<
      { author_id: string; project_id: string | null; audience: string; written: boolean; for_agents: boolean; room: boolean }[]
    >`
      select author_id, project_id, audience, for_agents, conversation_id is not null as room,
             (body is not null and storage_key is null and url is null) as written
      from file where id = ${id} and workspace_id = ${ctx.workspaceId} and deleted_at is null
      for update`
    if (!row?.project_id || row.room) return 'missing' as const
    if (!allowIn(ctx, 'file.for_agents', row.project_id, { isAuthor: row.author_id === ctx.actorId })) return 'forbidden' as const
    if (!row.written) return 'not_document' as const
    if (on && row.audience !== 'project') return 'not_published' as const
    if (on === row.for_agents) return { for_agents: on, replaced: null }
    /* Where it stands in Docs is not a change to its words: the clock stays. */
    await tx`select set_config('tracker.keep_clock', 'on', true)`
    let replaced: string | null = null
    if (on) {
      const [was] = await tx<{ id: string }[]>`
        update file set for_agents = false
        where workspace_id = ${ctx.workspaceId} and project_id = ${row.project_id} and for_agents and id <> ${id}
        returning id`
      replaced = was?.id ?? null
      if (replaced)
        await record(tx, ctx, 'file.not_for_agents', {
          projectId: row.project_id,
          objectType: 'file',
          objectId: replaced,
          meta: { replaced_by: id },
        })
    }
    await tx`update file set for_agents = ${on} where id = ${id}`
    await record(tx, ctx, on ? 'file.for_agents' : 'file.not_for_agents', {
      projectId: row.project_id,
      objectType: 'file',
      objectId: id,
      ...(replaced ? { meta: { replaced } } : {}),
    })
    return { for_agents: on, replaced }
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'not_document')
    return c.json({ error: { code: 'not_document', message: 'Only a written document can be the instructions for agents.' } }, 409)
  if (result === 'not_published')
    return c.json(
      {
        error: {
          code: 'not_published',
          message: 'Publish this document to everyone on the project first. Agents read only what the whole project can.',
        },
      },
      409,
    )
  return c.json({ ok: true, ...result })
})

/**
 * Kept at the head of the project's Docs, or let go — `docs/specs/docs.md`.
 * Anybody who may add to the project may pin: it is about the list everyone
 * reads, not about the file's words.
 */
files.put('/files/:id/pin', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z.object({ pinned: z.boolean() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ project_id: string | null }[]>`
      select project_id from file where id = ${id} and deleted_at is null`
    if (!row?.project_id) return 'missing' as const
    if (!allowIn(ctx, 'content.create', row.project_id)) return 'forbidden' as const
    /* A pin is where it stands, not a change to it: the clock stays, or a
       picture pinned and let go came back as the newest in Recent. */
    await tx`select set_config('tracker.keep_clock', 'on', true)`
    await tx`
      update file set
        pinned_at = ${body.data.pinned ? tx`now()` : null},
        pinned_by = ${body.data.pinned ? ctx.actorId : null}
      where id = ${id}`
    return 'ok' as const
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true })
})

files.get('/files/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const row = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [f] = await tx`
      select f.*, a.name as author_name,
             /* Whether the reader follows it. */
             exists (select 1 from subscription s
                     where s.object_type = 'file' and s.object_id = f.id
                       and s.actor_id = current_actor() and s.deleted_at is null) as subscribed,
             /* Its chosen people, to whoever may read it.
                Empty unless chosen. */
             coalesce((select array_agg(r.actor_id order by r.created_at) from file_reader r
                       where r.workspace_id = f.workspace_id and r.file_id = f.id and f.audience = 'chosen'),
                      '{}') as reader_ids,
             /* Whether the document it was put into is the reader's to
                know of: its id is not, otherwise. */
             ((f.origin_type is distinct from 'file' and f.origin_type is distinct from 'post')
              or (f.origin_type = 'file' and exists (select 1 from file od where od.id = f.origin_id))
              /* Or the announcement, a draft being its author's alone. */
              or (f.origin_type = 'post' and exists (select 1 from post op where op.id = f.origin_id))) as origin_seen,
             /* The pictures and files its body shows that it does not hold —
                put in before it was private, they stay the project's.
                Only for a written document. */
             case when f.body is not null and f.storage_key is null and f.url is null then (
               select count(*)::int from file x
               where x.workspace_id = f.workspace_id and x.deleted_at is null
                 and x.held_by is null
                 and x.id::text in (select jsonb_path_query(f.body, 'strict $.**.fileId') #>> '{}')
             ) end as loose_files
      from file f join actor a on a.id = f.author_id
      where f.id = ${id} and f.deleted_at is null`
    return f
  })
  if (!row) return c.json(missing, 404)
  /* `said` is the search index's, not the contract's — the body is here.
     And not where the bytes are kept: a key opens nothing without a
     signature, but it is no business of a reader's, and an agent reading
     a document was handed it too. `upload` says whether there are bytes;
     `GET /api/files/:id/url` is the way to them. */
  const { said: _said, storage_key, display_key: _display, origin_seen, held_by: _held, ...file } = row as Record<string, unknown>
  if (!origin_seen) file.origin_id = null
  /* A thread whose words are in no mark of the body any more is on
     deleted text. */
  const on = threadsIn(file.body)
  const said = await listComments(ctx, 'file', id)
  const comments = onText(said.comments, on)
  /* Whether this reader may change it — what a client asks before it
     does something that ends in a change, so nothing is half done:
     `tasks_from_doc` makes no task it could not put in the document. */
  const may_edit = mayEdit(ctx, String(file.author_id), String(file.project_id ?? '') || undefined)
  /* And whether they may say who it is for.
     Only a written document is ever anybody's but the project's. */
  const may_share = file.body != null && !storage_key && !file.url && mayShare(ctx, String(file.author_id), String(file.project_id ?? ''))
  /* And whether they may make it the project's instructions for agents.
     A written document of a project only. */
  const may_for_agents =
    file.body != null &&
    !storage_key &&
    !file.url &&
    !file.conversation_id &&
    Boolean(file.project_id) &&
    allowIn(ctx, 'file.for_agents', String(file.project_id), { isAuthor: file.author_id === ctx.actorId })
  return c.json({
    file: { ...file, upload: Boolean(storage_key), may_edit, may_share, may_for_agents },
    comments,
    /* Where the comments not carried here start. */
    comments_earlier: said.earlier,
  })
})

/* Whether each thread's words are still in the body. */
const onText = (comments: readonly unknown[], on: Set<string>) =>
  comments.map((m) => {
    const r = m as { id: string; quote?: string | null }
    return r.quote ? { ...r, on_deleted_text: !on.has(r.id) } : r
  })

/* Following it, and stopping. */
files.post('/files/:id/subscription', async (c) =>
  (await follow(c.get('ctx'), 'file', c.req.param('id'), true)) ? c.json({ ok: true }) : c.json(missing, 404),
)
files.delete('/files/:id/subscription', async (c) => {
  await follow(c.get('ctx'), 'file', c.req.param('id'), false)
  return c.json({ ok: true })
})

/* The comments before the ones the read carried — `comments_earlier`. */
files.get('/files/:id/comments', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const before = c.req.query('before') ?? null
  if (before !== null && !commentCursor(before)) return c.json({ error: { code: 'invalid' } }, 400)
  const found = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [f] = await tx`select 1 from file where id = ${id} and deleted_at is null`
    if (!f) return null
    const page = await commentsIn(tx, 'file', id, before)
    /* Whether each thread's words are still there, asked of the database
       for this page's threads alone: the whole body was read here and
       walked for every page — up to 5 MB each time. A thread's id is in
       the body only where a mark, or a task made of its line, keeps it. */
    const threads = page.comments.filter((m) => (m as { quote?: string | null }).quote).map((m) => (m as { id: string }).id)
    const on = threads.length
      ? await tx<{ id: string }[]>`
          with b as materialized (select body::text as t from file where id = ${id})
          select x.id::text as id from unnest(${threads}::uuid[]) x(id), b where strpos(b.t, x.id::text) > 0`
      : []
    return { page, on: new Set(on.map((r) => r.id)) }
  })
  if (!found) return c.json(missing, 404)
  return c.json({ comments: onText(found.page.comments, found.on), next_cursor: found.page.earlier })
})

files.patch('/files/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  /* `base_rev`: the revision of the body the caller read (`rev` on the
     file), so its edit is merged against what it saw; `from: 'markdown'`
     when the body was written from Markdown, which cannot say everything
     a body holds. */
  const sent: unknown = await c.req.json().catch(() => ({}))
  const body = Body.partial()
    .extend({
      base_rev: z.int().nonnegative().optional(),
      from: z.enum(['markdown']).optional(),
      /* What a document wears — `docs/specs/docs.md`, "A document's mark".
         Null puts it back to a document's own look. */
      mark_icon: MarkIcon.nullish(),
      mark_tint: MarkTint.nullish(),
    })
    .safeParse(sent)
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  /* Sent as null is a change; not sent is none — the two are told apart. */
  const setsIcon = typeof sent === 'object' && sent !== null && 'mark_icon' in sent
  const setsTint = typeof sent === 'object' && sent !== null && 'mark_tint' in sent
  const onlyMark =
    (setsIcon || setsTint) &&
    body.data.name === undefined &&
    body.data.body === undefined &&
    body.data.url === undefined &&
    body.data.folder_id === undefined

  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<
      {
        author_id: string
        project_id: string
        body: unknown
        url: string | null
        mark_icon: string | null
        mark_tint: number | null
        version: number
        upload: boolean
      }[]
    >`
      select author_id, project_id, body, url, mark_icon, mark_tint, version, storage_key is not null as upload
        from file where id = ${id} and deleted_at is null`
    if (!row) return 'missing' as const
    if (!mayEdit(ctx, row.author_id, row.project_id)) return 'forbidden' as const
    /* Only a written document wears a mark: an upload has its picture or
       its type, a link its place's own icon. */
    if ((setsIcon || setsTint) && (row.body === null || row.url !== null)) return 'not_document' as const
    /* A link's address is changed, and only a link's: an address given to
       a document or an upload would make it a link — `docs/specs/docs.md`,
       "A link's address". */
    const url = body.data.url ?? null
    if (url !== null && row.url === null) return 'not_link' as const
    if (body.data.url === null) return 'not_link' as const

    /*
     * Through the document's Yjs state when it has one, so people writing
     * in it now are merged with rather than overwritten, and a session
     * opened later does not open on words this replaced.
     * With no state yet, written as it was.
     */
    const merged = body.data.body
      ? await mergeBody(tx, ctx, id, body.data.body, { baseRev: body.data.base_rev, markdown: body.data.from === 'markdown' })
      : null
    /* With no state, what Markdown cannot say — a thread's mark, a task
       named in a line — is carried onto the caller's blocks from the body
       it replaces, where their words still hold it (`carryRich`). */
    const written = body.data.body ? (merged?.body ?? carryRich(row.body, body.data.body)) : null
    /* Stored as an API write: its revision moves, and the body is kept under it. */
    const rev = written ? await storePatched(tx, id, written) : null

    // Editing a document bumps the version. Versions are how "who changed my
    // document" has an answer rather than an argument.
    const [saved] = await tx<{ version: number }[]>`
      update file set
        name = coalesce(${body.data.name ?? null}, name),
        url = coalesce(${url}, url),
        -- A null folder means the top level, so this one has to tell "not
        -- sent" from "sent as nothing" instead of coalescing them together.
        folder_id = ${body.data.folder_id === undefined ? tx`folder_id` : (body.data.folder_id ?? null)},
        mark_icon = ${setsIcon ? (body.data.mark_icon ?? null) : tx`mark_icon`},
        mark_tint = ${setsTint ? (body.data.mark_tint ?? null) : tx`mark_tint`},
        version = version + case when ${body.data.body ? 1 : 0} = 1 then 1 else 0 end
      where id = ${id}
      returning version`
    /* The pages in the document show the version it moved to. */
    if (written && saved) await publish(topicOf(id), 'saved', { version: saved.version }, tx)
    /* And the version is kept, the caller named in it. */
    if (written && saved && row.url === null && !row.upload)
      await keepVersion(tx, {
        fileId: id,
        workspaceId: ctx.workspaceId,
        version: saved.version,
        body: written,
        contributors: [ctx.actorId],
        before: { version: row.version, body: row.body },
      })
    /* A mark put back to what it already was is no change and writes no
       line, as a project's. */
    const remarked =
      (setsIcon && (body.data.mark_icon ?? null) !== row.mark_icon) || (setsTint && (body.data.mark_tint ?? null) !== row.mark_tint)
    if (!onlyMark || remarked)
      await record(tx, ctx, 'file.update', {
        projectId: row.project_id,
        objectType: 'file',
        objectId: id,
        ...(url !== null && url !== row.url ? { meta: { relinked: true } } : remarked ? { meta: { remarked: true } } : {}),
      })
    // The new version is returned, not just an acknowledgement: it is the
    // receipt the editor shows, and without it "saved" is a word the
    // interface says to itself.
    /* And the revision to say it read next time, and how many stretches
       were left as the people had them. */
    return {
      version: saved?.version ?? null,
      ...(rev !== null ? { rev } : {}),
      ...(merged ? { conflicts: merged.conflicts } : {}),
    } as const
  }).catch((e: unknown) => {
    if (e instanceof Refused) return e
    throw e
  })
  if (result instanceof Refused && result.code === 'stale')
    return c.json(
      {
        error: { code: 'stale', message: 'This document changed since it was read. Read it again, then make the change.' },
        /* What is there now, so the caller need not ask again to read it. */
        ...(result.now ? { rev: result.now.rev, body: result.now.body } : {}),
      },
      409,
    )
  if (result instanceof Refused)
    return c.json({ error: { code: 'too_large', message: 'This document is too large to add more. Remove something first.' } }, 413)
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'not_link') return c.json({ error: { code: 'invalid', message: 'Only a link has an address to change.' } }, 400)
  if (result === 'not_document')
    return c.json({ error: { code: 'not_document', message: 'Only a written document has a colour and an icon.' } }, 409)
  return c.json({ ok: true, ...result })
})

/*
 * Whether this actor may delete a row in Docs, and so put it back.
 * Your own, as being on the project lets you
 * write it; somebody else's, `file.delete`, which the right that deletes
 * others' tasks grants. Never through a token, your own included: deleting
 * is one of the things a tool acting for somebody does not do.
 */
/* Whether the file was sent in a room with chosen people — or a room of no
   project — whose files the project's feed never names. Read as a column
   of `file f`. */

/*
 * Whether this actor may say who a written document is for — publish a
 * draft, choose its people, change them: `file.share` in `can()`, asked as
 * its author or as somebody editing somebody else's.
 */
function mayShare(ctx: AuthContext, authorId: string, projectId: string): boolean {
  return allowIn(ctx, 'file.share', projectId, { isAuthor: authorId === ctx.actorId })
}

function mayDelete(ctx: AuthContext, authorId: string, projectId: string): boolean {
  if (ctx.viaMcp) return false
  if (authorId === ctx.actorId) return allowIn(ctx, 'content.edit.own', projectId, { isAuthor: true })
  return allowIn(ctx, 'file.delete', projectId)
}

/*
 * A document, an upload or a link deleted — soft, as a task is: `deleted_at`
 * is set, every read already asks for it to be empty, and the clear-out
 * takes the row and its bytes later. Its public link stops with it.
 * Only a project's: a room's own file is a message's attachment.
 */
files.delete('/files/:id', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ author_id: string; project_id: string | null; name: string; chosen: boolean }[]>`
      select f.author_id, f.project_id, f.name, ${apart(tx)} as chosen from file f
      where f.id = ${id} and f.workspace_id = ${ctx.workspaceId} and f.deleted_at is null
      for update of f`
    if (!row?.project_id) return 'missing' as const
    if (!mayDelete(ctx, row.author_id, row.project_id)) return 'forbidden' as const
    /* Who did it, so only they — or whoever may delete anybody's — take it
       back: an author undoing a manager's delete a week later would bring
       back a link the manager took down. */
    await tx`update file set deleted_at = now(), deleted_by = ${ctx.actorId} where id = ${id}`
    /* Named as it was: once it is gone the feed has nothing else to read
       its name from. Not for a file sent in a room with chosen people,
       which the project's feed and webhooks never named — as its upload
       was not told (`takeUpload`). */
    if (!row.chosen)
      await record(tx, ctx, 'file.delete', {
        projectId: row.project_id,
        objectType: 'file',
        objectId: id,
        meta: { title: row.name },
      })
    return 'ok' as const
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true })
})

/*
 * Whether this actor may put a deleted row back, or take it out for good.
 * Whoever deleted it, or whoever may delete
 * anybody's — not its author as such: the delete may have been somebody
 * else's decision. Never through a token, and never an agent's (`can()`
 * refuses `file.delete` to one; its own delete was never possible).
 */
function mayRestore(ctx: AuthContext, deletedBy: string | null, projectId: string): boolean {
  if (ctx.viaMcp || ctx.agent) return false
  return deletedBy === ctx.actorId
    ? allowIn(ctx, 'content.edit.own', projectId, { isAuthor: true })
    : allowIn(ctx, 'file.delete', projectId)
}

/*
 * Putting one back, which is what the toast's Undo presses — the same
 * question deleting asked, and only while the row is still there.
 * Restored, it is as it was: its pin, its link on the web, its comments.
 */
files.post('/files/:id/restore', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ deleted_by: string | null; project_id: string | null; name: string; chosen: boolean }[]>`
      select f.deleted_by, f.project_id, f.name, ${apart(tx)} as chosen from file f
      join project p on p.id = f.project_id and p.deleted_at is null
      where f.id = ${id} and f.workspace_id = ${ctx.workspaceId} and f.deleted_at is not null
      for update of f`
    if (!row?.project_id) return 'missing' as const
    if (!mayRestore(ctx, row.deleted_by, row.project_id)) return 'forbidden' as const
    await tx`update file set deleted_at = null, deleted_by = null where id = ${id}`
    if (!row.chosen)
      await record(tx, ctx, 'file.restore', {
        projectId: row.project_id,
        objectType: 'file',
        objectId: id,
        meta: { title: row.name },
      })
    return 'ok' as const
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true })
})

const isId = (s: string | undefined): s is string => !!s && /^[0-9a-f-]{36}$/i.test(s)

/*
 * Recently Deleted's cursor: the last row's deletion time, to the
 * microsecond, and its id — opaque to a client, and still a place in the
 * list when that row was restored or purged between pages, which a cursor
 * of the id alone was not (the next page read as the end).
 */
const binCursor = (at: string, id: string) => Buffer.from(`${at}|${id}`).toString('base64url')
function readBinCursor(raw: string): { at: string; id: string } | null {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    Buffer.from(raw, 'base64url').toString(),
  )
  return m && isMoment(m[1]!) ? { at: m[1]!, id: m[2]! } : null
}

/*
 * A project's Recently Deleted. What was
 * deleted here in the last thirty days (`PURGE_AFTER_DAYS`, the setting the
 * worker's clear-out reads), newest deleted first, and only what
 * this asker could put back: what they deleted, or anything when they hold
 * `file.delete`. Read through the file's own read policy, which does not
 * ask about `deleted_at`: a deleted row is seen by whoever could see it
 * standing — a file sent in a room of chosen people by that room alone —
 * and by nobody else. Never through a token, which can restore nothing.
 * The next page is what was deleted before the cursor's row.
 */
files.get('/projects/:projectId/files/deleted', async (c) => {
  const ctx = c.get('ctx')
  const projectId = c.req.param('projectId')
  if (ctx.viaMcp || ctx.agent) return c.json(forbidden, 403)
  if (!isId(projectId)) return c.json(missing, 404)
  const raw = c.req.query('cursor')
  const cursor = raw === undefined ? null : readBinCursor(raw)
  if (raw !== undefined && !cursor) return c.json({ error: { code: 'invalid' } }, 400)
  const days = purgeAfterDays()
  const limit = pageSize(c.req.query('limit'), 50, 100)
  const anybodys = allowIn(ctx, 'file.delete', projectId)
  const rows = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (!(await isInProject(tx, projectId))) return null
    return tx<Record<string, unknown>[]>`
      select f.id, f.number, f.name, f.url, f.content_type, f.size_bytes, f.mark_icon, f.mark_tint,
             f.storage_key, f.display_key,
             f.author_id, a.name as author_name,
             f.deleted_at, f.deleted_by, d.name as deleted_by_name,
             f.deleted_at + make_interval(days => ${days}) as purge_at,
             /* What goes with it for good: the files a document kept from
                the project holds. */
             case when f.audience <> 'project'
                  then (select count(*)::int from file h where h.held_by = f.id and h.workspace_id = f.workspace_id)
                  else 0 end as held_files,
             to_char(f.deleted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as deleted_key,
             case when f.url is not null then 'link'
                  when f.storage_key is not null then 'upload'
                  when f.body is null then 'folder'
                  else 'document' end as kind
      from file f
      join project p on p.id = f.project_id and p.deleted_at is null
      join actor a on a.id = f.author_id
      left join actor d on d.id = f.deleted_by
      where f.project_id = ${projectId}
        and f.workspace_id = ${ctx.workspaceId}
        and f.deleted_at is not null
        and f.deleted_at > now() - make_interval(days => ${days})
        ${anybodys ? tx`` : tx`and f.deleted_by = ${ctx.actorId}`}
        /* As text first: as a timestamp the driver sent it through a Date,
           to the millisecond, and the rows of one delete past the page's end
           were skipped. */
        ${cursor ? tx`and (f.deleted_at, f.id) < (${cursor.at}::text::timestamptz, ${cursor.id}::uuid)` : tx``}
      order by f.deleted_at desc, f.id desc
      limit ${limit}`
  })
  if (!rows) return c.json(missing, 404)
  /* Your own deletes are yours to put back only while you may still write
     here: the same question restoring asks. */
  const mine = mayRestore(ctx, ctx.actorId, projectId)
  const kept = rows.filter((r) => (r.deleted_by === ctx.actorId ? mine : anybodys))
  return c.json({
    files: kept.map(({ storage_key, display_key, deleted_key: _, ...r }) => ({
      ...r,
      thumb_url:
        typeof r.content_type === 'string' && r.content_type.startsWith('image/') && storage_key
          ? display_key
            ? linkForReader(String(display_key), ctx.actorId)
            : Number(r.size_bytes ?? Infinity) <= THUMB_ORIGINAL_BYTES
              ? linkForReader(String(storage_key), ctx.actorId)
              : null
          : null,
    })),
    next_cursor: rows.length === limit ? binCursor(String(rows[rows.length - 1]!.deleted_key), String(rows[rows.length - 1]!.id)) : null,
    kept_days: days,
  })
})

/*
 * Out of Recently Deleted for good. The one
 * delete here that cannot be taken back, so it is taken only from a request
 * that says it is that press: a body naming the file it means
 * (`{ confirm: "<id>" }`), which no link, prefetch, address parameter or
 * generic `DELETE` carries. Only a row already deleted; the same rights as
 * putting it back, never through a token nor by an agent. The row goes the
 * way the clear-out takes it (`purge_file`, migration 281), and its bytes,
 * comments, followers, links and versions with it.
 */
files.delete('/files/:id/forever', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  if (ctx.viaMcp || ctx.agent) return c.json(forbidden, 403)
  const body = z.object({ confirm: z.string() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success || body.data.confirm !== id)
    return c.json({ error: { code: 'confirm_required', message: 'Say which file is to go for good.' } }, 400)
  if (!isId(id)) return c.json(missing, 404)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    /* Read through the file's own policy, so whoever could not see it
       standing is told it is not there. */
    const [row] = await tx<{ deleted_by: string | null; project_id: string | null; name: string; chosen: boolean }[]>`
      select f.deleted_by, f.project_id, f.name, ${apart(tx)} as chosen from file f
      join project p on p.id = f.project_id and p.deleted_at is null
      where f.id = ${id} and f.workspace_id = ${ctx.workspaceId} and f.deleted_at is not null
      for update of f`
    if (!row?.project_id) return 'missing' as const
    if (!mayRestore(ctx, row.deleted_by, row.project_id)) return 'forbidden' as const
    const [gone] = await tx<{ ok: boolean }[]>`select purge_file(${id}) as ok`
    if (!gone?.ok) return 'missing' as const
    /* Named as it was, as its delete was — and not for a file the
       project's feed never named: one sent in a room with chosen people,
       or a document still its author's or its chosen people's
       (`apart`). */
    if (!row.chosen)
      await record(tx, ctx, 'file.purge', {
        projectId: row.project_id,
        objectType: 'file',
        objectId: id,
        meta: { title: row.name },
      })
    return 'ok' as const
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  return c.json({ ok: true })
})

/*
 * A written document put on the web, or taken off it.
 *
 * Whoever may edit it decides, as editing does. On makes a new token, so a
 * link turned off once is dead for good; off forgets it. Only a written
 * document: an upload or a link is somebody else's file to share.
 */
files.put('/files/:id/public', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = z.object({ public: z.boolean() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)

  /* A tool may take a document off the web and never put one on it: what
     an agent was told by somebody's words is not a reason to publish. */
  if (ctx.viaMcp && body.data.public) return c.json(forbidden, 403)

  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ author_id: string; project_id: string; written: boolean; public_token: string | null; audience: string }[]>`
      select author_id, project_id, public_token, audience,
             (body is not null and storage_key is null and url is null) as written
      from file where id = ${id} and deleted_at is null`
    if (!row) return 'missing' as const
    if (!mayEdit(ctx, row.author_id, row.project_id)) return 'forbidden' as const
    if (!row.written) return 'not_document' as const
    /* On the web only once the project has it: a draft or a document of
       chosen people is not for anybody holding a link.
       Taking it off is always allowed. */
    if (body.data.public && row.audience !== 'project') return 'not_published' as const
    if (body.data.public && row.public_token) return { token: row.public_token }
    const token = body.data.public ? randomBytes(18).toString('base64url') : null
    await tx`
      update file set public_token = ${token}, public_at = ${token ? tx`now()` : null}
      where id = ${id}`
    await record(tx, ctx, token ? 'file.public' : 'file.private', {
      projectId: row.project_id,
      objectType: 'file',
      objectId: id,
    })
    return { token }
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'not_document')
    return c.json({ error: { code: 'not_document', message: 'Only a written document can be shared to the web.' } }, 409)
  if (result === 'not_published')
    return c.json(
      { error: { code: 'not_published', message: 'Publish this document to everyone on the project before sharing it to the web.' } },
      409,
    )
  return c.json(result)
})

/*
 * Who a written document is for. The first
 * change of a draft publishes it (`file.publish`); every later one is a
 * change of who (`file.access`). Never back to a draft: chosen people with
 * nobody chosen is its author's alone.
 */
const Audience = z.discriminatedUnion('audience', [
  z.object({ audience: z.literal('project') }).strict(),
  z.object({ audience: z.literal('chosen'), reader_ids: z.array(z.uuid()).max(1000) }).strict(),
])

files.put('/files/:id/audience', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const body = Audience.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<
      { author_id: string; project_id: string | null; audience: string; written: boolean; name: string; public_token: string | null }[]
    >`
      select author_id, project_id, audience, name, public_token,
             (body is not null and storage_key is null and url is null) as written
      from file where id = ${id} and workspace_id = ${ctx.workspaceId} and deleted_at is null and conversation_id is null
      for update`
    if (!row?.project_id) return 'missing' as const
    if (!mayShare(ctx, row.author_id, row.project_id)) return 'forbidden' as const
    if (!row.written) return 'not_document' as const

    const was = await tx<{ actor_id: string }[]>`
      select actor_id from file_reader where workspace_id = ${ctx.workspaceId} and file_id = ${id}`
    const before = new Set(was.map((r) => r.actor_id))
    /* The author is not chosen — it is theirs. Whoever narrows somebody
       else's document stays one of its people, as whoever edits a room
       stays in it. */
    const chosen =
      body.data.audience === 'chosen'
        ? [...new Set([...body.data.reader_ids, ...(ctx.actorId === row.author_id ? [] : [ctx.actorId])])].filter(
            (x) => x !== row.author_id,
          )
        : []
    if (chosen.length) {
      /* Chosen from the project: on its list of people, or the owner. */
      /* Of the workspace now, and on the project or its owner — the
         policy asks the same (`chosen_may_be`, migration 279). */
      const on = await tx<{ id: string }[]>`
        select x as id from unnest(${chosen}::uuid[]) x where chosen_may_be(${id}, x)`
      if (on.length !== chosen.length) return 'not_on_project' as const
    }
    const now = new Set(chosen)
    const added = chosen.filter((x) => !before.has(x))
    const removed = [...before].filter((x) => !now.has(x))
    const draft = row.audience === 'author'
    if (!draft && row.audience === body.data.audience && !added.length && !removed.length)
      return { audience: row.audience, reader_ids: chosen }

    /* The people first, while the one changing it can still read it under
       its old answer; then the answer. */
    if (removed.length)
      await tx`delete from file_reader where workspace_id = ${ctx.workspaceId} and file_id = ${id} and actor_id = any(${removed}::uuid[])`
    if (added.length)
      await tx`
        insert into file_reader (workspace_id, file_id, actor_id)
        select ${ctx.workspaceId}, ${id}, x from unnest(${added}::uuid[]) x
        on conflict do nothing`
    /* Narrowed from the project, it comes off the web too: a link is the
       widest audience there is. */
    const offWeb = body.data.audience !== 'project' && row.public_token !== null
    await tx`
      update file set audience = ${body.data.audience}
        ${offWeb ? tx`, public_token = null, public_at = null` : tx``}
      where id = ${id}`
    await record(tx, ctx, draft ? 'file.publish' : 'file.access', {
      projectId: row.project_id,
      objectType: 'file',
      objectId: id,
      meta: {
        audience: body.data.audience,
        /* How many, never who: the line and the webhook carry the
           audience and a count. */
        ...(added.length ? { added: added.length } : {}),
        ...(removed.length ? { removed: removed.length } : {}),
        ...(offWeb ? { off_web: true } : {}),
      },
    })
    /* Every open page of it asks again who may read it, now. */
    await publish(topicOf(id), 'access', {}, tx)
    /* Taken from the project: its screens are told it went — the id and
       nothing else — so an open list drops it, and whoever still has it
       reads it again. */
    /* Taken from the project, or from some of its people: the id alone, so
       every open list reads again and whoever may no longer see it drops it. */
    if ((row.audience === 'project' && body.data.audience !== 'project') || (body.data.audience !== 'project' && removed.length)) {
      /* And every picture it holds, which goes with it. */
      const inside = await tx<{ id: string }[]>`select id from file where held_by = ${id}`
      for (const gone of [id, ...inside.map((r) => r.id)])
        await publish(
          `project:${row.project_id}`,
          'file.hidden',
          { object_type: 'file', object_id: gone, actor_id: ctx.actorId, tab: ctx.tab ?? null },
          tx,
        )
    }
    /* Somebody newly chosen is told, as being put on a project is. */
    if (added.length) {
      const who = await doer(tx, ctx.actorId)
      await notify(tx, ctx, {
        objectType: 'file',
        objectId: id,
        watchers: false,
        what: (l) => LINES(l).sharedYou(who(l)),
        kind: 'added',
        also: { ids: added, reason: 'shared' },
      })
    }
    return { audience: body.data.audience, reader_ids: chosen }
  })
  if (result === 'missing') return c.json(missing, 404)
  if (result === 'forbidden') return c.json(forbidden, 403)
  if (result === 'not_document')
    return c.json({ error: { code: 'not_document', message: 'Only a written document can be kept to some people.' } }, 409)
  if (result === 'not_on_project')
    return c.json({ error: { code: 'not_on_project', message: 'Choose people who are on this project.' } }, 400)
  return c.json({ ok: true, ...result })
})

files.post('/files/:id/comments', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  /* Base64 of a Yjs relative position: a few dozen bytes. */
  const Position = z
    .string()
    .max(400)
    .regex(/^[A-Za-z0-9+/=]+$/)
  const body = z
    .object({
      body: RichBody,
      parent_id: z.uuid().nullish(),
      /* On words in the document: two
         positions from a page's selection, or the words themselves. */
      anchor: z
        .union([z.object({ from: Position, to: Position }).strict(), z.object({ text: z.string().min(1).max(500) }).strict()])
        .nullish(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: { code: 'invalid' } }, 400)
  const target = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [row] = await tx<{ project_id: string; written: boolean }[]>`
      select project_id, (body is not null and storage_key is null and url is null) as written
      from file where id = ${id} and deleted_at is null`
    return row ?? null
  })
  if (!target) return c.json(missing, 404)
  const a = body.data.anchor
  if (a && (!target.written || body.data.parent_id)) return c.json({ error: { code: 'invalid' } }, 400)
  const anchor: Anchor | null = !a
    ? null
    : 'text' in a
      ? { text: a.text }
      : { from: new Uint8Array(Buffer.from(a.from, 'base64')), to: new Uint8Array(Buffer.from(a.to, 'base64')) }
  /* Waited for here, outside any lock or transaction, while the page's
     last keystrokes are still on their way; garbage is refused at once. */
  if (anchor && !(await anchorReady(ctx, id, anchor)))
    return c.json({ error: { code: 'anchor_gone', message: 'Those words are no longer in the document.' } }, 409)
  const made = await addComment(
    ctx,
    'file',
    id,
    target.project_id,
    body.data.body,
    body.data.parent_id ?? null,
    null,
    anchor ? (tx, threadId) => anchorThread(tx, ctx, id, threadId, anchor) : null,
  ).catch((e: unknown) => {
    /* Past the state's cap: refused as any other write would be, and nothing kept. */
    if (e instanceof Refused) return e
    throw e
  })
  if (made instanceof Refused)
    return c.json({ error: { code: 'too_large', message: 'This document is too large to add more. Remove something first.' } }, 413)
  if (made === 'anchor_gone') return c.json({ error: { code: 'anchor_gone', message: 'Those words are no longer in the document.' } }, 409)
  if (made === 'anchor_empty') return c.json({ error: { code: 'invalid', message: 'Choose some words to comment on.' } }, 400)
  return made ? c.json(made, 201) : c.json(forbidden, 403)
})

/* --------------------------------------------------------------- uploads */

/*
 * One file's ceiling, which is not the plan's.
 *
 * The same on every plan: it is about what a single request should carry
 * rather than about what was paid for, and a 50 MB body is already the
 * point where an upload wants resuming rather than a bigger number.
 * The workspace's ceiling comes from its plan.
 *
 * From the shared schema, because the browser refuses a file before sending
 * it now and two copies of a limit are two limits.
 */

/*
 * Bytes into a file, for a project's Docs or for a conversation outside any
 * project. One body for both: the ceiling,
 * the size and the row are the same question asked of two homes.
 */
async function takeUpload(
  c: Context<{ Variables: { ctx: AuthContext } }>,
  home: { projectId: string; into?: string | null } | { conversationId: string },
) {
  const ctx = c.get('ctx')
  /* Put into a document from the start — `?into=<its id>`: the file is
     the document's, seen by whoever sees it, and told to the project only
     when the document is the project's. */
  const into = 'projectId' in home ? (home.into ?? null) : null
  if (into !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(into))
    return c.json({ error: { code: 'invalid' } }, 400)
  if (!allow(ctx, 'content.create', { inProject: true })) return c.json(forbidden, 403)

  const form = await c.req.formData().catch(() => null)
  const upload = form?.get('file')
  if (!(upload instanceof File)) {
    return c.json({ error: { code: 'invalid', message: 'No file' } }, 400)
  }
  if (upload.size > MAX_FILE_BYTES) {
    return c.json(
      { error: { code: 'too_large', message: `That file is too big. Files can be up to ${MAX_FILE_BYTES / (1024 * 1024)} MB.` } },
      413,
    )
  }

  const bytes = new Uint8Array(await upload.arrayBuffer())
  const id = uuidv7()
  let projectId = 'projectId' in home ? home.projectId : null
  const conversationId = 'conversationId' in home ? home.conversationId : null
  /* Whether the project's feed says a file arrived: not from a room with
     chosen people, whose files are theirs. */
  let told = true
  /* What this upload put in storage, so that anything failing after it —
     the insert, the feed line, the commit — takes the bytes back out:
     nothing else names them, and no clear-out would ever find them
     (the night audit, 14). */
  let storedKey: string | null = null

  const result = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    if (conversationId) {
      /* A room this person can see. A project's room keeps its files in
         the project's Docs, and names itself on them as well, so a channel
         with chosen people keeps them to its people. */
      const [room] = await tx<{ project_id: string | null; chosen: boolean }[]>`
        select cv.project_id, cv.chosen or cv.project_id is null as chosen
        from conversation cv where cv.id = ${conversationId} and cv.deleted_at is null`
      if (!room) return 'missing' as const
      projectId = room.project_id
      told = !room.chosen
    }
    if (projectId && !(await isInProject(tx, projectId))) return 'missing' as const
    if (into) {
      /* A written document of this project the uploader may read — whoever
         may comment on it may put a picture in a comment, and the picture
         follows the document. A folder, an upload or a link holds none. */
      const [doc] = await tx<{ written: boolean }[]>`
        select (body is not null and storage_key is null and url is null) as written
        from file where id = ${into} and project_id = ${projectId} and deleted_at is null`
      if (!doc) return 'missing' as const
      if (!doc.written) return 'not_document' as const
    }
    // Checked before writing, not after: a limit enforced once the bytes are
    // already on disk is an accounting note, not a limit.
    if (!(await fits(tx, ctx.workspaceId, bytes.byteLength))) return 'full' as const

    const stored = await put(ctx.workspaceId, bytes, upload.type || 'application/octet-stream')
    storedKey = stored.key
    if (!(await roomFor(tx, ctx.workspaceId, stored.size))) {
      await remove(stored.key).catch(() => {})
      return 'full' as const
    }
    const pixels = pixelsOf(bytes)
    /* A document taken for good while this was on its way refuses it: the
       schema reads the document locked (`held_by_holds`, migration 286). */
    const held = await tx
      .savepoint(
        (sp) => sp`
      insert into file (id, workspace_id, project_id, conversation_id, author_id, name, storage_key,
                        content_type, size_bytes, uploaded_at, pixel_width, pixel_height, origin_type, origin_id, held_by)
      values (${id}, ${ctx.workspaceId}, ${projectId}, ${conversationId}, ${ctx.actorId}, ${upload.name},
              ${stored.key}, ${stored.contentType}, ${stored.size}, now(),
              ${pixels?.width ?? null}, ${pixels?.height ?? null},
              ${into ? 'file' : null}, ${into}, ${into})`,
      )
      .then(() => true)
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P0002') return false
        throw e
      })
    if (!held) {
      await remove(stored.key).catch(() => {})
      return 'missing' as const
    }
    await subscribe(tx, ctx, 'file', id)
    if (projectId && told) await record(tx, ctx, 'file.upload', { projectId, objectType: 'file', objectId: id })
    return 'ok' as const
  }).catch(async (e: unknown) => {
    if (storedKey) await remove(storedKey).catch(() => {})
    throw e
  })

  if (result === 'missing') return c.json(missing, 404)
  if (result === 'not_document')
    return c.json({ error: { code: 'invalid', message: 'Only a written document holds pictures and files.' } }, 400)
  if (result === 'full') return c.json(storageRefusal(), 413)
  return c.json({ id }, 201)
}

files.post('/projects/:projectId/uploads', (c) => takeUpload(c, { projectId: c.req.param('projectId'), into: c.req.query('into') ?? null }))
files.post('/conversations/:id/uploads', (c) => takeUpload(c, { conversationId: c.req.param('id') }))

/**
 * A picture's copy for showing.
 *
 * Made by the browser that uploaded the original, from the bytes it still
 * holds: no more than 1600 pixels on the long side, JPEG or WebP. Only its
 * uploader adds it, only to a picture, and only a real JPEG or WebP is
 * taken — the bytes are checked, not the type the request claims.
 */
const MAX_DISPLAY_BYTES = 2 * 1024 * 1024
const looksLikeJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
const looksLikeWebp = (b: Uint8Array) =>
  b.length > 12 &&
  String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === 'RIFF' &&
  String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === 'WEBP'

files.post('/files/:id/display', async (c) => {
  const ctx = c.get('ctx')
  const id = c.req.param('id')
  const form = await c.req.formData().catch(() => null)
  const sent = form?.get('file')
  if (!(sent instanceof File)) return c.json({ error: { code: 'invalid', message: 'No file' } }, 400)
  if (sent.size > MAX_DISPLAY_BYTES) {
    return c.json({ error: { code: 'too_large', message: 'The display version can be up to 2 MB.' } }, 413)
  }
  const bytes = new Uint8Array(await sent.arrayBuffer())
  const type = looksLikeJpeg(bytes) ? 'image/jpeg' : looksLikeWebp(bytes) ? 'image/webp' : null
  if (!type) return c.json({ error: { code: 'invalid', message: 'Use a JPEG or WebP image.' } }, 400)

  const [row] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) =>
      tx<{ author_id: string; content_type: string | null; storage_key: string | null }[]>`
      select author_id, content_type, storage_key from file where id = ${id} and deleted_at is null`,
  )
  if (!row?.storage_key) return c.json(missing, 404)
  if (row.author_id !== ctx.actorId) return c.json(forbidden, 403)
  if (!row.content_type?.startsWith('image/')) {
    return c.json({ error: { code: 'invalid', message: 'Only images can have a display version.' } }, 400)
  }
  const stored = await put(ctx.workspaceId, bytes, type)
  await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx`update file set display_key = ${stored.key}, display_bytes = ${stored.size} where id = ${id}`,
  )
  return c.body(null, 204)
})

/**
 * A short-lived link, handed out only to somebody who may read the row.
 *
 * The permission check happens here, when the link is made, and the link then
 * stands on its own for five minutes. There are no public URLs: a bucket
 * anybody can read by guessing a name is how a client's documents end up
 * indexed.
 */
files.get('/files/:id/url', async (c) => {
  const ctx = c.get('ctx')
  const row = await withActor(ctx.actorId, ctx.workspaceId, async (tx) => {
    const [f] = await tx<{ storage_key: string | null; display_key: string | null; name: string; size_bytes: string | null }[]>`
      select storage_key, display_key, name, size_bytes from file
      where id = ${c.req.param('id')} and deleted_at is null`
    return f
  })
  if (!row?.storage_key) return c.json(missing, 404)
  return c.json({
    /* An hour, as a face and a project's mark are: long enough that the
       same link comes back for a page open all morning, so the browser's
       cache is asked rather than the network. */
    url: linkForReader(row.storage_key, ctx.actorId),
    /* The copy to draw in a body, when there is one — the original is for
       opening full size and saving. */
    display_url: row.display_key ? linkForReader(row.display_key, ctx.actorId) : null,
    name: row.name,
    /* Said under the file's name wherever it is drawn. */
    size: row.size_bytes === null ? null : Number(row.size_bytes),
    expires_in: 3600,
  })
})

/*
 * The files in what an agent reads, as links it can hand to a tool.
 *
 * A body read through MCP said `[name — not available]` where its pictures
 * were: the agent saw that something was attached and could do nothing with
 * it. These are the task prompt's links: they open
 * without signing in, for up to an hour, because a model's tools carry no cookie
 * and a client that connected by OAuth holds a token the model never sees.
 *
 * Only to a token, which is the person choosing to connect the agent, as a
 * press of Copy is the person choosing to hand a task to one; every link a
 * screen draws stays its reader's own (`linkForReader`). And only for rows
 * the reader's own policies return — a file in a channel with chosen people
 * for its people, a project's for the project's — so an id written into a
 * body by somebody who could see it opens nothing for somebody who cannot.
 * At most a hundred at once: one page of messages, one query.
 */
const FileIds = z.array(z.uuid()).min(1).max(100)
/*
 * Half an hour, which the signature rounds up to the next half-hour mark —
 * so a link lasts up to an hour, and access taken away is honoured by the
 * links already handed out within that.
 */
const LINK_SECONDS = 1800
/* Not a file whose place was a message since deleted: taking a message
   back takes back what it showed. Its row stays for the bin. */
const shownStill = (tx: Tx) =>
  tx`not exists (select 1 from message m where f.origin_type = 'message' and m.id = f.origin_id and m.deleted_at is not null)`
const kindOf = (type: string | null) => (type?.startsWith('image/') ? 'image' : 'file')

files.get('/file-links', async (c) => {
  const ctx = c.get('ctx')
  if (!ctx.viaMcp) return c.json(forbidden, 403)
  const ids = FileIds.safeParse([...new Set((c.req.query('ids') ?? '').split(',').filter(Boolean))])
  if (!ids.success) return c.json({ error: { code: 'invalid', message: 'Give 1 to 100 file ids, separated by commas.' } }, 400)
  const rows = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx<{ id: string; name: string; storage_key: string; content_type: string | null; size_bytes: string | null }[]>`
      select f.id, f.name, f.storage_key, f.content_type, f.size_bytes from file f
      where f.id = any(${ids.data}::uuid[]) and f.deleted_at is null and f.storage_key is not null and ${shownStill(tx)}`,
  )
  const at = originOf(c)
  return c.json({
    links: rows.map((f) => ({
      id: f.id,
      name: f.name,
      kind: kindOf(f.content_type),
      size: f.size_bytes === null ? null : Number(f.size_bytes),
      url: absolute(at, linkFor(f.storage_key, LINK_SECONDS)),
    })),
    expires_in: LINK_SECONDS * 2,
  })
})

const absolute = (at: string, url: string) => (url.startsWith('/') ? `${at}${url}` : url)

/** What `read_file` hands a model whole: a picture to look at, words to read. */
export const READ_IMAGE_BYTES = 5 * 1024 * 1024
export const READ_TEXT_BYTES = 200 * 1024
const TEXTUAL = /\.(txt|md|markdown|csv|tsv|json|log|ya?ml)$/i

/* At most `most` bytes of a stored object, or null when it is longer. */
async function bytesOf(key: string, most: number): Promise<Uint8Array | null> {
  const opened = await open(key)
  if (!opened) return null
  if (opened.size > most) {
    await opened.body.cancel().catch(() => {})
    return null
  }
  /* Counted as it arrives, whatever the size said: a bucket's length is a
     header, and a header is not a bound. */
  const reader = opened.body.getReader()
  const parts: Uint8Array[] = []
  let read = 0
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    read += next.value.byteLength
    if (read > most) {
      await reader.cancel().catch(() => {})
      return null
    }
    parts.push(next.value)
  }
  return Buffer.concat(parts)
}

/*
 * One file's contents for an agent — `read_file`.
 *
 * A picture as its bytes, so a model can look at it rather than be told a
 * link it cannot open; the copy for showing when there is one, which is the
 * smaller. The type is the bytes' own (`sniff`), never what the upload said,
 * and only the four a model is shown: anything else claiming to be an image
 * is a file. Words as words, when the file is short. Anything else, and
 * anything past those sizes, as the link alone.
 */
files.get('/files/:id/content', async (c) => {
  const ctx = c.get('ctx')
  if (!ctx.viaMcp) return c.json(forbidden, 403)
  const id = c.req.param('id')
  if (!z.uuid().safeParse(id).success) return c.json(missing, 404)
  const [f] = await withActor(
    ctx.actorId,
    ctx.workspaceId,
    (tx) => tx<
      {
        name: string
        storage_key: string | null
        display_key: string | null
        display_bytes: string | null
        content_type: string | null
        size_bytes: string | null
      }[]
    >`
      select f.name, f.storage_key, f.display_key, f.display_bytes, f.content_type, f.size_bytes from file f
      where f.id = ${id} and f.deleted_at is null and ${shownStill(tx)}`,
  )
  if (!f) return c.json(missing, 404)
  if (!f.storage_key) {
    return c.json({ error: { code: 'invalid', message: 'This is a document, not an uploaded file. Read it with read_doc.' } }, 400)
  }
  const size = f.size_bytes === null ? null : Number(f.size_bytes)
  const said = {
    id,
    name: f.name,
    kind: kindOf(f.content_type),
    size,
    url: absolute(originOf(c), linkFor(f.storage_key, LINK_SECONDS)),
    expires_in: LINK_SECONDS * 2,
  }
  if (f.content_type?.startsWith('image/')) {
    const key = f.display_key && Number(f.display_bytes ?? Infinity) <= READ_IMAGE_BYTES ? f.display_key : f.storage_key
    const bytes = await bytesOf(key, READ_IMAGE_BYTES)
    const type = bytes ? sniff(bytes) : null
    if (bytes && type && /^image\/(png|jpeg|gif|webp)$/.test(type)) {
      return c.json({ ...said, content_type: type, data: Buffer.from(bytes).toString('base64') })
    }
    return c.json(said)
  }
  const textual = f.content_type?.startsWith('text/') || f.content_type === 'application/json' || TEXTUAL.test(f.name)
  if (textual && (size ?? 0) <= READ_TEXT_BYTES) {
    const bytes = await bytesOf(f.storage_key, READ_TEXT_BYTES)
    /* Words, or it is not a text file whatever it is called. */
    const words = bytes ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }) : null
    try {
      if (bytes && words && !bytes.includes(0)) return c.json({ ...said, kind: 'text', text: words.decode(bytes) })
    } catch {
      /* Not UTF-8: the link alone. */
    }
  }
  return c.json(said)
})

files.get('/blob/:key{.+}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'))
  const token = c.req.query('token') ?? ''
  // The signature is the whole authorisation here: this route is reached with
  // a link, and a link that outlives its check is the same as a public URL.
  /*
   * A link made for a reader opens only for that reader — the browser's
   * cookie, or a bearer token for a client that sends one. Taking `for=me`
   * off does not help: the signature covers the reader, so the link then
   * fails the plain check below.
   */
  if (c.req.query('for') === 'me') {
    const cookie = (c.req.header('cookie') ?? '')
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${FILE_COOKIE}=`))
      ?.slice(FILE_COOKIE.length + 1)
    const reader = readFileCookie(cookie)?.actorId ?? (await authenticate(c.req.header('authorization')))?.actorId
    if (!reader || !verifyKeyFor(key, reader, token)) return c.json(forbidden, 403)
  } else if (!verifyKey(key, token)) {
    return c.json(forbidden, 403)
  }

  /* One range, as a browser asks for one — `bytes=0-` from a video opening,
     `bytes=31457280-` from somebody scrubbing. Anything else is answered
     with the whole object, which is always a correct answer. */
  const asked = /^bytes=(\d+)-(\d*)$/.exec(c.req.header('range') ?? '')
  const range = asked ? { start: Number(asked[1]), ...(asked[2] ? { end: Number(asked[2]) } : {}) } : undefined
  const opened = await open(key, range)
  if (!opened) return c.json(missing, 404)
  if (range && opened.size > 0 && range.start >= opened.size) {
    await opened.body.cancel().catch(() => {})
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${opened.size}` } })
  }
  const { body, type } = await typed(key, opened)
  /*
   * Said as what it is, where that can be known.
   *
   * Everything went out as `application/octet-stream`, which is correct for a
   * document somebody downloads and wrong for the two things drawn on the
   * screen: a browser will not paint an `<img>` served as a byte stream, so
   * every project icon and every face came back as a broken-image glyph.
   *
   * Read from the first bytes rather than from the key, which carries no
   * extension, and rather than from a column, which the pictures do not have
   * — four magic numbers answer it for everything this product accepts as an
   * image. Anything else keeps the stream it had: a type guessed wrong on a
   * file somebody uploaded is worse than no type at all.
   */
  /*
   * Saved to the disk rather than shown, when the link says so.
   *
   * The same bytes with a different presentation, which is why it is a
   * parameter and not a second route — the way S3 and Google Cloud Storage
   * both do it. A second URL would also be a second copy in every browser
   * cache, and these are cached for a year because the key is the version.
   *
   * Not covered by the signature, which is worth saying rather than
   * leaving to be found: the signature is over the key and an expiry, so
   * anybody holding a working link can add this. It grants nothing — the
   * request still needs a valid signature, and all this changes is whether
   * the file they could already read arrives as a download. Widening the
   * signature over query parameters would change every link in the product
   * against no attack.
   *
   * The name comes from the caller because this route has only a key: the
   * file's row is not read here, and reading it would mean a query on every
   * picture a page draws. Quoted and stripped of anything that could end
   * the header early — a filename is user input and this one goes into a
   * header verbatim.
   */
  const named = c.req.query('name')
  const safe = named?.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120) || 'file'
  const download = c.req.query('download') === '1'
  /*
   * The file's own name, whether it is saved or opened.
   *
   * Opened in a tab without one, a file the browser cannot show — an mp3
   * on some machines, any type it does not know — was saved under the
   * last part of the address: a uuid with no extension, which the system
   * then could not open, and which looked broken. The name now travels
   * with every link a body draws, inline as well as for saving. Twice: an
   * ASCII fallback, and the real name encoded (RFC 5987) — a Cyrillic name
   * in a header as it was is not a header at all.
   */
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  const disposition = named
    ? `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
    : download
      ? 'attachment; filename="file"'
      : null
  const part = range !== undefined

  return new Response(body, {
    status: part ? 206 : 200,
    headers: {
      'content-type': type,
      /*
       * Never read as anything but what it was served as, and never a page
       * that runs anything: the type above is sniffed from the bytes and
       * names only kinds that carry no script, and these two make sure a
       * browser does not guess past it. A PDF
       * keeps its viewer, which a sandbox would take away.
       */
      'x-content-type-options': 'nosniff',
      ...(type === 'application/pdf' ? {} : { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
      'accept-ranges': 'bytes',
      'content-length': String(opened.end - opened.start + 1),
      ...(part ? { 'content-range': `bytes ${opened.start}-${opened.end}/${opened.size}` } : {}),
      ...(disposition ? { 'content-disposition': disposition } : {}),
      /*
       * Cached hard, because the key is the version.
       *
       * A stored object never changes: `put` writes a fresh uuid every time,
       * so a new picture is a new key and a new link. That makes this safe to
       * keep for a year — and the link it is reached by expires in an hour
       * anyway, which is the shorter of the two leashes.
       *
       * It is said out loud rather than left to the browser. With no header
       * at all a browser caches on a heuristic of its own, which is how a
       * response served with the wrong content type outlived the fix for it:
       * the bytes were right, the server was right, and the screen kept
       * showing a broken image with no way to tell why.
       */
      'cache-control': 'private, max-age=31536000, immutable',
    },
  })
})

/**
 * What an object is, without holding it.
 *
 * Read off its first bytes as they go past when the answer starts at the
 * beginning — the opening chunk is looked at and handed on — and remembered
 * by key, because a key is never rewritten. A range from the middle of a
 * video asks for the type that its first request already found; on a
 * server that has not seen that key, sixteen bytes are fetched to answer it.
 */
const types = new Map<string, string>()

async function typed(
  key: string,
  opened: { body: ReadableStream<Uint8Array>; start: number },
): Promise<{ body: ReadableStream<Uint8Array>; type: string }> {
  const known = types.get(key)
  if (known) return { body: opened.body, type: known }
  if (opened.start > 0) {
    // Enough for an SVG's preamble, which is text and not four bytes.
    const head = await open(key, { start: 0, end: 1023 })
    const bytes = head ? new Uint8Array(await new Response(head.body).arrayBuffer()) : new Uint8Array()
    return { body: opened.body, type: learn(key, sniff(bytes)) }
  }
  const reader = opened.body.getReader()
  const first = await reader.read()
  const type = learn(key, sniff(first.value ?? new Uint8Array()))
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      if (first.value) c.enqueue(first.value)
      if (first.done) c.close()
    },
    async pull(c) {
      const next = await reader.read()
      if (next.done) c.close()
      else c.enqueue(next.value)
    },
    cancel(why) {
      return reader.cancel(why)
    },
  })
  return { body, type }
}

function learn(key: string, type: string): string {
  // Bounded: a long-lived server sees every key it has ever served.
  if (types.size > 10_000) types.clear()
  types.set(key, type)
  return type
}

/**
 * What these bytes are, from the bytes.
 *
 * The types that have to be *played or painted* rather than saved — a
 * document served as the wrong type is a document that opens in the wrong
 * thing, so everything else stays a stream.
 *
 * From the bytes and never from what the client said: a content type a
 * caller supplied is a content type an attacker supplied, and this one
 * decides what a browser will do with the file afterwards.
 *
 */
export function sniff(bytes: Uint8Array): string {
  const at = (i: number) => bytes[i] ?? -1
  // PNG: 89 50 4E 47
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png'
  // JPEG: FF D8 FF
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  // GIF: "GIF8"
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return 'image/gif'
  // WebP: "RIFF" .... "WEBP"
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return 'image/webp'
  }
  /*
   * Matroska, which is what webm is: 1A 45 DF A3.
   */
  if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return 'video/webm'
  /*
   * ISO base media — mp4 and quicktime both — which begins with a four-byte
   * box size and then `ftyp`. The brand after it says which: `qt  ` is
   * quicktime and everything else a camera writes is mp4.
   */
  if (at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11))
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4'
  }
  /*
   * PDF: "%PDF". Without it a PDF went out as a byte stream, so opening one
   * over the page drew a white sheet and the browser saved the file
   * instead — `docs/specs/docs.md`.
   */
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return 'application/pdf'
  if (svgish(bytes)) return 'image/svg+xml'
  return 'application/octet-stream'
}

/** The pictures a browser paints and runs nothing in. */
export type Raster = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
const RASTER: readonly string[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/**
 * Which of those these bytes are, or null — for a face, a project's or a
 * workspace's picture, and what a workspace's own domain serves as its
 * icon. By the bytes alone: the type the sender wrote on the form was
 * all that was asked, so an SVG sent as `image/png` was kept, and sniffed
 * as what it is where it was served — a document that runs script on a
 * workspace's own domain (the eighth audit).
 */
export function rasterOf(bytes: Uint8Array): Raster | null {
  const type = sniff(bytes)
  return RASTER.includes(type) ? (type as Raster) : null
}

/**
 * An SVG, which is text: an `<svg` element first, after at most an XML
 * declaration, a doctype and comments.
 *
 * Served as itself, and safe to be: the headers it goes out with
 * (`sandbox`, `default-src 'none'`, `nosniff`) make it a document with no
 * script, no requests and no origin when somebody opens its link, and drawn
 * in an `<img>` a browser runs nothing in it anyway. It went out as bytes
 * for a while, which was safe and drew a broken picture in the list and
 * the lightbox.
 */
export function svgish(bytes: Uint8Array): boolean {
  return svgStart(new TextDecoder().decode(bytes.subarray(0, 1024)))
}

/**
 * Whether text starts as an SVG: an XML declaration, comments and an SVG
 * doctype, in any number, then `<svg`. Walked rather than matched: as one
 * pattern a comment could stretch over the comments after it, every way of
 * doing so was tried before saying no, and three hundred bytes of `<!---->`
 * held the server for hours. The same walk is in the hosted service's CDN worker.
 */
export function svgStart(raw: string): boolean {
  const text = raw.replace(/^\uFEFF/, '')
  let at = 0
  const skip = () => {
    while (at < text.length && /\s/.test(text[at]!)) at++
  }
  skip()
  if (text.startsWith('<?xml', at)) {
    const end = text.indexOf('?>', at)
    if (end < 0) return false
    at = end + 2
  }
  for (;;) {
    skip()
    if (text.startsWith('<!--', at)) {
      const end = text.indexOf('-->', at + 4)
      if (end < 0) return false
      at = end + 3
    } else if (/^<!DOCTYPE\s+svg/i.test(text.slice(at, at + 16))) {
      const end = text.indexOf('>', at)
      if (end < 0) return false
      at = end + 1
    } else break
  }
  return /^<svg[\s>]/i.test(text.slice(at, at + 5))
}

/* Asked of the edition — `ceilings.ts`: under a lock on the service, and
   always room on your own server. Here too, for whoever reads it from here. */
export { roomFor }
