import { onHost } from './host.js'

/**
 * Whether somebody may open Members. The
 * screen is the fourth switch's; somebody the owner lets connect agents
 * gets it all the same, with only the Agents tab.
 */
export function membersDoor(can: readonly string[]): boolean {
  return can.includes('members.read') || can.includes('agent.connect')
}

/**
 * Whether somebody may open the workspace's settings.
 *
 * Only somebody who may change something there: its owner (the switches,
 * and whatever the edition puts beside them), whoever reads the security log and the webhooks, or a member the
 * switches let bring people and projects in by importing. Asked of `can` from
 * `/api/me` in one place, so the menu, the drawer, More and the palette offer
 * the same door.
 */
export function workspaceDoor(can: readonly string[]): boolean {
  return (
    can.includes('workspace.billing') || can.includes('audit.read') || (can.includes('project.create') && can.includes('people.invite'))
  )
}

/**
 * On a workspace's own domain, the doors the host keeps shut that the
 * person's role would open at usetuff.com.
 * Each is the address
 * of the same screen at usetuff.com, or null where the door is open here
 * or would be shut there too. Decided from the server's `can_off_host`,
 * never by the page.
 */
export function doorsAway(me: { can: readonly string[]; can_off_host?: readonly string[] | undefined; workspace: { slug: string } }): {
  settings: string | null
  invite: string | null
} {
  const host = onHost()
  const off = me.can_off_host ?? []
  if (!host || off.length === 0) return { settings: null, invite: null }
  const at = (path: string) => `${host.home}/${me.workspace.slug}/${path}`
  return {
    settings: !workspaceDoor(me.can) && workspaceDoor([...me.can, ...off]) ? at('settings') : null,
    invite: inviteAway(me, `/${me.workspace.slug}/members`),
  }
}

/**
 * Inviting, where a workspace's own domain keeps it shut and the person's
 * role allows it at usetuff.com: `path` there — Members, or a project's
 * settings for its Invite someone new. Null anywhere else.
 */
export function inviteAway(me: { can: readonly string[]; can_off_host?: readonly string[] | undefined }, path: string): string | null {
  const host = onHost()
  if (!host || me.can.includes('people.invite') || !(me.can_off_host ?? []).includes('people.invite')) return null
  return `${host.home}${path}`
}
