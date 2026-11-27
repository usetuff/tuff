import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import postgres from 'postgres'
import { app } from '../src/http/routes.js'
import { closeRealtime } from '../src/realtime.js'
import { addPerson, closeDb, makeOwner, makeProject } from './helpers.js'
import { startSession } from '../src/auth/flows.js'

/* A signed-in session, as connecting asks — not a bare bearer. */
const signedIn = async (actor: string, ws: string) => (await startSession(actor, ws, {}, null)).access_token

/* As the tables' owner, for what only a fixture reads. */
const owner = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })

after(async () => {
  await owner.end()
  await closeRealtime()
  await closeDb()
})

async function send(method: string, path: string, token: string, body?: unknown) {
  const r = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> }
}
/* A public address by number, so nothing is looked up in a test. */
const HOOK = 'https://93.184.215.14/tuff'
const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const deliveries = (agent: string) =>
  owner<{ event: string; object_id: string; reason: string }[]>`
    select d.event, d.payload->>'object_id' as object_id, d.payload->>'reason' as reason
    from webhook_delivery d join webhook w on w.id = d.webhook_id
    where w.agent_id = ${agent} order by d.created_at`

test('an agent is connected into a project, takes no seat, and hears what is given to it', async () => {
  const boss = await makeOwner()
  const project = await makeProject(boss.ctx, boss.workspaceId, 'Agentic')
  const other = await makeProject(boss.ctx, boss.workspaceId, 'Elsewhere')
  const seats = async () => (await owner<{ n: number }[]>`select workspace_people(${boss.workspaceId}) as n`)[0]!.n
  const before = await seats()

  const made = await send('POST', '/api/agents', boss.token, { name: 'Claude Code', project_ids: [project], reach: 'webhook', url: HOOK })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const agent = made.body.agent_id as string
  const token = made.body.token as string
  assert.match(token, /^tok_/)
  assert.match(made.body.secret as string, /^whs_/)
  assert.equal(await seats(), before)

  // Listed as an agent beside the people, and in the workspace's own list.
  const people = (await send('GET', '/api/people', boss.token)).body.people as { actor_id: string; agent: boolean }[]
  assert.equal(people.find((p) => p.actor_id === agent)?.agent, true)
  const listed = (await send('GET', '/api/agents', boss.token)).body.agents as {
    actor_id: string
    project_ids: string[]
    can_disconnect: boolean
  }[]
  assert.deepEqual(
    listed.map((a) => [a.actor_id, a.project_ids, a.can_disconnect]),
    [[agent, [project], true]],
  )
  // Its webhook is not one of the workspace's, and hears none of its events.
  const hooks = await send('GET', '/api/webhooks', boss.token)
  assert.equal((hooks.body.webhooks as unknown[] | undefined)?.length, 0, JSON.stringify(hooks))

  // Given a task, and mentioned: both reach it.
  const task = await send('POST', `/api/projects/${project}/tasks`, boss.token, { title: 'Write the importer', assignee_ids: [agent] })
  assert.equal(task.status, 201, JSON.stringify(task.body))
  const mention = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'mention', attrs: { id: agent, label: 'Claude Code' } },
          { type: 'text', text: ' please look' },
        ],
      },
    ],
  }
  await send('POST', `/api/tasks/${task.body.id as string}/comments`, boss.token, { body: mention })
  const got = await deliveries(agent)
  assert.deepEqual(
    got.map((d) => [d.event, d.object_id]),
    [
      ['agent.assigned', task.body.id],
      ['agent.mentioned', task.body.id],
    ],
  )
  // Not given a task outside its projects.
  const outside = await send('POST', `/api/projects/${other}/tasks`, boss.token, { title: 'Not its', assignee_ids: [agent] })
  assert.notEqual(outside.status, 201)

  // It reads and works only where it was put, and connects nothing itself.
  const seen = (await send('GET', '/api/projects', token)).body.projects as { id: string }[]
  assert.deepEqual(
    seen.map((p) => p.id),
    [project],
  )
  const doing = await send('POST', `/api/projects/${project}/lists`, boss.token, { name: 'Doing' })
  assert.ok(doing.status < 300, JSON.stringify(doing.body))
  const moved = await send('PATCH', `/api/tasks/${task.body.id as string}`, token, { list_id: doing.body.id as string })
  assert.equal(moved.status, 200, JSON.stringify(moved.body))
  assert.equal(
    (await send('POST', '/api/agents', token, { name: 'Child', project_ids: [project], reach: 'webhook', url: HOOK })).status,
    403,
  )
  assert.equal((await send('POST', '/api/projects', token, { name: 'Its own' })).status, 403)

  // Disconnected: off the task, its token dead, its webhook stopped.
  assert.equal((await send('DELETE', `/api/agents/${agent}`, boss.token)).status, 200)
  assert.equal((await send('GET', '/api/projects', token)).status, 401)
  const [t] = await owner<{ ids: string[] }[]>`select assignee_ids as ids from task where id = ${task.body.id as string}`
  assert.deepEqual(t!.ids, [])
  assert.equal((await send('DELETE', `/api/agents/${agent}`, boss.token)).status, 404)
})

