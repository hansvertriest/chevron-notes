/**
 * Cluster layout: a pure function from a graph to positions.
 *
 * Each cluster (connected component) becomes a top-to-bottom tree. The root
 * is the cluster's oldest node, the tree is built breadth-first ignoring
 * edge direction, and every parent is centred over its leaves. Clusters sit
 * side by side and wrap to a new row when a row gets too wide.
 */

export interface Point {
  x: number
  y: number
}

export interface LayoutGraph {
  /** Node ids, oldest first. */
  nodes: readonly string[]
  edges: readonly { from: string; to: string }[]
}

export interface LayoutOptions {
  nodeWidth: number
  nodeHeight: number
  columnWidth: number
  rowHeight: number
  clusterGap: number
  maxRowWidth: number
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  nodeWidth: 168,
  nodeHeight: 46,
  columnWidth: 196,
  rowHeight: 130,
  clusterGap: 110,
  maxRowWidth: 1500,
}

export interface Layout {
  /** Node centres. */
  positions: Record<string, Point>
  /** Roots of clusters with more than one node (drawn in bold). */
  roots: Set<string>
  clusters: string[][]
}

function adjacency(graph: LayoutGraph): Map<string, Set<string>> {
  const adj = new Map(graph.nodes.map((id) => [id, new Set<string>()]))
  for (const e of graph.edges) {
    adj.get(e.from)?.add(e.to)
    adj.get(e.to)?.add(e.from)
  }
  return adj
}

/** Connected components, each sorted oldest first, in order of their oldest node. */
export function findClusters(graph: LayoutGraph): string[][] {
  const adj = adjacency(graph)
  const order = new Map(graph.nodes.map((id, i) => [id, i]))
  const seen = new Set<string>()
  const clusters: string[][] = []
  for (const start of graph.nodes) {
    if (seen.has(start)) continue
    const cluster: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const id = queue.shift()!
      cluster.push(id)
      for (const next of adj.get(id)!) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    clusters.push(cluster.sort((a, b) => order.get(a)! - order.get(b)!))
  }
  return clusters
}

/** Positions of one cluster relative to its own top-left slot: x in columns, y in rows. */
function treeSlots(root: string, adj: Map<string, Set<string>>, order: Map<string, number>) {
  const children = new Map<string, string[]>()
  const depth = new Map([[root, 0]])
  const queue = [root]
  while (queue.length) {
    const id = queue.shift()!
    const kids = [...adj.get(id)!].filter((n) => !depth.has(n)).sort((a, b) => order.get(a)! - order.get(b)!)
    for (const kid of kids) {
      depth.set(kid, depth.get(id)! + 1)
      queue.push(kid)
    }
    children.set(id, kids)
  }

  const column = new Map<string, number>()
  let nextLeaf = 0
  const place = (id: string) => {
    const kids = children.get(id)!
    if (!kids.length) {
      column.set(id, nextLeaf++)
      return
    }
    kids.forEach(place)
    column.set(id, (column.get(kids[0]!)! + column.get(kids.at(-1)!)!) / 2)
  }
  place(root)
  return { column, depth, width: nextLeaf }
}

export function layoutClusters(graph: LayoutGraph, options: LayoutOptions = DEFAULT_LAYOUT): Layout {
  const adj = adjacency(graph)
  const order = new Map(graph.nodes.map((id, i) => [id, i]))
  const clusters = findClusters(graph)
  const positions: Record<string, Point> = {}
  const roots = new Set<string>()
  const halfW = options.nodeWidth / 2
  const halfH = options.nodeHeight / 2

  let x = 0
  let y = 0
  let rowHeight = 0
  for (const cluster of clusters) {
    const root = cluster[0]!
    if (cluster.length > 1) roots.add(root)
    const { column, depth, width } = treeSlots(root, adj, order)
    const maxDepth = Math.max(...cluster.map((id) => depth.get(id)!))
    const w = (width - 1) * options.columnWidth + options.nodeWidth
    const h = maxDepth * options.rowHeight + options.nodeHeight
    if (x > 0 && x + w > options.maxRowWidth) {
      x = 0
      y += rowHeight + options.clusterGap
      rowHeight = 0
    }
    for (const id of cluster) {
      positions[id] = {
        x: x + halfW + column.get(id)! * options.columnWidth,
        y: y + halfH + depth.get(id)! * options.rowHeight,
      }
    }
    x += w + options.clusterGap
    rowHeight = Math.max(rowHeight, h)
  }
  return { positions, roots, clusters }
}
