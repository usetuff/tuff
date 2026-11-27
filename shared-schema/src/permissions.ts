import { z } from 'zod'
import { Role } from './enums.js'

/**
 * Every action the product checks. The permission matrix, as data.
 *
 * A row here and a row there are the same thing; the table in the design is not
 * documentation of the code, it is the code's input. Anything not on this list
 * has no way to ask about permission, which is the point.
 */
export const Action = z.enum([
  // Workspace
  /*
   * Making another workspace, and opening a session in one other than the
   * session's own. Everybody's who
   * signed in in person, and nobody's whose address is unproved: each was a
   * place a stranger holding a session for somebody's address could build,
   * and the owner would inherit it with the stranger in it.
   */
  'workspace.create',
  'workspace.enter',
  'workspace.billing',
  'workspace.transfer',
  'workspace.delete',
  /*
   * The workspace's own address. The
   * owner's, as billing is: the domain comes with the plan and is the
   * company's face. Never through a token, an agent, an unproved address or
   * a session made on a host, and only where the edition has plans — the
   * community edition has no domains, and is never told a plan.
   */
  'workspace.domain',
  /*
   * Leaving the session's workspace yourself.
   * A member's, in person: never the owner, who hands the workspace over
   * first, never an agent, never through a token.
   */
  'workspace.leave',
  /*
   * Saying Join or Leave about a workspace the account was in before its
   * address was proved.
   * The person's own, in person: never through a
   * token, never an agent, and never an unproved address, which has
   * nothing waiting for it.
   */
  'workspace.confirm',
  'people.invite',
  'people.role',
  'people.read',
  /*
   * The Members screen: the roster and a person's page — their weeks, their
   * hours, every project they are on. Not who is in the workspace: that is
   * `people.read`, and the pickers that assign a task or staff a project
   * need it whatever this says.
   */
  'members.read',
  // Projects
  'project.create',
  'project.archive',
  'project.member.add',
  /*
   * Taking somebody off a project — the owner's, and whoever runs it.
   * Not `project.member.add` turned round: adding a colleague to help is any
   * member's to do, deciding who is there at all is running the project, and
   * the row's own policy (`pm_update`) has always said so.
   */
  'project.member.remove',
  /*
   * Taking yourself off a project — anybody on it. Its own action rather
   * than `project.member.remove` asked about yourself, because the answer
   * travels with the project (`can` on each one) before anybody is chosen:
   * "may remove" with a target in it cannot be said on a list, and a list
   * is how the screen learns which doors to draw.
   */
  'project.leave',
  'project.tools',
  // Content
  'content.create',
  'content.edit.own',
  'content.edit.any',
  /*
   * Changing what somebody else *said*, which is not the same as changing
   * what they wrote.
   *
   * The permission matrix says "only your own, and others' documents behind
   * the switch" — a
   * member may edit another person's **document** when the workspace says
   * so, and that is all the switch was ever about. A comment is not a
   * document: it is speech with a name on it, and rewriting it leaves that
   * name underneath. So this is the same question as `content.edit.any`
   * minus the switch — the owner, and whoever runs the project.
   */
  'content.edit.said',
  /*
   * The four that are held one at a time, named after the rights that grant
   * them because they are the same question asked from the other side.
   *
   * `content.create` still covers posts and documents. These are separate
   * because somebody asked for them separately: "may make tasks here" and
   * "may delete a channel" are decisions a person makes about one other
   * person, and a single write permission cannot carry either.
   */
  'task.create',
  'task.delete',
  'channel.create',
  'channel.delete',
  /*
   * Deleting somebody else's document, upload or link in Docs.
   * Not a right of its own: the one that
   * already says "delete what somebody else made here", `task.delete`,
   * grants it. Your own needs nothing beyond being on the project, which
   * the endpoint asks as `content.edit.own`.
   */
  'file.delete',
  /*
   * Naming the agent that takes a list's new tasks.
   * Whoever may arrange the project's lists (`task.create`), in person:
   * never an agent and never through a token, since "give every new task
   * to the agent" is a sentence anybody can write in a task.
   */
  'list.agent',
  /*
   * Who a written document is for — publishing a draft, and choosing who
   * sees it after: Its author always; anybody
   * else who may edit it (`content.edit.any`), because rewriting it,
   * putting it on the web and saving it as a template already hand its
   * words to more people. Never an agent's and never through a token.
   */
  'file.share',
  /*
   * Publishing an announcement kept as its author's draft.
   * Its author's, while they may post on the
   * project; nobody else's, since nobody else can see it. Never an agent's
   * and never through a token: publishing tells everybody on the project,
   * and "publish your drafts" is a sentence anybody can write in a task.
   * Asked too of whoever asks for a draft, since a draft somebody cannot
   * publish is one nobody would ever see.
   */
  'post.publish',
  /*
   * Marking one written document as the project's instructions for agents,
   * or taking the mark off. Whoever may change
   * the document and run the project (`project.tools`): it changes what
   * every agent working there is told. Never an agent's and never through
   * a token — the document an agent reads first is what an injected
   * instruction would most want to be.
   */
  'file.for_agents',
  /*
   * A channel outside every project. Its own
   * row because no project's rights can answer it: there is no project.
   * Every member may, unless the owner said otherwise about them.
   */
  'channel.create.workspace',
  /*
   * Leaving a channel you can see. Anybody's, in
   * person, and asks nothing about what they were given: a way out that
   * depends on a right is a room somebody can be locked in.
   */
  'channel.leave',
  /*
   * A room's incoming webhooks: making
   * one, turning its secret over, removing it. Whoever may rename the room
   * and say who is in it, and never through a token: pointing the outside
   * at a room is a person's press.
   */
  'hook.manage',
  /*
   * A reminder on a task for yourself. Anybody
   * who can see the task, which the database decides; nobody else ever
   * sees it. Not an agent's: it has no bell or phone of its own.
   */
  'task.remind',
  /*
   * A question with choices on a task, and the press that answers it.
   * Asking is an agent's alone, where it
   * may comment: the buttons are for somebody waiting elsewhere. Answering
   * is a person's, never an agent's and never a token's.
   */
  'question.ask',
  'question.answer',
  /*
   * Saying what it is doing now, on a task or none — an agent's own, about
   * itself.
   */
  'agent.status',
  'activity.read',
  // Time
  'time.own',
  'time.any',
  /*
   * Working through an agent at all — a token, MCP, a connected ChatGPT or
   * Claude. Where a plan holds agents back, nobody makes a token and no
   * token does anything.
   */
  'agent.use',
  /*
   * Connecting an agent as a participant a task can be given to — the
   * owner's, and a member's the owner lets.
   */
  'agent.connect',
  /*
   * Managing one agent once it is connected: its face, its name, a new
   * token for it, how it is reached, signing Tuff's connector in as it.
   * Whoever connected it, and nobody else — not the owner: every agent is
   * somebody's, and a new token for it is a way to read what it was given.
   */
  'agent.manage',
  /*
   * Taking an agent's access away: disconnecting it, ending a connection
   * made as it. The owner's, and whoever connected it — taking away hands
   * nothing over.
   */
  'agent.remove',
  /*
   * Reading what one agent did this week or month — the tasks it took and
   * finished, the questions it asked, what it spent. Whoever the Members
   * screen is open to, and whoever connected it, since it works for them;
   * the rows stay the reader's own.
   */
  'agent.work.read',
  /*
   * Setting up a project's public feedback page.
   * Whoever runs the project, on a paid plan, and never through a token:
   * putting a page on the web is a person's press.
   */
  'feedback.manage',
  // Credentials
  'token.issue.own',
  'token.revoke.any',
  'audit.read',
  /*
   * The product's own admin — every workspace, every account, and plans
   * given without payment. Held by no role: an
   * operator is somebody the deployment trusts, which no workspace can make.
   */
  'operator',
  /*
   * Your own server's switch for signing up, its owners and its mail test.
   * Held by no role: an instance owner owns the
   * machine, which no workspace can make anybody. Never on the service.
   */
  'instance',
])
export type Action = z.infer<typeof Action>

