/*
 * Where what an agent reads about this server is.
 * Named once, for the discovery documents (`discovery.ts`) and for the
 * `Link` header the service's own pages carry (`cloud/site.ts`), and
 * importing nothing, so the service's site can read it without the core.
 */

/*
 * The contract as it is published: the public repository, the same tree
 * this server is built from. There is no OpenAPI document — the schema
 * generated from the Zod types is the machine-readable half and
 * `docs/api.md` the readable one, and a third copy written by hand would
 * be the one that drifts.
 */
export const CONTRACT = {
  doc: 'https://github.com/usetuff/tuff/blob/main/docs/api.md',
  mcpDoc: 'https://github.com/usetuff/tuff/blob/main/docs/api.md#mcp',
  schema: 'https://raw.githubusercontent.com/usetuff/tuff/main/shared-schema/generated/api.schema.json',
}

/** RFC 9727's place for the list of APIs. */
export const CATALOG = '/.well-known/api-catalog'
/** The agent-skills discovery index, and the one skill in it. */
export const SKILLS = '/.well-known/agent-skills/index.json'
export const SKILL = '/.well-known/agent-skills/tuff/SKILL.md'
/** Agentic Resource Discovery's manifest, and the name it had before. */
export const ARD = '/.well-known/ard.json'
export const ARD_BEFORE = '/.well-known/ai-catalog.json'
