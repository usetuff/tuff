import { one, say } from '../data/words.js'

/* A role by the name a person reads, in the lower case the English has. */
const ROLES: Record<string, string> = {
  owner: 'propriétaire',
  admin: 'administrateur',
  member: 'membre',
  guest: 'invité',
  client: 'client',
}

/** The shell: signing in, the screens it draws itself, a person, the inbox — `ui/App.tsx`. */
export const APP = say({
  /* Signing in. */
  codeDidNotWork: ['That code didn’t work. Try again.', 'Ce code n’a pas fonctionné. Réessayez.'],
  signInExpired: ['Your sign-in expired. Sign in again.', 'Votre connexion a expiré. Reconnectez-vous.'],
  wrongPassword: ['Incorrect email or password.', 'Adresse e-mail ou mot de passe incorrect.'],
  checkEmail: ['Check your email.', 'Consultez vos e-mails.'],
  backToSignIn: ['Back to sign in', 'Retour à la connexion'],
  oneMoreStep: ['One more step.', 'Encore une étape.'],
  signInToTuff: ['Sign in to Tuff.', 'Connectez-vous à Tuff.'],
  email: ['Email', 'Adresse e-mail'],
  codeOrRecovery: ['Code from your app, or a recovery code', 'Code de votre application, ou code de secours'],
  forgot: ['Forgot your password?', 'Mot de passe oublié ?'],
  createWorkspace: ['Create a workspace', 'Créer un espace de travail'],
  /* Removed from a workspace, at the sign-in that follows — `docs/specs/removing-someone.md`. */
  removedFrom: [
    (name: string) => `You were removed from ${name}. Its data has been cleared from this device.`,
    (name: string) => `Vous ne faites plus partie de ${name}. Ses données ont été effacées de cet appareil.`,
  ],
  removedFromIt: [
    'You were removed from the workspace. Its data has been cleared from this device.',
    'Vous ne faites plus partie de l’espace de travail. Ses données ont été effacées de cet appareil.',
  ],

  /* The shell's own screens. */
  strandedOffline: [
    'You’re offline, and this workspace hasn’t been loaded on this device yet. Reconnect to open it.',
    'Vous êtes hors ligne, et cet espace de travail n’a pas encore été chargé sur cet appareil. Reconnectez-vous pour l’ouvrir.',
  ],
  workspaceSettings: ['Workspace settings', 'Paramètres de l’espace de travail'],
  account: ['Account', 'Compte'],
  more: ['More', 'Plus'],
  search: ['Search', 'Rechercher'],
  /* The place, every room — not a project's tab, which is "Discussion". */
  chat: ['Chat', 'Discussions'],
  nothingHere: ['Nothing here.', 'Rien ici.'],
  archivedBanner: [
    'This project is archived and hidden from the sidebar and lists. Nothing in it was deleted.',
    'Ce projet est archivé et masqué de la barre latérale et des listes. Rien n’y a été supprimé.',
  ],
  sample: ['This is a sample project', 'Ceci est un projet d’exemple'],
  sampleBody: [
    'Look around — nothing in it is real or on anyone. Delete it when you’re done.',
    'Explorez-le — rien n’y est réel ni attribué à quelqu’un. Supprimez-le quand vous aurez terminé.',
  ],
  deleteSample: ['Delete sample', 'Supprimer l’exemple'],
  projectsBody: [
    'A project keeps its tasks, chat, docs and announcements in one place.',
    'Un projet réunit ses tâches, sa discussion, ses documents et ses annonces au même endroit.',
  ],
  addedYouBody: ['When someone adds you to a project, it appears here.', 'Quand quelqu’un vous ajoute à un projet, il apparaît ici.'],

  /* Members. */
  ownerOnlyMembers: [
    'Only the owner can see People & Agents in this workspace.',
    'Dans cet espace de travail, seul le propriétaire peut voir Personnes et agents.',
  ],
  invitePeople: ['Invite people', 'Inviter des personnes'],
  /* The plus at the head of Members, when it does both. */
  inviteOrConnect: ['Invite people or connect an agent', 'Inviter des personnes ou connecter un agent'],
  /* The column's two groups. */
  groupPeople: ['People', 'Personnes'],
  groupAgents: ['AI Agents', 'Agents IA'],
  noOneByThatName: ['No one by that name.', 'Personne ne porte ce nom.'],
  /* Lower case: what a search for an invitation without an address is matched against. */
  anyoneWithTheLinkFound: ['anyone with the link', 'toute personne ayant le lien'],
  anyoneWithTheLink: ['Anyone with the link', 'Toute personne ayant le lien'],
  revoke: ['Revoke', 'Révoquer'],
  /* Sending an invitation again. */
  resend: ['Resend', 'Renvoyer'],
  copyNewLink: ['Copy new link', 'Copier un nouveau lien'],
  copyNewLinkHint: ['Makes a new link. The old one stops working.', 'Crée un nouveau lien. L’ancien ne fonctionnera plus.'],
  newLinkCopied: ['New link copied. The old one no longer works.', 'Nouveau lien copié. L’ancien ne fonctionne plus.'],
  sentAgain: ['Sent again. The old link no longer works.', 'Renvoyée. L’ancien lien ne fonctionne plus.'],
  couldntSendAgain: ['Couldn’t send it again. Try again later.', 'Impossible de la renvoyer. Réessayez plus tard.'],
  owner: ['Owner', 'Propriétaire'],
  member: ['Member', 'Membre'],
  nProjects: [(n: number) => (n === 1 ? `${n} project` : `${n} projects`), (n: number) => (one(n) ? `${n} projet` : `${n} projets`)],
  noProjectsYet: ['no projects yet', 'aucun projet pour l’instant'],
  until: [(day: string) => `until ${day}`, (day: string) => `jusqu’au ${day}`],
  ownerOnlySettings: [
    'Only the owner can change this workspace’s settings.',
    'Seul le propriétaire peut modifier les paramètres de cet espace de travail.',
  ],
  /* The owner on a workspace's own domain, which keeps these shut. */
  settingsElsewhere: [
    (where: string) => `This workspace’s settings are changed on ${where}.`,
    (where: string) => `Les paramètres de cet espace de travail se modifient sur ${where}.`,
  ],
  openSettingsThere: [(where: string) => `Open on ${where}`, (where: string) => `Ouvrir sur ${where}`],

  /* One person. */
  role: [(r: string | null | undefined) => r, (r: string | null | undefined) => (r ? (ROLES[r] ?? r) : r)],
  joined: [(day: string) => `joined ${day}`, (day: string) => `membre depuis le ${day}`],
  removeFromWorkspace: ['Remove from the workspace', 'Retirer de l’espace de travail'],
  removeName: [(name: string) => `Remove ${name}?`, (name: string) => `Retirer ${name}\u00a0?`],
  remove: ['Remove', 'Retirer'],
  removeSays: [
    'They’ll lose access to this workspace right away and come off their open tasks. Their messages, tasks and files stay. To bring them back, invite them again.',
    'Cette personne perd immédiatement l’accès à cet espace de travail et est retirée de ses tâches en cours. Ses messages, tâches et fichiers restent. Pour la faire revenir, invitez-la à nouveau.',
  ],
  /* The open links somebody else made, which removal leaves standing —
     offered in the same dialog, `docs/specs/removing-someone.md`. */
  removeLinks: [
    (n: number) => (n === 1 ? 'Also revoke the open invite link' : `Also revoke ${n} open invite links`),
    (n: number) => (one(n) ? 'Révoquer aussi le lien d’invitation ouvert' : `Révoquer aussi les ${n} liens d’invitation ouverts`),
  ],
  removeLinksSays: [
    'Anyone who has an open link can still use it to join.',
    'Toute personne qui a un lien ouvert peut encore l’utiliser pour rejoindre l’espace de travail.',
  ],
  nOpen: [(n: number) => `${n} open`, (n: number) => (one(n) ? `${n} ouverte` : `${n} ouvertes`)],
  nothingOpen: ['Nothing open', 'Aucune tâche ouverte'],
  nOverdue: [(n: number) => ` · ${n} overdue`, (n: number) => ` · ${n} en retard`],
  couldNotAdd: ['Couldn’t add them to that project. Try again.', 'Impossible d’ajouter cette personne à ce projet. Réessayez.'],
  addToAProject: ['Add to a project', 'Ajouter à un projet'],
  project: ['Project', 'Projet'],
  may: ['May', 'Peut'],
  ordinaryOnly: [
    'They’ll be able to create tasks and channels. Only someone who manages this project can give more.',
    'Cette personne pourra créer des tâches et des canaux. Seule une personne qui gère ce projet peut lui en donner davantage.',
  ],
  adding: ['Adding…', 'Ajout…'],
  addTo: [
    (project: string | undefined) => `Add to ${project ?? 'project'}`,
    (project: string | undefined) => `Ajouter à ${project ?? 'ce projet'}`,
  ],
  canCreate: ['Can create', 'Peut créer'],
  channels: ['Channels', 'Canaux'],
  canProjects: ['Can create projects.', 'Peut créer des projets.'],
  cantProjects: ['Can’t create projects.', 'Ne peut pas créer de projets.'],
  canChannels: [
    'Can create workspace channels, and project channels where the project allows it.',
    'Peut créer des canaux dans l’espace de travail, et dans les projets qui l’autorisent.',
  ],
  cantChannels: [
    'Can’t create channels anywhere, even where a project allows it.',
    'Ne peut créer de canaux nulle part, même là où un projet l’autorise.',
  ],
  membersPage: ['People & Agents page', 'Page Personnes et agents'],
  canMembers: [
    'Can open People & Agents, with everyone’s work, weeks and hours.',
    'Peut ouvrir Personnes et agents, avec le travail, les semaines et les heures de chacun.',
  ],
  cantMembers: [
    'Can’t open People & Agents. Can still assign tasks to anyone and add them to projects.',
    'Ne peut pas ouvrir Personnes et agents. Peut tout de même attribuer des tâches à tout le monde et ajouter des personnes aux projets.',
  ],
  canInvite: ['Can invite people to the workspace.', 'Peut inviter des personnes dans l’espace de travail.'],
  cantInvite: ['Can’t invite people to the workspace.', 'Ne peut pas inviter de personnes dans l’espace de travail.'],
  connectAgents: ['Connect agents', 'Connecter des agents'],
  canAgents: ['Can connect AI agents to their projects.', 'Peut connecter des agents IA à ses projets.'],
  cantAgents: ['Can’t connect AI agents.', 'Ne peut pas connecter d’agents IA.'],
  agents: ['Agents', 'Agents'],
  agent: ['Agent', 'Agent'],

  /* What is addressed to you: why it arrived, and when. */
  mentioned: ['mentioned you', 'vous a mentionné'],
  assigned: ['assigned to you', 'vous est attribuée'],
  subscribed: ['new activity', 'nouvelle activité'],
  joinedYou: ['accepted your invitation', 'a accepté votre invitation'],
  posted: ['new announcement', 'nouvelle annonce'],
  replied: ['replied in a thread', 'a répondu dans un fil de discussion'],
  due: ['due', 'échéance'],
  added: ['added you to a project', 'vous a ajouté à un projet'],
  shared: ['shared a document with you', 'a partagé un document avec vous'],
  reminder: ['reminder', 'rappel'],
  unblocked: ['ready to start', 'prête à commencer'],
  asked: ['asked you a question', 'vous pose une question'],
  /* The inbox's two views. */
  allNotes: ['All', 'Toutes'],
  needsYou: ['Needs you', 'En attente de vous'],
  nothingNeedsYou: ['Nothing needs you', 'Rien ne vous attend'],
  nothingNeedsYouHint: ['Questions from agents show up here.', 'Les questions des agents s’affichent ici.'],
  askedBy: [(who: string) => `${who} asks`, (who: string) => `${who} demande`],
  /* What somebody did, said after their name when the note has no line of
     its own — "Emily Brooks mentioned you". */
  didMention: ['mentioned you', 'vous a mentionné'],
  didAssign: ['assigned you', 'vous a attribué une tâche'],
  didPost: ['posted an announcement', 'a publié une annonce'],
  didReply: ['replied in a thread', 'a répondu dans un fil de discussion'],
  didAdd: ['added you to a project', 'vous a ajouté à un projet'],
  didShare: ['shared a document with you', 'a partagé un document avec vous'],
  didAsk: ['asked you a question', 'vous pose une question'],
  didChange: ['made a change', 'a fait une modification'],
  aConversation: ['A conversation', 'Une conversation'],
  saidBy: [(who: string) => `${who}: `, (who: string) => `${who} : `],
  justNow: ['now', 'à l’instant'],
  minutesAgo: [(n: number) => `${n}m ago`, (n: number) => `il y a ${n} min`],
  hoursAgo: [(n: number) => `${n}h ago`, (n: number) => `il y a ${n} h`],
  daysAgo: [(n: number) => `${n}d ago`, (n: number) => `il y a ${n} j`],
})
