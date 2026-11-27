/**
 * What the endpoints answer with, as opposed to what the tables hold.
 *
 * `entities.ts` describes the objects. This describes the shapes those
 * objects arrive in, which are not the same thing and never were:
 *
 * - a row carries `icon_key`, a response carries `icon_url` — a signed link
 *   good for an hour, because there are no public URLs and the client must
 *   never see a key;
 * - a person arrives as a membership, so `actor_id` rather than `id`, with
 *   the role and the presence joined on;
 * - a project arrives with `can`, the actions this reader may take in it,
 *   worked out from rights already loaded rather than asked per screen.
 *
 * Until this file existed the web client hand-wrote all of it. The project's handbook
 * says client types are generated and never hand-written, and that was true
 * of Swift and Kotlin and false of the one client that exists: `generate`
 * emitted no TypeScript, so there was nothing to import and twelve files
 * each kept their own idea of a person.
 *
 * The cost of that was not theoretical. Adding a picture to a person meant
 * finding every local declaration that had to learn the field, and three
 * separate times a face failed to draw because the server was sending
 * something a hand-written type refused to carry. A shape written once is a
 * shape that cannot disagree with itself.
 *
 * These are **response** schemas, so they are deliberately loose where the
 * server is loose: a field the endpoint only sometimes computes is optional
 * here, and saying otherwise would be a contract the server does not keep.
 */
import { z } from 'zod'
import { RichText, Uuid } from './primitives.js'
import { Action, WorkspaceSettings } from './permissions.js'
import { Presence, Role } from './enums.js'
import { Project, Task, Message, Comment, Post } from './entities.js'
import { Repeat } from './repeat.js'

/**
 * A link this product made, never one pointing out of it.
 *
 * `/api/blob/<key>?token=…` — relative, signed over the key and an expiry.
 * It is a plain string rather than a url: an absolute URL is the one shape
 * this must not be. `docs/specs/avatar.md`.
 */
export const SignedLink = z.string()

/** A picture somebody uploaded, or null for the generated mark. */
const picture = { avatar_url: SignedLink.nullable().optional() }

/**
 * What an agent says it is doing now. Live
 * only: a status older than three minutes is in no answer, and `until` is
 * when this one stops being shown. `since` is when it began on this task;
 * `at` when it last said so. `task_id`, `project_id` and `task_number` are
 * null for a status that names no task; one that names a task reaches only
 * whoever can see it. `doing` is the agent's own words: project text.
 */
export const AgentStatus = z.object({
  agent_id: Uuid,
  task_id: Uuid.nullable(),
  project_id: Uuid.nullable(),
  task_number: z.number().int().nullable(),
  /* The room and the thread it is said for, or null — optional, since an
     answer from before has neither. */
  conversation_id: Uuid.nullable().optional(),
  thread_id: Uuid.nullable().optional(),
  doing: z.string(),
  since: z.string(),
  at: z.string(),
  until: z.string(),
})
/** `GET /api/working`: the live statuses the reader may see. */
export const AgentStatusList = z.object({ working: z.array(AgentStatus) })
/** `PUT /api/me/status`: what is said now, or null once it is taken away. */
export const AgentStatusSet = z.object({ status: AgentStatus.nullable() })

/**
 * An agent at work in a room.
 * Woken there for a message, or saying it is: `thread_id` is the thread it
 * was called in (null for the room's own line), `message_id` the message it
 * was called for, `doing` its own words when it has said some (project
 * text), and `until` when it stops being shown.
 */
export const AgentInRoom = z.object({
  agent_id: Uuid,
  name: z.string(),
  thread_id: Uuid.nullable(),
  message_id: Uuid.nullable(),
  doing: z.string().nullable(),
  until: z.string(),
})
/** `GET /api/conversations/:id/working`. */
export const AgentInRoomList = z.object({ working: z.array(AgentInRoom) })

/**
 * Somebody in this workspace, as `/api/people` and the member lists answer.
 *
 * `actor_id`, not `id`: this is a membership with the actor joined on, and
 * calling it `id` would make a person look like a row of one table when they
 * are a row of two.
 */
export const PersonInWorkspace = z.object({
  actor_id: Uuid,
  name: z.string(),
  ...picture,
  role: Role.or(z.string()).nullable().optional(),
  joined_at: z.string().nullable().optional(),
  /** Here, away or busy — derived, never stored. `docs/specs/presence.md`. */
  presence: Presence.nullable().optional(),
  /**
   * What the owner said about this person — `docs/specs/member-rights.md`.
   * `may_create_projects` null follows the workspace switch;
   * `creates_projects` is the answer either way.
   */
  may_create_projects: z.boolean().nullable().optional(),
  /** What they do, in their own words — sent where a list shows it. */
  title: z.string().nullable().optional(),
  may_create_channels: z.boolean().optional(),
  creates_projects: z.boolean().optional(),
  /** The same about the Members screen and inviting: `may_*` null follows
      the switch, the other is the answer — `docs/specs/member-rights.md`. */
  may_see_members: z.boolean().nullable().optional(),
  may_invite_people: z.boolean().nullable().optional(),
  sees_members: z.boolean().optional(),
  invites_people: z.boolean().optional(),
  /** Connecting agents: the owner's word about this person, and the answer. */
  may_connect_agents: z.boolean().optional(),
  connects_agents: z.boolean().optional(),
  /** An agent, not a person: drawn apart, takes no seat. */
  agent: z.boolean().optional(),
  /** An agent's last visit, sent for agents only — a task it has in progress shows it working while it keeps coming. */
  active_at: z.string().nullable().optional(),
  /** What an agent says it is doing now, for agents only; null when nothing live, or its task is one the reader cannot see. */
  status: AgentStatus.nullable().optional(),
  /**
   * Whose agent it is — the name of whoever connected it, for agents only and
   * only in `/projects/:id/members`; null when nobody's is known. The panel
   * that chooses a document's people says it under the agent's name.
   */
  connected_by_name: z.string().nullable().optional(),
})

/** The same person, as a project's member list answers: with their rights. */
export const PersonInProject = PersonInWorkspace.extend({
  /* Always sent by `/projects/:id/members` — the whole reason that list is
     separate from `/people` is that it answers what somebody may do here. */
  rights: z.array(z.string()),
})

/**
 * A project as the lists answer, which is the row plus two computed things.
 *
 * `icon_url` is signed from `icon_key`, which does not leave the server.
 * `can` is what this reader may do here — held on a project, so `/api/me`
 * cannot answer it and a screen that asked per project would ask again on
 * every switch.
 */
export const ProjectInList = Project.partial({
  created_at: true,
  updated_at: true,
  deleted_at: true,
  workspace_id: true,
}).extend({
  icon_url: SignedLink.nullable().optional(),
  /** What its mark was chosen to be — a glyph's name and a tint, 0–9 — or
      null for what its id gives. */
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
  can: z.array(Action.or(z.string())).optional(),
  /** The project's instructions for agents — one written document it marked
      so, or null; on `GET /api/projects/:id` only. */
  for_agents: z
    .object({ id: Uuid, number: z.number().int().nullable(), name: z.string() })
    .nullable()
    .optional(),
})

/** A task as a list answers it: the row, with the names it is read beside. */
export const TaskInList = Task.partial({
  created_at: true,
  updated_at: true,
  deleted_at: true,
  workspace_id: true,
}).extend({
  author_name: z.string().optional(),
  author_avatar_url: SignedLink.nullable().optional(),
})

/** A message, with its author's face — `docs/specs/avatar.md`. */
export const MessageInRoom = Message.partial({
  updated_at: true,
  deleted_at: true,
  workspace_id: true,
  /* A room's list does not say whose room each line is: the room is the
     address it was read from. */
  conversation_id: true,
}).extend({
  /** Null for a message brought across from Slack under the name of
      somebody who is not here — `said_as`. */
  author_id: z.string().nullable(),
  said_as: z.string().nullable().optional(),
  author_name: z.string(),
  author_avatar_url: SignedLink.nullable().optional(),
  /** How many replies hang off it, counted rather than fetched. */
  replies: z.union([z.number(), z.string()]).optional(),
  edited_at: z.string().nullable().optional(),
  /** Each emoji on it once, with who put it there, in the order they first
      arrived. `docs/specs/chat-threads.md`. */
  reactions: z.array(z.object({ emoji: z.string(), actors: z.array(z.string()) })).optional(),
  /** Deleted and still listed because it has answers: no body, nothing of
      what it said. `docs/specs/message-edit.md`. */
  body: z.record(z.string(), z.unknown()).nullable(),
  deleted: z.boolean().optional(),
  /** Who answered it, latest first, four at most; and when the last did. */
  repliers: z.array(z.object({ id: z.string(), name: z.string(), avatar_url: z.string().nullable().optional() })).optional(),
  last_reply_at: z.string().nullable().optional(),
  /** The task it was made into, if the reader may see it — drawn under it
      as the task's card. `docs/specs/chat-threads.md`. */
  promoted_task_id: z.string().nullable().optional(),
  /** A reply said in the room as well as in its thread — listed in the
      room's history with the thread it answers. `docs/specs/chat-threads.md`. */
  also_in_room: z.boolean().optional(),
  /** On such a reply in the room's list: the first words of the message
      its thread hangs from, or null when that one was deleted. */
  thread_said: z.string().nullable().optional(),
  /** The room's incoming webhook it came through, named by `said_as` —
      drawn with App beside it. Null for everything else. */
  hook_id: z.string().nullable().optional(),
})

/** One answer a question offers. */
export const QuestionChoice = z.object({
  label: z.string(),
  recommended: z.boolean(),
})

/** A comment on anything, with the same. */
export const CommentOnObject = Comment.partial({
  updated_at: true,
  deleted_at: true,
  workspace_id: true,
  /* Read with the thing it is on, which is the address it was read from. */
  object_type: true,
  object_id: true,
}).extend({
  author_name: z.string(),
  author_avatar_url: SignedLink.nullable().optional(),
  edited_at: z.string().nullable().optional(),
  /** The comment this one answers; null for one that starts a thread. */
  parent_id: z.string().nullable().optional(),
  /** On words in a document: the words as they were when it was said, and
      whether the thread is settled.
      Null on every other comment. */
  quote: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  resolved_by: z.string().nullable().optional(),
  resolved_by_name: z.string().nullable().optional(),
  /** Read with its document: no mark in the body names it any more. */
  on_deleted_text: z.boolean().optional(),
  /** A question with choices, asked by an agent, and its answer.
      Null on every other comment. */
  choices: z.array(QuestionChoice).nullable().optional(),
  /** Who it was asked of. */
  asked: z.array(Uuid).nullable().optional(),
  /** The index of the choice pressed; null until somebody answers. */
  answer: z.number().int().nullable().optional(),
  answered_by: Uuid.nullable().optional(),
  answered_by_name: z.string().nullable().optional(),
  answered_at: z.string().nullable().optional(),
})


/**
 * A question still open, asked of the reader — `GET /api/inbox`, `questions`:
 * the inbox's Needs you.
 */
export const QuestionInInbox = z.object({
  /** The comment that asks it. */
  id: Uuid,
  task_id: Uuid,
  body: RichText,
  /** Its words as plain text. */
  excerpt: z.string().nullable().optional(),
  choices: z.array(QuestionChoice),
  created_at: z.string(),
  by_id: Uuid,
  by_name: z.string(),
  by_avatar_url: z.string().nullable().optional(),
  title: z.string(),
  task_number: z.number().int(),
  project_id: Uuid,
  project_name: z.string(),
  project_key: z.string().nullable().optional(),
  project_slug: z.string(),
})

