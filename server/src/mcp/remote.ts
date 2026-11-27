import { Hono } from 'hono'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticate } from '../auth/context.js'
import { origin } from '../http/oauth.js'
import { PER_TOKEN, personOf, spend, workspaceAllowance } from '../http/limits.js'
import { tuffServer, type Call } from './tools.js'

/**
 * The MCP server at an address.
 *
 * For an agent that lives on somebody else's servers — ChatGPT, Claude on
 * the web — and can only reach one over HTTPS. The tools are the local
 * server's, and each is still a request to the REST API as the person: made
 * inside this process rather than across the network, through the same
 * routes, checks and limits. A second way into the data would be a second
 * permission model.
 *
 * Stateless: each POST is answered on its own, so a deploy or a second
 * instance loses nothing, and there is no session to keep or to steal.
 */
export const remote = new Hono()

remote.post('/mcp', async (c) => {
  const header = c.req.header('authorization') ?? ''
  const ctx = header ? await authenticate(header) : null
  /* Only a token: a session's signed token belongs to a window, and the
     matrix's refusals for connected tools are keyed on a token. The 401
     says where to sign in, which is how a client finds out. */
  if (!ctx?.viaMcp) {
    c.header('www-authenticate', `Bearer resource_metadata="${origin(c)}/.well-known/oauth-protected-resource"`)
    return c.json({ error: 'invalid_token', error_description: 'Connect Tuff to get a token.' }, 401)
  }

  /* Imported here, not above: the routes mount this file, and the app has
     to exist before anything can be asked of it. */
  const { app } = await import('../http/routes.js')
  /* What proved the request came through Cloudflare, and who sent it, said
     again on each call inside: the gate in front of every route asks the
     inner request too, and without it every tool was answered "Not found"
     in production and nowhere else — the tests run with no secret set. */
  const edge: Record<string, string> = {}
  for (const name of ['x-origin-secret', 'cf-connecting-ip', 'x-forwarded-for']) {
    const value = c.req.header(name)
    if (value) edge[name] = value
  }
  const call: Call = async (path, init = {}) => {
    const res = await app.request(path, {
      ...init,
      headers: {
        ...edge,
        /* A file goes up as a form, which says its own type and boundary. */
        ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        'x-api-version': '1',
        authorization: header,
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string } }).error
      throw new Error(`${e?.code ?? res.status}: ${e?.message ?? 'refused'}`)
    }
    return body
  }

  /* No session id generator is what makes it stateless. */
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
  /* Each body read in the shared pool spends one request of the token's
     minute first, and is read under the person's key, so the pool's
     per-caller cap holds for one person however many tokens they hold,
     the night audit (12). */
  const reader = {
    key: `person:${ctx.actorId}`,
    /* And its person's minute, as every other request through a token
       spends (`rateLimit`): without it twenty-five tokens of one person
       had their bodies read past the twelve hundred (the eighth audit). */
    spend: () =>
      personOf(ctx)
        .then((person) => spend(`t:${ctx.tokenId}`, PER_TOKEN, `w:${ctx.workspaceId}`, workspaceAllowance(ctx.workspaceId), `a:${person}`))
        .catch(() => true),
  }
  await tuffServer(call, origin(c), reader).connect(transport)
  return transport.handleRequest(c.req.raw)
})

/* Nothing to stream to a client that has not asked, and no session to end. */
remote.on(['GET', 'DELETE'], '/mcp', (c) => {
  c.header('allow', 'POST')
  return c.body(null, 405)
})
