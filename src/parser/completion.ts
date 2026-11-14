import {
  findNoteByText,
  isSymmetric,
  PLAIN_NAME,
  RELATION_NAME,
  searchNotes,
  type Board,
  type Note,
  type RelationType,
} from '../domain'

/**
 * Autocomplete for the command bar: what the text just before the cursor
 * asks for, the suggestions for it, and the text to insert when one is picked.
 */

export type CompletionContext =
  | { kind: 'relation'; query: string; start: number }
  | { kind: 'note'; query: string; start: number }

/**
 * `start` is where the replaced text begins: the space before `-` for a
 * relation, the `@` for a note.
 */
export function completionContext(board: Board, beforeCursor: string): CompletionContext | null {
  const rel = /\s-([a-z0-9_-]*)$/i.exec(beforeCursor)
  if (rel) return { kind: 'relation', query: rel[1]!.toLowerCase(), start: rel.index }

  const at = /@([^@]*)$/.exec(beforeCursor)
  if (!at) return null
  const query = at[1]!
  // A relation after the @reference means the reference is finished.
  if (/\s-[a-z0-9_-]*>/i.test(query)) return null
  // So does a space after the full text of a note (what picking one inserts).
  if (/\s$/.test(query) && findNoteByText(board, query)) return null
  return { kind: 'note', query, start: at.index }
}

export interface RelationSuggestion {
  name: string
  type: RelationType
  canonical: boolean
}

export type RelationOption = ({ define?: false } & RelationSuggestion) | { define: true; name: string }

/** Both names of every pair, the plain link, and “define new” when the query is a new valid name. */
export function relationOptions(types: readonly RelationType[], query: string): RelationOption[] {
  const q = query.toLowerCase()
  const all: RelationSuggestion[] = []
  const plain: RelationSuggestion[] = []
  for (const type of types) {
    if (type.plain) {
      plain.push({ name: PLAIN_NAME, type, canonical: true })
      continue
    }
    all.push({ name: type.canonical, type, canonical: true })
    if (!isSymmetric(type)) all.push({ name: type.inverse, type, canonical: false })
  }
  const named = all
    .filter((s) => s.name.includes(q))
    .sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)))
  const options: RelationOption[] = [...named, ...(q ? [] : plain)]
  if (q && RELATION_NAME.test(q) && !all.some((s) => s.name === q)) options.push({ define: true, name: q })
  return options
}

export function noteOptions(board: Board, query: string, limit = 6): Note[] {
  return searchNotes(board, query, limit)
}

/** The text a picked relation is inserted as. */
export function relationInsert(option: RelationOption): string {
  if (!option.define && option.type.plain) return ' -> '
  return ` -${option.name}> `
}

export function noteInsert(note: Note): string {
  return `@${note.text} `
}

/**
 * Replaces the text from `start` to the cursor with `insert`, dropping the
 * space right after the cursor so picks don't stack spaces.
 */
export function applyPick(
  input: string,
  cursor: number,
  start: number,
  insert: string,
): { value: string; cursor: number } {
  const before = input.slice(0, start)
  const after = input.slice(cursor).replace(/^\s+/, '')
  return { value: before + insert + after, cursor: before.length + insert.length }
}
