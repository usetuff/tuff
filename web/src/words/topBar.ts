import { one, say } from '../data/words.js'

/* A role by the name a person reads. The English is the role as the server
   says it; the French is the glossary's, in the same lower case. */
const ROLES: Record<string, string> = {
  owner: 'propriétaire',
  admin: 'administrateur',
  member: 'membre',
  guest: 'invité',
  client: 'client',
}

/** The bar across the top, and the workspace menu — `ui/TopBar.tsx`. */
export const TOP_BAR = say({
  themeSystem: ['Theme: follows the system', 'Thème : selon le système'],
  themeLight: ['Theme: light', 'Thème : clair'],
  themeDark: ['Theme: dark', 'Thème : sombre'],
  back: ['Back', 'Retour'],
  notifications: ['Notifications', 'Notifications'],
  unread: [(n: number) => `Notifications, ${n} unread`, (n: number) => `Notifications, ${n} ${one(n) ? 'non lue' : 'non lues'}`],
  /* The dot on a workspace's mark. */
  newElsewhere: ['New notifications in another workspace', 'Nouvelles notifications dans un autre espace de travail'],
  newThere: ['New notifications', 'Nouvelles notifications'],
  yourAccount: ['Your account', 'Votre compte'],
  active: ['Active', 'Actif'],
  away: ['Away', 'Absent'],
  busy: ['Do not disturb', 'Ne pas déranger'],
  accountSettings: ['Account settings', 'Paramètres du compte'],
  help: ['Help', 'Aide'],
  workspaceSettings: ['Workspace settings', 'Paramètres de l’espace de travail'],
  /* A door the workspace's own domain keeps shut, opened at usetuff.com. */
  opensAt: [(where: string) => `Opens ${where} in a new tab`, (where: string) => `Ouvre ${where} dans un nouvel onglet`],
  role: [(r: string | null | undefined) => r, (r: string | null | undefined) => (r ? (ROLES[r] ?? r) : r)],
})
