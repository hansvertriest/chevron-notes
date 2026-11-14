import { describe, expect, it } from 'vitest'
import {
  addRelationType,
  applyChain,
  createBoard,
  deleteNote,
  DomainError,
  findNoteByText,
  nameFrom,
  relationsOf,
  searchNotes,
  setRelationType,
  swapRelation,
  updateNoteText,
  type ChainPlan,
} from './board'
import { checkRelationTypeDraft, PLAIN_TYPE_ID, resolveRelationName } from './relationTypes'
import { testContext } from './testing'

const fresh = () => {
  const ctx = testContext()
  return { ctx, board: createBoard(ctx) }
}

const chain = (...parts: (string | { id: string })[]): ChainPlan['nodes'] =>
  parts.map((p) => (typeof p === 'string' ? { kind: 'new', text: p } : { kind: 'existing', id: p.id }))

describe('createBoard', () => {
  it('starts empty with a schema version, no owner and the starter relations', () => {
    const { board } = fresh()
    expect(board.schemaVersion).toBe(1)
    expect(board.ownerId).toBeNull()
    expect(board.notes).toEqual([])
    expect(board.relationTypes.map((t) => t.canonical)).toEqual([
      'improved-by',
      'blocked-by',
      'caused-by',
      'answered-by',
      'contradicts',
      '->',
    ])
  })
})

describe('resolveRelationName', () => {
  const { board } = fresh()
  it('finds both sides of a pair', () => {
    expect(resolveRelationName(board.relationTypes, 'improves')).toMatchObject({
      type: { id: 'improved-by' },
      canonical: false,
    })
    expect(resolveRelationName(board.relationTypes, 'Blocked-By')).toMatchObject({
      type: { id: 'blocked-by' },
      canonical: true,
    })
  })
  it('treats a symmetric name as canonical', () => {
    expect(resolveRelationName(board.relationTypes, 'contradicts')?.canonical).toBe(true)
  })
  it('returns null for unknown names', () => {
    expect(resolveRelationName(board.relationTypes, 'depends-on')).toBeNull()
  })
})

describe('applyChain', () => {
  it('adds a single note', () => {
    const { ctx, board } = fresh()
    const r = applyChain(board, { nodes: chain('Performance issue'), links: [] }, ctx)
    expect(r.board.notes).toEqual([{ id: 'id2', text: 'Performance issue', createdAt: expect.any(String) }])
    expect(r.createdNoteIds).toEqual(['id2'])
  })

  it('stores relations in canonical direction', () => {
    const { ctx, board } = fresh()
    const r = applyChain(
      board,
      { nodes: chain('fix', 'issue'), links: [{ typeId: 'improved-by', canonical: false }] },
      ctx,
    )
    const [fix, issue] = r.board.notes
    expect(r.board.relations).toEqual([
      expect.objectContaining({ typeId: 'improved-by', from: issue!.id, to: fix!.id }),
    ])
  })

  it('links a chain of existing and new notes', () => {
    const { ctx, board: b0 } = fresh()
    const { board: b1 } = applyChain(b0, { nodes: chain('raising max_connections', 'performance'), links: [{ typeId: PLAIN_TYPE_ID, canonical: true }] }, ctx)
    const [mc, perf] = b1.notes
    const r = applyChain(
      b1,
      {
        nodes: chain({ id: mc!.id }, 'restart the server', 'better logging', { id: perf!.id }),
        links: [
          { typeId: 'blocked-by', canonical: true },
          { typeId: 'blocked-by', canonical: false },
          { typeId: 'improved-by', canonical: false },
        ],
      },
      ctx,
    )
    expect(r.createdNoteIds).toHaveLength(2)
    expect(r.createdRelationIds).toHaveLength(3)
    expect(r.chainNoteIds).toHaveLength(4)
    const restart = findNoteByText(r.board, 'restart the server')!
    const logging = findNoteByText(r.board, 'better logging')!
    expect(r.board.relations.slice(1).map((x) => [x.typeId, x.from, x.to])).toEqual([
      ['blocked-by', mc!.id, restart.id],
      ['blocked-by', logging.id, restart.id],
      ['improved-by', perf!.id, logging.id],
    ])
  })

  it('reuses a note with the same text, ignoring case', () => {
    const { ctx, board: b0 } = fresh()
    const { board: b1 } = applyChain(b0, { nodes: chain('Cache'), links: [] }, ctx)
    const r = applyChain(b1, { nodes: chain('cache ', 'speed'), links: [{ typeId: 'improved-by', canonical: false }] }, ctx)
    expect(r.board.notes.map((n) => n.text)).toEqual(['Cache', 'speed'])
    expect(r.createdNoteIds).toHaveLength(1)
  })

  it('creates a repeated new text only once within a chain', () => {
    const { ctx, board } = fresh()
    const plain = { typeId: PLAIN_TYPE_ID, canonical: true }
    const r = applyChain(board, { nodes: chain('a', 'b', 'A'), links: [plain, plain] }, ctx)
    expect(r.board.notes).toHaveLength(2)
    expect(r.board.relations).toHaveLength(2)
  })

  it('skips a relation that already exists', () => {
    const { ctx, board: b0 } = fresh()
    const plan = { nodes: chain('a', 'b'), links: [{ typeId: 'caused-by', canonical: true }] }
    const { board: b1 } = applyChain(b0, plan, ctx)
    const r = applyChain(b1, plan, ctx)
    expect(r.board.relations).toHaveLength(1)
    expect(r.createdRelationIds).toEqual([])
  })

  it('rejects a self-relation and a broken plan', () => {
    const { ctx, board } = fresh()
    const plain = { typeId: PLAIN_TYPE_ID, canonical: true }
    expect(() => applyChain(board, { nodes: chain('a', 'a'), links: [plain] }, ctx)).toThrow(DomainError)
    expect(() => applyChain(board, { nodes: chain('a', 'b'), links: [] }, ctx)).toThrow(DomainError)
    expect(() => applyChain(board, { nodes: chain('a', 'b'), links: [{ typeId: 'nope', canonical: true }] }, ctx)).toThrow(DomainError)
  })

  it('does not change the input board', () => {
    const { ctx, board } = fresh()
    applyChain(board, { nodes: chain('a'), links: [] }, ctx)
    expect(board.notes).toEqual([])
  })
})

