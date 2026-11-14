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
/**
 * Where on a curve between rows its label sits: past the middle, towards
 * the child. Siblings' labels then sit apart, above each child, instead of
 * piling up where the curves leave their shared parent.
 */
const LABEL_T = 0.68

const r = (n: number) => Math.round(n * 100) / 100

function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/**
 * Between rows: a vertical bezier from the bottom of one box to the top of
 * the other, labelled on the curve towards the lower end. Within a row: a
 * curve dipping below the row, labelled at its lowest point, so the label
 * has room even between neighbours.
 */
export function edgeGeometry(a: Box, b: Box, rowGap = 100): EdgeGeometry {
  const ha = a.size.height / 2
  const hb = b.size.height / 2
  const dy = b.at.y - a.at.y
  const [ax, bx] = [r(a.at.x), r(b.at.x)]
  if (Math.abs(dy) > ha + hb + 30) {
    const s = Math.sign(dy)
    const y1 = a.at.y + s * ha
    const y2 = b.at.y - s * (hb + ARROW_GAP)
    const m = (y1 + y2) / 2
    // Towards whichever end is lower, so the label is above the child.
    const t = s > 0 ? LABEL_T : 1 - LABEL_T
    return {
      d: `M${ax},${r(y1)} C${ax},${r(m)} ${bx},${r(m)} ${bx},${r(y2)}`,
      label: { x: cubic(a.at.x, a.at.x, b.at.x, b.at.x, t), y: cubic(y1, m, m, y2, t) },
    }
  }
  const dx = b.at.x - a.at.x
  const y1 = a.at.y + ha
  const y2 = b.at.y + hb + ARROW_GAP
  const depth = Math.min(rowGap * 0.45, 30 + Math.abs(dx) * 0.05)
  return {
    d: `M${ax},${r(y1)} C${ax},${r(y1 + depth)} ${bx},${r(y2 + depth)} ${bx},${r(y2)}`,
    label: { x: (a.at.x + b.at.x) / 2, y: (y1 + y2) / 2 + depth * 0.75 },
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