/** `PUT` and `GET /api/comments/:id/answer` — the question's answer, or none yet. */
export const QuestionAnswer = z.object({
  ok: z.boolean().optional(),
  id: Uuid.optional(),
  object_id: Uuid.optional(),
  choices: z.array(QuestionChoice),
  answer: z.number().int().nullable(),
  answered_by: Uuid.nullable(),
  answered_by_name: z.string().nullable(),
  answered_at: z.string().nullable(),
})

/** An announcement as the index answers it: whole, with how many replies it
    has rather than the replies. */
export const PostInList = Post.partial({
  updated_at: true,
  deleted_at: true,
  workspace_id: true,
}).extend({
  author_name: z.string(),
  author_avatar_url: SignedLink.nullable().optional(),
  reply_count: z.number().int(),
})

/**
 * A line of the feed — what the product noticed, not what somebody said.
 *
 * It carries the names of the things it is about because a record that
 * cannot say what it happened to is the entire question.
 */
export const ActivityLine = z.object({
  id: Uuid,
  action: z.string(),
  object_type: z.string().nullable().optional(),
  object_id: Uuid.nullable().optional(),
  object_title: z.string().nullable().optional(),
  object_number: z.union([z.number(), z.string()]).nullable().optional(),
  origin: z.string().nullable().optional(),
  at: z.string(),
  meta: z.unknown().optional(),
  actor_id: Uuid.nullable().optional(),
  actor_name: z.string().nullable().optional(),
  actor_avatar_url: SignedLink.nullable().optional(),
  project_id: Uuid.nullable().optional(),
  project_name: z.string().nullable().optional(),
  project_slug: z.string().nullable().optional(),
  project_key: z.string().nullable().optional(),
})

export type SignedLink = z.infer<typeof SignedLink>
export type PersonInWorkspace = z.infer<typeof PersonInWorkspace>
export type AgentStatus = z.infer<typeof AgentStatus>
export type AgentInRoom = z.infer<typeof AgentInRoom>
export type PersonInProject = z.infer<typeof PersonInProject>
export type ProjectInList = z.infer<typeof ProjectInList>
export type TaskInList = z.infer<typeof TaskInList>
export type MessageInRoom = z.infer<typeof MessageInRoom>
export type CommentOnObject = z.infer<typeof CommentOnObject>
export type QuestionChoice = z.infer<typeof QuestionChoice>
export type QuestionInInbox = z.infer<typeof QuestionInInbox>
export type QuestionAnswer = z.infer<typeof QuestionAnswer>
export type PostInList = z.infer<typeof PostInList>
export type ActivityLine = z.infer<typeof ActivityLine>

/* ------------------------------------------------------------------------
 * The answers a client reads to stand up at all.
 *
 * They were typed by hand in the web (`Session` in `data/api.ts`, `Mine` in
 * `MyTasks.tsx`), which is one client; a second written in Swift is where
 * hand-typing becomes two copies of every answer drifting apart, so each is
 * the schema's, and each list comes with the envelope it arrives in.
 * ---------------------------------------------------------------------- */

/** A count as Postgres answers it: `count(*)` comes back as a string. */
export const Count = z.union([z.number(), z.string()])
/** A count that may not have been kept — a size recorded before sizes were. */
export const CountOrNone = z.union([z.number(), z.string(), z.null()])

/** What signing in, renewing and entering a workspace all answer. */
export const Session = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  /** Seconds the access token lives; renew before, or on a 401. */
  expires_in: z.number().int(),
  actor_id: Uuid,
  workspace_id: Uuid,
})

/**
 * What leaving a workspace answers — `POST /api/me/leave`,
 * A session for where you go next — another
 * workspace you are in, or the one made for you in the same press — and
 * that workspace, so the client goes to its address.
 */
/**
 * A session in no workspace:
 * answered by signing in (to a client that sends `nowhere: true`), by
 * renewing one, and by leaving the last workspace. It reaches only the
 * person's own short list; everything else is `403 no_workspace`.
 */
export const NowhereSession = Session.extend({ workspace_id: z.null(), nowhere: z.literal(true) })
export const LeftWorkspace = z.object({
  ok: z.boolean(),
  session: z.union([Session, NowhereSession]),
  /** Null when it was the last one: the session is a `NowhereSession`. */
  workspace: z.object({ id: Uuid, slug: z.string(), name: z.string() }).nullable(),
})
/** `GET /api/me` to a session in no workspace. */
export const NowhereMe = z.object({
  actor: z.object({ id: Uuid, name: z.string(), avatar_url: z.string().nullable().optional() }),
  email: z.string(),
  workspace: z.null(),
  role: z.null(),
  /** `workspace.create`, or nothing. */
  can: z.array(z.string()),
  nowhere: z.literal(true),
})
/** `GET /api/me/invitations` — to a session in no workspace. */
export const WaitingInvitations = z.object({
  invitations: z.array(
    z.object({
      id: Uuid,
      workspace_name: z.string(),
      /** Mailed to that workspace's own domain, and taken there from its
          letter rather than here. */
      host: z.string().optional(),
    }),
  ),
})

/**
 * `GET /api/me/unconfirmed` — the workspaces the account was in before its
 * address was proved, waiting for the person's Join or Leave.
 */
export const UnconfirmedWorkspaces = z.object({
  waiting: z.array(
    z.object({
      id: Uuid,
      name: z.string(),
      /** `owner` is offered Join alone: a workspace keeps its owner. */
      role: Role,
    }),
  ),
})
/**
 * `POST /api/me/unconfirmed/:workspaceId` — the answer taken, and, to a
 * session in no workspace that joined, a session for the workspace joined
 * beside it, as `PasswordSet` carries one.
 */
export const UnconfirmedAnswered = z
  .object({ ok: z.literal(true), answer: z.enum(['joined', 'left']) })
  .extend(Session.partial().shape)

/**
 * Which ways in this deployment has keys for — `GET /auth/providers`. A
 * screen draws a button only for these: one that answers "not set up" is
 * worse than none.
 */
export const Providers = z.object({
  google: z.boolean(),
  apple: z.boolean(),
  github: z.boolean(),
  /** A server's own OpenID Connect provider, and what its button calls it
      (`OIDC_NAME`, else "SSO"); null when `oidc` is false. Never on the
      service. */
  oidc: z.boolean(),
  oidc_name: z.string().nullable(),
  mail: z.boolean(),
  /** True only on a server of one's own with no mail set up: the screens
      say so instead of promising a letter. Always false on the service. */
  no_mail: z.boolean(),
  /** Whether somebody without an invitation may sign up — false only on a
      server of one's own with sign-up closed. */
  sign_up: z.boolean(),
})

/**
 * How a server of one's own sends mail, as its owner's screens are told —
 * never a password or a key, only whether one is set. `source` is the
 * environment (`SMTP_URL`, `RESEND_API_KEY`), which wins and is read-only
 * there, the settings saved from the screen, or null for no mail.
 */
export const MailSetup = z.object({
  source: z.enum(['env', 'saved']).nullable(),
  via: z.enum(['smtp', 'resend']).nullable(),
  host: z.string().nullable(),
  port: z.number().int().nullable(),
  security: z.enum(['tls', 'starttls', 'none']).nullable(),
  user: z.string().nullable(),
  /** Whether a password (SMTP) or an API key (Resend) is set. */
  secret_set: z.boolean(),
  /** Who letters are from: `tuff@example.com` or `Tuff <tuff@example.com>`. */
  sender: z.string().nullable(),
})
/** `GET /auth/setup`, behind the setup link: what the first screen opens with. */
export const SetupState = z.object({
  /** The address the owner's account must use (`OWNER_EMAIL`), or null for any. */
  owner_email: z.string().nullable(),
  mail_setup: MailSetup,
})
/** `PUT` and `DELETE /auth/setup/mail`. */
export const SetupMail = z.object({ mail_setup: MailSetup })

/**
 * Your own server, as its owner's screen reads it — `GET /api/instance`.
 * Never answered on the service.
 */
export const InstanceOwner = z.object({
  actor_id: Uuid,
  name: z.string(),
  /** Null only for an account deleted since it was named. */
  email: z.string().nullable(),
  added_at: z.string(),
})
/**
 * A release of Tuff for your own server, as the daily check last heard of
 * it.
 */
export const ServerRelease = z.object({
  /** `X.Y.Z`, no `v`. */
  version: z.string(),
  /** Its release notes on GitHub. */
  url: z.string(),
  published_at: z.string().nullable(),
  /** Whether its notes have a `### Security` section. */
  security: z.boolean(),
})
/**
 * What the last update of a server of one's own did, for its owners: the
 * versions, the backup taken before migrating, and how many migrations
 * ran.
 */
export const ServerUpdate = z.object({
  /** The version it ran before, `X.Y.Z`; null when that is not known. */
  from: z.string().nullable(),
  /** The version it runs since, `X.Y.Z`. */
  to: z.string(),
  at: z.string(),
  /** The dump's path inside the app's container; null when none was taken. */
  backup: z.string().nullable(),
  /** Why migrations ran with no backup: `SKIP_PRE_MIGRATION_BACKUP`, no
      `BACKUP_DIR`, a folder that is not a volume, or a Postgres newer than
      the image's `pg_dump`. Null when one was taken, or nothing migrated. */
  no_backup: z.enum(['skipped', 'no_folder', 'not_a_volume', 'postgres_newer']).nullable(),
  /** How many migrations ran; 0 when the update changed nothing in the database. */
  migrations: z.number().int(),
  /** The release's notes on GitHub; null for a build that is not a release. */
  notes: z.string().nullable(),
})
export type ServerUpdate = z.infer<typeof ServerUpdate>
/**
 * The version a server of one's own runs, and a newer one when there is —
 * for its owners only: `GET /api/instance` and `GET /api/me`'s `server`.
 */
export const ServerVersion = z.object({
  /** What it runs, `X.Y.Z`; `0.0.0` for a build from before any release. */
  current: z.string(),
  /** The commit it was built from, seven characters, or `unknown`. */
  commit: z.string(),
  /** Whether the daily check runs — false with `UPDATE_CHECK=off`. */
  check: z.boolean(),
  /** A release newer than `current`, or null: none heard of, none newer,
      or a build at `0.0.0`. */
  latest: ServerRelease.nullable(),
  /** The last update, until an owner dismisses it, or null. */
  updated: ServerUpdate.nullable(),
})
export const Instance = z.object({
  /** Whether somebody without an invitation may make an account. */
  sign_up_open: z.boolean(),
  owners: z.array(InstanceOwner),
  /** Whether letters leave the server, or only reach its log. */
  mail: z.boolean(),
  /** How it sends them, set up from the screen or by the environment. */
  mail_setup: MailSetup,
  version: ServerVersion,
})
export type ServerRelease = z.infer<typeof ServerRelease>
export type ServerVersion = z.infer<typeof ServerVersion>
/** `POST /api/instance/test-letter`: whether the letter left, and whether mail is set up at all. */
export const InstanceLetter = z.object({ sent: z.boolean(), mail: z.boolean() })

/** `GET /api/me/ways-in`: what an account signs in with besides its
    password, what this deployment offers, and what adding or removing one
    asks. */
export const WayIn = z.object({
  id: z.uuid(),
  /** `oidc` is a server's own provider. */
  provider: z.enum(['google', 'apple', 'github', 'oidc']),
  email: z.string().nullable(),
  created_at: z.string(),
})
export const WaysIn = z.object({
  offered: z.array(z.enum(['google', 'apple', 'github', 'oidc'])),
  /** What a server's own provider is called (`OIDC_NAME`, else "SSO") when
      `offered` has it; null otherwise, and always on the service. */
  oidc_name: z.string().nullable(),
  ways: z.array(WayIn),
  password: z.boolean(),
  asks: z.enum(['password', 'password_and_code', 'email']),
})
export type WaysIn = z.infer<typeof WaysIn>

