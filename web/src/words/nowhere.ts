import { say } from '../data/words.js'

/** A session in no workspace — `ui/Nowhere.tsx`. */
export const NOWHERE = say({
  title: ['No workspaces', 'Aucun espace de travail'],
  body: ['You’re not in any workspace yet.', 'Vous ne faites encore partie d’aucun espace de travail.'],
  create: ['Create workspace', 'Créer un espace de travail'],
  cantCreate: ['Ask someone to invite you to their workspace.', 'Demandez à quelqu’un de vous inviter dans son espace de travail.'],
  invited: ['Invitations', 'Invitations'],
  join: ['Join', 'Rejoindre'],
  /* One mailed to a workspace's own domain, taken there from its email. */
  fromEmail: [(host: string) => `Use the email’s link · ${host}`, (host: string) => `Utilisez le lien de l’e-mail · ${host}`],
  joining: ['Joining…', 'Connexion…'],
  couldntJoin: ['Couldn’t join. Try again.', 'Impossible de rejoindre. Réessayez.'],
  signedInAs: [(email: string) => `Signed in as ${email}`, (email: string) => `Connecté en tant que ${email}`],
  signOut: ['Sign out', 'Se déconnecter'],
  deleteAccount: ['Delete account', 'Supprimer le compte'],
})
