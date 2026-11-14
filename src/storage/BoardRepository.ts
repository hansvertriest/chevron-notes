import type { Board } from '../domain'

/**
 * Where a board is loaded from and saved to. The app only talks to this
 * interface: the PoC stores JSON through a local API, and a database or a
 * multi-user API replaces only the implementation.
 */
export interface BoardRepository {
  /** Loads the board, or a new empty one when nothing is stored yet. */
  load(): Promise<Board>
  /** Stores the whole board. */
  save(board: Board): Promise<void>
}

/** The store can't be reached at all (as opposed to refusing a request). */
export class RepositoryUnavailableError extends Error {}

export class RepositoryError extends Error {}