/**
 * The four places an agency and a hundred-person internal team genuinely
 * disagree. Everything else in the matrix is a default with no choice.
 *
 * The fourth — who sees the Members screen — the product's author asked
 * for: an agency of six reads each other's weeks and hours as a matter of
 * course, and a company of a hundred may not want everyone to.
 * Adding a fifth is the easy mistake: the
 * design's rule is that settings exist only where teams really differ in the
 * answer.
 */
export const WorkspaceSettings = z.object({
  who_creates_projects: z.enum(['members', 'owner']).default('members'),
  who_invites_people: z.enum(['owner', 'members']).default('owner'),
  edit_others_content: z.enum(['own_only', 'documents_too']).default('documents_too'),
  who_sees_members: z.enum(['members', 'owner']).default('members'),
})
export type WorkspaceSettings = z.infer<typeof WorkspaceSettings>

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  who_creates_projects: 'members',
  who_invites_people: 'owner',
  edit_others_content: 'documents_too',
  who_sees_members: 'members',
}

type Grant = readonly Role[]

/**
 * The fixed half of the matrix.
 *
 * `project.create` and `content.edit.any` are absent: both depend on a switch
 * and are decided in `can` instead. Everything listed here is the same for
 * every workspace, forever.
 */
const FIXED: Partial<Record<Action, Grant>> = {
  'workspace.create': ['owner', 'member'],
  'workspace.enter': ['owner', 'member'],
  'workspace.confirm': ['owner', 'member'],
  'workspace.billing': ['owner'],
  'workspace.transfer': ['owner'],
  'workspace.delete': ['owner'],
  'people.invite': ['owner'],
  'people.role': ['owner'],
  'people.read': ['owner', 'member'],
  'project.member.add': ['owner', 'member'],
  'content.create': ['owner', 'member'],
  'content.edit.own': ['owner', 'member'],
  'activity.read': ['owner', 'member'],
  'task.remind': ['owner', 'member'],
  'question.ask': ['owner', 'member'],
  'question.answer': ['owner', 'member'],
  'agent.status': ['owner', 'member'],
  'channel.leave': ['owner', 'member'],
  'time.own': ['owner', 'member'],
  'token.issue.own': ['owner', 'member'],
  'token.revoke.any': ['owner'],
  'audit.read': ['owner'],
}