test('a member connects one only when the owner says so, into their projects, with no more than their rights', async () => {
  const boss = await makeOwner()
  const mine = await makeProject(boss.ctx, boss.workspaceId, 'Theirs')
  const notMine = await makeProject(boss.ctx, boss.workspaceId, 'Not theirs')
  const kit = await addPerson(boss.ctx, boss.workspaceId, 'member', [mine])
  const kitToken = await signedIn(kit.actorId, boss.workspaceId)
  await owner`update project_member set rights = '{task.create,channel.create,manage,task.delete}' where actor_id = ${kit.actorId} and project_id = ${mine}`
  const ask = (projects: string[]) =>
    send('POST', '/api/agents', kitToken, { name: 'Helper', project_ids: projects, reach: 'webhook', url: HOOK })

  assert.equal((await ask([mine])).status, 403)
  assert.equal((await send('PATCH', `/api/people/${kit.actorId}`, boss.token, { may_connect_agents: true })).status, 200)
  const asked = await signedIn(kit.actorId, boss.workspaceId)
  const again = (projects: string[]) =>
    send('POST', '/api/agents', asked, { name: 'Helper', project_ids: projects, reach: 'webhook', url: HOOK })
  assert.equal((await again([notMine])).status, 404)
  assert.equal((await again([mine, notMine])).status, 404)
  const made = await again([mine])
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const agent = made.body.agent_id as string
  const [r] = await owner<{ rights: string[] }[]>`select rights from project_member where actor_id = ${agent} and project_id = ${mine}`
  // Making tasks, yes; deleting and running the project, never.
  assert.deepEqual(r!.rights, ['task.create'])

  // Another member may not disconnect it; the owner may.
  const sam = await addPerson(boss.ctx, boss.workspaceId, 'member', [mine])
  assert.equal((await send('DELETE', `/api/agents/${agent}`, await signedIn(sam.actorId, boss.workspaceId))).status, 404)
  // Removing the person who connected it takes it with them.
  assert.equal((await send('DELETE', `/api/people/${kit.actorId}`, boss.token)).status, 200)
  const [g] = await owner<{ gone: boolean }[]>`select deleted_at is not null as gone from agent where actor_id = ${agent}`
  assert.equal(g!.gone, true)
  assert.equal((await send('GET', '/api/projects', made.body.token as string)).status, 401)
})

/*
 * What the review found, Safety. An agent's rights
 * follow its connector's, it goes nowhere they are not, and it decides
 * nothing about who is where.
 */
test('an agent follows its connector off a project, goes nowhere they are not, and staffs nothing', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Followed')
  const secret = await makeProject(boss.ctx, boss.workspaceId, 'Secret')
  const bob = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  await send('PATCH', `/api/people/${bob.actorId}`, boss.token, { may_connect_agents: true })
  const bobToken = await signedIn(bob.actorId, boss.workspaceId)
  const made = await send('POST', '/api/agents', bobToken, { name: 'Bob’s helper', project_ids: [p], reach: 'webhook', url: HOOK })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const agent = made.body.agent_id as string
  const token = made.body.token as string

  // Nobody — not even the owner — puts it where Bob is not.
  const into = await send('POST', `/api/projects/${secret}/members`, boss.token, { actor_id: agent })
  assert.equal(into.status, 403, JSON.stringify(into.body))
  // Whatever it is given on its project, it holds the ceiling at most.
  await owner`update project_member set rights = '{task.create,edit.any,manage,task.delete}' where actor_id = ${agent} and project_id = ${p}`
  const [held] = await owner<{ rights: string[] }[]>`select rights from project_member where actor_id = ${agent} and project_id = ${p}`
  assert.ok(
    held!.rights.every((r) => ['task.create', 'edit.any'].includes(r)),
    held!.rights.join(','),
  )

  // Its token staffs nothing: neither Bob back on, nor anybody off.
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  assert.equal((await send('POST', `/api/projects/${p}/members`, token, { actor_id: carol.actorId })).status, 403)
  assert.equal((await send('DELETE', `/api/projects/${p}/members/${carol.actorId}`, token)).status, 403)
  // Nor reads a colleague's card, nor writes to somebody directly.
  assert.equal((await send('GET', `/api/people/${carol.actorId}`, token)).status, 403)
  assert.equal((await send('POST', '/api/conversations/direct', token, { actor_ids: [carol.actorId] })).status, 403)

  // Bob taken off the project: so is his agent.
  assert.equal((await send('DELETE', `/api/projects/${p}/members/${bob.actorId}`, boss.token)).status, 200)
  const [off] = await owner<
    { n: number }[]
  >`select count(*)::int as n from project_member where actor_id = ${agent} and project_id = ${p} and deleted_at is null`
  assert.equal(off!.n, 0)
  const seen = (await send('GET', '/api/projects', token)).body.projects as { id: string }[]
  assert.deepEqual(seen, [])
})

/*
 * Its page: put on a project and taken off one
 * through the ways a person is, offered only where that would be taken, and
 * given a face by whoever manages it.
 */
test('an agent is put on a project and taken off it from its page, and offered only where it would go', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Start')
  const q = await makeProject(boss.ctx, boss.workspaceId, 'Later')
  const r = await makeProject(boss.ctx, boss.workspaceId, 'Bob is not on')
  const bob = await addPerson(boss.ctx, boss.workspaceId, 'member', [p, q])
  await send('PATCH', `/api/people/${bob.actorId}`, boss.token, { may_connect_agents: true })
  const bobToken = await signedIn(bob.actorId, boss.workspaceId)
  const made = await send('POST', '/api/agents', bobToken, { name: 'Bob’s helper', project_ids: [p], reach: 'mcp' })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const agent = made.body.agent_id as string
  const token = made.body.token as string
  type Listed = { actor_id: string; project_ids: string[]; offered_project_ids: string[]; can_manage: boolean; can_disconnect: boolean }
  const listed = async (as: string) => ((await send('GET', '/api/agents', as)).body.agents as Listed[]).find((a) => a.actor_id === agent)!

  // Offered where Bob is and it is not: Later, and never the one Bob is not on.
  assert.deepEqual((await listed(boss.token)).offered_project_ids, [q])
  assert.deepEqual((await listed(bobToken)).offered_project_ids, [q])
  // Somebody on none of those is offered none.
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [r])
  const carolToken = await signedIn(carol.actorId, boss.workspaceId)
  assert.deepEqual((await listed(carolToken)).offered_project_ids, [])

  // Put on it, and its token works there on its next call.
  assert.equal((await send('POST', `/api/projects/${q}/members`, bobToken, { actor_id: agent })).status, 200)
  const seen = ((await send('GET', '/api/projects', token)).body.projects as { id: string }[]).map((x) => x.id).sort()
  assert.deepEqual(seen, [p, q].sort())
  const there = await send('POST', `/api/projects/${q}/tasks`, token, { title: 'Made where it was put' })
  assert.equal(there.status, 201, JSON.stringify(there.body))
  assert.deepEqual((await listed(boss.token)).offered_project_ids, [])

  // Taken off again by whoever runs the project — the owner here — and offered again.
  assert.equal((await send('DELETE', `/api/projects/${q}/members/${agent}`, boss.token)).status, 200)
  assert.deepEqual(
    ((await send('GET', '/api/projects', token)).body.projects as { id: string }[]).map((x) => x.id),
    [p],
  )
  assert.deepEqual((await listed(bobToken)).offered_project_ids, [q])
})