describe('editing', () => {
  const setup = () => {
    const { ctx, board } = fresh()
    const r = applyChain(
      board,
      { nodes: chain('a', 'b', 'c'), links: [{ typeId: 'blocked-by', canonical: true }, { typeId: 'caused-by', canonical: true }] },
      ctx,
    )
    const [a, b, c] = r.board.notes
    return { ctx, board: r.board, a: a!, b: b!, c: c! }
  }

  it('updates text but refuses empty or duplicate text', () => {
    const { board, a } = setup()
    expect(updateNoteText(board, a.id, '  A2 ').notes[0]!.text).toBe('A2')
    expect(() => updateNoteText(board, a.id, ' ')).toThrow(DomainError)
    expect(() => updateNoteText(board, a.id, 'B')).toThrow(/already/)
    expect(updateNoteText(board, a.id, 'A').notes[0]!.text).toBe('A')
  })

  it('deletes a note with its relations', () => {
    const { board, b } = setup()
    const next = deleteNote(board, b.id)
    expect(next.notes).toHaveLength(2)
    expect(next.relations).toEqual([])
  })

  it('changes type and swaps direction', () => {
    const { board, a, b } = setup()
    const rel = relationsOf(board, a.id)[0]!
    const typed = setRelationType(board, rel.id, 'improved-by')
    expect(typed.relations[0]!.typeId).toBe('improved-by')
    const swapped = swapRelation(board, rel.id)
    expect(swapped.relations[0]).toMatchObject({ from: b.id, to: a.id })
    expect(nameFrom(board, rel, a.id)).toBe('blocked-by')
    expect(nameFrom(board, rel, b.id)).toBe('blocks')
  })
})

describe('searchNotes', () => {
  it('puts exact and prefix matches first', () => {
    const { ctx, board } = fresh()
    const plain = { typeId: PLAIN_TYPE_ID, canonical: true }
    const r = applyChain(board, { nodes: chain('the pool', 'pool size', 'pool'), links: [plain, plain] }, ctx)
    expect(searchNotes(r.board, 'pool').map((n) => n.text)).toEqual(['pool', 'pool size', 'the pool'])
    expect(searchNotes(r.board, 'xyz')).toEqual([])
  })
})

describe('relation types', () => {
  it('defines a new pair with the chosen canonical side', () => {
    const { ctx, board } = fresh()
    const r = addRelationType(board, { name: 'depends-on', inverse: 'needed-by', canvasShows: 'inverse', tone: 'neutral' }, ctx)
    expect(r.type).toMatchObject({ canonical: 'needed-by', inverse: 'depends-on' })
    expect(resolveRelationName(r.board.relationTypes, 'depends-on')?.canonical).toBe(false)
  })

  it('defines a symmetric relation', () => {
    const { board } = fresh()
    const check = checkRelationTypeDraft(board.relationTypes, { name: 'relates', inverse: null, canvasShows: 'inverse', tone: 'neutral' })
    expect(check).toEqual({ ok: true, type: { canonical: 'relates', inverse: 'relates', tone: 'neutral' } })
  })

  it('refuses names already in use and invalid names', () => {
    const { board } = fresh()
    const draft = { name: 'depends-on', canvasShows: 'name', tone: 'neutral' } as const
    expect(checkRelationTypeDraft(board.relationTypes, { ...draft, inverse: 'blocks' }).ok).toBe(false)
    expect(checkRelationTypeDraft(board.relationTypes, { ...draft, inverse: '' }).ok).toBe(false)
    expect(checkRelationTypeDraft(board.relationTypes, { ...draft, name: '9x', inverse: 'y' }).ok).toBe(false)
  })
})
