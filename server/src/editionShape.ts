import type { Context, Hono } from 'hono'
import type { UpgradeWebSocket, WSContext } from 'hono/ws'
import type postgres from 'postgres'
import type { Tx } from './db.js'
import type { Host } from './host.js'

/*
 * What an edition says.
 *
 * Two files answer it: `edition.ts`, the service's, which mounts what
 * `cloud/` holds, and `edition.community.ts`, which the mirror copies over
 * it and which mounts nothing. The core asks this shape and never imports
 * `cloud/` itself, so a tree without that folder builds or says why not.
 */

// The app's own type is the core's; an edition mounts on whatever it is given.
type App = Hono<any>

/** A socket held on a topic for as long as it is open — `main.ts`. */
export type Holding = () => {
  on(
    ws: WSContext,
    topic: string,
    actorId: string,
    still: () => Promise<boolean>,
    hears?: (e: { kind: string; payload: unknown }) => Promise<boolean>,
  ): Promise<void>
  off(): void
}

/**
 * One signed-in request, answered, or a stretch of editing a document.
 * Its route's pattern, never its address: no id of
 * any object, no content, no address or browser.
 */
export type Use = {
  workspaceId: string
  actorId: string
  /** `GET`, `POST`…; `WS` for what a socket did. */
  method: string
  /** The route as written, `/api/tasks/:id`; for a socket, what it was. */
  route: string
  status: number
  /** What the handler said the request was, when the route alone cannot. */
  said: string | null
  /** An agent's tool, named on the first request it makes — `mcp/tools.ts`. */
  tool: string | null
}

/** A refusal as it is answered: its code, and the words a screen shows. */
export type Refusal = { error: { code: string; message: string } }

/**
 * What a workspace is held to, and what a refusal for it says — the
 * service's plans (`cloud/ceilings.ts`). A server of one's own has none:
 * every workspace holds as many people, bytes and agents as it likes.
 */
export type Ceilings = {
  /** Whether `size` more bytes fit the workspace, at a first look. */
  fits(tx: Tx, workspaceId: string, size: number): Promise<boolean>
  /** The same, asked again under a lock once the bytes are stored. */
  roomFor(tx: Tx, workspaceId: string, size: number): Promise<boolean>
  /** Whether the workspace holds as many people as it may, invitations waiting counted. */
  full(tx: Tx, workspaceId: string): Promise<boolean>
  /** Whether a workspace on this plan is held back from agents and a feedback page. */
  free(plan: string): boolean
  says: {
    /** To whoever invites into a full workspace. */
    full: Refusal
    /** To whoever follows a link into one. */
    fullAsk: Refusal
    /** To whoever uploads past the bytes. */
    storage: Refusal
    /** To an agent, a token or a connection where agents are held back. */
    agents: Refusal
    /** To whoever sets up a feedback page where it is held back. */
    feedback: Refusal
  }
}

/**
 * A workspace's own domain. The service's
 * only: a server of one's own already has an address of its own.
 */
export type Hosts = {
  /** Before any route: a request through the Worker with a good signature
      is its workspace's (`host` on the request), meets the host's
      allow-list, or is redirected to the same path here. */
  mount(app: App): void
  /** Routes of its own before the bearer: signing in by a code on a host. */
  open(app: App): void
  /** A workspace's connected domain on a branded plan, as an origin; null
      for none. Read under the policies in a request, by the worker's own
      function in the worker. */
  originOf(tx: Tx, workspaceId: string): Promise<string | null>
  /** The same domain with its id, read under the policies — what an
      invitation's letter links to and is bound to. */
  domainOf(tx: Tx, workspaceId: string): Promise<{ id: string; hostname: string } | null>
  /** `POST /auth/invite/:token/accept` through a host: never a password —
      always the host's code, never the token. */
  acceptInvite(c: Context, host: Host, token: string): Promise<Response>
  /** A connected, branded domain by the id the server sealed into a
      provider's start: where its ticket may go. */
  byId(domainId: string): Promise<{ hostname: string; workspaceId: string } | null>
  /** Whether a name still opens this workspace: a session made on it is
      nobody anywhere once it does not. */
  answers(hostname: string, workspaceId: string): Promise<boolean>
}

/** A loop the worker runs, waiting `every` milliseconds between runs. */
export type Job = { every: number; run: () => Promise<void> }

