import { can, DEFAULT_SETTINGS, type Role } from '@tracker/shared-schema'
import { asWorker, type Tx, withActor, withoutActor } from './db.js'
import { issueAccessToken } from './auth/tokens.js'
import { app } from './http/routes.js'
import { fromInside } from './http/limits.js'
import { appSlug, asInstallation, GithubRefused, personToken } from './github.js'
import { plainDoc, readMarkdownOrPlain } from './mcp/markdownPool.js'
import { markdown } from './prompt.js'

/**
 * Issues and tasks kept the same, both ways.
 *
 * From GitHub: an issue's event changes its task through the same endpoints
 * a person uses, as the person who linked the repository (or, for what a
 * person here said on GitHub, as them), with a token that says GitHub caused
 * it — so the change is not queued to be sent back. To GitHub: what
 * `record` queued (`github_out`) is sent, the task's newest state each time,
 * as the installation — or, for a comment, as its author where they have
 * linked their GitHub. Every field is compared with what GitHub last said
 * (`github_issue.seen`), so an echo of our own changes nothing.
 */

/* What GitHub last said, field by field — and `here`, the description as
   this side drew it then. A body does not come back from Markdown and go out
   again letter for letter (GitHub's <img> becomes a picture of ours, a list
   is renumbered), so whether it changed here is asked of our own drawing,
   not of GitHub's text: otherwise renaming a task sent its description too. */
type Seen = {
  title?: string
  body?: string
  here?: string
  state?: 'open' | 'closed'
  reason?: string | null
  assignees?: string[]
  labels?: string[]
  /* Taken back from an earlier link and not yet made the same on both
     sides: kept until it is, so a try that GitHub refused
     halfway is finished by the next one rather than forgotten. */
  reattach?: 'import' | 'event'
}
type Target = {
  link_id: string
  repo_name: string
  installation_id: string
  linked_by: string
  issues: boolean
  workspace_id: string
  project_key: string
}
type Person = { actor_id: string; github_id: string; login: string }

/** Something that may work on another try. */
export class Later extends Error {}

/* ----------------------------------------------------------- the means */

async function target(projectId: string): Promise<Target | null> {
  const [t] = await asWorker((tx) => tx<Target[]>`select * from github_target(${projectId})`)
  if (!t?.issues) return null
  return (await linkerCan(t.link_id, t.linked_by, t.workspace_id, projectId)) ? t : null
}

/**
 * Whether the person a link acts as may still change tasks in its project;
 * when not, the link stops, with why, and nothing more is done as them.
 */
export async function linkerCan(link: string, actor: string, workspace: string, project: string): Promise<boolean> {
  const [ctx] = await withoutActor(
    (tx) =>
      tx<{ role: Role; rights: { p: string; r: string[] }[] | null; unproved: boolean }[]>`
      select role, rights, auth_email_confirmed(${actor}) is false as unproved from auth_context(${actor}, ${workspace})`,
  )
  /* Asked of `can()`, so an owner's role held by an unproved address counts
     as a member's here too. */
  const may =
    ctx &&
    can('content.edit.own', {
      role: ctx.role,
      settings: DEFAULT_SETTINGS,
      inProject: (ctx.rights ?? []).some((x) => x.p === project),
      unproved: ctx.unproved,
    })
  if (!may) {
    await asWorker((tx) => tx`select github_link_stop(${link}, ${'linker'})`)
    console.log(`github: link ${link} stopped, its person can no longer act there`)
  }
  return Boolean(may)
}

async function people(workspaceId: string): Promise<Person[]> {
  return asWorker((tx) => tx<Person[]>`select actor_id, github_id::text, login from github_people(${workspaceId})`)
}

