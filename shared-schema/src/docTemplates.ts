import { z } from 'zod'

/**
 * The documents a new one can start from.
 *
 * Here and not in the endpoint for the reason the project templates are
 * (`templates.ts`): the server makes the document, the web names the
 * choice, and an agent's tool lists the keys. One copy of each, in both
 * languages side by side, so a template added in English without its
 * French fails `contract.test.ts` rather than reaching a French workspace.
 *
 * `{date}` and `{project}` are filled when the document is made — the day
 * it is where its maker is, and the project it is made in.
 */
export const DocTemplate = z.enum(['brief', 'meeting', 'spec', 'report'])
export type DocTemplate = z.infer<typeof DocTemplate>

/** A block of a template, small enough to write by hand. */
export type TemplateBlock =
  | readonly ['h', string]
  | readonly ['p', string]
  | readonly ['ul' | 'ol', readonly string[]]
  | readonly ['callout', string, 'grey' | 'blue' | 'green' | 'yellow' | 'red', string]
  | readonly ['toggle', string, string]

type Written = { readonly name: string; readonly said: string; readonly blocks: readonly TemplateBlock[] }

export const DOC_TEMPLATES: Record<DocTemplate, { readonly en: Written; readonly fr: Written }> = {
  brief: {
    en: {
      name: 'Brief',
      said: 'What we’re making, for whom, and how we’ll know it worked.',
      blocks: [
        ['callout', '💡', 'grey', 'One page: what we’re making, for whom, and how we’ll know it worked.'],
        ['h', 'Background'],
        ['p', 'What prompted this, in two or three sentences.'],
        ['h', 'Goal'],
        ['p', 'The one outcome this work is for.'],
        ['h', 'Audience'],
        ['p', 'Who it’s for, and what they need from it.'],
        ['h', 'Scope'],
        ['ul', ['In: …', 'Out: …']],
        ['h', 'Deliverables'],
        ['ul', ['…']],
        ['h', 'Timeline'],
        ['ul', ['Start: {date}', 'Review: …', 'Delivery: …']],
        ['h', 'Contacts'],
        ['ul', ['Owner: …', 'Signs off: …']],
      ],
    },
    fr: {
      name: 'Brief',
      said: 'Ce que nous faisons, pour qui, et comment nous saurons que ça a marché.',
      blocks: [
        ['callout', '💡', 'grey', 'Une page : ce que nous faisons, pour qui, et comment nous saurons que ça a marché.'],
        ['h', 'Contexte'],
        ['p', 'Ce qui a déclenché ce travail, en deux ou trois phrases.'],
        ['h', 'Objectif'],
        ['p', 'Le seul résultat que ce travail doit atteindre.'],
        ['h', 'Public'],
        ['p', 'À qui il s’adresse, et ce dont ces personnes ont besoin.'],
        ['h', 'Périmètre'],
        ['ul', ['Inclus : …', 'Exclu : …']],
        ['h', 'Livrables'],
        ['ul', ['…']],
        ['h', 'Calendrier'],
        ['ul', ['Début : {date}', 'Revue : …', 'Livraison : …']],
        ['h', 'Contacts'],
        ['ul', ['Responsable : …', 'Valide : …']],
      ],
    },
  },
  meeting: {
    en: {
      name: 'Meeting notes {date}',
      said: 'Who came, what was said, what was decided, who does what.',
      blocks: [
        ['p', '{project} · {date}'],
        ['h', 'Attendees'],
        ['ul', ['…']],
        ['h', 'Agenda'],
        ['ol', ['…']],
        ['h', 'Notes'],
        ['p', '…'],
        ['h', 'Decisions'],
        ['ul', ['…']],
        ['h', 'Action items'],
        ['ul', ['Who — what — by when']],
      ],
    },
    fr: {
      name: 'Compte rendu {date}',
      said: 'Qui était là, ce qui a été dit, décidé, et qui fait quoi.',
      blocks: [
        ['p', '{project} · {date}'],
        ['h', 'Participants'],
        ['ul', ['…']],
        ['h', 'Ordre du jour'],
        ['ol', ['…']],
        ['h', 'Notes'],
        ['p', '…'],
        ['h', 'Décisions'],
        ['ul', ['…']],
        ['h', 'Actions'],
        ['ul', ['Qui — quoi — pour quand']],
      ],
    },
  },
  spec: {
    en: {
      name: 'Spec',
      said: 'The problem, the proposal, and what is still open.',
      blocks: [
        ['callout', 'ℹ️', 'blue', 'Status: draft · Owner: … · {date}'],
        ['h', 'Problem'],
        ['p', 'What is wrong today, and for whom.'],
        ['h', 'Goals'],
        ['ul', ['…']],
        ['h', 'Non-goals'],
        ['ul', ['…']],
        ['h', 'Proposal'],
        ['p', 'How it will work, step by step.'],
        ['h', 'Open questions'],
        ['ul', ['…']],
        ['toggle', 'Alternatives considered', 'What else was weighed, and why not.'],
      ],
    },
    fr: {
      name: 'Spécification',
      said: 'Le problème, la proposition, et ce qui reste ouvert.',
      blocks: [
        ['callout', 'ℹ️', 'blue', 'Statut : brouillon · Responsable : … · {date}'],
        ['h', 'Problème'],
        ['p', 'Ce qui ne va pas aujourd’hui, et pour qui.'],
        ['h', 'Objectifs'],
        ['ul', ['…']],
        ['h', 'Hors périmètre'],
        ['ul', ['…']],
        ['h', 'Proposition'],
        ['p', 'Comment ça fonctionnera, étape par étape.'],
        ['h', 'Questions ouvertes'],
        ['ul', ['…']],
        ['toggle', 'Autres pistes envisagées', 'Ce qui a été considéré, et pourquoi ce n’est pas retenu.'],
      ],
    },
  },
  report: {
    en: {
      name: 'Client report {date}',
      said: 'Where things stand, what’s next, and what we need from them.',
      blocks: [
        ['p', '{project} · {date}'],
        ['h', 'Summary'],
        ['callout', '✅', 'green', 'Where things stand, in one sentence.'],
        ['h', 'Done since the last report'],
        ['ul', ['…']],
        ['h', 'In progress'],
        ['ul', ['…']],
        ['h', 'Next'],
        ['ul', ['…']],
        ['h', 'Risks and blockers'],
        ['callout', '⚠️', 'yellow', 'Anything that could move a date, and what we’re doing about it.'],
        ['h', 'What we need from you'],
        ['ul', ['…']],
      ],
    },
    fr: {
      name: 'Rapport client {date}',
      said: 'Où en sont les choses, la suite, et ce qu’il nous faut du client.',
      blocks: [
        ['p', '{project} · {date}'],
        ['h', 'En bref'],
        ['callout', '✅', 'green', 'Où en sont les choses, en une phrase.'],
        ['h', 'Fait depuis le dernier rapport'],
        ['ul', ['…']],
        ['h', 'En cours'],
        ['ul', ['…']],
        ['h', 'À venir'],
        ['ul', ['…']],
        ['h', 'Risques et blocages'],
        ['callout', '⚠️', 'yellow', 'Ce qui pourrait décaler une date, et ce que nous faisons pour l’éviter.'],
        ['h', 'Ce qu’il nous faut de vous'],
        ['ul', ['…']],
      ],
    },
  },
}

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string }

