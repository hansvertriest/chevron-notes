import type { Point, Size } from './clusterTree'

export interface EdgeGeometry {
  /** SVG path data from the edge of `a` to the edge of `b`. */
  d: string
  /** Where the label sits. */
  label: Point
}

/** A node as geometry sees it: its centre and its box. */
export interface Box {
  at: Point
  size: Size
}

const ARROW_GAP = 2
/** Same-row neighbours are closer than this (beyond their half widths); farther means notes in between. */
const NEIGHBOUR_GAP = 60

const r = (n: number) => Math.round(n * 100) / 100

/** The point where a ray from the centre of a box leaves the box, plus `pad`. */
function boxExit({ at, size }: Box, dx: number, dy: number, pad: number): Point {
  const t = Math.min(
    (size.width / 2 + pad) / Math.max(Math.abs(dx), 1e-6),
    (size.height / 2 + pad) / Math.max(Math.abs(dy), 1e-6),
  )
  return { x: at.x + dx * t, y: at.y + dy * t }
}

/**
 * Between rows: a vertical bezier from the bottom of one box to the top of
 * the other, labelled at its midpoint. Within a row: a straight line between
 * neighbours, and a curve dipping below the row when notes sit in between.
 */
export function edgeGeometry(a: Box, b: Box, rowGap = 84): EdgeGeometry {
  const ha = a.size.height / 2
  const hb = b.size.height / 2
  const dy = b.at.y - a.at.y
  const [ax, bx] = [r(a.at.x), r(b.at.x)]
  if (Math.abs(dy) > ha + hb + 30) {
    const s = Math.sign(dy)
    const y1 = a.at.y + s * ha
    const y2 = b.at.y - s * (hb + ARROW_GAP)
    const m = (y1 + y2) / 2
    return {
      d: `M${ax},${r(y1)} C${ax},${r(m)} ${bx},${r(m)} ${bx},${r(y2)}`,
      label: { x: (a.at.x + b.at.x) / 2, y: m },
    }
  }
  const dx = b.at.x - a.at.x
  if (Math.abs(dx) > (a.size.width + b.size.width) / 2 + NEIGHBOUR_GAP) {
    // Same row, with notes in between: dip below the row instead of crossing them.
    const y1 = a.at.y + ha
    const y2 = b.at.y + hb + ARROW_GAP
    const depth = Math.min(rowGap * 0.7, 30 + Math.abs(dx) * 0.05)
    return {
      d: `M${ax},${r(y1)} C${ax},${r(y1 + depth)} ${bx},${r(y2 + depth)} ${bx},${r(y2)}`,
      label: { x: (a.at.x + b.at.x) / 2, y: (y1 + y2) / 2 + depth * 0.75 },
    }
  }
  const p1 = boxExit(a, dx, dy, 0)
  const p2 = boxExit(b, -dx, -dy, ARROW_GAP)
  return {
    d: `M${r(p1.x)},${r(p1.y)} L${r(p2.x)},${r(p2.y)}`,
    label: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
  }
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** The box around the given nodes. */
export function boundsOf(boxes: readonly Box[]): Bounds | null {
  if (!boxes.length) return null
  return {
    minX: Math.min(...boxes.map((b) => b.at.x - b.size.width / 2)),
    maxX: Math.max(...boxes.map((b) => b.at.x + b.size.width / 2)),
    minY: Math.min(...boxes.map((b) => b.at.y - b.size.height / 2)),
    maxY: Math.max(...boxes.map((b) => b.at.y + b.size.height / 2)),
  }
}
