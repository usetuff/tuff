import { commentsAfter, issuesOf, shapeOf, upload, type Cycle, type Issue, type State } from './linear.js'
import { cut, fileOf, kitOf, PAGES_A_TURN, talk, turn, wentThrough, writePage, type Claimed } from './importKit.js'

/**
 * A Linear team's turn of an import. The
 * writing, the waits and the endings are every import's (`importKit.ts`);
 * this is how Linear is read.
 */
export function linearTurn(job: Claimed, key: string): Promise<number> {
  const kit = kitOf(job)
  const { ours, put, save } = kit
  return turn(job, async (pages) => {
    for (const team of job.teams) {
      const p = (job.progress[team.id] ??= {})
      if (p.done) continue
      const { states, cycles } = await shapeOf(key, team.id)
      if (!p.project_id) {
        const made = await ours<{ project_id: string }>('/import/linear/project', { team, states, cycles })
        p.project_id = made.project_id
        p.issues = 0
        await save()
      }
      const stateName = new Map(states.map((s: State) => [s.id, s.name]))
      const cycleName = new Map(cycles.map((c: Cycle) => [c.id, c.name || `Sprint ${c.number}`]))
      for (;;) {
        if (pages.n >= PAGES_A_TURN) {
          await save(true)
          return 'later'
        }
        const read = await issuesOf(key, team.id, p.cursor ?? null)
        /* What Linear has archived it hides — its own sample issues among
           them, canceled and put away — so it is not brought either. */
        const page = { ...read, issues: read.issues.filter((i) => !i.archivedAt) }
        /* What is here already is not brought again — nor its files. */
        const { have } = page.issues.length
          ? await ours<{ have: number[] }>('/import/linear/have', { project_id: p.project_id, numbers: page.issues.map((i) => i.number) })
          : { have: [] as number[] }
        const fresh = page.issues.filter((x) => !have.includes(x.number))
        for (const [at, i] of fresh.entries()) {
          /* A page's files take the longest; how far through it is, said
             as it goes. */
          p.reading = at
          if (at % 5 === 0) await save()
          const more = i.moreComments ? await commentsAfter(key, i.id, i.moreComments) : []
          const said = talk(
            [...i.comments.nodes, ...more].map((c) => ({ body: c.body ?? '', createdAt: c.createdAt, user: c.user })),
            'linear',
          )
          const words = await withFiles(key, (file) => put(p.project_id!, file), bodyOf(i))
          await writePage(job, kit, p, [
            {
              number: i.number,
              title: (i.title || `Issue ${i.number}`).slice(0, 1000),
              body: cut([words, said.note].filter(Boolean).join('\n\n'), 200_000, 'linear'),
              priority: i.priority ?? 0,
              dueDate: i.dueDate,
              createdAt: i.createdAt,
              completedAt: i.completedAt ?? i.canceledAt,
              state: i.state ? (stateName.get(i.state.id) ?? null) : null,
              assignee: i.assignee,
              creator: i.creator,
              labels: [...i.labels.nodes.map((l) => l.name), ...(i.project ? [`Project: ${i.project.name}`] : [])],
              cycle: i.cycle ? (cycleName.get(i.cycle.id) ?? null) : null,
              /* A parent in another team is not here to point at. */
              parent: i.parent && i.parent.team.id === team.id ? i.parent.number : null,
              comments: said.kept.map((c) => ({ ...c, body: cut(c.body, 100_000, 'linear') })),
            },
          ])
        }
        p.reading = 0
        p.cursor = page.next
        pages.n += 1
        wentThrough(job)
        if (!page.next) {
          await ours('/import/linear/parents', { project_id: p.project_id })
          p.done = true
          await save()
          break
        }
        await save()
      }
    }
    return 'done'
  })
}

/** What the issue said, with what has no field here said first. */
function bodyOf(i: Issue): string {
  const facts = [i.estimate != null ? `Estimate: ${i.estimate}` : null].filter(Boolean)
  return [facts.join(' · '), i.description ?? ''].filter(Boolean).join('\n\n')
}

/**
 * Linear's pictures and files, kept as the project's: they are behind the
 * key, so a link to one is a link nobody here can open. Bounded patterns —
 * this is somebody else's text. One that will not come stays its address.
 */
async function withFiles(key: string, put: (file: File) => Promise<string | null>, text: string): Promise<string> {
  if (!text.includes('uploads.linear.app')) return text
  let out = text
  const found = [...text.matchAll(/!?\[([^\]\n]{0,200})\]\((https:\/\/uploads\.linear\.app\/[^\s)]{1,2000})\)/g)].slice(0, 20)
  for (const m of found) {
    const got = await upload(key, m[2]!)
    if (!got) continue
    const file = fileOf(got.bytes, got.type, m[1] || got.name)
    const id = await put(file)
    if (id) out = out.replace(m[0], () => `\n\n![${file.name}](file:${id})\n\n`)
  }
  return out
}