/**
 * What somebody may do on one project, granted one at a time.
 *
 * There is no sort of person here — no client, no
 * guest, no admin — only a list of things somebody was given, each one
 * short enough to say out loud. A permission nobody can name is one nobody
 * can decide to give.
 */
export const Right = z.enum([
  'task.create',
  'task.delete',
  'channel.create',
  'channel.delete',
  'edit.any',
  'manage',
])
export type Right = z.infer<typeof Right>

/** What somebody added to a project arrives with. */
export const RIGHTS_ON_JOINING: readonly Right[] = ['task.create', 'channel.create']

/**
 * What whoever makes a project holds on it: every right, which `manage`
 * carries anyway. A member who starts a project runs it — decides who is on
 * it, its tools, its settings — and was arriving on it with nothing at all,
 * the column's empty default, so the one person who wanted the project could
 * not invite anybody to it or even make a task there.
 */
export const RIGHTS_OF_ITS_MAKER: readonly Right[] = Right.options

/**
 * The rights a project's maker is stored with. The owner holds every right
 * everywhere by being the owner, so a row of all six would decide nothing
 * while they are — and would outlive a handover: `transfer_workspace` leaves
 * rows it finds, and the former owner would run every project they ever
 * started. The owner's own row says the ordinary two, as migration 119 meant.
 */
export const rightsOfItsMaker = (role: string): Right[] => [...(role === 'owner' ? RIGHTS_ON_JOINING : RIGHTS_OF_ITS_MAKER)]

/** What `manage` carries, because those powers are about the project itself. */
const MANAGING: readonly Action[] = ['project.archive', 'project.member.remove', 'project.tools', 'time.any', 'feedback.manage']

/**
 * The actions a named right grants, and which right grants each.
 *
 * Written as a table rather than four branches because the answer is the
 * same shape every time: the owner, or whoever runs the project, or whoever
 * was handed this one thing. A fifth of these should be a row here.
 */