test('an agent’s face is set and taken off by whoever connected it, nobody else — not the owner — never through a token', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Faces')
  const bob = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  await send('PATCH', `/api/people/${bob.actorId}`, boss.token, { may_connect_agents: true })
  const bobToken = await signedIn(bob.actorId, boss.workspaceId)
  const made = await send('POST', '/api/agents', bobToken, { name: 'Faced', project_ids: [p], reach: 'mcp' })
  const agent = made.body.agent_id as string
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  const carolToken = await signedIn(carol.actorId, boss.workspaceId)

  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const upload = async (as: string, type = 'image/png', bytes: Uint8Array<ArrayBuffer> = PNG) => {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type }), 'face.png')
    const res = await app.request(`/api/agents/${agent}/avatar`, { method: 'POST', headers: { authorization: `Bearer ${as}` }, body: form })
    return res.status
  }
  const face = async () =>
    ((await send('GET', '/api/agents', boss.token)).body.agents as { actor_id: string; avatar_url: string | null }[]).find(
      (a) => a.actor_id === agent,
    )!.avatar_url

  // Who manages it is said with it.
  const asCarol = (await send('GET', '/api/agents', carolToken)).body.agents as { actor_id: string; can_manage: boolean }[]
  assert.equal(asCarol.find((a) => a.actor_id === agent)!.can_manage, false)
  const asBob = (await send('GET', '/api/agents', bobToken)).body.agents as { actor_id: string; can_manage: boolean }[]
  assert.equal(asBob.find((a) => a.actor_id === agent)!.can_manage, true)

  assert.equal(await upload(carolToken), 403)
  assert.equal(await face(), null)
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  assert.equal(await upload(bobToken, 'image/svg+xml', svg), 400)
  // Its bytes, not the type the form says (the eighth audit).
  assert.equal(await upload(bobToken, 'image/png', svg), 400)
  assert.equal(await upload(bobToken), 200)
  assert.ok(await face())
  // The same face wherever the people are listed.
  const people = (await send('GET', '/api/people', boss.token)).body.people as { actor_id: string; avatar_url: string | null }[]
  assert.ok(people.find((x) => x.actor_id === agent)!.avatar_url)
  // Not the owner: every agent is somebody's. Its connector takes it off.
  const asBoss = (await send('GET', '/api/agents', boss.token)).body.agents as {
    actor_id: string
    can_manage: boolean
    can_disconnect: boolean
  }[]
  assert.equal(asBoss.find((a) => a.actor_id === agent)!.can_manage, false)
  assert.equal(asBoss.find((a) => a.actor_id === agent)!.can_disconnect, true)
  assert.equal(await upload(boss.token), 403)
  assert.equal((await send('DELETE', `/api/agents/${agent}/avatar`, carolToken)).status, 403)
  assert.equal((await send('DELETE', `/api/agents/${agent}/avatar`, boss.token)).status, 403)
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, boss.token, { preset: 'bot-2' })).status, 403)
  assert.equal((await send('DELETE', `/api/agents/${agent}/avatar`, bobToken)).status, 200)
  assert.equal(await face(), null)

  // Never through a token: the agent's own, or a person's.
  assert.equal(await upload(made.body.token as string), 403)
  const { issueApiToken } = await import('../src/auth/flows.js')
  assert.equal(await upload(await issueApiToken(boss.ctx.actorId, boss.workspaceId, 'tool')), 403)
  // Nor of somebody who is not an agent.
  const res = await app.request(`/api/agents/${carol.actorId}/avatar`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${boss.token}` },
  })
  assert.equal(res.status, 404)
})

test('an agent is renamed and given a new token by whoever manages it, the old token ends, never through a token', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Rekeyed')
  const bob = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  await send('PATCH', `/api/people/${bob.actorId}`, boss.token, { may_connect_agents: true })
  const bobToken = await signedIn(bob.actorId, boss.workspaceId)
  const made = await send('POST', '/api/agents', bobToken, { name: 'Misnamed', project_ids: [p], reach: 'mcp' })
  const agent = made.body.agent_id as string
  const old = made.body.token as string
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  const carolToken = await signedIn(carol.actorId, boss.workspaceId)
  const named = async () =>
    ((await send('GET', '/api/people', boss.token)).body.people as { actor_id: string; name: string }[]).find((x) => x.actor_id === agent)!
      .name

  // Not somebody who did not connect it, not through a token, not the agent itself.
  assert.equal((await send('PATCH', `/api/agents/${agent}`, carolToken, { name: 'Carol’s' })).status, 403)
  assert.equal((await send('PATCH', `/api/agents/${agent}`, old, { name: 'Myself' })).status, 403)
  const { issueApiToken } = await import('../src/auth/flows.js')
  const bossTool = await issueApiToken(boss.ctx.actorId, boss.workspaceId, 'tool')
  assert.equal((await send('PATCH', `/api/agents/${agent}`, bossTool, { name: 'Tooled' })).status, 403)
  assert.equal((await send('PATCH', `/api/agents/${agent}`, bobToken, { name: '   ' })).status, 400)
  assert.equal(await named(), 'Misnamed')
  // Whoever connected it, and not the owner.
  assert.equal((await send('PATCH', `/api/agents/${agent}`, bobToken, { name: '  Reviewer  ' })).status, 200)
  assert.equal(await named(), 'Reviewer')
  assert.equal((await send('PATCH', `/api/agents/${agent}`, boss.token, { name: 'Release bot' })).status, 403)
  assert.equal(await named(), 'Reviewer')
  // Nobody who is not an agent.
  assert.equal((await send('PATCH', `/api/agents/${carol.actorId}`, boss.token, { name: 'Bot' })).status, 404)

  // The old token works until a new one is made.
  assert.equal((await send('GET', '/api/my/tasks?tab=assigned', old)).status, 200)
  assert.equal((await send('POST', `/api/agents/${agent}/token`, carolToken)).status, 403)
  assert.equal((await send('POST', `/api/agents/${agent}/token`, old)).status, 403)
  assert.equal((await send('POST', `/api/agents/${agent}/token`, bossTool)).status, 403)
  assert.equal((await send('GET', '/api/my/tasks?tab=assigned', old)).status, 200)

  const fresh = await send('POST', `/api/agents/${agent}/token`, bobToken)
  assert.equal(fresh.status, 201, JSON.stringify(fresh.body))
  const next = fresh.body.token as string
  assert.match(next, /^tok_/)
  assert.notEqual(next, old)
  assert.equal((await send('GET', '/api/my/tasks?tab=assigned', old)).status, 401)
  assert.equal((await send('GET', '/api/my/tasks?tab=assigned', next)).status, 200)
  // It keeps its place.
  const listed = (await send('GET', '/api/agents', boss.token)).body.agents as { actor_id: string; project_ids: string[] }[]
  assert.deepEqual(listed.find((a) => a.actor_id === agent)!.project_ids, [p])
  // Not the owner: a new token is a way to read what the agent was given,
  // and the one Bob holds goes on working.
  assert.equal((await send('POST', `/api/agents/${agent}/token`, boss.token)).status, 403)
  assert.equal((await send('GET', '/api/my/tasks?tab=assigned', next)).status, 200)
  // Taking it away is still the owner's: disconnected, its token ends.
  assert.equal((await send('DELETE', `/api/agents/${agent}`, boss.token)).status, 200)
  assert.equal((await send('GET', '/api/my/tasks?tab=assigned', next)).status, 401)
})

test('an agent wears a premade face: only a known one, set by whoever may, read as the public still, and no bytes to free', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Robots')
  const made = await send('POST', '/api/agents', boss.token, { name: 'Robo', project_ids: [p], reach: 'mcp' })
  const agent = made.body.agent_id as string
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  const carolToken = await signedIn(carol.actorId, boss.workspaceId)
  const face = async () =>
    ((await send('GET', '/api/agents', boss.token)).body.agents as { actor_id: string; avatar_url: string | null }[]).find(
      (a) => a.actor_id === agent,
    )!.avatar_url

  // Only the faces the product draws.
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, boss.token, { preset: 'bot-11' })).status, 400)
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, boss.token, { preset: '../../etc' })).status, 400)
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, boss.token, {})).status, 400)
  // Not by somebody who does not manage it, nor through a token.
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, carolToken, { preset: 'bot-1' })).status, 403)
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, made.body.token as string, { preset: 'bot-1' })).status, 403)
  assert.equal(await face(), null)

  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, boss.token, { preset: 'bot-3' })).status, 200)
  assert.equal(await face(), '/faces/bot-3.png')
  // The same wherever it is drawn.
  const people = (await send('GET', '/api/people', boss.token)).body.people as { actor_id: string; avatar_url: string | null }[]
  assert.equal(people.find((x) => x.actor_id === agent)!.avatar_url, '/faces/bot-3.png')

  // Changed and taken off, and nothing queued for the clear-out.
  assert.equal((await send('PUT', `/api/agents/${agent}/avatar`, boss.token, { preset: 'geo-4' })).status, 200)
  assert.equal(await face(), '/faces/geo-4.png')
  assert.equal((await send('DELETE', `/api/agents/${agent}/avatar`, boss.token)).status, 200)
  assert.equal(await face(), null)
  const queued = await owner`select 1 from storage_orphan where key like 'preset:%'`
  assert.equal(queued.length, 0)
})

test('an agent hears another agent, counted, and not what it cannot see', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Two')
  const q = await makeProject(boss.ctx, boss.workspaceId, 'Not its')
  const a = await send('POST', '/api/agents', boss.token, { name: 'A', project_ids: [p], reach: 'webhook', url: HOOK })
  const b = await send('POST', '/api/agents', boss.token, { name: 'B', project_ids: [p], reach: 'webhook', url: HOOK })
  const aId = a.body.agent_id as string
  const bId = b.body.agent_id as string
  // A gives B a task: B is sent it, as one hop of a chain that stops at
  // three — `questions.test.ts` follows it to the end.
  const given = await send('POST', `/api/projects/${p}/tasks`, a.body.token as string, { title: 'Ping', assignee_ids: [bId] })
  assert.equal(given.status, 201, JSON.stringify(given.body))
  assert.equal((await deliveries(bId)).length, 1)
  const [chain] = await owner<{ chain: number }[]>`
    select (d.payload->>'chain')::int as chain from webhook_delivery d join webhook w on w.id = d.webhook_id
    where w.agent_id = ${bId}`
  assert.equal(chain!.chain, 1)
  // Mentioned where it is not: nothing reaches it.
  const there = await send('POST', `/api/projects/${q}/tasks`, boss.token, { title: 'Elsewhere' })
  const mention = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: aId, label: 'A' } }] }] }
  await send('POST', `/api/tasks/${there.body.id as string}/comments`, boss.token, { body: mention })
  assert.equal((await deliveries(aId)).length, 0)
  // On a plan without agents, nothing is sent at all.
  await owner`update workspace set plan = 'solo' where id = ${boss.workspaceId}`
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Held back', assignee_ids: [aId] })
  assert.equal((await deliveries(aId)).length, 0)
})

/*
 * What the workflow does with the agent's token:
 * the task read in one MCP call, with no handshake first,
 * and the comments it leaves on the task as it starts and ends.
 */
test('an agent reached through MCP alone reads its task in one call and reports on it with its token', async () => {
  const boss = await makeOwner()
  const project = await makeProject(boss.ctx, boss.workspaceId, 'Workflowed')
  // No address and no secret: it comes for its tasks.
  const made = await send('POST', '/api/agents', boss.token, { name: 'AI Agent', project_ids: [project], reach: 'mcp' })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  assert.equal(made.body.secret, undefined)
  assert.equal((await send('POST', '/api/agents', boss.token, { name: 'x', project_ids: [project], reach: 'mcp', url: HOOK })).status, 201)
  assert.equal((await send('POST', '/api/agents', boss.token, { name: 'x', project_ids: [project], reach: 'github' })).status, 400)
  const agent = made.body.agent_id as string
  const token = made.body.token as string
  const task = await send('POST', `/api/projects/${project}/tasks`, boss.token, {
    title: 'Read me whole',
    body: doc('Make the button blue.'),
    assignee_ids: [agent],
  })
  const r = await app.request('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_task', arguments: { task: task.body.id } } }),
  })
  assert.equal(r.status, 200)
  const said = (await r.json()) as { result?: { content: { text: string }[] }; error?: unknown }
  assert.equal(said.error, undefined, JSON.stringify(said))
  const text = said.result!.content[0]!.text
  assert.match(text, /Read me whole/)
  assert.match(text, /Make the button blue/)
  // Its own tasks, as my_tasks reads them; and the report, said on the task as the agent.
  const mine = await send('GET', '/api/my/tasks?tab=assigned', token)
  assert.equal(mine.status, 200, JSON.stringify(mine.body))
  assert.ok(JSON.stringify(mine.body).includes(task.body.id as string))
  const c = await send('POST', `/api/tasks/${task.body.id as string}/comments`, token, {
    body: doc('Changed the button; the checks pass. PR: https://github.com/acme/site/pull/1'),
  })
  assert.equal(c.status, 201, JSON.stringify(c.body))
  // Nothing is sent anywhere: it has no webhook.
  assert.equal((await deliveries(agent)).length, 0)
})

/*
 * In the chat: a person mentions the agent in the
 * project's channel; the agent, through MCP alone, finds it with
 * my_mentions, reads the thread, answers in it, and marks it answered.
 */
test('an agent finds what it was mentioned in, answers in the thread, and says it has', async () => {
  const boss = await makeOwner()
  const project = await makeProject(boss.ctx, boss.workspaceId, 'Chatty')
  const made = await send('POST', '/api/agents', boss.token, { name: 'AI Agent', project_ids: [project], reach: 'mcp' })
  const agent = made.body.agent_id as string
  const token = made.body.token as string
  // The channel a project is made with: a row with a project and no members.
  const room = crypto.randomUUID()
  await owner`insert into conversation (id, workspace_id, project_id, name) values (${room}, ${boss.workspaceId}, ${project}, 'Team')`
  const mention = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'mention', attrs: { id: agent, label: 'AI Agent' } },
          { type: 'text', text: ' why did the deploy fail?' },
        ],
      },
    ],
  }
  const asked = await send('POST', `/api/conversations/${room}/messages`, boss.token, { body: mention })
  assert.equal(asked.status, 201, JSON.stringify(asked.body))
  const question = asked.body.id as string

  const mcp = async (name: string, args: Record<string, unknown>) => {
    const r = await app.request('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    })
    const said = (await r.json()) as { result?: { isError?: boolean; content: { text: string }[] }; error?: unknown }
    assert.equal(said.error, undefined, JSON.stringify(said))
    assert.notEqual(said.result?.isError, true, said.result?.content[0]?.text ?? 'refused')
    return said.result!.content[0]!.text
  }
  const listed = await mcp('my_mentions', {})
  const found = JSON.parse(listed.replace(/<\/?user_content[^>]*>/g, '')) as {
    id: string
    in: string
    conversation_id: string
    thread_id: string
    said: string
    by: string
  }[]
  assert.equal(found.length, 1, listed)
  assert.equal(found[0]!.in, 'room')
  assert.equal(found[0]!.conversation_id, room)
  assert.equal(found[0]!.thread_id, question)
  assert.match(found[0]!.said, /why did the deploy fail/)

  // Read, answered in its thread, as the agent; marked answered, it is not listed again.
  assert.match(await mcp('read_messages', { conversation_id: room }), /why did the deploy fail/)
  await mcp('send_message', {
    conversation_id: room,
    thread_id: found[0]!.thread_id,
    body: 'The migration refused a row; fixed in the next commit.',
  })
  const [reply] = await owner<{ author_id: string; parent_id: string }[]>`
    select author_id, parent_id from message where conversation_id = ${room} and parent_id is not null`
  assert.deepEqual({ ...reply }, { author_id: agent, parent_id: question })
  await mcp('mark_read', { mention_id: found[0]!.id })
  assert.equal(JSON.parse((await mcp('my_mentions', {})).replace(/<\/?user_content[^>]*>/g, '')).length, 0)
})

test('an agent’s webhook carries the receiver’s own key: set, replaced and removed by whoever manages it, sent, never said', async () => {
  const { deliverDue, verify } = await import('../src/webhooks.js')
  const { issueApiToken } = await import('../src/auth/flows.js')
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Keyed')
  const bob = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  await send('PATCH', `/api/people/${bob.actorId}`, boss.token, { may_connect_agents: true })
  const bobToken = await signedIn(bob.actorId, boss.workspaceId)
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  const carolToken = await signedIn(carol.actorId, boss.workspaceId)
  const KEY = 'Bearer grok-gateway-key-1'

  // One header value: no line breaks, a kilobyte at most.
  for (const bad of ['Bearer a\r\nX-Evil: 1', 'Bearer a\nb', 'x'.repeat(1025), '   ', 42]) {
    const r = await send('POST', '/api/agents', bobToken, {
      name: 'Grok',
      project_ids: [p],
      reach: 'webhook',
      url: HOOK,
      authorization: bad,
    })
    assert.equal(r.status, 400, JSON.stringify(bad))
  }
  const made = await send('POST', '/api/agents', bobToken, {
    name: 'Grok',
    project_ids: [p],
    reach: 'webhook',
    url: HOOK,
    authorization: KEY,
  })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  assert.ok(!JSON.stringify(made.body).includes('grok-gateway'))
  const agent = made.body.agent_id as string
  const agentToken = made.body.token as string
  const secret = made.body.secret as string

  // Sealed at rest: not the value.
  const [row] = await owner<{ enc: string }[]>`select authorization_enc as enc from webhook where agent_id = ${agent}`
  assert.ok(row!.enc && !row!.enc.includes('grok-gateway'))

  const keyed = async (as: string) =>
    ((await send('GET', '/api/agents', as)).body.agents as { actor_id: string; authorization_set?: boolean }[]).find(
      (a) => a.actor_id === agent,
    )!.authorization_set
  assert.equal(await keyed(bobToken), true)
  // Somebody who does not manage it is not told — the owner neither.
  assert.equal(await keyed(boss.token), undefined)
  assert.equal(await keyed(carolToken), undefined)

  // Sent beside the signature, which still holds.
  const task = await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Wake up', assignee_ids: [agent] })
  assert.equal(task.status, 201)
  const seen: { headers: Record<string, string>; body: string }[] = []
  const catcher = async (_url: string, init: { headers: Record<string, string>; body: string }) => {
    seen.push(init)
    return { status: 204 }
  }
  await deliverDue(50, catcher, boss.workspaceId)
  assert.equal(seen.length, 1)
  const got = seen[0]!
  assert.equal(got.headers.authorization, KEY)
  assert.ok(
    verify(
      secret,
      { signature: got.headers['x-signature']!, timestamp: got.headers['x-timestamp']!, deliveryId: got.headers['x-delivery-id']! },
      got.body,
    ),
  )
  const sent = JSON.parse(got.body) as { data: Record<string, unknown> }
  assert.equal(sent.data.title, 'Wake up')
  assert.equal(typeof sent.data.by_name, 'string')
  assert.match(sent.data.path as string, /\/tasks\/\d+$/)

  // Not by somebody who does not manage it, nor the owner, nor a token, nor the agent.
  const bossTool = await issueApiToken(boss.ctx.actorId, boss.workspaceId, 'tool')
  for (const as of [carolToken, boss.token, agentToken, bossTool]) {
    assert.equal((await send('PATCH', `/api/agents/${agent}`, as, { authorization: 'Bearer stolen' })).status, 403)
  }
  assert.equal((await send('PATCH', `/api/agents/${agent}`, bobToken, { authorization: 'a\r\nb' })).status, 400)

  // Replaced, then removed; each in the audit log, never the value.
  assert.equal((await send('PATCH', `/api/agents/${agent}`, bobToken, { authorization: 'Bearer grok-gateway-key-2' })).status, 200)
  assert.equal((await send('PATCH', `/api/agents/${agent}`, bobToken, { authorization: null })).status, 200)
  assert.equal(await keyed(bobToken), false)
  const audit = await send('GET', '/api/audit?type=integrations', boss.token)
  const lines = (audit.body.events as { kind: string; meta: Record<string, unknown> }[]).filter(
    (e) => e.kind === 'webhook.update' && e.meta.agent_id === agent,
  )
  assert.deepEqual(lines.map((e) => e.meta.authorization).reverse(), ['changed', 'removed'])
  assert.ok(!JSON.stringify(audit.body).includes('grok-gateway'))
  const [logged] = await owner<{ n: number }[]>`
    select count(*)::int as n from activity_event where workspace_id = ${boss.workspaceId} and meta::text like '%grok-gateway%'`
  assert.equal(logged!.n, 0)

  // Removed: the next delivery carries none.
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Again', assignee_ids: [agent] })
  seen.length = 0
  await deliverDue(50, catcher, boss.workspaceId)
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.headers.authorization, undefined)

  // An agent through MCP alone has no webhook to carry one.
  const mcp = await send('POST', '/api/agents', bobToken, { name: 'Local', project_ids: [p], reach: 'mcp' })
  assert.equal((await send('PATCH', `/api/agents/${mcp.body.agent_id as string}`, bobToken, { authorization: 'Bearer x' })).status, 400)
})

/* A Claude Code routine. */
test('an agent can be a Claude Code routine: Anthropic’s address only, its token, its headers and one line of text, thirty an hour', async () => {
  const { deliverDue } = await import('../src/webhooks.js')
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Routined')
  const ROUTINE = 'https://api.anthropic.com/v1/claude_code/routines/trig_01ABCdef/fire'
  const TOKEN = 'sk-ant-oat01-routine-token'
  const connect = (body: Record<string, unknown>) =>
    send('POST', '/api/agents', boss.token, { name: 'Claude', project_ids: [p], reach: 'webhook', shape: 'claude_routine', ...body })

  // Only Anthropic's address, and never without its token.
  for (const url of [
    HOOK,
    'https://api.anthropic.com/v1/claude_code/routines/trig_1/fire/x',
    'https://evil.example/v1/claude_code/routines/t/fire',
    'http://api.anthropic.com/v1/claude_code/routines/t/fire',
  ]) {
    assert.equal((await connect({ url, authorization: TOKEN })).status, 400, url)
  }
  assert.equal((await connect({ url: ROUTINE })).status, 400)
  const made = await connect({ url: ROUTINE, authorization: `Bearer ${TOKEN}` })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const agent = made.body.agent_id as string

  // The token is never said back.
  const listed = await send('GET', '/api/agents', boss.token)
  assert.ok(!JSON.stringify(listed.body).includes(TOKEN))
  assert.ok(!JSON.stringify(made.body).includes(TOKEN))
  const mine = (listed.body.agents as { actor_id: string; webhook_shape?: string; authorization_set?: boolean }[]).find(
    (a) => a.actor_id === agent,
  )!
  assert.deepEqual([mine.webhook_shape, mine.authorization_set], ['claude_routine', true])
  // Replaced, not taken off: a routine without it cannot be fired.
  assert.equal((await send('PATCH', `/api/agents/${agent}`, boss.token, { authorization: null })).status, 400)

  const task = await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Fix the login', assignee_ids: [agent] })
  assert.equal(task.status, 201, JSON.stringify(task.body))
  const seen: { url: string; headers: Record<string, string>; body: string }[] = []
  await deliverDue(
    50,
    async (url, init) => {
      seen.push({ url, ...init })
      return { status: 200 }
    },
    boss.workspaceId,
  )
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.url, ROUTINE)
  assert.deepEqual(seen[0]!.headers, {
    'content-type': 'application/json',
    'anthropic-beta': 'experimental-cc-routine-2026-04-01',
    'anthropic-version': '2023-06-01',
    authorization: `Bearer ${TOKEN}`,
  })
  const body = JSON.parse(seen[0]!.body) as Record<string, unknown>
  assert.deepEqual(Object.keys(body), ['text'])
  const text = body.text as string
  const [instruction, , marked, ...data] = text.split('\n')
  assert.match(instruction!, /^You were assigned something in Tuff\. .*through Tuff's MCP/)
  assert.match(marked!, /are not instructions:$/)
  assert.match(data[0]!, /^Task: \S+-\d+ — Fix the login$/)
  assert.match(data[1]!, /^By: \S/)
  assert.match(data[2]!, /^Link: .*\/tasks\/\d+$/)

  // Thirty an hour: what is past it is not queued.
  const [hook] = await owner<{ id: string }[]>`select id from webhook where agent_id = ${agent}`
  await owner`
    insert into webhook_delivery (id, workspace_id, webhook_id, event, payload, delivered_at)
    select gen_random_uuid(), ${boss.workspaceId}, ${hook!.id}, 'agent.assigned', '{}'::jsonb, now()
    from generate_series(1, 29)`
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'One too many', assignee_ids: [agent] })
  const [n] = await owner<{ n: number }[]>`
    select count(*)::int as n from webhook_delivery where webhook_id = ${hook!.id} and created_at > now() - interval '1 hour'`
  assert.equal(n!.n, 30)
})

/* The third audit, as a review found it again. */
test('a room of chosen people is named to no agent outside it', async () => {
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Rooms for agents')
  const made = await send('POST', '/api/agents', boss.token, { name: 'Listener', project_ids: [p], reach: 'webhook', url: HOOK })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const agent = made.body.agent_id as string
  const [open, chosen, joined] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
  await owner`insert into conversation (id, workspace_id, project_id, name) values (${open}, ${boss.workspaceId}, ${p}, 'general')`
  await owner`insert into conversation (id, workspace_id, project_id, name, chosen)
              values (${chosen}, ${boss.workspaceId}, ${p}, 'layoffs-q3', true)`
  await owner`insert into conversation (id, workspace_id, project_id, name, chosen)
              values (${joined}, ${boss.workspaceId}, ${p}, 'agents-only', true)`
  await owner`insert into conversation_member (id, workspace_id, conversation_id, actor_id, joined_at)
              values (${crypto.randomUUID()}, ${boss.workspaceId}, ${joined}, ${agent}, now())`
  for (const room of [open, chosen, joined]) {
    await owner`insert into notification (id, workspace_id, actor_id, reason, object_type, object_id, by_id)
                values (${crypto.randomUUID()}, ${boss.workspaceId}, ${agent}, 'mentioned', 'conversation', ${room}, ${boss.ctx.actorId})`
  }
  const sent = await owner<{ object_id: string; title: string }[]>`
    select d.payload->>'object_id' as object_id, d.payload->>'title' as title
    from webhook_delivery d join webhook w on w.id = d.webhook_id where w.agent_id = ${agent} order by d.created_at`
  assert.deepEqual(
    sent.map((d) => [d.object_id, d.title]),
    [
      [open, 'general'],
      [joined, 'agents-only'],
    ],
  )
  assert.ok(!JSON.stringify(sent).includes('layoffs'))
})

/* Changed after connecting. */
test('an agent’s reach is changed on its page: by whoever manages it, checked as at connecting, its key never sent to a new host', async () => {
  const { deliverDue, verify } = await import('../src/webhooks.js')
  const { issueApiToken } = await import('../src/auth/flows.js')
  const boss = await makeOwner()
  const p = await makeProject(boss.ctx, boss.workspaceId, 'Rerouted')
  const bob = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  await send('PATCH', `/api/people/${bob.actorId}`, boss.token, { may_connect_agents: true })
  const bobToken = await signedIn(bob.actorId, boss.workspaceId)
  const carol = await addPerson(boss.ctx, boss.workspaceId, 'member', [p])
  const carolToken = await signedIn(carol.actorId, boss.workspaceId)
  const KEY = 'Bearer first-host-key'
  const ROUTINE = 'https://api.anthropic.com/v1/claude_code/routines/trig_reach/fire'
  const OTHER = 'https://93.184.215.15/other'

  const made = await send('POST', '/api/agents', bobToken, { name: 'Mover', project_ids: [p], reach: 'mcp' })
  assert.equal(made.status, 201)
  const agent = made.body.agent_id as string
  const agentToken = made.body.token as string
  const bossTool = await issueApiToken(boss.ctx.actorId, boss.workspaceId, 'tool')
  const reach = (as: string, body: Record<string, unknown>) => send('PUT', `/api/agents/${agent}/reach`, as, body)
  const row = async () =>
    ((await send('GET', '/api/agents', bobToken)).body.agents as Record<string, unknown>[]).find((a) => a.actor_id === agent)!
  const hook = async () =>
    (
      await owner<{ url: string; shape: string; enc: string | null }[]>`
      select url, shape, authorization_enc as enc from webhook where agent_id = ${agent} and deleted_at is null`
    )[0]
  const seen: { url: string; headers: Record<string, string>; body: string }[] = []
  const catcher = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    seen.push({ url, headers: init.headers, body: init.body })
    return { status: 204 }
  }
  const pending = async () =>
    (
      await owner<{ n: number }[]>`
      select count(*)::int as n from webhook_delivery d join webhook w on w.id = d.webhook_id
      where w.agent_id = ${agent} and d.delivered_at is null`
    )[0]!.n
  const signedBy = (secret: string, d: { headers: Record<string, string>; body: string }) =>
    verify(
      secret,
      { signature: d.headers['x-signature']!, timestamp: d.headers['x-timestamp']!, deliveryId: d.headers['x-delivery-id']! },
      d.body,
    )

  // Not somebody who does not manage it, nor the owner — pointing it at
  // another address is a way to hear what it is given — nor a token, nor
  // the agent itself.
  for (const as of [carolToken, boss.token, agentToken, bossTool]) {
    assert.equal((await reach(as, { reach: 'webhook', url: HOOK })).status, 403)
  }
  assert.equal(await hook(), undefined)
  // Nobody who is not an agent.
  assert.equal((await send('PUT', `/api/agents/${carol.actorId}/reach`, boss.token, { reach: 'mcp' })).status, 404)

  // The same checks as connecting: a public https address, nothing inside.
  for (const url of ['http://93.184.215.14/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://169.254.169.254/latest']) {
    assert.equal((await reach(bobToken, { reach: 'webhook', url })).status, 400, url)
  }
  assert.equal((await row()).reach, 'mcp')

  // MCP → webhook with a key: its secret, once, and its key.
  const toHook = await reach(bobToken, { reach: 'webhook', url: HOOK, authorization: KEY })
  assert.equal(toHook.status, 200, JSON.stringify(toHook.body))
  assert.match(toHook.body.secret as string, /^whs_/)
  assert.equal(toHook.body.authorization_cleared, false)
  let r = await row()
  assert.deepEqual([r.reach, r.webhook_shape, r.webhook_url, r.authorization_set], ['webhook', 'tuff', HOOK, true])
  // The address is told to whoever manages it, nobody else.
  const carolSees = ((await send('GET', '/api/agents', carolToken)).body.agents as Record<string, unknown>[]).find(
    (a) => a.actor_id === agent,
  )!
  assert.equal(carolSees.webhook_url, undefined)

  // The same address again keeps the key; a new address takes it off.
  const same = await reach(bobToken, { reach: 'webhook', url: HOOK })
  assert.equal(same.status, 200)
  assert.equal(same.body.secret, undefined)
  assert.equal((await row()).authorization_set, true)
  // Queued for the first receiver and not yet sent: not sent to the next.
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'For the first', assignee_ids: [agent] })
  assert.equal(await pending(), 1)
  const moved = await reach(bobToken, { reach: 'webhook', url: OTHER })
  assert.equal(moved.body.authorization_cleared, true)
  assert.equal((await hook())!.enc, null)
  assert.equal(await pending(), 0)
  // A new receiver, a new secret, said once.
  const next = moved.body.secret as string
  assert.match(next, /^whs_/)
  assert.notEqual(next, toHook.body.secret)
  // Delivered to the new address without the old key, signed with the new secret alone.
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Moved', assignee_ids: [agent] })
  await deliverDue(50, catcher, boss.workspaceId)
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.url, OTHER)
  assert.equal(seen[0]!.headers.authorization, undefined)
  assert.equal((JSON.parse(seen[0]!.body) as { data: { title: string } }).data.title, 'Moved')
  assert.ok(signedBy(next, seen[0]!))
  assert.ok(!signedBy(toHook.body.secret as string, seen[0]!))

  // A routine: Anthropic's address only, and its token — given here, since a new shape clears any.
  await reach(bobToken, { reach: 'webhook', url: OTHER, authorization: KEY })
  for (const url of [HOOK, 'https://evil.example/v1/claude_code/routines/t/fire', `${ROUTINE}/x`]) {
    const bad = await reach(bobToken, { reach: 'webhook', shape: 'claude_routine', url, authorization: 'Bearer t' })
    assert.equal(bad.status, 400, url)
  }
  // Without a token it is refused, and nothing changed: the old key is still there.
  assert.equal((await reach(bobToken, { reach: 'webhook', shape: 'claude_routine', url: ROUTINE })).status, 400)
  const kept = (await hook())!
  assert.deepEqual([kept.url, kept.shape, kept.enc !== null], [OTHER, 'tuff', true])
  const toRoutine = await reach(bobToken, {
    reach: 'webhook',
    shape: 'claude_routine',
    url: ROUTINE,
    authorization: 'Bearer sk-ant-routine',
  })
  assert.equal(toRoutine.status, 200, JSON.stringify(toRoutine.body))
  // A routine is not signed: no secret is shown for it.
  assert.equal(toRoutine.body.secret, undefined)
  r = await row()
  assert.deepEqual([r.webhook_shape, r.webhook_url, r.authorization_set], ['claude_routine', ROUTINE, true])
  // The same routine again needs no token: it keeps its own.
  assert.equal((await reach(bobToken, { reach: 'webhook', shape: 'claude_routine', url: ROUTINE })).status, 200)
  // Back to a plain webhook: the routine's token is not sent to it.
  await reach(bobToken, { reach: 'webhook', url: HOOK })
  const plain = (await hook())!
  assert.deepEqual([plain.shape, plain.enc], ['tuff', null])

  // To MCP: deliveries stop, the address and the key go.
  await reach(bobToken, { reach: 'webhook', url: HOOK, authorization: KEY })
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Before MCP', assignee_ids: [agent] })
  assert.equal(await pending(), 1)
  const toMcp = await reach(bobToken, { reach: 'mcp' })
  assert.equal(toMcp.status, 200)
  assert.equal(toMcp.body.authorization_cleared, true)
  assert.equal(toMcp.body.secret, undefined)
  assert.equal(await hook(), undefined)
  assert.equal(await pending(), 0)
  // Nothing kept on the row it leaves: no address, no secret, no key.
  const [gone] = await owner<{ n: number }[]>`
    select count(*)::int as n from webhook where agent_id = ${agent}
      and (enabled or authorization_enc is not null or url <> '' or secret_enc <> '')`
  assert.equal(gone!.n, 0)
  r = await row()
  assert.deepEqual([r.reach, r.webhook_url, r.authorization_set], ['mcp', undefined, undefined])
  await send('POST', `/api/projects/${p}/tasks`, boss.token, { title: 'Nobody hears', assignee_ids: [agent] })
  seen.length = 0
  await deliverDue(50, catcher, boss.workspaceId)
  assert.equal(seen.length, 0)
  // And back to a webhook: a new secret, once.
  const again = await reach(bobToken, { reach: 'webhook', url: HOOK })
  assert.match(again.body.secret as string, /^whs_/)
  assert.notEqual(again.body.secret, toHook.body.secret)

  // In the audit log by host and what happened to the key, never a key or a path.
  const audit = await send('GET', '/api/audit?type=integrations', boss.token)
  const lines = (audit.body.events as { kind: string; meta: Record<string, unknown> }[]).filter(
    (e) => e.kind === 'agent.reach' && e.meta.agent_id === agent,
  )
  assert.ok(lines.length >= 6, String(lines.length))
  const first = lines[lines.length - 1]!.meta
  assert.deepEqual([first.was, first.reach, first.authorization], ['mcp', 'tuff', 'set'])
  assert.ok(lines.some((e) => e.meta.reach === 'claude_routine'))
  assert.ok(lines.some((e) => e.meta.reach === 'mcp' && e.meta.authorization === 'removed'))
  const text = JSON.stringify(audit.body)
  assert.ok(!text.includes('first-host-key') && !text.includes('sk-ant-routine') && !text.includes('trig_reach'))
})
