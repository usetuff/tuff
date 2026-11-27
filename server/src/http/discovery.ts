import { createHash } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { edition } from '../edition.js'
import { ABOUT, INSTRUCTIONS } from '../mcp/tools.js'
import { origin } from '../publicUrl.js'
import { ARD, ARD_BEFORE, CATALOG, CONTRACT, SKILL, SKILLS } from './published.js'

/**
 * Where an agent finds this server's API and its MCP server without being
 * told.
 *
 * Every server is a Tuff with the REST API at `/api` and the MCP server at
 * `/mcp`, the service and a server of one's own alike, so both answers are
 * the core's and name the server they are asked of: the address the world
 * reaches it at (`origin`), never usetuff.com from somebody else's server.
 *
 * - `/.well-known/api-catalog` — RFC 9727: the two APIs, with what
 *   describes each.
 * - `/.well-known/agent-skills/index.json` — the agent-skills discovery
 *   index (Cloudflare's draft, v0.2.0): one skill, how to connect the MCP
 *   server and work through it, as `SKILL.md` beside it.
 * - `/.well-known/ard.json` — Agentic Resource Discovery (v0.91, a
 *   proposal; Lighthouse checks it): the MCP server and the skill, as
 *   entries; and at `/.well-known/ai-catalog.json`, its old name, which
 *   Lighthouse still asks for and which answered the app's page.
 *
 * Nothing here is a second way into the data: each is a page of
 * addresses, and every address still answers only what it answered before.
 */
export const discovery = new Hono()

const PROFILE = 'https://www.rfc-editor.org/info/rfc9727'

/* An hour: what these say changes with a deployment, not by the minute. */
const kept = (c: Context) => c.header('cache-control', 'public, max-age=3600')

/* ------------------------------------------------------------ api-catalog */

/** The catalog, for the server at `at`. */
export function apiCatalog(at: string): object {
  return {
    linkset: [
      {
        anchor: `${at}${CATALOG}`,
        item: [{ href: `${at}/api` }, { href: `${at}/mcp` }],
      },
      {
        anchor: `${at}/api`,
        'service-desc': [{ href: CONTRACT.schema, type: 'application/schema+json' }],
        'service-doc': [{ href: CONTRACT.doc, type: 'text/html' }],
        status: [{ href: `${at}/health`, type: 'application/json' }],
      },
      {
        anchor: `${at}/mcp`,
        'service-doc': [
          { href: `${at}${SKILL}`, type: 'text/markdown' },
          { href: CONTRACT.mcpDoc, type: 'text/html' },
        ],
        /* Who signs an agent in to it, which is what a client asks first. */
        'service-meta': [{ href: `${at}/.well-known/oauth-protected-resource/mcp`, type: 'application/json' }],
      },
    ],
  }
}

/* The answer to GET and to HEAD alike — Hono answers a HEAD with the GET's
   headers and no body — and a HEAD must carry the relation (RFC 9727, 2). */
discovery.get(CATALOG, (c) => {
  kept(c)
  c.header('link', `<${origin(c)}${CATALOG}>; rel="api-catalog"`)
  c.header('content-type', `application/linkset+json; profile="${PROFILE}"`)
  return c.body(JSON.stringify(apiCatalog(origin(c)), null, 2))
})

/* ---------------------------------------------------------- agent skills */

/*
 * The skill: what Tuff is, how to connect, what the tools are and how to
 * work there. The tools' names and titles are the server's own table and
 * the way of working is what the server says when an agent connects
 * (`mcp/tools.ts`), so the skill cannot promise a tool the server lacks.
 */
export function skill(at: string): string {
  const tools = Object.entries(ABOUT)
    .map(([name, said]) => `- \`${name}\` — ${said.title}${said.readOnlyHint ? ' (reads only)' : ''}`)
    .join('\n')
  const paid = edition.plans ? ' Agents connect to a workspace on a paid plan; one on the free plan is refused.' : ''
  return `---
name: tuff
description: Work in a Tuff workspace through its MCP server at ${at}/mcp — read and move tasks, write documents, post announcements and send messages. Use when asked about work, tasks, docs or chat kept in Tuff.
---

# Tuff

Tuff is a project manager for teams and their AI agents: projects hold tasks, documents, announcements and chat. This server is at ${at}.

## Connect

The MCP server is \`${at}/mcp\`: Streamable HTTP, signed in with OAuth. A client finds who signs it in at \`${at}/.well-known/oauth-protected-resource\`, sends the person to Tuff to allow it, and gets a token. Nothing to copy or install.

- Claude Code: \`claude mcp add --transport http tuff ${at}/mcp\`, then Authenticate in \`/mcp\`.
- Claude, ChatGPT and other clients: add \`${at}/mcp\` as a custom connector.

The agent works as the person who connected it, with that person's rights, and the activity feed says so. It can never delete anything.${paid}

## Tools

${tools}

## How to work in Tuff

${INSTRUCTIONS}

## More

- The REST API the tools call: ${CONTRACT.doc}
- Every API this server has: ${at}${CATALOG}
`
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The index, whose digest is of the exact bytes `SKILL.md` answers. */
export function skillsIndex(at: string): object {
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'tuff',
        type: 'skill-md',
        description: `Connect to Tuff's MCP server at ${at}/mcp and work in a Tuff workspace: tasks, documents, announcements and chat.`,
        url: SKILL,
        digest: `sha256:${sha256(skill(at))}`,
      },
    ],
  }
}

discovery.get(SKILLS, (c) => {
  kept(c)
  return c.json(skillsIndex(origin(c)))
})

discovery.get(SKILL, (c) => {
  kept(c)
  c.header('content-type', 'text/markdown; charset=utf-8')
  return c.body(skill(origin(c)))
})

/* ------------------------------------------------- agentic resource discovery */

/**
 * The manifest, for the server at `at`: one entry for the MCP server and
 * one for the skill. An identifier is `urn:air:<the server's host>:<name>`,
 * the host without a port, which the form does not allow. The MCP server
 * is described in the entry itself (`data`) rather than by a server card,
 * a draft of MCP's own this server does not publish; the skill points at
 * the skills index above.
 */
export function ardManifest(at: string): object {
  const host = new URL(at).hostname
  return {
    entries: [
      {
        identifier: `urn:air:${host}:mcp`,
        displayName: 'Tuff MCP server',
        type: 'application/mcp-server-card+json',
        data: {
          name: 'tuff',
          url: `${at}/mcp`,
          transport: 'streamable-http',
          authorization: `${at}/.well-known/oauth-protected-resource/mcp`,
          documentation: CONTRACT.mcpDoc,
        },
        description:
          'Tasks, documents, announcements and chat in a Tuff workspace, read and written as the person who connected the agent.',
        capabilities: Object.keys(ABOUT),
        representativeQueries: [
          'what is assigned to me in Tuff',
          'move this task to Done in Tuff',
          'write the meeting notes into a Tuff document',
        ],
      },
      {
        identifier: `urn:air:${host}:skill:tuff`,
        displayName: 'Tuff skill',
        type: 'application/agent-skills+json',
        url: `${at}${SKILLS}`,
        description: "How to connect to Tuff's MCP server and work in a Tuff workspace.",
        representativeQueries: ['how do I connect an agent to Tuff', 'work on my Tuff tasks'],
      },
    ],
  }
}

for (const path of [ARD, ARD_BEFORE]) {
  discovery.get(path, (c) => {
    kept(c)
    return c.json(ardManifest(origin(c)))
  })
}
