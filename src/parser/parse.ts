/**
 * Syntax of the command bar, with no knowledge of the board:
 *
 *   chain    = node ( relation node )*
 *   relation = whitespace "-" name? ">" whitespace?     (no name: a plain link)
 *   node     = "@" query | text
 *
 * A relation needs a space before the `-`, so `e-mail` or `a->b` stay text.
 */

export interface Span {
  start: number
  end: number
}

export interface NodeSegment extends Span {
  kind: 'node'
  /** The text as typed, trimmed, without the `@`. Empty when nothing was typed. */
  text: string
  /** True for an `@reference` to an existing note. */
  ref: boolean
}

export interface RelationSegment extends Span {
  kind: 'relation'
  /** Lower-case name, or null for the plain `->` link. */
  name: string | null
}

export type Segment = NodeSegment | RelationSegment

const RELATION_TOKEN = /\s+-([a-z][a-z0-9_-]*)?>\s*/gi

function nodeSegment(input: string, start: number, end: number): NodeSegment {
  const raw = input.slice(start, end).trim()
  const ref = raw.startsWith('@')
  return { kind: 'node', text: ref ? raw.slice(1).trim() : raw, ref, start, end }
}

/** Splits the input into alternating node and relation segments, starting and ending with a node. */
export function parseChain(input: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const m of input.matchAll(RELATION_TOKEN)) {
    const start = m.index
    const end = start + m[0].length
    segments.push(nodeSegment(input, last, start))
    segments.push({ kind: 'relation', name: m[1]?.toLowerCase() ?? null, start, end })
    last = end
  }
  segments.push(nodeSegment(input, last, input.length))
  return segments
}
