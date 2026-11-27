import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { excerptOf, EXCERPT_MOST } from '@tracker/shared-schema'
import { app } from '../src/http/routes.js'
import { asTableOwner, closeDb, makeOwner, makeProject } from './helpers.js'

/**
 * The start of a task's description on its row — `excerpt` on
 * `GET /api/projects/:id/tasks`.
 */
after(closeDb)

type Row = { id: string; title: string; excerpt?: string | null }

const call = (path: string, token: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
const rows = async (project: string, token: string, query = ''): Promise<Row[]> => {
  const r = await call(`/api/projects/${project}/tasks${query}`, token)
  assert.equal(r.status, 200)
  return ((await r.json()) as { tasks: Row[] }).tasks
}
const make = async (project: string, token: string, title: string, body?: unknown): Promise<string> => {
  const r = await call(`/api/projects/${project}/tasks`, token, { method: 'POST', body: JSON.stringify({ title, body }) })
  assert.equal(r.status, 201)
  return ((await r.json()) as { id: string }).id
}

const doc = (...content: unknown[]) => ({ type: 'doc', content })
const para = (...content: unknown[]) => ({ type: 'paragraph', content })
const text = (t: string, marks?: unknown[]) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t })

/* Every kind of thing a description holds, in one. */
const RICH = doc(
  { type: 'heading', attrs: { level: 2 }, content: [text('The header')] },
  para(
    text('Ask '),
    { type: 'mention', attrs: { id: '00000000-0000-0000-0000-000000000001', label: 'Anna' } },
    text(' about the '),
    text('logo', [{ type: 'bold' }]),
    text('’s   overlap,'),
    { type: 'hardBreak' },
    text('see '),
    /* The chip's `line` holds nodes of its own; they are not words on the page. */
    {
      type: 'taskref',
      attrs: { id: '0190a000-0000-7000-8000-00000000000a', key: 'STU', number: 4, title: 'Fix the menu', line: [text('NOT THIS')] },
    },
    text(' and '),
    { type: 'docref', attrs: { id: '0190a000-0000-7000-8000-00000000000b', title: 'The brief' } },
  ),
  { type: 'attachment', attrs: { fileId: '0190a000-0000-7000-8000-00000000000c', kind: 'image' } },
  { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('one\tthing'))] }] },
)
const RICH_SAID = 'The header Ask @Anna about the logo’s overlap, see STU-4 Fix the menu and The brief one thing'

test('the list carries the start of each description as plain words, cut at 160, and nothing for none', async () => {
  const me = await makeOwner()
  const project = await makeProject(me.ctx, me.workspaceId, 'Excerpts')
  /* A list for them to be in, so the read by list has them too. */
  const list = await call(`/api/projects/${project}/lists`, me.token, { method: 'POST', body: JSON.stringify({ name: 'Open' }) })
  assert.equal(list.status, 201)
  const rich = await make(project, me.token, 'Rich', RICH)
  const long = await make(project, me.token, 'Long', doc(para(text('word '.repeat(80)))))
  const bare = await make(project, me.token, 'Bare')
  const empty = await make(project, me.token, 'Empty', doc(para()))
  const picture = await make(
    project,
    me.token,
    'Picture',
    doc({ type: 'attachment', attrs: { fileId: '0190a000-0000-7000-8000-00000000000c', kind: 'image' } }),
  )

  for (const query of ['', '?pictures=1', '?by=list', '?order=created']) {
    const by = new Map((await rows(project, me.token, query)).map((t) => [t.id, t]))
    assert.equal(by.get(rich)?.excerpt, RICH_SAID, `${query}: text, names and chips as their words`)
    const cut = by.get(long)?.excerpt ?? ''
    assert.equal([...cut].length <= EXCERPT_MOST, true, 'no longer than 160')
    assert.ok(cut.endsWith('word…'), `cut with an ellipsis, not after a space: ${cut.slice(-8)}`)
    assert.equal(by.get(bare)?.excerpt, null, 'no description says nothing')
    assert.equal(by.get(empty)?.excerpt, null, 'an empty one says nothing')
    assert.equal(by.get(picture)?.excerpt, null, 'a picture alone says nothing')
  }
  /* The body itself is not in the list. */
  const first = (await rows(project, me.token))[0] as Record<string, unknown>
  assert.equal('body' in first, false)
})

test('an edited description is the excerpt at once — in the answer to the edit and in the next read', async () => {
  const me = await makeOwner()
  const project = await makeProject(me.ctx, me.workspaceId, 'Edits')
  const id = await make(project, me.token, 'Edited', doc(para(text('Before'))))
  const before = (await rows(project, me.token)).find((t) => t.id === id)
  const r = await call(`/api/tasks/${id}`, me.token, {
    method: 'PATCH',
    body: JSON.stringify({ body: doc(para(text('After  the   edit'))) }),
  })
  assert.equal(r.status, 200)
  const said = (await r.json()) as { task?: Row }
  assert.equal(said.task?.excerpt, 'After the edit', 'the row handed back with the edit')
  assert.equal((await rows(project, me.token)).find((t) => t.id === id)?.excerpt, 'After the edit')
  assert.notEqual(before?.excerpt, 'After the edit')

  /* A change to anything else leaves it alone. */
  const t = await call(`/api/tasks/${id}`, me.token, { method: 'PATCH', body: JSON.stringify({ title: 'Renamed' }) })
  assert.equal(t.status, 200)
  assert.equal((await rows(project, me.token)).find((x) => x.id === id)?.excerpt, 'After the edit')

  /* And emptied, it says nothing again. */
  const e = await call(`/api/tasks/${id}`, me.token, { method: 'PATCH', body: JSON.stringify({ body: doc(para()) }) })
  assert.equal(e.status, 200)
  assert.equal((await rows(project, me.token)).find((x) => x.id === id)?.excerpt, null)
})

test('the screen’s rule and the database’s say the same', async () => {
  const deep: Record<string, unknown> = { type: 'paragraph', content: [text('bottom')] }
  let nest: Record<string, unknown> = deep
  for (let i = 0; i < 70; i++) nest = { type: 'blockquote', content: [nest] }
  const bodies: unknown[] = [
    RICH,
    doc(para(text('word '.repeat(80)))),
    doc(para(text('é'.repeat(200)))),
    doc(para(text('😀'.repeat(170)))),
    doc(para(text(`${'a'.repeat(158)}  b`))),
    doc(para(text('  spaced \n\r\f\v  out  '))),
    doc(para({ type: 'taskref', attrs: { number: 7, title: 'No key' } }, { type: 'taskref', attrs: { title: 'No number' } })),
    doc(para({ type: 'mention', attrs: {} }, { type: 'docref', attrs: { id: 'veiled' } }, text('x'))),
    doc(para(text('a'), 'stray', text('b'), null, text('c'))),
    doc(para(text('glued'), text('together', [{ type: 'italic' }]))),
    doc({ type: 'codeBlock', content: [text('const x = 1\nconst y = 2')] }),
    doc(),
    nest,
    {},
    [],
    'words',
    null,
  ]
  const sql = asTableOwner()
  for (const body of bodies) {
    const [row] = await sql<{ said: string | null }[]>`select excerpt_of(${body === null ? null : sql.json(body as never)}::jsonb) as said`
    assert.equal(excerptOf(body), row?.said ?? null, JSON.stringify(body).slice(0, 80))
  }
})
