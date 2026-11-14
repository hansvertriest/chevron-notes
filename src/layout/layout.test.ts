import { describe, expect, it } from 'vitest'
import { clusterRoots, DEFAULT_LAYOUT, findClusters, layoutClusters, type Size } from './clusterTree'
import { boundsOf, edgeGeometry } from './geometry'

const { defaultSize: D, siblingGap: GAP, rowGap: ROWGAP, clusterGap: CGAP } = DEFAULT_LAYOUT
const W = D.width
const H = D.height

describe('findClusters', () => {
  it('groups connected nodes, ignoring direction, oldest first', () => {
    const graph = {
      nodes: ['a', 'b', 'c', 'd', 'e'],
      edges: [
        { from: 'c', to: 'a' },
        { from: 'd', to: 'b' },
        { from: 'c', to: 'e' },
      ],
    }
    expect(findClusters(graph)).toEqual([['a', 'c', 'e'], ['b', 'd']])
    expect(clusterRoots(graph)).toEqual(new Set(['a', 'b']))
  })
})

describe('layoutClusters', () => {
  it('builds a tree from the oldest node, parents centred over their children', () => {
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
    expect(positions.b!.y).toBe(H / 2 + H + ROWGAP)
    expect(positions.d!.y).toBe(H / 2 + 2 * (H + ROWGAP))
    expect(positions.d!.x).toBe(positions.b!.x)
    expect(positions.c!.x - positions.b!.x).toBe(W + GAP)
    expect(positions.a!.x).toBe((positions.b!.x + positions.c!.x) / 2)
  })

  it('sizes subtrees and rows to the nodes in them', () => {
    const sizes: Record<string, Size> = {
      root: { width: 60, height: 30 },
      wide: { width: 300, height: 30 },
      tall: { width: 50, height: 90 },
    }
    const { positions } = layoutClusters({
      nodes: ['root', 'wide', 'tall'],
      edges: [
        { from: 'root', to: 'wide' },
        { from: 'root', to: 'tall' },
      ],
      sizes,
    })
    // Siblings sit exactly a gap apart, edge to edge.
    expect(positions.tall!.x - 25 - (positions.wide!.x + 150)).toBe(GAP)
    expect(positions.wide!.x - 150).toBe(0)
    // The second row is as tall as its tallest node; both are centred in it.
    expect(positions.wide!.y).toBe(30 + ROWGAP + 45)
    expect(positions.tall!.y).toBe(positions.wide!.y)
  })

  it('keeps a wide parent inside its subtree and its children centred under it', () => {
    const { positions } = layoutClusters({
      nodes: ['p', 'c'],
      edges: [{ from: 'p', to: 'c' }],
      sizes: { p: { width: 400, height: 40 }, c: { width: 40, height: 40 } },
    })
    expect(positions.p!.x).toBe(200)
    expect(positions.c!.x).toBe(200)
  })

  it('reserves room for the label on the edge above each child', () => {
    const tiny = { width: 50, height: 30 }
    const sizes = { p: tiny, a: tiny, b: tiny }
    const edges = [
      { from: 'p', to: 'a', labelWidth: 100 },
      { from: 'b', to: 'p', labelWidth: 100 },
    ]
    const { positions } = layoutClusters({ nodes: ['p', 'a', 'b'], edges, sizes })
    expect(positions.b!.x - positions.a!.x).toBe(100 + DEFAULT_LAYOUT.labelPadding + GAP)
    const plain = layoutClusters({ nodes: ['p', 'a', 'b'], edges: edges.map(({ from, to }) => ({ from, to })), sizes })
    expect(plain.positions.b!.x - plain.positions.a!.x).toBe(50 + GAP)
  })

  it('puts clusters side by side and gives single nodes no root', () => {
    const { positions, roots } = layoutClusters({ nodes: ['a', 'b'], edges: [] })
    expect(roots.size).toBe(0)
    expect(positions.b!.x - positions.a!.x).toBe(W + CGAP)
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
  const box = (x: number, y: number, size: Size = D) => ({ at: { x, y }, size })
  const ROW = H + ROWGAP

  it('draws a vertical curve between rows, from bottom to top', () => {
    const g = edgeGeometry(box(0, 0), box(100, ROW))
    expect(g.d).toBe(`M0,${H / 2} C0,${(H / 2 + ROW - H / 2 - 2) / 2} 100,${(H / 2 + ROW - H / 2 - 2) / 2} 100,${ROW - H / 2 - 2}`)
  })

  it('puts the label on the curve, towards the lower note', () => {
    const top = H / 2
    const bottom = ROW - H / 2 - 2
    const down = edgeGeometry(box(0, 0), box(100, ROW))
    expect(down.label.y).toBeGreaterThan((top + bottom) / 2)
    expect(down.label.y).toBeLessThan(bottom - 20)
    expect(down.label.x).toBeGreaterThan(50)
    // An edge pointing up still has its label near the lower note.
    const up = edgeGeometry(box(100, ROW), box(0, 0))
    expect(up.label.x).toBeCloseTo(down.label.x)
    expect(up.label.y).toBeGreaterThan(ROW / 2)
  })

  it('uses each end’s own height', () => {
    const g = edgeGeometry(box(0, 0, { width: 50, height: 20 }), box(0, 200, { width: 50, height: 80 }))
    expect(g.d).toBe('M0,10 C0,84 0,84 0,158')
  })

  it('curves below the row within a row, even between neighbours', () => {
    for (const dx of [W + GAP, 4 * (W + GAP)]) {
      const g = edgeGeometry(box(0, 0), box(dx, 0))
      expect(g.d.startsWith(`M0,${H / 2} C`)).toBe(true)
      expect(g.label.y).toBeGreaterThan(H / 2 + 20)
      expect(g.label.y).toBeLessThan(H / 2 + ROWGAP / 2)
    }
  })
})

describe('boundsOf', () => {
  it('includes the node boxes', () => {
    expect(
      boundsOf([
        { at: { x: 0, y: 0 }, size: { width: 4, height: 2 } },
        { at: { x: 10, y: 20 }, size: { width: 8, height: 2 } },
      ]),
    ).toEqual({ minX: -2, maxX: 14, minY: -1, maxY: 21 })
    expect(boundsOf([])).toBeNull()
  })
})
