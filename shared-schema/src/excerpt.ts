/**
 * The start of a task's description as plain words — what a card and a
 * row say under the title when somebody asks for it.
 *
 * The server works it out in the database, `excerpt_of` in migration 332,
 * and that is the answer every client reads as `excerpt`. This is the same
 * rule written again so the web can draw a description it has just saved
 * before the server's row comes back; the server's answer replaces it, and
 * `server/test/excerpt.test.ts` holds the two to the same output.
 *
 * The rule: the body's nodes in the order they are written, walking only
 * their `content` (an attribute that holds nodes — a task chip's `line` —
 * is not words on the page). Text is its text; a person named is `@Name`;
 * a task chip is its handle and title; a document chip is its title. Every
 * other node — a paragraph's edge, a line break, a picture — is a space.
 * Runs of space are one, the ends are trimmed, and past 160 characters it
 * is cut to 159 and an ellipsis. Nothing to say is null.
 */

/** The most characters an excerpt holds, the ellipsis included. */
export const EXCERPT_MOST = 160
/** How deep the walk goes, as the database's does. */
const DEEPEST = 64
/* The spaces folded into one, named rather than `\s`: what `\s` covers
   differs between JavaScript and a database's locale. */
const SPACES = /[ \t\n\r\f\v ]+/g

type Node = { type?: unknown; text?: unknown; attrs?: Record<string, unknown> | null; content?: unknown }

const str = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null)

function piece(n: Node): string {
  const a = n.attrs && typeof n.attrs === 'object' ? n.attrs : {}
  switch (n.type) {
    case 'text':
      return str(n.text) ?? ''
    case 'mention':
      return `@${str(a.label) ?? ''}`
    case 'taskref': {
      const num = str(a.number)
      const key = str(a.key)
      const handle = num === null ? null : `${key ? `${key}-` : '#'}${num}`
      return [handle, str(a.title)].filter((x): x is string => x !== null).join(' ')
    }
    case 'docref':
      return str(a.title) ?? ''
    default:
      return ' '
  }
}

export function excerptOf(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const out: string[] = []
  const walk = (n: Node, depth: number) => {
    out.push(piece(n))
    if (depth >= DEEPEST || !Array.isArray(n.content)) return
    /* Anything in `content` that is not a node is a space, as it is to the database. */
    for (const k of n.content) walk(k !== null && typeof k === 'object' && !Array.isArray(k) ? (k as Node) : {}, depth + 1)
  }
  walk(body as Node, 0)
  const said = out.join('').replace(SPACES, ' ').replace(/^ +| +$/g, '')
  const chars = Array.from(said)
  if (chars.length > EXCERPT_MOST) return `${chars.slice(0, EXCERPT_MOST - 1).join('').replace(/ +$/, '')}…`
  return said === '' ? null : said
}
