import type { Board, BoardId } from '../domain'
import {
  BoardNotFoundError,
  RepositoryError,
  RepositoryUnavailableError,
  type BoardRepository,
  type BoardSummary,
} from './BoardRepository'
import { parseBoard, parseSummaries } from './serialize'

/** Set by `server/app.ts` on every response. */
const API_HEADER = 'X-Chevron-Api'

/** The PoC repository: boards as JSON files, through the local API in `server/`. */
export class HttpBoardRepository implements BoardRepository {
  constructor(
    private readonly baseUrl = '/api',
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async list(): Promise<BoardSummary[]> {
    const res = await this.request('/boards', { method: 'GET' })
    if (!res.ok) throw new RepositoryError(`Listing boards failed (${res.status}).`)
    return parseSummaries(await res.json())
  }

  async load(id: BoardId): Promise<Board> {
    const res = await this.request(boardPath(id), { method: 'GET' })
    if (res.status === 404) throw new BoardNotFoundError('This board doesn’t exist (any more).')
    if (!res.ok) throw new RepositoryError(`Loading failed (${res.status}).`)
    return parseBoard(await res.json())
  }

  async save(board: Board): Promise<void> {
    const res = await this.request(boardPath(board.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    })
    if (!res.ok) throw new RepositoryError(`Saving failed (${res.status}).`)
  }

  async delete(id: BoardId): Promise<void> {
    const res = await this.request(boardPath(id), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new RepositoryError(`Deleting failed (${res.status}).`)
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await this.fetchFn(this.baseUrl + path, init)
    } catch (e) {
      throw new RepositoryUnavailableError(e instanceof Error ? e.message : 'The local API is unreachable.')
    }
    // Without this header the answer came from something else, such as the
    // Vite dev proxy reporting that the API isn't running.
    if (!res.headers.has(API_HEADER)) throw new RepositoryUnavailableError('The local API is unreachable.')
    return res
  }
}

const boardPath = (id: BoardId) => `/boards/${encodeURIComponent(id)}`