/** `POST /api/me/ways-in/:provider`: where to go next — the browser
    with the cookie it was given, or an app's sheet with the challenge it
    sent. */
export const WayInStart = z.object({ url: z.string() })
export type WayInStart = z.infer<typeof WayInStart>

/** `POST /api/me/ways-in/:provider/finish`: the app's link, made, and
    the address of the account there, when the provider gave one. */
export const WayInAdded = z.object({ provider: z.enum(['google', 'apple', 'github', 'oidc']), email: z.string().nullable() })
export type WayInAdded = z.infer<typeof WayInAdded>

/** Every refusal: `{ error: { code, message? } }` — `totp_required`,
    `email_unverified`, `unauthorized`, `forbidden`, `not_found`, `invalid`.
    `removed`, from `/auth/refresh`, names the workspace the person was
    taken out of, so a device clears what it kept of it and says so —
    `docs/specs/removing-someone.md`. */
export const RemovedFrom = z.object({ id: Uuid, name: z.string() })
export const ApiError = z.object({
  error: z.object({ code: z.string(), message: z.string().optional(), workspace: RemovedFrom.optional() }),
})

/** `GET /api/workspaces`: every workspace this account is in, and the one
    the session is for. */
export const WorkspaceInList = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  role: Role.or(z.string()),
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
  plan: z.string().optional(),
  icon_url: SignedLink.nullable().optional(),
  /** Whether this person has an unread notification there that its bell
      would count — the dot on its mark. A yes or
      no about their own notes, and nothing else of that workspace. */
  unread: z.boolean().optional(),
})
export const WorkspaceList = z.object({
  workspaces: z.array(WorkspaceInList),
  current: Uuid.nullable().optional(),
})

/**
 * `GET /api/me`: who is asking, where, and what they may do there.
 *
 * `can` is strings rather than the action enum on purpose: a server that has
 * learned an action an older client has not must not make that client unable
 * to read who it is.
 */
export const MeActor = z.object({
  id: Uuid,
  name: z.string(),
  title: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  /** What they read the product in — `en` or `fr` — or null for never
      said, which reads as English. */
  language: z.string().nullable().optional(),
  presence: Presence.or(z.string()).nullable().optional(),
  /** What they chose, `away` or `busy`, or null for "work it out" —
      `presence` is what that comes to now. `docs/specs/presence.md`. */
  chosen: z.string().nullable().optional(),
  avatar_url: SignedLink.nullable().optional(),
})
/**
 * A workspace's own name and mark, worn in Tuff's place on what it shows to
 * people. The server works it out from the
 * plan at every read; null wherever it is not worn, which on your own
 * server is everywhere. `mark_tint` is never null here: a colour nobody
 * chose is the one the workspace's id gives, worked out by the server and
 * handed over as a colour.
 */
export const Brand = z.object({
  name: z.string(),
  icon_url: SignedLink.nullable(),
  mark_icon: z.string().nullable(),
  mark_tint: z.number().int(),
})
export type Brand = z.infer<typeof Brand>

export const MeWorkspace = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
  icon_url: SignedLink.nullable().optional(),
  /** The brand this workspace wears, or null — the tab's icon and title. */
  brand: Brand.nullable().optional(),
  /** Where the workspace's own links point: its connected domain on a
      branded plan, else null for this server's own address. */
  origin: z.string().nullable().optional(),
  /** To whoever may set the workspace's own domain, and only while it holds:
      the domain stopped — paused, dropped or taken — and was neither
      connected again nor removed. The dot on the way to Settings. */
  domain_stopped: z.boolean().optional(),
})
export const Me = z.object({
  actor: MeActor,
  workspace: MeWorkspace,
  role: Role.or(z.string()),
  plan: z.string().optional(),
  settings: WorkspaceSettings.partial().optional(),
  via_mcp: z.boolean().optional(),
  can: z.array(z.string()),
  /** Your own server's version and a newer release — to its owners only,
      absent for everybody else and always on the service. */
  server: ServerVersion.optional(),
  /** The workspace's own domain this session was made on, when it was.
      Such a session sees this workspace only. */
  host: z.string().nullable().optional(),
  /** On such a session, what the person's role allows at usetuff.com that
      the host refuses (`NEVER_ON_A_HOST`), so a client can point there
      instead of hiding it. Strings, as `can` is. */
  can_off_host: z.array(z.string()).optional(),
})

/** `GET /api/projects`. */
export const ProjectPage = z.object({
  projects: z.array(ProjectInList),
  next_cursor: z.string().nullable().optional(),
})

/** A project's list as its tasks screen reads it — `GET /api/projects/:id/lists`. */
export const ListInProject = z.object({
  id: Uuid,
  name: z.string(),
  sort_key: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  finishes: z.boolean().optional(),
  narrow: z.boolean().optional(),
  /** Whether it is the project's triage. */
  intake: z.boolean().optional(),
  /** The agent that takes its new tasks, or null. */
  agent_id: Uuid.nullable().optional(),
  /** That agent is off the project or disconnected, so the list gives nothing. */
  agent_gone: z.boolean().optional(),
  /** How many tasks are in it. */
  tasks: Count.optional(),
})
export const ListsInProject = z.object({ lists: z.array(ListInProject) })

/**
 * The picture a card shows: the copy for showing, signed for the reader,
 * and its size, so the card holds its room before the bytes arrive. A size
 * nobody knows is null in both halves.
 */
export const TaskPicture = z.object({
  file_id: Uuid,
  thumb_url: SignedLink,
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
})
/** A task as a project's list answers it — `GET /api/projects/:id/tasks`. */
export const TaskInProject = z.object({
  id: Uuid,
  number: z.number().int(),
  title: z.string(),
  list_id: Uuid.nullable(),
  /** Everybody on it, in order. */
  assignee_ids: z.array(Uuid).optional(),
  /** The first of them, for a client that draws one face. */
  assignee_id: Uuid.nullable().optional(),
  due_on: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  sort_key: z.string().nullable().optional(),
  parent_id: Uuid.nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  labels: z.array(z.lazy(() => LabelOnTask)).optional(),
  /** The sprint it is in, or none. */
  cycle_id: Uuid.nullable().optional(),
  author_id: Uuid.nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  /** When somebody last decided something about it — "Last updated". */
  decided_at: z.string().nullable().optional(),
  /** When anything about it last changed, which says an agent at it is
   *  still there. */
  updated_at: z.string().nullable().optional(),
  /** Its first picture, for a card — only when asked with `?pictures=1`,
   *  and only one the reader may open. */
  picture: TaskPicture.optional(),
  /** The handles of what it waits on that is still open and the reader can
   *  see, oldest relation first. */
  waiting_on: z.array(z.string()).optional(),
  /** How it repeats, or null. */
  repeat: Repeat.nullable().optional(),
})
/** Where one list stands in a read by list — `?by=list`,
 *  */
export const ListPage = z.object({
  id: Uuid,
  /** How many tasks the list holds, parts left out. */
  total: z.number().int(),
  /** Where the rest of it is read from with `?list=`, or null for none. */
  next_cursor: z.string().nullable(),
})
export const TaskPage = z.object({
  tasks: z.array(TaskInProject),
  next_cursor: z.string().nullable().optional(),
  /** With `?list=`: how many tasks the list holds, parts left out. */
  total: z.number().int().optional(),
  /** With `?by=list`: every list, in order, and where each stopped. */
  lists: z.array(ListPage).optional(),
})

/** A row of My tasks — `GET /api/my/tasks?tab=`. */
export const MyTask = z.object({
  id: Uuid,
  number: z.number().int(),
  title: z.string(),
  due_on: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  project_id: Uuid,
  project_name: z.string(),
  project_key: z.string(),
  project_slug: z.string().optional(),
  /** The mark and colour of the list it is in. */
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  list_name: z.string().nullable().optional(),
  /** When **you** asked to be reminded of it, or null. */
  reminder_at: z.string().nullable().optional(),
  /** How it repeats, or null. */
  repeat: Repeat.nullable().optional(),
})
export const MyTaskList = z.object({ tasks: z.array(MyTask) })

/** A room as the sidebar reads it — `GET /api/conversations`. */
export const ConversationInList = z.object({
  id: Uuid,
  project_id: Uuid.nullable(),
  /** A channel's name; null for a direct conversation, which is its people. */
  name: z.string().nullable(),
  created_at: z.string().optional(),
  channel: z.boolean().optional(),
  project_slug: z.string().nullable().optional(),
  project_archived: z.boolean().optional(),
  hidden: z.boolean().optional(),
  notify: z.string().optional(),
  /** Unread, counted to 100 — a client draws 99+ past it. */
  unread: Count.optional(),
  /** Unread times this person was named. */
  mentions: Count.optional(),
  read_through: z.string().nullable().optional(),
  /** A direct conversation's other people, by name, and the one face it shows. */
  others: z.string().nullable().optional(),
  other_id: Uuid.nullable().optional(),
  other_presence: z.string().nullable().optional(),
  /** A direct conversation whose everybody else was removed from the workspace: readable, and it takes no more — `docs/specs/removing-someone.md`. */
  others_gone: z.boolean().nullable().optional(),
  other_avatar_url: SignedLink.nullable().optional(),
  /** A project's channel open only to the people in it, rather than to everybody on the project. Leaving one ends your place in it; leaving an open one puts it away muted. */
  chosen: z.boolean().optional(),
  /** An open channel this reader left: put away and muted, and it does not come back out when somebody speaks in it. */
  left: z.boolean().optional(),
  /** What this reader may do to it: `edit`, `delete`, `hooks`, `leave`. */
  can: z.array(z.string()).optional(),
})
export const ConversationList = z.object({ conversations: z.array(ConversationInList) })

/** `GET /api/conversations/:id/messages`, oldest first; `next_cursor` reads older. */
export const MessagePage = z.object({
  messages: z.array(MessageInRoom),
  next_cursor: z.string().nullable().optional(),
})

/**
 * What a socket says — `{ topic, kind, payload }`, the fact and the ids,
 * never the row: whoever hears it reads again through the endpoint they
 * would have used anyway. `tick` frames are not JSON and not this.
 */