const BY_RIGHT: Partial<Record<Action, Right>> = {
  'task.create': 'task.create',
  'task.delete': 'task.delete',
  /* Others' rows in Docs, by the right that deletes others' tasks. */
  'file.delete': 'task.delete',
  /* The list's agent, by the right that arranges the lists. */
  'list.agent': 'task.create',
  'channel.create': 'channel.create',
  'channel.delete': 'channel.delete',
}

export type PermissionInput = {
  role: Role
  settings: WorkspaceSettings
  /** Whether the actor is on the project the object belongs to. */
  inProject?: boolean
  /**
   * Whether the actor has a row on the project's list of people — joined it,
   * rather than seeing it the way the owner sees every project. Only
   * leaving asks: an owner who was never put on a project has nothing there
   * to leave.
   */
  joined?: boolean
  /** Whether the actor authored the object. */
  isAuthor?: boolean
  /**
   * What this person was given on the project in question.
   *
   * `project_member.rights`. Empty is the honest answer when the question is
   * not about a project at all.
   */
  rights?: readonly string[]
  /** Whether the call arrived through MCP rather than from a person typing. */
  viaMcp?: boolean
  /**
   * Whether the call came through anything but a person's own press: a
   * token of any kind (`viaMcp`), a change GitHub caused, or an import
   * writing as somebody. Set by the server after whatever a handler says,
   * so no handler turns a tool back into a person. Read where "never
   * through a token" has to hold for every kind of one — so far, an
   * agent's words changed by its connector.
   */
  viaTool?: boolean
  /** The plan the workspace is on, where the edition has plans. Unsaid
      holds nothing back: a caller that does not know asks nothing about
      agents. */
  plan?: string
  /**
   * What the owner said about this one person — `docs/specs/member-rights.md`.
   *
   * `mayCreateProjects` unset or null follows the workspace switch; true or
   * false is the owner's word about them and wins over it.
   * `mayCreateChannels` false is a ceiling over every project they are on.
   */
  mayCreateProjects?: boolean | null
  mayCreateChannels?: boolean
  /** The same word about the Members screen and about inviting: unset or
      null follows `who_sees_members` and `who_invites_people`; true or false
      wins over them. */
  maySeeMembers?: boolean | null
  mayInvitePeople?: boolean | null
  /** And about connecting agents: false unless the owner said yes. */
  mayConnectAgents?: boolean
  /** Whether the one asking is an agent. */
  agent?: boolean
  /** Whether the one asking connected the agent in question — `agent.manage`;
      for `content.edit.said`, the live agent that wrote the words. */
  connectedIt?: boolean
  /** Whether the deployment trusts this person to run the product. */
  operator?: boolean
  /** Whether this person owns the server it runs on. */
  instanceOwner?: boolean
  /**
   * Whether the server it runs on is one's own with sign-up closed — its
   * owners decide who has an account, and a new workspace is a door to
   * new accounts (its owner invites).
   */
  signUpClosed?: boolean
  /**
   * Whether the one asking has an address nobody has proved — a session
   * from an invitation link with no address on it, followed with whatever
   * address was typed. The password after proof spec: a member of
   * the workspace it joined, and nothing more, whatever its role says.
   */
  unproved?: boolean
  /**
   * Whether the address is proved only by a link handed over where there is
   * no mail ('s weak proof). Proved enough to sign in and work, not
   * to hand a workspace over: a by-hand account handed one, its maker gone,
   * was a workspace the real owner's proof would land them in unasked
   * (M2).
   */
  byHand?: boolean
  /**
   * Whether the call came with a token made for some projects only.
   * Such a token does nothing about the workspace
   * as a whole, and nothing on a project outside its list
   * (`outsideToken`).
   */
  tokenLimited?: boolean
  /** Whether the project in question is outside that token's list. */
  outsideToken?: boolean
  /**
   * Whether the one asking holds a board's link rather than an account.
   * Answered from `ON_A_BOARD` alone.
   */
  board?: boolean
  /**
   * Whether the one asking is a feedback page's own actor, filing what a
   * stranger asked for. Answered from
   * `ON_A_FEEDBACK_PAGE` alone.
   */
  feedbackPage?: boolean
  /** Whether the project asked about is that page's own: the only one its
      actor may file into, whatever it holds elsewhere. */
  onItsPage?: boolean
  /**
   * Whether the session was made on a workspace's own domain.
   * Its token sits where whoever controls
   * that domain's DNS can read it, so it does nothing that outlives it or
   * reaches past its workspace (`NEVER_ON_A_HOST`), wherever it is used.
   */
  onAHost?: boolean
}