const words = (text: string): Node[] => (text ? [{ type: 'text', text }] : [])
const para = (text: string): Node => ({ type: 'paragraph', content: words(text) })

/** A built-in template as the editor's document, in a language, not yet filled. */
export function templateDoc(key: DocTemplate, language: 'en' | 'fr'): { name: string; body: Node } {
  const t = DOC_TEMPLATES[key][language]
  const content = t.blocks.map((b): Node => {
    switch (b[0]) {
      case 'h':
        return { type: 'heading', attrs: { level: 2 }, content: words(b[1]) }
      case 'p':
        return para(b[1])
      case 'ul':
      case 'ol':
        return {
          type: b[0] === 'ul' ? 'bulletList' : 'orderedList',
          content: b[1].map((item) => ({ type: 'listItem', content: [para(item)] })),
        }
      case 'callout':
        return { type: 'callout', attrs: { emoji: b[1], tone: b[2] }, content: [para(b[3])] }
      case 'toggle':
        return {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: words(b[1]) },
            { type: 'detailsContent', content: [para(b[2])] },
          ],
        }
    }
  })
  return { name: t.name, body: { type: 'doc', content } }
}

/**
 * `{date}` and `{project}` in every text of a body, and in a name.
 *
 * Only in text: an attribute — a link's address, a file's id — is not
 * words somebody reads, and changing one would break what it points at.
 */
export function fillTemplate<T>(body: T, said: { date: string; project: string }): T {
  /* By a function: a project named `$&` or `$'` is its name, not the text
     around the placeholder, which a replacement string would make it. */
  const fill = (s: string) => s.replaceAll('{date}', () => said.date).replaceAll('{project}', () => said.project)
  const walk = (n: unknown, depth: number): unknown => {
    if (!n || typeof n !== 'object' || Array.isArray(n) || depth > 60) return n
    const node = n as Node
    return {
      ...node,
      ...(typeof node.text === 'string' ? { text: fill(node.text) } : {}),
      ...(Array.isArray(node.content) ? { content: node.content.map((k) => walk(k, depth + 1)) } : {}),
    }
  }
  return (typeof body === 'string' ? fill(body) : walk(body, 0)) as T
}
