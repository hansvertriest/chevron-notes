import { createBoard, systemContext, type Board, type Context } from '../domain'
import { RepositoryError, RepositoryUnavailableError, type BoardRepository } from './BoardRepository'
import { parseBoard } from './serialize'

/** The PoC repository: one board as JSON, through the local API in `server/`. */
export class HttpBoardRepository implements BoardRepository {
  constructor(
    private readonly baseUrl = '/api',
    private readonly ctx: Context = systemContext,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async load(): Promise<Board> {
    const res = await this.request('/board', { method: 'GET' })
    if (res.status === 404) return createBoard(this.ctx)
    if (!res.ok) throw new RepositoryError(`Loading failed (${res.status}).`)
    return parseBoard(await res.json())
  }

  async save(board: Board): Promise<void> {
    const res = await this.request('/board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    })
    if (!res.ok) throw new RepositoryError(`Saving failed (${res.status}).`)
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await this.fetchFn(this.baseUrl + path, init)
    } catch (e) {
      throw new RepositoryUnavailableError(e instanceof Error ? e.message : 'The local API is unreachable.')
    }
    // The Vite dev proxy answers 502/504 when the API isn't running.
    if (res.status === 502 || res.status === 503 || res.status === 504)
      throw new RepositoryUnavailableError('The local API is unreachable.')
    return res
  }
}