/**
 * Operations a token can never perform, whatever the person behind it may do.
 *
 * The design requires side effects through MCP to be forbidden or confirmed. A
 * hard stop is the half that cannot be argued with: a confirmation dialog
 * relies on somebody reading it, and people click OK without reading.
 */
export const NEVER_VIA_MCP: readonly Action[] = [
  /* A session's to open, never a token's: a narrow key turned wide. */
  'workspace.create',
  'workspace.enter',
  /* Which workspaces the account is in is a person's to answer, in person. */
  'workspace.confirm',
  'workspace.billing',
  'workspace.transfer',
  'workspace.delete',
  'workspace.domain',
  'people.invite',
  'people.role',
  'token.revoke.any',
  // The design names deletion among the side effects a tool may not have, and
  // this action carries both archiving and deleting a project — one row in
  // the matrix, so one stop. Losing a project to a misread instruction in a
  // task description is not something a confirmation dialog prevents.
  'project.archive',
  // Who an agent is and whether it goes on: a person's, at the screen.
  'agent.manage',
  'agent.remove',
  /*
   * The same rule, one size down.
   *
   * Project content is data, not instructions — and a task whose description
   * asks for the channel to be cleared is exactly the shape that arrives.
   * Making things through a tool is useful and reversible; removing them is
   * neither, so the two are not one permission here.
   */
  'task.delete',
  'channel.delete',
  'file.delete',
  /* Who reads a document is a person's press — "share this with everyone"
     is a sentence anybody can write in a task. */
  'file.share',
  /* And an announcement's draft, told to everybody. */
  'post.publish',
  /* Who is on a project is a person's decision, as what they may do there
     already was — the rights are never set through a token either. "Take
     everyone off the project" is a sentence anybody can write in a task. */
  'project.member.remove',
  /* The same question about yourself. A token is the person's, and "leave
     every project you are on" is as easy a sentence to plant as the other. */
  'project.leave',
  /* And out of a channel: "leave every channel" is the same sentence. */
  'channel.leave',
  // The widest door there is: every company's accounts, and their plans.
  'operator',
  /* Who may make an account on the server, and who owns it. */
  'instance',
  /* Putting a page on the web that strangers write to.
     "Turn on the feedback page" is a sentence anybody can write in a task. */
  'feedback.manage',
  /* And an address strangers post into a room through — the same rule, */
  'hook.manage',
  /* Answering an agent's question is a person's press — "answer the
     question with the first choice" is a sentence anybody can write. */
  'question.answer',
  /* Who takes a list's new tasks. */
  'list.agent',
  /* What every agent on a project is told to read first. */
  'file.for_agents',
]

/**
 * The one place access is decided.
 *
 * Role, project membership, workspace switches and the client-visibility flag
 * all meet here and nowhere else. The front end asks what is available so it
 * can hide buttons; this still decides.
 */
const has = (input: PermissionInput, right: Right): boolean =>
  (input.rights ?? []).includes(right)

/*
 * What an agent never does, whoever connected it: decide who is where, who
 * may do what, or what exists — a person's decisions, and the inputs an
 * agent acts on are text anybody could have written ("take everyone off the
 * project").
 */
const NEVER_AN_AGENT: readonly Action[] = [
  'workspace.create', 'workspace.enter', 'workspace.confirm',
  'project.create', 'project.member.add', 'project.member.remove', 'project.leave', 'project.archive', 'project.tools',
  'people.invite', 'people.role', 'members.read', 'agent.connect', 'agent.manage', 'agent.remove', 'agent.work.read', 'token.issue.own',
  'channel.create', 'channel.create.workspace', 'channel.delete', 'task.delete', 'file.delete', 'file.share', 'post.publish', 'time.any', 'feedback.manage',
  'instance', 'task.remind', 'hook.manage', 'question.answer', 'workspace.leave', 'channel.leave', 'list.agent',
  'file.for_agents',
]

