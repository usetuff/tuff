import type { WebEdition } from './editionShape.js'

/*
 * Tuff on your own server.
 *
 * The mirror copies this file over `edition.tsx`, and the tree it copies
 * has no `cloud/` folder: no landing, so `/` is the app's sign-in; no plans,
 * so nothing offers an upgrade, names a plan or says a price; no operators,
 * so no door to them; and none of the service's addresses — help is the
 * owner of this server.
 */
export const edition: WebEdition = {
  beforeApp: async () => false,
  returnTo: () => null,
  newWorkspaceCeiling: null,
  planOf: null,
  BarUpgrade: null,
  InviteFull: null,
  agentsLocked: null,
  FeedbackLocked: null,
  TokensLocked: null,
  Plan: null,
  /* None: your own server already has an address of its own. */
  Domain: null,
  settingsSays: null,
  trouble: () => null,
  auditLine: () => null,
  admin: null,
  settingsReads: () => [],
  vendor: null,
  help: false,
  legal: false,
}