/** A request to our own API as somebody, with a token that says GitHub caused it. */
async function rest<T>(
  actor: string,
  workspace: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const token = await issueAccessToken({ sub: actor, workspace_id: workspace, via: 'github' })
  const r = await app.request(`/api${path}`, {
    method,
    headers: { ...fromInside(), authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (r.status >= 500) throw new Later(`${method} ${path} → ${r.status}`)
  const text = await r.text()
  return { status: r.status, body: (text ? JSON.parse(text) : null) as T }
}

const gh = <T>(t: Target, path: string, opts: { method?: string; body?: unknown } = {}) =>
  asInstallation<T>(Number(t.installation_id), path, opts).catch((e) => {
    if (e instanceof GithubRefused && (e.status >= 500 || e.status === 429 || e.status === 403)) throw new Later(e.message)
    throw e
  })

async function asPerson<T>(token: string, path: string, opts: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`https://api.github.com${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'Tuff',
      'content-type': 'application/json',
    },
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new GithubRefused(r.status, `${opts.method ?? 'GET'} ${path} → ${r.status}`)
  return (r.status === 204 ? undefined : await r.json()) as T
}

/* A body as Markdown for GitHub, and back. A file here is named, not sent:
   GitHub cannot hold a file of ours, and a public repository must not get
   one that is not public — except a picture that came from GitHub, which
   goes back as the address it came from. */
const md = (body: unknown): string => {
  if (!body) return ''
  const from = new Map<string, string>()
  const walk = (n: Node) => {
    if (n.type === 'attachment' && typeof n.attrs?.fileId === 'string' && typeof n.attrs?.source === 'string') {
      from.set(n.attrs.fileId, n.attrs.source)
    }
    n.content?.forEach(walk)
  }
  walk(body as Node)
  return markdown(body, (id) => from.get(id) ?? null, []).trim()
}
/* Read by a worker, and kept as plain paragraphs when it cannot be read
   in half a second: a sync that refused an issue would refuse it on every
   pass. */
const doc = async (text: string | null | undefined) => (text?.trim() ? readMarkdownOrPlain(text) : null)

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] }

/* A person named here is `@login` there if they have linked, their name in
   bold if not; Markdown has no mention, and one written as nothing was
   simply lost. */
async function outText(t: Target, body: unknown): Promise<string> {
  if (!body) return ''
  const ids = new Set<string>()
  const walk = (n: Node) => {
    if (n.type === 'mention' && typeof n.attrs?.id === 'string') ids.add(n.attrs.id)
    n.content?.forEach(walk)
  }
  walk(body as Node)
  if (!ids.size) return md(body)
  const folks = await people(t.workspace_id)
  const names = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ id: string; name: string }[]>`select id, name from actor where id = any(${[...ids]}::uuid[])`,
  )
  const swap = (n: Node): Node => {
    if (n.type === 'mention' && typeof n.attrs?.id === 'string') {
      const login = folks.find((f) => f.actor_id === n.attrs!.id)?.login
      const name = names.find((x) => x.id === n.attrs!.id)?.name ?? String(n.attrs.label ?? 'somebody')
      return login ? { type: 'text', text: `@${login}` } : ({ type: 'text', text: name, marks: [{ type: 'bold' }] } as unknown as Node)
    }
    return n.content ? { ...n, content: n.content.map(swap) } : n
  }
  return md(swap(body as Node))
}

/*
 * The pictures in what GitHub says, kept here as the project's files — the
 * way a file in a Slack export is (`slack-import.md`): fetched by the server
 * from GitHub's own hosts only, each a picture of ten megabytes at most, and
 * put in as `![name](file:<id>)` on a line of its own. A picture that will
 * not come — a private repository's attachment GitHub will not hand an app,
 * a host that is not GitHub's — stays the link it was.
 */
const PICTURE_HOSTS =
  /^(github\.com|user-images\.githubusercontent\.com|private-user-images\.githubusercontent\.com|raw\.githubusercontent\.com|objects\.githubusercontent\.com|github-production-user-asset-[a-z0-9]+\.s3\.amazonaws\.com)$/

async function fetchPicture(t: Target, url: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  let at = url
  for (let hop = 0; hop < 4; hop++) {
    let u: URL
    try {
      u = new URL(at)
    } catch {
      return null
    }
    if (u.protocol !== 'https:' || !PICTURE_HOSTS.test(u.hostname)) return null
    if (u.hostname === 'github.com' && !u.pathname.startsWith('/user-attachments/')) return null
    /* GitHub's own addresses are asked as the installation; a signed one on
       its storage carries its own key and is asked bare. */
    /* Only GitHub's own attachment address is asked as the installation.
       Its token reaches every repository the app was given, and on
       raw.githubusercontent.com a picture named by an outsider could be one
       from a private repository nobody here may see. */
    const ours = u.hostname === 'github.com'
    const token = ours ? await installationTokenFor(t) : null
    const r = await fetch(u, {
      redirect: 'manual',
      headers: { 'user-agent': 'Tuff', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null)
    if (!r) return null
    if (r.status >= 300 && r.status < 400) {
      const next = r.headers.get('location')
      if (!next) return null
      at = new URL(next, u).href
      continue
    }
    const type = r.headers.get('content-type') ?? ''
    if (!r.ok || !type.startsWith('image/')) return null
    if (Number(r.headers.get('content-length') ?? 0) > 10 * 1024 * 1024) return null
    /* Read up to the ceiling and no further: a body with no length said
       is not taken whole into memory on its word. */
    const reader = r.body?.getReader()
    if (!reader) return null
    const parts: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 10 * 1024 * 1024) {
        await reader.cancel().catch(() => {})
        return null
      }
      parts.push(value)
    }
    const all = new Uint8Array(size)
    let put = 0
    for (const part of parts) {
      all.set(part, put)
      put += part.byteLength
    }
    return { bytes: all.buffer, type: type.split(';')[0]! }
  }
  return null
}

async function installationTokenFor(t: Target): Promise<string> {
  const { installationToken } = await import('./github.js')
  return installationToken(Number(t.installation_id))
}

async function bringPictures(
  t: Target,
  project: string,
  text: string,
  /* Pictures already brought, by where they came from: an edit to the
     words of an issue does not fetch its pictures again. */
  known: Map<string, string> = new Map(),
  /* False: only pictures already brought are kept as files; new ones stay links. */
  fetch_ = true,
): Promise<{ text: string; sources: Map<string, string> }> {
  const sources = new Map<string, string>()
  const found = [
    /* Bounded, as every pattern over somebody else's text is: unbounded,
       64 KB of `![` was seconds of the worker. */
    ...[...text.matchAll(/!\[([^\]\n]{0,200})\]\((https:\/\/[^\s)]{1,2000})\)/g)].map((m) => ({
      whole: m[0],
      alt: m[1] ?? '',
      url: m[2]!,
    })),
    ...[...text.matchAll(/<img\b[^<>]{0,1000}?\bsrc="(https:\/\/[^"<>]{1,2000})"[^<>]{0,1000}>/gi)].map((m) => ({
      whole: m[0],
      alt: /\balt="([^"]*)"/i.exec(m[0])?.[1] ?? '',
      url: m[1]!,
    })),
  ]
  let out = text
  for (const f of found.slice(0, 20)) {
    const had = known.get(f.url)
    if (had) {
      sources.set(had, f.url)
      out = out.replace(f.whole, () => `\n\n![${f.alt || 'Picture'}](file:${had})\n\n`)
      continue
    }
    if (!fetch_) continue
    const got = await fetchPicture(t, f.url)
    if (!got) continue
    const ext =
      got.type
        .split('/')[1]
        ?.replace('jpeg', 'jpg')
        .replace(/[^a-z0-9]/g, '') || 'png'
    const name = `${(f.alt || 'Picture').replace(/[^\w .-]/g, '').slice(0, 60) || 'Picture'}.${ext}`
    const form = new FormData()
    form.set('file', new File([got.bytes], name, { type: got.type }))
    const token = await issueAccessToken({ sub: t.linked_by, workspace_id: t.workspace_id, via: 'github' })
    const r = await app.request(`/api/projects/${project}/uploads`, {
      method: 'POST',
      headers: { ...fromInside(), authorization: `Bearer ${token}` },
      body: form,
    })
    if (!r.ok) continue
    const { id } = (await r.json()) as { id: string }
    sources.set(id, f.url)
    out = out.replace(f.whole, () => `\n\n![${name}](file:${id})\n\n`)
  }
  return { text: out, sources }
}

/* Each picture's name, kind and size from its row, as the MCP layer fills
   them, and where on GitHub it came from. */
async function fillPictures(t: Target, d: Node, sources: Map<string, string>): Promise<void> {
  for (const n of d.content ?? []) {
    if (n.type !== 'attachment' || typeof n.attrs?.fileId !== 'string') continue
    const id = n.attrs.fileId
    const read = await rest<{
      file: {
        name: string
        content_type: string | null
        size_bytes: number | null
        pixel_width: number | null
        pixel_height: number | null
      }
    }>(t.linked_by, t.workspace_id, 'GET', `/files/${id}`).catch(() => null)
    const f = read?.status === 200 ? read.body.file : null
    if (!f) continue
    n.attrs = {
      fileId: id,
      name: f.name,
      kind: f.content_type?.startsWith('image/') ? 'image' : 'file',
      size: f.size_bytes === null ? null : Number(f.size_bytes),
      pixelWidth: f.pixel_width,
      pixelHeight: f.pixel_height,
      ...(sources.get(id) ? { source: sources.get(id) } : {}),
    }
  }
}

/* And back: `@login` of somebody here is them, as a mention, and GitHub's
   pictures are files here. */
/* Whose words these are on GitHub: somebody with a hand in the repository,
   or anybody at all — a public repository's issues are open to the world,
   and the world's pictures are not fetched into somebody's storage. */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const trusted = (who: { author_association?: string } | null | undefined) => TRUSTED.has(who?.author_association ?? '')

async function inDoc(
  t: Target,
  text: string | null | undefined,
  project?: string,
  known?: Map<string, string>,
  fetchPictures = false,
): Promise<Node | null> {
  let source = text ?? ''
  let sources = new Map<string, string>()
  if (project && (fetchPictures || known?.size) && /!\[|<img/i.test(source)) {
    ;({ text: source, sources } = await bringPictures(t, project, source, fetchPictures ? known : (known ?? new Map()), fetchPictures))
  }
  const d = (await doc(source)) as Node | null
  if (d && sources.size) await fillPictures(t, d, sources)
  text = source
  if (!d || !text?.includes('@')) return d
  const folks = await people(t.workspace_id)
  if (!folks.length) return d
  const names = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ id: string; name: string }[]>`select id, name from actor where id = any(${folks.map((f) => f.actor_id)}::uuid[])`,
  )
  const split = (n: Node): Node[] => {
    if (n.type !== 'text' || !n.text?.includes('@') || (n as { marks?: { type: string }[] }).marks?.some((m) => m.type === 'code')) {
      return [n.content ? { ...n, content: n.content.flatMap(split) } : n]
    }
    const out: Node[] = []
    let rest = n.text
    for (const m of [...n.text.matchAll(/(^|[^\w])@([A-Za-z0-9-]{1,39})/g)]) {
      const who = folks.find((f) => f.login.toLowerCase() === m[2]!.toLowerCase())
      if (!who) continue
      const at = rest.indexOf(`@${m[2]}`)
      if (at < 0) continue
      if (at > 0) out.push({ ...n, text: rest.slice(0, at) })
      out.push({ type: 'mention', attrs: { id: who.actor_id, label: names.find((x) => x.id === who.actor_id)?.name ?? who.login } })
      rest = rest.slice(at + m[2]!.length + 1)
    }
    if (!out.length) return [n]
    if (rest) out.push({ ...n, text: rest })
    return out
  }
  return split(d)[0] ?? d
}

type Lists = { id: string; icon: string | null; intake: boolean }[]

async function listsOf(actor: string, workspace: string, project: string): Promise<Lists> {
  return withActor(
    actor,
    workspace,
    (tx) => tx<Lists>`select id, icon, intake from task_list where project_id = ${project} and deleted_at is null order by sort_key`,
  )
}
const firstWith = (lists: Lists, ...marks: string[]) => {
  for (const m of marks) {
    const l = lists.find((x) => x.icon === m)
    if (l) return l.id
  }
  return null
}

/** Labels by name, made in the project where GitHub has one it does not. */
async function labelIds(t: Target, project: string, names: string[]): Promise<string[]> {
  const have = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ id: string; name: string }[]>`select id, name::text from label where project_id = ${project} and deleted_at is null`,
  )
  const out: string[] = []
  for (const name of names) {
    const found = have.find((l) => l.name.toLowerCase() === name.toLowerCase())
    if (found) out.push(found.id)
    else {
      const r = await rest<{ label?: { id: string }; id?: string }>(t.linked_by, t.workspace_id, 'POST', `/projects/${project}/labels`, {
        name,
      })
      const id = r.body?.id ?? r.body?.label?.id
      if (id) out.push(id)
    }
  }
  return out
}

/* --------------------------------------------------------- from GitHub */

type Issue = {
  author_association?: string
  /* GitHub's id for it, which is what names a sub-issue — not its number. */
  id?: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  state_reason?: string | null
  assignees?: { id: number; login: string }[]
  labels?: ({ name: string } | string)[]
  pull_request?: unknown
  repository_url?: string
  sub_issues_summary?: { total?: number }
}

const labelNames = (i: Issue) => (i.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
const seenOf = (i: Issue): Seen => ({
  title: i.title,
  body: (i.body ?? '').trim(),
  state: i.state,
  reason: i.state_reason ?? null,
  assignees: (i.assignees ?? []).map((a) => a.login).sort(),
  labels: labelNames(i).sort(),
})

/* `dead`: its task is in Trash — a pairing a live task with an earlier
   one of the same issue may take over. */
type Pair = {
  task_id: string
  number: number
  seen: Seen
  left_list: string | null
  dead?: boolean
  /* Sub-issues — migration 274. */
  issue_id: string | null
  parent_number: number | null
  parent_here: string | null
  nest_said: string | null
}

async function pairOf(t: Target, project: string, number: number): Promise<Pair | null> {
  const [p] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<Pair[]>`
      select g.task_id, g.number, g.seen, g.left_list, k.deleted_at is not null as dead,
             g.issue_id::text, g.parent_number, g.parent_here, g.nest_said
      from github_issue g join task k on k.id = g.task_id
      where g.link_id = ${t.link_id} and g.number = ${number}`,
  )
  return p ?? null
}

/* Nobody live holds this number under the current link: no row, or only a
   task in Trash — whose row gives way to the task taking it back. */
const nobodyLiveHolds = (tx: Tx, t: Target, number: number) => tx`
  not exists (select 1 from github_issue h join task hk on hk.id = h.task_id
              where h.link_id = ${t.link_id} and h.number = ${number} and hk.deleted_at is null)`

/*
 * An issue that was a task's here before the repository was linked again. Unlinking, the app removed, or a new installation each leave
 * `github_issue` as it was, under the link that has gone; linking again is
 * a new link, and without this its import made a second task of every open
 * issue that already had one.
 *
 * The pairing is believed only inside this project: its row, the link it
 * was made under and the task are all this project's, in this workspace,
 * and the old link was to the same repository by GitHub's own id — which a
 * rename or a transfer keeps, and the name does not. Another project that
 * links the repository later finds nothing here and imports as anybody
 * would. Found, it is moved onto the current link in the same transaction.
 * `task` narrows it to one task's own pairing.
 */
async function earlier(
  t: Target,
  project: string,
  number: number,
  by: 'import' | 'event',
  task: string | null = null,
): Promise<Pair | null> {
  return withActor(t.linked_by, t.workspace_id, async (tx) => {
    const [p] = await tx<Pair[]>`
      select g.task_id, g.number, g.seen, g.left_list, g.issue_id::text, g.parent_number, g.parent_here, g.nest_said
      from github_issue g
      join github_link was on was.id = g.link_id
      join github_link cur on cur.id = ${t.link_id}
      join task k on k.id = g.task_id
      where g.number = ${number} and g.link_id <> ${t.link_id}
        and (${task}::uuid is null or g.task_id = ${task}::uuid)
        and g.workspace_id = ${t.workspace_id} and g.project_id = ${project}
        and was.workspace_id = ${t.workspace_id} and was.project_id = ${project}
        and cur.workspace_id = ${t.workspace_id} and cur.project_id = ${project}
        and was.repo_id = cur.repo_id
        and k.workspace_id = ${t.workspace_id} and k.project_id = ${project}
        and k.deleted_at is null
        and ${nobodyLiveHolds(tx, t, number)}
      order by g.synced_at desc
      limit 1
      for update of g`
    if (!p) return null
    await tx`
      delete from github_issue h using task hk
      where h.link_id = ${t.link_id} and h.number = ${number} and hk.id = h.task_id and hk.deleted_at is not null`
    /* Moved with the mark that says the rest is still owed: if GitHub
       refuses halfway, the next try finds the mark and finishes. */
    const moved = await tx`
      update github_issue set link_id = ${t.link_id}, seen = seen || ${tx.json({ reattach: by } as never)}
      where task_id = ${p.task_id} and ${nobodyLiveHolds(tx, t, number)}
      returning 1`
    if (!moved.length) return null
    return { ...p, seen: { ...p.seen, reattach: by } }
  })
}

/** Whether a pairing is a re-attach that has not finished. */
const unfinished = (p: Pair | null): p is Pair & { seen: { reattach: 'import' | 'event' } } => Boolean(p?.seen.reattach)

/**
 * An issue paired again with its task.
 *
 * Found by the import, the task wins: it is not moved, and nothing on it is
 * written over. GitHub is brought up to the task — its title, description,
 * open or closed, assignees and labels — so a task finished while the
 * repository was unlinked closes its issue. A title or description changed
 * on GitHub meanwhile is kept on the task as a comment rather than lost.
 *
 * Found by an event — somebody reopening, months later, an issue that was
 * closed when the repository was linked again, so the import never saw it —
 * the event is the latest write and the ordinary rules hold: what GitHub
 * changed since the last sync comes to the task, then what changed here
 * goes to GitHub. Otherwise a reopened issue would be closed again at once
 * because its task was done.
 *
 * Either way the comments said on the issue while it was not linked are
 * brought across, once. Every step can be taken again: the pairing carries
 * `seen.reattach` until the last one is done, and a try GitHub refused is
 * finished by the next (`unfinished`).
 */
async function reattach(t: Target, project: string, pair: Pair, issue: Issue, by: 'import' | 'event'): Promise<void> {
  if (by === 'event') {
    await apply(t, project, pair, issue)
    /* Nesting by the same rule as the other fields: moved on GitHub since
       the last sync, GitHub's comes to the task; otherwise the task's goes. */
    await nestFromGithub(t, project, pair)
  } else {
    const now = seenOf(issue)
    const was = pair.seen
    const [task] = await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx<{ title: string }[]>`select title from task where id = ${pair.task_id}`,
    )
    const here = (await taskBody(t, pair.task_id)) ?? ''
    const body = now.body && now.body !== (was.body ?? '') && now.body !== here ? now.body : null
    const title = now.title && now.title !== was.title && now.title !== task?.title ? now.title : null
    if (body !== null || title !== null) {
      const said = await rest<{ id: string }>(t.linked_by, t.workspace_id, 'POST', `/tasks/${pair.task_id}/comments`, {
        body: await readMarkdownOrPlain(
          [
            'Changed on GitHub while the repository was not linked — this was replaced:',
            title !== null ? `Title: ${title}` : '',
            body ?? '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
        said_as: 'GitHub',
      })
      /* Not kept, not written over: GitHub's words stay GitHub's until
         they are somewhere here. */
      if (said.status !== 201) throw new Error(`github: what #${issue.number} said could not be kept on its task, ${said.status}`)
    }
    /* What GitHub says now is what the task is compared with, so whatever
       differs is sent — and taken again, this compares the same. */
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`
      update github_issue set seen = ${tx.json({ ...now, here: now.body, reattach: by } as never)}, synced_at = now(),
        issue_id = coalesce(issue_id, ${issue.id ?? null}), reattached_link = ${t.link_id}
      where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
    )
  }
  await toIssue(t, project, pair.task_id, { reattaching: true })
  /* Its nesting too, the task's over GitHub's: what changed there while
     nothing was linked is not known, so it is asked. Before the mark goes,
     so a refusal is finished by the next try. */
  if (by === 'import') await nest(t, project, pair.task_id, true)
  const comments = await gh<GhComment[]>(t, `/repos/${t.repo_name}/issues/${issue.number}/comments?per_page=100`)
  const known = await pairedComments(
    t,
    comments.map((c) => c.id),
  )
  for (const c of comments) if (c.user?.type !== 'Bot' && !known.has(String(c.id))) await commentHere(t, project, pair.task_id, c)
  await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`update github_issue set seen = seen - 'reattach' where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
  )
}

/** An issue's event: its task made, changed, closed, reopened or removed. */
export async function fromIssue(project: string, p: Record<string, any>): Promise<void> {
  const t = await target(project)
  if (!t) return
  if (p.sender?.type === 'Bot') return // our own, as the installation
  const issue = p.issue as Issue
  if (!issue?.number || issue.pull_request) return
  const found = await pairOf(t, project, issue.number)
  const back = unfinished(found) ? found : !found || found.dead ? await earlier(t, project, issue.number, 'event') : null
  const pair = back ?? found

  if (p.action === 'deleted') {
    if (pair) {
      /* Its sub-issues are still there on GitHub, standing alone now, so
         their tasks stand alone here rather than going with it — paired
         under this link or an earlier one of the same repository here. */
      const kids = await withActor(
        t.linked_by,
        t.workspace_id,
        (tx) => tx<{ id: string }[]>`
          select k.id from task k
          join github_issue g on g.task_id = k.id
          join github_link was on was.id = g.link_id
          join github_link cur on cur.id = ${t.link_id}
          where k.parent_id = ${pair.task_id} and k.deleted_at is null
            and was.repo_id = cur.repo_id and was.project_id = cur.project_id`,
      )
      let stuck = false
      for (const k of kids) {
        const r = await rest(t.linked_by, t.workspace_id, 'PATCH', `/tasks/${k.id}`, { parent_id: null })
        if (r.status !== 200) {
          stuck = true
          continue
        }
        await withActor(
          t.linked_by,
          t.workspace_id,
          (tx) => tx`update github_issue set parent_number = null, parent_here = null where task_id = ${k.id}`,
        )
      }
      /* Deleting a task takes every subtask with it, so one that could not
         be let go keeps its parent: the parent stays, unpaired, and says
         why, rather than a sub-issue's task going with an issue it was
         never part of on GitHub any more. */
      if (stuck) {
        await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${pair.task_id}`)
        await rest(t.linked_by, t.workspace_id, 'POST', `/tasks/${pair.task_id}/comments`, {
          body: plainDoc(
            `Its issue #${issue.number} was deleted on GitHub. It is kept here because one of its subtasks couldn’t be made a task of its own; delete it when that is sorted.`,
          ),
          said_as: 'GitHub',
        })
        return
      }
      await rest(t.linked_by, t.workspace_id, 'DELETE', `/tasks/${pair.task_id}`)
      await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${pair.task_id}`)
    }
    return
  }
  if (p.action === 'transferred') {
    if (pair) await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${pair.task_id}`)
    return
  }
  if (!pair) {
    await taskFrom(t, project, issue)
    return
  }
  if (back) await reattach(t, project, back, issue, 'event')
  else await apply(t, project, pair, issue)
}

