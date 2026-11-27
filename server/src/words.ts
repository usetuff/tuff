import type { Context } from 'hono'
import { withoutActor, type Tx } from './db.js'
import { edition } from './edition.js'

/**
 * What the server says in a person's language.
 *
 * Three kinds of thing: the message an error carries, which a screen shows
 * as it is; what is sent to somebody who is not looking — a mail, a push;
 * and what a template puts in a new project. Each is in the language of
 * whoever reads it, which is not always whoever is asking: a push is
 * composed while somebody else acts, and an invitation is read by somebody
 * with no account yet.
 *
 * What is not here: the MCP layer's tool descriptions and answers, which
 * an agent reads and which stay English whatever its person reads, and the
 * error codes, which are the contract.
 */
export type Language = 'en' | 'fr'

export const asLanguage = (v: unknown): Language => (v === 'fr' ? 'fr' : 'en')

/**
 * The language a request asks to be answered in. The web sends `x-tongue`
 * with every request; the native apps and agents send nothing and are
 * answered in English, which is what their own screens are written in.
 */
export const heard = (c: Context): Language => asLanguage(c.req.header('x-tongue'))

/** Somebody's own language, for what is sent to them — `language_of`. */
export async function languageOf(tx: Tx, actorId: string): Promise<Language> {
  const [row] = await tx<{ language: string }[]>`select language_of(${actorId}) as language`
  return asLanguage(row?.language)
}

/**
 * Somebody's language for a mail, read outside any transaction — the
 * routes that send mail mostly have none.
 *
 * What the account said wins; an account that never said is `fallback`,
 * which is English for somebody who is not the one asking and the screen's
 * own language (`heard(c)`) for the person who pressed the button — a
 * reset, a confirmation, a code. `language_said`, migration 143.
 */
export async function languageFor(actorId: string, fallback: Language = 'en'): Promise<Language> {
  const [row] = await withoutActor((tx) => tx<{ language: string | null }[]>`select language_said(${actorId}) as language`)
  return row?.language ? asLanguage(row.language) : fallback
}

/**
 * Words with their French beside them, the web's `say` — `data/words.ts`.
 * The French takes the same arguments as the English, and a key missing
 * from one of them fails the build.
 */
export function say<T extends Record<string, unknown>>(words: { [K in keyof T]: readonly [T[K], NoInfer<T[K]>] }, language: Language): T {
  const out = {} as T
  const at = language === 'fr' ? 1 : 0
  for (const k in words) out[k] = words[k][at]
  return out
}

/** One or many: French counts nothing and one as one, English only one. */
export const one = (n: number, language: Language): boolean => (language === 'fr' ? Math.abs(n) < 2 : n === 1)

/**
 * The French for each message an error carries, keyed by its English.
 *
 * By the English rather than by a key at every call site: a hundred and
 * more `c.json({ error: { code, message } })` stay as they are, readable
 * where they are, and the one place that knows a second language is the
 * middleware that answers in it. A message missing here goes out in
 * English — a screen half in one language is worse than none, and
 * `server/test/words.test.ts` lists every message the code can send and
 * fails on one this table has not heard of.
 */
