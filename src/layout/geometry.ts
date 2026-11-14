import type { Point } from './clusterTree'

export interface Size {
  width: number
  height: number
}

export interface EdgeGeometry {
  /** SVG path data from the edge of `a` to the edge of `b`. */
  d: string
  /** Where the label sits. */
  label: Point
}

const ARROW_GAP = 2

const r = (n: number) => Math.round(n * 100) / 100

/** The point where a ray from the centre of a box leaves the box, plus `pad`. */
function boxExit(c: Point, dx: number, dy: number, half: Size, pad: number): Point {
  const t = Math.min(
    (half.width + pad) / Math.max(Math.abs(dx), 1e-6),
    (half.height + pad) / Math.max(Math.abs(dy), 1e-6),
  )
  return { x: c.x + dx * t, y: c.y + dy * t }
}

/**
 * Between rows: a vertical bezier from the bottom of one box to the top of
 * the other, labelled at its midpoint. Within a row: a straight line.
 */
export function edgeGeometry(a: Point, b: Point, node: Size): EdgeGeometry {
  const half = { width: node.width / 2, height: node.height / 2 }
  const dy = b.y - a.y
  if (Math.abs(dy) > node.height + 30) {
    const s = Math.sign(dy)
    const y1 = a.y + s * half.height
    const y2 = b.y - s * (half.height + ARROW_GAP)
    const m = (y1 + y2) / 2
    const [ax, bx] = [r(a.x), r(b.x)]
    return {
      d: `M${ax},${r(y1)} C${ax},${r(m)} ${bx},${r(m)} ${bx},${r(y2)}`,
      label: { x: (a.x + b.x) / 2, y: m },
    }
  }
  const dx = b.x - a.x
  const p1 = boxExit(a, dx, dy, half, 0)
  const p2 = boxExit(b, -dx, -dy, half, ARROW_GAP)
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

/** The box around the given node centres, including the nodes themselves. */
export function boundsOf(points: readonly Point[], node: Size): Bounds | null {
  if (!points.length) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    minX: Math.min(...xs) - node.width / 2,
    maxX: Math.max(...xs) + node.width / 2,
    minY: Math.min(...ys) - node.height / 2,
    maxY: Math.max(...ys) + node.height / 2,
  }
}