/** A task for an issue nobody has paired yet, and its comments. */
async function taskFrom(t: Target, project: string, issue: Issue): Promise<string | null> {
  const lists = await listsOf(t.linked_by, t.workspace_id, project)
  const folks = await people(t.workspace_id)
  const assignees = (issue.assignees ?? []).flatMap((a) => folks.filter((f) => f.github_id === String(a.id)).map((f) => f.actor_id))
  const list =
    issue.state === 'closed'
      ? firstWith(lists, issue.state_reason === 'not_planned' ? 'stopped' : 'done', 'done')
      : /* Opened on GitHub, it waits in Triage when the project has one —
           the server puts it there for a change GitHub caused. */
        lists.some((l) => l.intake)
        ? null
        : firstWith(lists, 'open', 'backlog')
  const made = await rest<{ id: string }>(t.linked_by, t.workspace_id, 'POST', `/projects/${project}/tasks`, {
    title: issue.title.slice(0, 300) || `#${issue.number}`,
    body: await inDoc(t, issue.body, project, undefined, trusted(issue)),
    ...(list ? { list_id: list } : {}),
    assignee_ids: assignees,
    labels: await labelIds(t, project, labelNames(issue)),
  })
  if (made.status !== 201) {
    console.log(`github: issue #${issue.number} not made a task, ${made.status}`)
    return null
  }
  const here = (await taskBody(t, made.body.id)) ?? ''
  const paired = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`
    insert into github_issue (workspace_id, project_id, link_id, task_id, number, issue_id, seen)
    values (${t.workspace_id}, ${project}, ${t.link_id}, ${made.body.id}, ${issue.number}, ${issue.id ?? null},
            ${tx.json({ ...seenOf(issue), here } as never)})
    on conflict do nothing
    returning 1`,
  )
  /* Somebody paired the issue in the meantime — the same event twice, or
     the import beside it: the task just made would be a second one, with
     no issue, so it goes (as GitHub's, which is not sent back). */
  if (!paired.length) {
    const gone = await rest(t.linked_by, t.workspace_id, 'DELETE', `/tasks/${made.body.id}`)
    if (gone.status !== 200) console.error(`github: task ${made.body.id} made twice for #${issue.number}, not removed: ${gone.status}`)
    return (await pairOf(t, project, issue.number))?.task_id ?? null
  }
  return made.body.id
}