export const ERRORS_FR: Record<string, string> = {
  /* A workspace's own domain, and a session made on it. */
  'Passwords aren’t used here. Sign in with a code sent to your email.':
    'Les mots de passe ne sont pas utilisés ici. Connectez-vous avec un code envoyé par e-mail.',
  'Open Tuff at usetuff.com to change this.': 'Ouvrez Tuff sur usetuff.com pour modifier ceci.',
  /* A project's feedback page. */
  'This page doesn’t exist.': 'Cette page n’existe pas.',
  'This page is paused. Try again later.': 'Cette page est en pause. Réessayez plus tard.',
  'Send your request from the page.': 'Envoyez votre demande depuis la page.',
  'This page has had a lot of requests today. Try again tomorrow.': 'Cette page a reçu beaucoup de demandes aujourd’hui. Réessayez demain.',
  'Couldn’t check that you’re a person. Try again.': 'Impossible de vérifier que vous êtes une personne. Réessayez.',
  'Enter your email address.': 'Saisissez votre adresse e-mail.',
  'Too many requests. Try again later.': 'Trop de demandes. Réessayez plus tard.',
  'Add a title for your request.': 'Ajoutez un titre à votre demande.',
  'Enter your email address to send this.': 'Saisissez votre adresse e-mail pour l’envoyer.',
  'This link has expired or was already used.': 'Ce lien a expiré ou a déjà été utilisé.',
  'Couldn’t send your request. Try again.': 'Impossible d’envoyer votre demande. Réessayez.',
  'That address is taken.': 'Cette adresse est déjà prise.',
  'A page’s name and intro can’t contain web or email addresses.':
    'Le nom et l’introduction d’une page ne peuvent pas contenir d’adresse web ou e-mail.',
  'This page’s previous address still points here for 30 days. You can change it again after that.':
    'L’ancienne adresse de cette page y renvoie encore pendant 30 jours. Vous pourrez la modifier ensuite.',
  'Use 3 to 40 lowercase letters, numbers and dashes.': 'Utilisez de 3 à 40 lettres minuscules, chiffres et tirets.',
  /* Signing in, signing up and the links mail sends. */
  'Enter a code from your authenticator app.': 'Saisissez un code de votre application d’authentification.',
  'That didn’t send. Write to hello@usetuff.com.': 'L’envoi a échoué. Écrivez à hello@usetuff.com.',
  'Connected tools can’t import.': 'Les outils connectés ne peuvent pas importer.',
  'That doesn’t look like a Linear API key.': 'Cela ne ressemble pas à une clé d’API Linear.',
  'Linear didn’t accept that key.': 'Linear n’a pas accepté cette clé.',
  'Linear asked us to wait. Try again in a minute.': 'Linear nous demande de patienter. Réessayez dans une minute.',
  'Couldn’t reach Linear. Try again.': 'Impossible de joindre Linear. Réessayez.',
  'Enter your Jira site, like acme.atlassian.net.': 'Indiquez votre site Jira, par exemple acme.atlassian.net.',
  'Enter the email and API token you use for Jira.': 'Indiquez l’e-mail et le jeton d’API que vous utilisez pour Jira.',
  'Jira didn’t accept that email and token.': 'Jira n’a pas accepté cet e-mail et ce jeton.',
  'Jira couldn’t find that.': 'Jira ne trouve pas cela.',
  'Jira asked us to wait. Try again in a minute.': 'Jira nous demande de patienter. Réessayez dans une minute.',
  'Couldn’t reach Jira. Try again.': 'Impossible de joindre Jira. Réessayez.',
  'That doesn’t look like an Asana token.': 'Cela ne ressemble pas à un jeton Asana.',
  'Asana didn’t accept that token.': 'Asana n’a pas accepté ce jeton.',
  'Asana couldn’t find that.': 'Asana ne trouve pas cela.',
  'Asana asked us to wait. Try again in a minute.': 'Asana nous demande de patienter. Réessayez dans une minute.',
  'Couldn’t reach Asana. Try again.': 'Impossible de joindre Asana. Réessayez.',
  'Choose at least one project.': 'Choisissez au moins un projet.',
  'Choose at least one team.': 'Choisissez au moins une équipe.',
  'An import is already running.': 'Une importation est déjà en cours.',
  'You don’t have permission to create projects.': 'Vous n’avez pas l’autorisation de créer des projets.',
  'Only the workspace owner can import.': 'Seul le propriétaire de l’espace de travail peut importer.',
  'Choose a time for the reminder.': 'Choisissez une heure pour le rappel.',
  'That isn’t a valid time.': 'Cette heure n’est pas valide.',
  'That time has passed.': 'Cette heure est déjà passée.',
  'You have too many reminders set. Remove some first.': 'Vous avez trop de rappels. Supprimez-en d’abord quelques-uns.',
  'This project is still being imported. Try again when it’s done.':
    'Ce projet est encore en cours d’importation. Réessayez quand ce sera fini.',
  'Some rows could not be read.': 'Certaines lignes n’ont pas pu être lues.',
  /* An import's page, and a body too tangled to read — `mcp/markdown.ts`. */
  'This is too much to import at once. Import fewer at a time.': 'C’est trop à importer en une fois. Importez-en moins à la fois.',
  'This text is too complex to read. Simplify it and try again.': 'Ce texte est trop complexe à lire. Simplifiez-le et réessayez.',
  'Too much is being read right now. Try again in a moment.': 'Trop de textes sont en cours de lecture. Réessayez dans un instant.',
  'Too many requests. Try again tomorrow.': 'Trop de demandes. Réessayez demain.',
  'Too many attempts. Try again in a few minutes.': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'Too many attempts. Try again in a minute.': 'Trop de tentatives. Réessayez dans une minute.',
  'Too many requests. Try again in a minute.': 'Trop de requêtes. Réessayez dans une minute.',
  /* Link previews with every place taken — `http/preview.ts`. */
  'Too many links being read. Try again in a moment.': 'Trop de liens sont en cours de lecture. Réessayez dans un instant.',
  'Couldn’t create that workspace. Try again.': 'Impossible de créer cet espace de travail. Réessayez.',
  'Enter the code from your authenticator app.': 'Saisissez le code de votre application d’authentification.',
  'That code didn’t match. Try again.': 'Ce code est incorrect. Réessayez.',
  'Confirm your email first. Check your inbox for the link.':
    'Confirmez d’abord votre adresse e-mail. Le lien se trouve dans votre boîte de réception.',
  'They haven’t confirmed their email yet.': 'Cette personne n’a pas encore confirmé son adresse e-mail.',
  'That email address already has an account.': 'Un compte existe déjà avec cette adresse e-mail.',
  'This link has already been used or has expired.': 'Ce lien a déjà été utilisé ou a expiré.',
  'This invitation is no longer valid.': 'Cette invitation n’est plus valide.',
  'This link is no longer valid.': 'Ce lien n’est plus valide.',
  'This invitation is for a different email address.': 'Cette invitation est destinée à une autre adresse e-mail.',
  /* An invitation mailed to a workspace's own domain, taken only there. */
  'Open the invitation’s link to accept it.': 'Ouvrez le lien de l’invitation pour l’accepter.',
  'That email already has an account. Use its password to join.':
    'Un compte existe déjà avec cette adresse e-mail. Utilisez son mot de passe pour rejoindre l’espace de travail.',
  'Your password needs at least 12 characters.': 'Votre mot de passe doit comporter au moins 12 caractères.',
  'Connected tools can’t join workspaces.': 'Les outils connectés ne peuvent pas rejoindre d’espace de travail.',
  /* Account: the name, the password, the address, the second factor, the data. */
  'Enter your name.': 'Saisissez votre nom.',
  'Connected tools can’t change your password.': 'Les outils connectés ne peuvent pas changer votre mot de passe.',
  'Fill in both passwords.': 'Saisissez les deux mots de passe.',
  'Use at least 12 characters.': 'Utilisez au moins 12 caractères.',
  'Your account doesn’t have a password yet.': 'Votre compte n’a pas encore de mot de passe.',
  'That didn’t match. Try again.': 'Ce que vous avez saisi ne correspond pas. Réessayez.',
  'Connected tools can’t change your email address.': 'Les outils connectés ne peuvent pas changer votre adresse e-mail.',
  'Only the owner, or somebody the owner allows, can connect an agent.':
    'Seul le propriétaire, ou une personne qu’il autorise, peut connecter un agent.',
  'No workspace at that address.': 'Aucun espace de travail à cette adresse.',
  /* An agent's question with choices. */
  'Only a question with choices is answered.': 'Seule une question à choix peut recevoir une réponse.',
  'No such choice.': 'Ce choix n’existe pas.',
  'Someone already answered this question.': 'Quelqu’un a déjà répondu à cette question.',
  'Only an agent asks a question with choices.': 'Seul un agent pose une question à choix.',
  'No one who can see this task can be asked.': 'Personne qui voit cette tâche ne peut être interrogé.',
  /* An agent's live status. */
  'Say what you are doing, or null to stop.': 'Dites ce que vous faites, ou null pour arrêter.',
  'A thread needs its conversation_id.': 'Un fil de discussion a besoin de son conversation_id.',
  'Its owner’s account is gone, so there is nobody to give it back to.':
    'Le compte de son propriétaire n’existe plus : il n’y a personne à qui le rendre.',
  'The workspace wasn’t deleted. Try again.': 'L’espace de travail n’a pas été supprimé. Réessayez.',
  'It isn’t deleted, or its thirty days are over.': 'Il n’est pas supprimé, ou ses trente jours sont passés.',
  'Only the owner can delete the workspace.': 'Seul le propriétaire peut supprimer l’espace de travail.',
  'Type the workspace’s name as it’s written.': 'Saisissez le nom de l’espace de travail tel qu’il est écrit.',
  'An agent’s webhook needs a public https URL.': 'Le webhook d’un agent doit utiliser une URL https publique.',
  'An agent can only join projects the person who connected it is on.':
    'Un agent ne peut rejoindre que les projets dont fait partie la personne qui l’a connecté.',
  'Choose projects you are on.': 'Choisissez des projets dont vous faites partie.',
  'They’re no longer in this workspace.': 'Cette personne ne fait plus partie de cet espace de travail.',
  'You are no longer in this workspace.': 'Vous ne faites plus partie de cet espace de travail.',
  'Connected tools can’t change how you sign in.': 'Les outils connectés ne peuvent pas changer votre façon de vous connecter.',
  'This sign-in method isn’t set up.': 'Ce moyen de connexion n’est pas configuré.',
  'Only the Tuff app can do this.': 'Seule l’application Tuff peut faire cela.',
  'Start again.': 'Recommencez.',
  'This took too long. Try again.': 'Cela a pris trop de temps. Réessayez.',
  'That account already signs in to another Tuff account.': 'Ce compte permet déjà de se connecter à un autre compte Tuff.',
  'This is how you sign in. Set a password before removing it.':
    'C’est votre moyen de connexion. Définissez un mot de passe avant de le retirer.',
  'Enter a valid email address.': 'Saisissez une adresse e-mail valide.',
  'That’s already your email address.': 'C’est déjà votre adresse e-mail.',
  'Too many links sent this hour. Try again later.': 'Trop de liens envoyés en une heure. Réessayez plus tard.',
  'There’s no pending email change.': 'Aucun changement d’adresse e-mail n’est en attente.',
  'Your password is what’s asked for.': 'C’est votre mot de passe qui est demandé.',
  'There is no second factor to turn off.': 'Il n’y a pas de second facteur à désactiver.',
  'Too many codes sent this hour. Try again later.': 'Trop de codes envoyés en une heure. Réessayez plus tard.',
  'Two-factor authentication is already on.': 'L’authentification à deux facteurs est déjà activée.',
  'Enter your password.': 'Saisissez votre mot de passe.',
  'Set up two-factor authentication from Account in your browser, or update the app.':
    'Configurez l’authentification à deux facteurs depuis Compte dans votre navigateur, ou mettez l’application à jour.',
  'Enter the code we emailed you.': 'Saisissez le code que nous vous avons envoyé par e-mail.',
  'Turn off two-factor authentication first. You’ll need your password.':
    'Désactivez d’abord l’authentification à deux facteurs. Votre mot de passe vous sera demandé.',
  'Choose a valid time zone.': 'Choisissez un fuseau horaire valide.',
  'You’ve just downloaded your data. Try again in an hour.': 'Vous venez de télécharger vos données. Réessayez dans une heure.',
  'You’re the last owner of this server. Add another owner first.':
    'Vous êtes le dernier propriétaire de ce serveur. Ajoutez d’abord un autre propriétaire.',
  'Sign-up is closed on this server. Ask someone here for an invitation.':
    'Les inscriptions sont fermées sur ce serveur. Demandez une invitation à quelqu’un qui l’utilise.',
  'Deleting this workspace would leave this server with no owner who can sign in. Add another owner in Server settings first.':
    'Supprimer cet espace de travail laisserait ce serveur sans propriétaire capable de se connecter. Ajoutez d’abord un autre propriétaire dans les paramètres du serveur.',
  'That account hasn’t confirmed its email yet.': 'Ce compte n’a pas encore confirmé son adresse e-mail.',
  'No account has that email.': 'Aucun compte n’utilise cette adresse e-mail.',
  'The server needs at least one owner.': 'Le serveur doit avoir au moins un propriétaire.',
  'Your account has no email.': 'Votre compte n’a pas d’adresse e-mail.',
  'Hand over the workspaces you own first.': 'Transférez d’abord les espaces de travail dont vous êtes propriétaire.',
  /* Leaving. */
  'You’re not in any workspace.': 'Vous ne faites partie d’aucun espace de travail.',
  'You’re not in any workspace yet. Sign in on the web to create one or accept an invitation.':
    'Vous ne faites encore partie d’aucun espace de travail. Connectez-vous sur le web pour en créer un ou accepter une invitation.',
  'You can’t leave a direct message, but you can hide it.': 'Vous ne pouvez pas quitter un message direct, mais vous pouvez le masquer.',
  'You’re the only one in this channel. Delete it instead.': 'Vous êtes la seule personne de ce canal. Supprimez-le plutôt.',
  'You own this workspace. Hand it over to someone else before you leave.':
    'Vous êtes propriétaire de cet espace de travail. Transférez-le à quelqu’un d’autre avant de partir.',
  'This workspace isn’t waiting for an answer.': 'Cet espace de travail n’attend pas de réponse.',
  'Say join or leave.': 'Indiquez rejoindre ou quitter.',
  'You own this workspace, so you can’t leave it. Join it to hand it over.':
    'Vous êtes propriétaire de cet espace de travail, vous ne pouvez donc pas le quitter. Rejoignez-le pour le transférer.',
  'Connected tools can’t turn on notifications.': 'Les outils connectés ne peuvent pas activer les notifications.',
  'Connected tools can’t send notifications.': 'Les outils connectés ne peuvent pas envoyer de notifications.',
  'Sign in again to turn on notifications on this device.': 'Reconnectez-vous pour activer les notifications sur cet appareil.',
  /* The workspace, its people and its owner. */
  'Too many new workspaces today. Try again tomorrow.': 'Trop de nouveaux espaces de travail aujourd’hui. Réessayez demain.',
  'That address was just taken. Try another one.': 'Cette adresse vient d’être prise. Essayez-en une autre.',
  'That can’t be used as an address.': 'Cette adresse ne peut pas être utilisée.',
  'A workspace has one owner. Hand it over in the workspace’s settings.':
    'Un espace de travail n’a qu’un propriétaire. Transférez-le dans les paramètres de l’espace de travail.',
  'You can’t change your own role or permissions.': 'Vous ne pouvez pas modifier votre propre rôle ni vos autorisations.',
  'You can’t remove yourself.': 'Vous ne pouvez pas vous retirer vous-même.',
  'Connected tools can’t invite people.': 'Les outils connectés ne peuvent pas inviter de personnes.',
  'You don’t have permission to invite people.': 'Vous n’avez pas l’autorisation d’inviter des personnes.',
  'A workspace has one owner. Invite them as a member, then hand the workspace over in its settings.':
    'Un espace de travail n’a qu’un propriétaire. Invitez cette personne comme membre, puis transférez-lui l’espace de travail dans ses paramètres.',
  'Choose at least one project for these permissions.': 'Choisissez au moins un projet pour ces autorisations.',
  'You can only give these permissions on projects you manage.':
    'Vous ne pouvez donner ces autorisations que sur les projets que vous gérez.',
  'Only the owner can hand the workspace over.': 'Seul le propriétaire peut transférer l’espace de travail.',
  'Choose who to hand it to.': 'Choisissez à qui le transférer.',
  'You’re the owner already.': 'Vous êtes déjà le propriétaire.',
  'They aren’t in this workspace any more.': 'Cette personne ne fait plus partie de cet espace de travail.',
  /* Agents and tokens. */
  'Only you can connect an agent, signed in here.': 'Pour connecter un agent, connectez-vous ici vous-même.',
  'You don’t have permission to connect agents.': 'Vous n’avez pas l’autorisation de connecter des agents.',
  'This connection link isn’t valid.': 'Ce lien de connexion n’est pas valide.',
  'You don’t manage this agent.': 'Vous ne gérez pas cet agent.',
  'Connected tools can’t manage tokens.': 'Les outils connectés ne peuvent pas gérer les jetons.',
  'You don’t have permission to manage tokens.': 'Vous n’avez pas l’autorisation de gérer les jetons.',
  'Tokens for specific projects aren’t available yet.': 'Les jetons limités à certains projets ne sont pas encore disponibles.',
  'Connected tools can’t revoke tokens.': 'Les outils connectés ne peuvent pas révoquer de jetons.',
  'Webhooks need a public https URL.': 'Les webhooks doivent utiliser une URL https publique.',
  'Give the webhook a name.': 'Donnez un nom au webhook.',
  'A room can have 20 webhooks.': 'Un canal peut avoir 20 webhooks.',
  /* Projects, tasks, lists and sprints. */
  'Not a cursor': 'Ce curseur n’est pas valide.',
  'You can’t change your own permissions.': 'Vous ne pouvez pas modifier vos propres autorisations.',
  'Owners already have every permission.': 'Les propriétaires ont déjà toutes les autorisations.',
  'A subtask can’t have subtasks.': 'Une sous-tâche ne peut pas avoir de sous-tâches.',
  'A task with subtasks can’t be a subtask.': 'Une tâche qui a des sous-tâches ne peut pas devenir une sous-tâche.',
  'A subtask repeats with its task.': 'Une sous-tâche se répète avec sa tâche.',
  'That label belongs to another project.': 'Cette étiquette appartient à un autre projet.',
  'Slack isn’t set up on this server.': 'Slack n’est pas configuré sur ce serveur.',
  'That link has run out. Connect Slack again.': 'Ce lien a expiré. Connectez Slack à nouveau.',
  'Slack didn’t confirm it. Try again.': 'Slack ne l’a pas confirmé. Réessayez.',
  'That Slack workspace is connected to another Tuff workspace.':
    'Cet espace de travail Slack est connecté à un autre espace de travail Tuff.',
  'Slack didn’t answer. Try again in a moment.': 'Slack n’a pas répondu. Réessayez dans un instant.',
  'Connect Slack in the workspace’s settings first.': 'Connectez d’abord Slack dans les paramètres de l’espace de travail.',
  'Slack stopped accepting Tuff. The owner connects it again in Settings.':
    'Slack n’accepte plus Tuff. Le propriétaire le reconnecte dans les paramètres.',
  'Tuff can’t post in that channel. In a private channel, add the app first.':
    'Tuff ne peut pas publier dans ce canal. Pour un canal privé, ajoutez d’abord l’application.',
  'GitHub isn’t set up on this server.': 'GitHub n’est pas configuré sur ce serveur.',
  'That link has run out. Connect GitHub again.': 'Ce lien a expiré. Connectez GitHub à nouveau.',
  'That installation isn’t one this workspace started.': 'Cette installation n’a pas été lancée depuis cet espace de travail.',
  'That GitHub account is connected to another workspace.': 'Ce compte GitHub est connecté à un autre espace de travail.',
  'Connect GitHub in the workspace’s settings first.': 'Connectez d’abord GitHub dans les paramètres de l’espace de travail.',
  'The Tuff app can’t see that repository.': 'L’application Tuff n’a pas accès à ce dépôt.',
  'Type the repository’s full name to confirm: it’s public, and so will everything synced to it be.':
    'Saisissez le nom complet du dépôt pour confirmer : il est public, et tout ce qui y sera synchronisé le sera aussi.',
  'GitHub didn’t confirm it. Try again.': 'GitHub ne l’a pas confirmé. Réessayez.',
  'That GitHub account is linked to somebody else.': 'Ce compte GitHub est lié à quelqu’un d’autre.',
  'Connect your own GitHub in Account settings first, so Tuff can see this installation is yours.':
    'Connectez d’abord votre propre GitHub dans les paramètres du compte, pour que Tuff voie que cette installation est la vôtre.',
  'Connect your own GitHub with access to that repository to link it.':
    'Connectez votre propre GitHub, avec accès à ce dépôt, pour le lier.',
  'Waiting for GitHub. Try again in a moment.': 'En attente de GitHub. Réessayez dans un instant.',
  'Only whoever installed the app on GitHub can connect it.':
    'Seule la personne qui a installé l’application sur GitHub peut la connecter.',
  'That repository is linked to another project.': 'Ce dépôt est lié à un autre projet.',
  'A sample project can’t be linked to a repository.': 'Un projet d’exemple ne peut pas être lié à un dépôt.',
  'Somebody you chose isn’t on this project.': 'Une des personnes choisies ne fait pas partie de ce projet.',
  'That sprint belongs to another project.': 'Ce sprint appartient à un autre projet.',
  'A task can’t wait on itself.': 'Une tâche ne peut pas s’attendre elle-même.',
  'That would make a loop: it already waits on this task.': 'Cela créerait une boucle : elle attend déjà cette tâche.',
  'A task can wait on fifty things at most.': 'Une tâche peut attendre cinquante tâches au plus.',
  'That project is archived.': 'Ce projet est archivé.',
  'That list belongs to another project.': 'Cette liste appartient à un autre projet.',
  'A subtask is copied with its task.': 'Une sous-tâche est copiée avec sa tâche.',
  'Couldn’t move the task there. Try again.': 'Impossible de déplacer la tâche à cet endroit. Réessayez.',
  'Couldn’t put the task there. Try again.': 'Impossible de placer la tâche à cet endroit. Réessayez.',
  'The end date can’t be before the start date.': 'La date de fin ne peut pas être antérieure à la date de début.',
  'Choose another list to move the tasks to.': 'Choisissez une autre liste où déplacer les tâches.',
  'Choose where to move this list’s tasks.': 'Choisissez où déplacer les tâches de cette liste.',
  'Import isn’t available yet.': 'L’importation n’est pas encore disponible.',
  'Unknown source': 'Source inconnue.',
  'Couldn’t read that export. Check the file and try again.': 'Impossible de lire cet export. Vérifiez le fichier et réessayez.',
  /* Chat. */
  'You can’t delete a direct conversation, but you can leave it.':
    'Vous ne pouvez pas supprimer une conversation directe, mais vous pouvez la quitter.',
  'You can only import into an empty chat.': 'Vous ne pouvez importer que dans une discussion vide.',
  'Only files from Slack can be imported.': 'Seuls les fichiers de Slack peuvent être importés.',
  'Couldn’t get that file from Slack.': 'Impossible de récupérer ce fichier depuis Slack.',
  'That id is taken': 'Cet identifiant est déjà pris.',
  'One emoji': 'Un seul emoji.',
  'Only messages in a project can become tasks or posts.': 'Seuls les messages d’un projet peuvent devenir des tâches ou des annonces.',
  /* Docs, files and pictures. */
  'Too many picture uploads. Try again later.': 'Trop d’images importées. Réessayez plus tard.',
  /* An agent renamed. */
  'Give it a name.': 'Donnez-lui un nom.',
  /* A webhook's events and its test. */
  'Choose events from the list.': 'Choisissez des événements dans la liste.',
  'Turn the webhook on to send a test.': 'Activez le webhook pour envoyer un test.',
  'Too many tests. Try again later.': 'Trop de tests. Réessayez plus tard.',
  /* Twenty of a workspace's own — migration 294. */
  'A workspace can have up to 20 webhooks. Delete one you no longer use first.':
    'Un espace de travail peut avoir jusqu’à 20 webhooks. Supprimez-en un dont vous ne vous servez plus.',
  /* The receiver's own key, and a Claude Code routine. */
  'The Authorization header must be one line of plain text, up to 1 KB.':
    'L’en-tête Authorization doit tenir sur une ligne de texte simple, 1 Ko au plus.',
  'A routine’s URL is https://api.anthropic.com/v1/claude_code/routines/…/fire.':
    'L’URL d’une routine est https://api.anthropic.com/v1/claude_code/routines/…/fire.',
  'A Claude Code routine needs its token.': 'Une routine Claude Code a besoin de son jeton.',
  'This agent has no webhook.': 'Cet agent n’a pas de webhook.',
  /* A link's address — `docs/specs/docs.md`. */
  'Only a link has an address to change.': 'Seul un lien a une adresse à modifier.',
  /* An invitation sent again. */
  'Too many invitations sent today. Try again tomorrow.': 'Trop d’invitations envoyées aujourd’hui. Réessayez demain.',
  'Couldn’t send the invitation. Try again.': 'Impossible d’envoyer l’invitation. Réessayez.',
  'This invitation’s email address isn’t valid. Revoke it and invite again.':
    'L’adresse e-mail de cette invitation n’est pas valide. Révoquez-la et invitez à nouveau.',
  'You can only invite people onto projects you are on.':
    'Vous ne pouvez inviter des personnes que dans les projets dont vous faites partie.',
  'Use a PNG, JPEG, GIF or WebP image.': 'Utilisez une image PNG, JPEG, GIF ou WebP.',
  'Pick one of the faces.': 'Choisissez l’un des visages.',
  'Images can be up to 2 MB.': 'Les images ne doivent pas dépasser 2 Mo.',
  'Only this server’s owners can create workspaces.': 'Seuls les propriétaires de ce serveur peuvent créer des espaces de travail.',
  'Choose at least one person on this project.': 'Choisissez au moins une personne de ce projet.',
  'This is too long to send. Make it shorter or split it up.': 'C’est trop long pour être envoyé. Raccourcissez-le ou divisez-le.',
  'This is too long to save. Make it shorter or move part of it into a document.':
    'C’est trop long pour être enregistré. Raccourcissez-le ou déplacez-en une partie dans un document.',
  'This workspace is full.': 'Cet espace de travail est complet.',
  'Something changed in the meantime. Nothing was deleted. Try again.':
    'Quelque chose a changé entre-temps. Rien n’a été supprimé. Réessayez.',
  'This workspace is out of storage.': 'Cet espace de travail n’a plus d’espace de stockage.',
  'No file': 'Aucun fichier.',
  'The display version can be up to 2 MB.': 'La version d’affichage ne doit pas dépasser 2 Mo.',
  'Use a JPEG or WebP image.': 'Utilisez une image JPEG ou WebP.',
  'Only images can have a display version.': 'Seules les images peuvent avoir une version d’affichage.',
  'Give 1 to 100 file ids, separated by commas.': 'Indiquez de 1 à 100 identifiants de fichier, séparés par des virgules.',
  'This is a document, not an uploaded file. Read it with read_doc.': 'C’est un document, pas un fichier importé. Lisez-le avec read_doc.',
  'Give a project or a conversation, and 1 to 50 task handles like ACM-41, separated by commas.':
    'Indiquez un projet ou une conversation, et de 1 à 50 identifiants de tâche comme ACM-41, séparés par des virgules.',
  'Only a written document can be shared to the web.': 'Seul un document rédigé peut être partagé sur le Web.',
  /* An announcement kept as a draft. */
  'A draft has no schedule.': 'Un brouillon ne peut pas être programmé.',
  'Publish it before anyone can reply.': 'Publiez-la avant que quiconque puisse y répondre.',
  /* Who a document is for. */
  'Publish this document to everyone on the project before sharing it to the web.':
    'Publiez ce document pour toutes les personnes du projet avant de le partager sur le Web.',
  'Only a written document can be kept to some people.': 'Seul un document rédigé peut être réservé à certaines personnes.',
  'Choose people who are on this project.': 'Choisissez des personnes qui font partie de ce projet.',
  // A list an agent takes.
  'Choose an agent on this project.': 'Choisissez un agent de ce projet.',
  'A list that finishes tasks can’t have an agent.': 'Une liste qui termine les tâches ne peut pas avoir d’agent.',
  'This link is for another account. Sign in to the account that asked for the change, then confirm.':
    'Ce lien est destiné à un autre compte. Connectez-vous au compte qui a demandé le changement, puis confirmez.',
  'Open this link in a browser and confirm the change there.': 'Ouvrez ce lien dans un navigateur et confirmez le changement.',
  'Open this link in a browser signed in to the account that asked for the change, and confirm it there.':
    'Ouvrez ce lien dans un navigateur connecté au compte qui a demandé le changement, et confirmez-le.',
  'Open this link in a browser and approve the change there.': 'Ouvrez ce lien dans un navigateur et approuvez le changement.',
  'Open the link from the email and press Confirm.': 'Ouvrez le lien de l’e-mail et appuyez sur Confirmer.',
  'a list is taken only by an agent of its workspace': 'Seul un agent de cet espace de travail peut prendre une liste.',
  'Only a written document holds pictures and files.': 'Seul un document rédigé peut contenir des images et des fichiers.',
  'Only a written document can be a template.': 'Seul un document rédigé peut servir de modèle.',
  // A project's instructions for agents.
  'Only a written document can be the instructions for agents.': 'Seul un document rédigé peut servir d’instructions pour les agents.',
  'Publish this document to everyone on the project first. Agents read only what the whole project can.':
    'Publiez d’abord ce document pour toutes les personnes du projet. Les agents ne lisent que ce que tout le projet peut lire.',
  'Not yours to say what agents read here.': 'Ce n’est pas à vous de choisir ce que les agents lisent ici.',
  'Only a written document has a colour and an icon.': 'Seul un document rédigé a une couleur et une icône.',
  'Say which file is to go for good.': 'Indiquez quel fichier supprimer définitivement.',
  'No such template.': 'Ce modèle n’existe pas.',
  'This document isn’t shared.': 'Ce document n’est pas partagé.',
  /* A comment on words. */
  'Those words are no longer in the document.': 'Ce texte ne figure plus dans le document.',
  'Choose some words to comment on.': 'Sélectionnez le texte à commenter.',
  'Only a comment on words in a document is resolved.': 'Seul un commentaire sur un texte d’un document peut être résolu.',
  /* Writing a document together. */
  'This document changed since it was read. Read it again, then make the change.':
    'Ce document a changé depuis sa lecture. Relisez-le, puis faites la modification.',
  'This document is too large to add more. Remove something first.':
    'Ce document est trop volumineux pour en ajouter davantage. Supprimez d’abord du contenu.',
  'Couldn’t move it there. Try again.': 'Impossible de le déplacer à cet endroit. Réessayez.',
  'No preview for that link.': 'Aucun aperçu pour ce lien.',
  /* A client older than the server. */
  'Update the server': 'Mettez à jour le serveur.',
  /* The database's own refusals, which `onError` answers as `invalid`
     with the words it raised them with — `109_what_the_audit_found.sql`,
     `116_an_import_speaks_only_for_the_room.sql`. A caller's mistake rather
     than a person's, but a screen shows whatever comes back. */
  'a list from another project': 'Cette liste appartient à un autre projet.',
  'a sprint from another project': 'Ce sprint appartient à un autre projet.',
  'a task from another project': 'Cette tâche appartient à un autre projet.',
  'a folder from another project': 'Ce dossier appartient à un autre projet.',
  'a message from another room': 'Ce message appartient à une autre conversation.',
  'a comment on something else': 'Ce commentaire porte sur autre chose.',
  'not said yet': 'Un message ne peut pas être daté dans le futur.',
  /* Your own server's first opening, and its mail. */
  'This setup link doesn’t work. Use the link from the server’s log or setup.sh.':
    'Ce lien de configuration ne fonctionne pas. Utilisez le lien du journal du serveur ou de setup.sh.',
  'This server already has an owner. Sign in.': 'Ce serveur a déjà un propriétaire. Connectez-vous.',
  'Fill in every field.': 'Remplissez tous les champs.',
  'Enter an email address to send it to.': 'Saisissez l’adresse e-mail à laquelle l’envoyer.',
  'Enter your name, your email and a password of at least 12 characters.':
    'Saisissez votre nom, votre adresse e-mail et un mot de passe d’au moins 12 caractères.',
  'This server is set up for another email. Use the one in OWNER_EMAIL.':
    'Ce serveur est configuré pour une autre adresse e-mail. Utilisez celle d’OWNER_EMAIL.',
  'That’s the development account. Use your own email.': 'C’est le compte de développement. Utilisez votre propre adresse e-mail.',
  'Write the sender as tuff@example.com or Tuff <tuff@example.com>.':
    'Écrivez l’expéditeur sous la forme tuff@exemple.com ou Tuff <tuff@exemple.com>.',
  'That isn’t a Resend API key.': 'Ce n’est pas une clé API Resend.',
  'Write the server as smtp.example.com, without smtp:// or a port.':
    'Écrivez le serveur sous la forme smtp.exemple.com, sans smtp:// ni port.',
  'Use port 465, 587, 25 or 2525.': 'Utilisez le port 465, 587, 25 ou 2525.',
  'Without TLS, Tuff only sends through a server on this machine or its own network, with no user or password.':
    'Sans TLS, Tuff n’envoie que par un serveur sur cette machine ou son réseau, sans nom d’utilisateur ni mot de passe.',
  'Mail is set by the server’s environment. Change SMTP_URL or RESEND_API_KEY there.':
    'L’envoi d’e-mails est défini par l’environnement du serveur. Modifiez-y SMTP_URL ou RESEND_API_KEY.',
  'Enter the password. It’s asked again when the server or the user changes.':
    'Saisissez le mot de passe. Il est redemandé quand le serveur ou le nom d’utilisateur change.',
  'Enter the API key.': 'Saisissez la clé API.',
  'Couldn’t find that server. Check its name.': 'Impossible de trouver ce serveur. Vérifiez son nom.',
  'That server is on a private network. Tuff sends only to public mail servers unless SMTP_ALLOW_PRIVATE=1 is set on the server.':
    'Ce serveur se trouve sur un réseau privé. Tuff n’envoie qu’à des serveurs de messagerie publics, sauf si SMTP_ALLOW_PRIVATE=1 est défini sur le serveur.',
  'Not allowed.': 'Action non autorisée.',
}

