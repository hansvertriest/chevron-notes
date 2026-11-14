import { newUuid } from './ids'
import { checkRelationTypeDraft, STARTER_RELATION_TYPES, type RelationTypeDraft } from './relationTypes'
import {
  SCHEMA_VERSION,
  type Board,
  type Note,
  type NoteId,
  type Relation,
  type RelationId,
  type RelationType,
  type RelationTypeId,
} from './types'

/**
 * Board operations. Every command is pure: it takes a board and returns a new
 * one, so the UI can keep the last saved board and the store can retry saves.
 */

export class DomainError extends Error {}

/** What commands need from the outside world, injected so tests are deterministic. */
export interface Context {
  newId: () => string
  now: () => string
}

export const systemContext: Context = {
  newId: newUuid,
  now: () => new Date().toISOString(),
}

export function createBoard(ctx: Context, name = 'My board'): Board {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: ctx.newId(),
    ownerId: null,
    name,
    notes: [],
    relations: [],
    relationTypes: STARTER_RELATION_TYPES.map((t) => ({ ...t })),
  }
}

/* ---------- queries ---------- */

const norm = (text: string) => text.trim().toLowerCase()

export function noteById(board: Board, id: NoteId): Note | undefined {
  return board.notes.find((n) => n.id === id)
}

export function relationTypeById(board: Board, id: RelationTypeId): RelationType | undefined {
  return board.relationTypes.find((t) => t.id === id)
}

/** Same text means the same note: the match ignores case and surrounding space. */
export function findNoteByText(board: Board, text: string): Note | undefined {
  const t = norm(text)
  return t ? board.notes.find((n) => norm(n.text) === t) : undefined
}

/** Notes whose text contains the query, best matches first. */
export function searchNotes(board: Board, query: string, limit = 6): Note[] {
  const q = norm(query)
  if (!q) return board.notes.slice(-limit).reverse()
  const score = (n: Note) => {
    const t = norm(n.text)
    return t === q ? 0 : t.startsWith(q) ? 1 : 2
  }
  return board.notes
    .filter((n) => norm(n.text).includes(q))
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit)
}

export function relationsOf(board: Board, noteId: NoteId): Relation[] {
  return board.relations.filter((r) => r.from === noteId || r.to === noteId)
}

/* ---------- adding a chain ---------- */

/** `question: true` marks the note as a question; an existing note is never unmarked by a chain. */
export type ChainNode =
  | { kind: 'existing'; id: NoteId; question?: boolean }
  | { kind: 'new'; text: string; question?: boolean }

/**
 * The question rule: text that ends with `?` is a question, and the `?` is
 * not part of its text. `how do we invalidate on writes?` becomes the text
 * `how do we invalidate on writes`, marked as a question.
 */
export function splitQuestion(raw: string): { text: string; question: boolean } {
  const m = /^(.*?)\s*\?+\s*$/s.exec(raw)
  return m ? { text: m[1]!.trim(), question: true } : { text: raw.trim(), question: false }
}

export interface ChainLink {
  typeId: RelationTypeId
  /** False when the inverse name was typed: the link is stored the other way round. */
  canonical: boolean
}

/** `nodes[i] -links[i]-> nodes[i + 1]`, so there is one link fewer than nodes. */
export interface ChainPlan {
  nodes: ChainNode[]
  links: ChainLink[]
}

export interface ChainResult {
  board: Board
  createdNoteIds: NoteId[]
  createdRelationIds: RelationId[]
  /** Every note the chain mentions, new or existing. */
  chainNoteIds: NoteId[]
}