/** What changed on GitHub since it last said, onto the task. */
async function apply(t: Target, project: string, pair: Pair, issue: Issue): Promise<void> {
  const was = pair.seen
  const now = seenOf(issue)
  const patch: Record<string, unknown> = {}
  if (now.title !== was.title) patch.title = now.title
  if (now.body !== was.body) {
    /* Both sides wrote since the last sync: GitHub's is the later, and ours
       is kept as a comment rather than lost. */
    const here = await taskBody(t, pair.task_id)
    if (here !== null && here !== (was.here ?? was.body ?? '') && here !== now.body) {
      await rest(t.linked_by, t.workspace_id, 'POST', `/tasks/${pair.task_id}/comments`, {
        body: await readMarkdownOrPlain(`Edited on GitHub and here at the same time — this was replaced:\n\n${here}`),
      })
    }
    patch.body = (await inDoc(t, now.body, project, await picturesOn(t, pair.task_id), trusted(issue))) ?? { type: 'doc', content: [] }
  }
  let left: string | null | undefined
  /* A subtask lives in its parent's list, so closing its issue ticks it
     rather than moving it. */
  const under = (now.state !== was.state || now.reason !== was.reason) && (await taskParent(t, pair.task_id))
  if (under) {
    if (now.state !== was.state) patch.completed = now.state === 'closed'
  } else if (now.state !== was.state || now.reason !== was.reason) {
    const lists = await listsOf(t.linked_by, t.workspace_id, project)
    if (now.state === 'closed') {
      const to = firstWith(lists, now.reason === 'not_planned' ? 'stopped' : 'done', 'done')
      if (to) {
        left = await taskList(t, pair.task_id)
        patch.list_id = to
      }
    } else {
      const back = pair.left_list && lists.some((l) => l.id === pair.left_list) ? pair.left_list : firstWith(lists, 'open', 'backlog')
      if (back) patch.list_id = back
      left = null
    }
  }
  if (JSON.stringify(now.assignees) !== JSON.stringify(was.assignees)) {
    const folks = await people(t.workspace_id)
    const fromGithub = (issue.assignees ?? []).flatMap((a) => folks.filter((f) => f.github_id === String(a.id)).map((f) => f.actor_id))
    /* Somebody here with no GitHub cannot be on the issue, and is not a
       reason to take them off the task. */
    const linked = new Set(folks.map((f) => f.actor_id))
    const kept = (await taskAssignees(t, pair.task_id)).filter((a) => !linked.has(a))
    patch.assignee_ids = [...new Set([...fromGithub, ...kept])].slice(0, 10)
  }
  if (JSON.stringify((now.labels ?? []).map((x) => x.toLowerCase())) !== JSON.stringify((was.labels ?? []).map((x) => x.toLowerCase()))) {
    patch.labels = await labelIds(t, project, now.labels ?? [])
  }
  if (Object.keys(patch).length) await rest(t.linked_by, t.workspace_id, 'PATCH', `/tasks/${pair.task_id}`, patch)
  const drawn = patch.body ? ((await taskBody(t, pair.task_id)) ?? '') : was.here
  if (drawn !== undefined) now.here = drawn
  if (was.reattach) now.reattach = was.reattach
  await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`
    update github_issue set seen = ${tx.json(now as never)}, synced_at = now(),
      issue_id = coalesce(issue_id, ${issue.id ?? null}),
      left_list = case when ${left === undefined} then left_list else ${left ?? null}::uuid end
    where task_id = ${pair.task_id}`,
  )
}

/* The pictures a task's description already holds, by where they came from. */
async function picturesOn(t: Target, task: string): Promise<Map<string, string>> {
  const [r] = await withActor(t.linked_by, t.workspace_id, (tx) => tx<{ body: Node | null }[]>`select body from task where id = ${task}`)
  const out = new Map<string, string>()
  for (const n of r?.body?.content ?? []) {
    if (n.type === 'attachment' && typeof n.attrs?.source === 'string' && typeof n.attrs?.fileId === 'string')
      out.set(n.attrs.source, n.attrs.fileId)
  }
  return out
}

async function taskBody(t: Target, task: string): Promise<string | null> {
  const [r] = await withActor(t.linked_by, t.workspace_id, (tx) => tx<{ body: unknown }[]>`select body from task where id = ${task}`)
  return r ? outText(t, r.body) : null
}
async function taskParent(t: Target, task: string): Promise<string | null> {
  const [r] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ parent_id: string | null }[]>`select parent_id from task where id = ${task}`,
  )
  return r?.parent_id ?? null
}
async function taskList(t: Target, task: string): Promise<string | null> {
  const [r] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ list_id: string | null }[]>`select list_id from task where id = ${task}`,
  )
  return r?.list_id ?? null
}
async function taskAssignees(t: Target, task: string): Promise<string[]> {
  const [r] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ assignee_ids: string[] }[]>`select assignee_ids from task where id = ${task}`,
  )
  return r?.assignee_ids ?? []
}

type GhComment = { id: number; body: string | null; user: { id: number; login: string; type?: string }; author_association?: string }

/** A comment on an issue: made, changed or withdrawn on its task. */
export async function fromComment(project: string, p: Record<string, any>): Promise<void> {
  const t = await target(project)
  if (!t) return
  const issue = p.issue as Issue
  if (!issue?.number || issue.pull_request) return
  const c = p.comment as GhComment
  if (!c?.id) return
  let pair = await pairOf(t, project, issue.number)
  if (!pair || pair.dead || unfinished(pair)) {
    const back = unfinished(pair) ? pair : await earlier(t, project, issue.number, 'event')
    if (back) {
      await reattach(t, project, back, issue, 'event')
      pair = back
    }
    if (!pair) return
  }
  const [mine] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) =>
      tx<{ comment_id: string; seen_body: string | null; author_id: string; author_github_id: string | null }[]>`
      select g.comment_id, g.seen_body, c.author_id, g.author_github_id::text from github_comment g join comment c on c.id = g.comment_id
      where g.workspace_id = ${t.workspace_id} and g.github_id = ${c.id}`,
  )
  /* A paired comment changes or goes here only when its own author did it
     there. Somebody else with the rights to edit it on GitHub — the app's
     own "X on Tuff" comments included — is not who it says here, and their
     words are not put under the author's name. */
  if (
    mine &&
    (p.action === 'edited' || p.action === 'deleted') &&
    (!mine.author_github_id || String(p.sender?.id) !== mine.author_github_id)
  )
    return
  if (p.action === 'deleted') {
    if (mine) await rest(mine.author_id, t.workspace_id, 'DELETE', `/comments/${mine.comment_id}`).catch(() => null)
    return
  }
  const body = (c.body ?? '').trim()
  if (mine) {
    if (body === (mine.seen_body ?? '')) return // our own, come back
    await rest(mine.author_id, t.workspace_id, 'PATCH', `/comments/${mine.comment_id}`, { body: await inDoc(t, body, project) })
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`update github_comment set seen_body = ${body} where comment_id = ${mine.comment_id}`,
    )
    return
  }
  if (c.user?.type === 'Bot') return
  await commentHere(t, project, pair.task_id, c)
}

/** A GitHub comment said here: as its author when they are somebody here, else under their login. */
async function commentHere(t: Target, project: string, task: string, c: GhComment): Promise<void> {
  const folks = await people(t.workspace_id)
  const who = folks.find((f) => f.github_id === String(c.user.id))
  const body = (c.body ?? '').trim()
  const said = (await inDoc(t, body, project, undefined, trusted(c))) ?? plainDoc('')
  const made = who
    ? await rest<{ id: string }>(who.actor_id, t.workspace_id, 'POST', `/tasks/${task}/comments`, { body: said })
    : await rest<{ id: string }>(t.linked_by, t.workspace_id, 'POST', `/tasks/${task}/comments`, {
        body: said,
        said_as: `@${c.user.login}`,
      })
  if (made.status !== 201) return
  await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`
    insert into github_comment (workspace_id, project_id, comment_id, github_id, seen_body, author_github_id)
    values (${t.workspace_id}, ${project}, ${made.body.id}, ${c.id}, ${body}, ${c.user.id}) on conflict do nothing`,
  )
}

/* ----------------------------------------------------------- to GitHub */

type Job = { id: string; workspace_id: string; project_id: string; kind: string; object_id: string; actor_id: string }

