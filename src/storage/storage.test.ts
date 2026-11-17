import { describe, expect, it } from 'vitest'
import { createBoard } from '../domain'
import { testContext } from '../domain/testing'
import { BoardNotFoundError, RepositoryError, RepositoryUnavailableError } from './BoardRepository'
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
  it('reports a missing board', async () => {
    const repo = new HttpBoardRepository('/api', fakeFetch(() => api(404)))
    await expect(repo.load('x')).rejects.toBeInstanceOf(BoardNotFoundError)
  })

  it('rejects a malformed board list', async () => {
    const repo = new HttpBoardRepository('/api', fakeFetch(() => new Response('[{"id":1}]', { headers: { 'X-Chevron-Api': '1' } })))
    await expect(repo.list()).rejects.toBeInstanceOf(RepositoryError)
  })

  it('reports an unreachable API as unavailable', async () => {
    const down = new HttpBoardRepository('/api', fakeFetch(() => Promise.reject(new TypeError('fetch failed'))))
    await expect(down.list()).rejects.toBeInstanceOf(RepositoryUnavailableError)
    // The Vite proxy answers 500 without the API's header when the API is down.
    const proxy = new HttpBoardRepository('/api', fakeFetch(() => new Response(null, { status: 500 })))
    await expect(proxy.save(createBoard(testContext()))).rejects.toBeInstanceOf(RepositoryUnavailableError)
  })

  it('reports a refused save', async () => {
    const repo = new HttpBoardRepository('/api', fakeFetch(() => api(500)))
    await expect(repo.save(createBoard(testContext()))).rejects.toBeInstanceOf(RepositoryError)
  })
})
