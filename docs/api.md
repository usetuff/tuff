# API

The contract. Copied into client repositories — one document for everyone,
because copies drifting apart means clients drifting apart.

REST is the only way in. Web, MCP and native clients use these endpoints and
no others: a second path is a second permission model, and the second one is
always the one with the hole in it.

## Version

`x-api-version` on every request. A client ahead of the server is refused with
`api_too_new` rather than allowed to write against a contract that has moved.

## Who decides

One function, `can(action, { role, settings, inProject, rights, isAuthor,
viaMcp })`. Role, project membership, the workspace switches and the list of
permissions held on that project meet there and nowhere else.

### Two roles, and a list of permissions on a project

Owner and member. There is no third kind of person. Whether somebody may do
a thing in a project is a named permission on their membership of it, set by
whoever runs that project.

| Right | What it allows |
| --- | --- |
| `task.create` | make tasks and lists here |
| `task.delete` | delete a task, not only their own — and somebody else's document, upload or link in Docs (`file.delete`) |
| `channel.create` | make a channel in this project's chat |
| `channel.delete` | delete a channel |
| `edit.any` | change what somebody else wrote here |
| `manage` | run it: archive and delete the project, switch its tools, log hours for other people, and set everybody else's permissions |

`manage` carries the other five: whoever runs a project is not asked to give
themselves permission to make a task in it.

Being added to a project grants `task.create` and `channel.create`. Reading
is not on the list: being on a project is how you read it, and there is no
narrower way to be on one. Writing your own and editing your own need no
permission either — they are what being on a project is. Deleting your own
task needs none; deleting somebody else's is `task.delete`, the same shape
as `content.edit.own` and `content.edit.any`.

Each of the four `task.*`/`channel.*` rights is also an action by the same
name, so an endpoint asks `can('task.create', …)` and gets the one answer.
`file.delete` is one more action granted by `task.delete` (and `manage`, and
the owner): deleting somebody else's row in Docs. Your own needs none.
`file.share` is who a written document is for — publishing a draft and
choosing its people: its author, and whoever may edit somebody else's
document (`content.edit.any`); never an agent, never through a token.
`list.agent` is naming the agent that takes a list's new tasks: whoever
holds `task.create` there, in person — never an agent, never through a
token.
`file.for_agents` is marking one written document as the project's
instructions for agents, or taking the mark off: whoever may change the
document (`content.edit.own` / `content.edit.any`) and runs the project
(`project.tools` — the owner, or `manage`), in person — never an agent,
never through a token.
`content.create` still covers posts and documents.

Three attempts came before this — a client role, then a guest flag, then an
admin role — and the access spec has why each was taken back. The
short of it: all three were categories of person, and what anybody actually
wants to say is "this one may delete tasks here".

Partial visibility went with them. `visible_to_client` marked an object as
open to somebody who saw only open ones, and there is no such somebody now.
The column is gone from every table that carried it, and with it the arm of
every read policy that consulted it.

What has no project to be granted in belongs to the owner: inviting and
removing people, changing roles, the security log, revoking somebody else's
token, billing and transfer. Inviting has a workspace switch, which is what
keeps a single owner from being the only way to add a person.

`GET /api/me` returns the list of actions available to the caller so the
interface can hide buttons. That is a convenience. Every endpoint asks again,
and the endpoint's answer is the one that counts.

### Hard stops

Some actions are refused through a token whatever the person behind it may
do: billing, transferring ownership, inviting or re-roling people, and
revoking somebody else's credential, deleting a task, a channel, an
announcement, a message or a comment, rewriting an announcement or a comment
somebody else wrote (emptying one is deleting it), and taking anybody off a
project — yourself included.

A confirmation dialog is not a substitute. It relies on somebody reading it,
and people click OK without reading. Deletion is on the list because project
content is data, not instructions: a task whose description asks for the
channel to be cleared is exactly the shape that arrives. Making things
through a tool is useful and reversible; removing them is neither.

## Shape

**What an endpoint answers with is not what a table holds**, and both are in
the contract. `shared-schema/src/entities.ts` describes the objects;
`responses.ts` describes the shapes they arrive in, and both are generated
into `Protocol.swift` and `Protocol.kt`.

The difference is not cosmetic. A row carries `icon_key` and a response
carries `icon_url`, a signed link good for an hour, because there are no
public URLs and a client must never see a key. A person arrives as a
membership, so `actor_id` rather than `id`, with the role and the presence
joined on. A project arrives with `can`, the actions this reader may take in
it. A client decoding `/api/people` against `Actor` would look for a field
that is not there and miss three that are.

Errors are `{ "error": { "code": "...", "message": "..." } }`.

| Code | When |
| --- | --- |
| `unauthorized` | no token, or it expired |
| `removed` | `/auth/refresh` only, `401`: the person is no longer in the workspace the session was in; `error.workspace` is `RemovedFrom`, `{ id, name }` |
| `forbidden` | authenticated, not allowed |
| `not_found` | absent **or** not yours — see below |
| `invalid` | the body failed the schema |
| `conflict` | a unique constraint, told without saying which |
| `api_too_new` | the client is ahead of the server |
| `busy` | `503`, with `Retry-After` in seconds: too much is waiting to be read already — a CSV import's rows, a scratch board's text, an import's page; nothing was read or written; try again after it. An MCP tool that writes a body gets the same as its error. The parsing off thread spec |
| `too_complex` | `422`: Markdown sent to be read — a CSV import's rows, a scratch board's task, description or comment — that a worker could not read in half a second, or in its memory; nothing is written. Background work (GitHub sync, the Linear, Jira and Asana imports) keeps such a text as plain paragraphs instead. The parsing off thread spec |

**A comment can answer another.** `POST …/comments` takes an optional
`parent_id`: the comment it answers, which must be on the same object.
Threads are one level deep — answering a reply answers the comment that reply
answers. Comments come back with `parent_id`, null for one that starts a
thread. `docs/specs/comments.md`.

**A comment can be on words in a document** (migration 231). A comment
on a file starting a thread may carry `quote` — the words it was made on,
as they were — with `resolved_at`, `resolved_by` and `resolved_by_name`,
null until somebody settles it. `GET /api/files/:id` adds
`on_deleted_text` to such a comment: true when no mark in the body names it
any more. The body names it with a mark,
`{ type: "comment", attrs: { ids: "<thread id> <thread id>" } }`, on the
words; a reader that does not know the mark keeps it as it found it, and a
body sent back without it has it put back on the words that still say it —
nothing the caller sent is changed. Marking words moves neither the
document's `version`, its `rev` nor its `updated_at` (migration 234), and is
the comment right's to do, not the edit right's, and only a
written document's thread may be anchored, which the database checks too.
A public document's body comes without the marks, and the tasks and
documents it names as their titles in words.

**A task named in a body is read as its title** (migration 232). A
`taskref` node — `{ id, projectId, number, key, title }`, written by `#`
and by Make a task in a document — is no text of its own; search's
`words_of` reads its `title` as words, and a public document's body has it
as its title in plain text. One made from a line that carried more than
words also has `line`: that line's inline content (text with `bold`,
`italic`, `underline`, `strike`, `code`, `link` and `comment` marks, and
`mention` nodes), drawn in the chip while the task's title is still the
line's. The server keeps only those, a link only with an `http`, `https`
or `mailto` address, and at most 200 pieces and 2 000 characters of words,
on every body it is sent and in the shared state of a document, so a body
read back holds no other; a client that does not draw it ignores it. A body's `taskref` and `docref` nodes link the
thing the body is on to the task or document they name, both ways, as an
address in its words does (`object_link`).

**A comment can be changed and taken back.** `PATCH /api/comments/:id`
replaces its body and `DELETE` removes it, softly, like everything else. The
id is its own — what a comment is *on* is a pair of columns and not part of
the address — so both live at one path rather than three times over on posts,
tasks and files. A comment carries `edited_at`, which is null until somebody
has actually changed it: a sentence that can be rewritten with nothing to
show for it is a thread nobody can rely on, and asking the screen to compare
two timestamps and decide what counts as a change is asking three clients to
agree about it.

Both are behind **`content.edit.said`**, which is `content.edit.any` without
the workspace switch. The permission matrix says "only your own, and others' documents behind
the switch": the switch lets a member edit another person's *document*,
and that is all it was ever about. A comment is not a document — it is speech
with a name on it, and rewriting it leaves that name underneath. So: your own
always, and otherwise the owner and whoever runs the project. Deleting is not
given a stronger right than editing, because anybody who can rewrite a
sentence into nothing has already deleted it.

**404, not 403, for another workspace's object.** That an object exists is
information. Row-level security makes the row invisible, so this is what the
query returns anyway rather than something handlers must remember.

Lists page by cursor. Offset by page number is absent from the first endpoint
rather than from the first performance problem: it skips rows when the page
before it changes, and that is a correctness bug people read as a caching one.

A cursor is opaque. One that carries a time carries it to the microsecond,
with the id after it, so rows written in one moment are neither skipped nor
repeated across a page; one that is not a cursor this server wrote is
`400 invalid`.

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, workspace_name?, workspace_slug? }` — **no password** (the password after proof spec): one sent by an older app is dropped unread, never a `400`. Creates the person, the workspace and the owner membership in one statement, the address **not confirmed** and **no password stored** — `register_owner` stores none for any account asked for unconfirmed (migration 212). Answers `202 { pending: true, email, approve: false }` (`Pending`; `email` and `approve` only so that app builds whose generated type read this answer as `{ email, approve }` decode it) and no session, and sets `tuff_bind` (`Path=/auth`, a day) whether the address is new or not — a letter goes to the address: "Confirm your email and choose a password", a `/reset/chs_…` link, a day, once. An address that already has an account gets the same `202` and cookie, and a mail of its own instead (`sendAlreadyHere`: a confirmed account is told to sign in; an unconfirmed one gets the same choose-a-password letter, three an hour). Signing up again is how the waiting screen sends another. Twenty a quarter of an hour from one IP. `workspace_name` left out is "First’s workspace", from the name, as a provider sign-up names it; `workspace_slug` left out, or taken, the next free one is made from it (`free_workspace_slug`) — a taken one answers `202` like everything else, so it says nothing about whether the email has an account. On a server of one's own with sign-up closed, **`403 sign_up_closed`** for every address, asked before whether it has an account; on one nobody owns yet with `OWNER_EMAIL` set, the same for every address but that one. The sign up spec |
| POST | `/auth/verify` | `{ token }` from a confirmation link mailed before the password came after the proof → confirms the address, and **never answers a session**. Confirming clears any password set before the proof (`app_user_proved`, migration 212), so the answer is `{ confirmed: true, choose_password }` — `choose_password` a `chs_` reset token of a day for `POST /auth/password/reset`; `{ confirmed: true }` alone only for an account confirmed before by another way with a password chosen since; `410` used or past its day; `403 sign_up_closed` for an applicant on a closed server of one's own. The links of a change of address come here too, and opening one changes nothing (migration 316): the old address's yes (`apv_`) only with `{ token, pressed: true }`, the press on its page — `{ approved: true, email }`, a link gone to the new one; `403 press_required` without `pressed`. The new address's link (`eml_`) is confirmed here only for an account whose address nobody proved (`needs_session: false` from `peek`; an address proved only by hand signs in anywhere and is asked for its session like any other): `{ token, pressed: true }` with no session → `{ changed: true, email }`, `409` taken, `410` gone — and whoever held the account is put out (password, second factor, sessions, tokens, push devices, provider sign-ins, linked GitHub, open tickets, and what it left running — `put_out`, below; every workspace shared with somebody else waits for a Join, `before_proof_held`; a refresh in flight leaves no session behind, migration 317), and the new address is sent the letter that chooses a password; `403 press_required` without `pressed`. For any other account `403 confirm_from_account` — that is `POST /api/me/email/confirm`. Apps from before, which post the link as it opens, get these `403`s and nothing changes |
| POST | `/auth/verify/peek` | `{ token }` of a change of address's link → what it is about, reading and changing nothing: `{ kind: 'approve' \| 'email', email, account: { id, name, email }, needs_session }` (`AddressLink`, with `AddressLinkKind` and `AddressLinkAccount`) — the address it moves to, the account it moves (`email` masked, `a…@example.com`), and whether confirming takes a session of that account (false for an approval, and for an account nobody proved); `410` used, called off or past its day, or not such a link. The page the link opens says it before anybody presses |
| GET | `/auth/providers` | which ways in this deployment has keys for, and whether anybody may sign up: `{ google, apple, github, oidc, oidc_name, mail, no_mail, sign_up }` (`Providers`); `oidc` is a server's own OpenID Connect provider, on only with `OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` all set, and `oidc_name` what its button calls it (`OIDC_NAME`, plain text, at most 40 characters, else `"SSO"`), null when `oidc` is false — and the page then also carries `<meta name="tuff-oidc-name" content="…">`, so the button draws with the page; the service sets none; `no_mail` is true only on a server of one's own with no mail set up, where the screens say so instead of promising a letter, and always false on the service; `sign_up` is false only on a server of one's own with sign-up closed, where every page the server sends also carries `<meta name="tuff-sign-up" content="closed">`; on a server of one's own nobody owns yet, `google`, `apple`, `github` and `oidc` are all false and the page's `tuff-providers` meta is empty |
| GET | `/auth/oauth/:provider/start` | `google`, `apple`, `github` or `oidc`: off to the provider, with state and nonce bound to a ten-minute cookie, `__Host-tuff_oauth` (PKCE for Google, GitHub and `oidc`). For `oidc` the provider's discovery document is read first (`OIDC_ISSUER/.well-known/openid-configuration`, kept an hour; its `issuer` must equal `OIDC_ISSUER`, one trailing slash aside, and it and every endpoint it names must be https unless this server is itself on `http://localhost`; no redirect followed, ten seconds, a quarter of a megabyte): one that cannot be read sends the browser back where it pressed, with `oauth=unreachable` (`/signin`, `/invite/:token`) or `ways=unreachable` (`/:ws/account`), and spends nothing; else on to its `authorization_endpoint` with `scope=openid email profile`. An app sends `app_challenge`, the base64url SHA-256 of a secret of its own, and its ticket is good only with that secret — counted only from a start with `Sec-Fetch-Site: none`, ignored from a page, and a malformed one is `/signin?oauth=failed`. A challenge starts one sign-in: a second sheet start with it is `/signin?oauth=failed` (kept an hour, `auth_app_start`, migration 185, cleared by the worker); 120 such starts per address in ten minutes — an IPv6 address counted by its /64, and only starts that reach the challenge's row — then `/signin?oauth=failed`. A start with no challenge is the browser's, whatever `Sec-Fetch-Site` says, and the exchange refuses a ticket bound to nothing. `/auth/*` and `/signin` go out with `Referrer-Policy: no-referrer` |
| GET POST | `/auth/oauth/google/callback`, `/auth/oauth/apple/callback`, `/auth/oauth/github/callback`, `/auth/oauth/oidc/callback` | the provider's answer; redirects to `/signin?handoff=…`, and for a browser sets `__Host-tuff_handoff` (HttpOnly, two minutes), the cookie its ticket is good with (migration 167) — with `&invite=…` when an invitation waits for a second factor — or `/signin?oauth=conflict\|github\|noemail\|noaddress\|unreachable\|expired\|failed\|closed`. **`oidc`** (migration 321): the code is traded at the document's `token_endpoint` with the PKCE verifier, the client authenticated by `client_secret_basic` when the document lists it or lists nothing, else `client_secret_post`; the ID token is checked against the document's `jwks_uri` — its `iss` the document's `issuer`, its `aud` the client id (and `azp` the client id when it has several or says one), the nonce, `exp`, `iat`, and an asymmetric signature only (RS, PS, ES, EdDSA; `HS256` and `none` refused). It is `auth_identity` provider `oidc`, subject `<issuer> <sub>`. An existing account is taken by its address only on `email_verified: true` (or `"true"`); otherwise an address with an account is `conflict`, and a new account it makes holds its address weakly — `email_by_hand`, as a handed invitation's does (`auth_email_weak`, migration 321): a provider owning the address later, a mailed reset or change of address takes it from whoever made it, `POST /api/instance/owners` answers `409 unconfirmed` for it, and the same provider signing in with `email_verified: true` for the account's own address later is that proof (`auth_claim_email`). Any provider that signs in to an existing account found by its address (not by its own subject) mails that address, as adding a way in from Account does ("… can now sign in to your Tuff account"). No address in the token is `noaddress`, and nothing is made; `unreachable` that the provider did not answer. A new account follows the rules every provider does on a server of one's own: never the first, and after it only by an invitation or with sign-up open. `closed`: the provider's account is new here and this is a server of one's own with sign-up closed — no account is made; somebody with an account signs in as before, and an invitation (`?invite=`) still makes one. GitHub never links an account by its address, nor by GitHub connected in Account settings: only an account it made or signed in before (`auth_identity` provider `github`, the GitHub account's numeric id; migration 166). `github` says an address already has an account here; `noemail` that the GitHub account has no verified primary address |
| POST | `/auth/oauth/exchange` | `{ handoff, totp?, invite?, verifier? }` → a session, only where the sign-in began: with the `__Host-tuff_handoff` cookie, or `verifier`, the secret an app sent the SHA-256 of; anywhere else `401 unauthorized`, checked before the second factor and spending nothing. A start without a challenge is the browser's whatever `Sec-Fetch-Site` says, so its ticket needs the cookie; no ticket is made bound to nothing, and one from before is refused to everybody (spent when a browser brings it). An app's ticket is traded only by a client that sends neither `Origin` nor `Sec-Fetch-Site`; a browser bringing one gets `401` and the ticket is spent; `401 totp_required` keeps the ticket good for its two minutes; an `invite` is accepted and ignored: an invitation is never taken here |
| POST | `/auth/password/forgot` | `{ email }`; always `200`; at most five links an hour per account |
| POST | `/auth/password/reset` | `{ token, password }` (twelve or more); `410` once used or past its hour (a day for a `chs_` sign-up token); ends every session at once, and confirms the address — the link came to it. When the account had a password, tokens for tools are revoked too. A second factor turned on in the last seven days goes with its recovery codes; an older one stays (migration 242). Every Google and Apple sign-in is unlinked (migration 151). `password_reset` in the security log and a note to the address. **The first password of an address nobody had proved** (the sign-up letter): `{ ok: true }` plus a session in the account's first workspace (`PasswordSet`, `email_link` in the audit log) when the request carries the `tuff_bind` cookie the sign-up set for that account, `{ ok: true }` alone anywhere else; no note to the address. With that cookie and no workspace to land in because every one waits for the person's word (joined before the proof, migration 315), a `NowhereSession` instead, so the question is the next screen |
| — | every way in | sends `x-device`, the browser's own id for itself (8–64 letters, digits and hyphens), written on the session it makes |
| POST | `/auth/login` | answers `totp_required` when a second factor is set, after the password check so a wrong password reveals nothing; `403 email_unverified` for the right password on an address not confirmed (an account from before the password came after the proof, or one a link with no address made), and the choose-a-password letter goes to it (five an hour) — confirming takes the old password (migration 212); an account in no workspace is answered a `NowhereSession` when the body says `nowhere: true`, else `403 no_workspace` |
| POST | `/auth/refresh` | rotates: the old token is spent in the statement that reads it, and comes back in the workspace the session was in, with the device asking written on it. `401 removed` with `error.workspace` `{ id, name }` when the person was removed from that workspace — never a session in another one — so the device clears what it kept of it and says so (`docs/specs/removing-someone.md`); `401 unauthorized` for anything else. **Asked again with a token spent in the last ten seconds**, by the same `x-device` it was spent with (none for none), it answers the session the token was spent for — the same `refresh_token`, a fresh `access_token` for the same session — while that session is live (not spent again, not ended, not run out); so a lost answer is given again and two tabs racing end on one session. After the window, or from another device, or after a sign-out, `401 unauthorized` as before; a late reuse ends nothing else |
| POST | `/auth/logout` | ends every session of the browser the refresh token belongs to, and of the line it is in (the sign-in and the refreshes traded from it), waiting first for a refresh of the same token in flight so the session it writes ends too (migration 314); their access tokens answer `401` from the next request, not when they run out |
| — | every signed-in request | `401` when the session the access token came from was ended — signed out, ended from Account, a password reset or changed — even inside its fifteen minutes |
| GET | `/auth/invite/:token` | `InvitePreview` — what the link says before anyone types a password: `state`, `workspace_name`, `role`, `email`, and `brand`, the workspace's where it wears one (`invite_brand`); `host` for one mailed to a workspace's own domain and read anywhere else — it is taken there (below) |
| GET | `/.well-known/assetlinks.json` | Digital Asset Links: which addresses the Android app opens and that the site's passwords are its (`handle_all_urls`, `get_login_creds`), with Apple's exclusions as `dynamic_app_link_components`; `[]` until `ANDROID_CERT_SHA256` names a certificate |
| GET | `/.well-known/apple-app-site-association` | JSON: which addresses the Apple apps open (`applinks`) and that the site's passwords are theirs (`webcredentials`) — every screen's, not the site's own pages, the API or a file; `APPLE_APP_ID` |
| GET | `/auth/oauth/:provider/start?invite=` | the invitation carried to Google, Apple or GitHub and back: somebody new is made by the invitation with no workspace of their own; somebody known is signed in where signing in lands and **not joined** — the callback goes to `/signin?handoff=…&invite=…` and the page opens `/invite/:token` once signed in, where Join is pressed (a GET anybody can link to joined existing accounts into the link's workspace, and a workspace waiting for its person's Join without it); trouble comes back to `/invite/:token?oauth=` — `?oauth=elsewhere` for a link handed over by hand, followed with a provider's account at another address; it is left unspent (migration 210) |
| POST | `/auth/invite/:token/accept` | single use settled in one conditional update, so two people racing produce one membership; a new account is confirmed when the server mailed the invitation to its address — `invite.mailed_to`, written only by the sign-in role's `auth_invite_delivered` once the letter has gone, and read by `accept_invite` as the account is written (migration 313); an address on an invitation nobody delivered is only what its writer typed, since the application role inserts invitations — and otherwise is let in with the choose-a-password letter sent — signing in by password waits for it, and confirming clears the password typed here (migration 212), so a password typed for somebody else's address never outlives its owner's proof. A new account is asked for with `accept_invite(…, p_must_be_new => true)` (migration 212): when a sign-up made the address's account between the route's look and the statement, the invitation is given back unspent and the answer is `401 unauthorized` ("use its password"), never a session. A link handed over by hand (`by_hand`) is for its own address only: another is `403 wrong_email`, and the link is left unspent (`accept_invite`, migration 210). `by_hand` too is written only by `auth_invite_delivered`, where the route hands the link over (migration 313). The account it makes is confirmed weakly (`app_user.email_by_hand`): password sign-in works, but a provider vouching for the address later takes the account as an unconfirmed one — password, second factor, sessions, tokens, every provider sign-in linked before and every open ticket gone (`auth_claim_email`, migration 211) — a reset (which takes the same provider sign-ins and tickets, migration 211) or change of address by mailed link clears the mark, and `POST /api/instance/owners` answers `409 unconfirmed` for it |

