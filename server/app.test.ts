import { mkdtemp, readFile, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyChain, createBoard } from '../src/domain'
import { testContext } from '../src/domain/testing'
import { HttpBoardRepository } from '../src/storage'
import { createApi } from './app.ts'
import { BoardFile } from './boardFile.ts'

let dir: string
let base: string
let close: () => Promise<void>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chevron-'))
  const server = createApi(new BoardFile(join(dir, 'nested', 'board.json')))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  close = () => new Promise((r) => server.close(() => r()))
})

afterEach(async () => {
  await close()
  await rm(dir, { recursive: true, force: true })
})

describe('local API', () => {
  it('round-trips a board through the repository', async () => {
    const ctx = testContext()
    const repo = new HttpBoardRepository(base, ctx)
    const empty = await repo.load()
    expect(empty.notes).toEqual([])
    const { board } = applyChain(createBoard(ctx), { nodes: [{ kind: 'new', text: 'hello' }], links: [] }, ctx)
    await repo.save(board)
    expect(await repo.load()).toEqual(board)
    const onDisk = JSON.parse(await readFile(join(dir, 'nested', 'board.json'), 'utf8'))
    expect(onDisk.schemaVersion).toBe(1)
  })

  it('refuses bodies that are not a board', async () => {
    const put = (body: string) => fetch(`${base}/board`, { method: 'PUT', body })
    expect((await put('nope')).status).toBe(400)
    expect((await put('{"a":1}')).status).toBe(400)
    expect((await fetch(`${base}/other`)).status).toBe(404)
    expect((await fetch(`${base}/board`, { method: 'DELETE' })).status).toBe(405)
  })

  it('overwrites the board on each save', async () => {
    const ctx = testContext()
    const repo = new HttpBoardRepository(base, ctx)
    const boards = [1, 2, 3, 4].map((n) => ({ ...createBoard(ctx), name: `b${n}` }))
    for (const b of boards) await repo.save(b)
    expect((await repo.load()).name).toBe('b4')
  })
})