export type Edition = {
  /**
   * Whether a workspace's plan limits it — agents, a feedback page, people
   * and bytes. Off, `can()` is never told a plan, so nothing is refused for
   * one, and the byte ceiling is not asked.
   */
  plans: boolean
  /** What a workspace is held to; null for nothing at all — `Ceilings`. */
  ceilings: Ceilings | null
  /**
   * Whether a workspace on a plan that says so wears its own name and mark
   * on what it shows to people. Off, the
   * database is never asked and every answer's `brand` is null.
   */
  brands: boolean
  /** A workspace's own domain; null where there are none — `Hosts`. */
  hosts: Hosts | null
  /**
   * The French of the messages only this edition's own routes send, beside
   * the core's (`words.ts`): exact, and matched whole with a number in it.
   */
  errorsFr: Record<string, string>
  errorsFrLike: [RegExp, (m: RegExpExecArray) => string][]
  /** Whether the deployment's operators (`OPERATORS`, `/admin`) exist at all. */
  operators: boolean
  /**
   * Whether the server has instance owners and closed sign-up.
   * Off on the service: sign-up is open, nobody
   * owns the server, and `/api/instance` answers 404. On your own server
   * the first account owns it and sign-up is closed after it.
   */
  instance: boolean
  /**
   * Whether migrating dumps the database first — `backup.ts`,
   * On your own server, into
   * `BACKUP_DIR` before anything pending is applied. Off on the service,
   * whose platform keeps backups of its own.
   */
  backups: boolean
  /**
   * Whether a production server refuses to start when the role it queries
   * as is one row-level security does not bind — a superuser, `BYPASSRLS`,
   * or the tables' owner (`rlsGuard.ts`). On your own server, where a
   * missing `DATABASE_URL_APP` would go unseen in a log nobody reads. Off
   * on the service until its variables are checked; it says so loudly at
   * every start instead. The security audit spec, the sixth audit.
   */
  rlsFailClosed: boolean
  /**
   * The plan a new workspace is made on. Null is the database's own default
   * (`solo`, the service's free plan); the community edition makes every
   * workspace `unlimited`, whose people ceiling is none.
   */
  newWorkspacePlan: string | null
  /**
   * Which way mail goes — `mail.ts`, `senderFor`. `resend`, the service's:
   * through Resend or nowhere, and `SMTP_URL` is never read. `smtp`, your
   * own server's: through the SMTP it was given, else Resend, else nowhere.
   */
  mail: 'resend' | 'smtp'
  /**
   * The service's own names, for what a deployment leaves unset: where
   * people write for help, who letters are from, the push contact, the
   * Apple apps' bundle and team. Null on your own server, which is nobody's
   * but its owner's: a letter says to ask the owner, mail and push take
   * the server's own settings or are refused at start, and no app is
   * claimed — `docs/self-hosting.md`.
   */
  vendor: {
    /** `APP_URL` when it is unset, for what has no request to take an address from: a bot's name, a Slack message. */
    site: string
    /** Where somebody writes to bring a workspace back or report a change they did not make. */
    support: string
    /** `MAIL_FROM` when it is unset. */
    mailFrom: string
    /** `VAPID_SUBJECT` when it is unset. */
    vapidSubject: string
    /** `APNS_TOPIC` when it is unset: the Apple apps' bundle id. */
    apnsTopic: string
    /** `APPLE_APP_ID` when it is unset: the team and bundle the Apple apps are signed as. */
    appleAppId: string
    /** `ANDROID_PACKAGE` when it is unset: the Android app's package. */
    androidPackage: string
  } | null

  /** Beside the core's own response headers, ahead of every limit, so an
      answer cut short by one still carries them. */
  headers(app: App): void
  /** Before any body is read: limits and gates for routes of its own. */
  early(app: App): void
  /** Routes answered before the bearer is asked for. */
  open(app: App): void
  /** Whether an `/api/…` path is one `open` answers, so the bearer lets it by. */
  openApi(path: string): boolean
  /** Signed-in routes, under `/api`. */
  api(app: App): void
  /** Routes outside `/api` with nobody signed in behind them: deliveries, a board's MCP. */
  outside(app: App): void

  /** Sockets of its own, beside the core's three. */
  sockets(s: { app: App; upgradeWebSocket: UpgradeWebSocket; holding: Holding }): void
  /** The public pages written by the build, and what `/` is before the app answers it. */
  site(s: { app: App; client: string; withWays: (html: string) => string }): void
  /** Once, before the server listens. */
  starting(s: { client: string; appUrl: string }): void
  /** Every error line, to wherever somebody is told. */
  watchErrors(service: string): void
  /** After migrating, as the table owner. */
  migrated(sql: postgres.Sql): Promise<void>
  /**
   * Once before the server serves, every start, as the table owner —
   * whether or not this start migrated, so nothing the edition needs from
   * the database waits on how the schema got there.
   */
  ready(sql: postgres.Sql): Promise<void>

  /**
   * A request or an edit, after it was answered — counted by feature on the
   * service; your own server keeps and sends
   * nothing. Synchronous and cheap: it is on every request's way out.
   */
  used(u: Use): void
  /** What was counted and not yet written, written — on the way down. */
  usedFlush(): Promise<void>

  /**
   * Paid plans stopped before what they paid for goes, by `actorId` (the
   * owner, or an operator): null once they are, or the refusal to answer
   * with, nothing deleted, when they could not be.
   */
  cancelSubscriptions(ids: string[], actorId: string): Promise<Refusal | null>
  /** What deleting an account that runs the deployment is refused with; null where nobody does. */
  operatorRefusal: Refusal | null
  /**
   * The lines of the owners' letters that name a plan — a workspace handed
   * over, a workspace deleted by its owner — in English and French; null
   * where there are no plans, and the core's own lines are sent.
   */
  planMail: {
    took: readonly [(where: string) => string, (where: string) => string]
    deletedMine: readonly [(place: string) => string, (place: string) => string]
  } | null
  /** The worker's loops of its own; `turned` is when the core's last came round. */
  jobs(w: { turned: () => number }): Job[]
}
