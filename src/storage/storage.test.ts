import { describe, expect, it } from 'vitest'
import { createBoard } from '../domain'
import { testContext } from '../domain/testing'
import { RepositoryError, RepositoryUnavailableError } from './BoardRepository'
import { HttpBoardRepository } from './HttpBoardRepository'
import { parseBoard } from './serialize'

const fakeFetch = (respond: () => Response | Promise<Response>): typeof fetch => async () => respond()
const api = (status: number) => new Response(null, { status, headers: { 'X-Chevron-Api': '1' } })

describe('parseBoard', () => {
  it('accepts a board and rejects other shapes or versions', () => {
    const board = createBoard(testContext())
    expect(parseBoard(JSON.parse(JSON.stringify(board)))).toEqual(board)
    expect(() => parseBoard({ ...board, schemaVersion: 99 })).toThrow(/version/)
    expect(() => parseBoard({ ...board, notes: [{ id: 1 }] })).toThrow(RepositoryError)
    expect(() => parseBoard([])).toThrow(RepositoryError)
  })
})

describe('HttpBoardRepository', () => {
  it('starts a new board when none is stored', async () => {
    const repo = new HttpBoardRepository('/api', testContext(), fakeFetch(() => api(404)))
    expect((await repo.load()).notes).toEqual([])
  })

  it('reports an unreachable API as unavailable', async () => {
    const down = new HttpBoardRepository('/api', testContext(), fakeFetch(() => Promise.reject(new TypeError('fetch failed'))))
    await expect(down.load()).rejects.toBeInstanceOf(RepositoryUnavailableError)
    // The Vite proxy answers 500 without the API's header when the API is down.
    const proxy = new HttpBoardRepository('/api', testContext(), fakeFetch(() => new Response(null, { status: 500 })))
    await expect(proxy.save(createBoard(testContext()))).rejects.toBeInstanceOf(RepositoryUnavailableError)
  })

  it('reports a refused save', async () => {
    const repo = new HttpBoardRepository('/api', testContext(), fakeFetch(() => api(500)))
    await expect(repo.save(createBoard(testContext()))).rejects.toBeInstanceOf(RepositoryError)
  })
})
