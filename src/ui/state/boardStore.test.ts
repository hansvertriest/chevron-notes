import { describe, expect, it } from 'vitest'
import { createBoard, type Board } from '../../domain'
import { testContext } from '../../domain/testing'
import { RepositoryUnavailableError, type BoardRepository } from '../../storage'
import { createBoardStore } from './boardStore'

class FakeRepo implements BoardRepository {
  stored: Board | null = null
  failSaves = false
  offline = false
  saves = 0
  async load() {
    if (this.offline) throw new RepositoryUnavailableError('down')
    return this.stored ?? createBoard(testContext())
  }
  async save(b: Board) {
    this.saves++
    await Promise.resolve()
    if (this.failSaves) throw new Error('disk full')
    this.stored = b
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
    expect(repo.stored?.notes.map((n) => n.text)).toEqual(['a'])
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
    expect(repo.stored?.notes).toHaveLength(3)
    expect(repo.saves).toBe(2)
  })
})