/** Messages with something in them — a number, a name — matched whole. */
export const ERRORS_FR_LIKE: [RegExp, (m: RegExpExecArray) => string][] = [
  /* `files.ts`: the ceiling on one file, in megabytes. */
  [
    /^That file is too big\. Files can be up to (.+) MB\.$/,
    (m) => `Ce fichier est trop volumineux. Les fichiers ne doivent pas dépasser ${m[1]!.replace('.', ',')} Mo.`,
  ],
  /* `tokens.ts`: how many live tokens a person may hold (`MAX_LIVE_TOKENS`). */
  [
    /^You can have (\d+) tokens at a time\. Revoke one you don’t use to make another\.$/,
    (m) => `Vous pouvez avoir ${m[1]} jetons à la fois. Révoquez-en un que vous n’utilisez pas pour en créer un autre.`,
  ],
  /* `waysIn.ts`: a server's own provider that could not be read, by its name (`OIDC_NAME`). */
  [/^Couldn’t reach (.+)\. Try again later\.$/, (m) => `Impossible de joindre ${m[1]}. Réessayez plus tard.`],
]

/* And the edition's own routes' (`edition.errorsFr`); on your own server,
   none. Read on each call,
   not at load: the edition imports routes that import this file. */
export function frenchError(message: string): string {
  const exact = ERRORS_FR[message] ?? edition.errorsFr[message]
  if (exact) return exact
  for (const [pattern, write] of [...ERRORS_FR_LIKE, ...edition.errorsFrLike]) {
    const m = pattern.exec(message)
    if (m) return write(m)
  }
  return message
}

/**
 * The language a browser asks for first, by its `q` — `fr-CA;q=0.9` is
 * French — or '' when it says nothing.
 */
export function firstLanguage(header: string): string {
  let best = ''
  let at = -1
  for (const part of header.split(',')) {
    const [tag, ...params] = part.trim().split(';')
    if (!tag || tag === '*') continue
    const q = Number(
      params
        .find((p) => p.trim().startsWith('q='))
        ?.trim()
        .slice(2) ?? '1',
    )
    if (Number.isFinite(q) && q > at) {
      best = tag.slice(0, 2).toLowerCase()
      at = q
    }
  }
  return best
}
