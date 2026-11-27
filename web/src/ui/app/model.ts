import { useState, useEffect } from 'react'
import { whenRead, known as knownRead } from '../../data/ahead.js'
import { type Brand, type ServerVersion, type ProjectInList } from '@tracker/shared-schema'

export type Me = {
  /** `presence` is what everybody sees; `chosen` is which of the three was
      picked, or null for "work it out" — `docs/specs/presence.md`. */
  actor: {
    id: string
    name: string
    avatar_url?: string | null
    presence?: 'here' | 'away' | 'busy'
    chosen?: 'away' | 'busy' | null
    /** What they do, in their own words — `docs/specs/person-card.md`. */
    title?: string | null
    /** The zone quiet hours and their card use. */
    timezone?: string | null
    /** What they read the product in, null for never said. */
    language?: string | null
  }
  workspace: {
    id: string
    name: string
    slug: string
    mark_icon?: string | null
    mark_tint?: number | null
    icon_url?: string | null
    /** Its own name and mark, worn in Tuff's place. */
    brand?: Brand | null
    /** Its own domain stopped and is not yet connected again or removed —
        to whoever may fix it; the dot on the way to Settings. */
    domain_stopped?: boolean
  }
  role: 'owner' | 'member'
  settings: Record<string, string>
  can: string[]
  /** On a workspace's own domain, what the role allows at usetuff.com and
      the host refuses — the server's answer, for links there. */
  can_off_host?: string[]
  /** Your own server's version, to its owners only. */
  server?: ServerVersion
}
/* From the contract — `shared-schema/src/responses.ts`. */
export type Project = ProjectInList
export type Invitation = {
  id: string
  role: string
  email: string | null
  project_ids: string[]
  expires_at: string
  used_at: string | null
  deleted_at: string | null
  /** Mailed to the workspace's own domain, which no longer opens it: taken
      nowhere, to be sent again — the server's answer (`custom-domain.md`). */
  send_again?: boolean
}
/** The three places an agency and a large internal team genuinely differ. */

/* `joined` is optional because a shell kept on this device from before it
   was counted has no such key — `docs/specs/offline.md`. */
export type Unread = { mentioned: string; assigned: string; subscribed: string } & Partial<Record<string, string>>

/** Everything the inbox holds unread, whatever the reason. */
export const inboxCount = (u: Unread) => Object.values(u).reduce((n, v) => n + Number(v ?? 0), 0)

/**
 * The list as it stands after a row was dropped behind another.
 *
 * Here rather than in the sidebar because it is the list the sidebar was
 * handed that has to change: the drag rearranges what is drawn, and a screen
 * that snaps back while the request is in flight is the thing optimistic
 * writes exist to stop.
 */
export function rearranged<T extends { id: string }>(rows: T[], id: string, after: string | null): T[] {
  const moved = rows.find((r) => r.id === id)
  if (!moved) return rows
  const rest = rows.filter((r) => r.id !== id)
  const at = after ? rest.findIndex((r) => r.id === after) + 1 : 0
  rest.splice(at, 0, moved)
  return rest
}

/**
 * Whether a screen may draw yet: what it reads is in hand, or four hundred
 * milliseconds have passed.
 */
export function useWhole(paths: string[], on: boolean, also?: { ask: () => Promise<unknown>; known: () => boolean }): boolean {
  const [ready, setReady] = useState(false)
  const asked = paths.join('|')
  // biome-ignore lint/correctness/useExhaustiveDependencies: the list, by what it says: asked is the paths joined, and also is read at the time
  useEffect(() => {
    if (!on) {
      setReady(false)
      return
    }
    let live = true
    void whenRead(paths, 400, also ? [also.ask()] : []).then(() => live && setReady(true))
    return () => {
      live = false
    }
    // The list, by what it says.
  }, [on, asked])
  return on && (ready || (paths.every((p) => knownRead(p) !== null) && (also?.known() ?? true)))
}

/** The longest the first screen's contents are held for their data. */
export const ARRIVAL_CAP = 800

/**
 * The mark `index.html` shows on a phone while the app starts, faded into
 * whatever was drawn under it. Once; every later call finds nothing.
 */
export function letGo(): void {
  const mark = document.getElementById('splash')
  if (!mark || mark.dataset.going !== undefined) return
  mark.dataset.going = ''
  setTimeout(() => mark.remove(), 200)
}