### Sessions, and the clear-out

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/sessions` | where this account is signed in — one line a browser (`x-device`), each `{ id, user_agent, ip, created_at, last_used_at, expires_at, sessions, current }`: the newest of its sessions, how many it holds, and whether it is the browser asking |
| DELETE | `/api/sessions/:id` | end that browser's sessions, scoped to the caller |
| DELETE | `/api/sessions` | end every other session, the one asking and its own line kept — the refreshes it traded into (`refresh_session.family`, set by the server and carried only by a refresh, migration 242); sessions it entered or made other workspaces with, or took an invitation with, are lines of their own and end too, never a session that only says the same `x-device`; `{ ok, ended }` |

A session row is a credential, so the application role cannot select it: both
session calls go through definer functions scoped to the person asking, and
ending somebody else's is not something the endpoint can be talked into. Nor
can it update one (migration 228): rotating, ending and naming a device are
all definer functions'; the application only inserts a session when somebody
signs in.

**A session knows which workspace it is in**, because `refresh_session`
carries `workspace_id`. It did not, so `refresh` picked one by hand — the
caller's oldest membership — which is right for an account in one workspace
and wrong for everybody else: working in the second, the access token
expires, the client refreshes, and the session comes back in the first. Row
level security then does exactly what it should and the screen is the lie:
every read answers 200 with nothing in it, no error anywhere, and a project
with five tasks in it says "Nothing here yet."

The stored workspace is still checked against the memberships rather than
trusted — a session older than somebody's removal from a workspace must not
hand it back to them — and rows written before the column existed fall back
to the oldest membership, which is what the old code did.

**Removed from it, a refresh says so** (migration 179). The token a removal
ended — the one live when it happened, not an older copy spent before it —
and a session from before removal ended sessions both answer `401 removed`
with the workspace's id and name, through `auth_removed_by(hash)` and
`auth_removed_from(actor, workspace)`, definer functions that name a
workspace only to somebody who was in it and is not now. A session of a
removed person used to be carried into their oldest other workspace instead,
under the old one's address. A workspace deleted, or somebody invited back,
is not `removed`.

**Revoking one goes through `auth_spend_refresh`**, a single
`update … returning` on the hash, after a share lock on the account's
`app_user` row (migration 317: a refresh and a put-out of the same account,
below, are taken one after the other). Not a lookup followed by an update: that is
what both `refresh` and `logout` used to do, and it silently matched nothing
— the SELECT policy `actor_id = current_actor()` applies to an UPDATE that
carries a `where`, and neither of those calls has an actor. Signing out left
the token working, and rotation rotated nothing. One statement also decides
the race: two requests arriving with the same token get one row between
them.

**And the session that replaces it is written in the same transaction**
(migrations 312 and 314), with `traded_from` naming
the spent one, so the second of two requests with one token waits on the
first and then finds what it wrote. `auth_refresh_again(hash, device,
within)`, the sign-in role's alone, answers that successor for a token
spent within `within` — never more than ten seconds, whatever the caller
says — when it is live, the same person's, in the same workspace, and the
spent session and its successor both carry the device asking. The
successor's refresh token is made, not drawn: an HMAC of the spent token
and the successor's id under a key derived from `JWT_SECRET`
(`refresh-successor`), so it can be made again for the same request
without the token being kept anywhere; one written before 312 does not
match what is made and is not handed back.

**An account's previous holder, put out** (migration 317).
Every path that confirms an address for somebody other than whoever held
the account — `app_user_proved`, `auth_claim_email`, `auth_set_password`
for an unproved or by-hand address, `instance_name_owner` for one, and
through the trigger `auth_email_confirm` — calls `put_out(actor, row)`,
nobody's to run. It takes the account's hold first, exclusively — a transaction-level advisory lock on the person (`account_hold`, two keys, 31800 first), waiting at most three seconds — and every path takes it before writing the account's row, an old confirmation link (`auth_confirm_email`) included;
the password goes (each path's own), and the recovery codes, sessions,
tokens, push devices, provider identities, a linked GitHub, open tickets
and unexchanged OAuth codes; the second factor with its times; every
webhook the account made is turned off and marked (`enabled = false`,
`webhook.stopped_at`, its receiver's key taken off — an agent's also its
secret); its room hooks are stopped (`room_hook.stopped_at`); the agents
it connected are stopped (`agent.stopped_at`, every token of theirs
revoked); its repository links stop (`stopped_why: linker_unproved`);
documents it wrote and shared to the web in a workspace now waiting are
unshared; and `before_proof_held`. Last it sets `app_user.sessions_after`
to the clock.

**Every transaction made inside a signed-in request** — `withActor`,
`asAuth`, `asAuthActor`, `asAuthEverywhere`, `withoutActor`, as whomever —
first runs `auth_still_in(actor, session, token)` (the application's) with
the request's own person and credential: the hold, shared — an agent's
token, its connector's — and `28000`, answered `401 unauthorized`, when the
session or token the request came with was begun at or before
`sessions_after`. What is written with no such request goes through the
trigger `credential_after_put_out`, before every insert into
`refresh_session`, `api_token`, `auth_ticket` and `oauth_code`: the hold,
shared, and the row written ended, revoked or spent when `sessions_after`
is at or after its `created_at`. A session or token the server makes from
a check made earlier (a password read, an OAuth code or refresh token
taken, an access token checked) is written with `created_at` no later than
that check. A password is read under the hold (`auth_hold_account`), a
provider's callback asks `auth_not_put_out_since(actor, moment)` before its
handoff ticket, `auth_change_password(actor, hash, keep, was)` changes the
password only over the hash checked (`-1` otherwise, `403 wrong_password`),
and `auth_totp_enable(actor, secret)` turns on only the secret checked.
`account_deletion` takes the hold first too.
Nothing deleted, nothing backfilled.

**Spent sessions are swept** by the worker's `refresh_session_sweep(limit)`
(the worker's role's alone, at most five thousand rows a call): a row a
week after it was spent, or a week after it ran out — one ended while
live waits for its end, for `auth_removed_by` — and never a device's
newest row, which `auth_device_known` asks for. The week and the cap are
the function's, not the caller's.

Soft delete with a window **and then a real one**. Only the first half
existed, so "deleted" meant "kept forever and hidden", which is the answer no
privacy request accepts.

Two more, for the throwaway data the harness makes: `purge_workspace(id)`
removes one workspace outright and `purge_orphan_actors()` removes the
accounts left with no membership. `pnpm seed` calls both before it seeds, so
the database does not grow by a workspace on every check — it had reached
forty-three, and the server tests had gone from seconds to minutes. Tables
are found by their columns rather than listed: an order written by hand goes
stale the first time a table is added, and it goes stale silently.

### Ceilings

Every signed-in request is counted, after authentication, because who is
asking is what the ceiling is per: **300 a minute for a token, 1200 for a
person, and for a workspace sixty a minute for each person in it, never
under 6000** (`rate_allowance`, asked once a minute per workspace). A person
clicks; an agent loops, and the looping one is both what takes a workspace
down and what nobody is watching. Six thousand flat was six a person in a
company of a thousand, used up by three hundred of them at work at once.

A token spends its person's twelve hundred as well as its own three hundred,
so a person is twelve hundred a minute however many tokens they hold; an
agent's token spends the twelve hundred of whoever connected it. A spent
minute never refuses the presses that stop somebody — `POST
/api/tokens/:id/revoke`, `DELETE /api/people/:id`, `DELETE /api/agents/:id`,
`DELETE /api/agents/:id/connections/:grant` — nor the lists they are on,
`GET /api/agents`, `GET /api/tokens`, `GET /api/people`, from a person's own session,
never through a token, on an allowance of their own of sixty a minute.

A statement made for a request runs fifteen seconds at most
(`statement_timeout`, set beside who is asking in every transaction): a
request answers in milliseconds or something is wrong, and a query left to
run held its connection while the rest of the pool queued behind it.
Over the line is `429` with `retry-after`, because saying how long to wait is
the difference between a client that backs off and one that hammers harder.

The counters live in Postgres, on an unlogged table, one statement per check.
They were in the API process first, which was honest while there was one
process and stopped being honest the moment the worker joined it: two
processes with private counters let through twice the traffic while both go
on reporting the number written on them. A restart loses the counters and
gives everybody a fresh minute, which is a better trade than writing WAL for
every request.

**A guess at a password or a code is counted before it is checked**, and
given back when it was right (`rate_take`, `rate_give_back`, migration
169): signing in, the second factor at a provider's exchange, joining by
invitation with an existing account, and every signed-in re-ask — the
password, the address, turning the second factor off, handing a
workspace over, deleting the account, ways to sign in. Counted only when
wrong, after the check, a burst sent at once was checked whole before any
of it counted. A refused guess is given back too, since nothing was
checked.

If the limiter cannot reach the database it lets the request through. The
ceiling is there for load; the database being unreachable is a larger problem
and this is not the place to report it.

A signed-in person's allowance is spent in the same moment as they are
looked up, beside it rather than after it, and the lookup is one statement
(`auth_context`) rather than a transaction. Nothing
about who may do what changed; what changed is that it costs one round trip
to the database instead of ten.

### Timing

Every `/api/*` answer carries `Server-Timing: app;dur=<ms>`, the time the
server spent on it, so a client can tell the wait on the server from the
wait on the wire. `GET /health?db=1` adds `db_ms`, the best of three round
trips from the server to its database.

`GET /health` needs no session and answers `{ ok, api_version, version,
commit, storage, links }`. `version` is the release, semver without a `v`
(`"1.0.0"`; `"0.0.0"` before the first one), from `server/src/version.ts`;
`commit` is the build's seven-character commit, or `"unknown"`.
`api_version` is the contract's number, which moves far less often than
the release does.

### The second factor

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/2fa` | whether it is on, how many recovery codes are left, and `proof` — what turning it on or off asks beside the factor's code: `password`, or `email` for an account with no password |
| POST | `/api/2fa/begin` | a session of the person's own only (`403` through any token); `{ password }`, or `{ code }` from `/api/me/inbox-code` `{ for: 'twofa' }` where `proof` is `email` → a secret, stored but **not** turned on, for a quarter of an hour. `403 password_required \| code_required` without it (to a request with no `Origin` — an app from before this — the message says to set it up in a browser or update the app), `403 wrong_password \| wrong_code`, counted as every door that asks the password again (ten a quarter of an hour, then `429`); `403 email_unverified` for an address nobody has proved; `409` while a factor is on, also when it went on between the look and the write (`auth_totp_begin` answers whether it wrote, migration 243) |
| POST | `/api/2fa/enable` | a session only; `{ code }` → the recovery codes, once, on the turn from off to on; `400 wrong_code`, counted as above; `400 expired` for a secret begun more than fifteen minutes ago, or before migration 243 (`totp_begun_at`) — begin again; `409` while a factor is on, and no new codes. The address is told, with the way back: a reset by mail within seven days takes a factor that new off (`app_user.totp_enabled_at`, `auth_set_password`, migration 242) |
| POST | `/api/2fa/disable` | a session only; `{ password, code }` — `code` a passcode or a recovery code; for an account with no password (`proof: email`), `{ email_code, code }` with `email_code` from `/api/me/inbox-code` `{ for: 'twofa-off' }`. `403 totp_required` without `code`, `403 wrong_password \| wrong_email_code \| wrong_code`, counted as every door that asks the password again (ten a quarter of an hour, then `429`) |

Enrolling is three steps because the middle one is the point: the secret is
stored, then proved, and only then turned on. Nobody is left with the factor
enabled and a secret they never managed to scan — an account its owner cannot
reach is worse than one without a second factor.

Sign-in takes the passcode **or a recovery code** in the same `totp` field.
Both are checked against what is stored; a recovery code is spent by the
update that finds it unused, so two sessions cannot race the same one.

**A passcode is taken once** (RFC 6238 §5.2). The time step it
matched is kept as `app_user.totp_last_step` (`bigint`, selected by no
role), written by `auth_totp_spend(actor, step)` only when the step is
past the one kept and within one of now by the database's clock (migration
299); a code at or below it is refused as a wrong one, at
every door that takes a passcode — `/auth/login`, a provider's sign-in,
`/api/2fa/disable` and every re-ask before a change to the account — and
the code that turned the factor on is spent by `/api/2fa/enable`. So a
client that signs in again within the same thirty seconds needs the next
code. Migration 293.

The secret is encrypted rather than hashed, because a code has to be checked
against it. The key comes from the environment — `ENCRYPTION_KEY` when it
is set, otherwise derived from `JWT_SECRET` as it always was
(`server/src/auth/seal.ts`) — so a database dump alone does not give it up.
A secret that will not open, under a key the server no longer has, still
leaves the recovery codes: they are hashes and need no key. None of these
run through a token: the account's own security is not something a tool
changes.

## Workspace

**A workspace has a mark**, as a project does: `mark_icon` (one of the
project glyphs) and `mark_tint` (0–9), or a picture (`icon_url`) in place of
both — all null is its letter on the colour its id gives. Its `slug` is
three to forty letters, digits and hyphens, and never one of the words the
app's own pages stand at (`workspace_slug_allowed`) — `privacy`, `terms`
and `legal` among them since the privacy policy took `/privacy`,
`verify` since the confirmation link took `/verify/…`, and `compare`,
`for`, `refunds` and `alternatives` since the site's pages stand there,
and `changelog` since what changed came back at `/changelog` (migration
226).

**A workspace may wear its own brand** — `brand`, `{ name, icon_url,
mark_icon, mark_tint }` or null — on what it shows to people: a shared
document, a feedback page, an invitation's page, and in `GET /api/me`'s
`workspace` for the window's icon and title. It is the workspace's own name
and mark, nothing stored beside them; `mark_tint` is never null in it (a
colour nobody chose is the one the workspace's id gives, worked out by the
server) and `icon_url` is signed for an hour over the picture's key alone,
so a reader with no session or file cookie opens that picture and nothing
else — its path is the stored key, which begins with the workspace's id,
and the id opens nothing. The server works it out at every read and a
client never decides it from a plan's name; on your own server it is
always null. It is answered only while the page is one: a feedback page
that is not `available`, and an invitation whose `state` is not `open`,
answer `brand: null`. A request finds it through the secret that opens the
page — `public_document_brand(token)`, `invite_brand(token_hash)`,
`feedback_page_brand(slug)` — or reads its own workspace under the
policies; `workspace_brand(id)` is the worker's alone (migrations 323,
324).



| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/me` | — ; `workspace` carries its mark: `mark_icon`, `mark_tint`, `icon_url`, and `brand` — the brand it wears, or null (above) |
| GET | `/api/me/export` | never through a token; six an hour per person (`429 rate_limited`); a JSON file (`content-disposition: attachment`) of the account and everything its person wrote in every workspace they are in — tasks, comments, messages, announcements, documents and files (listed, not included), time, AI spend, notifications, activity — and their devices. Comments are every one the person wrote in the workspace, those in rooms and projects they have left included (`my_comments`, migration 238). The your data spec |
| POST | `/api/me/delete` | never through a token; `{ dry: true }` answers what would happen — `alone` (workspaces deleted with it), `leaves`, `blocked` (owned with other people in them), `asks` (`password`, `password_and_code` or `email`). Without `dry`, `{ password, code? }` — or, where `asks` is `email`, `{ code }` from `/api/me/inbox-code` — deletes the account: `403 not_them`, `409 sole_owner` with the `workspaces`, `403 last_instance_owner` for the last owner of a server of one's own, `502 billing` when what a workspace going with it is paid for could not be stopped first — nothing is deleted then; never on a server of one's own, where nothing is paid for. Every workspace it stays out of is left as `POST /api/me/leave` leaves it (`workspace_member_end`): the agents they connected end with their tokens, OAuth connections, webhooks and places, a Slack channel they linked stops, their unused invitations are withdrawn. `delete_my_account` and `account_deletion` (migrations 130, 291) |
| PATCH | `/api/me` | own; `{ title?, name?, language? }` — `name` one to two hundred characters, trimmed, never through a token; `language` is `en`, `fr` or null for never said, never through a token. The french spec |
| GET | `/api/me/email` | own, never through a token; `{ email, pending: { email, approve } \| null, asks: { password, code, inbox } }` — where mail goes, a change waiting on its link (`approve`: still waiting on the old address's yes), and what asking for one takes. The profile spec |
| POST | `/api/me/email` | own, never through a token; `{ email, password?, code? }` — the password and the second factor's code when the account has them (`asks`); with neither, the current address is asked by link first. `202 { pending, inbox }` for every address, taken or not; `403 wrong_password \| totp_required`, counted with signing in's failures (ten a quarter of an hour, then `429`); `400` for the address it already has. Five links an hour. Once changed, a Google sign-in made under the old address goes unless that address is gmail.com or googlemail.com (migration 151), and a sign-in through the server's own provider (`oidc`) made under the old address goes always (migration 321) |
| POST | `/api/me/inbox-code` | never through a token; only for an account with no password and no second factor (`400` otherwise): six digits to its address, ten minutes, once, five an hour (`429`) → `202 { sent_to }`, the address masked. The `code` that `/api/me/delete`, `/api/workspace/transfer` and `/api/me/ways-in` then ask of such an account. `{ for: 'ways' }` sends one for a way to sign in, which only `/api/me/ways-in` takes, `{ for: 'twofa' }` one for turning the second factor on, which only `/api/2fa/begin` takes, `{ for: 'twofa-off' }` — also for an account with a factor on and no password — one for turning it off, which only `/api/2fa/disable` takes, `{ for: 'mail' }` one for changing a server's mail, which only `/api/instance/mail` takes, and the others take only one sent without it |
| GET | `/api/me/ways-in` | own, never through a token; `WaysIn`: `{ offered, oidc_name, ways: [{ id, provider, email, created_at }], password, asks }` — what the account signs in with besides its password, the providers this deployment has keys for (`google`, `apple`, `github`, `oidc`; `oidc_name` what a server's own provider is called, null when it is not offered), whether it has a password, and what adding or removing one asks (`password`, `password_and_code`, `email`). The ways in spec |
| POST | `/api/me/ways-in/:provider` | own, never through a token; `{ password?, code? }` as `asks` says (`email`: the code from `/api/me/inbox-code`), counted with every re-ask, ten a quarter of an hour; `403 not_them`, `404` for a provider not offered, `403 email_unverified` for an address nobody has proved (the callback refuses one too, `?ways=failed`), `503 unreachable` for `oidc` when the server's own provider's discovery document cannot be read (nothing is made). Sets `__Host-tuff_link` (HttpOnly, ten minutes), a single-use ticket for this account, this provider and this session (`auth_ticket` kind `link`, migration 168), and answers `{ url: "/auth/oauth/:provider/start?link=1" }`. The start takes the ticket only from that cookie and only for its provider, and puts its hash in the signed state; the callback, while that session is alive, links the provider's account to the ticket's account, whatever its address, mails the address, and goes to `/:ws/account?ways=added`, `?ways=taken` (it signs somebody else in, or is a GitHub connected to somebody else) or `?ways=failed`. **From an app** (the ways in apps spec), whose sheet carries no cookie: `app_challenge` beside the proof, the SHA-256 of a fresh secret in base64url (43 characters; `400` otherwise, and `400` for one already used), only from an app's own client — `403` with `Origin` or `Sec-Fetch-Site`. No cookie; the ticket is bound to the challenge too and found by it, and the answer (`WayInStart`) is `{ url: "/auth/oauth/:provider/start?link=app&app_challenge=…" }`, for the sheet, taken only with `Sec-Fetch-Site: none`, and only once: the first start marks the ticket (`auth_ticket.started`, migration 185) and every later one is `/signin?ways=failed`. The callback links nothing: it leaves who the provider named, and which start it came from, as a ticket of kind `linked` (two minutes, once; migration 184) and goes to `/signin?linked=…`, or `/signin?ways=failed` |
| POST | `/api/me/ways-in/:provider/finish` | own, never through a token, only from an app's own client (`403` with `Origin` or `Sec-Fetch-Site`); `{ linked, verifier }` — the ticket the sheet was handed back and the secret. Refused `410 gone`, spending nothing — not `401`, which an app takes for its session having ended — unless the `linked` ticket and the link ticket it came from are live, for this provider, this account and the session making the request (a workspace switched since is another session), the `linked` ticket came from the start the link ticket allowed, and the verifier's SHA-256 is the challenge. Then the link ticket is spent, once, and the link made as the web's callback makes it: `WayInAdded` `{ provider, email }` — the address of the account there, null when the provider gave none — or `409 taken` for a provider account that signs somebody else in or a GitHub connected to somebody else. The address is told |
| DELETE | `/api/me/ways-in/:id` | own, never through a token; the same proof; `409 last` when it is the account's only way in (no password, nothing else), decided under a lock on the account (`auth_identity_remove`); `404` for one that is not the account's. The address is told |
| POST | `/api/me/email/again` | own; the waiting change's link again, nothing asked; the one before it stops working; `404` when nothing is waiting |
| DELETE | `/api/me/email` | own; calls off the waiting change, and its links stop working |
| POST | `/api/me/email/confirm` | own, from a session of the account the change belongs to — in a workspace or in none; never a token of any kind, GitHub, an import or a feedback page (`403`). `{ token, pressed: true }`, the press on the page the new address's link opened (`400` without `pressed`) → `{ changed: true, email }` (`Verified`): the address is the new one and confirmed, the old address is told, and the new one is told which account it now signs in to (not when the previous holder was put out, below). The letter to the new address says not to forward it. `403 not_this_account` from any other account's session, the link left unspent, so signing in to the right account and pressing again works; `410` used, called off or past its day; `409` when the address has an account of its own by then. The database asks too: `auth_email_confirm(token_hash, session)` changes the address only when the session is the ticket's account's and has not ended — or with no session at all for an account nobody proved, putting its previous holder out (`POST /auth/verify` above) — and `auth_email_change` is nobody's to run (migration 316). An account whose address was unproved is then sent the letter that chooses a password, as before |
| POST | `/api/me/password` | own, never through a token; `{ current, password, code? }` — the password there is now and the second factor's code when there is one, counted with signing in's failures; `403 wrong_password \| totp_required`, `409 no_password` for an account made through a provider (its first password comes by `/auth/password/forgot`), `400` under twelve characters. Signs out every other session and keeps this one's line, as `DELETE /api/sessions` does: `{ ok, signed_out }`. The address is told |
| POST | `/api/me/presence` | own; never through a token |
| PUT | `/api/me/status` | `agent.status` — an agent, about itself, never a person or a person's token (`403`); `{ task_id?, conversation_id?, thread_id?, doing }` — what it is doing now, on a task it can see (`404` otherwise) or none, and for a room it can open and a thread's head in it (`404` otherwise; a `thread_id` without its `conversation_id` is `400`). `doing` is cleaned (control characters and line breaks to spaces, runs of spaces to one) and cut to 120; empty after that is `400`, over 2 000 before it is `400`; `null` takes it away. Said again it replaces what was there: `since` keeps running while the task is the same and the last word is fresh, and starts again otherwise. `200 { status }` — `AgentStatus` or null. One row an agent, `agent_doing` (migration 261), its policies holding it to the agent and its task's readers; a status older than three minutes is in no answer (`agent_doing_fresh`); finishing or binning the task takes it away (trigger `agent_doing_finished`). A change of task or words says `agent.status { agent_id, task_id }` on the task's project, and on the one it left; a status naming a room says `agent.working { conversation_id, agent_id }` on that room's own topic (and the one it left) — never the project's — and is read only by whoever can see the room (migration 270). `null` also lets go of the agent's wakes in its rooms |
| GET | `/api/working` | `people.read`; `{ working: AgentStatus[] }` — the live statuses the reader may see: one naming a task only to whoever can see the task, one naming none to anybody in the workspace. Each `{ agent_id, task_id, project_id, task_number, doing, since, at, until }`, `until` when it stops being shown. Agents also carry their own as `status` in `/api/people`, `/api/projects/:id/members` and `/api/agents` (null when none is live or the reader cannot see its task), and a task's read carries `working` |
| PATCH | `/api/workspace` | `workspace.billing`; the four switches (`who_creates_projects`, `who_invites_people`, `edit_others_content`, `who_sees_members` — `members` or `owner`, default `members`), and `name` (one to eighty), `mark_icon` (a project glyph, or null for the first letter) and `mark_tint` (0–9, or null for the colour the id gives) — any of them; answers `{ settings }` |
| GET | `/api/people` | `people.read`; each with `title`, what they do in their own words |
| GET | `/api/people/:id` | `people.read`; who they are, what is open on them and the work shared with the asker (`person`, `open`, `shared`); their `projects`, `weeks`, `days` and `hours` only with `members.read` or for oneself, and empty arrays otherwise. Somebody removed from this workspace is `410 removed` with `person: { actor_id, name, avatar_url }` — what every line they wrote already shows, and nothing more; somebody never here is `404` — `docs/specs/person-card.md` |
| PATCH | `/api/people/:id` | `people.role`, the owner's; never on yourself; `{ may_create_projects?, may_create_channels?, may_see_members?, may_invite_people?, may_connect_agents? }` (not on an agent) — `role` is `400`: ownership moves only by `/api/workspace/transfer` |
| DELETE | `/api/people/:id` | the owner's; never through a token; never yourself. Ends everything the person had in this workspace in one transaction (`remove_from_workspace`, migration 172): membership and projects, the invitations they made and nobody used, their tokens for it (OAuth pairs included — a code or a refresh afterwards is `invalid_grant`), its pushes and notifications, its channels (a direct conversation keeps them, for its name), their place on open tasks (finished ones keep it), and a Slack channel they linked (`stopped: linker_removed`). An invitation made before they were removed does not bring them back; one made after does, with none of that. A body of `{ "withdraw_links": true }` — exactly `true`, never from the query — also revokes, in the same transaction, every open link in the workspace (no `email`, unused, unexpired) whoever made it; invitations to an address stay. Answers `{ ok: true, links_withdrawn }`, `0` when not asked. `404` for somebody not in the workspace — `docs/specs/removing-someone.md` |
| POST | `/api/me/leave` | `workspace.leave` — a member, in a signed-in session; never through a token of any kind, never an agent, GitHub or an import (`403`); the owner is `409 owner` ("Hand it over to someone else before you leave" — `/api/workspace/transfer`). No body. Leaves the session's workspace with exactly what removal ends (`leave_workspace` → `workspace_member_end`, the body `remove_from_workspace` now shares, migration 273): memberships, project places, every session for this workspace, tokens, pushes, subscriptions, rooms, open assignments, the agents they connected and the OAuth connections they linked (the trigger of migration 269). Their content stays under their name; a new invitation brings them back. Logs `people.leave` (audit log, `people`). Answers `LeftWorkspace` — `{ ok, session, workspace }`: a session for their first other workspace by name, or, when it was the last, a `NowhereSession` and `workspace: null`. `leave_workspace` holds the leaver's row `for update` and never ends an owner's; `transfer_workspace` locks both rows and a hand-over to somebody who left meanwhile is `404`, the step-down taken back (migration 273) |
| — | *a session in no workspace* | `NowhereSession` — `{ access_token, refresh_token, expires_in, actor_id, workspace_id: null, nowhere: true }`, from `/auth/login` and `/auth/oauth/exchange` with `nowhere: true` in the body (without it, an account in no workspace is `403 no_workspace`), from `/auth/refresh` of one, and from leaving the last workspace. Its access token names no workspace and is refused by every route but these, before the usual check; anything else is `403 no_workspace` |
| GET | `/api/me` *(no workspace)* | `NowhereMe` — `{ actor, email, workspace: null, role: null, can, nowhere: true }`; `can` is `["workspace.create"]` where `can()` allows it |
| GET | `/api/me/invitations` | a session in no workspace only; `WaitingInvitations` — `{ invitations: [{ id, workspace_name, host? }] }` (`host`: mailed to that workspace's own domain, taken there from its letter; one whose domain no longer answers is left out — migration 328): unused, unexpired invitations to the account's proved address, to a workspace that stands and they are not in, made since they last left it (`invites_waiting`, at most 20) |
| POST | `/api/me/invitations/:id/accept` | a session in no workspace only; takes one of those as its link would (`accept_invite`) → `Session` in that workspace; `404` gone, `413` full |
| GET | `/api/me/unconfirmed` | `workspace.confirm` — a person in a signed-in session, in a workspace or in none; never a token of any kind, an agent, GitHub or an import (`403`), nor an unproved address. `UnconfirmedWorkspaces` — `{ waiting: [{ id, name, role }] }`: the workspaces the account was in, with anybody else, when its address was proved and the previous holder put out — Google or Apple vouching (`auth_claim_email`), the letter that chooses a password or a reset (`auth_set_password` for an unproved or by-hand address), an old confirmation link (`app_user_proved`). Each such membership has `joined_at` null and `unconfirmed_at` set (migration 315, `before_proof_held`) and opens nothing — it is not joined to `is_member`, `auth_context`, sign-in, refresh, entering or the switcher — until answered below; a socket's `member_alive` and the notices to a workspace's people ask for `joined_at` too. At the same moment the open invitations the account made are revoked and the Slack channels it chose stop (`stopped: linker_unproved`); an invitation to a waiting workspace taken by a press on its own page (`/api/invite/:token/join`, `/api/me/invitations/:id/accept`, `/auth/invite/:token/accept` with the account's password) is its Join (`accept_invite`'s `p_pressed`); taken any other way it is left unspent. The workspace sees a waiting member's name and face, and no presence, title, address or time zone (`colleague_card` answers only between joined members). Never in it: the workspace `register_owner` made for this account, while nobody else has ever had a row there. Also `instance_name_owner` holds them, for an account unproved or by hand. `memberships_unconfirmed`, at most 50 |
| POST | `/api/me/unconfirmed/:workspaceId` | `workspace.confirm`, as above. `{ "answer": "join" }` or `{ "answer": "leave" }`, exactly — no body, another word or another key is `400`; nothing else answers. Join confirms the membership as it was (`joined_at` now, `unconfirmed_at` null); Leave ends it as leaving does (`workspace_member_end`, `people.leave` in the security log); an owner's role is `409 owner` for Leave. `404` when that workspace is not waiting for this person. `UnconfirmedAnswered` — `{ ok: true, answer: "joined" \| "left" }`, and beside them the fields of a `Session` for the workspace joined when it was asked from a session in no workspace (which then ends), as `PasswordSet` carries one. `auth_membership_answer`, the sign-in role's |
| POST GET | `/api/workspaces`, `/api/workspaces/address` *(no workspace)* | as for any session: `workspace.create`, ten a day; answers a `Session` in the workspace made |
| POST | `/api/me/delete`, `/api/me/inbox-code` *(no workspace)* | as for any session |
| GET POST | `/api/invite/:token`, `/api/invite/:token/join` *(no workspace)* | an invitation's link followed in no workspace: its preview with `you` and `member: false`, and joining as themselves → `Session` |
| GET | `/api/agents` | `people.read`, never to an agent; the workspace's agents — `{ agents: [{ actor_id, name, avatar_url, reach, created_by, created_by_name, created_at, project_ids, offered_project_ids, active_at, can_disconnect, can_manage, authorization_set?, webhook_shape?, webhook_url?, connections?, stopped? }] }`, `reach` `"mcp"` or `"webhook"`. `stopped` true when whoever connected it was put out of the account (`agent.stopped_at`, migration 317): its tokens revoked, until `POST /api/agents/:id/token` by its connector, which ends the old tokens as always and clears it — and sends nothing anywhere. To whoever manages it, `webhook_stopped: true` when its webhook was turned off then: its secret and key emptied and `webhook_url` not said; only `PUT /api/agents/:id/reach` with a webhook address turns it on, with a new secret. To whoever manages an agent reached by webhook, `authorization_set` — whether its webhook sends the receiver's own key, never the key — and `webhook_shape`, `"tuff"` or `"claude_routine"` (`agent_webhook_said`, migration 266), and `webhook_url`, where it is sent (migration 268); absent for anybody else. `can_manage` is `agent.manage` — whoever connected it, not the owner (migration 290); never through a token — and `can_disconnect` is `agent.remove` — the owner, or whoever connected it. To whoever may disconnect it, `connections` — `[{ id, client, created_at, linked_by_name }]`, the live connections Tuff's remote MCP connector signed in as it (`agent_oauth_connections`, migration 269), newest first; absent for anybody else. `offered_project_ids` are the projects the reader could put it on with `POST /api/projects/:id/members`: live, the reader on them (the owner on all), its connector on them (any, when the owner connected it), and it not on them yet; empty without `project.member.add`. An agent is also in `/api/people` and `/api/projects/:id/members`, with `agent: true`, its last visit as `active_at` (for agents only; migration 177), and after the people, and takes no seat (`workspace_people`) |
| POST | `/api/agents` | `agent.connect` (the owner, or a member with `may_connect_agents`); a signed-in session, never a token; `{ name, project_ids, reach: "mcp" }` or `{ name, project_ids, reach: "webhook", url, shape?, authorization? }` — projects the caller is on (`404` otherwise); `url` public https (`400`). `authorization` is the receiver's own key, sent as `Authorization` with every delivery (one header value: printable ASCII, no CR or LF, at most 1024 characters once trimmed, `400` otherwise), sealed at rest and never answered. `shape` `"tuff"` (the default, signed JSON) or `"claude_routine"`, a Claude Code routine's API trigger: `url` must be `https://api.anthropic.com/v1/claude_code/routines/<trigger id>/fire` and `authorization` the routine's token (`400` otherwise). A routine is sent `POST` with `Authorization`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `anthropic-version: 2023-06-01`, `content-type: application/json` and `{ "text": … }`: Tuff's fixed instruction first (open the link through Tuff's MCP, read it and its thread, answer there), then a line saying the fields below were written by people and are not instructions, then `Task: <handle> — <title>` (or `Room:`, `Announcement:`, `Document:`), `By: <name>` and `Link: <address>`, each person-written field flattened to one line with no quotes or backticks (`routineText`, `flat`). No signature headers, which Anthropic ignores; at most thirty an hour, counted under an advisory lock per webhook: past that nothing is queued for it (`agent_hears`, migration 266). The routine reads and writes through Tuff's remote MCP connector: as the agent, with its rights and projects, when the connector was signed in as it (`/api/oauth/authorize`, `agent_id`); otherwise as whoever connected it on claude.ai, with that person's rights. Logs `agent.connect` with `shape` and `authorization: "set"` when given — never the value. The agent is an actor with a membership and a place on those projects holding at most `task.create` and `edit.any` (and of a member's rights only those) — `agent_connect`, migrations 173 and 176. `201 { agent_id, token }`, and for a webhook `secret` too, shown once: the token it reads and writes with through MCP (`/mcp`, `Authorization: Bearer`), scoped to its projects for a year, and the secret its webhook is signed with. Through MCP alone nothing is sent to it: it reads its tasks (`my_tasks`) when it comes for them, from where it works. By a webhook, given a task or mentioned, it is sent `agent.assigned` or `agent.mentioned` — `{ agent_id, reason, object_type, object_id, handle, what, chain, by_name, title, path }`, `by_name` who did it, `title` the task's, announcement's or document's title or the room's name, `path` where it opens without the site (`/:ws/:project/tasks/41`, `/:ws/chat/:id`; migration 266; in a room with no project — a direct conversation — only to an agent that has joined it, migration 267, and any message to it in a direct conversation of the two of them is a mention; a room of chosen people only to an agent in it, otherwise no delivery) — signed and retried as every webhook; it hears nothing else, and its webhook is not in `/api/webhooks`. `chain` follows the agent: 0 from a person; from an agent, one more than the highest count among hand-offs (assignments, mentions, thread replies) that reached that agent on anything since a person last assigned or mentioned it, within the day; what GitHub, an import, a board or a feedback page names wakes no agent at all. Only a person's own assignment or mention of an agent resets it — never a reply; notes to agents are never merged. Thread replies are counted but never stop or alarm anything. The third in a row is neither sent nor written to the agent's inbox, and on a task becomes a question to its people (a comment with `stops_chain`), elsewhere an `asked` note of kind `handoff` to whoever connected the agents; the `handoff` note at most once an hour per agent and thing (`told_of_handoff`), five hand-off alarms an hour a person (`handoff_alarms_lately`), held by quiet hours; past sixty assignments and mentions of agents an hour in the workspace — from agents, or from a person's own token (`notification.handed_by_token`) — none is sent, and the connectors get one `handoff_cap` note an hour (`notification.chain`, `agent_chain()`, `agent_handoffs_lately()`, migrations 255, 256, 258 and 259). An answer to an agent's question reaches it as `agent.mentioned` with `what` *… answered your question*. The way through GitHub Actions (migrations 174–175) is taken out: agents connected so are reached through MCP now |
| POST | `/api/agents/:id/avatar` | `agent.manage` (whoever connected it, not the owner — migration 290); never through a token, never an agent; multipart, one image — a person's picture's limits (below) and its thirty an hour, counted for the person uploading. `403` to somebody who may not, `404` for an agent not in the workspace. Written by `agent_face` (migrations 180, 290), which asks the same again on the row; not recorded |
| PUT | `/api/agents/:id/avatar` | `agent.manage`, as `POST`; JSON `{ preset }`, one of `AgentFace` (`bot-1`…`bot-10`, `blob-1`…`blob-4`, `geo-1`…`geo-4`), `400` for anything else. Kept in `avatar_key` as `preset:<id>`; every `avatar_url` for it is then `/faces/<id>.png`, a still the product serves to everybody rather than a signed link — any client that draws a picture draws it. Not bytes: nothing is queued for the clear-out (migration 189). The agent faces spec |
| DELETE | `/api/agents/:id/avatar` | `agent.manage`; back to its letters |
| PATCH | `/api/agents/:id` | `agent.manage` (whoever connected it, not the owner — migration 290); a signed-in session, never a token, never an agent (`403`); `{ name?, authorization? }`, at least one; `name` 1–60 characters once trimmed (`400` otherwise) → `{ ok }`. `authorization` sets or replaces its webhook's receiver key (one header value, as at connecting), `null` takes it off — `400` for an agent with no webhook, and for taking a routine's token off (replace it instead); `agent_webhook_authorization`, migration 266. Logs `webhook.update` — `meta: { id, host, agent_id, authorization: "set" | "changed" | "removed" }`, never the value. The name is the agent's actor's, so every list of people says it at once (`agent_rename`, migration 264). Logs `agent.rename` with `was` and `renamed` when it changed |
| PUT | `/api/agents/:id/reach` | `agent.manage` (whoever connected it, not the owner — migration 290); a signed-in session, never a token, never an agent (`403`); `404` for an agent not in the workspace. `{ reach: "mcp" }` or `{ reach: "webhook", url, shape?, authorization? }` — how it is reached, changed after connecting. `url` takes the checks `POST /api/agents` gives it: public https (`400`), or for `shape: "claude_routine"` exactly `https://api.anthropic.com/v1/claude_code/routines/<trigger id>/fire` (`400`). A new `url` or a new `shape` takes the stored `Authorization` value off in the same statement — a key given for one host is never sent to another — before any `authorization` given here is set (one header value, as at connecting; `null` takes it off); a routine must end with one, so a routine with a new address or from another shape needs its token here (`400`, nothing changed). A new `url` or `shape` is a new receiver: in the same statement the signing secret is replaced, so the old one no longer verifies, and deliveries queued and not yet sent are cancelled rather than sent to the new address. `mcp` turns its webhook off and deletes it, emptying its address and secret and taking its key off, and cancels what was queued: nothing more is sent. A webhook made here, from MCP, gets a new secret. → `AgentReachChanged` — `{ ok, authorization_cleared, secret? }`, `secret` said once, when this made the webhook or moved one in Tuff's own shape; never for a routine, which is not signed. Written by `agent_reach` (migration 268). Logs `agent.reach` — `meta: { agent_id, name, was, reach, was_host?, host?, authorization? }`, `was` and `reach` `"mcp"`, `"tuff"` or `"claude_routine"`, `authorization` `"set"`, `"changed"` or `"removed"`; never a key or an address's path. Nothing logged when nothing changed |
| POST | `/api/agents/:id/token` | `agent.manage`, as `PATCH`; no body → `201 AgentTokenMade` — `{ token }`, shown once, as at connecting: every token the agent held is ended in the same press (`agent_end_tokens`, migration 264: revoked, its refresh dropped) and a new one is issued for a year. Its places, tasks and webhook stay. Logs `agent.token` and the `token_issued` security event |
| DELETE | `/api/agents/:id/connections/:grant` | `agent.remove`: the owner, or whoever connected it, in a session of their own — ending hands nothing over (`agent_oauth_end`, migration 290); ends one connection Tuff's connector signed in as the agent — every token and refresh of it (`agent_oauth_end`, migration 269); its other tokens and connections stay. `{ ok }`, `404` for a connection that is not this agent's. Writes the security event `agent_unlinked` — `{ actor_id, agent_id, client }` |
| DELETE | `/api/agents/:id` | `agent.remove`: the owner, or whoever connected it; never through a token. Off every open task, token revoked, webhook stopped (`agent_disconnect`). Removing a person disconnects the agents they connected; `DELETE /api/people/:id` on an agent disconnects it |
| GET | `/api/agents/:id/work` | `people.read` and `agent.work.read` — the Members screen's (`members.read`), or whoever connected the agent; never an agent, never a token made for some projects (`403`). `404` for an id that is not an agent of this workspace. `?period=week` (the default) or `month`, from Monday or the first on the reader's calendar (`400` otherwise) → `AgentWork` — `{ period, since, took, finished, open, asked, answered, tokens, cost_usd, spent_on, events }`: tasks given to it in the period (the feed's `given_ids`), tasks on it finished in the period, tasks on it open now in a live project, the questions with choices it asked in the period and how many of them are answered, the tokens and dollars its clients reported in the period (a line counts where it was last reported; `cost_usd` null when no line said a price) and on how many tasks, and its latest ten lines in the feed in the period, shaped as `GET /api/activity` answers them. Read as the reader under row-level security: work on a project the reader cannot see is not counted, listed or summed |
| GET | `/api/agents/:id/work/tasks` | as `/work`; `?of=took|finished|open|asked|answered|spend`, `?period=`, `?limit=` (50, at most 200), `?cursor=` → `AgentWorkTasks` — `{ tasks: [{ id, number, title, due_on, completed_at, project_id, project_name, project_key, project_slug, overdue, icon, color, tokens?, cost_usd?, questions? }], next_cursor }`, one number's tasks: the newest first (given, finished, made, asked), or for `spend` the most tokens first with `tokens` and `cost_usd` for the period; `questions` for `asked` and `answered`. `400` for any other `of` or a cursor it did not give |
| GET POST | `/api/invites` | `people.invite`; each row read says `send_again` when it was mailed to the workspace's own domain and that domain no longer answers — it can be taken nowhere (migration 328); plus the switch and the owner's word about the person (`may_invite_people`); `rights` needs a project to hold them; with `email` the invitation is mailed there, and the answer says `mailed`; answers `{ id, token, mailed }` (`InviteMade`) — `token`, the link's secret, once, for a link with no address (always this server's address, never bound to a workspace's own domain, and never taken on one, migration 330), and for one to an address only on a server of one's own with no mail set up, where it is not mailed and the inviter hands it over (`invite.by_hand`, migration 210); otherwise `token` is `""`: an invitation to an address puts its link in the mail and nowhere else, never on the service; always a member — `role: owner` is `400`, a workspace has one owner (`membership_one_owner`); `413 limit` when the people and the invitations to an address still waiting fill the plan (`workspace_held`, migration 136) — a link holds no place, `accept_invite` stops it at the ceiling |
| POST | `/api/invites/:id/revoke` | `people.invite`. The application role may update only `deleted_at` and `updated_at` on `invite` (migration 210), and insert only `id`, `workspace_id`, `email`, `role`, `project_ids`, `rights`, `token_hash`, `created_by` and `expires_at` (migration 313) — `created_at` and `updated_at` are the defaults, since `accept_invite` keeps out somebody removed after an invitation was made by its `created_at`; `used_at`, `used_by`, `by_hand`, `mailed_to` and `mailed_domain` are written by definer functions — `by_hand` and `mailed_to` only by the sign-in role's `auth_invite_delivered`, bound to the token's hash, when the server mails the link or hands it over, and `mailed_domain` only by its `auth_invite_bind`, before a letter linking to a workspace's own domain goes (migration 328). Addresses on an invitation are compared folding only ASCII A–Z (`lower(x::text collate "C")`), never by `citext`, which folds `İ` to `i` and the Kelvin sign to `k` |
| POST | `/api/invites/:id/resend` | `people.invite`, never through a token (`403`); no body → `InviteMade` — `{ id, token, mailed }` for a new invitation holding what the old one held (address, role, projects, rights, as long again), the old one revoked in the same transaction: only a hash is kept, so the old link cannot be shown again. `404` for one used, revoked or not the asker's to see (only the owner reads invitations); `403` onto a project the asker is not on, or rights beyond the ordinary two where they do not run it; `413` when the workspace is full with the old one let go; `400 invalid` when the address on the row is not one `POST` would take (`z.email()`, ASCII) — nothing is mailed or handed over, and the old one stays. To an address it is mailed again under the same ceilings as `POST`, spent before the old one is touched — past one `429` and the old link still works; a letter not sent puts the old one back (`502 mail_failed`) — and `token` is empty, unless handed over by hand; two at once: one `200`, the other `404`; with no address `token` is the new link,. Logs `invite_created` with `resent_from` |
| GET | `/api/invite/:token` | the invitation read by whoever is signed in: the preview with its `brand`, `you: { name, email }`, `member`, and `workspace_id` when they are in it already — `invite_for_me` |
| POST | `/api/invite/:token/join` | joins as whoever is signed in and answers a session for that workspace; `404` spent, `413` full, `403 wrong_email` for a link handed over by hand to another address, `403 email_unverified` for an account whose address nobody has proved, the invitation untouched; never through a token |
| POST | `/api/workspace/transfer` | `workspace.transfer` — never for an owner whose address is proved only by a link handed over (`byHand` in `can()`); `{ to, password?, code? }` — the owner hands the workspace to somebody in it whose address is proved for real (`409 unconfirmed` for one unproved or proved only by hand; `transfer_workspace` refuses either side the same, migration 315), with their password and code when they have them, or the code from `/api/me/inbox-code` when they have neither (`403` when wrong); one owner, so `transfer_workspace` steps the owner down first; never through a token |
| POST | `/api/workspace/delete` | `workspace.delete`, the owner's; never through a token. `{ dry: true }` answers `{ name, projects, people, agents, paid, asks }` — `asks` `password`, `password_and_code`, `code` or `email` (the code from `/api/me/inbox-code`). `{ name, password?, code? }` deletes it: the name as it is written, checked first (`400 name`), then the proof as handing over asks (`403`, `429`); never through GitHub or an import either. On a server of one's own, `409 last_instance_owner` when deleting it would leave the server no owner who can sign in. What it is paid for, if anything, is stopped first (`502 billing`, nothing deleted, when that cannot be done; never on a server of one's own); then `delete_workspace` locks the workspace, marks it, its memberships, places and unused invitations deleted, ends what it was paid for in our rows and sets it free, ends its sessions, tokens, agents, webhooks, push, shared links, running imports, GitHub and Slack, in one moment (migration 178), and everybody who was in it is mailed after the answer. A deleted workspace is refused at every request (`auth_context`), and no live membership can be made in one. Kept thirty days, then cleared for good by the worker (`purge_deleted_workspaces`) |
| GET POST | `/api/tokens` | `token.issue.own` and `agent.use`; never through a token. `POST { name, project_ids?, ttl_days? }` — `project_ids` (up to 50) are projects the person can open in this workspace (`404` otherwise); a token made with them reaches those projects and nothing else: every other project, its tasks, posts, docs, files, rooms, comments, labels, sprints, time, search hits, feed lines and inbox notes are as not there (`404` on a direct link, absent from lists), and it does nothing about the workspace as a whole — no projects, channels outside a project or direct conversations made, no Members screen (`403`). People are still listed by name. Empty is every project the person is on, as before. Enforced in the database (`visible_projects()` narrowed by `token_projects()`, migration 191) and in `can()`. At most 25 live tokens a person in a workspace (not revoked, not deleted, not expired; a connector's count too): past it `POST` is `409 too_many_tokens`; a connector's `/oauth/token` is never refused for it |
| POST | `/api/tokens/:id/revoke` | own, or `token.revoke.any` |

### Who is here

Three states and one dot: `here`, `away`, `busy` — `docs/specs/presence.md`.
They are **derived, never stored**: `presence_of(seen_at, presence)` answers
it from when somebody was last active and which of the three they chose, so
no screen invents its own threshold. `GET /api/me` returns both the answer
(`actor.presence`) and the choice behind it (`actor.chosen`, null for "work
it out"); `/api/people` carries the answer per person, and the conversation
list carries `other_presence` on a direct conversation with one other person
in it, and `other_avatar_url` beside it — that person's picture, so the
column draws their face as everywhere else does.

`POST /api/me/presence` takes `{ presence: "away" | "busy" | null }`. Through
a token it is refused: an agent is not a person who is here, and a tool that
can set its owner to Do not disturb can make somebody unreachable without
their knowing.

### Channels

`conversation.channel` says a room is a channel
rather than people talking; a project's room always is (a trigger sets it),
and one outside every project is one when it was made as one.
`conversation.created_by` is who made it.

A channel's name is stored the way Slack writes one — lower case, a hyphen
for a space, no leading `#` — and the server writes it so whatever is sent.
Clients show a project's channel as `{project_slug}-{name}` and any other by
its name; a project's first room is `main`.

Who may see a channel outside a project is its member rows, exactly as for a
direct conversation; "everyone" is written as a row for everybody in the
workspace when it was made. `can` on each listed room is what the reader may
do to it:

- a project's channel: `edit` with `channel.create` on that project,
  `delete` with `channel.delete`;
- a channel outside projects: `edit` with `channel.create.workspace` — every
  member, unless the owner turned channels off for them — and `delete` for
  whoever made it, or the owner;
- a direct conversation: nothing.

Somebody taken out of a channel keeps their row with `joined_at` null: the
way in goes, their read mark stays. Renaming is `conversation.rename` in the
activity log and choosing people is `conversation.members`.

### What one person may start

`membership.may_create_projects` (boolean, nullable) and
`membership.may_create_channels` (boolean, default true) are the owner's
word about one person — `docs/specs/member-rights.md`.

- `may_create_projects` **null** follows the workspace switch
  `who_creates_projects`; true or false wins over it, either way. An owner
  always may.
- `may_create_channels` **false** refuses `channel.create` in every project
  the person is on, whatever that project's rights say. True leaves each
  project to decide, as it did.
- `membership.may_see_members` and `membership.may_invite_people` (boolean,
  nullable, migration 131) are shaped as `may_create_projects`: **null**
  follows `who_sees_members` (for `members.read`, the Members screen
  ) and `who_invites_people` (for
  `people.invite`); true or false wins over the switch either way.

Set with `PATCH /api/people/:id`, by the owner, never on yourself; a body may
carry any of `role`, `may_create_projects`, `may_see_members`,
`may_invite_people` (null hands each back to its switch) and
`may_create_channels`. `GET /api/people` returns the flags per person and
the answers once the switches are applied — `creates_projects`,
`sees_members`, `invites_people` — so no client works them out. `can` in
`/api/me` already reflects them for the asker.
Changing them is `people.rights` in the activity log.

### A person's card

`actor.title` is what somebody does, in their own words — up to eighty
characters, optional, set by them alone with `PATCH /api/me { title }`
(null or blank takes it off). `GET /api/me` returns `actor.title` and
`actor.timezone`, the zone quiet hours use, so a client can set it from the
device while it is still the default `UTC`.

### A person's language

`app_user.language` (migration 142) is what somebody reads the product in:
`en`, `fr`, or null for never said, which reads as English. `GET /api/me`
returns it as `actor.language`; `PATCH /api/me { language }` sets it, never
through a token. Mail and pushes go out in the recipient's language
(`language_of(actor)`); an invitation, to somebody with no account yet, in
its sender's. A mail asked for from a screen — a confirmation, a reset, a
code — is in the account's language when it has said one
(`language_said(actor)`, migration 143, null for never said) and otherwise
in the request's `x-tongue`.

What a new project starts with — its lists, its three labels, a template's
tasks and document, the sample project — is written in the language of
whoever makes it, and is the project's own text from then on: it is not
translated again for anybody who reads it. The names in `STARTING_LISTS`
and `PROJECT_TEMPLATES` stay English; a French project's lists are
`Backlog`, `À faire`, `En cours`, `Terminé` and `Annulé`.

An error's `message` is in the language the request names in `x-tongue`
(`en` or `fr`; anything else, or nothing, is English). The `code` never
changes with it. The web sends `x-tongue`; the native apps and agents
don't, and read English.

`GET /api/people/:id` returns, beside what it did: `person.title`,
`person.email` and `person.timezone` — the last two from
`colleague_card(actor)`, which answers only for somebody in the asker's
current workspace, because the account row is otherwise its owner's alone —
and `shared: [{ id, name, slug, key, open, overdue, done }]`, their tasks per
project **the asker is a member of**: open, open and past due, and finished
in the last thirty days. Membership, not visibility: an owner can open every
project and is not part of every one. `docs/specs/person-card.md`.

### A person's picture

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/me/avatar` | signed in; multipart, one image — a PNG, JPEG, GIF or WebP by its bytes, whatever type the form says, else `400 invalid` |
| DELETE | `/api/me/avatar` | signed in; back to the letter |

`image/*` only, two megabytes, `413` over that — the project icon's limits, so
there is one answer to how big a picture is. Through a token both are refused,
for the reason presence is: an agent is not a person and has no face to set
itself. An agent's face is set by whoever manages it, at
`/api/agents/:id/avatar` (Agents, above).

No permission beyond being signed in. A person's own face is the one thing
here that is theirs without a role saying so, and there is nobody else these
endpoints could be changing — a workspace owner who wants somebody else's
photograph changed asks them.

`actor.avatar_key` is a storage key, not a url, and the client never sees it:
reads return `avatar_url` as a signed `/api/blob/…` path good for an hour, the
same way a project returns `icon_url` — except an agent's premade face,
`preset:<id>`, which reads as the public still `/faces/<id>.png`.
The `avatar_url` **column** is a
separate thing — text, written by nothing, present since the first migration —
and it stays unused rather than being dropped. A column of that name invites a
link pointing out of the product, and `storage.ts` opens by saying there are
no public URLs.

With no key the client draws the person's initial on a tint derived from their
id. It is the default, not a placeholder: one letter rather than two, because
what tells two people with the same initial apart is the tint.

Nothing is written to the activity log. A project's icon is recorded because a
project is shared and its history is read by people who did not change it; a
person changing their own face has no second party to tell.
`docs/specs/avatar.md`.

**A face follows a person wherever they are drawn by name.** A message carries
`author_avatar_url`, a comment and a post the same, an activity line
`actor_avatar_url` — all signed the same way and for the same hour. They are
computed from a key the client never sees, so there is one rule for the link
and it cannot drift between the places a person appears.

A room's members come from `channel_members`, a definer function, so widening
them is a migration rather than a column in a query: its return type cannot be
changed in place, and `064` drops and rewrites it with `avatar_key` added. The
`can_see_conversation` guard that is the whole reason it runs as definer is
unchanged.

**A picture that does not arrive falls back to the letter.** The key lives in
Postgres and the bytes live in storage, so a row can point at nothing — a
rebuilt environment wipes the files and keeps the rows. Clients draw the
generated mark on a failed load rather than the browser's broken frame, which
has no way back but uploading again.

Being here is said on the socket that is already open — a frame on `/ws/me`,
which the server does not read, stamps `seen_at` at most once a minute per
person. It is sent while the tab is **visible**, not while the socket is
open: a laptop asleep with a tab in front of it holds the connection for
hours, and a connection is not a person.

Only three settings are writable, because those are the three places an agency
and a hundred-person company genuinely disagree: who creates projects, who
invites people, and whether a member may edit somebody else's content.

**`GET /api/people/:id` is bounded by what the asker can see**, and not by a
filter written here: the query runs as them under row-level security, so a
project they are not on is not a row to leave out. Somebody who shares two of
a colleague's six projects sees two, the screen says so, and the other four
are not hinted at. `open` is the work assigned to them and not finished,
dated first and undated after, each row carrying `overdue` — late and still
open, decided on the server so three clients do not each work it out from a
date. Late means the due day has ended on the asker's calendar, in the zone
their account holds (`timezone`), not in UTC; the weeks and the days of the
charts are the asker's weeks and days too — `server/src/day.ts`. Not being in this workspace is `404`.
Everything else in the matrix is a default with no choice, and changing any
switch is written to the activity log.

## Workspaces

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/workspaces` | the ones this person belongs to, each with its mark (`mark_icon`, `mark_tint`, `icon_url`) and `unread` — whether this person has an unread notification there that its bell would count, asked inside that workspace under its own policies, all of them in one transaction; a yes or no about their own notes and nothing else of it; absent through a token |
| POST | `/api/workspaces` | `{ name, slug?, mark_icon?, mark_tint? }` — makes one with the caller as owner, answers a session for it plus its `slug`; a `slug` taken or not allowed is `409`; `403` through a token; `403 email_unverified` for an address nobody has proved (`workspace.create`); on a server of one's own with sign-up closed, `403 forbidden` to anybody who is not an instance owner (`can()` and `new_workspace`, migration 244) |
| GET | `/api/workspaces/address?name=&want=` | `{ slug, free, suggestion }`: the address a name would get, or whether `want` is free and the nearest free one |
| POST DELETE | `/api/workspace/icon` | `workspace.billing`; a picture (multipart `file`, 2 MB; a PNG, JPEG, GIF or WebP by its bytes, else `400 invalid`) in place of the workspace's mark |
| POST | `/api/workspaces/:id/enter` | a session for that one; the one it came from is kept — other tabs use it. Entering another workspace writes a `login` security event there, `meta.method: switch`; into any workspace but the session's own, `403 email_unverified` for an address nobody has proved (`workspace.enter`) |
| GET | `/api/my/tasks` | mine, across every project but an archived one or the sample; `?tab=assigned` (default), `created`, `subscribed`, or `activity` (`activity.read`); each with its list's `icon`, `color` and `list_name`, and its project's `project_slug` |

One consultant works for three agencies. **Switching is a new session, not a
header**: which workspace a request is in comes from the token, the same as
who is asking. A client-supplied workspace id would be a second way to say
it, and the two would disagree the first time something forgot to check.

Not being a member reads as `404`, not `403`. That a workspace exists is
information about somebody else's company.

**Making one** is open to anybody signed in, whatever their role where they
are — it takes nothing from the workspace they are in. The slug is chosen by
the server from the name (`slugify`, then `-2`, `-3` until free, `workspace`
when the name has nothing to make one from), because slugs are unique across
every workspace and a client cannot see which are taken. It starts with the
defaults a registered workspace gets (`057_new_workspace.sql`); labels
belong to projects and each new project brings its own three (`071`). Not through an API token: the answer is a session,
and a session is a wider key than the token asking for it.

**The session's workspace is inside the policies, not only in the query.**
`app.workspace_id` is set beside `app.actor_id` for the length of every
transaction, and the functions the row-level security policies route through
refuse a row outside it — `044_session_workspace.sql`. Before that, the
policies knew who was asking and not where from, which is the same answer for
as long as a person has one workspace. The day one account had two, `/api/my
/tasks` listed the other company's work and the palette searched it, with no
query having changed. Leaving it unset means unbounded, which is what
`/api/workspaces`, the switcher and the login flows need: they are questions
about the person rather than about a place, and say so by not setting it.

`/api/my/tasks` answers four ways a task is yours, all bounded by the same
row-level security: `assigned` reads the assignees, `created` the author,
`subscribed` your subscriptions (creating or commenting on a task subscribes
you), and `activity` your own actions on tasks, most recent first. Every row
is `{ id, number, title, due_on, completed_at, project_id, project_name,
project_key }`, plus the `icon` and `color` of the list it is in — the mark is a fact about the row
rather than about the screen drawing it.
An unknown `tab` is `400 invalid`. The list stops at 200 rows and has no
cursor yet. A task in an archived project is on
nobody's list until the project is brought back.

## Your own server

Only on the community edition
(`edition.instance`); on the service every path below answers **404**,
sign-up is open, and nobody is an instance owner.

**An instance owner is not a role.** They are rows in `instance_owner`;
whether anybody may sign up is `instance_setting.sign_up_open` (one row,
false), and `instance_applicant` holds accounts that signed up and have not
confirmed their address. None is readable or writable by the application
role (RLS on, no policy, nothing granted). The rules are on only where
`instance_setting.community` is set, which the community edition does after
migrating (`instance_started(owner_email)`, callable by the table owner
alone); the service never sets it. `instance_started(owner_email,
write_owner)`, without defaults: the app's start before serving passes
`write_owner` true and writes `instance_setting.owner_email` (`citext`)
from `OWNER_EMAIL` — null when it is unset or empty — and says
`owner_dropped` when that empties it on an unclaimed server; migrating
passes false and leaves it (migrations 208, 209).

- `register_owner(…, p_confirmed, p_asked default true)` raises
  `sign_up_closed` for an account asked for on a claimed server with
  sign-up closed, and for a confirmed one (a provider's) on a server never
  claimed (207); writes an unconfirmed one down as an applicant.
  `p_asked` false — the seed, scripts — is never refused and never an owner.
  Since 208, while the server is unclaimed and `owner_email` is
  set, so is an account asked for with any other address (compared as
  `citext`, so without regard to case); and since 209 the owner's own is
  made with no password, and `POST /auth/register` mails it a reset link
  that confirms and sets one.
- A trigger on `app_user` (`instance_confirming`), when an applicant's
  `email_verified_at` is set by any path, claims a server never claimed, or
  on a claimed one lets it in while sign-up is open or an invitation waits
  for the address, and otherwise raises `sign_up_closed`. On a server never
  claimed with `owner_email` set, it raises `sign_up_closed` for any other
  address, which stays unconfirmed (208). When it claims and the same
  update does not set the password, the password goes — since 212 by
  `app_user_proved`, below, for every confirmation, not only a claim.
- **An unproved address** (`auth_email_confirmed` false) is a member of the workspace it joined and no more: `can()` reads an owner's role as a member's and refuses `NEVER_UNPROVED` — `workspace.create` (`POST /api/workspaces`), `workspace.enter` (`/api/workspaces/:id/enter` into any workspace but the session's), inviting, roles, tokens, agents, the audit, feedback pages, billing, transfer and deletion. Any `403 forbidden` answered to such a session is worded `403 email_unverified`. Migration 212 deleted the provider identities, linked GitHub accounts (`github_person`), recovery codes and second-factor secrets of every unconfirmed account, ended its refresh sessions and revoked its API tokens, and in every workspace whose owner is unconfirmed revoked the open invitations (`deleted_at`) and switched webhooks off (`enabled = false`, rows kept); members and content were left. `/api/github/me/start` and `POST /api/github/me` answer `403 email_unverified` to an unproved address, and `app_user_proved`, `auth_claim_email` and `auth_set_password` (for an unproved account) delete `github_person`. `POST /api/workspace/transfer` to a member whose address is unproved is `409 unconfirmed`. Password sign-in and a refresh whose workspace is gone land in a workspace the person owns first, as `firstWorkspace` does. and a provider sign-in found on one is refused unless the provider vouches for the account's own address (`auth_claim_email`). `firstWorkspace` prefers a workspace the person owns.
- A trigger on `app_user` (`app_user_proved`, migration 212), when
  `email_verified_at` goes from null to a time by any path and the same
  update does not set `password_hash`: clears `password_hash`, the second
  factor and recovery codes, ends refresh sessions, revokes API tokens,
  deletes pushes and provider identities, and spends every open ticket. A
  reset by mailed link (`auth_set_password`) sets the password in the same
  update and keeps it.
- A trigger on `instance_owner` (`instance_owner_stays`) refuses to delete
  the last owner, under the settings row's lock; `delete_my_account` asks
  the same (`last_instance_owner`); `purge_orphan_actors` passes over owners.
- `delete_workspace` refuses with `last_instance_owner` (`409` from
  `POST /api/workspace/delete`, dry or not) when the server has an owner
  who can sign in — confirmed, with a live membership in a live workspace
  (`instance_usable_owners`) — and would have none after; 178's body is
  `workspace_deletion`, callable only through it.
- `is_instance_owner`, `instance_read`, `instance_set_sign_up`,
  `instance_add_owner` (`unconfirmed` for an address not confirmed:
  `409 unconfirmed`), `instance_remove_owner` ask `is_instance_owner()`
  themselves. `instance_claimed()` says whether anybody owns the server
  yet, and nothing about who (208). `instance_community()` says whether the flag is set; the
  community edition sets it after migrating and again before serving
  (`edition.ready`), and takes it unset as sign-up closed. `instance_name_owner(email, reset_hash)` — the table owner's alone, as
  `pnpm --filter @tracker/server instance:owner <email> [--yes]` (in the
  image, `node --conditions=compiled server/dist/instanceOwner.js <email>`)
  — names an owner and confirms that account's address, so a server with no
  mail can be claimed (migrations 205, 206). It also clears the account's
  `password_hash`, ends its refresh sessions, API tokens, pushes and
  provider identities, spends its open tickets, and stores `reset_hash` as
  a `reset` ticket for an hour; the command prints that link to the
  terminal, and `POST /auth/password/reset` takes it. Raises `not_community`
  on the service's database, `dev_account` for `dev@example.com`,
  `instance_claimed` on a claimed server with an owner who can sign in, and
  `not_asked` on an unclaimed one for an account that is not an applicant
  — unless it is the account at `owner_email` (209).
  Null when no account has the address.

**Closed sign-up** refuses `POST /auth/register` (`403 sign_up_closed`), a
new account through Google, Apple or GitHub (`/signin?oauth=closed`), and
the confirmation of an applicant's address (`POST /auth/verify`,
`POST /auth/password/reset`: `403 sign_up_closed`). Accepting an invitation
still makes an account, with a password or a provider. **A server nobody
owns yet** refuses Google, Apple, GitHub and its own OpenID Connect
provider the same way — a new account through one (`/signin?oauth=closed`),
or one vouching for an applicant's address — while the email form stays
open: only the mailed link or `instance_name_owner` claims it (migration
207), and `GET /auth/providers` answers `google`, `apple`, `github` and
`oidc` false, the page's
`tuff-providers` meta empty, so no button is drawn for them. **With
`OWNER_EMAIL` set**, a server nobody owns refuses every other address at
`POST /auth/register` and at the confirmation of an applicant's address
(`403 sign_up_closed`, the answer closed sign-up gives): only that address,
in any case, signs up and claims it. Unset or empty, the first confirmed
sign-up claims it, as before (migration 208) — **unless a setup token is
armed** (below, migration 301): then sign-up is closed (`sign_up: false`,
`403 sign_up_closed`) and no confirmation claims it, and only the setup
link does. `instance_name_owner` is not
narrowed by it. `/api/me` lists
`instance` among `can` for an owner and nobody else; never through a token,
never for an agent. Everybody else gets 404. `instance` is refused as a
project's slug: the page is `/:ws/instance`. Adding an owner by email says
whether the address has an account here — an owner's to know.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/instance` | `instance`; `Instance`: `{ sign_up_open, owners: [{ actor_id, name, email, added_at }], mail, mail_setup, version }` — `mail` whether letters leave the server or only reach its log; `mail_setup` a `MailSetup` (below), never a password or key; `version` a `ServerVersion` (below). Every path that answers `Instance` carries `mail_setup` and `version` |
| PUT | `/api/instance/mail` | `instance`; never through a token; `{ mail, password?, code? }` — `mail` a mail setting (below), and the proof handing a workspace over asks: the password, the authenticator's `code` when a factor is on, or for an account with neither the `code` from `/api/me/inbox-code` `{ for: 'mail' }`. `403 not_them \| totp_required`, counted as every door that asks the password again (ten a quarter of an hour, then `429`); then → `Instance`; `409 mail_from_env` while the environment sends; `400` with the field's code. The setup screen's `PUT /auth/setup/mail` asks no proof: the token is it |
| DELETE | `/api/instance/mail` | `instance`; `{ password?, code? }`, the same proof → disconnects the saved mail → `Instance`; `409 mail_from_env` while the environment sends |
| PATCH | `/api/instance` | `instance`; `{ sign_up_open }` → `Instance` |
| POST | `/api/instance/owners` | `instance`; `{ email }` — an account that exists; `201` with `Instance` when added, `200` when it already was one, `404 not_found` when no account has the address, `409 unconfirmed` when its address is not confirmed |
| DELETE | `/api/instance/owners/:actorId` | `instance`; `Instance`, or `204` when you took yourself off; `409 last_owner` for the last; removals are taken one at a time, so two owners removing each other leave one |
| POST | `/api/instance/test-letter` | `instance`; a letter to the caller's own address and nobody else's → `InstanceLetter` `{ sent, mail }`; five a quarter of an hour (`429`) |
| DELETE | `/api/instance/update` | `instance`; dismisses the notice of the last update (`ServerVersion.updated`, below) for every owner → `Instance`. The backup it named is not touched |

**Mail set up from the screen** (migration 301). `instance_mail` holds one row: `via` (`smtp` or
`resend`), `smtp_host`, `smtp_port` (25, 465, 587 or 2525 only),
`smtp_security` (`tls`, `starttls`, `none`), `smtp_user`, the SMTP password
and the Resend key **sealed** (`smtp_password_enc`, `resend_key_enc` — the
`mail` sealing of `auth/seal.ts`, under `ENCRYPTION_KEY` when it is set,
moved by `reseal`), and `sender`. Row-level security on, nothing granted:
written only through `instance_mail_write` and `instance_mail_clear`, which
let an owner of the server or the setup token while nobody owns it, and
read only through `instance_mail_sealed()`, which the application and the
worker open to send with. `SMTP_URL` or `RESEND_API_KEY` in the environment
wins over it.

A mail setting is `{ via: 'smtp', host, port, security, user?, password?,
sender }` or `{ via: 'resend', key?, sender }`. A secret left out keeps the
saved one — the SMTP password only for the same host and user
(`400 secret_needed` otherwise). Refused with `400`: `bad_host` (a URL, a
port, a link-local or metadata address), `bad_port`, `plain_not_allowed`
(`none` with a user or password, or to a host that is not on this machine
or its own network), `bad_sender`, `bad_key`, `unknown_host` (the name does
not resolve) and `private_host` (any address it resolves to is private,
loopback, link-local, CGNAT or IPv6 unique local — allowed only with
`SMTP_ALLOW_PRIVATE=1`, and link-local and metadata addresses never). The
same check runs again for every letter, and the connection goes to the
address checked.

`MailSetup`: `{ source, via, host, port, security, user, secret_set,
sender }` — `source` `env`, `saved` or null; `secret_set` whether a
password or key is set, never the thing itself.

**The setup link** (migration 301).
`SETUP_TOKEN` in the environment (32 to 256 letters, digits, `-` and `_`;
anything else stops the start) is told to the database by the serving
start as its SHA-256 (`instance_setup_armed`, the table owner's alone,
`instance_setting.setup_token_hash`). Every path below carries the token in
`x-setup-token`; it is compared in constant time and its hash again in the
database. On the service, and on a server of one's own without
`SETUP_TOKEN`, none of them exists (the answer an unknown address gets).
`403 bad_token` for a wrong or missing token, counted per address — ten a
quarter of an hour, then `429`; `410 setup_done` once the server has an
owner, by any path. The page the server sends carries `<meta
name="tuff-setup" content="open">` while the server is armed and
unclaimed, and `<meta name="tuff-mail" content="off">` on a server of one's
own with no mail.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/auth/setup` | `SetupState`: `{ owner_email, mail_setup }` |
| PUT | `/auth/setup/mail` | a mail setting → `SetupMail` `{ mail_setup }`; as `PUT /api/instance/mail` |
| DELETE | `/auth/setup/mail` | → `SetupMail` |
| POST | `/auth/setup/mail/test` | `{ to }` → `{ sent, mail }`; five a quarter of an hour from one address |
| POST | `/auth/setup/owner` | `{ name, email, password }` (twelve characters or more) → `201` `Session`. `instance_setup_owner`, under the settings row's lock: the account made confirmed with its workspace, or — an address that has one — taken back with this password, its address confirmed and every other way in gone; made an owner; the server claimed and the token's hash cleared. `403 owner_email` for an address other than `OWNER_EMAIL`, `403 dev_account` for `dev@example.com` |

**A newer release** (migration 213). Once a day the community
edition's worker asks `GET https://api.github.com/repos/usetuff/tuff/releases/latest`
— no token, `User-Agent: Tuff/<version>` and nothing else about the server,
ten seconds at most, failures ignored — unless `UPDATE_CHECK=off`, and never
from a build at `0.0.0`. It keeps the answer on `instance_setting`
(`release_version`, `release_url`, `release_published_at`,
`release_security`, `release_checked_at`), written only through the worker's
`instance_release_heard` and read only through `instance_release()`, which
answers an instance owner and nobody else. The service never asks and never
reads it. `ServerVersion` is:

`{ current, commit, check, latest: { version, url, published_at, security } | null, updated: ServerUpdate | null }`

— `current` the running `VERSION` (`0.0.0` before any release), `commit`
seven characters or `unknown`, `check` false with `UPDATE_CHECK=off`,
`latest` the release heard of while it is newer than `current` by semver
(numbers part by part; never at `0.0.0`, never when the server is newer),
`url` its release notes on `github.com/usetuff/tuff/releases/…` (the
database refuses anything else), `security` whether its notes have a
`### Security` section. `GET /api/me` carries the same object as `server`
for an instance owner — the bar marks a security release on their face —
and has no `server` key at all for anybody else, or on the service.

**After an update** (migration 302). On a server of one's own the
migrating start dumps the database before it applies anything pending
(`pg_dump --format=custom` into `BACKUP_DIR`, `/backups` in the image), once
per update, and does not start when a dump into a volume fails; the service
never dumps (`docs/self-hosting.md`, "Backups"). The migrations themselves
take a session lock (asked for, for up to half an hour) and wait ten
seconds at most for any other lock; on a server of one's own, on a
database migrated before, they go in one transaction unless one of them
cannot — the service migrates one file at a time. What the update did is kept on
`instance_setting` — `ran_version` and `ran_at` (the version the last
serving start ran, and when), `update_from`, `update_to`, `update_at`,
`update_backup`, `update_no_backup`, `update_migrations` — written as the table owner by
`instance_migrated` (after migrating) and `instance_ran` (every serving
start: a changed version with nothing to migrate is an update too), read
through `instance_update()`, which answers an instance owner and nobody
else, and cleared through `instance_update_dismiss()`. `ServerUpdate` is:

`{ from: string | null, to, at, backup: string | null, no_backup: 'skipped' | 'no_folder' | 'not_a_volume' | 'postgres_newer' | null, migrations, notes: string | null }`

— `from` the version that ran before (null when not known: the first
update to a release that remembers it), `to` the version since, `backup`
the dump's path inside the app's container (null when none was taken),
`no_backup` why migrations ran without one — `SKIP_PRE_MIGRATION_BACKUP`
set, no `BACKUP_DIR`, a `BACKUP_DIR` that is not a mount point, or a
Postgres newer than the image's `pg_dump` (null when one was taken, or
nothing migrated), `migrations` how many were applied, `notes`
`https://github.com/usetuff/tuff/releases/tag/v<to>` for a released `to`
and null at `0.0.0`. Null once an owner dismisses it
(`DELETE /api/instance/update`); a later update replaces it.

## Projects

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/projects` | membership; cursor paged; each row carries `can` for that project, and `sample` |
| POST | `/api/projects` | `project.create`; `template?: launch \| client \| sprint` makes its first tasks too — on the maker, the first in Todo and the rest in Backlog, subscribed — its document, and its mark; one feed line, the project's. `mark_icon?`, `mark_tint?` set the mark it is made with, over the template's. The plans are `PROJECT_TEMPLATES` in `shared-schema` |
| POST | `/api/projects/sample` | `project.create`, never through a token; a sample to look around in — `201` made, its maker holding every right on it, or `200` and the workspace's existing one with the asker put on it holding the ordinary two (`join_sample`, migration 322). One per workspace. Nothing in it is on anybody, it is left out of `/api/my/tasks`, and making it writes no feed lines, notifications or subscriptions |
| DELETE | `/api/projects/:id/sample` | on the project, never through a token; the sample out for good at once, through `purge_project_rows` like Delete for good (`drop_sample`) — `404` for a project that is not one. A sample never has a repository to take with it: `PUT /api/projects/:id/github` refuses one |
| GET | `/api/projects/:id` | membership; returns `can` — what the caller may do **in this project**, which `/api/me` cannot answer — and `for_agents`, the project's instructions for agents: `{ id, number, name }` of the one written document marked so, or `null` (absent from a server before migration 310) |
| PATCH | `/api/projects/:id` | membership; `project.tools` to change the tools |
| POST | `/api/projects/:id/archive` | `project.archive` |
| GET | `/api/projects/:id/members` | membership; `{ members: PersonInProject[] }`, people first, agents after; an agent carries `agent: true`, `active_at`, `status` and `connected_by_name` — whose agent it is, the name of whoever connected it (null when not known), which the panel choosing a document's people says under its name |
| POST | `/api/projects/:id/members` | `project.member.add`, from people already in the workspace; `rights` defaults to what joining grants |
| PATCH | `/api/projects/:id/members/:actorId` | whoever runs it; `{ rights }` — never on yourself or an owner |
| DELETE | `/api/projects/:id/members/:actorId` | `project.member.remove` — the owner (on the project or not) and whoever runs it; never through a token or by an agent. `403 forbidden` without it; `404` when nobody was taken off — somebody not on the project, or a project that is not there. A member who may add and does not run the project is refused, not answered `200` with nobody removed. **With your own id it is leaving**: `project.leave`, anybody on the project's list of people, holding nothing there; never through a token or by an agent; the feed says `project.leave`. The row's policy says the same (`pm_leave`, and `pm_leave_only`, which lets the leaver change nothing but when their row ended — migration 182) |
| GET | `/api/projects/:id/at/:number` | membership; what that number is in this project: `{ id, kind }`; `?kind=` picks the counter |

**`project.key`** is what a sentence calls it: two to five upper-case
letters, unique in its workspace, made by a trigger from the same name —
`WEB`, `STU`, `ACM`. With the object's number after it that is `STU-41`, the
handle people say out loud, paste into a message and type into the palette.
It is not in the address: the address already names the project, and the
number after the key is the same number the address carries, so the two
cannot disagree about which object.

**`project.slug`** is what the address calls it: unique in its workspace,
filled from the name by a trigger when nothing supplies one — chosen, like
the key, against every project in the workspace, those in the bin and those
the maker is not on included, so a name taken by one of them steps aside to
`website-2` and `WEB2` rather than failing (migration 100) — and **stable** —
renaming a project does not move it. A slug worked out from the name every
time it is read is not an address but a rendering of a name, and every link
anybody sent would break the first time somebody fixed a typo in a title. Nine
names are refused, because they are the app's own screens at that level:
`notifications`, `members`, `chat`, `settings`, `search`, `projects`, `more`
(a phone's More tab), `admin` (the product's
admin) and `account` (a person's own settings
). The
check is in the database, because the seed and the import write projects
without going through an endpoint.

**`number`** on a task, a post and a document is what the address calls it
inside its project — `/studio/website/tasks/41`. Tasks are numbered on their
own counter, posts and files on a shared one, so 41 can be a task and a
document both; `GET /api/projects/:id/at/41?kind=task|post|file` says which
object carries it, and without `kind` a task answers first. A counter and not
`max(number) + 1`, because that hands the same number out twice as soon as
something is thrown away — and a number that comes back is an old link
opening a new object.

Creating a project puts its creator on it and opens the team's channel. A
project its creator cannot see is not a safer default, it is a broken one; a
conversation that has to be switched on per project is one nobody has.

An owner sees every project without joining it. The alternative default is
an owner who must add themselves to everything, which is
worse than what it guards against.

`GET /api/projects` returns the live ones. `?archived=true` returns the
archived ones instead, never mixed in — a sidebar that still lists what you
archived is a sidebar that grows forever, and the button appears to do
nothing.

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/projects/:id/archive` | `project.archive` |
| POST | `/api/projects/:id/unarchive` | `project.archive` |
| DELETE | `/api/projects/:id` | `project.archive`, soft |
| GET | `/api/projects/deleted` | `project.archive`; what is in the bin |
| POST | `/api/projects/:id/restore` | `project.archive`; takes it back out |
| DELETE | `/api/projects/:id/forever` | the workspace's owner; a project already in the bin, gone for good |

Archiving and deleting are **one permission**, because the permission matrix has
one row for both. Both are a timestamp on one row and both are reversible
until a scheduled clear-out, so neither asks twice. `project.archive` is a
hard stop through a token: the design names deletion among the side effects a
tool may not have.

Reversible had to be made true. Row-level security hides a deleted project
from everybody, which is correct everywhere except on the one screen whose
job is to list them, so the bin reads through the definer functions
`deleted_projects(workspace)` and `restore_project(workspace, id)` — both
scoped to the caller's workspace, with the permission checked in the handler
before either is called. `/api/projects/deleted` is declared **before**
`/api/projects/:id`, or the id route swallows it.

**For good** is the one act here that cannot be taken back, so it is the
owner's alone — `role_in(workspace) = 'owner'`, decided inside
`purge_project(id)` rather than by `project.archive`, which whoever runs the
project holds too —
never through a token, and only for a project already in the bin: `404` for
anything else, a live project included, so the bin is the one way to it.
It takes the project and everything it held, children first and whatever
pointed at them by id (`purge_project_rows`): tasks and their parts, lists,
cycles, labels, posts, files, rooms and their messages, comments, hours,
activity, members, watches, notifications, links, sidebar places — and,
since migration 318, its GitHub rows: `github_pull_task`, `github_comment`,
`github_issue`, `github_pull`, `github_out` and every `github_link`, an
unlinked one (`deleted_at` set) included; the workspace's `github_install`
stays, and nothing is sent to GitHub. Before 318 a project that had ever
had a repository linked could not go: `DELETE /api/projects/:id/forever`
answered `400 invalid` (the foreign key, 23503) and the clear-out passed it
over. The answers are as they were — `200 { ok }`, `403`, `404`. It leaves a
`project.purged` line in the security log, which outlives the project; the
feed went with it. `docs/specs/projects-index.md`.

Every foreign key that points at the project, or at a row that goes with
it, either cascades or sets null, or comes from a table
`purge_project_rows` deletes by name — asserted against `pg_constraint` by
`server/test/purge.test.ts`, so a new table naming a project with a plain
foreign key fails the tests rather than making projects nobody can delete.

Delete sample (`DELETE /api/projects/:id/sample`, `drop_sample`) is the
function's third caller, on a live sample, which is never given a
repository.

The thirty-day clear-out does the same, through the same function, to a
project in the bin past its days. It used to delete the project row
alone, which its tasks held on to — and meeting a row it could not remove,
`purge_deleted` gave up on every other table as well. A project that
cannot go is passed over with a database warning, and the run goes on to
the next; the worker prints warnings (it used to discard every notice).
What it says every hour regardless — rows past their days that something
live still names — is a notice since 318, and not printed.

### Watching a task

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/tasks/:id/subscription` | membership; start watching |
| DELETE | `/api/tasks/:id/subscription` | membership; stop |
| POST | `/api/posts/:id/subscription` | membership; start following an announcement — `404` for one the asker cannot see. As the task's: idempotent and soft. `GET /api/posts/:id` carries `post.subscribed` |
| DELETE | `/api/posts/:id/subscription` | membership; stop — `ok` whatever. Commenting again follows it again, as a task |
| POST | `/api/files/:id/subscription` | membership; start following a document, upload or link — `404` for one the asker cannot see. `GET /api/files/:id` carries `file.subscribed` |
| DELETE | `/api/files/:id/subscription` | membership; stop — `ok` whatever |

Both idempotent: the caller is asking for a state rather than performing an
act, so subscribing twice is subscribed once and unsubscribing from something
you are not watching is `ok` rather than `404`. Soft, like everything else —
and because the unique index is partial on `deleted_at is null`, coming back
revives the row rather than inserting a second one the index would refuse.

### Remind me

| Method | Path | Action |
| --- | --- | --- |
| PUT | `/api/tasks/:id/reminder` | `task.remind`; `{ at }` or `{ preset }` — set your reminder on it, or move it |
| DELETE | `/api/tasks/:id/reminder` | `task.remind`; clear yours |

A reminder is one person's, one per task: a moment they chose, when they get
a `reminder` note and a push that open the task. `at` is an ISO time; with
an offset it is that instant, and with none (`2026-11-20T15:00`) it is read
on the clock of the zone the account keeps (`app_user.timezone`, the zone of
the due-date reminder). `preset` is `later_today` (three hours from now, to
the nearest hour), `tomorrow` (9:00) or `next_week` (Monday, 9:00; from a Sunday the Monday after, never the same moment as `tomorrow`), in that
zone too. A time that has passed, a day that does not exist or one more than
five years away is `400 invalid`, and so is a new one past the 500 a person
may have waiting (moving one already set is never refused). Leaving a
workspace — or the account being deleted — takes that person's reminders
there with it. `PUT` answers `{ reminder: { at } }`
(`TaskReminderSet`), `at` always an instant in UTC. `DELETE` is `ok` when
there was none, as unsubscribing is. A task the caller cannot see is `404`
for both. `task.remind` is anybody's who can see the task, through a token
too, and never an agent's (it has no bell of its own), a board's link's or a
feedback page's.

`GET /api/tasks/:id` answers `my_reminder: { at } | null` beside
`subscribed`, and `GET /api/my/tasks` `reminder_at` on each row: **yours**,
and nobody else's is ever said. Nothing about a reminder reaches the
activity feed or a webhook.

Kept in `task_reminder` (migration 203): workspace, task, person, `at`, one
row per task and person, under a policy that is `actor_id =
current_actor()` and the workspace — and, to write one, a task the writer
can see. The worker claims what has come every twenty seconds with
`claim_task_reminders(limit)`, a definer function only the worker's role may
call, which deletes the rows it returns (`for update skip locked`, so two
workers send each once). Each is then asked as its person: a task deleted,
in a deleted project, finished, or no longer theirs to see is sent nothing.
Either way the row is gone. Quiet hours do not hold a reminder — its moment
was chosen.

### Blocked by

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/tasks/:id/blocked-by` | edit `:id`; `{ task_id }` — `:id` now waits on `task_id` |
| DELETE | `/api/tasks/:id/blocked-by/:blockerId` | edit `:id`; it no longer waits on it |

A task can wait on another; the other **blocks** it. A field on Task kept in
`task_block` (migration 224): workspace, `task_id` (the one that waits),
`blocker_id`, `created_by`, `created_at`, one row per pair. Not an entity: no
address, no body.

Changing what a task waits on is editing that task (`mayEdit`, the right
that changes its date); the blocker need only be readable. A relation is
visible only to somebody who can read **both** tasks — the table's own
policy — so for anybody else it is not listed, marks nothing, and both
endpoints answer `404`, the same as for a task that does not exist. Across
projects in a workspace, yes; across workspaces, never.

`POST` answers `201 { blocker }` (`BlockerAdded`, the blocker as a
`TaskRelated`), or `200` with the same when it was already there. `400` for
the task itself or past fifty blockers; `409 cycle` when the blocker
already waits, however far round, on the task. The loop is found by a
trigger over every relation in the workspace, readable or not, and the
refusal names nothing. `DELETE` answers `{ ok: true }`, also when there was
no such row. `403` for both when the caller may not edit `:id`.

`GET /api/tasks/:id` answers `task.blocked_by` and `task.blocks`: lists of
`TaskRelated` — `{ id, number, title, project_id, project_key,
project_slug, completed_at, list_icon, list_color }` — readable ones only,
oldest relation first. `GET /api/projects/:id/tasks` answers `waiting_on` on
each row: the handles (`RED-12`) of its blockers that are open, not deleted
and readable. A deleted task keeps its rows, holds nothing up while deleted,
and has them back on restore; the clear-out removes them with it. Copying
and duplicating carry none.

When a task goes from open to finished — a move into a finishing list,
`completed: true`, a sub-task's tick — every open task for which it was the
**last** open blocker tells its assignees: reason `unblocked`, kind
`unblocked`, about the task that waited, `what` *RED-12 is done — you can
start RED-14*. Only to assignees who may read both tasks, never to whoever
finished it, never held or merged. Nothing reaches the activity feed or a
webhook; the screens watching either project are told to read again.

`completed` on a task in a list is a move, not a stamp:
`true` takes it to the project's first finishing list marked done (Canceled
only when there is no other), `false` back to the first open one — the one
marked `open`, else the first that does not finish and is not the intake.
A `list_id` sent beside it wins. A part has no list of its own and keeps its
tick, and a project with no finishing list keeps the stamp alone. It wrote
only the stamp before, which left a task finished in Backlog.

A `PATCH /api/tasks/:id` that finishes or reopens the task also answers
`rewaits` (`TaskChanged`): the tasks it blocks that the caller can read, at
most 200, each `{ id, waiting_on }` as it stands after the change, so the
screen that moved it puts their marks right without reading the project
again. Empty when nothing changed state. Beside `next` and `withdrawn` of a
repeating task, not instead of them.

`GET /api/tasks/:id/prompt` answers `{ text }`: the task as Markdown for an
agent — facts, description, sub-tasks, comments, and its files as links that
open without signing in for an hour.

`GET /api/tasks/:id` answers its task with `ancestors`: the tasks it is inside,
outermost first, as `{ id, number, title }` — one for a part, none for a task
of its own.

`GET /api/tasks/:id/card` is a task as a card: `{ card: { id, number, title,
project_id, project_key, project_slug, project_name, list_name, list_icon,
list_color, completed_at, created_at, decided_at, due_on, priority,
assignee_id, assignee_name, assignee_avatar_url, assignees, cycle_name, labels } }` (`TaskCard` in the generated types) — what a message naming the task draws under itself.
404 for a task the reader may not see, as everywhere.

`GET /api/tasks/:id` also answers with `sizes`: `{ [fileId]: bytes }` for the
same files, and `GET /api/files/:id/url` with `size` — so a file whose body
did not record its size still says it.

`GET /api/tasks/:id` answers `working`: the agents saying they are at it
now (`AgentStatus`, as `GET /api/working` has them), empty when none is.

**A picture's copy for showing.** `POST /api/files/:id/display`, multipart
`file`: a JPEG or WebP of the same picture, no more than 1600 pixels on its
long side and 2 MB, made by the client that uploaded the original — only
its uploader may add one, only to a picture, and the bytes are checked
(400 otherwise, 403 for somebody else's). It is stored beside the original
(`file.display_key`, `file.display_bytes`, counted against the workspace's
storage) and is not a row of its own in Docs. `GET /api/files/:id/url`
answers `display_url` (null when there is none) beside `url`, and
`GET /api/tasks/:id` answers `displays: { [fileId]: url }` beside `files`.
Draw the display copy in a body; open and save the original.

`GET /api/tasks/:id` also answers with `files`: `{ [fileId]: url }`, a signed
link (good for one to two hours) for every file its body and its comments
hold, so a client draws the pictures without asking for each link.

`GET /api/tasks/:id` answers with `subscribed`, **whether you are**, and that
is the only answer a reader gets. The policy on `subscription` is
`actor_id = current_actor()` for select, insert and update, which is why
`notify.ts` goes through the `subscribers` definer function to find out who to
tell. There is no endpoint that lists who is watching, deliberately: who it is
assigned to is the work and who is quietly reading it is somebody's attention.

Subscriptions are also made without being asked for, and that has not changed:
creating a task, a post or a document subscribes its author, and commenting on
one subscribes the commenter. That is what makes the inbox useful without a
setting; what was missing was any way to say so, or to stop.

### A project's picture

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/projects/:id/icon` | membership; multipart, one image — a PNG, JPEG, GIF or WebP by its bytes, else `400 invalid` |
| DELETE | `/api/projects/:id/icon` | membership; back to the generated mark |

`project.icon_key` is a storage key, not a url: the bytes live where every
other upload lives, behind the same signed links, so a project's image is not
the one thing in the product that can be read by guessing a name. Lists
return `icon_url` signed for an hour.

With no key the client draws a mark derived from the project id — a hue and a
shape from a hash. It is derived from the id rather than the name so two
projects that start with the same letters do not get the same picture, which
is the failure initials have. It is the default, not a placeholder.

### A project's mark

`project.mark_icon` and `project.mark_tint` are what was chosen, and both are
nullable — null means "whatever the id says", so nothing is backfilled and a
project nobody touches keeps the mark it has always had. They are set through
`PATCH /api/projects/:id` under `project.update`, the same permission as the
name, because it is the same fact: what this project is called and what it
looks like.

| Field | Values |
| --- | --- |
| `mark_icon` | one of `MarkIcon` — twelve names, in `shared-schema` |
| `mark_tint` | `0`–`9`, an index into the theme's ten tints |

A tint index rather than a hex, because the tints turn over with the theme: a
project holding `#ff3b30` would be the one thing on the screen not following
the dark mode it is being read in. Sending `null` for either puts that half
back to the hash.

The order a client draws them in is **picture, then chosen, then hashed** —
so dropping the picture reveals the chosen mark underneath rather than
resetting it.

## The four entities

Post, Task, File, Message. A new feature does not introduce a fifth; if it
seems to, it is a property of an existing one that has not been recognised yet.

Every one of them answers the same shape, which is why the endpoints are
boring: create in a project, read by id with its comments, patch, soft delete,
comment. Writing four near-identical handlers is four chances to get the
visibility check subtly different, and the one that is wrong is the one facing
the client — so the shared half lives in one module.

**How much a body may weigh, and how much a read carries of them**.
A request that writes a comment or a message
(`POST /api/{tasks,posts,files}/:id/comments`, `PATCH /api/comments/:id`,
`POST /api/conversations/:id/messages`, `PATCH /api/messages/:id`, a board's
comments) carries at most **128 KB**; one that writes a task's, a step's or
an announcement's body (`POST /api/projects/:id/{tasks,posts}`,
`PATCH /api/{tasks,posts,steps}/:id`, `POST /api/tasks/:id/steps`, a board's
tasks) at most **1 MB**; a document is held to 5 MB by its shared state and
by the request. Past it: `413 too_large` with a `message` in the reader's
language, before anything is read. `GET /api/{tasks,posts,files}/:id` carries
the **newest 200 comments, and no more than 4 MB of their bodies** (one at
least), oldest first, and `comments_earlier` — a cursor, or null when all are
there; `GET /api/{tasks,posts,files}/:id/comments?before=<comments_earlier>`
answers `CommentsPage` — `{ comments, next_cursor }`, the page before it,
oldest first, the same bounds; `400 invalid` for a cursor that is not one,
`404` when the object is not readable.

| Method | Path | Action |
| --- | --- | --- |
| GET POST | `/api/projects/:id/posts` | `content.create` to write; GET answers each post whole — its `body` — with `reply_count` and not the replies; newest first, then by id, `next_cursor` `<moment in UTC>_<id>` (a bare moment from before reads to the end of its millisecond; anything else `400 invalid`). Each carries `audience`. **Drafts** (migration 320): `posts` are published ones only, the asker's own included; asked with `drafts=1`, a first page (no `cursor`) also carries `drafts` — the asker's own drafts in the project, newest first, at most fifty, each `audience: "author"` — and a client that does not ask is never given one (`PostPage`). POST with `audience: "author"` (or `publish: false`, which means the same; `publish: false` beside `audience: "project"` is `400`) keeps it its author's draft: no note, mention, push, email, feed line, socket, webhook or Slack until it is published, and `published_at` null. Left out, it is the project's and posted at once, as always. A draft asked for through a token of any kind, by an agent, an import or GitHub is `403` (`post.publish`), and the insert policy refuses one from a tool's request too (`via_tool()`, the server's `app.via_tool`); a draft with `schedule` is `400`, and `POST /api/checkins/run` copies only published check-ins |
| PUT | `/api/posts/:id/audience` | `post.publish` — its author, while they may post on the project (`content.create`); never through a token, never an agent, GitHub or an import (`403`); `404` for one the asker cannot see — every draft but their own. Body exactly `{ audience: "project" }` (anything else `400 invalid`) → `PostPublished` — `{ ok, audience: "project", published_at }`. Publishing sets `published_at` and `created_at` to the moment — its place in the list — and does what posting does, once: the `posted` notes to the project and the notes for whoever its words name now (and so the push, the email, an agent's webhook), the `post.create` line, socket, webhook and Slack — and links what its words point at now (added, never removed). Again, for one already published, `200` with nothing done. Never back to a draft: the row's trigger refuses `audience` going back to `author`, or changed by anybody but its author or through a tool (`post_audience_is_the_authors`). The post drafts spec |
| GET PATCH DELETE | `/api/posts/:id` | PATCH and DELETE: author, or `content.edit.said` (owner, `edit.any`, `manage` — not the workspace's edit switch), or — on a post an agent wrote — whoever connected that agent (`agent.created_by`) while on the post's project, the agent live in this workspace (not disconnected, `agent.deleted_at`; not stopped, `agent.stopped_at`); PATCH of somebody else's post never through a token, DELETE never through a token at all (`403`). GET's `post` carries `author_agent` (an agent wrote it), `may_edit` (what PATCH would answer) and `may_delete` (what DELETE would answer) — the web offers Edit on somebody else's only where `author_agent` and `may_edit` are both true. The posts spec. And `audience`: a draft (`author`) is read, changed and deleted by its author alone — the owner and agents included, everybody else is answered `404` (`o_read`, `o_update` on `post`, migration 320); its changes, its delete and its restore write no feed line and send nothing (`record()` keeps any line about a draft its actor's, `post_apart()`). PATCH never changes `audience` |
| POST | `/api/posts/:id/restore` | → `{ ok }`; puts a deleted announcement back with its replies — the toast's **Undo**. Whoever deleted it (`post.deleted_by`, migration 263) or whoever holds `content.edit.said` — not its author as such (`403` otherwise, and through a token); `404` when it is not deleted, already cleared out, its project deleted, or not the asker's to see. Logs `post.restore` with `meta.title`. DELETE records `deleted_by`. The undo spec |
| POST | `/api/posts/:id/comments` | `content.create`; on a draft `409 not_published`, and the row's policy refuses it (`cmt_write`, migration 320) |
| GET | `/api/{tasks,posts,files}/:id/comments?before=` | the comments a read did not carry, before `comments_earlier`; `CommentsPage` |
| GET POST | `/api/projects/:id/tasks` | open tasks first, then finished ones (`completed_at`), each in `sort_key` order; cursor paged by `o:` or `d:` and `sort_key|id` (a cursor with neither is read as among the open — older clients); a first page of up to 500 (`?limit=`); `?order=created` is newest first (`&dir=asc` oldest first), paged by `created_at|id`; `?pictures=1` adds `picture` — `{ file_id, thumb_url, width, height }`, the first picture in the description or else in its comments that the reader may open, the copy for showing signed for them, its size or nulls — to a task that has one; every task carries `excerpt`, the start of its description as plain words — its text, `@Name` for a person named, a chip's handle and title, spaces folded, at most 160 characters with `…` when cut, null when it says nothing — kept by the database beside the body (`task.excerpt`, migration 332); `?by=list` reads by list instead: every list's first `?limit=` (50, at most 200) tasks that are not parts, each list in `sort_key|id` order, then the parts of those tasks, answered as `{ tasks, lists: [{ id, total, next_cursor }] }` — `total` how many tasks the list holds, parts left out; `?list=<id>&cursor=<sort_key|id>` reads the next page of one list the same way, `{ tasks, next_cursor, total }`, `404` for a list that is not this project's or not in sight; neither takes `order=created` (`400`); index `task_top_by_list`, migration 260; POST needs `task.create` and answers `{ id, number }` |
| GET PATCH DELETE | `/api/tasks/:id` | DELETE: your own, or `task.delete`; answers `TaskDeleted` — `{ ok, next?, next_parts? }`, the next one of a series it skipped and its parts as rows of the project's list. PATCH takes `repeat` and answers `TaskChanged` — `{ ok, sort_key, next, next_parts, withdrawn, repeat, rewaits, task, parts? }`: `task` is the task after the change as a row of `GET /projects/:id/tasks?pictures=1` (`TaskInProject`), and `parts` its parts likewise when it moved to another list and took them along, so the screen that edited it puts the rows in place rather than reading the project again; see "Recurring tasks" below |
| GET | `/api/task-handles?project=&handles=` or `?conversation=&handles=` | exactly one of a project id or a conversation id (`400 invalid` for both or neither), and 1–50 handles like `ACM-41`, comma-separated; answers `{ tasks: [{ handle, id, project_id, number, key, title }] }` for the tasks among them the reader can see that every reader of the destination may read too: with `project`, the tasks of that project; with `conversation`, the tasks of its project for a project's room, and for a room outside every project the tasks every joined person in it may read (`task_visible_to_all`, migration 272). A conversation the reader cannot see is `404 not_found`. A handle of no task, or of one out of sight, is left out. What a body written as Markdown through MCP makes its chips from |
| POST | `/api/tasks/:id/comments` | |
| POST | `/api/tasks/:id/steps` | a part of that task — a task with `parent_id`, made the short way; answers `StepMade` — `{ id, task }`, the part as a row of the project's list |
| POST | `/api/tasks/:id/duplicate` | `task.create`; a copy of the plan, under the original; answers `TaskDuplicated` — `{ id, tasks }`, the copy and its parts as rows of the project's list |
| POST | `/api/tasks/:id/copy` | into a project of this workspace, this one included — `{ project_id, list_id?, dry? }` → `201 TaskCopied` (`200`, `id` and `number` null, for `dry`). The original readable (row-level security: 404 otherwise, a limited token's projects included) and `task.create` where it goes. See "Copying a task" below |
| PATCH | `/api/steps/:id` | `{ done }`, the boolean shape the checklist had; answers `StepChanged` — `{ ok, task, rewaits }`, the part as a row of the project's list and, when it changed state, the tasks it blocks as `TaskChanged` gives them |
| GET POST | `/api/projects/:id/lists` | POST needs `task.create`; GET carries `tasks`, how many are in each, `intake`, whether it is the project's triage, and `agent_id` and `agent_gone` — the agent that takes its new tasks, and whether it has since left the project or been disconnected (see "A list an agent takes") |
| POST | `/api/projects/:id/import/tasks` | `task.create` there, never through a token; `{ tasks: [{ title, body?, list_id?, assignee?, due_on?, priority?, labels?, key? }] }` (two hundred at most, sixteen megabytes) → `{ written }`; `413 too_large`, nothing written, when its bodies as documents come to more than ten times the words sent and a megabyte, or twenty megabytes; `422 too_complex`, nothing written, when a body is one the server could not read in half a second, and `503 busy` (with `Retry-After`), nothing read or written, when too much is waiting to be read already; the web app sends a page refused `413` again in halves. A list not this project's goes to the first list after Triage; `assignee` is a person on the project or the owner, by email or a name only one has, else said in the body, and nobody is added; a hundred new labels a page; one `task.import` line in the feed. 120 pages an hour a person. The csv import spec |
| PUT | `/api/projects/:id/triage` | `project.tools` there, never through a token; `{ on }` → `{ list_id }`. On, a list named Triage at the head of the project, marked `intake` (one a project, migration 161); off, its tasks go to the first list after it and it goes. With one, `POST /projects/:id/tasks` with no list puts a task made through a token — an agent's, GitHub's — in it, and anybody else's in the first list after it; a message made a task goes to it. The triage spec |
| PATCH | `/api/lists/:id` | `task.create`, including the progress position; `after` (a list id, or `null` for first) moves it in the project's order; `agent_id` (an agent on the project, or `null` for nobody; absent leaves it) needs `list.agent` — in person, never an agent or a token (`403`); an id that is not an agent on the project, or a list that finishes work, is `400 invalid`. `finishes: true` lets the agent go in the same write. Logs `list.agent` with `{ list_id, agent_id }` |
| DELETE | `/api/lists/:id?into=` | `task.delete`; `into` is a list id or `nowhere`, and is required while it holds tasks |
| GET POST | `/api/projects/:id/files` | GET answers `FilesInProject` — `{ files, next_cursor, kinds }`. Asked with `limit` (1–500, default 100) or `cursor`, a page: pinned first (the latest pin at the top), then the latest change (`updated_at`), then `id`, cursor paged by the last row's pin, change and id (opaque; `400 invalid` for anything else), only the page's pictures signed, index `file_listed` (migration 303); `kinds`, on a first page only, names which of `docs`, `images`, `uploads`, `links` hold anything the reader may see, whoever's. Asked with neither, every row, pinned first and then the newest added, with `next_cursor: null` — the whole list the apps installed before pages read, outside the response budget, kept until they page. Both take `kind=docs\|images\|uploads\|links` (a written document; an upload that is a picture; any other upload; a link — a folder is in none), `whose=mine\|others` (what the reader added, or somebody else did) and `q=` (the name, a link's address, who put it there, or the room, task or announcement it was first put in, as the row names it); a kind or whose outside those is `400 invalid`. POST with `audience: "author"` makes a written document a draft only its author sees — what the web sends for every document it makes; left out (or `"project"`), it is the project's, as before. A draft asked for through a token or by an agent, an import, GitHub, a board or a feedback page is `403` (`file.share`), and for a link or a folder `400`; uploads, links and folders are always the project's. GET lists only the rows the reader may read (`o_read`) and carries each one's `audience`. POST may start from a template — `template`: `brief`, `meeting`, `spec` or `report` (`DocTemplate`), or the id of a document saved as one that the asker can read (`404 not_found` otherwise, as for none). With one, `name` may be left out and the template's is taken; a `body` sent beside it is written after the template's blocks; `{date}` and `{project}` in its words and name are filled in — the day where its maker is, in their language, and this project's name. A built-in one is written in its maker's language. The doc templates spec |
| GET | `/api/doc-templates` | `SavedTemplates` — `{ templates: [{ id, name, project_id, project_name, template_at }] }`: the documents saved as templates in projects the asker can read (the file's own policy), newest first, a hundred at most |
| PUT | `/api/files/:id/audience` | `file.share` — the author, or whoever may edit somebody else's document (`content.edit.any`); never through a token, never an agent (`403`). `{ audience: "project" }` or `{ audience: "chosen", reader_ids: [...] }` (at most 1000) → `AudienceChanged` — `{ ok, audience, reader_ids }`. A written document of a project only (`409 not_document`; `404` for one the asker cannot see or a room's). Each chosen id is on the project's list of people — a person, or an agent on the project, which reads it through its token — or is the owner (`400 not_on_project`; a project's feedback page never; migration 289); the author is never on the list, and somebody other than the author who sends it is kept on it. Never back to `author`: chosen with nobody is its author's alone. The first change of a draft logs `file.publish`, every later one `file.access` — both with `meta.audience` and how many were `added` and `removed` (counts, never who); to the project, the line is sent as any (socket, webhooks); written while it is kept, it is its own actor's for good. Narrowed from the project, a document shared to the web comes off it (`meta.off_web`). Every co-editing socket on it is asked again at once and closed `4404` if it may no longer read. Somebody newly chosen gets a `shared` note, *… shared a document with you*. Rows: `file.audience` (`author`, `chosen`, `project`; only a written document is ever not `project`), `file_reader (workspace_id, file_id, actor_id)` — migration 278. The policies ask the share right too (`may_share_file`, `chosen_may_be`, migration 279): a `file_reader` row and a change of `audience` only from somebody who may share it, `audience` never back to `author`; somebody taken off the project or out of the workspace loses their rows; a file a document holds (`file.held_by`, written only by an upload sent `into` it and never moved — `held_by_holds`, migration 286; `origin_type`/`origin_id` are only a label) is read as its document is, asked of that one document by its key (`file_held_open`); a draft or chosen document taken by the clear-out takes its feed lines and every file it holds, for good; narrowing one, or taking somebody off its people, says `file.hidden` with its id, and each held file's, on the project's socket; a feed line written while its file was kept is its own actor's for good (`activity_event.kept`); `GET /api/files/:id` carries `loose_files`, how many files its body shows that it does not hold; whether a file is told to the socket and webhooks is `file_apart()`, asked of the row (migration 284); a task (and a part of one), comment, message or announcement naming a document the project does not have is written with that `docref`'s `title` and `number` keys taken out (`kept_documents`, whoever writes); `origin_id` is null where the document it names is not the reader's. The private docs spec |
| PUT | `/api/files/:id/for-agents` | `file.for_agents` — whoever may edit the document and runs the project (the owner, or `manage`); never through a token, never an agent (`403`). `{ for_agents: true \| false }` → `ForAgentsChanged` — `{ ok, for_agents, replaced }`. A written document of a project only (`409 not_document`; `404` for one the asker cannot see, in the bin, or a room's); marked only once the whole project reads it (`409 not_published` for a draft or a document of chosen people). One per project: marking a second takes the mark off the first in the same write, and `replaced` names it. Again is no change. Logs `file.for_agents` / `file.not_for_agents` (the one replaced with `meta.replaced_by`); the clock (`updated_at`) stays. Row: `file.for_agents`, at most one true per project (`file_for_agents_one_per_project`), only on a written document the project has, in no room and not in the bin (`file_for_agents_is_a_projects_document`); trashing, narrowing it to chosen people or moving it takes the mark off (`file_for_agents_follows`), and a restore does not put it back; a change of the mark by somebody signed in needs the owner or `manage` and is never an agent's (`file_for_agents_is_the_runners`, `may_point_agents`) — migration 310. `GET /api/files/:id` carries `for_agents` and `may_for_agents`; listed rows carry `for_agents`. `read_project`, `read_task` and `my_tasks` point agents at it (see MCP). The for agents spec |
| PUT | `/api/files/:id/template` | `{ template: true \| false }` → `TemplateChanged` — `{ ok, template_at }`. A written document only (`409 not_document`), for whoever may edit it (`content.edit.own` / `content.edit.any`, as `PATCH`); again is no change. Logs `file.template` / `file.untemplate`. `GET /api/files/:id` and listed rows carry `template_at` (migration 229) |
| GET PATCH DELETE | `/api/files/:id` | a body edit bumps the version, and the version is kept (`GET /api/files/:id/versions`); `PATCH` with `url` changes a link's address — an `http`/`https` one, on a row that is a link already (`400 invalid` for a document, an upload or `url: null`), logged as `file.update` with `meta.relinked` (`docs/specs/docs.md`, "A link's address"); a written document carries `public_token` (or null); GET carries `may_edit`, whether the reader may change it as PATCH asks, `audience`, `reader_ids` (its chosen people, empty unless `chosen`) and `may_share` (`file.share`). A draft is read by its author alone and a document of chosen people by them and its author — the owner and agents included, unless chosen: everybody else is answered `404`, as for a file that is not there (`o_read`, migration 278). `PATCH` with `mark_icon` (one of `MarkIcon`, or null) and `mark_tint` (`0`–`9`, or null) changes what a written document wears — null puts back a document's own look — for whoever may edit it, as its name; on a link or an upload `409 not_document`, and a glyph outside `MarkIcon` or a tint outside the ten `400 invalid`. Logged as `file.update` with `meta.remarked`, and not at all when nothing moved. GET, the project's listed rows and `GET /api/search`'s documents carry both (migration 276, `docs/specs/docs.md`, "A document's mark"). DELETE → `{ ok }`: a document, an upload, a link or a template, soft (`deleted_at`) — your own, or `file.delete` (the `task.delete` right, `manage`, the owner); never through a token, one's own included, nor by an agent (`403`); `404` for a file the asker cannot see or one that belongs to a room and no project. Gone at once from the project's files, search, `GET /api/doc-templates` and its public link (the token kept for a restore); its comments go with it. Logs `file.delete` with `meta.title`, which publishes on the project's socket — except for a file sent in a room with chosen people, which the project's feed and webhooks never name (as its upload). A co-editing socket's next update to it is refused (`4404`); its comments can no longer be edited or deleted. The row is listed in the project's Recently Deleted (`GET /api/projects/:id/files/deleted`) until the clear-out takes it after thirty days — or **Delete forever** (`DELETE /api/files/:id/forever`) sooner — with its bytes (`file_bytes_go_with_it`) and, since migration 262, its comments, subscriptions and links. The deleting docs spec |
| GET | `/api/files/:id/versions?cursor=&limit=` | `DocVersionPage` — `{ versions: [{ id, version, created_at, contributors: [{ actor_id, name, avatar_url }], restored_version }], next_cursor }`, a written document's kept versions newest first (`limit` 1–100, default 50; `cursor` the `next_cursor` the page before gave — opaque, the last row's deletion time and id, so a row restored or purged between pages does not end the list; `400 invalid` for anything else). Whoever may read the document; `404` for one the asker cannot see, an upload, a link or one in the bin. No bodies |
| GET | `/api/files/:id/versions/:versionId` | `DocVersionRead` — `{ version: { …DocVersion, body } }`, read-only, for whoever may read the document; `404` as the list, and for a version of another document |
| POST | `/api/files/:id/versions/:versionId/restore` | No body → `DocVersionRestored` — `{ ok, version }`. Whoever may edit the document (`content.edit.own` / `content.edit.any`, as `PATCH`; `403` for a reader), `404` as the read. The version's body merged into the shared state against what it says now, one Yjs update in the restorer's name heard live by everybody in the document, then stored as an API write: `version` and `rev` move, and a new version is kept naming the restorer, with `restored_version`. Nothing is erased. Restoring what the document already says keeps nothing and answers its version. Logs `file.update` with `meta.restored_version`. `413 too_large` past the state's 5 MB |
| POST | `/api/files/:id/restore` | → `{ ok }`; puts a deleted one back as it was — pin, public link, comments — the toast's **Undo**, and **Restore** in Recently Deleted. Whoever deleted it (`file.deleted_by`, migration 262) or whoever holds `file.delete` — not its author as such (`403` otherwise, and through a token); `404` when it is not deleted, already cleared out, its project deleted, or not the asker's to see. Logs `file.restore` |
| GET | `/api/projects/:id/files/deleted?cursor=&limit=` | `DeletedFilesPage` — `{ files: [{ id, number, name, kind, url, content_type, size_bytes, mark_icon, mark_tint, author_id, author_name, deleted_at, deleted_by, deleted_by_name, purge_at, thumb_url }], next_cursor, kept_days }`: the project's **Recently Deleted** — rows deleted in the last `kept_days` days (the server's `PURGE_AFTER_DAYS`, thirty unless a server of one's own says otherwise, the same setting the worker's clear-out reads), newest deleted first (`limit` 1–100, default 50; `cursor` the last `id` of the page before, `400 invalid` for anything not an id). Only what the asker could restore: what they deleted (`deleted_by`), or every one when they hold `file.delete` there. Read through the file's own read policy, which does not ask about `deleted_at`, so a deleted row is seen by exactly whoever could see it standing; never a room's own file. `purge_at` is `deleted_at` + `kept_days`, when the clear-out takes it. Never through a token nor by an agent (`403`); `404` for a project the asker is not on. The deleting docs spec |
| DELETE | `/api/files/:id/forever` | body **`{ confirm: "<the file's id>" }`** → `{ ok }`; takes a deleted file out for good now — **Delete forever** in Recently Deleted, after a window that names it. Without the body, or with one naming anything else, `400 confirm_required` and nothing happens: a link, a prefetch, an address parameter or a generic `DELETE` carries no body, and one sent for another file names the wrong id. A request replayed whole, body and all, by somebody holding the session would carry it — what stops that is the session and the rights, as for every write. Only a file already deleted (`404` for a standing one, one already gone, one in a deleted project, or one the asker cannot see); the same people as `POST /api/files/:id/restore` — whoever deleted it or whoever holds `file.delete` — never through a token nor by an agent (`403`). Through `purge_file(id)` (migration 281): it reads the row under the caller's own row policies (security invoker), then hands it to `purge_file_row(id)`, a definer — the application has no delete right on `file` — which asks again that the row is deleted, in the session's workspace, on a standing project, not through a token, and that the caller deleted it or holds `file.delete` there (the owner with a confirmed address, or `manage` / `task.delete` on the project), and makes the same `delete` the clear-out makes, so its bytes are queued (`file_bytes_go_with_it`), its comments, subscriptions and links go (migration 262), and its versions and co-editing state by their foreign keys; rows a leftover folder held are let go to the top level. Logs `file.purge` with `meta.title` — not for a file sent in a room with chosen people. The deleting docs spec |
| PUT | `/api/files/:id/public` | `{ public: true \| false }` → `{ token }` or `{ token: null }` — a written document only (`409 not_document`), for whoever may edit it; never turned on through a token (`403`); the pictures a shared document carries are only its own project's, never a room's (`content.edit.own` / `content.edit.any`, as `PATCH`); on again keeps the token, off forgets it; turned on only for a document the project has (`409 not_published` for a draft or one of chosen people), and `public_document()` answers for no other. Logs `file.public` / `file.private`. Listed rows carry `is_public`. The public docs spec |
| GET | `/api/public/docs/:token` | **no session**; `PublicDocument`: `{ name, body, updated_at, pictures: { [fileId]: { url, display_url } }, brand }` for a shared, standing, written document — the pictures its body names, each signed for an hour over its key alone; `404 not_found` for anything else; `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`. Read through `public_document(token)` and `public_document_files(token)`, definer functions (migration 134). `brand` is the workspace's, where it wears one, else null — and then nothing about who (`public_document_brand`, migration 323). The page is `/d/:token` |
| POST | `/api/files/:id/comments` | `content.create`. On words of a written document: `anchor` — `{ from, to }`, two encoded Yjs relative positions (base64) from a page's selection, or `{ text }`, the first stretch of one block saying exactly that — starting a thread, never with `parent_id` (`400 invalid`). The server marks the words with the thread's id (`{ type: "comment", attrs: { ids } }` in the body, as one Yjs update in the person's name, the version not moved) and keeps them as `quote`; answers `{ id, quote }`. `409 anchor_gone` when the words are not there (positions are looked for for up to a second); `400 invalid` for a stretch with no words. The selection comments spec |
| PATCH DELETE | `/api/comments/:id` | your own; somebody else's needs `content.edit.said` (owner, `edit.any`, `manage`). PATCH of somebody else's comment never through a token — an agent's, a personal or project-limited token, the owner's own — nor by GitHub or an import acting as somebody (`403 forbidden`); one's own stays a token's to change (`update_comment`). DELETE never through a personal, project-limited or agent token, one's own included, and somebody else's never by GitHub or an import (`403`); GitHub carrying a deletion made there acts as the comment's author. `404` when the comment, or the thing it is on, is not readable — a file sent in a room with chosen people hides its comments from everybody outside the room, the owner included. Row policies `cmt_read` and `cmt_update` ask for a file comment's file as well (migrations 237–238; a task's or an announcement's is as visible as its project); `cmt_update` lets through the author and who `content.edit.said` does (`may_edit_said`, migrations 236–237, an unproved owner counted a member); a comment's author, workspace, project, object and `created_at` never change (a trigger, migration 237) |
| POST | `/api/tasks/:id/comments` with `choices` | a question. `question.ask`: an agent only, where it may comment (`403` for a person or a person's token). `choices`: 2–4 `{ label (1–80), recommended? }`, at most one recommended; never with `parent_id` (`400 invalid`). `to`: up to ten person ids to ask; otherwise the people the task is given to, and when it is given to nobody but agents, whoever connected the agent. Never an agent, the asker, or somebody who cannot read the task (`may_read`); none left is `409 nobody_to_ask`. Answers `201 { id, asked }`. Each person asked gets a note `asked` (kind `asked`, *… asked you a question*, pushed, never merged); watchers hear it as a comment (*… asked a question*). Columns `comment.choices`, `asked`, `answer`, `answered_by`, `answered_at` (migration 254): only on a task comment that starts a thread; what was asked and of whom never changes, and an answer is written once (a trigger). A comment read anywhere carries them, with `answered_by_name` |
| POST | `/api/comments/:id/restore` | → `{ ok }`; puts a deleted comment back in its thread — the toast's **Undo**. Whoever deleted it (`comment.deleted_by`, migration 263) or whoever holds `content.edit.said` — not its author as such (`403` otherwise, through a token, and by GitHub or an import); `404` when it is not deleted, the task, announcement or file it is on is not standing or not readable, or it is not the asker's to see. Logs `{task,post,file}.comment.restore` — none of a comment's lines (made, edited, deleted, restored) for a file sent in a room with chosen people. A restore the row's policy (`cmt_update`) refuses, or one already made, is `404` and logs nothing. DELETE records `deleted_by`. The undo spec |
| PUT | `/api/comments/:id/answer` | `{ choice }` (the index) → `{ ok, choices, answer, answered_by, answered_by_name, answered_at }` (`QuestionAnswer`). `question.answer`: anybody who can see the task and may comment on it, never an agent and never through a token (`403`); `404` when the question is not readable; `409 not_a_question` for a comment without choices; `400 invalid` for a choice that is not one; once — a second answer, by anybody, is `409 answered` carrying the answer that stands. Through `answer_question(q, pick)`, a definer that writes the three columns and nothing else, refuses an agent, and sets `answered_by` to the asker; a trigger refuses any other write of an answer that is not the current person's own (migration 256). Reads the answerer's own `asked` notes on the task, tells the agent that asked (`mentioned`, kind `answered`), says `notification` to the others asked, and logs `task.comment.answer` with `{ comment_id, choice }` |
| GET | `/api/comments/:id/answer` | the same shape without `ok`, plus `id` and `object_id`; `answer` null until somebody answers — what `get_answer` asks |
| PUT | `/api/comments/:id/resolved` | `{ resolved: true \| false }` → `{ ok, resolved }`; an anchored thread's first comment only (`409 not_anchored`); whoever may comment on it (`content.create`), through a token too; again is no change. Logs `file.comment.resolve` / `file.comment.reopen`. Through `resolve_thread` (migration 231) |
| GET | `/api/search?q=&type=&project=` | `results: [{ type, id, number, project_id, title, created_at, snippet }]` — a document's with `mark_icon` and `mark_tint` too — and for `type=message` — asked for by name, never by leaving `type` out, so an app from before is not handed a row it cannot open — `{ type: 'message', id, conversation_id, parent_id, author_name, created_at, snippet }`: what was said in the rooms the asker may read, from three letters, newest first, through `search_messages` (migration 170). Narrowed, with `from=<actor id>`, `has=link,file`, `in=thread` and `sort=oldest` — any of them asks for messages alone, through `search_messages_by` (migration 218); words may then be left out, and `from` or `project` that is not an id is 400. The rest: a task by its handle first (`TRA-111`, `tra111`, `TRA-11` on the way to it, or the number alone), then titles, then the words inside a description, an announcement or a document, with `snippet` the piece of sentence around them (null where the title matched); the words inside from three letters — `docs/specs/palette.md`. Read through `search_tasks`, `search_posts` and `search_files`, definer functions that say in the query what the policies say — the session's workspace, `visible_projects()`, `visible_conversations()`, an announcement's draft to its author alone (migration 320) — because `ilike` is not leakproof and under row-level security no trigram index was ever used; a room's `?q=` the same way, `search_room`, which reads the room's newest twenty thousand first and older ones by their words (migration 171, `docs/specs/find.md`) and pages on the moment and the id (migration 304) |

### A link's card

`GET /api/preview?url=` reads the page an address names, by the server,
and answers `{ url, title, description, image, site }` (`LinkPreview`) from
its Open Graph tags or its `<title>`, or 422. `image` is `/api/preview/image?u=…&e=…&s=…` —
the picture through this server, signed over `v1`, its address and a date (`e`,
seconds since 1970, seven days ahead), PNG, JPEG, GIF or WebP up to 5 MB.
It needs no bearer before its date (an `<img>` sends none); past it — and,
after 4 December 2026, for an address signed before dates (`?u=…&s=…`, the
form every card sent until now keeps in its body) — only somebody signed in
is answered: a bearer, or the browser's `tracker_files` cookie, which is
sent to `/api/preview/image` as well as `/api/blob`. A signature that does
not hold, or that only a person signed in may use, is `404` to anybody
else. A bearer that is sent and does not hold is `401 unauthorized`, so an app
renews it. Counted: 600 a minute a person, 120 a machine with nobody signed
in — an IPv4 address or an IPv6 /64 (`429 rate_limited`); `cache-control: private`. `http` and `https` only; a
host resolving to a private, loopback, link-local or metadata address is
refused at the socket; redirects followed by hand, three at most; eight
seconds for the whole read, redirects included, and five idle; a redirect's
or a wrong type's body is never read and its connection is dropped at once; the first
megabyte, HTML only; kept an hour. At most 32 reads open at once in a
process and 4 for one caller: past either, `429 busy` with `retry-after: 5`,
for a card and for a picture alike, and nothing is kept of the refusal. A
body carries a kept card as a `preview` node with those attributes, drawn
under the words.

### A body is a document

Every body — a post, a task, a document, a comment, a message — is stored as
a ProseMirror document, and has been since the first migration. Nothing used
it: every screen wrote one paragraph of plain text and read it back
flattened. The editor that makes the shape true is TipTap, which has been in
`web/package.json` from the beginning and is the reason the shape is what it
is. `docs/specs/rich-text.md`.

Marks and blocks are StarterKit's: bold, italic, strike, underline, code,
code block, headings, both lists, quote, rule, hard break and link. Links are
`http` and `https` only, checked where the value is taken.

**A code block** carries its language and how it is drawn:

```json
{ "type": "codeBlock", "attrs": { "language": "typescript", "wrap": true, "lineNumbers": true },
  "content": [{ "type": "text", "text": "const a = 1" }] }
```

`language` is what a Markdown fence says (```` ```ts ````), or null for none;
a client reads any name it knows for the language and shows the rest as
written. `wrap` (long lines wrapped at the block's edge, not scrolled) and
`lineNumbers` (a number beside each line) are optional booleans, false when
absent. Markdown written out carries the language and not the two
booleans; a block an agent leaves unchanged through `update_doc` keeps them.

**A callout and a toggle** are blocks too. A
callout holds blocks under an emoji, in one of five tones; anything else in
`tone` is read as `grey`:

```json
{ "type": "callout", "attrs": { "emoji": "💡", "tone": "grey" }, "content": [{ "type": "paragraph" }] }
```

A toggle is TipTap's `details`: one line of text, and blocks folded under
it. Whether it is open is not stored — every reader draws it folded.

```json
{ "type": "details", "content": [
  { "type": "detailsSummary", "content": [{ "type": "text", "text": "More" }] },
  { "type": "detailsContent", "content": [{ "type": "paragraph" }] } ] }
```

Markdown written through a token or from GitHub makes them from GitHub's
alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
and from `<details><summary>…</summary> … </details>`; Markdown written out
(Copy as prompt, GitHub) writes them back the same way, and a callout that
is not one of the five alerts as a quote with its emoji first.

**An attachment is a node holding a file id, never a URL.**

```json
{ "type": "attachment", "attrs": { "fileId": "…", "name": "…", "kind": "image", "width": 320,
  "pixelWidth": 1600, "pixelHeight": 900 } }
```

`size` is optional: the file's bytes, said under a file's name.

`pixelWidth` and `pixelHeight` are optional: the picture's own size, read
from the file when it was put in, so a reader can keep the room for it
before its bytes arrive. A picture put in before they existed has neither.

`width` is optional: the pixels a picture was narrowed to in the editor, a
multiple of four. Absent or `null`, a picture is drawn at its own size up to
the width of the column. A client draws it no wider than its column either
way.

A blob link is signed over the key and an expiry, so a URL written into a
body would be a `403` within minutes and a broken picture for ever after. The
id does not expire; the reader asks `GET /api/files/:id/url` when it draws.

**A file's link opens only for the person it was made for.** The links in
`GET /api/files/:id/url` and a task's `files` carry `for=me` and are signed
over the reader: `/api/blob` opens them only with the reader's own
credentials — the `tracker_files` cookie, which every signed-in answer sets
(`HttpOnly`, `Path=/api/blob`, seven days, cleared by `/auth/logout`), or
the reader's bearer token, which a native client sends instead. Copied and
opened by anybody else, signed in or not, the link answers `403`. A face and
a project's mark keep plain signed links.

A link points at `/api/blob/…` or, where the deployment has one, at the
edge in front of the bucket (`FILES_URL`) — a client
treats it as an opaque URL either way, appending `&download=1&name=…` to
save rather than show, and `&name=…` alone to show it under its name —
`Content-Disposition` is then `inline` with the name, so a file the
browser cannot show is saved as itself and not as the address's last part.
Both carry the name twice: an ASCII `filename` and the real one as
`filename*=UTF-8''…`. A link is signed to the end of a whole hour at least an hour away, so it is
good for one to two hours and is **the same link** for every request inside
that hour — a client can cache bytes by URL. `GET /api/blob/:key` streams,
answers `Range: bytes=a-b` with `206` and `Content-Range` (`416` past the
end), and says `Accept-Ranges: bytes`, which a video player needs to seek
and Safari needs to play at all.

A picture or a file put into a body goes through
`POST /api/projects/:id/uploads` and becomes a **file of that project** — it
is in Docs, in search, and counted against the storage ceiling. An upload
that lived only inside one body would be a second kind of file with its own
lifetime, its own visibility question and its own clear-out: the fifth entity
wearing a hat.

**`task.assignee_ids`**, everybody it is given to, in the order they were put
on it; `[]` for nobody; at most ten, nobody twice. Sent on create or `PATCH`,
it is the whole list and replaces what was there; a person not on the project
anywhere in it refuses the write (`400`), and only the people it adds are
notified. **`task.assignee_id`** is the first of them, worked out by the
database and never written — what a client that draws one face reads. Sent,
it is the list of that one person, or `null` for nobody: what the apps that
know one person mean. `GET /api/tasks/:id/card` answers `assignees: [{ id,
name, avatar_url }]` beside the first one's `assignee_name` and
`assignee_avatar_url`.

**`POST /api/projects`** answers `{ id, name, tools, slug, key }`. Whoever
makes a project — by `POST /api/projects`, the sample, a copy
(`POST /api/projects/:id/copy`), saving a scratch board as a project, or an
import (Linear, Jira and Asana; the Trello, Asana and Basecamp import where
it is open) — is put on it holding every right (`RIGHTS_OF_ITS_MAKER`:
`manage` and the five it carries), the owner excepted: the owner holds
everything by being the owner, and their own row says the ordinary two, so
a handover leaves them running nothing they did not run before. People an
import puts on it arrive with the ordinary two. The slug
and the key are filled by the database — what is free depends on what is
already there — so answering with the id alone meant a second request before
anybody could open what they had just made.

**`task.priority`**, one of `urgent`, `high`, `medium`, `low`, or `null` for
no priority. A word and not a number: three clients read this field and the
contract is copied into repositories whose authors cannot ask what `2` meant.
The order above is the order it sorts in — it is a Postgres enum, so
`order by priority nulls last` is the whole rule — and `null` is not a fifth
level at the bottom but the absence of an answer, which is why it sorts after
the four that are answers. Absent and null are two different answers on the
patch, the same as the assignee.

**`task.due_on`**, a date or `null`, and on the patch the same two answers
again: absent leaves it, `null` clears it. It was the one nullable field
still written with `coalesce`, and a date cleared on any client came back
on the next read.

**`task.labels`**, the words on it. A label belongs to a **project** —
`GET /api/projects/:id/labels` lists the project's, each with `used` (how
many of its tasks carry it); `POST /api/projects/:id/labels { name, color? }`
makes one in that project and answers with the existing one if that name is
already taken there, so two people typing "bug" a minute apart end with one
label rather than two — and the second of them does not repaint the first
one's label; `DELETE /api/labels/:id` takes one away (soft, so the rows that
carried it stay). `GET /api/labels` still lists every label the caller can
see, each with its `project_id`. A new project starts with Bug, Feature and
Improvement. A task may carry only its own project's labels: an id from
another project is **400 `invalid`** on create, on a step and on a patch —
and a patch refused for it writes nothing else either. A task's set is written whole:
`PATCH /api/tasks/:id { labels: [id, …] }` is a statement about what is true
afterwards, not an add and a remove — two endpoints for that are two ways for
a screen and a server to disagree about a list nobody can see.

And on the way in, not only afterwards: `labels` is taken by
`POST /api/projects/:id/tasks` and by `POST /api/tasks/:id/steps`, so a
client that knows what it is making does not have to make it and then amend
it. Both took the field for a while and only the second wrote it — which
answered 201 with the labels dropped, and nothing in a response says what it
ignored.

Per project and not per workspace: each project keeps its own vocabulary
has the decision and what it gives up.

**`label.color`** is one of the ten tints the product already uses — `red`,
`orange`, `yellow`, `green`, `teal`, `blue`, `indigo`, `purple`, `pink`,
`grey` — or **null**, which is not the absence of a colour: null means the
chip works one out from the label's id, which is what every label did before
this column existed. Offered when a label is made, and in a project's
settings.

`PATCH /api/labels/:id { name?, color?, after? }` renames a label or changes its
colour — `color: null` gives it back the one its id works out. Either field
may be left out, not both. A name another label in the project already has
is **409 `taken`** rather than a merge: two labels becoming one is a decision
about every task that carries either. Needs `content.create`, as making and
removing one do.
The labels spec has the argument, including the case against letting
it be chosen at all.

`after` moves a label in its project's order — after that label, or first
when `null` — and the whole order is written again. Labels are listed in
that order (`label.sort_key`, migration 129); one with no place yet, made
before there was an order, comes after the ordered ones by name.

A workspace starts with **Bug** in red, **Feature** in blue and
**Improvement** in purple. They are ordinary rows, so the first person who
disagrees takes one away.

A task's labels come back with the task, from the list **and** from
`GET /api/tasks/:id`. The single-task read used to select the task's own
columns and nothing else, so a task showing two labels on its row showed none
when opened.

**`POST /api/tasks/:id/steps`** makes a subtask and takes what making a task
takes — title, body, list, assignee, due date, priority, labels. It took a
title alone while a part was a tick in a checklist; it is a task, so it is
made like one. Its parent's list when nothing says otherwise: a part of
something in Doing is being done.

### A task is in a list, and that is the whole of where it is

A task had a list, a board column and a free-text group. Three placements,
and the first two could disagree about the same task with no rule for which
to believe. There is one now: **`task.list_id`**, and the board draws the
project's lists as its columns.

`task.group` is gone — a column the API selected, wrote and carried in the
client type, which no screen has ever set or shown. `task.column_name` is
gone with it.

**`task_list.icon`** is the list's mark, one of six — `open`, `started`,
`doing`, `review`, `done`, `stopped` — checked by the database as well as by
the schema. It used to be worked out from the list's name, so two lists
could not differ and renaming one changed what its tasks looked like.

**`task_list.color`** is what that mark is drawn in: one of the ten tints the
product already uses for a project's tile and a person's avatar — `red`,
`orange`, `yellow`, `green`, `teal`, `blue`, `indigo`, `purple`, `pink`,
`grey` — or **null**, which is not the absence of a colour. Null means the
mark decides, which is what it always did: a stage is the accent, an ending
is grey. Named rather than hex so the palette can be retuned — it brightens
in the dark theme already — without rewriting rows.

On `PATCH /api/lists/:id`, absent leaves the colour alone and `null` gives
the mark its own back; the two are different answers, which is why this one
field is not written with `coalesce` like the rest of that row. It rides on
a task's mark wherever that is sent: `GET /api/tasks/:id` steps, and
`/api/my/tasks`.

**`task_list.finishes`** says the work in a list is finished. A project
starts with five — Backlog, Todo, In Progress, Done, Canceled — and the last
two finish; all five can be renamed, reordered, added to and deleted, and the
board follows. The set is `STARTING_LISTS` in the schema rather than in the
endpoint, because the endpoint, the seed and the demo studio each held their
own copy of it and three copies of one fact drift with nothing failing.

Cancelled work counts as finished. It is not done, but it is not open
either, and a task nobody will ever do has no business in a count of what is
left or on anybody's list of what is on them. Two endings say *why* the work
stopped, which is the only thing either of them is for.

**`task_list.narrow`** says whether a board draws the list narrowed until
somebody opens it. Only a starting point: narrowing or opening a column is
remembered by the client on the machine it was done on, and that answer
wins. True for the Canceled a new project starts with (`STARTING_LISTS`),
false for every list made since and every list that existed before it
(`072`). Carried into a copy made as a template, with the mark and colour.

### A list an agent takes

**`task_list.agent_id`** (migration 307), nullable, names one agent of the
project that takes the list's new tasks. A
top-level task made in the list with nobody on it (`POST
/api/projects/:id/tasks`, or a message made a task), or moved into it with
nobody on it by a `PATCH /api/tasks/:id` that names another `list_id` and
does not itself say `assignee_ids` or `assignee_id`, is given to that agent
as if the person had chosen it: the same `notify`, so `agent.assigned` by
webhook and the task in `my_tasks`; the chain is the maker's or mover's (0
for a person); the feed's `task.update` says `given_to`. A task that has
somebody is never given; a subtask, a copy, a duplicate and the next of a
repeating task are not either, nor tasks moved by removing a list or
turning Triage off, nor anything GitHub, an import, a board or a feedback
page made or moved.

The agent is asked what anybody given a task is — on the project now, not
disconnected — at that moment. Gone, it is kept on the list and given
nothing, and `GET /api/projects/:id/lists` answers `agent_gone: true`. A
trigger (`task_list_agent_is_an_agent`) refuses any id that is not a live
agent of the list's workspace. Both fields are optional in the schema
(`ListInProject`, `TaskList`), so an answer from before them still decodes.

### Cycles

Shown to people as **Sprint** — in the product's own screens, menus and
feed. The contract keeps `cycle`: a client should label it "Sprint" too, so
every client says the same word.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/projects/:id/cycles` | membership; newest first, with a count |
| POST | `/api/projects/:id/cycles` | `task.create`; a name and two dates |
| PATCH | `/api/cycles/:id` | `task.create`; any of the name and two dates; 400 if it would end before it starts |
| DELETE | `/api/cycles/:id` | `task.create`; soft; its tasks stay, out of any sprint |

A cycle is a named stretch of dates — "Sprint 14", 6–20 October — that a task
can be put into, and `task.cycle_id` is how it says so. Null is the ordinary
state rather than an unanswered question: most work in a product shaped like
this one is not in a sprint, so the row shows nothing when there is nothing,
the way the due date and the priority already do. One cycle, not several: a
task in two sprints is a task whose team has not decided.

A task is put into one when it is made as well as afterwards: `cycle_id` on
`POST /api/projects/:id/tasks`, a sprint of that project or `400`. It was in
the body's schema from the start and never written to the row.

Per project, like its lists, its numbering and its people. Made by hand —
there is no cadence to configure and no cycles generated in advance — and the
dates carry no rule beyond refusing a stretch that ends before it starts.
**Nothing rolls over.** A cycle whose dates have passed keeps its tasks, and
moving them is somebody deciding to move them.

This is deliberately not Linear's cycle, which is a clock tick with a
cadence, a cooldown, generated cycles and automatic rollover — five concepts
to express one, and the design cancels the Linear-shaped tracker and asks for
fewer concepts rather than fewer capabilities. The cycles spec says
what was taken and what was left.

Permission is `task.create`, because a cycle is where tasks go: somebody who
may make tasks and not the stretch to put them in can only add to somebody
else's arrangement. The same reasoning a list goes by.

The mark is one of seven — backlog, open, started, doing, review, done,
stopped — where `backlog` is the ring drawn broken. It exists because a
project now starts with Backlog and Todo, which are both before the work
begins: on one mark they would be the same picture, which is the fault the
marks were introduced to fix.

`completed_at` stays and a trigger keeps it: moving into a finishing list
stamps it, moving out clears it. The list is the control and the timestamp is
what it writes, because *when* something was finished is a fact a list cannot
hold, and because every query that asks `completed_at is null` — overdue, the
open count, the partial index behind both — goes on working untouched.

`PATCH /api/lists/:id { finishes }` moves the tasks already in that list to
match: a list that starts finishing work does so for what is in it, not only
for what arrives next.

**`DELETE /api/lists/:id` says where the work goes.** `?into=<list id>` moves
the tasks there, `?into=nowhere` leaves them with none — the tasks screen
shows those under "No list" — and a list holding anything with no `into` at
all is **`409 conflict`**, not an empty list and seven tasks nobody can find
again. `into` has to name a live list in the same project, or it is a `400`
rather than a silent "nowhere". Soft-deleted tasks are moved off it too, so
the clear-out has nothing left pointing at the row.

The list itself is a soft delete like everything else, so it comes back until
the clear-out; where its tasks were does not, which is why that is the one
question asked.

### A task can hold tasks

`task.parent_id`, pointing at another task in the same project. Not a fifth
entity and not a new kind of row: a subtask **is** a task, which is what
answers every question that would otherwise need designing — it has an
assignee, a date, comments, subscribers, a stable URL and a soft delete
because that is what a task has.

It replaces `task_step`, the checklist. Two ways to break a task into parts
is a decision with no rule behind it, so there is one.

`parent_id` is accepted on **create** and on `PATCH` (for GitHub's
sub-issues): `PATCH /api/tasks/:id { parent_id }` puts the task under
another task of the **same project** that stands on its own, or with `null`
makes it a task of its own. A parent elsewhere, unseen or deleted is `400
invalid`; a parent with a parent is `400 nested` (*A subtask can’t have
subtasks.*), a task with subtasks of its own `400 nested` (*A task with
subtasks can’t be a subtask.*), and the trigger's refusal under a race
the same answers, never a 500; a repeating task `400 invalid`; `list_id`, `after` or `completed`
in the same request `400 invalid`. Put under a task it takes its parent's
list, goes last among its subtasks and keeps `completed_at`; made a task of
its own, a finished one goes to the first finishing list and an open one
out of a finishing list, else to the top of its list. The feed's
`task.update` carries `nested_under` and `nested_from`, the parents'
numbers (null for none). `PATCH /api/steps/:id` now writes `task.update`
with `finished` or `reopened`, as finishing any task does.

Moving a task's list moves its parts with it, for the same reason they
inherit it on create.

Three rules, in triggers rather than in the endpoint, because the importer
and the seed write rows directly and a rule only the controller knows is a
rule they walk past:

- **One level.** A subtask cannot have subtasks, and a task with subtasks
  cannot become one (migration 274); the parent is read `for share`, and
  putting a task back from Trash is checked too (migration 275) — a
  subtask whose parent has meanwhile become one comes back on its own. The endpoint answers `400` rather than
  letting the constraint out as a stack trace.
- **One project.** A parent in another project is refused.
- **Deleting reaches the parts**, and undeleting brings them back. They are
  parts of it; left behind they are orphans in the list.

Completing is not contagious in either direction. Every part done and the
task still open is a real state, and a product that ticks the parent is a
product that is wrong about whether the work is finished.

A part inherits its parent's list on create, because a part somewhere else
cannot be drawn under its parent — and the list is the board's column too,
so it could not be drawn there either. On the board a part is not a card,
only a count.

`PATCH /api/files/:id` returns the new `version` rather than an
acknowledgement. It is the receipt the editor shows; without it "saved" is a
word the interface says to itself.

### A document, an upload and a link are one row

`body` is written here, `storage_key` is uploaded here, `url` is kept
elsewhere. The list returns `kind` as one of `document`, `upload`, `link`.

A link is not a fifth entity, and not only because the design refuses one: a
separate table would need its own comment, version and permission rules, and
the one that gets them subtly wrong is the one nobody is looking at.

`url` is accepted as `http` or `https` only. A `file:` or `javascript:` link
is something a colleague clicks, so the rule lives where the value is taken.

### A document written together

Two people in one document write into a shared Yjs state over
`GET /ws/docs/:id`. `body` stays what every
endpoint answers and what search, MCP, a public document and the PDF read;
it is written from the shared state a second and a half after the last
edit (at least every ten seconds while somebody types, at once when they
leave the body, and when the last of them leaves), so a read is at most
ten seconds behind the people typing.

The state is kept beside the body in `file_yjs` (migration 229): a row per
accepted update — `workspace_id`, `file_id`, `bytes`, `actor_id` — folded
into one row each time the body is written, with deleted content collected.
It is visible exactly when its file is, and gone with it. The application
selects and inserts rows; folding is `file_yjs_fold(file, rows, state)`, a
definer function for a document the caller can see, taken only in a
transaction where the server asked `mayEdit` for that file
(`app.may_edit_file`), and nothing else deletes them (migrations 233, 235).
Nothing in the API answers it; the socket is the only way to it. A
document's state stops at 5 MB encoded, measured on a copy near the cap:
past it only updates that make it smaller are taken. An update naming
items the document does not have is not kept (`reset`).

`rev` on a file is its body's revision: it moves with `version` and with
every write from the API, not with the debounced writes between.
`file_rev` keeps the body each revision began with — the last ten, at most
2 MB of them (migrations 233, 235).

**`PATCH /api/files/:id` with a `body`** merges into the shared state once
the document has one, whether or not anybody is in it. `base_rev` says the
`rev` the caller read, and the merge is against that body; without it,
against the stored body. `409 stale` when it is no longer kept or is not
the revision of a document with no shared state — with the current `rev`
and `body` beside the error. Each block the caller changed against the base
replaces the same block in the live state; what the live state already says
is not written again; a stretch the people changed too is left as they had
it and counted in `conflicts`. Blocks compare exactly, or — with
`from: "markdown"`, which MCP's `update_doc` sends — as Markdown carries
them. A merge that would take the state past 5 MB is `413 too_large`. The
answer is `{ ok, version, rev, conflicts }`. The stored `body`
is then written from the result, `version` moves as it always did, and the
pages in the document receive the change and the new version. A document
nobody has opened since this shipped has no state, and is written as
before.

`version` no longer moves on every save from the web: it moves on the
first write of a session, then at most every five minutes while people
edit, and when the last of them leaves — each time with one `file.update`
in the activity for everybody who edited since. A `PATCH` still moves it
every time.

**Each time `version` moves, the version is kept** — `file_version`
(migration 277): `workspace_id`, `id` (uuidv7), `file_id`, `version`,
`body`, `contributors` (who edited since the version before; the caller
for a `PATCH`), `restored_version`, `created_at`; keyed and indexed by
workspace first. Not kept when it says what the newest already does. The
first a document keeps is preceded by the body it had before, with no
contributors. Thinned by its own insert (`file_version_thin`, a definer):
every version of the last day, the last of each day for thirty days, the
last of each week before; at most 250, and past the newest ten only within
64 MB of bodies. Read under the session's workspace and the file's own
policies; inserted only where the server asked `mayEdit` for that file
(`app.may_edit_file`). Gone with the file (`on delete cascade`, the
clear-out).

| Frame on `/ws/docs/:id` | Direction | Meaning |
| --- | --- | --- |
| `auth <token>` | in, first | as on every socket |
| `{"t":"sync","u","sv","write"}` | out | the whole state and its state vector, base64; `write` says whether your edits are taken |
| `{"t":"u","u"}` | both | a Yjs update, base64; one over 1.4 MB of base64 closes the socket `1009` |
| `{"t":"aw","c","s"}` | both | a client's caret (`s.cursor`, `y-prosemirror`'s shape) or `null`; the server sets `s.user` to `{ id, name }` |
| `{"t":"settle"}` | in | write the body now |
| `{"t":"saved","version"}` | out | the body was written |
| `{"t":"ro"}` | out | an update was refused — a fresh `sync` with `write: false` follows |
| `{"t":"full"}` | out | an update was refused for the document's size — a fresh `sync` follows; deletions are still taken |
| `{"t":"reset"}` | out | an update named items the document does not have and was not kept — a fresh `sync` follows |

The socket is closed `4404` for a document the person cannot read (another
workspace's, an upload, one in the bin), `4401` when the session ends, and
`4429` past 150 frames of any kind in a second, or six hundred updates or
2 MB of them in ten seconds from one person into one document, across all
their sockets. A frame larger than an update and its envelope is
closed `1009` by the socket server itself. A caret is passed on only as
`{ cursor: { anchor, head } | null }`, rebuilt from relative positions,
ten a second at most; `settle` is taken from writers only. Every update is checked
with `mayEdit` against rights read no more than five seconds earlier, and
inserted as the person under row-level security.

### Uploads

A document and an uploaded file are the same row. A document has a `body`, an
upload has a `storage_key` — nothing else differs, so a comment and a
version bump work on both without a second code path. The key is never
answered: `GET /api/files/:id` says `upload: true` instead, and the bytes
are reached through `GET /api/files/:id/url`. A PNG, JPEG, GIF or WebP
upload carries `pixel_width` and `pixel_height`, read off its first bytes
when it arrived (migration 127), so whatever draws it can hold its room.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/projects/:id/uploads` | multipart, field `file`; `?into=<document id>` makes it that written document's (`file.held_by`, migration 285 — `origin_type`/`origin_id` are only the label of where it was first put), seen by whoever may see the document and told to the project only when the document is the project's — `404` for a document the asker cannot read or of another project, `400 invalid` for a folder, an upload or a link. Only `into` makes a document a file's place — nothing claims one later; no body ever changes it — such a file follows its document wherever else it is named, and a task copied into another project never takes it; a file whose document is not there is seen by its uploader alone (migration 282) |
| GET | `/api/files/:id/url` | a signed link, good for one to two hours |
| GET | `/api/file-links?ids=` | **a token only** (403 otherwise): 1–100 file ids, comma-separated; answers `{ links: [{ id, name, kind, size, url }], expires_in }` for the uploaded files among them the reader's own policies return — a file in a channel with chosen people only for its people — each `url` opening **without signing in** for up to an hour (signed for 1800 s, rounded up to the next half-hour mark); a file whose place was a message since deleted is left out, as is an id not found — neither is refused |
| GET | `/api/files/:id/content` | **a token only**: one uploaded file for an agent to look at — `{ id, name, kind, size, url, expires_in }`, and with it `content_type` and `data` (base64) for a PNG, JPEG, GIF or WebP up to 5 MB (the copy for showing when there is one; the type read from the bytes), or `kind: "text"` and `text` for a UTF-8 text file up to 200 KB; anything else the link alone. 404 for a file the reader cannot see or whose message was deleted, 400 for a document |
| GET | `/api/blob/:key?token=` | the bytes; the signature is the authorisation, and **no bearer token** |

**There are no public URLs.** The permission check happens when the link is
made, by the person asking, under their own row-level security; the link then
stands alone for five minutes, signed over key and expiry. A bucket readable
by guessing a name is how a client's documents end up indexed by a search
engine.

`/api/blob/` is the one path under `/api/` that does **not** take a bearer
token, and it has to be: it is reached by `<img src>` and by a browser
following a download, neither of which can set a header. It sat behind the
bearer check for as long as it existed, so every project icon and every
uploaded file answered 401 in a browser — invisibly, because a broken
`<img>` is still a visible element. A test of this route that sets an
`Authorization` header is testing something else.

Checked **before** the bytes are written: 50 MB a file, and over it the
answer is `413 too_large`. A limit enforced after the write is an
accounting note, not a limit.



The file ceiling is in the shared schema as `MAX_FILE_BYTES`, because the
browser refuses an oversized file before sending it now: a video is the
first thing that meets fifty megabytes — about a minute from a phone — and
meeting it a minute into an upload is the worst way to be told. Two copies
of the number would be two ceilings that drift.

**What a file is, is decided from its bytes.** A content type the client
supplied is a content type an attacker supplied, and this one decides what a
browser does with the file afterwards. Recognised: `image/png`,
`image/jpeg`, `image/gif`, `image/webp`, `video/mp4`, `video/webm`,
`video/quicktime`. Everything else is stored as `application/octet-stream`
and served as a download, which is the right answer for a format nothing can
play.

Storage is behind an interface with a local driver. Keys are prefixed by
workspace, so the isolation survives a move to object storage rather than
depending on one.

A drag says **where it landed**, not what key it should get:
`PATCH /api/tasks/:id { list_id, after }`, where `after` is the id of the
task it should sit behind or `null` for the top of the list. The fractional key
between the neighbours is computed on the server.

Three clients each generating their own keys is three clients that disagree
about order the first time two people drag at once. Dropping behind something
that is no longer there is a `400`, not a quiet landing somewhere else.

### One row, two views

A task and a board card are the same row. The list reads `sort_key`, the
board reads `column_name`. Nothing is stored per view, so switching cannot
lose anything and there is no import step between them.

The cursor is `sort_key|id`, not the key alone, and that follows from the
rule below: a key is unique inside a column and repeats across them, so a
query that spans the project — which this one does — has no unique order
on the key by itself. Paged on the key alone it stepped over every row
sharing its key with the last row of a page; measured on a project with
three keys repeated across columns, 49 of 52 tasks came back. The three
that never arrived were cards whose place on the board then looked wrong.

A bare key from an older client is still accepted and means “after this
key and the lowest id”, which includes rather than skips its neighbours.

`sort_key` is a fractional index, and it is only ever compared against the
keys **in the same column**. A new task is keyed against the top of the
column it is created in, not of the project: keyed against the project, a
task made in each of ten columns got the same key in all ten, and carrying
a card into one of those columns gave two cards one key — the order between
them is then whatever the database returns, and the card appears to land
somewhere nobody put it. A client that writes keys itself has to follow the
same rule, which is one reason it does not: the key comes back from the
server on every move.

Keys compare **byte by byte** — `Zz` before `a0`, `V` before `b` — and the
columns say so: `sort_key` is `text collate "C"` on `task`, `task_list` and
`sidebar_place`. In the database's default collation, `en_US.utf8` on the
deployed server, case is ignored first and `a0` sorts before `Zz`; the
server then disagreed with its own keys about which card was first, handed
out keys a column already had, and failed moves whose neighbours it had
read in the wrong order. A client that sorts by key sorts by code unit, not
`localeCompare`.

A move always leaves the card with a key of its own. `PATCH /api/tasks/:id`
re-keys when the caller names a place (`after`), when the column changes,
and — whatever the caller sent — when the card's current key is shared by
another card in the column it ends up in. Rows written before keys were
kept unique per column can still share one, and between equal keys the
order is whatever the database returns: measured on the deployed board,
five cards in one column at `Zz`, and a drop to the top (`after: null`,
same column) that changed nothing, so the card settled wherever the next
read put it. Any write through this endpoint now repairs that.

`starts_at` and `ends_at` stay on the row and are set from the task screen.
There was a calendar reading them and it was dropped — a month grid answers a
question about shape, and a project this size answers it from the list.

`decided_at` is what the board's card age counts from — the design asks for age
since the last decision rather than since creation, because a card nobody has
touched is the one worth seeing. Moving a card between columns is what resets
it; editing its title does not.

Ordering is a fractional key, so a drag rewrites one row rather than half the
table.

### Comments

One schema for everything: the target is a `(object_type, object_id)` pair
rather than four nullable columns. Adding a fifth commentable thing should not
be a migration.

## Chat

A project channel and a direct conversation are one type. What differs is
whether `project_id` is set, and that is also what decides who may see it: a
project channel follows the project, a direct one follows its members.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/conversations` | everything this person can see; each with `channel`, `project_slug`, `created_by`, `can: ("edit" \| "delete")[]`, `notify`, `mentions` (unread times you were named) and `project_archived` — a channel of an archived project, which a client keeps out of its list and its counts and still opens inside the project. `unread` counts to 100 and stops — a client draws 99+ past it — from `read_through`, worked out first so the count is a walk along the room's index. `others_gone` — a direct conversation whose everybody else was removed from the workspace or deleted their account (a group's, only when nobody else live remains; false again once somebody is back): readable, and `POST …/messages` there is `409 gone`; a client keeps it out of its list, its counts and its chat search, and lists it apart as a conversation with people who left (`docs/specs/sidebar.md`, "The Chats page"); `other_presence` is null for somebody removed |
| POST | `/api/conversations/:id/uploads` | a file of the room's, seen by whoever may see the room. In a project's room it is also a row in the project's Docs, carrying both `project_id` and `conversation_id`, so a channel with chosen people keeps its files to its people; the project's feed logs `file.upload` only for a room nobody is chosen for. Clients upload a room's files here, not to `/projects/:id/uploads` |
| PUT | `/api/conversations/:id/hidden` | `{ hidden }`, your own sidebar; a message from somebody else brings it back out, first — `docs/specs/sidebar-hide.md`. `GET /api/conversations` carries `hidden` |
| POST | `/api/conversations/:id/leave` | `channel.leave` — anybody who can see the channel, in person; never through a token, never an agent (`403`); `404` for a room the asker cannot see; a direct conversation is `400` (hide it). A project's channel of chosen people, or a channel outside every project, ends the leaver's place (`joined_at` null) → `{ ok, left: "out" }`, logs `conversation.leave` and publishes as a change of its people; the last person in a channel outside every project is `409 last` (delete it instead). An open project channel has no place to end: it is put away and quieted to mentions for the leaver (`hidden_at`, `notify: mentions` — a mention, a reply in their thread or a question for them still reaches them — `left_at`, migration 273) → `{ ok, left: "muted" }`, and a message no longer brings it back out. `PUT …/hidden { hidden: false }` undoes it, `notify` back to `all`. `GET /api/conversations` carries `chosen`, `left`, and `leave` in `can` |
| PUT | `/api/conversations/:id/notify` | `{ notify: "all" \| "mentions" \| "none" }`, your own |
| POST | `/api/projects/:id/conversations` | extra channels, made inside a project; `channel.create`; `member_ids` of whom nobody is on the project is `400 invalid`, nothing made |
| POST | `/api/conversations/channels` | a channel outside every project; `channel.create.workspace`; `{ name, member_ids? }` — left out, everybody in the workspace now |
| PATCH | `/api/conversations/:id` | `{ name }`, a channel's; `can` includes `edit` |
| PUT | `/api/conversations/:id/members` | `{ member_ids: uuid[] \| null }`, the whole list; null hands a project's channel back to everyone on the project; `can` includes `edit`. A chosen room nobody is in any more (nobody joined who could still see it — on the project, or an owner or admin of the workspace: `on_project`, the rule `in_project` asks too, migration 247) takes null from the owner or whoever holds `channel.delete` there, though they cannot read it; anything else about it is `404` |
| GET | `/api/projects/:id/empty-channels` | the project's chosen rooms nobody is in, `{ channels: [{ id, name, created_at }] }` — names only, never messages; to the owner and whoever holds `channel.delete` on the project, else an empty list. `DELETE /api/conversations/:id` deletes one, `PUT …/members` with null opens it (`empty_rooms`, `empty_room_end`, migration 245) |
| DELETE | `/api/conversations/:id` | a channel; `can` includes `delete` — a direct conversation is left, not deleted. Records `deleted_by` (migration 263) |
| POST | `/api/conversations/:id/restore` | → `{ ok }`; puts a deleted channel back with its people and messages — the toast's **Undo**. Whoever may delete it as `can` says (`channel.delete`, `manage`, the owner; a workspace channel's maker), never through a token (`403`); `404` when it is not deleted, not a channel, its project deleted, or it was not the asker's to see while it stood — a room of chosen people stays its people's (`deleted_room`, `room_back`, migration 263). Logs `conversation.restore` (no name: the feed names a room to who may see it, and a chosen room is sent to no webhook) and says `conversation` on the project's socket. The undo spec |
| POST | `/api/conversations/direct` | one to one, or a group, outside any project; the one these exact people already have comes back (200) rather than a second (201) |
| GET | `/api/conversations/:id/messages` | keyset paged by `created_at` and `id` — `next_cursor` is `<moment in UTC>_<id>`, opaque to clients, and a bare moment from before is still read — and no more than 4 MB of bodies a page (at least one message; `next_cursor` points at the rest when cut short); `?thread=` for one thread; `?q=` the room's messages that say those words, replies included, newest first, thirty a page, on the same cursor (`search_room` takes the moment and the id, migration 304); a cursor that is neither is `400 invalid` — `message.said` is the body's words, kept by the database (`docs/specs/find.md`) |
| GET | `/api/gifs/key` | the deployment's KLIPY key for the browser to search with, or `null` — `docs/specs/gifs.md`. A body's `gif` node must point at `static*.klipy.com`, or the write is `invalid` |
| POST | `/api/conversations/:id/messages` | `parent_id` puts it in a thread; `also_in_room: true` with it lists the reply in the room too; `id` may be the sender's own |
| POST | `/api/conversations/:id/import` | a room's history from Slack: `{ messages: [{ key, name, email?, text, at, parent_key?, parent_id? }] }`, up to 1 000, oldest first; answers `{ ids: { [key]: id } }`. Only into a room nobody has said anything in (409 otherwise), by whoever may make rooms like it, never through a token |
| POST | `/api/conversations/:id/import/file` | one file a Slack message carried, `{ url, name }`: fetched by the server from `files.slack.com` only (redirects only within Slack), kept as a file of the room's home and answered `{ id, name, content_type, size }`; 422 when Slack will not give it, 413 past the file or storage limit. A message in the import names it in `files: [{ id, name, kind, pixelWidth?, pixelHeight? }]` |
| POST | `/api/messages/:id/promote` | becomes a task or a post, with a link back |
| GET | `/api/conversations/:id/tasks?q=` | the tasks the room can name: its project's, or in a direct conversation every project all its people share; by title, number or handle (`MYP-61`); documents too, after the tasks, as `kind: "doc"`; `&kind=task` or `&kind=doc` asks for one of the two |
| GET | `/api/projects/:id/nameable?q=` | the same for one project — what a task's comments can name with # — `docs/specs/docs.md`; `&shared=1` leaves out documents the project does not have (a draft, one of chosen people), for a body's # and the block menu's link |
| PUT | `/api/files/:id/pin` | `{ pinned }`; `content.create` on the file's project; `GET /projects/:id/files` lists pinned first (`pinned_at`), then the latest change (a page) or the newest (the whole list) |
| — | `GET /api/projects/:id/files` | each row also says where it was first put: `origin_type` (`message`, `task`, `post`, `file`) and `origin_id`, with `origin_room`, `origin_room_name`, `origin_room_channel`, `origin_room_project_slug`, `origin_task_number`, `origin_task_key`, `origin_task_title`, `origin_post_title` to name and open it; `mark_icon` and `mark_tint` (migration 276); and on a pinned written document `preview: { lines: [{ h, t }], picture, picture_url }` — its first lines, `h` the heading level 1–3 or 0, at most six lines and 600 characters, the file id of its first picture or null, and that picture's copy for showing signed for the reader (null when it is not theirs to open) — read from its first eight blocks, for the page its card draws (`docs/specs/docs.md`, "A pinned document is a page") |
| PATCH | `/api/messages/:id` | `{ body }`; the author's alone; sets `edited_at` |
| DELETE | `/api/messages/:id` | the author's; in a project's room also `content.edit.said`. When its author deletes it, the files the message brought — its place (`origin_type = 'message'`, which a message is made only of files its writer uploaded into its room), uploaded by its author, sent into its room, held by no document — are deleted with it, in the same moment and with `deleted_by` the deleter: they leave Docs, search and `/url` at once, are in the project's Recently Deleted, and are cleared out with the message; `file.delete` is logged for each, not in a room of chosen people. A file that was somewhere first stays, and somebody deleting another's message leaves its files |
| PUT DELETE | `/api/messages/:id/reactions/:emoji` | your emoji on it, or taken back; 204 |
| GET | `/api/conversations/:id/working` | `AgentInRoomList` — `{ working: [{ agent_id, name, thread_id, message_id, doing, until }] }`, the agents at work in the room: woken there for a message (a wake answered or timed out, kept five minutes, `agent_woken`, migration 270) or saying so with a status that names the room (three minutes). `thread_id` the thread it was called in, null for the room's own line; `message_id` the message; `doing` its words or null; `until` when it stops being shown. The agent writing in the room takes it away (trigger `agent_answered_in_room`). 404 for a room the asker cannot see |
| GET | `/api/conversations/:id/hooks` | the channel's incoming webhooks, `RoomHooks` — `{ hooks: [{ id, name, created_by, created_by_name, created_at, turned_at, last_used_at, stopped_at }] }`, never a secret; `stopped_at` set when its maker's account changed hands (migration 317) — it takes nothing (`no_service`) until `POST /api/hooks/:id/turn` gives it a new URL; `hook.manage` (whoever may rename the room and say who is in it), never through a token, 403 otherwise; 404 for a room the asker cannot see |
| POST | `/api/conversations/:id/hooks` | `{ name }` (1–80) → 201 `RoomHookAddress` `{ id, name, url }`: the address with its secret, answered this once. A channel only (403 in a direct conversation), twenty a room (409) |
| POST | `/api/hooks/:id/turn` | a new secret: the old address stops at once, and the hook is the caller's from then on (`created_by`); a stopped hook starts again (`stopped_at` cleared); answers the new `{ id, name, url }` once |
| DELETE | `/api/hooks/:id` | removed; its address answers `no_service` |
| POST | `/hooks/rooms/:id/:secret` | outside `/api`, nobody signed in: Slack's incoming-webhook JSON (or a form with `payload`) — `text` in mrkdwn, `blocks`, `attachments` — becomes a message in the room under the hook's name. `text/plain` answers in Slack's words: `200 ok`; `404 no_service` (unknown hook, wrong secret, removed, or its maker no longer allowed `hook.manage` there); `404 channel_not_found` (its maker can no longer post in the room); `400 invalid_payload`, `no_text`, `msg_too_long` (over 40 000), `invalid_blocks` (over 50), `too_many_attachments` (over 100); `413` past 64 KB; `429 rate_limited` with `Retry-After` — sixty a minute a hook, a hundred and twenty a room, three hundred a workspace, three thousand an address |
| POST | `/api/conversations/:id/read` | marks it read up to now, and its notifications |
| GET | `/api/conversations/:id/members` | who is in it, by name: `actor_id, name, avatar_url, title, presence, role` |
| WS | `/ws/conversations/:id` | one conversation per socket |

**A person's days.** `GET /api/people/:id` also answers `days`: the last 365 days, oldest first, `{ day, n }` — the activity lines they left and the messages they wrote that day, under the reader's sight.

**A person's hours.** `GET /api/people/:id` also answers `hours`: the last thirty days of their logged time, `{ project_id, project_name, task_id, title, number, minutes }` per project and task. A `time.log` or `time.remove` line in the feed carries the task it was on as its object.

**A person's weeks.** `GET /api/people/:id` answers `weeks`: the last twelve weeks, oldest first, `{ week, done, said }` — tasks assigned to them finished that week and messages they wrote, counted under the reader's row-level security. `message_by_author (author_id, created_at)` makes the count an index read.

**The feed by tab.** `GET /api/activity?in=` narrows it to one of a project's tabs — `tasks` (`task.*`, `list.*`, `cycle.*`, `time.*`), `messages` (`conversation.*`, `message.*`), `files`, `posts`, `settings` (`project.*` but making, copying and importing one).

**The feed and rooms.** `GET /api/activity` names a room's line by the
room's name (`object_title`) and leaves out every line about a room the
reader may not see — `conversation_seen(id)`, a definer function with
`visible_conversations()`'s rule that still answers for a removed room. A
removed task or announcement is named by `meta.title`, kept with the line.

**A message brought from Slack.** Its author is somebody here with the same
email, or nobody: `message.said_as` holds the name it was said under, the row's
`author_id` is whoever ran the import, and the room's reads answer
`author_id: null`, `said_as` and that name as `author_name`, with no face.
`origin` is `import`, and every such line is drawn *from Slack*. Nobody edits
such a message as their own. Emails are matched through
`members_by_email(emails)`, a definer function bounded to the session's
workspace, since an email is not readable across people. The importer's own
email makes them the author; anybody else's only when the importer holds
`content.edit.said` there and `sees_conversation(room, actor)` — a definer
function with `can_see_conversation`'s rule about another person — says they
can read the room. `import_message` refuses an author who cannot, and an `at`
after now (400).

The load table has a million messages in one channel, so history is
keyset paged from the first line rather than the first complaint: offset skips
rows when somebody writes while you are paging.

**A sender may name its own message.** `id` is optional on the POST, and a
client that sends one can draw the message before the request goes out: the
row it drew and the row stored here are the same row, so the list it fetches
afterwards folds them together instead of showing two. A uuid **v7**, so it
sorts where a server-made id would. Omit it and the server names the row as
before — every client is free to ignore this.

The id names the row and decides nothing about it: the conversation comes from
the path, the author from the token, the workspace from the session. An id
already used answers **409** and changes nothing, which is what stops this
being a way to overwrite a message by naming it.

A thread hangs off a message rather than the channel being one flat river, so
the top level stays readable. Promoting a message creates the task or post and
an `object_link` back to it — what was decided in a thread stops living only in
the thread. A direct conversation has no project, so there is nowhere for the
task to live, and saying so is better than guessing one.

A promoted task goes where `POST /projects/:id/tasks` would put it: the
project's first list, at the head of its column. It went in with no list
once, which is no column and no heading — made and nowhere.

A top-level message also carries `repliers: [{ id, name, avatar_url }]` —
who answered it, the latest first, four at most — and `last_reply_at`.

**A message from an incoming webhook.** Written as whoever made the hook,
under their policies, with `said_as` the hook's name, `origin: 'system'`
and `hook_id` naming the hook (`message.hook_id`, migration 217): listed
with `author_id: null`, no face, edited by nobody, deleted as anybody's in
the room is. It makes no mention and no notification. The secret is kept
as its SHA-256 in `room_hook.secret_hash`, which the application role may
not read; a post is matched through `room_hook_take`. A maker taken out of the workspace, off the project or out of the channel loses their hooks there for good (triggers); whoever manages the room's webhooks may delete their messages. `GET
/api/conversations` says `hooks` in a channel's `can` for whoever may
manage them.

**A reply also in the room.** `also_in_room: true` on the POST of a reply
(Slack's "Also send to #channel") stores it once, in its thread, with
`message.also_in_room` set (migration 216); the room's top level lists it
too, at the moment it was said, carrying `also_in_room: true` and
`thread_said` — the first 140 characters of the message its thread hangs
from, null when that one is deleted. It is ignored on a message with no
`parent_id`, and the database refuses the field there. A client that
does not know the field draws it as a message with a `parent_id` in the
room's list. `docs/specs/chat-threads.md`.

**Who is typing.** The room's socket takes one word in, `typing` or
`typing <thread id>`, and says it on to everybody listening as
`{ kind: 'typing', payload: { conversation_id, actor_id, thread } }` —
at most once every two seconds per person per room, only while the
sender may still read the room, and stored nowhere. A `message` word now
carries `author_id`, so a reader drops that person from who is typing.

**An agent at work in the room.** `agent.working { conversation_id, agent_id }`
on the room's topic — said when a wake for a message there is settled and
when a status naming the room comes, changes or goes; never the words. A
screen reads `GET /api/conversations/:id/working` again for it; a `message`
from that agent lets it go at once.

Every message in a room's list carries `promoted_task_id`: the task it was
made into, or null. It is read through the task, so a task deleted since,
or one the reader may not see, is null rather than an id that opens
nothing. Clients draw the task's card under the message
(`GET /api/tasks/:id/card`) and do not offer promoting it again.

**Editing and deleting.** An edit is the author's alone — not even the
owner rewrites somebody's words — sets `edited_at` and notifies nobody.
Deleting is the author's, and in a project's room also whoever holds
`content.edit.said` there; a direct conversation has nobody running it.
Soft, like everything. A deleted message that has replies is still listed
at the top level, with `body: null`, `reactions: []` and `deleted: true`,
so its thread has something to hang off; without replies it is not listed.
Both travel round the room's socket. `docs/specs/message-edit.md`.

**Reactions.** One emoji per person per message per emoji, from anyone who
can read the room (`message_reaction`, bounded by workspace, visible exactly
when its message is). `PUT` adds yours and is idempotent; `DELETE` takes
yours back. `:emoji` is the emoji, URL-encoded — one emoji, up to sixteen
characters, anything else is 400. A message you cannot see is 404. Nobody is
notified; the room's socket hears it like a message. Each message in a list
carries `reactions: [{ emoji, actors }]`, each emoji once, in the order it
first arrived, `actors` in the order they reacted. `docs/specs/chat-threads.md`.

A direct conversation has no name, so the list returns `others` — the names
of everyone in it but you. Three rows reading "Direct" name nothing, and the
alternative is every client inventing its own way to build the same string.
When that is exactly one person, `other_id` is their actor id, so a client can
draw their avatar with the same tint as everywhere else; a group, and a
project channel, return `null`.

### Unread

`conversation_member.last_read_at` is one timestamp per person per room, and
the list returns an `unread` count beside each conversation. Not per message:
read receipts are a different feature with different privacy questions, and
this is the one that makes the list useful. Without it every room in the
sidebar looked identical whether it had been quiet for a week or had nine
messages since you last looked, and a chat you must open to find out whether
it wants you is a chat people open constantly and then stop opening at all.

Two things the count does not do. It never counts your own messages — a room
does not become unread because you spoke in it. And with no mark yet it
counts from when you joined the workspace, not from the first message ever
written: somebody who has never opened a channel with four hundred lines in
it does not need a four hundred beside it.

The mark is written by `mark_read(conversation, actor, workspace)`, which is
a definer function because a project channel has no membership row for the
people who can see it by being on the project — the mark has to be able to
arrive first and create the row it lands on.

It marks **up to the room's last message**, or to now when that is later or
the room is empty, and never backwards. Up to `now()` was wrong in one
direction that does not announce itself: a message whose `created_at` is
ahead of the server's clock — written by an import, a fixture, or a second
app server a few seconds out — was unread the instant after it had been
read, for ever, and opening the room again wrote `now()` again. Reading a
room means having seen everything in it; the screen draws every message it
holds whatever the timestamps say.

Beside the count the list returns `read_through`: the timestamp the count is
measured from, which is the same coalesce — the mark, then when they joined
the room, the project, the workspace. A count says how much and a client
drawing a line in the history needs to know where, and working it back from
the count is arithmetic that goes wrong the moment somebody writes while the
screen is open. `docs/specs/history.md`.

### Who is in a channel

A channel made without `member_ids` belongs to the project: everyone on it
can see the room. A channel made **with** them belongs to those people, and
`can_see_conversation` says so — the project arm of that rule reads "the
project can see it *and* the room is not `chosen`", because without the
second half a narrowed room stays readable by the whole project and looks
private while not being.

`conversation.chosen` (boolean, default false; migration 240) is what says
which. It used to be read from the rows — nobody joined meant everybody on
the project — and that could not tell "nobody was chosen" from "everybody
chosen has gone": the last chosen person removed from the workspace opened
the room, history and all, to the whole project. It is not a flag somebody
has to remember: a trigger sets it the moment anybody is put in a project's
room (`joined_at` set), whoever writes the row, and only `PUT
/conversations/:id/members` with `null` clears it. A chosen room whose people
have all gone is nobody's, the owner included, and goes with its project. On a room outside projects it means nothing and stays
false: those are their rows, as a direct conversation is.
`GET /conversations/:id/members` answers it as `chosen`.

The ids are filtered through `project_member` rather than trusted, so an id
from outside the project cannot open the room to somebody the project has not
let in, and whoever creates it is added whether they listed themselves or not.

`conversation_member` used to mean two things. For a direct conversation it is
the membership — there is no project to fall back on. For a project channel it
meant only a read mark: `mark_read` inserts a row lazily so it has somewhere
to put `last_read_at`. That was safe only while membership could never narrow
anything; the moment a channel can be made for four people out of nine, the
first person to open an open channel would have a row and the room would close
around them. `joined_at` separates the two — set when somebody is put in a
room on purpose, left null by a read mark.

`channel_members(conversation)` answers both kinds the same way, and is a
definer function for the usual reason: the names belong to other people,
`actor` is readable only through the workspace, and a plain query would return
emptiness that reads as an empty room.

A room for a few people and the project's own room are **separate rooms on
the same project**, not one room with a filter. A filter is something
somebody forgets, and the people left out never find out.

### Which tab made the change

Every request may carry `x-tab`, an opaque string the client makes once
per page load. The server does nothing with it except hand it back inside
the realtime event for the change that request caused, as `payload.tab`.
The socket takes the same value as `?tab=` so the connection and the
requests from one tab agree.

It exists for one reason. A tab drops the echo of its own change so it
does not refetch what it already drew, and the echo used to be recognised
by `actor_id` — the person. A second device signed in as the same person
was then filtered as an echo too and never learned about moves made on the
first: measured, a card carried to the top on a desktop stayed third on a
phone open to the same board under the same account, until reloaded. Keyed
on the tab, the tab that made the change ignores it and every other tab,
the same person's other device included, refetches.

The server keeps thirty-two characters of it, so a client whose tab is
longer never recognises its own echo — a uuid without its hyphens is
exactly enough. A room's `message` events carry it too, for a message
sent, edited, deleted or reacted to.

A client that sends no `x-tab` gets events with `tab: null`, and a tab
receiving one falls back to comparing `actor_id`, which is the old
behaviour and the safe direction to be wrong in — at worst one extra
refetch. A native client should send it, or its own second window will
go stale the same way.

## Realtime

Fan-out goes through Postgres `LISTEN`/`NOTIFY`, not from inside the API
process. With two API instances a broadcast from one never reaches sockets held
by the other, and that is a failure which only appears in production. Swapping
it for Redis touches one file: handlers call `publish`, sockets call
`subscribe`, and neither knows what carries it.

What travels is the fact and the ids, never the row. Everyone who hears it
fetches through the endpoint they would have used anyway, so there is one path
into the data rather than two that can disagree — and `NOTIFY` has an 8 kB
payload limit besides.

What an agent says it is doing now is said on its task's project as
`agent.status { agent_id, task_id }` — never the words — when the task or
the words change, not when the same is said again; a screen reads
`GET /api/working` again for it, and nothing else.

A socket subscribes to **one conversation**, never to a workspace: a
workspace-wide subscription wakes every device for every message in every
project, which is the load model that falls over first. The socket asks the
same database predicate the HTTP read uses, so it cannot listen to a room the
person could not open.

## Inbox, the feed and links

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/inbox` | split by reason; `?unread=1`; newest first, then by id, `next_cursor` `<moment in UTC>_<id>` (a bare moment from before reads to the end of its millisecond; anything else `400 invalid`); on the first page (no `cursor`), `questions` — Needs you: the open questions asked of the reader, newest first, at most fifty, read under their own policies (`QuestionInInbox`: `id` the comment, `task_id`, `body`, `excerpt`, `choices`, `by_id`/`by_name`/`by_avatar_url`, the task's `title` and `task_number`, the project's `project_id`, `project_name`, `project_key`, `project_slug`), the agent questions spec; a mention in a room carries `said_by`, `said`, and `said_id` and `said_thread` — the message and the thread it is in, to answer there — and `said_files`, the ids of the files that message shows (null for none); every note carries `by_id`, `by_name` and `by_avatar_url` — who did it, a person or an agent, none for a reminder — and `kind`, what they did (`commented`, `finished`, `moved`, `due`…), and a note about a comment its `excerpt`, read under the reader's own policies (`notification.by_id`, `notification.kind`, migration 181); a note about a task, announcement or file in the bin — or in a project that is — is neither listed nor counted (`docs/specs/inbox.md`) |
| POST | `/api/inbox/read` | one id, or everything; said as `read` on `/ws/me` — `{ id, workspace_id }`, or `{ workspace_id }` for everything — so the person's other devices clear it too |
| GET PATCH | `/api/inbox/settings` | chat on or off, quiet hours, timezone, `email_digest` |
| GET POST | `/digest/off?u=&t=` | not under `/api` and needs no session: the link at the foot of a digest, signed for one person. `GET` answers a small page that asks, with one button; `POST` — the button, or a mail client's one-click Unsubscribe (RFC 8058, the digest's `List-Unsubscribe-Post`) — turns their digest off |
| GET | `/api/activity` | `activity.read`; `?actor=`, `?project=` or `?object=`, cursor — newest first, then by id, `next_cursor` `<moment in UTC>_<id>` (a bare moment from before reads to the end of its millisecond; anything else `400 invalid`); `?q=` the lines whose thing or person says those words. Somebody else's `?actor=` with no `?project=` is their page's history and needs `members.read` (`403`). The workspace's own lines — no project and no room: switches, rights, removals, the hand-over, agents, integrations, webhooks — are the audit log's: served to whoever reads it (`audit.read`, in a session of their own), otherwise only one's own and only in a session, never to a token; policy `ae_read`, migration 241 |
| GET | `/api/links/:type/:id` | what this points at |
| GET POST | `/api/push` | the key, whether the Apple apps (`apns`) and the Android app (`fcm`) can be pushed to, and this person's devices, each with its `kind` (`web`, `apns`, `fcm` — a word, not an enum); POST registers one — a browser's subscription, an Apple app's `{ apns: { token, sandbox } }`, or the Android app's `{ fcm: { token } }` (migration 141); an app's from a session with no `x-device` is `400 no_device` |
| DELETE | `/api/push/:id` | take one device off |
| POST | `/api/push/off` | the same, by endpoint, for a browser switching itself off |
| POST | `/api/push/test` | a notification to this person's own devices here, now, and what each service answered: `{ devices: [{ id, kind, said, status, reason }] }` (`PushTried`); not queued, not in the inbox |

One inbox, split by **why** it arrived — mentioned, assigned, subscribed —
rather than by what it was about. The first two are addressed to you and the
third is you keeping an eye on something, which is a division somebody can act
on; a split by object type would be a filter, and a filter is set once and
forgotten.

A fourth reason, `messaged`, is a message in a direct conversation: it is a
notification so it can be pushed (ten seconds late, and not at all once
read), and it is **not** listed by `GET /api/inbox` nor counted in its
`unread` — a conversation is read in the conversation. Opening the room
reads it.

Except for an agent: a message to it in a direct conversation of the two of
them — the agent and one other — is `mentioned`, with or without its name,
so it is listed and counted, `said` is that message, and an agent reached by
webhook is sent `agent.mentioned` for it, counted by the chain as any
mention (a person's is 0, another agent's one more). In a conversation of
three or more an agent hears only its name. `agent_hears` takes a room with
no project when the agent is a joined member of it (migration 267).

A fifth, `joined`, tells whoever made an invitation that it was followed.
Its `object_type` is `actor` and its `object_id` the person who arrived;
`title` is their name. It is listed, and counted as `unread.joined`.
`inviter_of(workspace, actor)` finds who to tell, as definer, because the
person joining cannot read invitations. `docs/specs/inbox.md`.

There is exactly one preference, plus quiet hours. Chat is separable from the
rest because a busy channel otherwise drowns the assignments and the inbox
stops being read at all — which is the failure a grid of checkboxes is usually
invented to fix, and fixes for nobody. Quiet hours **hold** a notification
rather than dropping it: somebody not at work should not be woken and should
still find everything in the morning.

Your own actions are never reported back to you.

**Four more reasons** — `docs/specs/notifications.md`:

- `posted` — an announcement published, to everybody on its project; a
  draft's when its author publishes it, and never before.
- `replied` — a reply in a thread, to whoever started it and whoever has
  answered in it. A room set to `mentions` lets it through; `none` does not.
- `due` — the morning before a task's date (`Due tomorrow`) and the morning
  after it if still open (`Overdue since 31 Oct`), to the person it is on,
  at nine in their zone. Written by the worker, once per task, date and kind
  (`due_reminder`).
- `added` — put on a project; `object_type` is `project` and `title` its name.
- `shared` — chosen for a document (`PUT /api/files/:id/audience`); `object_type` is `file`, `what` *Ann shared a document with you*, `kind` `added`. A client lists the reasons it knows; one from before `shared` shows the push and not the inbox row (migration 286).
- `reminder` — a moment the person chose on a task came (`PUT
  /api/tasks/:id/reminder`); `what` is *Reminder*, `kind` is `reminder`, no
  `by_id`. Sent at that moment, through quiet hours, and never merged.
- `unblocked` — the last open task a task waited on was finished; to its
  assignees who may read both, about the task that waited. `what` is
  *RED-12 is done — you can start RED-14*, `kind` is `unblocked`. Never
  merged.

- `asked` — an agent's question with choices, to the people it was asked
  of (`POST /api/tasks/:id/comments` with `choices`); `what` is *Claude Code
  asked you a question*, `kind` is `asked`, and `excerpt` the question's
  words. Never merged. Also kind `handoff`, *Agents handed this back and
  forth 3 times. Take a look.*, to whoever connected the agents when a
  chain of hand-offs stops on anything but a task.

Each is listed and counted: `unread` carries `mentioned`, `assigned`,
`subscribed`, `joined`, `posted`, `replied`, `due`, `added`, `shared`, `reminder`,
`unblocked` and `asked`. A client
adds up what it is given rather than the keys it knows.

**`what`** on a notification says what happened, in the product's words:
*Bruno moved it to Done*, *Ada set the due date to 31 Oct*, *Dev gave it to
Chiara*, *Mia commented*, *Due tomorrow*. Never what anybody wrote — a push
shows it on a lock screen. It may be null on notes written before it.

**Who watches.** Being given a task subscribes you to it (`follow_for`, a
definer function, because a subscription is its owner's row). The people
watching a task are told when it moves, is finished or reopened, changes
hands, changes date, or is written on — not when it is renamed, labelled,
reprioritised or reordered, and never by a save that changed nothing.
Somebody named in a description is told once, when the name is added.

**Waiting and merging.** A `subscribed` note waits thirty seconds and a
`replied` one ten; anything else about the same thing for the same person in
that time replaces its `what` rather than adding a row. Notes are written
through `notify_once(id, workspace, actor, reason, type, object, what,
deliver_after, merge)`.

**`@everyone`** — a mention node with `id: "everyone"` in a room's message
names every member of the room (`room_people`).

**The day's email.** `email_digest` (default `true`) sends one email a day
with what has been unread four hours, between eight and twenty in the
person's zone and outside quiet hours, at most ten items and a count of the
rest, grouped by workspace. `notification.emailed_at` marks what a digest
has told; `app_user.last_digest_at` keeps it to one a day. `digest_due()`
and `digest_claim(actor)` are definer functions the worker calls.

**A mention** is either `@` followed by an actor id anywhere in a body's text,
or a node `{ "type": "mention", "attrs": { "id": "<actor id>", "label":
"<name>" } }` inline in a paragraph — the shape the web's chat line writes
when somebody picks a name after @. `label` is the name at the time and is
only for drawing; the id decides who is told. A client that cannot draw the
node shows `@label`.

Who a mention tells. In a task, an announcement or a file — its body or a
comment on it — only somebody who may read that thing, asked of the
database as them: `may_read(actor, kind, id)` (migration 188), a definer
function that evaluates the read policies' own `visible_projects()` and,
for a file sent in a room, `visible_conversations()`, with the reader set
to the person named. Somebody removed from the project or the workspace,
invited and not joined, or from another workspace is not written a note.
Nor is somebody who already has an unread `mentioned` note about the same
thing (`already_named`, 188): a name taken out and put back is not a second
mention. `PATCH` of a task's body, and of a comment, tells only the names
the edit added. `@everyone` names a room's people and means nothing
anywhere else. `docs/specs/task-mentions.md`.

**A push is a copy of a notification that already exists.** The row is in the
inbox whether or not any device was subscribed, whether or not the push
arrived, and whether or not the person has ever granted permission — so
`notification.delivered_at` means the sending was attempted and is done with,
not that a screen lit up somewhere. A push service accepting a message is the
last thing anybody can observe.

Those two columns have been here since `004_notifications.sql`, whose own
comment says "delivery is about push and email", and nothing ever set them:
the queue filled from the day it was made. `pnpm worker` drains it now,
beside the webhooks, for the same reason — it is a queue, and without the
process it looks like a working feature.

The payload carries the title of the thing and its address, not the body of
what anybody said: it is encrypted end to end, so the push service cannot
read it, but a lock screen is read by whoever holds the phone. VAPID keys are
made with `pnpm --filter @tracker/server vapid` and kept; without them the
product runs and the switch in Settings says there is nothing to turn on.

**A push key of its own** (migration 305). On your own server with
no `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` in the environment, the first
start makes a P-256 pair and keeps it in `instance_push_key`: one row, the
public key (base64url, as `GET /api/push` answers it) and the private key
**sealed** (`private_key_enc` — the `vapid` sealing of `auth/seal.ts`, under
`ENCRYPTION_KEY` when it is set, moved by `reseal`). Row-level security on,
nothing granted: read only through `instance_push_key_kept()` and written
only through `instance_push_key_keep(public, sealed)`, which inserts only if
there is no row and answers the row that is there — so it is made once and
never replaced. Both are granted to `tracker_app` alone (the worker process
reads through the application's connection) and answer nothing on the
service, which keeps its keys in the environment.
`instance_setting.push_public_key` is the public key the serving app signs
with, written on its every start by `instance_push_app_key_said` (table
owner only) and read by the worker through `instance_push_app_key()`, which
logs loudly when its own differs. With `VAPID_SUBJECT` unset the subject is
the origin of `APP_URL` when it is `https:`; only otherwise is it `mailto:`
the address mail is sent from, never a person's own. Keys in the
environment win and the kept pair is then neither made nor read. No
endpoint changes.

The Apple apps register a device with `{ "apns": { "token": "<hex>",
"sandbox": true }, "said": "Tuff on iPhone" }`: the token the system handed
over and which of Apple's two services gave it — a build from Xcode the
sandbox, TestFlight and the App Store production. The server builds the
address it posts to from them; an app never sends one. Each device is
`{ id, kind, said, created_at, last_used_at }`, `kind` `web` or `apns`.
Without `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID` and `APNS_TOPIC` the
answer says `apns: false` and registering one is `503`. The payload is
`aps.alert` (title and line), `aps.badge` (the same sum as a browser's),
`aps.thread-id` (the thing it is about) and `url`, the web's address.

A read — `POST /api/conversations/:id/read`, `POST /api/inbox/read` —
marks the reader's phones in that workspace (`push_subscription.recount_at`),
and the worker tells each one its number with a push of `{ aps: { badge } }`
alone: nothing shown, no sound, tried once (`apns-expiration: 0`). Once for
however many reads there were since its last pass, and not at all when the
number is the one the phone was last told (`told_unread`). Migration 135.

Registering takes the device from whoever had it: the endpoint, or the
token, is the device, and whoever presents it now holds it.

A device is written to only while it is signed in. A row is registered
under the device of the session that registered it (`x-device`), and is
sent nothing once that person has no live session on that device — one
not ended, not run out and not revoked, or revoked less than a minute ago,
because a refresh spends one session before it writes the next — and the
worker's clear-out deletes it (`push_sweep`, migrations 186 and 187).
Another person's session on a device of the same name keeps nothing alive.
An app (`apns`, `fcm`) registering from a session with no device is `400
no_device`. The one exception is a browser registered before migration 139,
whose row has no device: it is written to as before, and goes when the
browser signs out or its push service says it is gone. An app signing out
takes its row off with `DELETE /api/push/:id` first, while it still has the
session to; ending the session takes it anyway (migration 139).

Autolinks are made in both directions at the moment the body is written, not
by a later pass — a backlink built afterwards is missing exactly when somebody
looks for it.

**An event names what it happened to, and what was done.** `GET /api/activity`
carries `object_title` and `object_number` beside the id, joined in the same
query —
"somebody moved a task" is a record that cannot say which task, which is the
entire question. The join runs under the same row-level security as
everything else, so a name from a project the reader is not on is not
withheld by a screen; it is not there.

It also carries `meta`, which is what the change was: `moved_to` and
`moved_from` for a task that went somewhere, `given_to` or `taken_off`, `due`,
`renamed` and `was`, the `tools` a project now has. **Names as they were at
the time**, written where the change is made — the log is immutable and read
months later, and a list renamed since would turn an entry into a blank.

**`?object=` is one thing's own history**, which is the question somebody has
with a task open: why is this one like this. The task screen draws five of
these under the facts and sends the rest to the project's feed. Indexed —
`activity_by_object`, partial on `object_id is not null`, because an event
about a project has no object and those are most of what a busy workspace
writes.

The project's feed is a page of its own rather than a list at the foot of
Announcements:

### Cross-actor reads go through security definer functions

Three things here need to read rows belonging to **somebody else**: their
notification preferences, their quiet hours, and who is subscribed to an
object. Two more need to reach rows that row-level security hides from
*everybody* — a deleted project, and the read mark on a channel you belong to
only through its project. `deleted_projects`, `restore_project`, `purge_project` and
`mark_read` are the same instrument pointed at that: the policy stays
absolute and the three places that must step around it are named, granted and
scoped to one workspace.

**Each says `set search_path = public, pg_temp`**, `pg_temp` last
(migrations 297 and 298). A path that does not name `pg_temp`
reads it *first*: a temporary table of the application's own called
`membership` was what a definer function read, and a deletion's dry run
listed another company's workspace. `create or replace` takes whatever the
new text says, so a function written again without it loses it;
`definer-search-path.test.ts` fails on any definer function in `public`
whose path does not end in `pg_temp`.

**And the application makes no tables** (migration 298). With `public`
first, a table the application could create *in* `public` stood in just
the same — a `public.orphan` holding seven ids made the clear-out delete
seven people — and so could an overload it planted, such as
`public.can_see_conversation(text)` answering true, which a parameter sent
untyped resolves to. PUBLIC has neither CREATE on schema `public` nor TEMP
on the database; `tracker_app`, `tracker_worker` and `tracker_auth`
(migration 308) are granted CONNECT by name, and the tables' owner, who runs the definers, keeps TEMP. The two
definers that make temporary tables (`purge_orphan_actors`,
`account_deletion`) name them `pg_temp.orphan` and `pg_temp.owned`
everywhere, and the tables they reach through `format` as `public.%I`. A
definer function that needs a temporary table names it so.

**Getting in is written by definers** (migration 306). The
application role updates six columns of `app_user` and inserts no row:
`notify_chat`, `email_digest`, `quiet_from`, `quiet_to` and `timezone`
(`PATCH /api/inbox/settings`) and `language` (`PATCH /api/me`), each a
person's own, as themselves (`u_update`). The password, the second factor
(`totp_*`), the address and its confirmation (`email`,
`email_verified_at`, `email_by_hand`) and every other column are written
only by definer functions. Before 306 the application held INSERT and
UPDATE on the whole table and `u_write` let an insert through with no
actor, so one plain `update` set anybody's password hash. `u_write` is
gone; the worker's role and PUBLIC hold nothing on the table; provider
identities (`auth_identity`), tickets and recovery codes were never the
application's to write directly. A setting added to `app_user` is
granted by name, as its read is; anything about getting in gets a
definer function. A zone the database does not know is refused by a
trigger on insert and on change (`22023`), whoever writes it.

**Getting in is the sign-in role's** (migrations 308 and 311). Those definers trusted the actor id they were
handed, and `current_actor()` is `current_setting('app.actor_id')`, which
the application role sets for itself, so SQL run as `tracker_app` — an
injection, a bug — could call them on anybody. They are a role's own:
`tracker_auth`, which only the sign-in code connects as (`asAuth`,
`asAuthActor`, `asAuthEverywhere` and `authSql` in `server/src/db.ts`, on
a pool of their own). The role is a member of `tracker_app`, inheriting,
so a sign-in transaction reads and writes everything else under the same
policies (each is `to public` or `to tracker_app`, and a member passes
both); it owns nothing and bypasses nothing (`rlsGuard.ts` asks at
start). Its connection string is `DATABASE_URL_AUTH`, or, unset, made
from `DATABASE_URL_APP` — the user `tracker_auth` and a password derived
from the application's (`server/src/db/authUrl.ts`) — and the migrating
start gives the role that password, as a SCRAM verifier, so an upgrade
needs no new variable. In production a server with neither, whose
application is not the owner, says so loudly at start while the
application still holds the sign-in rights, and refuses to start from
311's deploy on.

**In two deploys.** 308 makes the role and grants it every definer and
table right below, taking nothing from `tracker_app`, so a container
still running the code from before it signs people in as it did. 311,
shipped in the deploy after, takes the same rights from `tracker_app`:
from then on the application role may not execute any of them, whatever
actor it sets, an operator's or a server owner's included.

**The sign-in role's definers.** `accept_invite`, `agent_end_tokens`,
`agent_oauth_end`, `auth_app_start_once`, `auth_change_password`,
`auth_claim_email`, `auth_confirm_email`, `auth_confirm_if_invited`,
`auth_email_cancel`, `auth_email_confirm`, `auth_email_ticket`,
`auth_email_ticket_peek`, `auth_email_weak` (321), `auth_end_session`, `auth_hold_account`, `auth_identity_forget`,
`auth_identity_link`, `auth_identity_remove`, `auth_invite_delivered`,
`auth_lookup_user`, `auth_membership_answer`,
`auth_not_put_out_since`, `auth_password_hash`, `auth_recovery_replace`, `auth_recovery_spend`,
`auth_refresh_again`, `auth_revoke_others`, `auth_revoke_session`, `auth_set_password`,
`auth_session_host` (325), `auth_spend_refresh`, `auth_ticket_binding`, `auth_ticket_make`,
`auth_ticket_make_bound`, `auth_ticket_peek`, `auth_ticket_recent`,
`auth_ticket_spend`, `auth_ticket_start`, `auth_ticket_started`,
`auth_totp_begin`, `auth_totp_disable`, `auth_totp_enable`,
`auth_totp_secret`, `auth_totp_secret_for`, `auth_totp_spend`,
`delete_my_account`, `digest_off`, `github_person_retoken`,
`github_person_token`, `host_code_ask` (328), `host_code_live` (327), `host_code_live_for` (328), `host_code_make`, `host_code_spend`, `host_code_try` (325; 328 with an invitation), `auth_invite_bind` (328), `instance_add_owner`, `instance_mail_clear`,
`instance_mail_write`, `instance_remove_owner`, `instance_setup_owner`,
`nowhere_session_end`, `oauth_agent_link`, `oauth_code_make`,
`oauth_code_take`, `oauth_refresh_take`, `oauth_token_bind`,
`operator_delete_account`, `register_owner`.

That is every definer that writes a password, an address, a second
factor, a provider's identity, a ticket or a recovery code; that hands
back what a way in is made of (a password's hash, a factor's sealed
secret); that makes, trades or ends a session, an OAuth code or a token;
that deletes an account; that confirms or ends a membership the person
was given before their address was proved (315); a person's GitHub token by request
(`github_person_retoken` is the worker's too, as it was); and the server's
mail and its owners on your own server — a way in too, since the mail
carries every reset link and an owner may name another.
`server/test/auth-role.test.ts` holds the list against the catalogue and
against this paragraph; `auth-role-refused.test.ts`, once 311 is applied,
runs every one as the application role, with the actor set to nobody, to
the account and to an operator: each is refused (`42501`), which is
asked before the function runs, so no actor setting gets past it. Beside them, INSERT on `refresh_session` and `api_token`,
UPDATE of `api_token.revoked_at`, and INSERT, UPDATE and DELETE on
`github_person` are granted to `tracker_auth` by 308 and taken from
`tracker_app` by 311, which makes the insert policies `sess_write` and
`tok_write` the sign-in role's, still asking that the row is for the
actor of the transaction. The application keeps reading them as before,
and `auth_lookup_api_token` — every request with a token asks it, with
the token's hash — still stamps when a token was last used. A new
definer about getting in is granted to `tracker_auth` alone and named
here.

**Still not a boundary against SQL run as the application:** anything
but getting in. `current_actor()` is the application's to set, so such SQL
reads and writes as anybody whatever row-level security lets that person
do — the rest of what `is_operator()` and `is_instance_owner()` gate
included (opening sign-up, a board, a gift) — and the application still
inserts and updates `push_subscription` (a device planted on somebody
hears what that SQL could read anyway).

Before it, 306 narrowed what was cheapest to narrow. `api_token` is
updated only to revoke it: UPDATE is `revoked_at` alone (it was every
column, `actor_id` and `token_hash` among them) — granted to the
sign-in role by 308, and the sign-in role's alone once 311 takes it from
the application — and a trigger keeps a revoked token revoked.
`refresh_session`'s insert policy `sess_write` asks
`actor_id = current_actor()` (it was `with check (true)`), and sessions
are inserted as the person signing in. 308 grants the sign-in role
INSERT on `api_token` and `refresh_session` and the writes on
`github_person`, and 311 takes them from the application, with SELECT on
`github_person`'s sealed `token_enc` and `refresh_enc` (it reads who is
linked, by `github_id`, `login` and `avatar_url`); INSERT and UPDATE on
`push_subscription` stay the application's, above.

**And the webhook table's policies keep to the workspace's own webhooks**
(`agent_id is null` in `wh_read`, `wh_write` and `wh_update`, migration
296): an agent's webhook is read and written only through the definer
functions that ask who manages the agent.

**Each is granted to the role that calls it, by name** (migration 227).
PUBLIC runs no definer function; `tracker_app` runs the ones a request
calls, `tracker_worker` the worker's (migration 153), `tracker_auth` the
ones about getting in (migration 308, above), and the purges —
`purge_workspace`, `purge_workspaces_like`, `purge_orphan_actors` — are the
owner's alone, reached by the worker through its own clear-out. A function
a migration makes is nobody's until it is granted (`alter default
privileges`). And the application role inserts a membership only as
somebody already in the workspace, adding a plain member under their own
name (`invited_by`) — what an import does (migration 228); every other
membership is made by a definer function.

The harness needs it too, and learned it the expensive way.
`purge_workspaces_like(patterns)` exists because the sweep that clears
throwaway workspaces was reading `workspace` directly with no actor set — and
`workspace` is readable only by its members, so it found nothing, reported
success and cleared nothing for weeks while the database grew to two and a
half thousand of them. Nothing failed; the test suite just got slower by a
hair a run. The function takes slug patterns and nothing else, so the most it
can be persuaded to remove is a workspace whose slug was made to look like a
throwaway one, and the sweep calls it as the tables' owner. All three tables are readable only by the actor they belong to, so a
plain query as the person doing the thing returns emptiness — and emptiness
reads as "nobody is watching" or "send it immediately" rather than as an
error.

Nothing fails. That is what makes it worth naming: the subscribed half of the
inbox could never have fired in production, and the chat switch and quiet
hours did nothing at all, with no symptom other than silence. `notify_prefs`
and `subscribers` exist for exactly this, and the latter returns only actors
who are members of the workspace so it cannot be used to discover who exists
elsewhere.

### Row-level security is written as set membership, not per row

The natural way to write these policies is a function taking the row —
`can_read_object(workspace_id, project_id)`. Postgres then
has to call it once per row, and each call runs two subqueries. Against the
load table that turned a 20 ms index scan into **1.2 s** for overdue
work and **4.2 s** for search. The indexes were never the problem: the plan
showed them in use, with the whole cost in the filter above.

Written as `project_id in (select visible_projects())`, the sets are computed
once per query as hashed InitPlans and the check becomes a lookup. Same rule,
same answers, evaluated once instead of thousands of times.

| Screen asks | Before | After |
| --- | --- | --- |
| project screen: first page of tasks | 93.7 ms | 4.6 ms |
| board: one column | 112.7 ms | 4.7 ms |
| chat: newest page of a million | 35.3 ms | 26.0 ms |
| overview: overdue across every project | 1209.4 ms | 5.6 ms |
| search: a word across everything | 4241.0 ms | 11.4 ms |

`pnpm load` builds that table — 10 000 tasks, a million messages, 500
projects, 1 000 members — and fails if any screen is outside 200 ms. None of
this is visible on demo data: with fifty tasks the per-row call is free, which
is why the load table is in the design rather than in a later phase.

Search is `ilike` over pg_trgm GIN indexes — on titles, and on `said`, the
words drawn out of each body by the database (migration 098), which never
leaves it in an answer. The endpoint's shape does not depend on that, so a
real engine can replace it without the contract moving.

| search, against the load table | |
| --- | --- |
| a word in ten thousand titles and descriptions | 53.7 ms |
| a task by its handle | 24.4 ms |

### A child read by its parent is indexed; a foreign key is not

`message.parent_id` references `message(id)` and had nothing behind it. That
is the read behind **opening a thread**, walked constantly, and it was a
sequential scan of the whole table every time. It surfaced from the other
end — clearing the load workspace ran for hours, because deleting one message
scanned a million rows to check that nothing pointed at it.

The same shape was missing on `task.parent_id` (a task's parts),
`conversation.project_id` (a project's channels), `task_list.project_id` and
`time_entry.project_id`. All of them are read every time the parent is
opened.

`message_by_parent` is the one index here with no `where deleted_at is null`,
and that is deliberate: a partial index cannot answer a referential integrity
check, because that check carries no predicate the planner can match the
index against. Written partial first, it looked present and did nothing —
deleting 5 000 rows still took minutes. Unconditional, 50 000 take under
three seconds.

This is not an index on every foreign key. Most of the foreign keys here have
no query behind them, and an index nobody reads is a write nobody asked for.

## Overview, hours and templates

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/overview?view=` | deadlines, overdue, unassigned, by_person, progress |
| GET POST | `/api/time` | own hours, or anybody's with `time.any`. `GET` without `?project=` answers everybody's hours in every visible project only with `members.read`, and otherwise the asker's own |
| PATCH | `/api/time/:id` | your own, or anybody's with `time.any` (`403`); `404` for one removed or not the asker's to see. `{ minutes?, spent_on?, note? }` — minutes 1–1440, a `YYYY-MM-DD` day, a note up to 1000 (empty or `null` takes it off) → `{ ok }`. Logs `time.edit` on what it was spent on, `meta: { minutes, was_minutes?, spent_on?, was_spent_on?, noted? }` — only what changed beside `minutes`, and nothing when nothing did. The time spec |
| DELETE | `/api/time/:id` | your own, or anybody's with `time.any` |
| POST | `/api/tasks/:id/spend` | `time.own` on the task's project; `{ client, tokens, cost_usd?, model?, session? }` — the caller's own AI spend on the task; `201 { id }`. With `session`, replaces the caller's line for the same client and session on that task |
| GET | `/api/spend` | `{ spend: [{ project_id, project_name, actor_id, actor_name, client, tokens, cost_usd }] }` summed by project, person and client; `?project=` for one, and without it only the asker's own unless `members.read` — as `/api/time` |
| DELETE | `/api/spend/:id` | your own, or anybody's with `time.any` |
| POST | `/api/projects/:id/copy` | a template is a snapshot of a project |
| POST | `/api/checkins/run` | what a timer calls; idempotent per day |

**One endpoint, one screen.** Five questions of the same rows rather than four
sections of reporting — four endpoints would have become four screens, and the
design is explicit that they are one.

Overdue means late **and still open**. Something finished late is history, not
a problem, and counting it is how a dashboard becomes something nobody looks
at. Unassigned is the work nobody has picked up, which is the thing that
quietly does not happen.

The whole screen is behind `activity.read`, the same permission that gates
the feed, and it reaches only the projects the caller is on — the overview is
a sum of what you can already open, never a window past it.

A member logs their own hours; logging somebody else's needs `time.any`,
because it is a claim about what another person did.

**Hours go on a task as well as on a project.** `POST /api/time` has always
taken `object_type: 'task'` with an `object_id`, and nothing read it back, so
the columns held rows nobody could see — the most expensive shape a feature
takes, because it reads as done. `GET /api/tasks/:id` now carries `time`: the
entries on that task, each `{ id, actor_id, actor_name, minutes, spent_on,
note }`, oldest first. Its own, never its subtasks' summed in. Every entry
still carries its project, so `GET /api/time` reports the same hours without
a second table or a roll-up.

The ceiling is a day: twenty-five hours on one Tuesday is a slip every time.
The web picks a duration from a menu in quarter-hour steps rather than taking
a typed one, but that is the screen's answer and the endpoint takes any
positive number of minutes up to the day — a client with a stopwatch in it
should send what the stopwatch says.

An entry cannot be edited, only removed and rewritten: a five-minute row
turned into eight hours is a claim about somebody's day changed with nothing
to show for it, and two lines in the feed are what a record of hours is for.
`DELETE` is soft, like everything else, and answers `404` rather than `403`
for a row in a project the caller is not on.

**AI spend sits beside the hours**, migration
198. Tuff cannot see tokens, so the client that spent them sends them: a
`task_spend` row is `{ actor, client, model?, tokens, cost_usd?, session? }`
on one task. `client` is what spent them as a person reads it (`Claude
Code`, `Cursor`, up to 60 characters), `tokens` everything read and written
including cache reads (a whole number), `cost_usd` US dollars to the
millionth or absent when the client does not know, `model` its id. Always
the caller's own: there is no `actor_id` to send. A report with a
`session` (the client's own id for the run, up to 200 characters) replaces
the caller's earlier line for that task, client and session, so a hook can
send the running total after every reply; without one each report is a new
line. Nothing is written to the feed. `GET /api/tasks/:id` carries `spend`:
each `{ id, actor_id, actor_name, client, model, tokens, cost_usd,
created_at, updated_at }`, oldest first, its own and never its subtasks'.
The table cascades from its task and project and is cleared with the
workspace and the account like every other row.

A template is a snapshot of a real project, not a separate kind of thing — a
template built from nothing is a form, and nobody fills in a form to start.
Dates are copied as **offsets from the earliest one**, so a plan copied to
start today does not arrive already overdue.

A recurring check-in is a post with a schedule, not a fifth entity. The run
endpoint is what a timer calls, and running it twice in a day produces one
post: the guard is a query, not a lock.

## The worker

`pnpm worker` is a second process, and the product is not correct without it:

- **It drains the webhook queue.** Until it existed, `deliverDue` was reachable
  only from an endpoint somebody had to POST to — so the queue filled, the
  retries were written, the signing was correct, and **nothing ever
  delivered**. Nothing threw. The deliveries simply sat there.
- **It runs the clear-out**, hourly, on rows soft-deleted longer than
  `PURGE_AFTER_DAYS` (30 by default). What it passes over — a project that
  could not go — it says as a database warning, which the worker prints
  as `worker: purge: …`; rows something live still names are a
  notice, said every hour and not printed.
- **It removes the bytes of what is gone.** A file's row, deleted by
  anything, queues its keys in `storage_orphan` (a trigger, so nothing that
  deletes a file can forget); the same pass takes up to 200 from
  `storage_orphans(n)`, removes them from storage and marks them with
  `storage_orphans_gone(keys)`. A key some row still names is taken off the
  queue and kept — checked in one pass, every named key against the queue,
  not the four tables read again for each key (migration 251). Before this, a file cleared out of the database stayed in
  the bucket for ever.
- **It sends the reminders people set for themselves**, every twenty
  seconds — `claim_task_reminders`, above under "Remind me".
- **It clears OAuth clients nobody used**, in the hourly pass:
  `oauth_clients_clear()` deletes a client registered more than seven
  days ago that no code, token or agent's grant names. Rows nobody owns —
  a client is no workspace's — so nobody is asked; one that comes back
  registers again (migration 295).

All of them are idempotent: run two workers and the second finds nothing to do
rather than doing it again. Each loop waits *between* runs rather than on a
fixed interval, so a slow run cannot overlap the next one.

## Webhooks and MCP

| Method | Path | Action |
| --- | --- | --- |
| GET POST | `/api/webhooks` | `audit.read`; never through a token. Each listed with `authorization_set` — whether it sends the receiver's own key, never the key (migration 266) — and `stopped_at`, set when it was turned off because the account that made it changed hands (migration 317). `POST { url, events?, authorization? }` — `authorization` the receiver's own key, sent as `Authorization` beside the signature on every delivery: one header value, printable ASCII, no CR or LF, at most 1024 characters once trimmed (`400` otherwise), from a signed-in session alone (`403`), sealed at rest (`auth/seal.ts`, kind `webhook`) and in no answer; — `events` from `WEBHOOK_EVENTS` (`task.create`, `task.update`, `task.delete`, `task.comment`, `post.create`, `post.update`, `post.delete`, `post.comment`, `file.create`, `file.upload`, `file.update`, `file.delete`, `file.purge`, `file.comment`, `file.publish`, `file.access`, `project.create`, `project.archive`, `project.member.add`, `time.log`), anything else `400`; none is every event. **Twenty a workspace at most**, on or off, an agent's not counted: the twenty-first is `409 too_many_webhooks` (a trigger on `webhook`, asked on insert and on any change of `deleted_at`, `workspace_id` or `agent_id` that makes a row one of the twenty — migrations 294, 300) |
| PATCH | `/api/webhooks/:id` | as `GET`; `{ enabled?, events?, authorization? }` → `{ ok }` (`WebhookChanged`). Turning on one with `stopped_at` — turned off because the account that made it changed hands (migration 317) — gives it a new secret, answered once as `{ ok, secret }`, and clears the mark. `authorization` a value sets or replaces the receiver's key, `null` takes it off; as at `POST`, from a signed-in session alone. Logs `webhook.update` — `meta: { id, host, enabled, events, authorization? }`, `authorization` `"set"`, `"changed"` or `"removed"` and never the value, in the audit log's integrations (migration 265), as `/disable` does. Off, nothing is queued for it and it keeps its address, secret and events; on again is the same webhook. `404` for one deleted, an agent's, or another workspace's |
| POST | `/api/webhooks/:id/disable` | off, as `PATCH { enabled: false }`. It used to delete the webhook too, and no longer does |
| DELETE | `/api/webhooks/:id` | as `GET`; soft (`deleted_at`), its secret with it; what is still queued for it is never sent. Logs `webhook.remove` with its host |
| POST | `/api/webhooks/:id/test` | as `GET`; queues one `webhook.test` delivery for it — `data: { webhook_id, workspace_id, sent_by }` — signed and retried as every event, its answer in `last_status` → `202 { delivery_id }`; `409 off` for one turned off, `429` past ten an hour a webhook or thirty a workspace |
| POST | `/api/webhooks/deliver` | one pass of this workspace's queue |

Events fire from the same call that writes the activity feed, in the same
transaction. An event that reaches a receiver for something the feed never
recorded — or the reverse — is a disagreement nobody can debug afterwards.

Except about a room only some people are in. An event whose `object_type` is
`conversation` is queued only for a project's room open to everybody on the
project; a direct conversation, a channel of chosen people and a channel
outside every project send nothing (`queue_webhooks`). A webhook is the
owner's, and its receiver was being told the names of rooms the owner could
not open, and what was done in them.

The same for a document the project does not have: a draft, or one of
chosen people, sends nothing about itself or what is said on it until it is
published to the project — which is `file.publish` (`record()`, migration
278).

The signature covers the **timestamp, the delivery id and the body**, not the
body alone. A shared secret in a header proves somebody once knew the secret
and says nothing about when: it does not stop a captured request being sent
again an hour later, which is the failure signing exists to prevent. Receivers
should refuse anything older than five minutes and deduplicate on the delivery
id, which travels with every retry.

A pass claims what it reads — the same statement pushes each row five
minutes on and skips rows another pass holds — and sends five at a time; a
delivery tried ten times is given up. Delivered rows go after thirty days,
given-up ones thirty days after they were made, and notifications ninety
days after they were read or half a year after they were written
(`purge_queues`, hourly from the worker).

Retries back off and the queue goes **round the workspaces**. Draining it
globally oldest-first means one customer's dead endpoint fills the front of
the queue and starves everyone else — a failure that looks like "webhooks are
slow for everybody" and is caused by one of them. It said "a workspace at a
time" here for months while the worker's pass took the fifty oldest of the
whole instance; now `due_webhook_deliveries(limit, workspace, each)` takes
at most `each` (ten) of one workspace a pass and hands them back in turns —
every workspace's oldest, then every workspace's second — so a workspace
with one delivery due is among the first five sent (migration 294).

The secret is written once and never returned again: the column grant is
revoked, so reading it happens through a security definer function in the
process that signs, and nowhere else. The worker has no actor, so recording an
attempt goes the same way — a worker that appears to run and changes nothing
is worse than one that fails, because the queue looks drained and is not.

### MCP

Two ways to reach it, one set of tools (`server/src/mcp/tools.ts`): over
stdio, started by an agent on the person's machine with a token from
Account, and at **`POST /mcp`** for an agent that lives elsewhere and signs
in through OAuth.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/mcp` | Streamable HTTP, stateless, JSON answers; a `tok_…` bearer, anything else 401 with `WWW-Authenticate: Bearer resource_metadata="…"` |
| GET DELETE | `/mcp` | 405 |
| GET | `/.well-known/oauth-protected-resource` | RFC 9728; also with `/mcp` after it |
| GET | `/.well-known/oauth-authorization-server` | RFC 8414; also with `/mcp` after it |
| POST | `/oauth/register` | RFC 7591: `{ client_name?, redirect_uris }`, https or http on localhost; registered as a public client (`none`) whatever is asked; 30 an hour from one network — an IPv4 address, or an IPv6 address's /64 (`networkOf`); `429 slow_down` past it. A client nothing has named for seven days — no code, token or agent's grant — is cleared by the worker (`oauth_clients_clear`, migration 295) |
| GET | `/oauth/authorize` | the app's page that asks the person — not an endpoint |
| GET | `/api/oauth/client` | `?client_id=&redirect_uri=` → `{ name, agents: [{ id, name, avatar_url }] }`; a session only, `token.issue.own`. `agents` are the workspace's live agents the person manages (`agent.manage`: those they connected, asked of `can()` for each) — whom the page offers to sign in as |
| POST | `/api/oauth/authorize` | `{ client_id, redirect_uri, code_challenge, code_challenge_method: "S256", state?, agent_id? }` → `{ redirect }` with `code`, `state` and `iss`; a session only. `agent_id` (absent or `null`: the person) signs the connection in as that agent: `403` unless the person manages it — `can()` (`agent.manage`), then the rows (`oauth_code_make`: a live agent of this workspace, the person its connector, still in the workspace — migration 290). Only this body chooses: a `login_hint` in the page's address may preselect an agent there and is never read by the server. Writes the security event `agent_linked` — `{ actor_id, agent_id, client_id, client }`, never a code |
| POST | `/oauth/token` | form or JSON; 1200 a minute per address (`429 slow_down`); `authorization_code` with `code_verifier`, or `refresh_token`; → `{ access_token, token_type, expires_in, refresh_token, scope }`. A refresh token spent before and presented again, past ten seconds, revokes every token of its connection (`invalid_grant`; migration 152). A code made for an agent issues the agent's pair — `actor_id` the agent, its projects and ceiling, as its own token — and every refresh of it stays the agent's; both ask `can()` again for the person who linked it, as they stand now, and are `invalid_grant` when they no longer manage it or the agent is gone (migration 269) |

The access token is an ordinary `tok_…` named after the client, for seven
days, so every refusal for connected tools applies to it and it is listed
and revoked in Account with the rest. The refresh token lasts ninety days
from its last use and is spent by using it: the old token is revoked in the
same statement and a new pair issued. A revoked token has no refresh left
in it. A code lives ten minutes and is spent by the first trade, right or
wrong.

Kept in `oauth_client` (name, redirect addresses — nobody's workspace, one
client serves everybody), `oauth_code` (hash, workspace, client, person,
address, PKCE challenge) and three columns on `api_token`:
`oauth_client_id`, `refresh_hash`, `refresh_expires_at`. None is readable
by the application role; definer functions `oauth_client_register`,
`oauth_client_read`, `oauth_code_make`, `oauth_code_take`,
`oauth_token_bind` and `oauth_refresh_take` do the reading and writing.
Migration 123.

Signed in as an agent (migration 269): `oauth_code.agent_id` names whom
the code is for, `actor_id` staying the person who pressed Allow, and
`oauth_agent_grant` (id = the connection's `oauth_grant`, workspace,
agent, client, `linked_by`, `created_at`) remembers each connection made
so; neither is readable by the application role. Definers
`oauth_agent_link`, `oauth_agent_linked_by`, `agent_oauth_connections`
and `agent_oauth_end`. The agent's OAuth tokens are its tokens:
`agent_end` (disconnecting, removing its connector) and `agent_end_tokens`
(a new token, which also spends its untraded codes) revoke them with the
rest; the person's own are untouched. Triggers on `membership` (role, removal) and on
`agent.created_by` revoke at once the connections whose linker no longer
manages the agent (`oauth_agent_linker_check`).

A thin wrapper over these endpoints, not a second way in. Every tool is one
HTTP call to the endpoint the web app uses, with the person's own token, so
the permissions are the same by construction rather than by two
implementations agreeing.

Every project, task, document and announcement a tool answers with
carries a `url` — `APP_URL`, then the workspace's and the project's names,
the tool and the number, as the addresses spec has them — and the
server's `instructions`, said on connecting, tell an agent to link with it
and never build an address of its own. `/api/my/tasks` carries
`project_slug` for it.

Every body a tool takes — a task's `description`, a document, a post, a
comment, a message — is read as Markdown into the editor's document
(`server/src/mcp/markdown.ts`): headings, lists, quotes, fenced code,
tables, bold, italic, code and links to `http`, `https` or `mailto`.
`create_doc`, `read_doc` and `update_doc` are a project's Docs — a file
with a body, `POST /api/projects/:id/files` and `PATCH /api/files/:id`;
a document made through a tool is the project's at once, never a draft,
and `read_doc` and `search` reach only the
documents the token's person or agent may read;
`create_task` and `update_task` take a `description` that is the task's
body, which replaces the old one.

Pictures and files go into any body a tool writes: `upload_file` answers
with an id, and either `![caption](file:<id>)` on a line of its own in the
Markdown or the id in `attachments` (on `create_task`, `update_task`,
`comment`, `send_message`, `create_doc`, `create_post`) becomes the
editor's own `attachment` node — its name, size and pixels filled in by
reading the file as the person, so an id they cannot see is refused.
`update_task` with `attachments` and no `description` adds them to what
the task already says.

A task's handle written in any of those bodies — `ACM-41` — becomes the
task's `taskref` node, the chip the web's `#` makes: every handle in the
body, fifty at most, is asked of `GET /api/task-handles` once, and only a
task the person can see **that every reader of the destination may read**
is answered — in its own project, or in a room outside every project
whose joined people may all read it (`send_message` passes the room). In
another project's body, a room with somebody not on the task's project, or
`update_message` / `update_comment`, a handle stays the words it was,
since a chip carries a title its readers might not be allowed. A handle in code, in a link, of a
project that is not there or not theirs, or of a post or a document,
stays the words it was.

The files in what a tool reads come with links: `read_messages` writes a
picture as `![name](url)` and lists each message's `attachments`
(`{ id, name, kind, size, url }`), and `read_task`, `read_post`,
`read_doc` and a room's mention in `my_mentions` carry `attachments` for
every file their bodies and comments show. The links are `GET
/api/file-links`'s — they open without signing in for up to an hour, and only a
file the person may read is linked; any other stays `[name — not
available]`. `read_file { file_id }` is `GET /api/files/:id/content`: a
PNG, JPEG, GIF or WebP as an MCP image, a text file as its words, anything
else as its link.

`copy_task { task_id, project_id, list_id? }` is `POST
/api/tasks/:id/copy`, and answers the copy's id, number and `url` with
what it left off — `labels_dropped`, `assignees_dropped` — since a model
has no window to read them in first.

`my_tasks` is what is assigned to the person across every project, open
ones unless `include_done`, each with its handle and `list_name`.
`read_task` takes an id or a handle (`ACM-41`, found through search and
taken only when the number matches) and answers the task with its parts,
comments and labels and the lists of its project — what an agent needs to
do it and to move it, without the signed links to its pictures.

A project's instructions for agents (`file.for_agents`) are pointed at by `read_project`, `read_task`
and `my_tasks`: `instructions_for_agents: { doc_id, name, url }` in the
project's or the task's answer (for `my_tasks`, a list with each project's
`project_key`, after the tasks), and a line of Tuff's before the wrapped
data — outside `<user_content>`, naming only the key, the id and the url —
telling the agent to read it with `read_doc` before working on the
project's tasks. Each is read fresh from `GET /api/projects/:id`. The
document is read like any other, through the agent's own rights; what it
says is data, wrapped as every body is, and grants nothing. The server's
instructions say so once, when an agent connects.

Each carries a `title` and annotations (`readOnlyHint`, `destructiveHint`,
`idempotentHint`, `openWorldHint: false`); only `update_task` is marked
destructive, since it changes fields in place.

The tools cover what a person does except what a token may never do —
the list in `NEVER_VIA_MCP` and the endpoints that refuse a token outright:
deleting, archiving, people and their rights, the workspace's settings,
billing and ownership, tokens, the Slack import. Beyond the ones below:
`list_people`; `list_conversations`, `read_messages` (as text, `?thread=`
and a cursor), `update_message`, and a `thread_id` on `send_message`;
`read_activity`; `create_subtask`; `remind_me { task, preset? | at? | clear? }` — `PUT` or `DELETE /api/tasks/:id/reminder` for the person the token is theirs, the task by id or handle, answering `{ ok, task_id, reminder }`; `record_spend { task, client, tokens, cost_usd?, model?, session? }` — `POST /api/tasks/:id/spend`, the task by id or handle; `list_labels`, `create_label`,
`list_cycles`, `create_cycle`, with `label_ids`, `cycle_id` and `repeat`
(see "Recurring tasks") on `create_task` and `update_task`; `blocked_by_add`
and `blocked_by_remove` on `update_task`, task ids or handles, one `POST` or
`DELETE /api/tasks/:id/blocked-by` each; `read_post`, `update_post`;
`update_comment`; `quote` on `comment` — on a document, `anchor: { text }`
— and `resolve_comment { comment_id, resolved }` through
`PUT /api/comments/:id/resolved`;
`ask { task, question, choices, to? }` — an agent's question with 2–4
choices, `POST /api/tasks/:id/comments` with `choices`, answering
`{ id, asked, url }` — and `get_answer { question_id, wait_seconds? }` —
`GET /api/comments/:id/answer`, asked again every two seconds for up to
`wait_seconds` (at most 25), answering `{ answered, question_id, choice,
label, answered_by, answered_at }`, wrapped as data (`<user_content>`) once
answered;
`set_status { task?, conversation_id?, thread_id?, doing }` — what the agent is doing now, `PUT
/api/me/status`, the task by id or handle, and the room and thread it was
asked in, when it was; `doing: null` clears it; it is
asked again at least every two minutes, since a status goes three minutes
after it was last said; answers `{ doing, task_id, since, until }` or
`{ cleared: true }`;
`tasks_from_doc { doc_id, lines }` — each line the words of one line of
the document (a block, or a run of one between hard breaks) or part of one;
a line sent with a line break in it is that many lines, each up to 2000
characters, whose title is the whole line — only a line over 300, a
title's limit, is cut, with the whole line in the description
(`lineTitle`); the whole line becomes the chip: a task made through
`POST /api/projects/:id/tasks` with a `docref` back to the document, then
the body written once through `PATCH /api/files/:id` with each line's
words replaced by the task as a `taskref` node, with `base_rev` the `rev`
it read so edits made meanwhile are merged. It asks `may_edit` first and
places every line on a copy before it makes any task, so nothing is made
that cannot be placed; answers `{ tasks: [{ id,
handle, url }] }`;
`upload_file` — text, or base64 — through
`POST /api/projects/:id/uploads`, so the file ceiling and the storage line
hold; and `my_mentions` and `mark_read`, through `GET /api/inbox?unread=1`
and `POST /api/inbox/read` — what the caller was mentioned in and has not
answered, oldest first, a room's with its `conversation_id`, `thread_id`,
who said it and what, for an agent that works from where it works and has
no bell.

The tools are `list_projects`, `my_tasks`, `read_task`, `create_doc`, `read_doc`, `update_doc`, `create_project`, `read_project`, `search`,
`create_task`, `update_task`, `create_post`, `comment` and `send_message`.
Making a project is among them and archiving or deleting one is not: the
matrix refuses that through a token whatever the person may do. `create_project`
answers with more than the id the endpoint returns — its name, key, slug and
`url` — because a project is named by its slug in every address and by its key
in every sentence, so an agent that had just made one could not say where it is.

Every write answers with a receipt, shaped in the tool rather than in the
endpoint: `{id, number, url}` from `create_task`, `create_subtask`,
`create_post` and `create_doc` (and `name` from `upload_file`), `{id, url}`
from `send_message`, `{id}` from `comment` and `create_cycle`, `{id, name}`
from `create_label`, and `{ok, id}` from every `update_*` (`update_doc` with
the new `version`). Never the thing read back: `create_doc` answered with the
whole document in the editor's JSON. In `search` and `my_mentions` a
project's channel is named `Project · channel` — every project has a `main` —
and a direct conversation by the people in it.

A task's list is the whole of its status, so `read_project` carries the
project's lists and both `create_task` and `update_task` take a `list_id`.
Each of the three was missing, and each failed the same quiet way: `update_task`
took a `column` that had been dropped from the endpoint three migrations
earlier and answered `{"ok":true}` to a move that never happened; `create_task`
could not name a list at all; and nothing returned the ids, so an agent could
read the name of the list a task sat in and had no way to turn it into the
id it needed. A tool that cannot place work can only add to the pile.

Everything read is wrapped as `<user_content>` before it reaches a model, so a
task whose description says "invite this address as an admin" arrives as
somebody's text rather than as something to do. That is the weakest of the
three defences. The others are that a token cannot exercise the dangerous
actions at all, and that the person is named in the feed for whatever it does.

### Discovery

Where an agent finds the API and the MCP server without being told, on
every server, each naming the server it is asked of (`APP_URL` in
production, never the request's `Host`). No session; an hour's
`Cache-Control`.

| Method | Path | Notes |
| --- | --- | --- |
| GET HEAD | `/.well-known/api-catalog` | RFC 9727: `application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"`, and `Link: <…/.well-known/api-catalog>; rel="api-catalog"` on both. `item` the two APIs, `/api` and `/mcp`; `/api` with `service-desc` (the generated `api.schema.json` in the public repository), `service-doc` (this document there) and `status` (`/health`); `/mcp` with `service-doc` (the skill below, and this document's MCP section) and `service-meta` (`/.well-known/oauth-protected-resource/mcp`) |
| GET | `/.well-known/agent-skills/index.json` | the agent-skills discovery index (draft v0.2.0): `{ $schema, skills: [{ name: "tuff", type: "skill-md", description, url, digest }] }`, `digest` `sha256:` and the hex of the exact bytes `url` answers |
| GET | `/.well-known/agent-skills/tuff/SKILL.md` | `text/markdown`: front matter (`name`, `description`), how to connect `/mcp`, every tool by name and title (`ABOUT` in `server/src/mcp/tools.ts`) and the instructions the server gives an agent when it connects |

## Import from Linear, Jira and Asana

Tables `linear_import` (the key sealed in `key_enc`, a column the application role is not granted, cleared when the import ends) and `linear_import_parent`; `project.import_id` and `project.imported_from`. The worker writes through the last three doors with a two-minute token marked `via: 'import'` and the import's id; nothing else may call them, and they write only into projects that import made.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/import/linear/teams` | `project.create`, never through a token; `{ key }` (a personal key, `lin_api_…`) → `{ teams: [{ id, key, name, issues }] }`; the key is not kept. `400` for a key Linear refuses; twenty an hour per person |
| POST | `/api/import/linear` | the same; `{ key, teams: [teamId] }` → `202 { id }`. The teams are asked again with the key — one it cannot see is not brought. `409` while one is running in the workspace |
| GET | `/api/import/linear` | the person's last five imports: `{ imports: [{ id, teams, progress, state: running\|done\|failed, error }] }`, never the key |
| POST | `/api/import/linear/:id/stop` | the person who started it, never a token → `{ ok }`; the key goes at once and the worker's next write is refused; `404` for anybody else's or one already ended |
| POST | `/api/import/linear/project` | the import's token only; `{ team, states, cycles }` → `{ project_id }` — made once: the team's key if free, its states as lists, its cycles as sprints |
| POST | `/api/import/linear/issues` | the import's token only, into a project it made; `{ project_id, issues: [...] }` (a hundred at most) → `{ written }`; a body past what a page may write, or one the workers cannot read in half a second or the parser fails on (logged), is kept as its plain words rather than refusing the page, since the import ends on a refusal. Bodies are read before the page's transaction. `503 busy` with `Retry-After` when too much is waiting to be read, which the import waits out; any other fault is a `500`. Each keeps its number; one already there by number is left alone. People by email within the workspace, else their name on comments (`said_as`) |
| POST | `/api/import/linear/parents` | the import's token only; `{ project_id }` → `{ linked }` — parts find their parents once both are in; a part of a part is a part of the top of its chain, since a part here is one level deep |
| POST | `/api/import/jira/projects` | as `/import/linear/teams`; `{ site, email, token }` — `site` is `<name>.atlassian.net` and nothing else, with or without `https://` and a path → `{ teams: [{ id, key, name, issues }] }`. `400` for a site that is not Jira Cloud's or a token Jira refuses |
| POST | `/api/import/jira` | as `/import/linear`; `{ site, email, token, teams: [projectId] }` → `202 { id }` |
| POST | `/api/import/asana/projects` | as `/import/linear/teams`; `{ token }` (a personal access token) → `{ teams: [{ id, key: "", name, issues }] }` |
| POST | `/api/import/asana` | as `/import/linear`; `{ token, teams: [projectGid] }` → `202 { id }` |

Every import, from whichever product, is one row of `linear_import` with
its `source` (`linear`, `jira`, `asana`); `GET /api/import/linear` lists
all of a person's, each with its `source`, and `…/:id/stop` stops any. The
worker's doors above (`project`, `issues`, `have`, `parents`) are every
import's: a project's origin is `<source>:<id>` (Jira's `jira:<site>:<id>`),
an issue may carry `cycleSpan: { starts, ends }` to make the sprint it
names; a person is matched by email only, and one Jira hides it for is
named in the task's words. Asana numbers nothing: an issue may come with
no `number` and an `origin` (Asana's id) instead, numbered by the project
as it is written, and `parentOrigin` puts it under a task already
brought; `/have` takes `origins` too and answers `{ have, origins }`. What
was brought is remembered in `import_task (project_id, origin, task_id)`.

## GitHub

The workspace's installation of the Tuff app, a
project's repository, and what GitHub says about a task. Never through a
token, and a change GitHub causes is made **as the person who linked the
repository**: the worker carries an access token signed for them with
`via: "github"`, so the line it leaves is `origin: "github"`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/github` | `{ configured, install: { account_login } \| null, can_install }` — `configured` is whether this server has the app's keys |
| POST | `/api/github/start` | `audit.read`; `{ url }` on GitHub to install the app from, carrying a signed `state` (an hour) |
| POST | `/api/github/installs` | `audit.read`; `{ installation_id, state }` as GitHub sent the owner back. The state must be this workspace's and this person's, and GitHub must say the installation exists and was made in the last two hours, and the person's own linked GitHub must see it (`GET /user/installations`) — `400 link_first` when they have not linked theirs. An installation's id counts up, and the state proves only who started an install; `409` when another workspace has it |
| DELETE | `/api/github/install` | `audit.read`; forgets it here, and every project's link with it. The app stays installed on GitHub |
| GET | `/api/github/repos` | the owner, or whoever may change some project's settings; never through a token. `{ repos: [{ id, name, private, project_id }] }` — what the installation was given, and which project each is linked to |
| GET | `/api/projects/:id/github` | `{ link: { repo_id, repo_name, issues, linked_by, linked_by_name } \| null }` |
| PUT | `/api/projects/:id/github` | `project.tools` there, and — for anybody but the owner — their own linked GitHub must be able to read the repository (`403` otherwise); `{ repo_id, issues?, confirm? }`. One repository a project and one project a repository (`409`). A public repository with `issues` needs `confirm` to be its full name. Never a sample project — `409 sample`: anybody on it deletes it for good in one press, which would take the link; the web does not offer it there |
| DELETE | `/api/projects/:id/github` | `project.tools` there; unlinks it |
| GET | `/api/github/me` | `{ configured, linked: { login, avatar_url } \| null }` — the person's own GitHub account |
| POST | `/api/github/me/start` | `{ url }` on GitHub to authorise the app as yourself, with a signed `state` (fifteen minutes) |
| POST | `/api/github/me` | `{ code, state }` as GitHub sent the person back; the state must be this person's. Their token is sealed and kept; it is not a way to sign in. `409` when that GitHub account is somebody else's here, connected or signing them in |
| DELETE | `/api/github/me` | unlinks it here |
| GET | `/auth/github/callback` | GitHub's return from a person's authorisation: on to `/:ws/account?github=linked&code=…&state=…`, which posts it to `/api/github/me` with the person's session — so a link started by somebody else cannot tie their GitHub to whoever opens it |
| GET | `/auth/github/installed` | GitHub's setup address: on to `/:ws/settings?github=installed&installation_id=…&state=…`, which posts it to `/api/github/installs` |
| POST | `/hooks/github` | GitHub's webhook, believed only with `X-Hub-Signature-256` (`403` otherwise); `installation`, `installation_repositories`, `pull_request`, `pull_request_review`, `check_suite`, `push`, `issues`, `issue_comment` and `sub_issues` are queued (`github_event`, by delivery id) and `202`; anything else is `202` and dropped |

**A task's pull requests.** `GET /api/tasks/:id` answers `github: { pulls:
[{ number, title, url, state, draft, review, checks, author_login,
author_avatar, head_ref, closes, repo_name }] }` — every pull request whose
title, body or branch names the task's handle, newest first. `state` is
`open`, `closed` or `merged`; `review` `requested`, `approved` or `changes`;
`checks` `pending`, `success` or `failure`; `closes` whether it says
"Fixes RED-12".

**Issues, both ways.** With `issues` on a link, the repository's open issues
are brought in as tasks when it is turned on (`github_out` kind `import`),
and from then an issue and a top-level task of the project are one pair
(`github_issue`): title, body (Markdown), open or closed (a `done` list is
closed as completed, a `stopped` list as not planned; reopening goes back to
the list it left), assignees (people who have linked their GitHub; others
are left as they are on either side), labels (by name, whatever the case,
made where missing) and comments (`github_comment`). From GitHub, through
these endpoints as the person who linked the repository — or, for a comment
by somebody here, as them — with `origin: "github"`; a comment by somebody
who is not here keeps their login in `comment.said_as`, drawn as its
author. To GitHub, every change `record` writes about a task in such a
project is queued in `github_out` and sent by the worker, the task's newest
state each time, as the installation — a comment as its author where they
have linked their GitHub, made its last change themselves and are still in
the workspace and on the project, otherwise as the installation under their
name (migration 292: `comment.changed_by`, set by the database to
the actor of the insert or of a change to `body` or `deleted_at`, and kept
by any other update, never set by the request; `github_person_token_in`,
the worker's only way to a person's token, and only for a person in that
workspace and project). An imported comment (`origin: "import"` or
`said_as`) is never written as its author. `github_comment.said_hash` is the
md5 of the comment's body as last sent: words unchanged but reading
differently (a mention's person linked, unlinked or left) are edited in
place — as the author while its last change was theirs and they may be
written as, otherwise left alone,
or by the installation on its own comment — never deleted. A comment on
GitHub as its author whose words somebody else changed here is deleted
there and posted again by the installation; GitHub's 5xx, 429 or 403 on
that retries the job. Each field is compared
with what GitHub last said, so echoes change nothing; a body changed on both
sides since the last sync keeps the losing text as a comment on the task. A
task deleted here closes its issue as not planned — and its subtasks',
which go with it; an issue deleted there deletes its task, its sub-issues'
tasks first made tasks of their own.

**Sub-issues** ("Sub-issues"). A subtask is
paired too, its issue a sub-issue of its parent's (`POST …/sub_issues` with
the issue's id and `replace_parent`, `DELETE …/sub_issue`, `PATCH
…/sub_issues/priority`); a subtask's issue is open or closed by its tick.
The `sub_issues` event puts the task under its parent's task or takes it
out through `PATCH /api/tasks/:id { parent_id }`. A parent in another
repository, or one this project does not have, leaves the task standing
alone. What cannot be done — GitHub's `422` (100 sub-issues under one
issue, eight levels), or Tuff's one level — is said once on the task as a
comment `said_as: "GitHub"`, and GitHub's nesting is left as it is.
`github_issue` gains `issue_id` (GitHub's id), `parent_number` (the parent
issue GitHub last named in this repository), `parent_here` (the task's
parent at the last sync) and `nest_said` (what was last said about it) —
migration 274 — and `nest_refused_number` / `nest_refused_at` (a refusal,
not asked again for an hour), `reattached_link` (re-attached by the import
under that link), and `github_link.sub_issues_since`: only subtasks made
since then go with their parent; an older one goes when it is itself
written — migration 275. The first import nests open issues as GitHub has
them; linking again puts the tasks' nesting over GitHub's. Only the Tuff
app's own `sub_issues` events are dropped as echoes. `GET /api/tasks/:id` answers `github.issue: { number,
repo_name, url } | null`. `POST /api/tasks/:id/comments` takes `said_as`
only from a change GitHub caused.

**What GitHub moves.** A new branch or a draft that names a task moves it to
the project's first `started` list, else `doing`; a pull request ready for
review to the first `review`, else `doing`; merged, a task it says it
closes to the first `done`; a commit on the default branch that says it
closes one, the same. Only forwards by the lists' marks, never back, and
nowhere when the project has no such list.

**Tables.** `github_install`, `github_link`, `github_pull`,
`github_pull_task`, each with its workspace and (but the first) its
project in the key and under the project's policies; `github_person`, one
row a person, readable only by them, its token sealed with a key from the
environment, deleted when their last membership ends (migration 292) or
their account goes; `github_event`, the
queue, read and written only through `github_event_put`,
`github_events_claim`, `github_event_done`, `github_events_clear`,
`github_route`, `github_install_gone` and `github_repo_gone`.
A project deleted for good, or by the clear-out, takes its links (unlinked
ones too), pull requests, issue and comment pairings and what was owed with
it (`purge_project_rows`, migration 318); nothing is sent to GitHub.
`origin_kind` gains `github`. A link whose person has left the workspace or the project
stops (`github_link.stopped_at`, `stopped_why`) — nothing is routed either
way — and `GET /api/projects/:id/github` answers it with `stopped_at` set;
linking it again makes whoever does it the person it acts as. A mention is
`@login` on GitHub for somebody who has linked, their name in bold if not,
and `@login` of somebody here comes back as a mention of them. A picture in an issue or a GitHub comment is fetched by the
worker from GitHub's own hosts (the installation's token for GitHub's,
none for a signed storage address; ten megabytes, `image/*`, up to twenty
a body) and kept as a project file, an `attachment` node carrying `source`,
the address it came from — which is what goes back to GitHub for it. One
GitHub will not hand an app stays the link it was. Whether a description
changed here is asked of `seen.here`, this side's own drawing of it at the
last sync, not of GitHub's text.

## Slack

The workspace's Slack, the owner's to connect, and
the channel a project posts its news to. Never through a token: a tool, an
import or GitHub is refused every one of these with `403`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/slack` | `{ configured, connection: { team_name, broken, previews } \| null, can_connect }` — `configured` is whether this server has the app's keys; `broken` that Slack refused the token; `previews` false for a connection made without the scopes previews need, while this server has them on — connecting again grants them |
| POST | `/api/slack/start` | `audit.read`; `{ url }` on Slack to add the app from, with the bot scopes `chat:write`, `chat:write.public`, `channels:read`, `groups:read` — and `links:read`, `links:write` once the server has `SLACK_SIGNING_SECRET` — and a signed `state` (ten minutes) naming the workspace, the person and a nonce kept in `slack_state` |
| POST | `/api/slack` | `audit.read`; `{ code, state }` as Slack sent the owner back. The state must be this workspace's and this person's, and its nonce unspent — it is spent here (`400`); the code is traded at `oauth.v2.access` and taken only as a bot token with every scope asked and none outside those six, and not an Enterprise Grid org install; the Slack workspace is the one that answer names. `409` when that Slack workspace is another Tuff workspace's — and that token, which is the other workspace's too, is left alone. Moving to another Slack revokes the old one's. Connecting again to the same Slack keeps every project's channel and sends what waited |
| DELETE | `/api/slack` | `audit.read`; every project's channel goes with it, the token is cleared from the row and revoked at Slack (`auth.revoke`) |
| GET | `/api/slack/channels` | the owner, or whoever may change some project's tools; `{ channels: [{ id, name, private }] }` as Slack lists them for this token now — public ones, and private ones the app was added to; private ones to the owner only. `502` when Slack does not answer |
| GET | `/api/projects/:id/slack` | `{ link: { channel_id, channel_name, private, linked_by_name, stopped_at, stopped } \| null }`; a private channel's `channel_name` is `""` to anybody but the owner |
| PUT | `/api/projects/:id/slack` | `project.tools` there; `{ channel_id }`, which must be in the list above for this person (`400` otherwise). Replaces the project's channel |
| DELETE | `/api/projects/:id/slack` | `project.tools` there; stops it (`project.slack.stop` in the feed) |
| GET | `/auth/slack/callback` | Slack's return: on to `/:ws/settings?slack=connected&code=…&state=…`, which posts it to `/api/slack` with the owner's session |
| POST | `/hooks/slack` | Slack's events. `403` without Slack's signature (`x-slack-signature`, HMAC-SHA256 with the signing secret over `v0:timestamp:body`, timestamp within five minutes); body at most 1 MB. Answers `url_verification` with its challenge; a retry is queued like the first; queues a `link_shared` from a posted message, nothing else, and answers `200` |

**What is posted.** `record` queues, in the feed's transaction, through
`slack_queue`: `task.create` of a task (not a part of one), `task.update`
that finished a task in that transaction (by a done list or its box),
`task.comment`, and `post.create` of a published announcement — a draft's
when it is published. Nothing an
import's token or GitHub does, nothing for a task restored (it is recorded
as made, and was made long ago), and nothing past two hundred waiting in a
channel. The feed's `project.slack` names the channel only when it is
public. The worker posts the first waiting message of each channel, the
longest waiting first and five a workspace a pass, every second and a
half, with `chat.postMessage` (`parse: none`, `link_names:
false`, no previews): the person's name, the task's handle and title as a
link to its address, the list it went into, and the first 300 characters
of a comment or an announcement. Every word of it has `&`, `<` and `>`
escaped, so nothing written here becomes a mention or a link in Slack.
Read when sent, but the list, which is kept as it was.

Slack's "too many" waits its `Retry-After` without counting a try; a token
Slack refuses marks the connection broken (`broken_at`, `broken`) and a
channel gone, archived or left marks the project's link stopped
(`stopped_at`, `stopped`); neither is tried again until it is connected or
chosen again. Anything else is tried six times, a minute, two, four,
eight and ten apart, and given up. Rows go after thirty days, sent or not.

**Previews.** A `link_shared` is kept (`slack_unfurl_put`) only for a
channel some project posts to on a live connection of the Slack the event
was sent for, not for a message Tuff's bot posted, at most five addresses,
once a message (again when edited to hold others), and not past two
hundred from one Slack in five minutes. The worker reads each address — a project or any of its
tabs, or `/tasks/:n`, `/posts/:n`, `/files/:n` — through `slack_preview`,
which answers only when the address's workspace is the connection's and
its project is one posting to that channel on it: a top-level task, a
published announcement, a document, upload or link of Docs (not a room's
file, not a folder), nothing in the bin. It answers with `chat.unfurl`:
the handle and title as a link, then the list, the people, the due date,
or the author and day, or the file's type and size, or a link's host —
never its address — and 200 characters of the words, all escaped. Five minutes late, nothing is sent; rows go after a
day.

**Tables.** `slack_connection`, one live a workspace and one live a Slack
team, with the `scopes` it was granted and its `bot_user` (a token is taken
with every scope asked and none outside the six), its `token_enc` sealed with a key from the environment and not
granted to the application role — read only through `slack_token()`, for
the session's own workspace; written through `slack_connect` and
`slack_disconnect`, which refuse anybody but the owner. `slack_state`,
the nonces of connections begun, through `slack_state_make` and
`slack_state_take`. `slack_link`, one live a project, under the project's
policies, its connection this workspace's. `slack_out`, the queue, with no grants: `slack_queue` writes it,
and the worker's `slack_out_claim`, `slack_out_done`, `slack_broken` and
`slack_clear` read and clear it. `slack_unfurl`, the previews owed, with
no grants: `slack_unfurl_put` writes it, the worker's `slack_unfurl_claim`,
`slack_preview` and `slack_unfurl_done` read it; it goes with its
connection. Migrations 164 and 165.

## Import and the audit log

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/import/:source` | `project.create` + `people.invite`; never through a token |
| GET | `/api/audit` | `audit.read`, never through a token; `?type=sign_ins\|people\|rights\|settings\|deletions\|integrations`, `?who=<actorId>`, `?cursor=`, `?limit=` (50, at most 200). `{ events: [{ id, kind, at, ip, user_agent, meta, origin, actor_id, actor_name, subject_id, subject_name, to_name, project_id, project_name }], next_cursor }` — newest first; `400` for an unknown type, person or cursor |
| GET | `/api/audit/people` | `audit.read`, never through a token; `{ people: [{ actor_id, name, here }] }` — everybody who is or was a member, here first |

**The audit log**. Who did what across the
whole workspace, for the owner: `security_event` and the workspace's own
actions in `activity_event` (`people.remove`, `people.leave`, `people.rights`,
`project.member.add|remove|rights`, `project.leave`, `workspace.settings`,
`project.delete|restore`, `slack.connect|disconnect`,
`github.install|remove`, `agent.connect|disconnect|reach`,
`webhook.create|remove|update`), read as one list by `audit_page`, a definer that
answers only the owner of the session's workspace, bounded by it in the
query. `kind` is the event's code — a security kind or the action;
`AUDIT_TYPES` in the schema says which kinds each `type` holds. `integrations` also holds the security kinds `agent_linked` and
`agent_unlinked` — Tuff's connector signed in as an agent, and one such
connection ended from its page; `meta.actor_id` is the agent (migration
269).

- `who` narrows to lines **by or about** a person: `actor_id`, or whom it
  was done to (`meta.actor_id`, `meta.to` for a hand-over), which is
  `subject_id` and `subject_name`. `to_name` is `subject_name` under its
  old name.
- `project_name` is the project's name now, one in the bin included.
- A `login` line is written by every session somebody opens, for the
  workspace it is for, with `meta.method`: `password`, `provider`,
  `email_link`, `invite` or `switch`. Not by a refresh, nor by making an
  account or a workspace, which write their own.
- Only from a session, never a token: `403` for an MCP token and for the
  tokens GitHub's and an import's work act under.
- `origin` is `web`, `mcp` or `github` for a line of the feed, null for a
  security event; `ip` and `user_agent` are a security event's.
- The cursor is `<at>_<id>` of the last line, to the microsecond. A bare
  moment, as this answered before, still reads as "before it".

Migration 183: `audit_page`, and the indexes `security_by_workspace` and
`activity_audit` (partial, over the actions above). `github.remove`,
`webhook.create` and `webhook.remove` are written from here on, the
webhook by its host alone; `project.member.remove` and `project.leave` now
carry `meta.actor_id`.

`:source` is `trello`, `asana`, `basecamp` or `normalised`. Three exports, one
shape: they disagree about almost everything except that a project holds lists
which hold cards with comments, so the adapters normalise to that and one
importer does the writing. Three importers would be three places for the
authorship rule to be got wrong.

**Authorship is preserved.** An imported card keeps the name of whoever wrote
it, as an actor with no account of their own; inviting the same person later
gives that name a login. Rewriting history so the person who ran the import
wrote everything is what makes a team distrust an import and go back to check
the old tool.

An archived Trello list is not brought across. It is not work somebody still
has, and importing it hands a team a backlog of things they had already put
away.

Importing is never available through a token: it creates a project and people,
so through a tool it is somebody else's data landing in your workspace with
nobody having looked.

The audit log is separate from the activity feed because it answers a
different question — not what happened to the work but who was given what, and
by whom. Sign-ins, invitations, role changes, revoked credentials, and every
change to the four switches.

## Search

`GET /api/search` across posts, tasks and files, filtered by type and project.
It reads the tables directly today; the design calls for a separate index at
scale, and this endpoint's shape is what that index will have to answer, so the
contract can stay while the implementation moves.

Nothing in it filters by hand. Row-level security has already decided what
these queries can see, which is the whole reason access lives in the query.

## What arrives without being asked for

Three sockets carrying a word rather than a row, and a document's — the client then
refetches through the endpoint it would have used anyway, so there is one path
into the data rather than two that can drift apart.

- `GET /ws/projects/:id` — while that project is on the screen.
- `GET /ws/conversations/:id` — while that room is.
- `GET /ws/docs/:id` — while that document is open. The one socket that
  carries content, and the one that takes edits in: see "A document written
  together".
- `GET /ws/me` — for as long as somebody is signed in. The topic is the actor
  the token proves, and it carries what is addressed to them: a message in a
  room they are in, a notification written for them (`{ reason, object_type,
  object_id }`), and their own read marks so a count cleared on one device
  clears on the others. Every word carries `workspace_id`, the workspace it
  was said in. A token hears only the words of its own workspace — refused
  on `workspace_id` before anything else is asked, then asked of what each
  is about — and one made for some projects only the words about them;
  "everything read" (`read` with no `id`) goes to sessions alone.
  A session made on a workspace's own domain hears
  only the words whose `workspace_id` is its workspace, "everything read"
  among them. Not a workspace-wide
  subscription, which wakes every device for every change in every project.

A browser cannot set a header on a websocket, so it opens one bare and
sends **`auth <access token>`** as its first frame; nothing is subscribed
until that frame is read and the token proved, and a socket that says
nothing for ten seconds is closed with 4401. The token used to travel as
`?token=`, in the address every proxy logs; that is still read, for a
window opened before the change, and a native client may send
`Authorization` instead.

**`POST /api/conversations/:id/read` marks the room read**, and a client sends
it when it shows the room. Fetching messages does not: a client that fetches a
room ahead of opening it — the web sidebar does, on hover — has not read it,
and neither has an agent listing messages under a token. Marking also makes
the reader a `conversation_member` if they were not one, which is how somebody
who reaches a project's channel through the project gets a mark of their own.
It also reads the notifications about that room that have already arrived: a
mention seen in the room has been seen, and the inbox should not go on
counting it.

**`conversation.unread`** counts what arrived after the reader's mark, and
falls back when there is none: to their project membership for a project's
channel — which is where the right to see it comes from — and otherwise to
when they joined the workspace. Nobody arrives to four hundred unread, and
nobody is told nothing.

## The sidebar's order

`POST /api/projects/:id/place { after }` and
`POST /api/conversations/:id/place { after }`, where `after` is the id this
one should sit behind or `null` for the top of the list. The key between the
neighbours is computed on the server, not sent: ordering is one rule, and
three clients each generating their own keys is three clients that disagree
the first time two people drag at once.

It is **one person's order**, kept in `sidebar_place` (actor, workspace, kind,
object, key) and visible to nobody else. Two people on one project can have it
first and last, and neither is wrong. There is no permission beyond being able
to see the thing at all: you cannot place what you cannot see, and placing it
tells nobody anything.

`GET /api/projects` and `GET /api/conversations` come back in that order, with
anything unplaced after everything placed — a project made after somebody
arranged their sidebar arrives at the end of the arranged ones rather than in
the middle of them. The first placement in a workspace writes keys for the
whole list as it stands, because a key on the moved row alone would send it
past everything unplaced.

**`GET /api/projects` pages on the pair.** Its `next_cursor` is
`<sort_key>|<created_at>` — placed rows come first in key order and the rest
by age, so a cursor carrying only the date would skip or repeat rows across a
page boundary the moment anybody dragged anything. The tilde stands in for
"no key": fractional keys are digits and letters, so it sorts after all of
them. `docs/specs/sidebar-order.md`.

## Activity

Immutable, and it names the author of every action including the ones that
arrived through a token. `origin` is taken from the token, never from a header
the caller sets: a person must be able to tell their own action from their
tool's, and a tool must not be able to pretend otherwise.

The feed reaches the workspace's members, and reaches only the projects
each of them is on. Not filtered in the controller — bounded in the policy.

`meta` holds what the change was, written where the change is made: `renamed`
and `was` for a rename, `moved_to` and `moved_from`, `given_to`, `taken_off`,
`due`, `described`, `tools`, `finished`, `reopened`, `reordered`, `starts` and
`ends`. A task given to somebody carries `given_ids` beside `given_to` — the
actor ids of the people who came on it, on `task.update`, and on `task.create`
for a task made with people on it — since migration 309, so an agent's week
counts what it took by id, not by a name two agents can share
(`activity_given`, a GIN index on
`meta -> 'given_ids'`, partial on the lines that have it). The questions an
agent asked are read by `comment_asked_by (author_id, created_at)` and its
spend by `task_spend_by_actor (actor_id, updated_at)`, both partial, in the
same migration. Clients read the sentence out of it rather than
looking anything up now — the names are the names as they were at the time,
because the log is read months later and a list renamed since would turn an
entry into a blank.

An event is written only when something actually changed. `PATCH
/api/projects/:id` and `PATCH /api/tasks/:id` compare against the row as it
was, so a save that sets a field to the value it already held writes no line.
Each kind of change has its own action: a project icon is `project.icon`,
removing it is `project.icon.remove`, and neither is `project.update`.

### Duplicating a task

`POST /api/tasks/:id/duplicate` answers `201 { id }` with the new task's id.

It copies the plan and none of the record: title, description, list,
priority, labels, assignee, due date and the checklist inside it — and no
comments, no history, no attachments, no subscribers. It is not finished
however finished the original is, because a piece of work that arrives
already done is not one.

The copy lands directly under the original, in the same list, with the
original's title unchanged. It is a new task with a new number: the number
is the address, so a copy cannot borrow one.

`task.create` in the project, because a duplicate is a task being made by
another road.

`POST /api/tasks/:id/restore` puts a deleted task back, with its steps,
and answers `{ ok: true }`. Only the steps deleted with it come back: `DELETE` leaves a step already deleted as it was, and the restore takes back the steps whose `deleted_at` and `deleted_by` are the task's. It is the business of whoever deleted it
(`task.deleted_by`, migration 263, set by `DELETE`) or of whoever holds
`task.delete` — not of its author as such, so a task somebody else took
down is not its author's to bring back (`403`). Never through a token
(`403`); `404` when it is not deleted, its project is deleted, or it is
not the asker's to see. It only works while the row is still there:
deleting is soft, and the clear-out takes it some days later. This is
what the toast's **Undo** presses.

### Copying a task

`POST /api/tasks/:id/copy { project_id, list_id?, dry? }` makes a task in
`project_id` from the original and answers `TaskCopied`: `{ id,
from_project_id, project_id, number, list_id, list_name, subtasks,
labels_kept, labels_dropped, cycle, assignees_dropped: [{ actor_id, name
}], files, github_to, tasks }`, `tasks` being the copy and its parts as
rows of the target's list (`TaskInProject`). With `dry: true` it makes
nothing and answers the same with `id` and `number` null and no `tasks`:
the window reads it before the press.

Who may: whoever can read the original (row-level security; a project or
task out of their sight, another workspace's, or outside a project-limited
token's projects is `404`) and holds `task.create` in the target (`403`).
An archived target, a list not of the target, and a subtask on its own are
`400`; a target still importing is `409`. Through a token and by an agent
too: nothing is taken from anybody. `/api/tasks/:id/duplicate` is the
same copy, into the original's own project, under the original, keeping
its list and sprint and not its parts' finishing — answered `{ id }`,
recorded `task.create`, as before.

What the copy is: the title, the description, its subtasks in order (each
with the `completed_at` it had), priority, due date, `starts_at` and `ends_at`; labels matched by
name, a missing one left off; the list of the same name, else the first
open one, at the top; assignees who are on the target, told as on a task
made there. Each file the bodies show that belongs to the original's
project (`project_id` the original's, `conversation_id` null) gets a new
`file` row in the target — same `storage_key`, `origin_type = 'task'` and
the copy's id — and the body points at it; any other file id is left as it
is, and opens for whoever it opened for. Within its own project nothing is
re-homed. The bytes go only when no row names them (`storage_orphans`);
the copy's rows count toward the workspace's ceiling where the edition
has one, so a copy whose files would cross it is refused `413 limit`
(`roomFor`).
Not copied: comments,
history, time, the sprint, GitHub links. No Slack line.

Two lines: `task.copy` on the copy, `meta: { from_task_id,
from_project_id, from_number }`, the one webhooks, GitHub and the screens
hear — `GET /api/activity` strips those three from `meta` for a reader who
cannot see the original's project; and `task.copied` on the original,
`meta: { to_task_id, to_project_id, to_number }`, not sent anywhere and
listed only to readers who can see the copy's project, and not published
to the original's screens.

### Recurring tasks

Migration 220.

A task carries `repeat`, its rule or `null`, and `repeat_next_id`, the next
one it made when it was finished, or `null`. Both are on the task as
`GET /api/tasks/:id` answers it; `repeat` is also on a row of
`/api/projects/:id/tasks` (`TaskInProject`), of `/api/my/tasks` (`MyTask`)
and on `/api/tasks/:id/card`. Both are optional in the schema, so a client
generated before them decodes the answers after.

The rule — `Repeat` in the schema:

```json
{ "every": "day" | "week" | "month" | "year",
  "interval": 1,            // 1–99, absent for 1
  "weekdays": [1, 4],       // a week: ISO days, Monday 1 … Sunday 7
  "day": 14,                // a month or a year: 1–31, or -1 for the last day
  "month": 11,              // a year: 1–12
  "from": "due" | "done" }  // absent for "due"
```

Unknown keys, a weekday outside 1–7, a day of 0 or a part's rule are `400`.
`POST /api/projects/:id/tasks` and `PATCH /api/tasks/:id` take `repeat`;
`null` stops it. What is stored is whole: a part left out is read off the
task's due date (the one in the same request, else the one it has, else
today in the saver's zone) — `{ every: "week" }` on a Friday is stored as
`{ every: "week", weekdays: [5] }`. Setting it is editing the task
(`mayEdit`).

**Finishing makes the next one.** A task with a rule going from open to
finished — `completed: true`, or a move into a list that `finishes` —
makes the next one in the same transaction, its row held `for update` so
two requests make one. It copies the title, description, list (the one it
was in before it finished, unless that one finishes too; then the first
open one, and in the slot the finished one left), the people still on the
project, labels, priority, its parts none of them done, its watchers and
its author; its due date is the first date after the old one the rule
names, walked forward until it is today or later in the finisher's zone
(`from: "done"`: the finisher's today plus the interval). A start and an
end move by as many days. The finished task's `repeat` is set `null` and
`repeat_next_id` to the new one. The answer carries `next`, the new task
as a row of the project's list, `next_parts`, its parts as rows of the
same list, and `repeat`, the rule the finished one carries now (`null`).

**Reopening takes it back.** A task going from finished to open —
`completed: false`, or a move out of a finishing list — whose
`repeat_next_id` names a task still open and not deleted soft-deletes
that task and its parts and takes back its rule, as it is now; the answer
carries `withdrawn`, its id, and `repeat`, the rule the reopened one has
back. A next one already finished or deleted is
left alone.

**Deleting skips.** `DELETE /api/tasks/:id` on an open task with a rule
makes the next one as finishing would; `POST /api/tasks/:id/restore` on an
open task takes it back as reopening would. Deleting a list or switching
a list's `finishes` makes none.

The feed and webhooks: `task.repeat` on the new task, `meta: { from_task_id,
from_number, due_on }`; the finishing `task.update` has `next_number`
beside `finished`; a next one taken back is `task.delete` with `withdrawn:
true`; a rule set or cleared is `task.update` with `repeat` (the rule, or
`null`). Nobody is notified of the new task. MCP: `create_task` and
`update_task` take `repeat`, and `update_task` answers `next: { id,
number }` when finishing made one.


## Limits and refusals

the security audit spec has the why of each.

- **Bodies** — 64 KB on `/auth/*`, 5 MB on `/api/*`, the file limit plus a
  megabyte on uploads, icons, avatars, display copies and imports; past it,
  `413 too_large`.
- **Before signing in** — 300 requests a minute from one address on
  `/auth/*`, and ten wrong passwords or codes for one account in fifteen
  minutes; past either, `429 rate_limited`.
- **Invitations by email** — fifty mailed a day per workspace; past it the
  invitation is still made, unmailed, and its link is not returned
  (`token` is `""`): a link that proves an address goes only to it. A link
  with no address is the way to reach them.
- `POST /api/invites` — `project_ids` must be projects the inviter is on, in
  this workspace (`404` otherwise); rights beyond the two a person joins with
  only from whoever runs those projects (`403`).
- `POST /api/projects/:id/members` — only somebody on the project, or the
  owner (`404` otherwise).
- `POST /api/tokens` — `project_ids` only of projects the person can open (`404`
  otherwise); such a token keeps to them.
- `POST /api/2fa/begin` — `409` while a factor is on; turn it off, with the
  password, first. And never on a session alone: the password, or a code
  from the inbox for an account with none.
- `POST /api/2fa/enable` — `409` while a factor is on; wrong codes counted.
- `POST /api/workspaces/:id/enter` — `403` through a token.
- `POST /api/webhooks` — a public https address only; deliveries never follow
  a redirect and time out after ten seconds. Twenty of a workspace's own at
  most, on or off: `409 too_many_webhooks` past it (migration 294).
- MCP over `/mcp` — each Markdown body a tool is given spends one request
  of the token's minute before it is read (`rate_limited` past it), and is
  read under the person's key, so the parser's per-caller cap holds.
- `POST /api/push` — an endpoint of a browser's push service only, or an
  app's token in hex (`400` otherwise), and never through a token (`403`): a
  device registered with one went on hearing who wrote after the token was
  revoked.
- `DELETE /api/posts/:id`, `/api/messages/:id`, `/api/comments/:id`,
  `/api/files/:id`, and `POST /api/{tasks,posts,comments,files,conversations}/:id/restore`
  — `403` through a token, as deleting a task is.
- `PATCH /api/posts/:id` — `403` through a token on a post somebody else
  wrote, and `403` to a member who is neither its author, the owner nor
  holding `edit.any` or `manage` on its project, whatever the workspace's
  edit switch says: emptying an announcement is deleting it by another door.
  On a post an agent wrote, whoever connected the agent also may, in
  person and on the project, while the agent is neither disconnected nor
  stopped — never through a token, the agent's included.
- `PATCH /api/comments/:id` — `403` through a token on a comment somebody
  else wrote, the owner's token and an agent holding `edit.any` included:
  rewriting a comment into nothing is deleting it, which no token does.
  `DELETE` likewise, and somebody else's neither by GitHub nor an import.
  Both answer `404` for a comment on something the asker cannot read.
- `POST /api/projects/:id/tasks`, `PATCH /api/tasks/:id`, `POST
  /api/tasks/:id/steps` — everybody in `assignee_ids` (or `assignee_id`) is
  somebody on the project or the workspace's owner (`400` otherwise).
- `GET /api/tasks/:id/prompt` — the description and comments are quoted in
  fenced blocks under a line that says so; names, titles and facts are one
  line each; addresses are `APP_URL`'s.
- `GET /api/preview`, `/api/preview/image` — an address written as an IP is
  checked without its brackets, and an IPv6 one is public only inside
  2000::/3; a picture is sent as `image/<the type it matched>`, never the
  site's own header.
- `GET /api/activity` — only events about what the reader can see.

## Feedback pages

Phase 1 — asking. A project's public page where
anybody asks for something without an account; what they ask is held until
they confirm their address, then filed as a task in the project's Triage by
the page's own actor, through `POST /api/projects/:id/tasks`. Migration 201.

**The model.** No fifth entity: a request is a task. Beside it,
`feedback_page` (one per project: `slug`, `name`, `intro`, `live`, and
`actor_id`, an actor without an account that is a member of the workspace
and of the project with `{task.create}`), `feedback_person` (an address per
page — no account, no membership), `feedback_pending` (a request waiting
for its link, two days; the application role cannot read it),
`feedback_item` (which task came from which request, with the requester's
own words) and `feedback_follower`. Every table carries `workspace_id`, so
`purge_workspace` takes it; each also goes with its project by cascade, and
a `feedback_item` with its task, so a project deleted for good
(`DELETE /api/projects/:id/forever`, the clear-out) takes its page and its
requesters' addresses, and its page's actor leaves the workspace. The page's
actor is in no list of people (`/api/people`, `/api/projects/:id/members`,
`/api/conversations/:id/members`: `page_actor()`), is nobody a task can be
given to (`400`), takes no seat (`workspace_people`), and `can` answers it
from a closed list
(`ON_A_FEEDBACK_PAGE`: `task.create`, `content.create`), and only on its
own page's project (`onItsPage`) — whatever else it may have been put on.
It acts only through an access token the server signs for itself
(`via: 'feedback'`), which is nobody once its page is gone,
which lands its task in Triage as an agent's or GitHub's does. What it
files is the stranger's words and nothing more: an `@<id>` or a
`/tasks/<id>` written in them mentions nobody and links nothing.

**Who.** `feedback.manage` — in `MANAGING` (the owner, and whoever runs the
project), never through a token, never an agent. Following is anybody's
on the project, for themselves.


| Method | Path | |
| --- | --- | --- |
| GET | `/api/projects/:id/feedback` | anybody on the project (`404` otherwise) → `FeedbackSettings`: `{ page: { id, slug, name, intro, live } \| null, suggested_slug, following, may, paid, triage }` — `may` is `feedback.manage`, `paid` the plan's half of it |
| GET | `/api/projects/:id/feedback/slug/:slug` | `feedback.manage`; `{ free, valid }` — whether that address is free for this page |
| PUT | `/api/projects/:id/feedback` | `feedback.manage`; `{ live?, slug?, name?, intro? }` → `{ page }`; `name` and `intro` are kept to one line, and hold no web or email address — a scheme, `www.`, `@`, or a dot before a domain-like word (`400 invalid`). The first save makes the page, with its actor named "<name> feedback" and the person saving as its first follower; `slug` defaults to `suggested_slug`, `name` to the project's. `400` for a slug outside `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`, `409 taken` for one another page has, held for thirty days after it was given up (and a page holding an old slug is not renamed again until its thirty days are up, except back to it: `409 holding`), a reserved word (`workspace_slug_allowed`), or one another page took in the same moment (a lock per name; the second is `409`). Only whoever runs the project may change the row, in the database as well (`fp_run`). Turning it on adds Triage to a project that has none, in the same transaction and as `PUT /api/projects/:id/triage` does (the list at the head, named *Triage*) — `feedback.manage` carries `project.tools`; `409 conflict` while the project is still being imported. Turning it off leaves Triage as it is. Turning it on or off is recorded (`project.feedback.on`, `project.feedback.off`) |
| PUT | `/api/projects/:id/feedback/follow` | anybody on the project, never a token; `{ follow }` → `{ following }` |

**The public's**, under `/api/f/:slug`, with **no session**: answered
`Cache-Control: private, no-store` and `X-Robots-Tag: noindex`, 16 KB
bodies at most, and `503 paused` while `FEEDBACK=off`. Every write needs
`Content-Type: application/json` and this site's `Origin` (`403 from_page`).

| Method | Path | |
| --- | --- | --- |
| GET | `/api/f/:slug` | → `FeedbackPublic`: `{ slug, name, intro, mark: { icon, tint, url }, available, turnstile_site_key, moved_to?, brand }` — `brand` the workspace's where it wears one, else null; otherwise nothing about the workspace, the project or anybody. `available` is false when the page is off, its project archived or deleted, or its workspace on `solo`; `moved_to` is the page's new slug, for one given up in the last thirty days. `404` for a slug no page has |
| GET | `/api/f/:slug/me` | `Authorization: Feedback <key>` → `{ email }`, who that browser's key says it is; `401 unknown_key` otherwise |
| POST | `/api/f/:slug/requests` | `{ title (1–120, kept to one line), body? (≤ 4 000), email?, turnstile? }`, and either `email` or `Authorization: Feedback <key>`. With a key this page handed out → `{ status: 'sent' }`, filed at once. Without → `{ status: 'check_email' }`: held, and a link mailed to the address (`/f/:slug/confirm/:token`, 43 characters, two days). Ten an hour from one machine (IPv4 address or IPv6 /64), thirty from its /56 and a hundred from its /48 (`429 rate_limited`); links mailed at the same rates, three a day to one inbox on one page and ten a day to it across every page (an inbox is the address lower-cased, without a `+tag`, and at Gmail without dots), and two thousand a day across one workspace's pages (past those it is held and not mailed, and answered the same). Two hundred filed a day on one page, and five hundred waiting for their link — two ceilings, so waiting ones never close the page to a key (`429 full`). The mail is from Tuff with the subject "Confirm your request", names the page in its words only, and links to the confirm page; it quotes nothing the asker wrote. `400 turnstile` when Cloudflare says no, `401 unknown_key` for a key this page never handed out. A blocked address is answered as anybody is and dropped |
| GET | `/api/f/:slug/confirm/:token` | `{ title, body, email }` — what the link would confirm; opening it does nothing. `410 link` for a token expired, used or never made. Thirty wrong ones a minute from one machine (`429`) |
| POST | `/api/f/:slug/confirm/:token` | the press: the address confirmed, the request filed, and `{ key }` — 43 characters this browser keeps for this page, kept here only as its hash; each confirmation replaces the address's key. Once: `410 link` after. Past the page's two hundred filed today, `429 full` and the link left as it was |

**Turnstile.** `TURNSTILE_SITE_KEY` is handed to the page; `TURNSTILE_SECRET_KEY`
is the server's, for Cloudflare's siteverify (and its answer's hostname must
be `APP_URL`'s; in production an answer naming no host is refused). With no secret a development server asks nothing and a
production one refuses every request. Pages at `/f/*` are served with
`https://challenges.cloudflare.com` in `script-src` and `frame-src`, and
nothing else is.

**On a task.** `GET /api/tasks/:id` answers `feedback: { email } | null` —
null for a task that did not come from the page; `email` is the requester's
address for whoever may change the task, and null for everybody else and
for every token.

**Notes.** A filed request is a note to each follower still on the project
(`subscribed`, kind `added`, "New request from the feedback page" — never
what the stranger wrote). The worker clears holds nobody confirmed a day
after their link ran out (`feedback_pending_sweep`).