export const RealtimeEvent = z.object({
  topic: z.string(),
  kind: z.string(),
  payload: z
    .object({
      id: z.string().optional(),
      conversation_id: z.string().optional(),
      project_id: z.string().optional(),
      /** On a project's socket: what changed, and who changed it. */
      object_type: z.string().nullable().optional(),
      object_id: z.string().nullable().optional(),
      actor_id: z.string().nullable().optional(),
      /** On `/ws/me`, why a notification arrived: `mentioned`, `assigned`… */
      reason: z.string().nullable().optional(),
      /** The `x-tab` of the request that caused it, so its maker can skip the echo. */
      tab: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

/* ------------------------------------------------------------------------
 * The task read whole, the inbox, the search and the people,
 * the second step.
 * ---------------------------------------------------------------------- */

/** A label as a task carries it: its word and its colour. */
export const LabelOnTask = z.object({ id: Uuid, name: z.string(), color: z.string().nullable().optional() })

/** A part of a task, as its checklist reads it. */
export const Step = z.object({
  id: Uuid,
  title: z.string(),
  done_at: z.string().nullable().optional(),
  sort_key: z.string().nullable().optional(),
  assignee_ids: z.array(Uuid).optional(),
  assignee_id: Uuid.nullable().optional(),
  due_on: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
})

/**
 * A reminder somebody set for themselves on a task.
 * `PUT /api/tasks/:id/reminder` answers `{ reminder }`.
 */
export const TaskReminder = z.object({
  /** The moment, as an ISO instant. */
  at: z.string(),
})
export const TaskReminderSet = z.object({ reminder: TaskReminder })

/**
 * One end of "blocked by", as the task's screen draws it.
 * Only ever a task the reader can see.
 */
export const TaskRelated = z.object({
  id: Uuid,
  number: z.number().int(),
  title: z.string(),
  project_id: Uuid,
  project_key: z.string(),
  project_slug: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  /** The mark and colour of the list it is in. */
  list_icon: z.string().nullable().optional(),
  list_color: z.string().nullable().optional(),
})
/** `POST /api/tasks/:id/blocked-by` answers the blocker as the screen draws it. */
export const BlockerAdded = z.object({ blocker: TaskRelated })

/** The task itself as `GET /api/tasks/:id` answers it. */
export const TaskInDetail = Task.partial({
  created_at: true,
  updated_at: true,
  deleted_at: true,
  workspace_id: true,
}).extend({
  author_name: z.string().optional(),
  labels: z.array(LabelOnTask).optional(),
  /** The tasks it is a part of, outermost first. */
  ancestors: z.array(z.object({ id: Uuid, title: z.string(), number: z.number().int().optional() })).optional(),
  /** Whether the reader follows it. */
  subscribed: z.boolean().optional(),
  /** The reader's own reminder on it, or null — nobody else's is ever said. */
  my_reminder: TaskReminder.nullable().optional(),
  /** What it waits on, and what waits on it — readable ones only. */
  blocked_by: z.array(TaskRelated).optional(),
  blocks: z.array(TaskRelated).optional(),
  priority: z.string().nullable().optional(),
  /** The sprint it is in. */
  cycle_id: Uuid.nullable().optional(),
  decided_at: z.string().nullable().optional(),
})

/** Time logged on something, with who logged it. */
export const TimeOnObject = z.object({
  id: Uuid,
  actor_id: Uuid,
  actor_name: z.string().nullable().optional(),
  minutes: z.number().int(),
  spent_on: z.string(),
  note: z.string().nullable().optional(),
})

/** What an AI tool spent on a task, sent by its client. */
export const SpendOnTask = z.object({
  id: Uuid,
  actor_id: Uuid,
  actor_name: z.string().nullable().optional(),
  /** What spent it, as a person reads it: `Claude Code`, `Cursor`. */
  client: z.string(),
  model: z.string().nullable().optional(),
  /** Every token read or written, cache reads included. */
  tokens: z.number(),
  /** US dollars; null when the client did not say. */
  cost_usd: z.number().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

/** `GET /api/tasks/:id`: the task, its parts, its hours and what was said on it. */
export const TaskRead = z.object({
  task: TaskInDetail,
  steps: z.array(Step).optional(),
  time: z.array(TimeOnObject).optional(),
  /** What AI tools spent on it. */
  spend: z.array(SpendOnTask).optional(),
  /** The agents saying they are at it now. */
  working: z.array(AgentStatus).optional(),
  comments: z.array(CommentOnObject).optional(),
  /** Where the comments this answer did not carry start: the newest 200, and no more than 4 MB of them, are here; `GET …/comments?before=` with this answers the ones before. Null when all are here. */
  comments_earlier: z.string().nullable().optional(),
  /** The pictures in its body and comments, by file id: the link to the original, the copy to draw, and the size. */
  files: z.record(z.string(), SignedLink).optional(),
  displays: z.record(z.string(), SignedLink).optional(),
  sizes: z.record(z.string(), z.number()).optional(),
  /**
   * Asked for on the project's feedback page.
   * Null for every other task; `email` only for whoever may change the
   * task, and never through a token.
   */
  feedback: z.object({ email: z.string().nullable() }).nullable().optional(),
  /** What GitHub says about it. */
  github: z
    .object({
      pulls: z.array(z.lazy(() => PullOnTask)),
      /** The issue it is, where its project keeps issues in sync. */
      issue: z.object({ number: z.number().int(), repo_name: z.string(), url: z.string() }).nullable().optional(),
    })
    .optional(),
})

/** A pull request that names a task, as GitHub last said it stands. */
export const PullOnTask = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
  /** `open`, `closed` or `merged`. */
  state: z.string(),
  draft: z.boolean(),
  /** `requested`, `approved`, `changes`, or none yet. */
  review: z.string().nullable(),
  /** `pending`, `success`, `failure`, or none reported. */
  checks: z.string().nullable(),
  author_login: z.string().nullable(),
  author_avatar: z.string().nullable(),
  head_ref: z.string().nullable(),
  /** Whether it says it closes the task — "Fixes RED-12". */
  closes: z.boolean(),
  repo_name: z.string(),
})
export type PullOnTask = z.infer<typeof PullOnTask>

/**
 * A note in the inbox — `GET /api/inbox`, `docs/specs/inbox.md`. Said with
 * what it is about and where, so a row can be drawn and opened without a
 * second read: the task's handle, the room's name, the line that named you.
 */
export const NotificationInInbox = z.object({
  id: Uuid,
  /** Why it is here: `mentioned`, `assigned`, `subscribed`, `due`, `replied`, `posted`, `joined`, `added`, `reminder`, `unblocked`, `asked`. */
  reason: z.string(),
  object_type: z.string(),
  object_id: Uuid,
  read_at: z.string().nullable(),
  created_at: z.string(),
  /** The sentence it says: "Sam Carter assigned you". */
  what: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  project_id: Uuid.nullable().optional(),
  project_name: z.string().nullable().optional(),
  project_key: z.string().nullable().optional(),
  project_slug: z.string().nullable().optional(),
  task_number: z.number().int().nullable().optional(),
  room_name: z.string().nullable().optional(),
  room_channel: z.boolean().nullable().optional(),
  room_others: z.string().nullable().optional(),
  said_by: z.string().nullable().optional(),
  said: z.string().nullable().optional(),
  /** For a mention in a room: the message and the thread it is in, to answer there. */
  said_id: z.string().nullable().optional(),
  said_thread: z.string().nullable().optional(),
  /** The files that message shows, by id — for an agent to ask links for (`GET /api/file-links`). */
  said_files: z.array(z.string()).nullable().optional(),
  /**
   * What was done, for the glyph a row wears: `commented`, `posted`,
   * `added`, `replied`, `finished`, `reopened`, `moved`, `gave`, `took_off`,
   * `dated`, `undated`, `wrote`, `due`, `overdue` — or none, for a note
   * written before it was kept. `docs/specs/inbox.md`.
   */
  kind: z.string().nullable().optional(),
  /** Who did it — a person or an agent — and their face; none for a reminder. */
  by_id: Uuid.nullable().optional(),
  by_name: z.string().nullable().optional(),
  by_avatar_url: z.string().nullable().optional(),
  /** What a comment said, for a note about one. */
  excerpt: z.string().nullable().optional(),
})
export const Inbox = z.object({
  notifications: z.array(NotificationInInbox),
  /** Needs you: the open questions asked of the reader, at most fifty, on the first page only. */
  questions: z.array(QuestionInInbox).optional(),
  /** Unread, by why. */
  unread: z.record(z.string(), Count).optional(),
  next_cursor: z.string().nullable().optional(),
})

/** One thing found — `GET /api/search?q=`: a task, an announcement, a document or a message. */
export const SearchResult = z.object({
  type: z.string(),
  id: Uuid,
  number: z.number().int().nullable().optional(),
  project_id: Uuid.nullable().optional(),
  title: z.string().nullable().optional(),
  created_at: z.string().optional(),
  snippet: z.string().nullable().optional(),
  /** A message's room, the message its thread started from, and who said it. */
  conversation_id: Uuid.optional(),
  parent_id: Uuid.nullable().optional(),
  author_name: z.string().nullable().optional(),
  /** A document's mark, as its row carries it — `docs/specs/docs.md`, "A document's mark". */
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
})
export const SearchResults = z.object({ results: z.array(SearchResult) })

/** `GET /api/people`. */
export const PeopleList = z.object({ people: z.array(PersonInWorkspace) })
/** `GET /api/projects/:id/members`: who is on it, and what each may do there. */
export const ProjectMembers = z.object({ members: z.array(PersonInProject) })

/** What making something answers: its id, and a task's number beside it. */
export const Created = z.object({ id: Uuid, number: z.number().int().optional() })

/** A project's label as its settings and its pickers read it — `GET
    /api/projects/:id/labels`, with how many of its tasks carry it. */
export const LabelInProject = z.object({
  id: Uuid,
  project_id: Uuid,
  name: z.string(),
  color: z.string().nullable().optional(),
  used: Count.optional(),
})
export const LabelsInProject = z.object({ labels: z.array(LabelInProject) })

/** `GET /api/activity`: the log, newest first, by its cursor. */
export const ActivityPage = z.object({
  events: z.array(ActivityLine),
  next_cursor: z.string().nullable().optional(),
})

/** `GET /api/tasks/:id/prompt`: the task as a prompt for an agent. */
export const TaskPrompt = z.object({ text: z.string() })

/** `GET /api/files/:id/url`: where a file can be read for the next hour,
    and the copy made for showing a picture. */
export const FileLink = z.object({
  url: z.string(),
  display_url: z.string().nullable().optional(),
  name: z.string().optional(),
  size: z.number().nullable().optional(),
  expires_in: z.number().optional(),
})

/** `GET /api/conversations/:id/members`: who is in a room. */
export const RoomPerson = z.object({
  actor_id: Uuid,
  name: z.string(),
  title: z.string().nullable().optional(),
  presence: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  avatar_url: SignedLink.nullable().optional(),
})
export const RoomPeople = z.object({
  members: z.array(RoomPerson),
  /** Whether these people were chosen for the room, or are simply the project's. */
  chosen: z.boolean().optional(),
})

/** A document shared to the web, or taken back — `PUT /api/files/:id/public`; `token` null when off. */
export const PublicShare = z.object({ token: z.string().nullable().optional() })

/**
 * A row of a project's Docs — `GET /api/projects/:id/files`, pinned first
 * and then the latest change (a page) or the newest (the whole list): a
 * document, an upload or a link, where it was first put,
 * and a picture's copy for showing signed for this reader. `docs/specs/docs.md`.
 */
export const FileInList = z.object({
  id: Uuid,
  number: z.number().int().nullable().optional(),
  name: z.string(),
  /** `document`, `upload`, `link` or `folder`. */
  kind: z.string(),
  content_type: z.string().nullable().optional(),
  size_bytes: CountOrNone.optional(),
  version: z.number().int().optional(),
  author_id: Uuid.nullable().optional(),
  author_name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  is_document: z.boolean().optional(),
  pinned_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().nullable().optional(),
  origin_type: z.string().nullable().optional(),
  origin_id: Uuid.nullable().optional(),
  origin_room: Uuid.nullable().optional(),
  origin_room_name: z.string().nullable().optional(),
  origin_room_channel: z.boolean().nullable().optional(),
  origin_task_number: z.number().int().nullable().optional(),
  origin_task_title: z.string().nullable().optional(),
  origin_task_key: z.string().nullable().optional(),
  origin_post_title: z.string().nullable().optional(),
  /** The project the room it was first put in belongs to, by its address. */
  origin_room_project_slug: z.string().nullable().optional(),
  thumb_url: SignedLink.nullable().optional(),
  /** Shared to the web. */
  is_public: z.boolean().optional(),
  /** When it was saved as a template, or null. */
  template_at: z.string().nullable().optional(),
  /** Who it is for: `author` (a draft), `chosen` or `project`. Absent from a server before it. */
  audience: z.string().optional(),
  /** Whether it is the project's instructions for agents. Absent from a server before it. */
  for_agents: z.boolean().optional(),
  /** What a written document wears, or null for its own look: one of `MarkIcon`, and an index into the ten tints — `docs/specs/docs.md`, "A document's mark" (migration 276). */
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
  /** A pinned written document's first lines and first picture, for the page its card draws — at most six lines and 600 characters; absent on any other row. `docs/specs/docs.md`, "A pinned document is a page". */
  preview: z
    .object({
      /** `h` is the heading level, 1–3, or 0 for a line of text. */
      lines: z.array(z.object({ h: z.number().int(), t: z.string() })),
      /** The file id of the first picture in it, or null. */
      picture: Uuid.nullable(),
      /** That picture's copy for showing, signed for this reader — null when there is none or it is not theirs to open; absent from a server before pages. */
      picture_url: SignedLink.nullable().optional(),
    })
    .optional(),
})
/**
 * A project's Files — `GET /api/projects/:id/files`. Asked with `limit` or
 * `cursor`, a page (`next_cursor` for the rest, `kinds` on the first);
 * asked with neither, every row, for the apps installed before pages.
 */
export const FilesInProject = z.object({
  files: z.array(FileInList),
  /** Opaque: hand it back as `?cursor=` for the page after; null on the last page and on the whole list. Absent from a server before pages. */
  next_cursor: z.string().nullable().optional(),
  /** On a first page only: which of `docs`, `images`, `uploads`, `links` hold anything this reader may see, whoever's. */
  kinds: z.array(z.string()).optional(),
})

/**
 * A row in a project's Recently Deleted — `GET /api/projects/:id/files/deleted`,
 * newest deleted first: what was deleted in the last thirty days that the
 * asker may put back. `purge_at` is when the clear-out takes it for good;
 * `deleted_by_name` null when that person's account is gone.
 */
export const DeletedFile = z.object({
  id: Uuid,
  number: z.number().int().nullable().optional(),
  name: z.string(),
  /** `document`, `upload`, `link` or `folder`. */
  kind: z.string(),
  url: z.string().nullable().optional(),
  content_type: z.string().nullable().optional(),
  size_bytes: CountOrNone.optional(),
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
  author_id: Uuid.nullable().optional(),
  author_name: z.string().nullable().optional(),
  deleted_at: z.string(),
  deleted_by: Uuid.nullable(),
  deleted_by_name: z.string().nullable(),
  purge_at: z.string(),
  /** The files a document kept from the project holds, which Delete forever takes with it. */
  held_files: z.number().int().optional(),
  thumb_url: SignedLink.nullable().optional(),
})
export const DeletedFilesPage = z.object({
  files: z.array(DeletedFile),
  /** Opaque: hand it back as `?cursor=` for the page after. */
  next_cursor: z.string().nullable(),
  /** How many days a deleted row is kept before the clear-out — the server's `PURGE_AFTER_DAYS`. */
  kept_days: z.number().int().positive(),
})

/**
 * The documents saved as templates that the asker can read, across the
 * workspace — `GET /api/doc-templates`, newest first. The built-in four
 * are not in it: they are `DocTemplate`'s keys.
 */
export const SavedTemplate = z.object({
  id: Uuid,
  name: z.string(),
  project_id: Uuid,
  project_name: z.string(),
  template_at: z.string(),
})
export const SavedTemplates = z.object({ templates: z.array(SavedTemplate) })
/** Who a written document is for, after `PUT /api/files/:id/audience`. */
export const AudienceChanged = z.object({
  ok: z.boolean(),
  audience: z.string(),
  /** Its chosen people now: empty for the project. */
  reader_ids: z.array(Uuid),
})
/** What saving a document as a template, or taking it back, answers. */
export const TemplateChanged = z.object({ ok: z.boolean(), template_at: z.string().nullable() })
/** What marking a document as the project's instructions for agents, or taking the mark off, answers. `replaced` is the document that held the mark before, when marking this one took it off that one. */
export const ForAgentsChanged = z.object({ ok: z.boolean(), for_agents: z.boolean(), replaced: Uuid.nullable().optional() })

/** A file read whole — `GET /api/files/:id`: a document's body, or what an
    upload or a link is, and what was said on it. */
export const FileInDetail = z.object({
  id: Uuid,
  /** Whether the reader follows it. */
  subscribed: z.boolean().optional(),
  project_id: Uuid.nullable().optional(),
  number: z.number().int().nullable().optional(),
  name: z.string(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  upload: z.boolean().optional(),
  url: z.string().nullable().optional(),
  content_type: z.string().nullable().optional(),
  size_bytes: CountOrNone.optional(),
  pixel_width: z.number().int().nullable().optional(),
  pixel_height: z.number().int().nullable().optional(),
  version: z.number().int().optional(),
  author_id: Uuid.nullable().optional(),
  author_name: z.string().nullable().optional(),
  pinned_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().nullable().optional(),
  /** Where it was first put, and the room it is a file of. */
  origin_type: z.string().nullable().optional(),
  origin_id: Uuid.nullable().optional(),
  conversation_id: Uuid.nullable().optional(),
  /** The token of its page on the web, when it is shared there. */
  public_token: z.string().nullable().optional(),
  /** When it was saved as a template, or null. */
  template_at: z.string().nullable().optional(),
  /** Who it is for: `author` (a draft, its author's alone), `chosen` (its author and `reader_ids`) or `project`. */
  audience: z.string().optional(),
  /** Its chosen people, empty unless `audience` is `chosen`. Never the author. */
  reader_ids: z.array(Uuid).optional(),
  /** Whether the reader may change it (`content.edit.own` / `content.edit.any`, as a PATCH asks). */
  may_edit: z.boolean().optional(),
  /** Whether the reader may say who it is for (`file.share`): publish a draft, choose its people. */
  may_share: z.boolean().optional(),
  /** Whether it is the project's instructions for agents. */
  for_agents: z.boolean().optional(),
  /** Whether the reader may mark it so, or take the mark off (`file.for_agents`). */
  may_for_agents: z.boolean().optional(),
  /** How many pictures and files its body shows that it does not hold — put in before it was private, they stay the project's. A written document only. */
  loose_files: z.number().int().nullable().optional(),
  /** What a written document wears, or null for its own look: one of `MarkIcon`, and an index into the ten tints — `docs/specs/docs.md`, "A document's mark" (migration 276). */
  mark_icon: z.string().nullable().optional(),
  mark_tint: z.number().int().nullable().optional(),
})
export const FileRead = z.object({
  file: FileInDetail,
  comments: z.array(CommentOnObject).optional(),
  /** Where the comments this answer did not carry start: the newest 200, and no more than 4 MB of them, are here; `GET …/comments?before=` with this answers the ones before. Null when all are here. */
  comments_earlier: z.string().nullable().optional(),
})

/** What changing a file answers: and the version a body edit made. */
export const FileChanged = z.object({
  ok: z.boolean(),
  version: z.number().int().optional(),
  /** The body's revision now: what to send as `base_rev` next. */
  rev: z.number().int().optional(),
  /** Stretches the people changed too, left as they had them. */
  conflicts: z.number().int().optional(),
})

/** Somebody who wrote in a document's version. */
export const VersionContributor = z.object({
  actor_id: Uuid,
  name: z.string(),
  avatar_url: z.string().nullable(),
})
/**
 * A version a written document kept — `GET /api/files/:id/versions`, newest
 * first. `version` is the number the document carried; `contributors` who
 * wrote in it since the version before (none for the body it had before
 * history began); `restored_version` the number a restore put back.
 */
export const DocVersion = z.object({
  id: Uuid,
  version: z.number().int().positive(),
  created_at: z.string(),
  contributors: z.array(VersionContributor),
  restored_version: z.number().int().positive().nullable(),
})
export const DocVersionPage = z.object({
  versions: z.array(DocVersion),
  next_cursor: z.string().nullable(),
})
/** `GET /api/files/:id/versions/:versionId`: one, with what it said. */
export const DocVersionRead = z.object({
  version: DocVersion.extend({ body: RichText }),
})
/** `POST /api/files/:id/versions/:versionId/restore`: the document's version now. */
export const DocVersionRestored = z.object({
  ok: z.boolean(),
  version: z.number().int().positive(),
})
export type DocVersion = z.infer<typeof DocVersion>
export type DocVersionRead = z.infer<typeof DocVersionRead>

/** What points at something, by name — `GET /api/links/:type/:id`. */
export const LinkBack = z.object({
  type: z.string(),
  id: Uuid,
  title: z.string(),
  project_id: Uuid.nullable().optional(),
})
export const LinksBack = z.object({ links: z.array(LinkBack) })

/**
 * An announcement as a project's list reads it — `GET /api/projects/:id/posts`,
 * newest first: the whole body, since the list is the reading screen, and
 * how many replies are behind the door.
 */
export const PostInProject = z.object({
  id: Uuid,
  number: z.number().int().nullable().optional(),
  title: z.string(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  category: z.string().nullable().optional(),
  /** Asked again on a schedule, in words — "Every Monday". */
  schedule: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  author_id: Uuid.nullable().optional(),
  author_name: z.string().nullable().optional(),
  author_avatar_url: SignedLink.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
  project_id: Uuid.nullable().optional(),
  reply_count: Count.optional(),
  /** Who it is said to: `author` while it is its author's draft, `project`
      once published. A string, so a client
      reads an answer it does not know rather than failing on it. */
  audience: z.string().optional(),
})
export const PostPage = z.object({
  /** Published announcements only, the asker's own included. */
  posts: z.array(PostInProject),
  next_cursor: z.string().nullable().optional(),
  /** The asker's own drafts in the project, newest first, at most fifty —
      only on a first page asked with `drafts=1`, never otherwise. */
  drafts: z.array(PostInProject).optional(),
})
/** An announcement published, after `PUT /api/posts/:id/audience`. */
export const PostPublished = z.object({
  ok: z.boolean(),
  audience: z.string(),
  /** The moment it was published, which is its `created_at` now too. */
  published_at: z.string().nullable(),
})
/** `GET /api/posts/:id`: the announcement and its replies. */
export const PostRead = z.object({
  /** And whether the reader follows it. */
  post: PostInProject.extend({
    subscribed: z.boolean().optional(),
    /** Whether an agent wrote it — the screen offers Edit on an agent's to
        whoever may change it, on a person's to its author alone. */
    author_agent: z.boolean().optional(),
    /** Whether the reader may change it, as `PATCH` asks: its author, the
        owner, whoever runs the project, and an agent's connector while on
        the project — somebody else's never through a token. */
    may_edit: z.boolean().optional(),
    /** Whether the reader may take it away, as `DELETE` asks: the same
        people, and never through a token at all. */
    may_delete: z.boolean().optional(),
  }),
  comments: z.array(CommentOnObject).optional(),
  /** Where the comments this answer did not carry start: the newest 200, and no more than 4 MB of them, are here; `GET …/comments?before=` with this answers the ones before. Null when all are here. */
  comments_earlier: z.string().nullable().optional(),
})
/** `GET /api/{tasks,posts,files}/:id/comments?before=`: comments older than a read carried, oldest first. */
export const CommentsPage = z.object({
  comments: z.array(CommentOnObject),
  next_cursor: z.string().nullable().optional(),
})

/** Hours logged, summed by project and person — `GET /api/time`, or one
    project's with `?project=`. */
export const HoursByPerson = z.object({
  project_id: Uuid,
  project_name: z.string().nullable().optional(),
  actor_id: Uuid,
  actor_name: z.string().nullable().optional(),
  minutes: z.number().int(),
})
export const HoursList = z.object({ time: z.array(HoursByPerson) })

/** AI spend summed by project, person and client — `GET /api/spend`, or one
    project's with `?project=`. */
export const SpendByPerson = z.object({
  project_id: Uuid,
  project_name: z.string().nullable().optional(),
  actor_id: Uuid,
  actor_name: z.string().nullable().optional(),
  client: z.string(),
  tokens: z.number(),
  cost_usd: z.number().nullable().optional(),
})
export const SpendList = z.object({ spend: z.array(SpendByPerson) })

/** A project in the bin — `GET /api/projects/deleted`, latest first. */
export const ProjectInBin = z.object({
  id: Uuid,
  name: z.string(),
  description: z.string().nullable().optional(),
  deleted_at: z.string(),
})
export const ProjectBin = z.object({ projects: z.array(ProjectInBin) })

/**
 * A person's page — `GET /api/people/:id`: who they are, what is open on
 * them, the projects they share with the reader and how those are going,
 * and, for a reader who may see the Members screen, their weeks, days and
 * hours. Everything counted under the reader's own sight.
 */
export const PersonOnPage = z.object({
  actor_id: Uuid,
  name: z.string(),
  avatar_url: SignedLink.nullable().optional(),
  title: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  joined_at: z.string().nullable().optional(),
  presence: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
})
export const OpenOnPerson = z.object({
  id: Uuid,
  number: z.number().int().nullable().optional(),
  title: z.string(),
  due_on: z.string().nullable().optional(),
  project_id: Uuid,
  project_name: z.string().nullable().optional(),
  project_key: z.string().nullable().optional(),
  project_slug: z.string().nullable().optional(),
  overdue: z.boolean().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
})
export const SharedProject = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string().nullable().optional(),
  key: z.string().nullable().optional(),
  open: Count.optional(),
  overdue: Count.optional(),
  done: Count.optional(),
})
export const PersonWeek = z.object({ week: z.string(), done: Count, said: Count })
export const PersonDay = z.object({ day: z.string(), n: Count })
export const PersonHours = z.object({
  project_id: Uuid,
  project_name: z.string().nullable().optional(),
  task_id: Uuid.nullable().optional(),
  title: z.string().nullable().optional(),
  number: z.number().int().nullable().optional(),
  minutes: z.number().int(),
})
export const PersonPage = z.object({
  person: PersonOnPage,
  open: z.array(OpenOnPerson).optional(),
  shared: z.array(SharedProject).optional(),
  projects: z.array(z.object({ id: Uuid, name: z.string(), slug: z.string().nullable().optional(), key: z.string().nullable().optional() })).optional(),
  weeks: z.array(PersonWeek).optional(),
  days: z.array(PersonDay).optional(),
  hours: z.array(PersonHours).optional(),
})

/**
 * What an agent did this week or this month — `GET /api/agents/:id/work`:
 * the tasks it took, finished and holds, the questions it asked and how
 * many were answered, what its clients said it spent, and its latest ten
 * lines in the feed in the period. Counted under the reader's own sight.
 */
export const AgentWork = z.object({
  period: z.enum(['week', 'month']),
  /** Where the period began, on the reader's calendar. */
  since: z.string(),
  took: Count,
  finished: Count,
  open: Count,
  asked: Count,
  answered: Count,
  tokens: z.number(),
  cost_usd: z.number().nullable().optional(),
  /** How many tasks the spend was on. */
  spent_on: Count,
  events: z.array(ActivityLine),
})
/** One of its numbers' tasks — `GET /api/agents/:id/work/tasks?of=`. */
export const AgentWorkTask = z.object({
  id: Uuid,
  number: z.number().int().nullable().optional(),
  title: z.string(),
  due_on: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  project_id: Uuid,
  project_name: z.string().nullable().optional(),
  project_key: z.string().nullable().optional(),
  project_slug: z.string().nullable().optional(),
  overdue: z.boolean().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  /** `of=spend`: what it spent on this task in the period. */
  tokens: z.number().nullable().optional(),
  cost_usd: z.number().nullable().optional(),
  /** `of=asked` or `answered`: how many of its questions on this task. */
  questions: Count.optional(),
})
export const AgentWorkTasks = z.object({
  tasks: z.array(AgentWorkTask),
  next_cursor: z.string().nullable().optional(),
})

/** An invitation still out, used or revoked — `GET /api/invites`. */
export const InviteRow = z.object({
  id: Uuid,
  role: z.string(),
  project_ids: z.array(Uuid),
  email: z.string().nullable().optional(),
  rights: z.array(z.string()),
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable().optional(),
  used_by: Uuid.nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  /** Mailed to the workspace's own domain, which no longer opens it: it can
      be taken nowhere, and must be sent again. */
  send_again: z.boolean().optional(),
})
export const InviteList = z.object({ invites: z.array(InviteRow) })
/**
 * What sending one answers: whether mail went, and the link's secret, once.
 *
 * `token` is the secret for a link with no address, and for an invitation
 * to an address only when the server sends no mail and the inviter hands
 * the link over themselves.
 * Otherwise it is empty: the link went to the address, and only there.
 * Empty rather than absent, so every client that decodes it as a string
 * still does.
 */
export const InviteMade = z.object({ id: Uuid, token: z.string(), mailed: z.boolean() })
export type InviteMade = z.infer<typeof InviteMade>


/** A webhook — `GET /api/webhooks`. Its secret is said once, when it is made. */
export const WebhookRow = z.object({
  id: Uuid,
  url: z.string(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  /** Whether it sends the receiver's own key as `Authorization` — never the key. */
  authorization_set: z.boolean().optional(),
  last_status: z.number().int().nullable().optional(),
  last_at: z.string().nullable().optional(),
  created_at: z.string(),
  /** Turned off because the account that made it changed hands — its maker
      was the account's previous holder. Turning it on gives it a new secret. */
  stopped_at: z.string().nullable().optional(),
})
export const Webhooks = z.object({ webhooks: z.array(WebhookRow) })
export const WebhookMade = z.object({ id: Uuid, secret: z.string() })
/** A webhook changed — `PATCH /api/webhooks/:id`; `secret`, said once, when
    turning on one its maker's previous holder made gave it a new one. */
export const WebhookChanged = z.object({ ok: z.literal(true), secret: z.string().optional() })

/**
 * GitHub, as the server holds it for this workspace — `GET /api/github`,
 * Whether this server has the app's keys, the
 * installation the owner made, and whether the reader may make one.
 */
export const GithubHello = z.object({
  configured: z.boolean(),
  install: z.object({ account_login: z.string(), account_type: z.string().optional() }).nullable(),
  can_install: z.boolean(),
})
/** A repository the installation was given, and the project it is linked to — `GET /api/github/repos`. */
export const GithubRepo = z.object({ id: z.number().int(), name: z.string(), private: z.boolean(), project_id: Uuid.nullable() })
export const GithubRepos = z.object({ repos: z.array(GithubRepo) })
/**
 * A project's repository — `GET /api/projects/:id/github`: who linked it,
 * whether issues sync, and when it stopped (its linker can no longer act).
 */
export const GithubLink = z.object({
  repo_id: z.string(),
  repo_name: z.string(),
  private: z.boolean(),
  issues: z.boolean(),
  linked_by: Uuid,
  linked_by_name: z.string(),
  stopped_at: z.string().nullable(),
})
export const ProjectGithub = z.object({ link: GithubLink.nullable() })

/**
 * Slack, as the server holds it for this workspace — `GET /api/slack`,
 * Whether it is set up here, the connection and
 * whether Slack still accepts it, and whether the reader may connect it.
 */
export const SlackHello = z.object({
  configured: z.boolean(),
  connection: z.object({ team_name: z.string(), broken: z.boolean(), previews: z.boolean() }).nullable(),
  can_connect: z.boolean(),
})
/** A channel a project may post to — `GET /api/slack/channels`; private ones are the owner's to see. */
export const SlackChannel = z.object({ id: z.string(), name: z.string(), private: z.boolean() })
export const SlackChannels = z.object({ channels: z.array(SlackChannel) })
/**
 * The channel a project posts to — `GET /api/projects/:id/slack`. A
 * private channel's name is empty for anybody but the owner.
 */
export const SlackLink = z.object({
  channel_id: z.string(),
  channel_name: z.string(),
  private: z.boolean(),
  linked_by_name: z.string(),
  stopped_at: z.string().nullable(),
  stopped: z.string().nullable(),
})
export const ProjectSlack = z.object({ link: SlackLink.nullable() })

/** A page of a spreadsheet's tasks written — `POST /api/projects/:id/import/tasks`. */
export const TasksImported = z.object({ written: z.number().int() })

/**
 * A Linear team, a Jira project or an Asana project an import can bring —
 * `POST /api/import/:source/teams|projects`.
 */
export const ImportTeam = z.object({ id: z.string(), key: z.string(), name: z.string(), issues: z.number().int() })
export const ImportTeams = z.object({ teams: z.array(ImportTeam) })
/** How far one team of an import has got. */
export const ImportProgress = z.object({
  project_id: Uuid.optional(),
  issues: z.number().int().optional(),
  reading: z.number().int().optional(),
  done: z.boolean().optional(),
})
/** One of the person's imports — `GET /api/import/linear`, never the key. */
export const WorkspaceImport = z.object({
  id: Uuid,
  source: z.enum(['linear', 'jira', 'asana']),
  teams: z.array(ImportTeam),
  progress: z.record(z.string(), ImportProgress),
  state: z.enum(['running', 'done', 'failed']),
  error: z.string().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
})
export const WorkspaceImports = z.object({ imports: z.array(WorkspaceImport) })

/**
 * A room's history brought from Slack — `POST /api/conversations/:id/import`,
 * Each message's key and the id it was given.
 */
export const MessagesImported = z.object({ ids: z.record(z.string(), Uuid) })
/** A file a Slack message carried, fetched and kept — `POST /api/conversations/:id/import/file`. */
export const FileImported = z.object({ id: Uuid, name: z.string(), content_type: z.string(), size: z.number().int() })

/**
 * An agent in the workspace — `GET /api/agents`, the agents spec and
 * `agent-page.md`: how it is reached (`mcp` or `webhook`), who connected it,
 * where it works, where the reader could put it, its last visit, and whether
 * the reader manages it (`can_manage`, `agent.manage`: whoever connected it)
 * and may take it away (`can_disconnect`, `agent.remove`: the owner too).
 */
export const AgentRow = z.object({
  actor_id: Uuid,
  name: z.string(),
  ...picture,
  reach: z.string(),
  created_by: Uuid,
  created_by_name: z.string(),
  created_at: z.string(),
  project_ids: z.array(Uuid),
  offered_project_ids: z.array(Uuid),
  active_at: z.string().nullable(),
  can_disconnect: z.boolean(),
  can_manage: z.boolean(),
  /** To whoever manages an agent reached by webhook: whether its webhook
      sends the receiver's own key as `Authorization` — never the key. */
  authorization_set: z.boolean().optional(),
  /** To whoever manages it: `tuff`, signed JSON, or `claude_routine`, a
      Claude Code routine's trigger. */
  webhook_shape: z.string().optional(),
  /** To whoever manages it: where its webhook is sent, so its page can
      change it, migration 268. */
  webhook_url: z.string().optional(),
  /** To whoever manages it: its webhook was turned off when whoever
      connected it was put out of the account. Its address is not said, and
      nothing is sent until its reach is set again, with a new secret. */
  webhook_stopped: z.boolean().optional(),
  /** To whoever manages it: the connections Tuff's remote MCP connector
      signed in as it, still alive — which client, when, by whom. */
  connections: z
    .array(z.object({ id: Uuid, client: z.string(), created_at: z.string(), linked_by_name: z.string() }))
    .optional(),
  /** What it says it is doing now. */
  status: AgentStatus.nullable().optional(),
  /** Stopped because whoever connected it was put out of the account: its
      tokens revoked, its webhook off, until its connector gives it a new
      token. */
  stopped: z.boolean().optional(),
})
export const AgentList = z.object({ agents: z.array(AgentRow) })
/** A new token for an agent, the old one ended — `POST /api/agents/:id/token`. Said once. */
export const AgentTokenMade = z.object({ token: z.string() })
/**
 * How an agent is reached, changed — `PUT /api/agents/:id/reach`. Whether
 * the stored `Authorization` value was taken off (a new address or shape),
 * and a webhook's secret, said once, when this made its webhook.
 */
export const AgentReachChanged = z.object({ ok: z.literal(true), authorization_cleared: z.boolean(), secret: z.string().optional() })
/** An agent connected — `POST /api/agents`: its token, and a webhook's secret, said once. */
export const AgentMade = z.object({ agent_id: Uuid, token: z.string(), secret: z.string().optional() })

/**
 * The premade faces an agent can wear instead of a picture.
 * Ten robots, and four each of soft blobs and
 * one-eyed shapes. The server takes only these; the face comes back as the
 * agent's `avatar_url`, `/faces/<id>.png`, so a client that draws pictures
 * draws it with nothing new.
 */
export const AgentFace = z.enum([
  'bot-1', 'bot-2', 'bot-3', 'bot-4', 'bot-5', 'bot-6', 'bot-7', 'bot-8', 'bot-9', 'bot-10',
  'blob-1', 'blob-2', 'blob-3', 'blob-4',
  'geo-1', 'geo-2', 'geo-3', 'geo-4',
])
/** `PUT /api/agents/:id/avatar`: wear one of them. */
export const AgentFacePick = z.object({ preset: AgentFace })
export type AgentFace = z.infer<typeof AgentFace>

/**
 * What deleting the workspace would take — `POST /api/workspace/delete
 * { dry: true }`, the deleting a workspace spec — and what it must be
 * proved with: `password`, `password_and_code`, `code` or `email`.
 */
export const WorkspaceErasing = z.object({
  name: z.string(),
  projects: z.number().int(),
  people: z.number().int(),
  agents: z.number().int(),
  paid: z.boolean(),
  asks: z.string(),
})

/**
 * Which kinds of line the audit log is narrowed to — `GET /api/audit?type=`,
 * Each names the codes it holds: `security_event`'s
 * kinds and the workspace's own actions in `activity_event`. The activity
 * actions are listed again in `183_the_owner_reads_who_did_what.sql`, which
 * is the index's predicate; one added here and not there is never shown.
 */
export const AUDIT_TYPES = {
  sign_ins: ['login', 'register', 'password_changed', 'password_reset', 'email_changed', 'token_issued', 'token_revoked'],
  people: [
    'invite_created', 'invite_accepted', 'workspace_created', 'people.remove', 'people.leave',
    'project.member.add', 'project.member.remove', 'project.leave',
  ],
  rights: ['people.rights', 'project.member.rights', 'ownership_transferred'],
  settings: ['workspace.settings'],
  deletions: ['project.delete', 'project.restore', 'project.purged', 'workspace.delete', 'workspace.restore'],
  integrations: [
    'slack.connect', 'slack.disconnect', 'github.install', 'github.remove',
    'agent.connect', 'agent.disconnect', 'webhook.create', 'webhook.remove', 'webhook.update', 'agent.reach',
    'agent_linked', 'agent_unlinked',
  ],
} as const satisfies Record<string, readonly string[]>
export type AuditType = keyof typeof AUDIT_TYPES
export const AuditTypeKey = z.enum(Object.keys(AUDIT_TYPES) as [AuditType, ...AuditType[]])

/** A line of the audit log — `GET /api/audit`. */
export const AuditEvent = z.object({
  id: Uuid,
  kind: z.string(),
  ip: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  at: z.string(),
  meta: z.unknown().optional(),
  /** `web`, `mcp` or `github` for a line of the feed; absent for a security event. */
  origin: z.string().nullable().optional(),
  actor_id: Uuid.nullable().optional(),
  actor_name: z.string().nullable().optional(),
  /** Whom it was done to: removed, given rights, handed the workspace. */
  subject_id: Uuid.nullable().optional(),
  subject_name: z.string().nullable().optional(),
  /** The same as `subject_name`, kept for the clients that read it. */
  to_name: z.string().nullable().optional(),
  /** The project it was on, by its name now — one in the bin included. */
  project_id: Uuid.nullable().optional(),
  project_name: z.string().nullable().optional(),
})
export const AuditPage = z.object({ events: z.array(AuditEvent), next_cursor: z.string().nullable().optional() })
/** Everybody the log can be narrowed to: who is here, and who was — `GET /api/audit/people`. */
export const AuditPerson = z.object({ actor_id: Uuid, name: z.string(), here: z.boolean() })
export const AuditPeople = z.object({ people: z.array(AuditPerson) })

/** The account's address, a change of it on its way, and what a change of
    anything that matters must be proved with — `GET /api/me/email`. */
export const MeEmail = z.object({
  email: z.string(),
  /** A change waiting on its link: the new address, and whether the old one's yes is what it waits for. */
  pending: z.object({ email: z.string(), approve: z.boolean() }).nullable().optional(),
  asks: z.object({ password: z.boolean(), code: z.boolean(), inbox: z.boolean().optional() }),
})

/** Whether a workspace's address is free — `GET /api/workspaces/address`. */
export const WorkspaceAddress = z.object({ slug: z.string(), free: z.boolean(), suggestion: z.string().nullable().optional() })

/** A workspace made: a session in it, and its address. */
export const WorkspaceMade = Session.extend({ slug: z.string() })

/**
 * Two-factor sign-in, on or off, how many recovery codes are left, and
 * `proof`: what turning it on or off asks beside the factor's own code —
 * `GET /api/2fa`. The password, or for an account with none six digits from
 * `POST /api/me/inbox-code` (`{ for: 'twofa' }` to turn it on,
 * `{ for: 'twofa-off' }` to turn it off).
 */
export const TwoFactor = z.object({
  enabled: z.boolean(),
  recovery_left: z.number().int().optional(),
  proof: z.enum(['password', 'email']).optional(),
})
/** A factor being set up: its secret, and the `otpauth://` address a phone's authenticator reads. */
export const TwoFactorBegun = z.object({ secret: z.string(), url: z.string() })
/** The recovery codes, said once — when the factor is turned on. */
export const RecoveryCodes = z.object({ recovery_codes: z.array(z.string()) })

/** How the inbox reaches this person — `GET /api/inbox/settings`. */
export const InboxSettings = z.object({
  notify_chat: z.boolean(),
  email_digest: z.boolean(),
  quiet_from: z.string().nullable().optional(),
  quiet_to: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
})

/** Where this account is signed in, one row a device — `GET /api/sessions`. */
export const SessionRow = z.object({
  id: Uuid,
  user_agent: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  created_at: z.string(),
  last_used_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  sessions: Count.optional(),
  current: z.boolean().optional(),
  /** The workspace's own domain the session was made on — "Safari on iPhone · projects.agency.com". */
  host: z.string().nullable().optional(),
})
export const Sessions = z.object({ sessions: z.array(SessionRow) })

/** An agent's token — `GET /api/tokens`. Its value is said once, when it is made. */
export const TokenRow = z.object({
  id: Uuid,
  name: z.string(),
  project_ids: z.array(Uuid).optional(),
  created_at: z.string(),
  last_used_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  revoked_at: z.string().nullable().optional(),
})
export const Tokens = z.object({ tokens: z.array(TokenRow) })
export const TokenMade = z.object({ token: z.string() })

/**
 * A task as a card — `GET /api/tasks/:id/card`, what a message that names
 * the task draws under itself. The three
 * `assignee_*` fields are the first of `assignees`, for a client that draws
 * one face. Loose where the server is: every join may come back null.
 */
export const TaskCardFace = z.object({
  id: Uuid,
  number: z.number(),
  title: z.string(),
  project_id: Uuid,
  project_key: z.string().nullable().optional(),
  project_slug: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  list_name: z.string().nullable().optional(),
  list_icon: z.string().nullable().optional(),
  list_color: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string(),
  decided_at: z.string().nullable().optional(),
  due_on: z.string().nullable().optional(),
  /** How it repeats, or null. */
  repeat: Repeat.nullable().optional(),
  priority: z.string().nullable().optional(),
  assignee_id: Uuid.nullable().optional(),
  assignee_name: z.string().nullable().optional(),
  assignee_avatar_url: z.string().nullable().optional(),
  assignees: z.array(z.object({ id: Uuid, name: z.string(), avatar_url: z.string().nullable() })),
  cycle_name: z.string().nullable().optional(),
  labels: z.array(z.object({ id: Uuid, name: z.string(), color: z.string().nullable() })),
})
export const TaskCard = z.object({ card: TaskCardFace })

/**
 * A link's card, as `GET /api/preview?url=` reads it from the page — the
 * same shape a body carries as its `preview` node. `image` is this
 * server's own signed address for the picture, never the site's.
 */
export const LinkPreview = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  site: z.string().nullable(),
})

/**
 * The devices notifications go to, and what this deployment can push to.
 * `key` is the VAPID public key a browser subscribes
 * with, null without one; `apns` is whether the Apple apps can be, `fcm`
 * the Android app. `kind` is a word rather than an enum to a client, so a
 * kind of device it has not heard of does not stop it reading the list.
 */
export const PushDevice = z.object({
  id: Uuid,
  kind: z.enum(['web', 'apns', 'fcm']).or(z.string()),
  said: z.string().nullable(),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
})
export const PushDevices = z.object({
  key: z.string().nullable(),
  apns: z.boolean(),
  fcm: z.boolean().optional(),
  devices: z.array(PushDevice),
})

/**
 * A notification sent to one's own devices to see that it arrives — `POST
 * /api/push/test`. Each device and what its service answered: `status` 2xx
 * is taken, `0` is not tried (`reason` `Unconfigured`) or not reached
 * (`Unreachable`), anything else refused, with Apple's `reason` where it
 * gave one — `BadDeviceToken`, `InvalidProviderToken`.
 */
export const PushTriedDevice = z.object({
  id: Uuid,
  kind: z.enum(['web', 'apns', 'fcm']).or(z.string()),
  said: z.string().nullable(),
  status: z.number().int(),
  reason: z.string().nullable(),
})
export const PushTried = z.object({ devices: z.array(PushTriedDevice) })

/** Six digits sent to the account's address — `POST /api/me/inbox-code`; the address masked. */
export const InboxCodeSent = z.object({ sent_to: z.string() })

/** A sign-in code asked for on a workspace's own domain — `POST /auth/code`.
    The same answer whoever the address is. */
export const SignInCodeAsked = z.object({ sent: z.boolean() })


/** A direct conversation made, or the one these people already had — `POST /api/conversations/direct`. */
export const DirectMade = z.object({ id: Uuid })

/** What changing the password did: every other session ended. */
export const PasswordChanged = z.object({ ok: z.boolean(), signed_out: z.number().int().optional() })

/**
 * A password set from a mailed link — `POST /auth/password/reset`. The
 * first password of an address nobody had proved, chosen in the browser
 * that signed up, signs in: a session in the account's first workspace
 * beside `ok`. Otherwise `ok` alone.
 */
export const PasswordSet = PasswordChanged.extend(Session.partial().shape)

/**
 * What deleting the account would do, asked before it is done — `POST
 * /api/me/delete { dry: true }`: the workspaces that go with it, the ones
 * that stop it, the ones it only leaves, and what it must be proved with.
 */
export const DeletionPlan = z.object({
  ok: z.boolean(),
  why: z.string().nullable().optional(),
  alone: z.array(z.object({ name: z.string() })).optional(),
  blocked: z.array(z.object({ name: z.string(), people: z.number().int() })).optional(),
  leaves: z.array(z.object({ name: z.string() })).optional(),
  /** `email`, `password` or `password_and_code`. */
  asks: z.string().optional(),
})

/** An invitation as a stranger sees it — `GET /auth/invite/:token`: which
    workspace, for whom, and whether it can still be used. */
export const InvitePreview = z.object({
  state: z.string(),
  workspace_name: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  /** The workspace's mark above "Join", where its plan wears one and the
      invitation is still `open`. */
  brand: Brand.nullable().optional(),
  /** The workspace's own domain this invitation was mailed to and is taken
      on, read anywhere else: go there. */
  host: z.string().optional(),
})
export type InvitePreview = z.infer<typeof InvitePreview>
/** The same invitation, seen while signed in — `GET /api/invite/:token`. */
export const InviteForMe = InvitePreview.extend({
  you: z.object({ name: z.string(), email: z.string().nullable().optional() }).optional(),
  member: z.boolean().optional(),
  workspace_id: Uuid.nullable().optional(),
})

/** A link from an email followed — `POST /auth/verify`: a session, or what
    it confirmed when it cannot hand one over. */
export const Verified = Session.partial().extend({
  confirmed: z.boolean().optional(),
  approved: z.boolean().optional(),
  changed: z.boolean().optional(),
  email: z.string().nullable().optional(),
  /** Confirming took the password the account had, chosen before the
      address was proved (migration 212): a reset token of a day to choose
      one with (`POST /auth/password/reset`). */
  choose_password: z.string().optional(),
})

/**
 * What a change of address's link is about, read before anything is
 * pressed — `POST /auth/verify/peek`. `approve` is the old address's yes; `email` the new
 * address's link, confirmed only from a session of `account`
 * (`POST /api/me/email/confirm`). The account's address is masked.
 */
export const AddressLinkKind = z.enum(['approve', 'email'])
/** The account a change of address moves: its name, and its address masked. */
export const AddressLinkAccount = z.object({ id: Uuid, name: z.string(), email: z.string() })
export const AddressLink = z.object({
  kind: AddressLinkKind,
  email: z.string(),
  account: AddressLinkAccount,
  /** Whether confirming takes a session of `account`. False for an account
      whose address was never proved: it has no way to sign in on another
      device, and confirming puts out
      whoever held it, so the press alone confirms. False for
      `approve` too, whose press asks for no session. */
  needs_session: z.boolean(),
})

/**
 * An account asked for, waiting on its email — `POST /auth/register`.
 *
 * `email` and `approve` are there for the iPhone and Android builds from
 * before the password came after the proof, whose generated types named this answer after another
 * `{ email, approve }` and decoded it as that: without them the sign-up
 * said it had failed although the letter had gone.
 */
export const Pending = z.object({
  pending: z.boolean(),
  /** The address as it was typed, lowercased. */
  email: z.string().optional(),
  /** Always false. */
  approve: z.boolean().optional(),
})

/** A task or a document that can be named with `#` — `GET
    /api/conversations/:id/tasks?q=`, `GET /api/projects/:id/nameable?q=`.
    A document says `kind: "doc"`. */
export const Nameable = z.object({
  id: Uuid,
  number: z.number().int().nullable().optional(),
  title: z.string(),
  project_id: Uuid,
  project_key: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
})
export const Nameables = z.object({ tasks: z.array(Nameable) })

/** The key a client searches GIFs with, or null where none is set — `GET /api/gifs/key`. */
export const GifKey = z.object({ key: z.string().nullable() })

/** A sprint — `GET /api/projects/:id/cycles`, latest first. */
export const CycleInProject = z.object({
  id: Uuid,
  name: z.string(),
  starts_on: z.string().nullable().optional(),
  ends_on: z.string().nullable().optional(),
  tasks: Count.optional(),
})
export const CyclesInProject = z.object({ cycles: z.array(CycleInProject) })

/** A task waiting on others, and the handles it waits on now. */
export const Rewait = z.object({ id: Uuid, waiting_on: z.array(z.string()) })

/**
 * What changing a task answers: the key a move gave it, and what finishing
 * or reopening did to its series — the next one
 * made, as a row of the project's list, or the id of the one taken back.
 */
export const TaskChanged = z.object({
  ok: z.boolean(),
  sort_key: z.string().nullable().optional(),
  next: TaskInProject.nullable().optional(),
  withdrawn: Uuid.nullable().optional(),
  /** The parts of `next`, as the list draws them. */
  next_parts: z.array(TaskInProject).optional(),
  /** How the moved task repeats now, when a next was made or withdrawn. */
  repeat: Repeat.nullable().optional(),
  /** Finished or reopened just now: the tasks it blocks that the caller can
   *  see, each with what it waits on now. */
  rewaits: z.array(Rewait).optional(),
  /** The task itself as the project's list draws it, after the change —
   *  so the list behind the task's own screen puts that row in place
   *  rather than reading the project again. */
  task: TaskInProject.optional(),
  /** Its parts, when it moved to another list and took them along. */
  parts: z.array(TaskInProject).optional(),
})

/** `POST /api/tasks/:id/duplicate`: the copy, and it and its parts as the
    project's list draws them. */
export const TaskDuplicated = z.object({ id: Uuid, tasks: z.array(TaskInProject).optional() })

/** `POST /api/tasks/:id/steps`: the part, as the project's list draws it. */
export const StepMade = z.object({ id: Uuid, task: TaskInProject.optional() })

/** `PATCH /api/steps/:id`: the part as the list draws it after the tick, and
    the tasks it blocks as they wait now. */
export const StepChanged = z.object({
  ok: z.boolean(),
  task: TaskInProject.optional(),
  rewaits: z.array(Rewait).optional(),
})

/** `DELETE /api/tasks/:id`: and, for one of a series skipped, the next one it
    made and its parts, as the list draws them. */
export const TaskDeleted = z.object({
  ok: z.boolean(),
  next: TaskInProject.optional(),
  next_parts: z.array(TaskInProject).optional(),
})

/** What a number is in a project — `GET /api/projects/:id/at/:number`, the
    way an address's `STU-41` becomes the task it names. */
export const AtNumber = z.object({ id: Uuid, kind: z.string() })

/**
 * A task copied to a project, or what the copy would be — `POST
 * /api/tasks/:id/copy`, `{ dry: true }` for the second, when `id` and
 * `number` are null.
 */
export const TaskCopied = z.object({
  id: Uuid.nullable(),
  from_project_id: Uuid,
  project_id: Uuid,
  number: z.number().int().nullable(),
  list_id: Uuid.nullable(),
  list_name: z.string().nullable(),
  /** Its parts, copied with it, each as finished as it was. */
  subtasks: z.number().int(),
  labels_kept: z.array(z.string()),
  labels_dropped: z.array(z.string()),
  /** The original's sprint, by name, which the copy is not in. */
  cycle: z.string().nullable(),
  /** Whoever has the original and is not on that project: not given the copy. */
  assignees_dropped: z.array(z.object({ actor_id: Uuid, name: z.string() })),
  /** Files of the original's own project its words show, each copied as a
      file of the target; any other file it names keeps its id. */
  files: z.number().int(),
  /** Whether that project keeps its tasks as GitHub issues, so the copy becomes one. */
  github_to: z.boolean(),
  /** The copy and its parts as that project's list draws them; absent for
      `dry`. */
  tasks: z.array(TaskInProject).optional(),
})
export type TaskCopied = z.infer<typeof TaskCopied>

/**
 * A project's feedback page, as its settings section reads it — `GET
 * /api/projects/:id/feedback`. `page` is null until
 * somebody turns it on; `may` is `feedback.manage` (whoever runs the
 * project, on a paid plan); `paid` says which of the two refused it.
 */
export const FeedbackSettings = z.object({
  page: z
    .object({
      id: Uuid,
      slug: z.string(),
      name: z.string(),
      intro: z.string().nullable(),
      live: z.boolean(),
    })
    .nullable(),
  /** What the address field offers before there is a page. */
  suggested_slug: z.string(),
  /** Whether the reader hears of new requests. */
  following: z.boolean(),
  may: z.boolean(),
  paid: z.boolean(),
  /** Whether the project has a Triage for requests to land in. */
  triage: z.boolean(),
})
export type FeedbackSettings = z.infer<typeof FeedbackSettings>

/**
 * The public page, read with no session — `GET /api/f/:slug`. Nothing about
 * the workspace, the project or anybody in it: the page's own name and
 * line, and the mark it wears. `available` false is a page that is off, or
 * on a plan that has no page; `moved_to` is the slug a given-up one became.
 */
export const FeedbackPublic = z.object({
  slug: z.string(),
  name: z.string(),
  intro: z.string().nullable(),
  mark: z.object({ icon: z.string(), tint: z.number().int(), url: z.string().nullable() }),
  available: z.boolean(),
  /** Turnstile's site key, or null where this deployment has none. */
  turnstile_site_key: z.string().nullable(),
  moved_to: z.string().optional(),
  /** The workspace's name and mark at the foot in place of "Made with
      Tuff", where its plan wears them and the page is `available`; null,
      and nothing about the workspace, anywhere else. */
  brand: Brand.nullable().optional(),
})
export type FeedbackPublic = z.infer<typeof FeedbackPublic>

/**
 * A document shared to the web, read with no session —
 * `GET /api/public/docs/:token`. Its title,
 * its body without what belongs to the people on the project, when it last
 * changed, a link for each picture it names, and the workspace's brand
 * where its plan wears one — otherwise null, and nothing about who.
 */
export const PublicDocument = z.object({
  name: z.string(),
  body: z.record(z.string(), z.unknown()).nullable(),
  updated_at: z.string(),
  pictures: z.record(z.string(), z.object({ url: SignedLink, display_url: SignedLink.nullable() })),
  brand: Brand.nullable().optional(),
})
export type PublicDocument = z.infer<typeof PublicDocument>

/**
 * A room's incoming webhook, as its settings list it — never its secret,
 * which nothing can show again.
 */
export const RoomHook = z.object({
  id: Uuid,
  name: z.string(),
  created_by: Uuid,
  created_by_name: z.string(),
  created_at: z.string(),
  turned_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  /** Stopped because its maker's account changed hands: it takes nothing
      until somebody gives it a new URL. */
  stopped_at: z.string().nullable().optional(),
})
export type RoomHook = z.infer<typeof RoomHook>
export const RoomHooks = z.object({ hooks: z.array(RoomHook) })
export type RoomHooks = z.infer<typeof RoomHooks>
/** Made or turned over: the address, once, with the secret in it. */
export const RoomHookAddress = z.object({ id: Uuid, name: z.string(), url: z.string() })
export type RoomHookAddress = z.infer<typeof RoomHookAddress>
