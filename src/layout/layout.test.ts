import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, findClusters, layoutClusters } from './clusterTree'
import { boundsOf, edgeGeometry } from './geometry'

const { columnWidth: COL, rowHeight: ROW, nodeWidth: W, nodeHeight: H, clusterGap: GAP } = DEFAULT_LAYOUT

describe('findClusters', () => {
  it('groups connected nodes, ignoring direction, oldest first', () => {
    const clusters = findClusters({
      nodes: ['a', 'b', 'c', 'd', 'e'],
      edges: [
        { from: 'c', to: 'a' },
        { from: 'd', to: 'b' },
        { from: 'c', to: 'e' },
      ],
    })
    expect(clusters).toEqual([['a', 'c', 'e'], ['b', 'd']])
  })
})

describe('layoutClusters', () => {
  it('builds a tree from the oldest node, parents centred over leaves', () => {
    // a is the root even though the edges point at it.
    const { positions, roots } = layoutClusters({
      nodes: ['a', 'b', 'c', 'd'],
      edges: [
        { from: 'b', to: 'a' },
        { from: 'c', to: 'a' },
        { from: 'b', to: 'd' },
      ],
    })
    expect(roots).toEqual(new Set(['a']))
    expect(positions.a!.y).toBe(H / 2)
    expect(positions.b!.y).toBe(H / 2 + ROW)
    expect(positions.d!.y).toBe(H / 2 + 2 * ROW)
    expect(positions.d!.x).toBe(positions.b!.x)
    expect(positions.c!.x - positions.b!.x).toBe(COL)
    expect(positions.a!.x).toBe((positions.b!.x + positions.c!.x) / 2)
  })

  it('puts clusters side by side and gives single nodes no root', () => {
    const { positions, roots } = layoutClusters({ nodes: ['a', 'b'], edges: [] })
    expect(roots.size).toBe(0)
    expect(positions.b!.x - positions.a!.x).toBe(W + GAP)
    expect(positions.b!.y).toBe(positions.a!.y)
  })

  it('wraps to a new row when a row gets too wide', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => `n${i}`)
    const { positions } = layoutClusters({ nodes, edges: [] })
    const rows = new Set(Object.values(positions).map((p) => p.y))
    expect(rows.size).toBe(2)
    expect(Math.max(...Object.values(positions).map((p) => p.x + W / 2))).toBeLessThanOrEqual(DEFAULT_LAYOUT.maxRowWidth)
  })

  it('is stable: adding a node to one cluster leaves the oldest root in place', () => {
    const before = layoutClusters({ nodes: ['a', 'b'], edges: [{ from: 'a', to: 'b' }] })
    const after = layoutClusters({ nodes: ['a', 'b', 'c'], edges: [{ from: 'a', to: 'b' }, { from: 'c', to: 'b' }] })
    expect(after.positions.a!.y).toBe(before.positions.a!.y)
    expect(after.roots).toEqual(new Set(['a']))
  })

  it('handles cycles', () => {
    const { positions } = layoutClusters({
      nodes: ['a', 'b', 'c'],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    })
    expect(Object.keys(positions)).toHaveLength(3)
  })
})

describe('edgeGeometry', () => {
  const size = { width: W, height: H }
  it('draws a vertical curve between rows, from bottom to top', () => {
    const g = edgeGeometry({ x: 0, y: 0 }, { x: 100, y: ROW }, size)
    expect(g.d.startsWith(`M0,${H / 2} C`)).toBe(true)
    expect(g.label).toEqual({ x: 50, y: (H / 2 + ROW - H / 2 - 2) / 2 })
  })
  it('draws a straight line between neighbours in a row', () => {
    const g = edgeGeometry({ x: 0, y: 0 }, { x: COL, y: 0 }, size)
    expect(g.d).toBe(`M${W / 2},0 L${COL - W / 2 - 2},0`)
  })
  it('dips below the row when notes sit in between', () => {
    const g = edgeGeometry({ x: 0, y: 0 }, { x: 4 * COL, y: 0 }, size)
    expect(g.d.startsWith(`M0,${H / 2} C`)).toBe(true)
    expect(g.label.y).toBeGreaterThan(H / 2)
    expect(g.label.y).toBeLessThan(ROW - H / 2)
  })
})

describe('boundsOf', () => {
  it('includes the node boxes', () => {
    expect(boundsOf([{ x: 0, y: 0 }, { x: 10, y: 20 }], { width: 4, height: 2 })).toEqual({ minX: -2, maxX: 12, minY: -1, maxY: 21 })
    expect(boundsOf([], { width: 4, height: 2 })).toBeNull()
  })
})