/*
 * What a token made for some projects never does: anything about the
 * workspace as a whole. A project it makes or a channel outside every
 * project is one it could not then see; the people, the money, the
 * Members screen and the audit are no project's.
 */
const NEVER_A_LIMITED_TOKEN: readonly Action[] = [
  'workspace.create', 'workspace.enter', 'workspace.confirm',
  'workspace.billing', 'workspace.transfer', 'workspace.delete', 'workspace.domain',
  'people.invite', 'people.role', 'members.read',
  'project.create', 'channel.create.workspace',
  'agent.connect', 'agent.manage', 'agent.remove', 'agent.work.read',
  'token.issue.own', 'token.revoke.any', 'audit.read', 'operator', 'instance', 'hook.manage',
]

/*
 * What a board's link may do, and nothing else.
 *
 * A closed list rather than a set of refusals: a board's guest and its
 * agents' names are members of a workspace of one project, and the rest of
 * the matrix would hand a member of a workspace a great deal. Asked first,
 * before the plan and the roles, so whatever is added to the product next
 * is refused to a board by not being written here.
 */
export const ON_A_BOARD: readonly Action[] = ['task.create', 'content.create', 'content.edit.own', 'content.edit.any']

/*
 * What a feedback page's actor may do: file a request as a task, and
 * nothing else. A closed list for the same
 * reason a board's is: the actor is a member of a company's workspace, and
 * the rest of the matrix would hand it a great deal.
 */
export const ON_A_FEEDBACK_PAGE: readonly Action[] = ['task.create', 'content.create']

/*
 * What an address nobody has proved never does.
 * Everything here builds something that outlives the proof: another
 * workspace, a way into one, people, keys, hooks, money. The account's
 * owner, proving the address later, would inherit all of it with whoever
 * built it still inside.
 */
export const NEVER_UNPROVED: readonly Action[] = [
  'workspace.create', 'workspace.enter', 'workspace.confirm', 'workspace.billing', 'workspace.transfer', 'workspace.delete',
  'workspace.domain', 'people.invite', 'people.role', 'token.issue.own', 'token.revoke.any', 'audit.read',
  'agent.connect', 'agent.manage', 'agent.remove', 'feedback.manage', 'operator', 'instance', 'hook.manage',
]

/*
 * What a session made on a workspace's own domain never does, at
 * usetuff.com or on the host. Whoever
 * controls that domain's DNS can read what the browser keeps there, so
 * nothing here: another workspace, money, the workspace itself, the domain,
 * a token for an agent, or anybody's token ended.
 */
export const NEVER_ON_A_HOST: readonly Action[] = [
  'workspace.create', 'workspace.enter', 'workspace.confirm', 'workspace.leave',
  'workspace.billing', 'workspace.transfer', 'workspace.delete', 'workspace.domain',
  'token.issue.own', 'token.revoke.any', 'agent.connect', 'agent.manage',
  /* And an agent disconnected, or a connection made as it ended: as
     lasting as connecting one, and somebody else's work stopped. */
  'agent.remove',
  /* People let in or given a role, and what sends the workspace's work out
     of it — webhooks, Slack, GitHub (behind `audit.read`), a room's
     incoming hooks, a public feedback page: each outlives the session. A
     document shared to the web is not here: sharing a link is the work. */
  'people.invite', 'people.role', 'audit.read', 'hook.manage', 'feedback.manage',
  'operator', 'instance',
]

