/**
 * Cluster layout: a pure function from a graph (with a size per node) to
 * positions.
 *
 * Each cluster (connected component) becomes a top-to-bottom tree. The root
 * is the cluster's oldest node, the tree is built breadth-first ignoring
 * edge direction, and every parent is centred over its children. Each
 * subtree is as wide as it needs to be for its nodes and for the label on
 * the edge above each node, and each row as tall as its tallest node. Clusters sit side by side and wrap to a new row when
 * a row gets too wide.
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface LayoutGraph {
  /** Node ids, oldest first. */
  nodes: readonly string[]
  /** `labelWidth`: room the edge's label needs, reserved above the child it leads to. */
  edges: readonly { from: string; to: string; labelWidth?: number }[]
  /** Box size per node; nodes without one get `defaultSize`. */
  sizes?: Readonly<Record<string, Size>>
}

export interface LayoutOptions {
  defaultSize: Size
  /** Horizontal space between neighbouring subtrees. */
  siblingGap: number
  /** Extra room around an edge label, so neighbouring labels don't touch. */
  labelPadding: number
  /** Vertical space between rows, where the edge labels go. */
  rowGap: number
  clusterGap: number
  maxRowWidth: number
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  defaultSize: { width: 168, height: 46 },
  siblingGap: 40,
  labelPadding: 24,
  rowGap: 100,
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

/** Label width per unordered node pair, the widest when there are several edges. */
function labelWidths(graph: LayoutGraph): Map<string, number> {
  const widths = new Map<string, number>()
  for (const e of graph.edges) {
    if (!e.labelWidth) continue
    for (const key of [`${e.from}\n${e.to}`, `${e.to}\n${e.from}`]) widths.set(key, Math.max(widths.get(key) ?? 0, e.labelWidth))
  }
  return widths
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

/** The roots the layout will use, without laying out (the UI needs them to size the nodes). */
export function clusterRoots(graph: LayoutGraph): Set<string> {
  return new Set(findClusters(graph).flatMap((c) => (c.length > 1 ? [c[0]!] : [])))
}

/** Lays out one cluster with its top-left corner at (0, 0). */
function layoutTree(
  root: string,
  adj: Map<string, Set<string>>,
  order: Map<string, number>,
  size: (id: string) => Size,
  labels: Map<string, number>,
  options: LayoutOptions,
) {
  const children = new Map<string, string[]>()
  const parent = new Map<string, string>()
  const depth = new Map([[root, 0]])
  const queue = [root]
  while (queue.length) {
    const id = queue.shift()!
    const kids = [...adj.get(id)!].filter((n) => !depth.has(n)).sort((a, b) => order.get(a)! - order.get(b)!)
    for (const kid of kids) {
      depth.set(kid, depth.get(id)! + 1)
      parent.set(kid, id)
      queue.push(kid)
    }
    children.set(id, kids)
  }

  // Each row is as tall as its tallest node; nodes are centred in their row.
  const rowHeights: number[] = []
  for (const [id, d] of depth) rowHeights[d] = Math.max(rowHeights[d] ?? 0, size(id).height)
  const rowCentres: number[] = []
  let top = 0
  rowHeights.forEach((h, d) => {
    rowCentres[d] = top + h / 2
    top += h + options.rowGap
  })
  const height = top - options.rowGap

  // A node takes the room of its box, or of the label on the edge from its parent if that is wider.
  const slot = (id: string) => {
    const p = parent.get(id)
    const label = p === undefined ? 0 : (labels.get(`${p}\n${id}`) ?? 0)
    return Math.max(size(id).width, label ? label + options.labelPadding : 0)
  }

  // A subtree is as wide as its root or its children side by side, whichever is wider.
  const widths = new Map<string, number>()
  const subtreeWidth = (id: string): number => {
    const kids = children.get(id)!
    const kidsWidth = kids.reduce((sum, k) => sum + subtreeWidth(k), 0) + options.siblingGap * Math.max(0, kids.length - 1)
    const w = Math.max(slot(id), kidsWidth)
    widths.set(id, w)
    return w
  }
  const width = subtreeWidth(root)

  const positions: Record<string, Point> = {}
  const place = (id: string, left: number) => {
    const kids = children.get(id)!
    const w = widths.get(id)!
    const own = slot(id)
    const y = rowCentres[depth.get(id)!]!
    if (!kids.length) {
      positions[id] = { x: left + w / 2, y }
      return
    }
    const kidsWidth = kids.reduce((sum, k) => sum + widths.get(k)!, 0) + options.siblingGap * (kids.length - 1)
    let x = left + (w - kidsWidth) / 2
    for (const k of kids) {
      place(k, x)
      x += widths.get(k)! + options.siblingGap
    }
    // Centred over the first and last child, but never sticking out of its own subtree.
    const mid = (positions[kids[0]!]!.x + positions[kids.at(-1)!]!.x) / 2
    positions[id] = { x: Math.min(Math.max(mid, left + own / 2), left + w - own / 2), y }
  }
  place(root, 0)
  return { positions, width, height }
}

export function layoutClusters(graph: LayoutGraph, options: LayoutOptions = DEFAULT_LAYOUT): Layout {
  const adj = adjacency(graph)
  const order = new Map(graph.nodes.map((id, i) => [id, i]))
  const size = (id: string) => graph.sizes?.[id] ?? options.defaultSize
  const clusters = findClusters(graph)
  const labels = labelWidths(graph)
  const positions: Record<string, Point> = {}
  const roots = new Set<string>()

  let x = 0
  let y = 0
  let rowHeight = 0
  for (const cluster of clusters) {
    const root = cluster[0]!
    if (cluster.length > 1) roots.add(root)
    const tree = layoutTree(root, adj, order, size, labels, options)
    if (x > 0 && x + tree.width > options.maxRowWidth) {
      x = 0
      y += rowHeight + options.clusterGap
      rowHeight = 0
    }
    for (const [id, p] of Object.entries(tree.positions)) positions[id] = { x: p.x + x, y: p.y + y }
    x += tree.width + options.clusterGap
    rowHeight = Math.max(rowHeight, tree.height)
  }
  return { positions, roots, clusters }
}
