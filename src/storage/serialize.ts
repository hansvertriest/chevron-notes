import { SCHEMA_VERSION, type Board } from '../domain'
import { RepositoryError } from './BoardRepository'

/**
 * Turns stored JSON into a Board, checking its shape. Older schema versions
 * get migrated here when there are any.
 */
export function parseBoard(data: unknown): Board {
  if (!isObject(data)) throw new RepositoryError('The stored board is not an object.')
  if (data.schemaVersion !== SCHEMA_VERSION)
    throw new RepositoryError(`Unsupported board schema version: ${String(data.schemaVersion)}.`)
  const ok =
    typeof data.id === 'string' &&
    typeof data.name === 'string' &&
    (data.ownerId === null || typeof data.ownerId === 'string') &&
    Array.isArray(data.notes) &&
    data.notes.every((n) => isObject(n) && typeof n.id === 'string' && typeof n.text === 'string') &&
    Array.isArray(data.relations) &&
    data.relations.every(
      (r) => isObject(r) && typeof r.id === 'string' && typeof r.typeId === 'string' && typeof r.from === 'string' && typeof r.to === 'string',
    ) &&
    Array.isArray(data.relationTypes) &&
    data.relationTypes.every(
      (t) => isObject(t) && typeof t.id === 'string' && typeof t.canonical === 'string' && typeof t.inverse === 'string',
    )
  if (!ok) throw new RepositoryError('The stored board is malformed.')
  return data as unknown as Board
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
