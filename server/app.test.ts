import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyChain, createBoard } from '../src/domain'
import { testContext } from '../src/domain/testing'
import { BoardNotFoundError, HttpBoardRepository } from '../src/storage'
import { createApi } from './app.ts'
import { BoardFolder } from './boardFolder.ts'

let dir: string
let folder: BoardFolder
let base: string
let close: () => Promise<void>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chevron-'))
  folder = new BoardFolder(join(dir, 'nested', 'boards'))
  const server = createApi(folder)
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
    const repo = new HttpBoardRepository(base)
    expect(await repo.list()).toEqual([])
    const { board } = applyChain(createBoard(ctx), { nodes: [{ kind: 'new', text: 'hello' }], links: [] }, ctx)
    await expect(repo.load(board.id)).rejects.toBeInstanceOf(BoardNotFoundError)
    await repo.save(board)
    expect(await repo.load(board.id)).toEqual(board)
    const onDisk = JSON.parse(await readFile(join(folder.dir, `${board.id}.json`), 'utf8'))
    expect(onDisk.schemaVersion).toBe(1)
  })

  it('keeps boards apart, lists them and deletes one', async () => {
    const ctx = testContext()
    const repo = new HttpBoardRepository(base)
    const a = createBoard(ctx, 'Alpha')
    const b = createBoard(ctx, 'Beta')
    await repo.save(a)
    await repo.save(b)
    await repo.save({ ...a, name: 'Alpha 2' })
    const list = await repo.list()
    expect(list.map((s) => s.name).sort()).toEqual(['Alpha 2', 'Beta'])
    expect((await repo.load(b.id)).name).toBe('Beta')
    await repo.delete(a.id)
    expect((await repo.list()).map((s) => s.id)).toEqual([b.id])
    await repo.delete(a.id) // already gone is fine
  })

  it('refuses bodies that are not a board, or that name another board', async () => {
    const put = (id: string, body: string) => fetch(`${base}/boards/${id}`, { method: 'PUT', body })
    expect((await put('x', 'nope')).status).toBe(400)
    expect((await put('x', '{"a":1}')).status).toBe(400)
    expect((await put('x', '{"schemaVersion":1,"id":"y"}')).status).toBe(400)
    expect((await fetch(`${base}/other`)).status).toBe(404)
    expect((await fetch(`${base}/boards`, { method: 'POST' })).status).toBe(405)
    expect((await fetch(`${base}/boards/x`, { method: 'PATCH' })).status).toBe(405)
  })

  it('refuses ids that could escape the folder', async () => {
    expect((await fetch(`${base}/boards/..%2Fsecret`)).status).toBe(400)
    expect((await fetch(`${base}/boards/a.b`)).status).toBe(400)
  })
})

describe('BoardFolder.adopt', () => {
  it('moves the old single board.json into the folder', async () => {
    const board = createBoard(testContext(), 'Old')
    const legacy = join(dir, 'board.json')
    await mkdir(dir, { recursive: true })
    await writeFile(legacy, JSON.stringify(board))
    expect(await folder.adopt(legacy)).toBe(board.id)
    expect(await folder.adopt(legacy)).toBeNull()
    expect(await folder.list()).toMatchObject([{ id: board.id, name: 'Old' }])
  })
})
