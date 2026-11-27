import { one, say } from '../data/words.js'

/** A project's tasks, the list and the board — `ui/Tasks.tsx`. */
export const TASKS = say({
  /* What each order is called, said on a column while a card is held over
     it: "Sorted by due date". */
  sortDue: ['due date', 'date d’échéance'],
  sortRecent: ['last updated', 'dernière modification'],
  sortPriority: ['priority', 'priorité'],
  sortTitle: ['title', 'titre'],
  sortCycle: ['sprint', 'sprint'],
  sortCreated: ['created date', 'date de création'],

  /* The card. */
  age: [(n: number) => `${n}d`, (n: number) => `${n} j`],
  sprintFor: [(title: string) => `Sprint for ${title}`, (title: string) => `Sprint de ${title}`],
  created: [(date: string) => `Created ${date}`, (date: string) => `Créée le ${date}`],
  updated: [(date: string) => `Updated ${date}`, (date: string) => `Modifiée le ${date}`],

  /* The way back after a delete. */
  deletedOne: [(title: string) => `Deleted ${title}`, (title: string) => `Tâche supprimée : ${title}`],
  deletedMany: [
    (n: number) => `Deleted ${n === 1 ? '1 task' : `${n} tasks`}`,
    (n: number) => (one(n) ? `${n} tâche supprimée` : `${n} tâches supprimées`),
  ],

  /* The bar that says what is taken. */
  selected: [(n: number) => `${n} selected`, (n: number) => (one(n) ? `${n} sélectionnée` : `${n} sélectionnées`)],
  /** What a menu over the selection is about: "Assignee of 3 tasks". */
  nTasks: [(n: number) => (n === 1 ? `${n} task` : `${n} tasks`), (n: number) => (one(n) ? `${n} tâche` : `${n} tâches`)],

  /* The bands a list is grouped into, when the band has nothing to be named by. */
  noAssignee: ['No assignee', 'Sans responsable'],
  noLabels: ['No labels', 'Sans étiquette'],
  noPriority: ['No priority', 'Sans priorité'],
  noDueDate: ['No due date', 'Sans échéance'],
  dueByToday: ['Due today or earlier', 'Échéance aujourd’hui ou avant'],
  dueLater: ['Due later', 'Échéance plus tard'],
  noList: ['No list', 'Sans liste'],

  /* The bar over the work. */
  board: ['Board', 'Tableau'],
  /* What a board's columns are, in its View menu: the lists, or the members.
     Members, as the project's own people are
     called on its Settings and in Linear's and Asana's grouping. */
  columns: ['Columns', 'Colonnes'],
  columnsLists: ['Status', 'Statut'],
  columnsMembers: ['Members', 'Membres'],
  /* The ring before a card's title on the board of members, for whoever
     cannot see it: the list the task is in. */
  statusIs: [(list: string) => `Status: ${list}`, (list: string) => `Statut : ${list}`],

  /* A column in the people view. */
  notOnProject: ['Not on this project', 'Hors du projet'],
  doneCount: [(n: number) => `${n} done`, (n: number) => (one(n) ? `${n} terminée` : `${n} terminées`)],
  openCount: [
    (n: number) => (n === 1 ? '1 open task' : `${n} open tasks`),
    (n: number) => (one(n) ? `${n} tâche en cours` : `${n} tâches en cours`),
  ],

  /* A column on the board. */
  expand: [(name: string) => `Expand ${name}`, (name: string) => `Développer la colonne ${name}`],
  collapse: [(name: string) => `Collapse ${name}`, (name: string) => `Réduire la colonne ${name}`],
  /* The face beside a list an agent takes. */
  takesHere: [(name: string) => `${name} takes new tasks here`, (name: string) => `${name} prend les nouvelles tâches de cette liste`],

  noTasks: ['No tasks yet', 'Aucune tâche pour l’instant'],
  noTasksBody: ['Create a task for anything someone needs to do.', 'Créez une tâche pour tout ce que quelqu’un doit faire.'],

  /* The View panel. */
  allLists: ['All lists', 'Toutes les listes'],
  grouping: ['Grouping', 'Regroupement'],
  label: ['Label', 'Étiquette'],
  dueDate: ['Due date', 'Échéance'],
  ordering: ['Ordering', 'Tri'],
  manual: ['Manual', 'Manuel'],
  title: ['Title', 'Titre'],
  lastUpdated: ['Last updated', 'Dernière modification'],
  /* When it was made, newest first. */
  createdOrder: ['Created', 'Date de création'],
  direction: ['Direction', 'Ordre'],
  firstToLast: ['First to last', 'Croissant'],
  lastToFirst: ['Last to first', 'Décroissant'],
  showOnRow: ['Show on each row', 'Afficher sur chaque ligne'],
  showOnCard: ['Show on each card', 'Afficher sur chaque carte'],
  number: ['Number', 'Numéro'],
  dates: ['Dates', 'Dates'],
  ageSwitch: ['Age', 'Ancienneté'],
  /* The task's first picture at the head of its card. */
  images: ['Images', 'Images'],
  /* The start of the task's description under its title. */
  description: ['Description', 'Description'],

  /* Whose work, in the View panel. */
  assignedTo: ['Assigned to', 'Attribuées à'],
  everyone: ['Everyone', 'Tout le monde'],
  mine: ['Mine', 'Les miennes'],
  noOne: ['No one', 'Personne'],
  noOneByThatName: ['No one by that name.', 'Personne ne porte ce nom.'],
  /* A row's and a card's mark while what it waits on is open.
     Asana's "En attente de". */
  waitingOn: [(handle: string) => `Waiting on ${handle}`, (handle: string) => `En attente de ${handle}`],
  waitingOnMore: [
    (handle: string, more: number) => `Waiting on ${handle} +${more}`,
    (handle: string, more: number) => `En attente de ${handle} +${more}`,
  ],
})