export function can(action: Action, input: PermissionInput): boolean {
  const { settings } = input
  let { role } = input

  if (input.board) return ON_A_BOARD.includes(action)
  if (input.feedbackPage) return input.onItsPage === true && ON_A_FEEDBACK_PAGE.includes(action)

  /* A member's rights in the workspace it joined, and no more: an owner's
     role held by an unproved account counts as a member's. */
  if (input.unproved) {
    if (NEVER_UNPROVED.includes(action)) return false
    if (role === 'owner') role = 'member'
  }
  if (input.byHand && action === 'workspace.transfer') return false
  if (input.onAHost && NEVER_ON_A_HOST.includes(action)) return false

  if (input.viaMcp && NEVER_VIA_MCP.includes(action)) return false
  if (input.agent && NEVER_AN_AGENT.includes(action)) return false
  /* Only an agent asks with choices. */
  if (action === 'question.ask' && input.agent !== true) return false
  /* And only an agent says what it is doing. */
  if (action === 'agent.status' && input.agent !== true) return false
  /* Asked about a project the token was not made for, every answer is no:
     the database does not show it that project either. */
  if (input.tokenLimited && (input.outsideToken || NEVER_A_LIMITED_TOKEN.includes(action))) return false

  if (action === 'agent.use') return true
  /* Only where a plan is said at all: the community edition never says
     one, and has no domains to set. An agent is never an owner. */
  if (action === 'workspace.domain') return role === 'owner' && input.plan !== undefined && input.agent !== true
  if (action === 'agent.connect') return role === 'owner' || (role === 'member' && input.mayConnectAgents === true)
  /* Not the plan's: an agent on a workspace whose plan no longer has
     agents is still somebody's to disconnect. */
  if (action === 'agent.manage') return (role === 'owner' || role === 'member') && input.connectedIt === true
  if (action === 'agent.remove') return role === 'owner' || (role === 'member' && input.connectedIt === true)

  /* Not a role's to have: the owner of a workspace is not an operator of
     the product. */
  if (action === 'operator') return input.operator === true
  /* Nor is owning the server: whoever made its first account, or was named
     by an owner. */
  if (action === 'instance') return input.instanceOwner === true
  /* On a server of one's own with sign-up closed, a new workspace is the
     server's owners' to make: its maker may invite anybody, and every
     invitation is an account. Into the workspaces there are, invitations
     still work. */
  if (action === 'workspace.create' && input.signUpClosed === true && input.instanceOwner !== true) return false

  /*
   * What running a project lets somebody do in it.
   *
   * Asked before the fixed table, because the table has nothing to say about
   * these any more: they belong to the project rather than to the workspace,
   * and the owner is the only person who holds them without being given
   * them.
   */
  if (MANAGING.includes(action)) {
    return role === 'owner' || has(input, 'manage')
  }

  /*
   * A thing somebody was handed, on the project it was handed on.
   *
   * `manage` carries all four: whoever runs a project is not asked to give
   * themselves permission to make a task in it. Outside a project the answer
   * is no for everyone but the owner — `rights` is empty there, and that is
   * the honest reading of "what may you do here" when there is no here.
   */
  const needed = BY_RIGHT[action]
  if (needed) {
    if (role === 'owner') return true
    if (input.inProject === false) return false
    // The owner kept this person from opening channels anywhere; no
    // project's rights reopen that.
    if (action === 'channel.create' && input.mayCreateChannels === false) return false
    return has(input, needed) || has(input, 'manage')
  }

  /*
   * Leaving is anybody's who is on the project, and asks nothing about what
   * they were given there: a way out that depends on a right is a room
   * somebody can be locked in. The owner may too — they still run every
   * project, on its list or not, so nothing is left without somebody who
   * can put it back together.
   */
  if (action === 'project.leave') {
    return (role === 'owner' || role === 'member') && input.joined === true
  }

  /*
   * Leaving the workspace: a member, in person.
   * Not the owner, who hands it over first (`workspace.transfer`); not an
   * agent, whose place is its connector's; and never through a token of
   * any kind, the narrowest included, for the reason `project.leave` is
   * not: "leave the workspace" is a sentence anybody can write in a task.
   * Asked here rather than through `NEVER_VIA_MCP`, which lists what an
   * owner may do in person.
   */
  if (action === 'workspace.leave') {
    /* As everything else here, an unproved owner is read as a member;
       the endpoint and `leave_workspace` ask the role held, and refuse the
       owner whatever this says. */
    return role === 'member' && !input.viaMcp && input.agent !== true && input.tokenLimited !== true
  }

  if (action === 'channel.create.workspace') {
    return role === 'owner' || (role === 'member' && input.mayCreateChannels !== false)
  }

  /*
   * A room's incoming webhooks: whoever may rename the room and say who is
   * in it. In a project's channel, who
   * holds `channel.create` there or runs the project; in a channel outside
   * every project (`inProject: false`), any member the owner has not kept
   * from opening channels; the owner everywhere.
   */
  if (action === 'hook.manage') {
    if (role === 'owner') return true
    if (role !== 'member' || input.mayCreateChannels === false) return false
    if (input.inProject === false) return true
    return has(input, 'channel.create') || has(input, 'manage')
  }

  if (action === 'project.create') {
    if (role === 'owner') return true
    if (input.mayCreateProjects != null) return input.mayCreateProjects && role === 'member'
    return settings.who_creates_projects === 'members' && role === 'member'
  }

  /* Who a document is for: its author as they may edit their own, anybody
     else as they may edit somebody else's. */
  if (action === 'file.share') {
    return can(input.isAuthor ? 'content.edit.own' : 'content.edit.any', input)
  }

  /* An announcement's draft: its author's, as posting is. */
  if (action === 'post.publish') {
    return input.isAuthor === true && can('content.create', input)
  }

  /* The project's instructions for agents: changing the document, and
     running the project. */
  if (action === 'file.for_agents') {
    return can('project.tools', input) && can(input.isAuthor ? 'content.edit.own' : 'content.edit.any', input)
  }

  if (action === 'content.edit.any' || action === 'content.edit.said') {
    if (role === 'owner' || has(input, 'edit.any') || has(input, 'manage')) return true
    /*
     * An agent's words are its connector's to change, as their own are —
     * on the project, in person: never through a token and never by an
     * agent, nor by GitHub or an import acting as somebody (`viaTool`),
     * since "rewrite what your agent said" is a sentence anybody can write
     * in a task. Said only by an announcement's endpoints, which pass
     * `connectedIt` when its author is a live agent the asker connected;
     * a comment's and a message's do not.
     */
    if (action === 'content.edit.said') {
      return (
        input.connectedIt === true &&
        input.agent !== true &&
        input.viaMcp !== true &&
        input.viaTool !== true &&
        can('content.edit.own', { ...input, isAuthor: true })
      )
    }
    // The switch is about documents. Somebody else's words are theirs
    // whatever it says.
    return role === 'member' && settings.edit_others_content === 'documents_too'
  }

  /*
   * Inviting somebody from outside is `people.invite` plus the switch.
   *
   * It matters more now than it did: with no admin role, everything else on
   * this list is the owner's alone, and a single owner who is away is a
   * workspace nobody can be added to. This is the switch that makes that
   * survivable, and it was already here — "who may bring an outsider in" is
   * the question an agency and a hundred-person company answer differently.
   */
  if (action === 'people.invite') {
    if (role === 'owner') return true
    // The owner's word about this person wins over the switch either way —
    // `docs/specs/member-rights.md`.
    if (input.mayInvitePeople != null) return input.mayInvitePeople && role === 'member'
    return role === 'member' && settings.who_invites_people === 'members'
  }

  /*
   * The Members screen, behind the fourth switch and the owner's word about
   * one person. Who is in the workspace is `people.read` and is not asked
   * here: closing the screen does not take anybody out of a picker.
   */
  /* An agent's week: the Members screen's, or its connector's — the rows
     are bounded by what the reader sees whatever this says. */
  if (action === 'agent.work.read') {
    if (role !== 'owner' && role !== 'member') return false
    return input.connectedIt === true || can('members.read', input)
  }
  if (action === 'members.read') {
    if (role === 'owner') return true
    if (input.maySeeMembers != null) return input.maySeeMembers && role === 'member'
    return role === 'member' && settings.who_sees_members === 'members'
  }

  const grant = FIXED[action]
  if (!grant) return false
  if (!grant.includes(role)) return false

  // Anything about a project requires being on it. An owner administers the
  // workspace and is not required to join every project to run it.
  if (input.inProject === false && role !== 'owner') {
    const projectScoped: Action[] = [
      'project.member.add',
      'content.create',
      'content.edit.own',
      'time.own',
      'question.ask',
      'question.answer',
    ]
    if (projectScoped.includes(action)) return false
  }

  return true
}
