import {
  findNoteByText,
  PLAIN_TYPE_ID,
  relationTypeById,
  resolveRelationName,
  type Board,
  type ChainPlan,
  type Note,
  type NoteId,
  type RelationType,
} from '../domain'
import { parseChain, type NodeSegment, type RelationSegment } from './parse'

/**
 * Resolves a parsed chain against a board: which notes are new, reused or
 * referenced, which relation names are known, and what would be added.
 */

export type ResolvedNode = NodeSegment & {
  /** new: a note to create · reuse: same text as an existing note · ref: an @reference that matched · unmatched: an @reference that didn't · empty: nothing typed */
  status: 'new' | 'reuse' | 'ref' | 'unmatched' | 'empty'
  noteId?: NoteId
  /** The note's text when it resolved to one, else the typed text. */
  display: string
}

export type ResolvedRelation = RelationSegment & {
  status: 'known' | 'unknown'
  type?: RelationType
  /** False when the inverse name was typed. */
  canonical?: boolean
}

export type ResolvedPart = ResolvedNode | ResolvedRelation

export interface ResolvedChain {
  parts: ResolvedPart[]
  /** Problems the user has to fix before the chain can be added. */
  errors: string[]
  /** Relation names that need defining first. */
  unknownNames: string[]
  /** What to add, when there are no errors and no unknown names. */
  plan: ChainPlan | null
  newNoteCount: number
  relationCount: number
}

/** An `@query` matches a note with exactly that text, or else the only note containing it. */
export function resolveReference(board: Board, query: string): { note?: Note; matches: number } {
  const exact = findNoteByText(board, query)
  if (exact) return { note: exact, matches: 1 }
  const q = query.trim().toLowerCase()
  if (!q) return { matches: 0 }
  const hits = board.notes.filter((n) => n.text.toLowerCase().includes(q))
  return hits.length === 1 ? { note: hits[0], matches: 1 } : { matches: hits.length }
}

function resolveNode(board: Board, seg: NodeSegment, errors: string[], newTexts: Set<string>): ResolvedNode {
  if (!seg.text) return { ...seg, status: 'empty', display: '' }
  if (seg.ref) {
    const { note, matches } = resolveReference(board, seg.text)
    if (note) return { ...seg, status: 'ref', noteId: note.id, display: note.text }
    errors.push(
      matches === 0
        ? `No note matches “@${seg.text}”.`
        : `“@${seg.text}” matches ${matches} notes: type more of it.`,
    )
    return { ...seg, status: 'unmatched', display: seg.text }
  }
  const same = findNoteByText(board, seg.text)
  if (same) return { ...seg, status: 'reuse', noteId: same.id, display: same.text }
  const key = seg.text.toLowerCase()
  // The second time a new text appears in one chain, it is the note created the first time.
  const status = newTexts.has(key) ? 'reuse' : 'new'
  newTexts.add(key)
  return { ...seg, status, display: seg.text }
}

function resolveRelation(board: Board, seg: RelationSegment): ResolvedRelation {
  if (seg.name === null) {
    const plain = relationTypeById(board, PLAIN_TYPE_ID)
    return plain ? { ...seg, status: 'known', type: plain, canonical: true } : { ...seg, status: 'unknown' }
  }
  const found = resolveRelationName(board.relationTypes, seg.name)
  return found ? { ...seg, status: 'known', type: found.type, canonical: found.canonical } : { ...seg, status: 'unknown' }
}

export function resolveChain(board: Board, input: string): ResolvedChain {
  const errors: string[] = []
  const newTexts = new Set<string>()
  const parts: ResolvedPart[] = parseChain(input).map((seg) =>
    seg.kind === 'node' ? resolveNode(board, seg, errors, newTexts) : resolveRelation(board, seg),
  )

  const nodes = parts.filter((p): p is ResolvedNode => p.kind === 'node')
  const relations = parts.filter((p): p is ResolvedRelation => p.kind === 'relation')
  if (relations.length > 0 && nodes.some((n) => n.status === 'empty')) {
    errors.push(
      nodes.at(-1)!.status === 'empty'
        ? 'The chain ends with a relation: add a note after it.'
        : 'A relation needs a note on both sides.',
    )
  }
  const identity = (n: ResolvedNode) => n.noteId ?? `new:${n.text.toLowerCase()}`
  const selfLink = nodes.some((n, i) => {
    const next = nodes[i + 1]
    return next && n.status !== 'empty' && identity(n) === identity(next)
  })
  if (selfLink) errors.push('A note can’t relate to itself.')

  const unknownNames = [...new Set(relations.filter((r) => r.status === 'unknown').map((r) => r.name ?? '->'))]
  const empty = nodes.length === 1 && nodes[0]!.status === 'empty'

  const plan: ChainPlan | null =
    errors.length || unknownNames.length || empty
      ? null
      : {
          nodes: nodes.map((n) => (n.noteId ? { kind: 'existing', id: n.noteId } : { kind: 'new', text: n.text })),
          links: relations.map((r) => ({ typeId: r.type!.id, canonical: r.canonical! })),
        }

  return {
    parts,
    errors,
    unknownNames,
    plan,
    newNoteCount: nodes.filter((n) => n.status === 'new').length,
    relationCount: relations.length,
  }
}