export async function githubOut(n = 10): Promise<number> {
  const jobs = await asWorker((tx) => tx<Job[]>`select * from github_out_claim(${n})`)
  for (const j of jobs) {
    try {
      const t = await target(j.project_id)
      /* Done, with what an import could not bring across said beside it. */
      let said: string | null = null
      if (t) {
        if (j.kind === 'import') said = await importIssues(t, j.project_id)
        else if (j.kind === 'gone') await gone(t, j.object_id)
        else await toIssue(t, j.project_id, j.object_id)
      }
      await asWorker((tx) => tx`select github_out_done(${j.id}, ${said}, false)`)
    } catch (e) {
      const said = e instanceof Error ? e.message : String(e)
      const retry = e instanceof Later
      if (!retry) console.error('github: could not send', j.kind, j.object_id, said)
      await asWorker((tx) => tx`select github_out_done(${j.id}, ${said}, ${retry})`)
    }
  }
  return jobs.length
}

type TaskNow = {
  id: string
  title: string
  body: unknown
  parent_id: string | null
  completed_at: string | null
  deleted_at: string | null
  icon: string | null
  assignee_ids: string[]
  labels: string[]
}

/**
 * A task's newest state, onto its issue — made if it has none — and where
 * it sits: a subtask's issue a sub-issue of its parent's.
 *
 * A subtask whose parent has no issue yet gives its parent one first, so
 * there is something to be under (`up`); a task given its issue gives its
 * subtasks theirs (`down`). Neither goes further than the one step.
 */
async function toIssue(
  t: Target,
  project: string,
  taskId: string,
  how: { up?: boolean; down?: boolean; reattaching?: boolean } = {},
): Promise<void> {
  const { up = true, down = true, reattaching = false } = how
  const parent = await taskParent(t, taskId)
  if (parent && up && !(await pairHere(t, parent))) await toIssue(t, project, parent, { up: false, down: false })
  await fieldsOut(t, project, taskId, reattaching)
  await nest(t, project, taskId)
  if (!parent && down) {
    const kids = await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx<{ id: string }[]>`
        select k.id from task k
        left join github_issue g on g.task_id = k.id and g.link_id = ${t.link_id}
        where k.parent_id = ${taskId} and k.project_id = ${project} and k.deleted_at is null
          /* Never paired and made since sub-issues were on for this link —
             an older subtask goes when it is itself written, not when its
             parent is (a decision, as Linear does) — or paired
             and not yet under this one's issue, a parent that had none until
             now. One paired under a link that has gone is found by its own
             issue, not from here; one GitHub refused within the
             hour is not offered again. */
          and ((not exists (select 1 from github_issue h where h.task_id = k.id)
                and k.created_at >= (select sub_issues_since from github_link where id = ${t.link_id}))
               or (g.task_id is not null and g.parent_here is distinct from k.parent_id
                   and (g.nest_refused_at is null or g.nest_refused_at < now() - interval '1 hour')))
        order by k.sort_key`,
    )
    if (kids.length && (await pairHere(t, taskId))) {
      for (const k of kids) await toIssue(t, project, k.id, { up: false, down: false })
    }
  }
}

/* A task's pairing under the link as it is now. */
async function pairHere(t: Target, task: string): Promise<Pair | null> {
  const [p] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<Pair[]>`
      select g.task_id, g.number, g.seen, g.left_list, k.deleted_at is not null as dead,
             g.issue_id::text, g.parent_number, g.parent_here, g.nest_said
      from github_issue g join task k on k.id = g.task_id
      where g.task_id = ${task} and g.link_id = ${t.link_id}`,
  )
  return p ?? null
}

