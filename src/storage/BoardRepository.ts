import type { Board, BoardId } from '../domain'

/** A board as the board list shows it, without its notes. */
export interface BoardSummary {
  id: BoardId
  name: string
  updatedAt: string
}

/**
 * Where boards are loaded from and saved to. The app only talks to this
 * interface: the PoC stores JSON through a local API, and a database or a
 * multi-user API replaces only the implementation.
 */
export interface BoardRepository {
  /** Every stored board, most recently changed first. */
  list(): Promise<BoardSummary[]>
  /** Loads one board; throws `BoardNotFoundError` when it isn't stored. */
  load(id: BoardId): Promise<Board>
  /** Stores the whole board, creating it when it is new. */
  save(board: Board): Promise<void>
  /** Removes a board; deleting one that is already gone is fine. */
  delete(id: BoardId): Promise<void>
}

export class RepositoryError extends Error {}

/** The store can't be reached at all (as opposed to refusing a request). */
export class RepositoryUnavailableError extends RepositoryError {}

export class BoardNotFoundError extends RepositoryError {}