export function applyChain(board: Board, plan: ChainPlan, ctx: Context): ChainResult {
  if (plan.nodes.length === 0) throw new DomainError('Nothing to add.')
  if (plan.links.length !== plan.nodes.length - 1)
    throw new DomainError('A relation needs a node on both sides.')

  const now = ctx.now()
  const notes = [...board.notes]
  const relations = [...board.relations]
  const createdNoteIds: NoteId[] = []
  const createdRelationIds: RelationId[] = []

  const markQuestion = (id: NoteId) => {
    const i = notes.findIndex((n) => n.id === id)
    if (i >= 0 && !notes[i]!.question) notes[i] = { ...notes[i]!, question: true }
  }

  const ids = plan.nodes.map((node) => {
    if (node.kind === 'existing') {
      if (!notes.some((n) => n.id === node.id)) throw new DomainError('That note no longer exists.')
      if (node.question) markQuestion(node.id)
      return node.id
    }
    const text = node.text.trim()
    if (!text) throw new DomainError('A note needs some text.')
    const same = notes.find((n) => norm(n.text) === norm(text))
    if (same) {
      if (node.question) markQuestion(same.id)
      return same.id
    }
    const note: Note = { id: ctx.newId(), text, createdAt: now, ...(node.question ? { question: true } : {}) }
    notes.push(note)
    createdNoteIds.push(note.id)
    return note.id
  })

  plan.links.forEach((link, i) => {
    if (!relationTypeById(board, link.typeId)) throw new DomainError('Unknown relation type.')
    const a = ids[i]!
    const b = ids[i + 1]!
    if (a === b) throw new DomainError('A note can’t relate to itself.')
    const [from, to] = link.canonical ? [a, b] : [b, a]
    const exists = relations.some((r) => r.typeId === link.typeId && r.from === from && r.to === to)
    if (exists) return
    const relation: Relation = { id: ctx.newId(), typeId: link.typeId, from, to, createdAt: now }
    relations.push(relation)
    createdRelationIds.push(relation.id)
  })

  return {
    board: { ...board, notes, relations },
    createdNoteIds,
    createdRelationIds,
    chainNoteIds: [...new Set(ids)],
  }
}

/* ---------- editing ---------- */

export function updateNoteText(board: Board, id: NoteId, text: string): Board {
  const t = text.trim()
  if (!t) throw new DomainError('A note needs some text.')
  if (!noteById(board, id)) throw new DomainError('That note no longer exists.')
  const same = findNoteByText(board, t)
  if (same && same.id !== id) throw new DomainError('Another note already has this text.')
  return { ...board, notes: board.notes.map((n) => (n.id === id ? { ...n, text: t } : n)) }
}

export function setNoteQuestion(board: Board, id: NoteId, question: boolean): Board {
  if (!noteById(board, id)) throw new DomainError('That note no longer exists.')
  return {
    ...board,
    notes: board.notes.map((n) => {
      if (n.id !== id) return n
      const { question: _, ...rest } = n
      return question ? { ...rest, question: true } : rest
    }),
  }
}

/** Deletes a note together with all of its relations. */
export function deleteNote(board: Board, id: NoteId): Board {
  return {
    ...board,
    notes: board.notes.filter((n) => n.id !== id),
    relations: board.relations.filter((r) => r.from !== id && r.to !== id),
  }
}

function mapRelation(board: Board, id: RelationId, f: (r: Relation) => Relation): Board {
  if (!board.relations.some((r) => r.id === id)) throw new DomainError('That relation no longer exists.')
  return { ...board, relations: board.relations.map((r) => (r.id === id ? f(r) : r)) }
}

export function setRelationType(board: Board, id: RelationId, typeId: RelationTypeId): Board {
  if (!relationTypeById(board, typeId)) throw new DomainError('Unknown relation type.')
  return mapRelation(board, id, (r) => ({ ...r, typeId }))
}

export function swapRelation(board: Board, id: RelationId): Board {
  return mapRelation(board, id, (r) => ({ ...r, from: r.to, to: r.from }))
}

export function deleteRelation(board: Board, id: RelationId): Board {
  return { ...board, relations: board.relations.filter((r) => r.id !== id) }
}

/* ---------- relation types ---------- */

export function addRelationType(
  board: Board,
  draft: RelationTypeDraft,
  ctx: Context,
): { board: Board; type: RelationType } {
  const check = checkRelationTypeDraft(board.relationTypes, draft)
  if (!check.ok) throw new DomainError(check.error)
  const type: RelationType = { id: ctx.newId(), ...check.type }
  return { board: { ...board, relationTypes: [...board.relationTypes, type] }, type }
}

/** The name to show for a relation seen from one of its notes. */
export function nameFrom(board: Board, relation: Relation, noteId: NoteId): string {
  const type = relationTypeById(board, relation.typeId)
  if (!type) return '?'
  return relation.from === noteId ? type.canonical : type.inverse
}