async function fieldsOut(t: Target, project: string, taskId: string, reattaching = false): Promise<void> {
  const [task] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) =>
      tx<TaskNow[]>`
      select t.id, t.title, t.body, t.parent_id, t.completed_at, t.deleted_at, l.icon, t.assignee_ids,
             coalesce((select array_agg(lb.name::text order by lb.name) from task_label tl join label lb on lb.id = tl.label_id
                       where tl.task_id = t.id and lb.deleted_at is null), '{}') as labels
      from task t left join task_list l on l.id = t.list_id
      where t.id = ${taskId} and t.project_id = ${project}`,
  )
  if (!task || task.deleted_at) return
  const folks = await people(t.workspace_id)
  const logins = task.assignee_ids.flatMap((a) => folks.filter((f) => f.actor_id === a).map((f) => f.login))
  /* A subtask sits in its parent's list and is finished by its tick, so
     its issue is closed by that, not by where its parent is. */
  const state: 'open' | 'closed' = task.parent_id
    ? task.completed_at
      ? 'closed'
      : 'open'
    : task.icon === 'done' || task.icon === 'stopped'
      ? 'closed'
      : 'open'
  const reason = state === 'closed' ? (task.icon === 'stopped' ? 'not_planned' : 'completed') : null
  const want: Seen = {
    title: task.title,
    body: await outText(t, task.body),
    state,
    reason,
    assignees: logins.sort(),
    labels: [...task.labels].sort(),
  }
  let pair = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<(Pair & { current: boolean; same: boolean })[]>`
      select g.task_id, g.number, g.seen, g.left_list, g.link_id = cur.id as current,
             (was.repo_id = cur.repo_id and was.project_id = cur.project_id) as same
      from github_issue g
      join github_link was on was.id = g.link_id
      join github_link cur on cur.id = ${t.link_id}
      where g.task_id = ${taskId}`,
  ).then((r) => r[0] ?? null)

  /* Paired under a link that has gone. Its number means nothing
     in another repository, where it used to be sent to whichever issue had
     it; there the task gets an issue of its own. In the same repository it
     is the task's issue again, unless another task here has it now. */
  /* Taken back and not finished — or not taken back yet: finished, or
     taken, here, with GitHub's issue as it is now. */
  const resume = pair && ((pair.current && unfinished(pair) && !reattaching) || (!pair.current && pair.same))
  if (pair && !pair.current && !pair.same) {
    await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${taskId}`)
    pair = null
  } else if (pair && resume) {
    /* Somebody else's issue now:'s duplicates. Left alone, not
       fought over; nothing is sent until that is mended. */
    if (!pair.current && (await heldElsewhere(t, project, taskId, pair.number))) {
      console.log(`github: task ${taskId} left unsynced, another task has #${pair.number} now`)
      return
    }
    /* Read before the pairing is taken back, so GitHub refusing for now
       leaves it as it was for the next try. */
    const issue = await gh<Issue>(t, `/repos/${t.repo_name}/issues/${pair.number}`).catch((e) => {
      if (e instanceof GithubRefused && (e.status === 404 || e.status === 410)) return null
      throw e
    })
    if (!issue) {
      await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${taskId}`)
      return
    }
    const back = pair.current ? pair : await earlier(t, project, pair.number, 'import', taskId)
    if (back) await reattach(t, project, back, issue, back.seen.reattach ?? 'import')
    return
  }

  if (!pair) {
    const path = `/repos/${t.repo_name}/issues`
    const made = await gh<Issue>(t, path, {
      method: 'POST',
      body: { title: want.title, body: want.body, assignees: want.assignees, labels: want.labels },
    }).catch((e) => {
      if (e instanceof GithubRefused && e.status === 422) {
        return gh<Issue>(t, path, { method: 'POST', body: { title: want.title, body: want.body, labels: want.labels } })
      }
      throw e
    })
    /* Paired the moment GitHub has made it, before anything else is asked
       of GitHub: a close refused for now (a rate limit) is retried on this
       pairing, where it used to make a second issue. What GitHub said is
       what is kept, so the close still owed is seen as owed. */
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`
      insert into github_issue (workspace_id, project_id, link_id, task_id, number, issue_id, seen)
      values (${t.workspace_id}, ${project}, ${t.link_id}, ${taskId}, ${made.number}, ${made.id ?? null},
              ${tx.json({ ...seenOf(made), here: want.body } as never)})
      on conflict do nothing`,
    )
    if (state === 'closed') {
      const closed = await gh<Issue>(t, `/repos/${t.repo_name}/issues/${made.number}`, {
        method: 'PATCH',
        body: { state, state_reason: reason },
      })
      await withActor(
        t.linked_by,
        t.workspace_id,
        (tx) => tx`
        update github_issue set seen = ${tx.json({ ...seenOf(closed), state, reason, here: want.body } as never)}
        where task_id = ${taskId} and link_id = ${t.link_id}`,
      )
    }
    await commentsOut(t, project, taskId, made.number)
    return
  }

  const was = pair.seen
  const send: Record<string, unknown> = {}
  if (want.title !== was.title) send.title = want.title
  if (want.body !== (was.here ?? was.body ?? '')) {
    /* GitHub's body moved on since we last saw it too: theirs is kept on the
       task as a comment, then ours goes over it. */
    const there = await gh<Issue>(t, `/repos/${t.repo_name}/issues/${pair.number}`)
    const theirs = (there.body ?? '').trim()
    if (theirs !== (was.body ?? '') && theirs !== want.body) {
      await rest(t.linked_by, t.workspace_id, 'POST', `/tasks/${taskId}/comments`, {
        body: await readMarkdownOrPlain(`Edited on GitHub and here at the same time — this was replaced:\n\n${theirs}`),
        said_as: 'GitHub',
      })
    }
    send.body = want.body
  }
  /* A subtask's tick has no reason in it: closed is closed, whichever
     GitHub says it was. */
  if (want.state !== was.state || (want.state === 'closed' && !task.parent_id && want.reason !== was.reason)) {
    send.state = want.state
    if (want.state === 'closed') send.state_reason = want.reason
  }
  /* People on the issue who are nobody here stay on it. */
  const ours = new Set(folks.map((f) => f.login))
  const assignees = [...new Set([...(want.assignees ?? []), ...(was.assignees ?? []).filter((l) => !ours.has(l))])].sort()
  if (JSON.stringify(assignees) !== JSON.stringify(was.assignees ?? [])) send.assignees = assignees
  /* Labels are matched by name whatever the case, as they are made: "Bug"
     here is "bug" there, and not a change. */
  const lower = (xs: string[] | undefined) => JSON.stringify((xs ?? []).map((x) => x.toLowerCase()).sort())
  if (lower(want.labels) !== lower(was.labels)) send.labels = want.labels
  if (Object.keys(send).length) {
    /* GitHub refuses an assignee who cannot be one there (no access to the
       repository); the rest still goes. */
    const path = `/repos/${t.repo_name}/issues/${pair.number}`
    const after = await gh<Issue>(t, path, { method: 'PATCH', body: send }).catch((e) => {
      if (e instanceof GithubRefused && e.status === 422 && send.assignees) {
        const { assignees: _drop, ...rest } = send
        return gh<Issue>(t, path, { method: 'PATCH', body: rest })
      }
      throw e
    })
    const seen = {
      ...seenOf(after),
      here: send.body !== undefined ? want.body : was.here,
      ...(was.reattach ? { reattach: was.reattach } : {}),
    }
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`
      update github_issue set seen = ${tx.json(seen as never)}, synced_at = now() where task_id = ${taskId}`,
    )
  }
  await commentsOut(t, project, taskId, pair.number)
}

/**
 * What was said here and not yet on GitHub, changed here, or withdrawn here.
 *
 * As its author — with their own token, in their name — only what they said
 * themselves: never an import's or a name from elsewhere (`said_as`), only
 * while they are in the workspace and on the project (`personToken`'s
 * `within`), and words changed since they were last sent only when the
 * change was theirs (`changed_by`). Anything else — somebody's words edited
 * or put back by the owner or whoever runs the project, an import, a person
 * who left — goes as the app, under their name, as for somebody who never
 * linked.
 */
async function commentsOut(t: Target, project: string, taskId: string, number: number): Promise<void> {
  const rows = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) =>
      tx<
        {
          id: string
          body: unknown
          hash: string
          author_id: string
          author_name: string
          changed_by: string | null
          origin: string
          said_as: string | null
          deleted_at: string | null
          github_id: string | null
          seen_body: string | null
          said_hash: string | null
          author_github_id: string | null
        }[]
      >`
      select c.id, c.body, md5(c.body::text) as hash, c.author_id, a.name as author_name, c.changed_by,
             c.origin::text, c.said_as, c.deleted_at,
             g.github_id::text, g.seen_body, g.said_hash, g.author_github_id::text
      from comment c join actor a on a.id = c.author_id
      left join github_comment g on g.comment_id = c.id
      where c.object_type = 'task' and c.object_id = ${taskId}
        /* Only what was said since the repository was linked: what people
           wrote before was not written for GitHub, and goes there under
           their names only by their saying so now. */
        and (c.created_at >= (select created_at from github_link where id = ${t.link_id}) or g.github_id is not null)
      order by c.created_at`,
  )
  const comments = `/repos/${t.repo_name}/issues/${number}/comments`
  for (const c of rows) {
    const body = await outText(t, c.body)
    if (c.github_id && c.deleted_at) {
      await gh(t, `/repos/${t.repo_name}/issues/comments/${c.github_id}`, { method: 'DELETE' }).catch(() => null)
      await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_comment where comment_id = ${c.id}`)
      continue
    }
    if (c.deleted_at || c.origin === 'github') continue
    const signed = `**${c.author_name}** on Tuff:\n\n${body}`
    const keep = (github: number | string, seen: string, by: number | null) =>
      withActor(
        t.linked_by,
        t.workspace_id,
        (tx) => tx`
        insert into github_comment (workspace_id, project_id, comment_id, github_id, seen_body, author_github_id, said_hash)
        values (${t.workspace_id}, ${project}, ${c.id}, ${github}, ${seen.trim()}, ${by}, ${c.hash})
        on conflict (comment_id) do update
          set github_id = excluded.github_id, seen_body = excluded.seen_body,
              author_github_id = excluded.author_github_id, said_hash = excluded.said_hash`,
      )
    /* Whether anybody changed the words since they were last sent. Not
       whether the Markdown reads differently: that moves by itself — a
       mention is `@login` while its person has linked and their name once
       they unlink or leave. A row from before `said_hash` counts a comment
       nobody has written to since (`changed_by` null) as unchanged. */
    const changed = !c.github_id || (c.said_hash ? c.said_hash !== c.hash : c.changed_by !== null)
    if (c.github_id && [body.trim(), signed.trim()].includes(c.seen_body ?? '')) {
      if (c.said_hash !== c.hash)
        await withActor(
          t.linked_by,
          t.workspace_id,
          (tx) => tx`
        update github_comment set said_hash = ${c.hash} where comment_id = ${c.id}`,
        )
      continue
    }
    /* As them only when the last change was theirs — whether or not the
       words changed since they were sent. Unchanged is not theirs: the
       owner's words the app edited into their comment, where GitHub would
       not take it down, are unchanged since; so is a row from before 292
       that the old sync wrote as them. Those are left as GitHub has them. */
    const theirs = c.origin !== 'import' && !c.said_as && c.changed_by === c.author_id
    const mine = theirs ? await personToken(c.author_id, { workspace: t.workspace_id, project }) : null
    /* GitHub busy or limiting is a retry of the whole job (`Later`); a
       refusal is an answer, and nothing is kept as sent that was not. */
    const refused = (e: unknown) => {
      if (e instanceof Later) throw e
      return false
    }
    const postAsApp = async () => (await gh<{ id: number }>(t, comments, { method: 'POST', body: { body: signed } })).id
    if (!c.github_id) {
      /* Theirs on GitHub when written as them; the app's otherwise, which
         nobody there can then change for them. */
      const made = mine
        ? await asPerson<{ id: number; user?: { id: number } }>(mine, comments, { method: 'POST', body: { body } }).then(
            (m) => ({ id: m.id, seen: body, by: m.user?.id ?? null }),
            async () => ({ id: await postAsApp(), seen: signed, by: null }),
          )
        : { id: await postAsApp(), seen: signed, by: null }
      await keep(made.id, made.seen, made.by)
      continue
    }
    const path = `/repos/${t.repo_name}/issues/comments/${c.github_id}`
    const patchAsApp = () => gh(t, path, { method: 'PATCH', body: { body: signed } }).then(() => true, refused)
    if (!c.author_github_id) {
      /* The app's own comment: the app changes it, under their name. */
      if (await patchAsApp()) await keep(c.github_id, signed, null)
    } else if (mine) {
      const done = await asPerson(mine, path, { method: 'PATCH', body: { body } }).then(() => true, refused)
      if (done) await keep(c.github_id, body, Number(c.author_github_id))
    } else if (!changed) {
      /* Unchanged since sent and reading differently now, with nobody to
         write it as — its author gone, or its last change not theirs: left
         as GitHub has it. */
    } else if (theirs) {
      /* Their own change, with no token to make it as them: their words,
         changed by the app, signed. */
      if (await patchAsApp()) await keep(c.github_id, signed, Number(c.author_github_id))
    } else {
      /* Theirs on GitHub, with words they did not write here. An edit by
         the app would still stand under their face, so theirs is taken
         down and the words posted by the app under their name; where
         GitHub refuses to take it down, the app edits it, signed — never
         in their name. */
      const down = await gh(t, path, { method: 'DELETE' }).then(
        () => true,
        (e) => refused(e) || (e instanceof GithubRefused && e.status === 404),
      )
      if (down) await keep(await postAsApp(), signed, null)
      else if (await patchAsApp()) await keep(c.github_id, signed, Number(c.author_github_id))
    }
  }
}

/**
 * A task deleted here: its issue closed as not planned, and said so — and
 * the issues of the subtasks that went with it, since deleting a task
 * deletes its subtasks.
 */
async function gone(t: Target, taskId: string): Promise<void> {
  const kids = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ id: string }[]>`
      select c.id from task c join task p on p.id = ${taskId}
      where c.parent_id = p.id and p.deleted_at is not null
        and c.deleted_at = p.deleted_at and c.deleted_by is not distinct from p.deleted_by`,
  )
  for (const k of kids) await closeAsGone(t, k.id)
  await closeAsGone(t, taskId)
}

async function closeAsGone(t: Target, taskId: string): Promise<void> {
  const [pair] = await withActor(
    t.linked_by,
    t.workspace_id,
    /* Only an issue of this repository, and only one no other task here
       has: a number from another repository is somebody else's
       issue, and an issue another task still holds — now, or under an
       earlier link of the same repository — is that task's to close. A
       duplicate deleted by hand does not close its original's issue. */
    (tx) => tx<{ number: number; held: boolean }[]>`
      select g.number, exists (
               select 1 from github_issue h
               join github_link hl on hl.id = h.link_id
               join task k on k.id = h.task_id
               where h.number = g.number and h.task_id <> g.task_id and h.project_id = cur.project_id
                 and hl.project_id = cur.project_id and hl.repo_id = cur.repo_id
                 and k.project_id = cur.project_id and k.deleted_at is null) as held
      from github_issue g
      join github_link was on was.id = g.link_id
      join github_link cur on cur.id = ${t.link_id}
      where g.task_id = ${taskId} and was.repo_id = cur.repo_id and was.project_id = cur.project_id`,
  )
  if (!pair) return
  /* Another live task's issue: not closed, and the deleted one lets go of
     it, so that task can take it back — a row left under a task in Trash
     held the issue for the thirty days it stays there. */
  if (pair.held) {
    await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${taskId}`)
    return
  }
  await gh(t, `/repos/${t.repo_name}/issues/${pair.number}/comments`, { method: 'POST', body: { body: 'Deleted in Tuff.' } })
  await gh(t, `/repos/${t.repo_name}/issues/${pair.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'not_planned' } })
  await withActor(t.linked_by, t.workspace_id, (tx) => tx`delete from github_issue where task_id = ${taskId}`)
}

