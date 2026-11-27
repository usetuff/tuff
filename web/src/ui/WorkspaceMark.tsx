import { useEffect, useState } from 'react'
import { Icon, type IconName } from './glyphs.jsx'
import { markRadius } from './icons.jsx'
import { hashOf } from '../data/faces.js'

/** What a workspace looks like in the switcher. */
export type WorkspaceLook = {
  id?: string | undefined
  name: string
  mark_icon?: string | null | undefined
  mark_tint?: number | null | undefined
  icon_url?: string | null | undefined
}

/**
 * A workspace's mark: its picture, or a glyph or its first letter on one of
 * the ten colours. A rounded square, as a project's is — a workspace is a
 * place, and the circles are people. Nothing chosen is the letter on the
 * colour the id works out, which is what it always had.
 */
export function WorkspaceMark({ look, size = 16 }: { look: WorkspaceLook; size?: number }) {
  const radius = markRadius(size)
  const [lost, setLost] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new picture is a new chance to load, so what was lost is forgotten
  useEffect(() => setLost(false), [look.icon_url])
  if (look.icon_url && !lost) {
    return (
      <img
        src={look.icon_url}
        alt=""
        title={look.name}
        data-workspace-mark="picture"
        draggable={false}
        onError={() => setLost(true)}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    )
  }
  const tint = look.mark_tint ?? hashOf(look.id ?? look.name) % 10
  const letter = (look.name.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      aria-hidden
      title={look.name}
      data-workspace-mark={look.mark_icon ?? 'letter'}
      className="flex shrink-0 items-center justify-center font-semibold select-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `var(--face-${tint})`,
        color: '#ffffff',
        fontSize: Math.round(size * 0.56),
        lineHeight: `${size}px`,
      }}
    >
      {look.mark_icon ? <Icon name={look.mark_icon as IconName} size={Math.round(size * 0.6)} /> : letter}
    </span>
  )
}

/**
 * The mark with the dot that says something is waiting for this person in
 * that workspace.
 *
 * The dot rides the mark's corner, as the bell's count rides the bell: over
 * it, with a ring of the ground it stands on, and in no row's flow. The box
 * is the mark's size whether the dot is there or not, so nothing beside it
 * moves when one comes or goes. What it says to somebody who cannot see it
 * is the caller's to put in words, where the press is.
 */
export function MarkWithDot({
  look,
  size = 16,
  waiting,
  alarm = false,
  ground = 'var(--canvas)',
  testId = 'workspace-waiting',
}: {
  look: WorkspaceLook
  size?: number
  waiting: boolean
  /** Something about this workspace its owner must fix — its own domain
      stopped: the same dot in red, in place of the other. */
  alarm?: boolean
  /** What the mark is drawn on, for the ring that cuts the dot out of it. */
  ground?: string
  testId?: string
}) {
  return (
    <span className="relative flex shrink-0" style={{ width: size, height: size }}>
      <WorkspaceMark look={look} size={size} />
      {(waiting || alarm) && (
        <span
          data-testid={alarm ? 'workspace-alarm' : testId}
          aria-hidden
          className={`pointer-events-none absolute rounded-full ${alarm ? 'bg-danger' : 'bg-accent'}`}
          style={{ top: -4, right: -4, width: 8, height: 8, boxShadow: `0 0 0 2px ${ground}` }}
        />
      )}
    </span>
  )
}
