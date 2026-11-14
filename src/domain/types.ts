/**
 * The domain model of a board. Plain data, no Vue and no I/O, so it can be
 * stored as JSON and tested on its own.
 */

export type NoteId = string
export type RelationId = string
export type RelationTypeId = string
export type BoardId = string
export type UserId = string

/** How a relation reads: green, red or neutral on the canvas. */
export type Tone = 'positive' | 'negative' | 'neutral'

/**
 * A relation pair such as `improved-by` / `improves`. Relations are stored
 * in the direction of `canonical`, and the canvas always shows that name.
 * A symmetric relation has the same name on both sides.
 */
export interface RelationType {
  id: RelationTypeId
  canonical: string
  inverse: string
  tone: Tone
  /** The unnamed `->` link: drawn dashed and without a label. */
  plain?: boolean
}

export interface Note {
  id: NoteId
  text: string
  createdAt: string
}

/** Always stored in canonical direction: `from -canonical-> to`. */
export interface Relation {
  id: RelationId
  typeId: RelationTypeId
  from: NoteId
  to: NoteId
  createdAt: string
}

export const SCHEMA_VERSION = 1

export interface Board {
  schemaVersion: typeof SCHEMA_VERSION
  id: BoardId
  /** Unused in the PoC (a single implicit user), kept for multi-user later. */
  ownerId: UserId | null
  name: string
  notes: Note[]
  relations: Relation[]
  relationTypes: RelationType[]
}