/** Linking with issues: the repository's open issues, oldest first, with their comments. */
async function importIssues(t: Target, project: string): Promise<string | null> {
  const missed: string[] = []
  /* Issues with sub-issues, for what they hold once every open one is a
     task. */
  const parents: number[] = []
  /* Every page read before anything is done: taking an issue back can close
     it (its task was finished), and the open ones counted again from the
     start would move the next page past as many as were closed. */
  const all: Issue[] = []
  for (let page = 1; page <= 50; page++) {
    const issues = await gh<Issue[]>(t, `/repos/${t.repo_name}/issues?state=open&sort=created&direction=asc&per_page=100&page=${page}`)
    all.push(...issues)
    if (issues.length < 100) break
  }
  for (const issue of all) {
    if (issue.pull_request) continue
    /* Asked of every issue only when GitHub does not say how many it holds. */
    if ((issue.sub_issues_summary?.total ?? 1) > 0) parents.push(issue.number)
    try {
      const pair = await pairOf(t, project, issue.number)
      /* A re-attach GitHub refused halfway, finished now. */
      if (unfinished(pair)) await reattach(t, project, pair, issue, pair.seen.reattach)
      if (pair && !pair.dead) continue
      /* Already a task's, before the repository was linked again: that
         task, not a second one. */
      const back = await earlier(t, project, issue.number, 'import')
      if (back) {
        await reattach(t, project, back, issue, 'import')
        continue
      }
      /* Its task is in Trash and nobody takes it back: left with it. */
      if (pair) continue
      const task = await taskFrom(t, project, issue)
      if (!task) continue
      const comments = await gh<GhComment[]>(t, `/repos/${t.repo_name}/issues/${issue.number}/comments?per_page=100`)
      for (const c of comments) if (c.user?.type !== 'Bot') await commentHere(t, project, task, c)
    } catch (e) {
      /* Worth another try: the whole import is tried again, and what was
         done is found done. Anything else is this issue's alone, and the
         rest still come across. */
      if (e instanceof Later) throw e
      const said = `#${issue.number}: ${e instanceof Error ? e.message : String(e)}`
      console.error('github: issue not brought across', said)
      missed.push(said)
    }
  }
  await importNesting(t, project, parents)
  /* Kept on the job, for whoever has to find out why one did not come. */
  return missed.length ? `not brought across: ${missed.join('; ').slice(0, 2000)}` : null
}

/* Which of these GitHub comments are already paired with one here. */
async function pairedComments(t: Target, ids: number[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ github_id: string }[]>`
      select github_id::text from github_comment where workspace_id = ${t.workspace_id} and github_id = any(${ids}::bigint[])`,
  )
  return new Set(rows.map((r) => r.github_id))
}

/* Whether another task here has that issue under the current link. */
async function heldElsewhere(t: Target, project: string, taskId: string, number: number): Promise<boolean> {
  const rows = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`
      select 1 from github_issue h join task k on k.id = h.task_id
      where h.link_id = ${t.link_id} and h.project_id = ${project} and h.number = ${number} and h.task_id <> ${taskId}
        and k.deleted_at is null`,
  )
  return rows.length > 0
}

/* ---------------------------------------------------------- sub-issues */

/*
 * A subtask is a sub-issue.
 *
 * Nesting is one more field, settled as the others are: the later write
 * wins. From here, a move is told by `parent_here` — the task's parent at
 * the last sync — so a sync that finds the task where it was sends nothing
 * about nesting, and nesting only GitHub has (an issue under another
 * repository's, or deeper than one level) is left alone there. From
 * GitHub, an event puts the task under its parent's task through the same
 * endpoint a person uses; what Tuff cannot hold is said on the task, once.
 */

/* Whether an issue is in this link's repository, by the address it says it
   is at. Strict: an issue that does not say is not taken for ours. */
const sameRepo = (t: Target, i: Issue | null | undefined) =>
  Boolean(i?.repository_url) && i!.repository_url!.toLowerCase().endsWith(`/repos/${t.repo_name.toLowerCase()}`)

/* What GitHub has an issue under now: its number when that is an issue of
   this repository, or that it is under another repository's. */
async function githubParent(t: Target, number: number): Promise<{ number: number | null; elsewhere: boolean }> {
  const up = await gh<Issue>(t, `/repos/${t.repo_name}/issues/${number}/parent`).catch((e) => {
    if (e instanceof GithubRefused && (e.status === 404 || e.status === 410)) return null
    throw e
  })
  if (!up) return { number: null, elsewhere: false }
  return sameRepo(t, up) ? { number: up.number, elsewhere: false } : { number: null, elsewhere: true }
}

/*
 * Out from under the issue it was last seen under. That can be stale —
 * moved on GitHub by an event we never had — and a 404 then means "not
 * under that one", not "under nothing": what it is under now is asked,
 * and it is taken out from under that, unless that is another
 * repository's. What it is under afterwards is answered.
 */
async function unNest(t: Target, pair: Pair, from: number): Promise<void> {
  const id = await issueIdOf(t, pair)
  const out = (parent: number) =>
    gh(t, `/repos/${t.repo_name}/issues/${parent}/sub_issue`, { method: 'DELETE', body: { sub_issue_id: id } }).then(
      () => true,
      (e) => {
        if (e instanceof GithubRefused && (e.status === 404 || e.status === 410)) return false
        throw e
      },
    )
  if (await out(from)) return
  const now = await githubParent(t, pair.number)
  if (now.number !== null && now.number !== from) await out(now.number)
}

/* GitHub's id for a paired issue, asked once and kept. */
async function issueIdOf(t: Target, pair: Pair): Promise<number> {
  if (pair.issue_id) return Number(pair.issue_id)
  const issue = await gh<Issue>(t, `/repos/${t.repo_name}/issues/${pair.number}`)
  if (!issue.id) throw new Error(`issue #${pair.number} came without its id`)
  await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`update github_issue set issue_id = ${issue.id!} where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
  )
  return issue.id
}

/* Said on the task as GitHub, once for each thing that could not be done. */
async function sayOnTask(t: Target, pair: Pair, text: string): Promise<void> {
  if (pair.nest_said === text) return
  await rest(t.linked_by, t.workspace_id, 'POST', `/tasks/${pair.task_id}/comments`, {
    body: plainDoc(text),
    said_as: 'GitHub',
  })
  await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx`update github_issue set nest_said = ${text} where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
  )
}

const notUnder = (parent: number, said: string | null) =>
  `GitHub wouldn’t put this issue under #${parent}${said ? ` (“${said}”)` : ''}. GitHub allows 100 sub-issues under one issue, eight levels deep. Here it is still a subtask; on GitHub its issue stays where it was.`

/**
 * Where a task sits, onto its issue: under its parent's issue, or standing
 * alone. `force` is for a link made again — the task wins, so what GitHub
 * has now is asked and the task's nesting put over it, but for an issue
 * under another repository's, which is not ours to take away.
 */
async function nest(t: Target, project: string, taskId: string, force = false): Promise<void> {
  const [row] = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<(Pair & { parent_id: string | null; deleted: boolean; refused: number | null; refused_lately: boolean })[]>`
      select g.task_id, g.number, g.seen, g.left_list, g.issue_id::text, g.parent_number, g.parent_here, g.nest_said,
             k.parent_id, k.deleted_at is not null as deleted, g.nest_refused_number as refused,
             coalesce(g.nest_refused_at > now() - interval '1 hour', false) as refused_lately
      from github_issue g join task k on k.id = g.task_id
      where g.task_id = ${taskId} and g.link_id = ${t.link_id} and k.project_id = ${project}`,
  )
  if (!row || row.deleted) return
  let there = row.parent_number
  let elsewhere = false
  if (force) {
    const up = await githubParent(t, row.number)
    elsewhere = up.elsewhere
    there = up.number
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`update github_issue set parent_number = ${there} where task_id = ${taskId} and link_id = ${t.link_id}`,
    )
  } else if (row.parent_id === row.parent_here) return // nothing moved here since the last sync

  const mark = (sets: { parent_number?: number | null; nest_said?: null }) =>
    withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`
      update github_issue set parent_here = ${row.parent_id},
        parent_number = case when ${'parent_number' in sets} then ${sets.parent_number ?? null}::int else parent_number end,
        nest_said = case when ${'nest_said' in sets} then null else nest_said end,
        nest_refused_number = null, nest_refused_at = null
      where task_id = ${taskId} and link_id = ${t.link_id}`,
    )
  const held = row.parent_id ? await pairHere(t, row.parent_id) : null
  const parentPair = held && !held.dead ? held : null
  /* A parent with no issue (its own refused): this one's issue stands
     alone, as Linear's does under a parent that is not synced — and
     `parent_here` is left behind, so it is tried again on the next sync. */
  if (row.parent_id && !parentPair) return
  const want = parentPair?.number ?? null

  if (want === there) return void (await mark({ nest_said: null }))
  if (want === null) {
    /* Standing alone here, under another repository's issue there. */
    if (elsewhere || there === null) return void (await mark({}))
    await unNest(t, row, there)
    await mark({ parent_number: null })
    return
  }
  /* Refused under this same issue within the hour: not asked again on
     every write of it or of its parent. Under another, asked at once. */
  if (row.refused === want && row.refused_lately) return
  const id = await issueIdOf(t, row)
  try {
    await gh(t, `/repos/${t.repo_name}/issues/${want}/sub_issues`, {
      method: 'POST',
      body: { sub_issue_id: id, replace_parent: true },
    })
  } catch (e) {
    /* Over GitHub's limits — a hundred under one issue, eight levels — or
       refused for a reason of its own: said on the task, remembered, and
       tried again on a write an hour or more later. */
    if (e instanceof GithubRefused && (e.status === 422 || e.status === 400)) {
      await withActor(
        t.linked_by,
        t.workspace_id,
        (tx) => tx`
        update github_issue set nest_refused_number = ${want}, nest_refused_at = now()
        where task_id = ${taskId} and link_id = ${t.link_id}`,
      )
      await sayOnTask(t, row, notUnder(want, e.said))
      return
    }
    throw e
  }
  await mark({ parent_number: want, nest_said: null })
  await order(t, row.parent_id!, taskId, want, id)
}

