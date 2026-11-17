import { describe, expect, it } from 'vitest'
import { createBoard, type Board } from '../../domain'
import { testContext } from '../../domain/testing'
import { BoardNotFoundError, RepositoryUnavailableError, type BoardRepository } from '../../storage'
import { createBoardStore } from './boardStore'

class FakeRepo implements BoardRepository {
  stored = new Map<string, Board>()
  failSaves = false
  offline = false
  saves = 0
  async list() {
    if (this.offline) throw new RepositoryUnavailableError('down')
    return [...this.stored.values()].reverse().map((b) => ({ id: b.id, name: b.name, updatedAt: '' }))
  }
  async load(id: string) {
    const b = this.stored.get(id)
    if (!b) throw new BoardNotFoundError('gone')
    return b
  }
  async save(b: Board) {
    this.saves++
    await Promise.resolve()
    if (this.failSaves) throw new Error('disk full')
    this.stored.delete(b.id)
    this.stored.set(b.id, b)
  }
  async delete(id: string) {
    this.stored.delete(id)
  }
  get only() {
    return [...this.stored.values()][0]
  }
}

const note = (text: string) => ({ nodes: [{ kind: 'new' as const, text }], links: [] })

describe('boardStore', () => {
  it('loads, adds a chain and saves it', async () => {
    const repo = new FakeRepo()
    const store = createBoardStore(repo, testContext())
    await store.load()
    expect(store.loadState.value).toBe('ready')
    store.addChain(note('a'))
    expect(store.saveState.value).toBe('saving')
    await store.whenSaved()
    expect(store.saveState.value).toBe('saved')
    expect(repo.only?.notes.map((n) => n.text)).toEqual(['a'])
  })

  it('reports an offline API', async () => {
    const repo = new FakeRepo()
    repo.offline = true
    const store = createBoardStore(repo, testContext())
    await store.load()
    expect(store.loadState.value).toBe('offline')
  })

  it('keeps unsaved notes after a failed save and saves them on retry', async () => {
    const repo = new FakeRepo()
    const store = createBoardStore(repo, testContext())
    await store.load()
    repo.failSaves = true
    const { createdNoteIds } = store.addChain(note('a'))
    await store.whenSaved()
    expect(store.saveState.value).toBe('failed')
    expect([...store.unsavedNoteIds.value]).toEqual(createdNoteIds)
    repo.failSaves = false
    await store.retrySave()
    expect(store.saveState.value).toBe('saved')
    expect(store.unsavedNoteIds.value.size).toBe(0)
  })

  it('saves changes made during a save right after it', async () => {
    const repo = new FakeRepo()
    const store = createBoardStore(repo, testContext())
    await store.load()
    store.addChain(note('a'))
    store.addChain(note('b'))
    store.addChain(note('c'))
    await store.whenSaved()
    expect(repo.only?.notes).toHaveLength(3)
    expect(repo.saves).toBe(2)
  })

  it('opens the preferred board, else the most recent one', async () => {
    const repo = new FakeRepo()
    const ctx = testContext()
    const a = createBoard(ctx, 'A')
    const b = createBoard(ctx, 'B')
    await repo.save(a)
    await repo.save(b)
    const store = createBoardStore(repo, ctx)
    await store.load(a.id)
    expect(store.board.value.name).toBe('A')
    await store.load('unknown')
    expect(store.board.value.name).toBe('B')
    expect(store.boards.value.map((s) => s.name)).toEqual(['B', 'A'])
  })

  it('creates, switches, renames and deletes boards', async () => {
    const repo = new FakeRepo()
    const store = createBoardStore(repo, testContext())
    await store.load()
    store.addChain(note('first'))
    const first = store.board.value.id
    expect(await store.newBoard('Second')).toBe(true)
    await store.whenSaved()
    expect(store.board.value.notes).toEqual([])
    expect(repo.stored.get(first)?.notes).toHaveLength(1)
    expect(store.boards.value.map((s) => s.name)).toEqual(['Second', 'My board'])

    store.renameBoard('Renamed')
    await store.whenSaved()
    expect(store.boards.value[0]!.name).toBe('Renamed')

    await store.open(first)
    expect(store.board.value.notes.map((n) => n.text)).toEqual(['first'])

    await store.deleteOpenBoard()
    expect(repo.stored.has(first)).toBe(false)
    expect(store.board.value.name).toBe('Renamed')
    await store.deleteOpenBoard()
    expect(store.boards.value).toEqual([])
    expect(store.loadState.value).toBe('ready')
  })

  it('does not switch away from a board whose save failed', async () => {
    const repo = new FakeRepo()
    const store = createBoardStore(repo, testContext())
    await store.load()
    repo.failSaves = true
    store.addChain(note('a'))
    await store.whenSaved()
    const id = store.board.value.id
    expect(await store.newBoard('Other')).toBe(false)
    expect(store.board.value.id).toBe(id)
  })
})
