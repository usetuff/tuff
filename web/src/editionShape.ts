import type { ComponentType, ReactNode } from 'react'
import type { Route } from './data/route.js'

/*
 * What a web edition says.
 *
 * `edition.tsx` is the service's and draws what `cloud/` holds: the site
 * and its pages, the plans and every way up one, the operators' screen and
 * its door. The mirror copies `edition.community.tsx` over it, and that one
 * draws none of them: `/` is the app's own sign-in, nothing says a price or
 * a plan, and nobody runs the product but the server's owner. The core asks
 * this shape and never imports `cloud/` itself, so what only the service
 * says is absent from the edition's code rather than switched off in it.
 */

/** What of `/api/me` the edition reads to decide whether to offer a way up. */
export type AskedMe = {
  plan?: string
  can?: readonly string[]
  workspace?: { slug: string }
}

export type WebEdition = {
  /**
   * The page at an address before the app, or null for the app. `path` is
   * the address without its `/fr`; `signedIn` whether this browser holds a
   * session.
   */
  page(path: string, signedIn: boolean): ReactNode | null
  /** Once, as the page loads: what the site keeps or counts before the app. */
  boot(path: string, signedIn: boolean): void
  /** Once signed in, before the app is drawn: true when the browser is leaving (to pay). */
  beforeApp(can: readonly string[]): Promise<boolean>
  /** Where to go after signing in, when the edition kept somewhere: a board to save, a code to apply. */
  returnTo(): string | null
  /**
   * What a new workspace holds before it is upgraded, for inviting into it:
   * how many, the line past that with the way up, and what a refused
   * invitation may have met. Null for no ceiling.
   */
  newWorkspaceCeiling: { people: number; Over: ComponentType<{ slug: string; left: number }>; refused: string } | null
  /** A workspace's plan by the name a person reads, from its row in the switcher; null where it says none. */
  planOf: ((w: { id: string }) => string | null) | null
  /** The bar's way up a plan, for whoever pays; drawn on a wide screen only. */
  BarUpgrade: ComponentType<{ me: AskedMe }> | null
  /** The way up beside an invitation the workspace was full for, to its owner. */
  InviteFull: ComponentType | null
  /** The plus's agents tab where the plan holds agents back: whether it does for this person, and what it says instead. */
  agentsLocked: { when(me: AskedMe): { to?: string } | null; Body: ComponentType<{ to?: string }> } | null
  /** A project's feedback page where the plan does not have one. */
  FeedbackLocked: ComponentType<{ owner: boolean }> | null
  /** The account's tokens where the plan holds agents back; `onSettings` for whoever may change it. */
  TokensLocked: ComponentType<{ onSettings?: () => void }> | null
  /** The workspace's plan, in its settings. */
  Plan: ComponentType | null
  /** The workspace's own domain, in its settings, for its owner. */
  Domain: ComponentType<{
    look: { id: string; brand?: import('@tracker/shared-schema').Brand | null | undefined }
    /** What it shows changed what `/api/me` says — a domain that stopped,
        connected again or removed — so the dot on Settings is asked again. */
    onChanged?: () => void
  }> | null
  /** The settings' lines that say more where there are plans: what a new owner takes on, and that deleting cancels what is paid for. */
  settingsSays: { newOwnerTakes: string; paidCancelled: string } | null
  /** What a provider's sign-in came back saying that only the service says, or null. */
  trouble(said: string): string | null
  /** An audit log line only the service writes, by its kind and who did it, or null. */
  auditLine(kind: string, who: string): string | null
  /**
   * The people who run the product: their door's
   * name, who may open it, the screen at `/admin` (the rest of its address
   * as `path`), and what deleting an account is refused for when they are
   * one. Null where nobody runs it but the server's owner.
   */
  admin: {
    label: string
    may(can: readonly string[]): boolean
    Screen: ComponentType<{ path?: string; onGo: (to: Route) => void }>
    refusal(why: string): string | null
  } | null
  /** What the workspace's settings read ahead, beside the core's. */
  settingsReads(can: readonly string[]): string[]
  /**
   * The service's own names — where people write for help, and the domain
   * its letters come from. Null on your own server, which is nobody's but
   * its owner's: a screen says to ask the owner, and an inbox is opened
   * without looking for the service's letters.
   */
  vendor: { support: string; mailDomain: string } | null
  /** Whether help (`/help`) and the legal pages (`/terms`, `/privacy`) are here to link to. */
  help: boolean
  legal: boolean
}
