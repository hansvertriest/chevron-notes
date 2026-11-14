import type { RelationType, Tone } from './types'

export const PLAIN_TYPE_ID = 'plain'
export const PLAIN_NAME = '->'

/** The relation pairs a new board starts with. They are data, so a board can change them. */
export const STARTER_RELATION_TYPES: readonly RelationType[] = [
  { id: 'improved-by', canonical: 'improved-by', inverse: 'improves', tone: 'positive' },
  { id: 'blocked-by', canonical: 'blocked-by', inverse: 'blocks', tone: 'negative' },
  { id: 'caused-by', canonical: 'caused-by', inverse: 'causes', tone: 'neutral' },
  { id: 'answered-by', canonical: 'answered-by', inverse: 'answers', tone: 'positive' },
  { id: 'contradicts', canonical: 'contradicts', inverse: 'contradicts', tone: 'negative' },
  { id: PLAIN_TYPE_ID, canonical: PLAIN_NAME, inverse: PLAIN_NAME, tone: 'neutral', plain: true },
]

/** A relation name as typed: a letter, then letters, digits, `-` or `_`. */
export const RELATION_NAME = /^[a-z][a-z0-9_-]*$/

export function isSymmetric(type: RelationType): boolean {
  return type.canonical === type.inverse
}

export interface ResolvedName {
  type: RelationType
  /** False when the name is the inverse side: the relation is stored flipped. */
  canonical: boolean
}

/** Finds the pair a typed name belongs to. Names are case-insensitive. */
export function resolveRelationName(
  types: readonly RelationType[],
  name: string,
): ResolvedName | null {
  const n = name.trim().toLowerCase()
  for (const type of types) {
    if (type.canonical === n) return { type, canonical: true }
    if (type.inverse === n) return { type, canonical: false }
  }
  return null
}

export interface RelationTypeDraft {
  /** The name that was typed. */
  name: string
  /** The other side's name, or null for a symmetric relation. */
  inverse: string | null
  /** Which side the canvas shows and relations are stored in. */
  canvasShows: 'name' | 'inverse'
  tone: Tone
}

export type DraftCheck = { ok: true; type: Omit<RelationType, 'id'> } | { ok: false; error: string }

/** Validates a new relation definition against the names already in use. */
export function checkRelationTypeDraft(
  types: readonly RelationType[],
  draft: RelationTypeDraft,
): DraftCheck {
  const name = draft.name.trim().toLowerCase()
  const inverse = draft.inverse === null ? name : draft.inverse.trim().toLowerCase()
  if (!RELATION_NAME.test(name)) return { ok: false, error: `“${draft.name}” isn’t a valid relation name.` }
  if (draft.inverse !== null && !RELATION_NAME.test(inverse))
    return { ok: false, error: 'Give it an inverse name, or mark it symmetric.' }
  for (const n of new Set([name, inverse])) {
    if (resolveRelationName(types, n)) return { ok: false, error: `“${n}” is already a relation.` }
  }
  const [canonical, other] = draft.canvasShows === 'name' ? [name, inverse] : [inverse, name]
  return { ok: true, type: { canonical, inverse: other, tone: draft.tone } }
}