/* In its parent's order: GitHub puts a new sub-issue last, which is right
   for a subtask made last and wrong for one moved in among others. */
async function order(t: Target, parent: string, taskId: string, number: number, id: number): Promise<void> {
  const sibs = await withActor(
    t.linked_by,
    t.workspace_id,
    (tx) => tx<{ id: string; issue_id: string }[]>`
      select k.id, g.issue_id::text from task k
      join github_issue g on g.task_id = k.id and g.link_id = ${t.link_id}
      where k.parent_id = ${parent} and k.deleted_at is null and g.parent_number = ${number} and g.issue_id is not null
      order by k.sort_key, k.id`,
  )
  const at = sibs.findIndex((s) => s.id === taskId)
  if (at < 0 || at === sibs.length - 1) return
  const before = sibs[at - 1]
  await gh(t, `/repos/${t.repo_name}/issues/${number}/sub_issues/priority`, {
    method: 'PATCH',
    body: before
      ? { sub_issue_id: id, after_id: Number(before.issue_id) }
      : { sub_issue_id: id, before_id: Number(sibs[at + 1]!.issue_id) },
  }).catch(() => null)
}

/**
 * A task put under another here because GitHub said so — or out from
 * under it — through the same endpoint a person uses. Tuff keeps subtasks
 * one level deep; nesting it cannot hold is left as GitHub has it, and
 * said on the task.
 */
async function underHere(t: Target, pair: Pair, parent: Pair | null): Promise<void> {
  const to = parent?.task_id ?? null
  const now = await taskParent(t, pair.task_id)
  const record = (here: string | null) =>
    withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`
      update github_issue set parent_number = ${parent?.number ?? null}, parent_here = ${here},
        nest_said = case when ${here === to} then null else nest_said end
      where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
    )
  if (now === to) return void (await record(to))
  const r = await rest<{ error?: { code?: string; message?: string } }>(t.linked_by, t.workspace_id, 'PATCH', `/tasks/${pair.task_id}`, {
    parent_id: to,
  })
  if (r.status === 200) return void (await record(to))
  /* What GitHub says stays what GitHub said; the task stays where it is. */
  await record(now)
  if (parent) {
    await sayOnTask(
      t,
      pair,
      r.body?.error?.code === 'nested'
        ? r.body.error.message?.includes('with subtasks')
          ? `On GitHub this issue is now under #${parent.number}. Here it has subtasks of its own, and Tuff keeps subtasks one level deep, so it stays where it was.`
          : `On GitHub this issue is now under #${parent.number}. Tuff keeps subtasks one level deep, so here it stays where it was.`
        : `On GitHub this issue is now under #${parent.number}, and here it couldn’t be made that task’s subtask${r.body?.error?.message ? ` (“${r.body.error.message}”)` : ''}.`,
    )
  }
}

/*
 * A re-attached issue's nesting, by the rule an event's re-attach has for
 * every field: what GitHub changed since the last sync comes to
 * the task, and then what changed here goes to GitHub. Moved on GitHub —
 * its parent now is not the one it was last seen under — the task follows,
 * as far as Tuff can hold it; otherwise the task's nesting is sent as usual.
 */
async function nestFromGithub(t: Target, project: string, pair: Pair): Promise<void> {
  const now = await githubParent(t, pair.number)
  if (now.elsewhere) {
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`update github_issue set parent_number = null where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
    )
    return
  }
  if (now.number === pair.parent_number) return
  const found = now.number === null ? null : await pairOf(t, project, now.number)
  const parent = found && !found.dead ? found : null
  if (now.number !== null && !parent) {
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`update github_issue set parent_number = ${now.number} where task_id = ${pair.task_id} and link_id = ${t.link_id}`,
    )
    return
  }
  await underHere(t, pair, parent)
}

/** A sub-issue added or removed on GitHub: a subtask made, moved or let go here. */
export async function fromSubIssue(project: string, p: Record<string, any>): Promise<void> {
  const t = await target(project)
  if (!t) return
  /* Our own, come back as the app — and only ours: another app moving
     sub-issues (an automation of the team's) is somebody's change. */
  if (p.sender?.type === 'Bot' && p.sender?.login === `${await appSlug()}[bot]`) return
  const added = p.action === 'sub_issue_added' || p.action === 'parent_issue_added'
  const removed = p.action === 'sub_issue_removed' || p.action === 'parent_issue_removed'
  if (!added && !removed) return
  const child = p.sub_issue as Issue | undefined
  const parent = p.parent_issue as Issue | undefined
  if (!child?.number || !parent?.number || child.pull_request) return
  /*
   * Which side is in this repository. The event is delivered to one of the
   * two: told from the parent's side, the parent is in the repository it
   * came to and the sub-issue's is named (`sub_issue_repo`); from the
   * sub-issue's side, the other way. The named one is believed by its id;
   * when it is not named, only by the address the issue says it is at — a
   * payload that says neither is not taken for ours.
   */
  const parentSide = p.action === 'sub_issue_added' || p.action === 'sub_issue_removed'
  const ours = Number(p.repository?.id)
  if (!ours) return
  const named = (repo: { id?: unknown } | undefined, i: Issue) => (repo?.id != null ? Number(repo.id) === ours : sameRepo(t, i))
  const childOurs = parentSide ? named(p.sub_issue_repo, child) : true
  const parentOurs = parentSide ? true : named(p.parent_issue_repo, parent)
  /* Another repository's issue under one of ours is not ours to keep. */
  if (!childOurs) return

  const found = await pairOf(t, project, child.number)
  const back = unfinished(found) ? found : !found || found.dead ? await earlier(t, project, child.number, 'event') : null
  if (back) {
    /* Re-attached by this event (or a re-attach finished): it reads where
       GitHub has the issue now and settles it, which is newer than what
       this event says. */
    await reattach(t, project, back, child, 'event')
    return
  }
  /* Its task is in Trash and nobody takes it back: left with it. */
  if (found?.dead) return
  let pair = found
  const parentFound = parentOurs ? await pairOf(t, project, parent.number) : null
  /* A parent whose task is in Trash is no task to be under. */
  const parentPair = parentFound && !parentFound.dead ? parentFound : null
  if (added) {
    /* Under another repository's issue, or one this project does not
       have: the task stands on its own here, as Linear's would. */
    if (!parentPair) {
      if (pair) {
        const kept = pair
        await withActor(
          t.linked_by,
          t.workspace_id,
          (tx) => tx`
          update github_issue set parent_number = ${parentOurs ? parent.number : null}
          where task_id = ${kept.task_id} and link_id = ${t.link_id}`,
        )
      }
      return
    }
    if (!pair) {
      await taskFrom(t, project, child)
      pair = await pairOf(t, project, child.number)
      if (!pair) return
    }
    await underHere(t, pair, parentPair)
    return
  }
  if (!pair || !parentOurs) return
  const kept = pair
  /* Only out from under that one: an event late for a parent it has
     since left changes nothing. */
  if (parentPair && (await taskParent(t, kept.task_id)) === parentPair.task_id) await underHere(t, kept, null)
  else if (kept.parent_number === parent.number) {
    await withActor(
      t.linked_by,
      t.workspace_id,
      (tx) => tx`update github_issue set parent_number = null where task_id = ${kept.task_id} and link_id = ${t.link_id}`,
    )
  }
}

/*
 * On first link: what the open issues are under, among themselves. An
 * issue re-attached to its task under this link (`reattached_link`, kept
 * on the row so an import retried half-way still knows) is skipped: the
 * task's nesting won there already.
 */
async function importNesting(t: Target, project: string, parents: number[]): Promise<void> {
  for (const number of parents) {
    const parentPair = await pairOf(t, project, number)
    if (!parentPair || parentPair.dead) continue
    for (let page = 1; page <= 10; page++) {
      const subs = await gh<Issue[]>(t, `/repos/${t.repo_name}/issues/${number}/sub_issues?per_page=100&page=${page}`)
      for (const c of subs) {
        if (!sameRepo(t, c)) continue
        const [pair] = await withActor(
          t.linked_by,
          t.workspace_id,
          (tx) => tx<(Pair & { kept: boolean })[]>`
            select g.task_id, g.number, g.seen, g.left_list, g.issue_id::text, g.parent_number, g.parent_here, g.nest_said,
                   g.reattached_link is not distinct from ${t.link_id} as kept
            from github_issue g join task k on k.id = g.task_id
            where g.link_id = ${t.link_id} and g.number = ${c.number} and k.deleted_at is null`,
        )
        if (pair && !pair.kept) await underHere(t, pair, parentPair)
      }
      if (subs.length < 100) break
    }
  }
}
