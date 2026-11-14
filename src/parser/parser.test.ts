import { describe, expect, it } from 'vitest'
import { applyChain, createBoard, PLAIN_TYPE_ID, type Board } from '../domain'
import { testContext } from '../domain/testing'
import { applyPick, completionContext, relationInsert, relationOptions } from './completion'
import { parseChain } from './parse'
import { resolveChain } from './resolve'

function boardWith(...texts: string[]): Board {
  const ctx = testContext()
  return texts.reduce(
    (b, text) => applyChain(b, { nodes: [{ kind: 'new', text }], links: [] }, ctx).board,
    createBoard(ctx),
  )
}

describe('parseChain', () => {
  it('reads a single note', () => {
    expect(parseChain('Performance issue')).toEqual([
      { kind: 'node', text: 'Performance issue', ref: false, start: 0, end: 17 },
    ])
  })

  it('splits a chain into nodes and relations', () => {
    const segs = parseChain('@raising max -blocked-by> restart -blocks> logging -IMPROVES> @perf')
    expect(segs.map((s) => (s.kind === 'node' ? `${s.ref ? '@' : ''}${s.text}` : `-${s.name}>`))).toEqual([
      '@raising max',
      '-blocked-by>',
      'restart',
      '-blocks>',
      'logging',
      '-improves>',
      '@perf',
    ])
  })

  it('reads -> as a plain link', () => {
    expect(parseChain('a -> b')[1]).toMatchObject({ kind: 'relation', name: null })
  })

  it('keeps dashes without a space before them as text', () => {
    expect(parseChain('e-mail a->b x -y')).toHaveLength(1)
    expect(parseChain('a - b')).toHaveLength(1)
  })

  it('keeps an unfinished relation as an empty node at the end', () => {
    expect(parseChain('a -improves> ').at(-1)).toMatchObject({ kind: 'node', text: '' })
  })
})

describe('resolveChain', () => {
  const board = boardWith('raising max_connections limit', 'server-side performance', 'performance budget')

  it('resolves the scope example', () => {
    const r = resolveChain(
      board,
      '@raising max_connections limit -blocked-by> having to restart the server -blocks> enabling better database logging -improves> @server-side',
    )
    expect(r.errors).toEqual([])
    expect(r.newNoteCount).toBe(2)
    expect(r.relationCount).toBe(3)
    expect(r.parts.map((p) => p.status)).toEqual(['ref', 'known', 'new', 'known', 'new', 'known', 'ref'])
    expect(r.plan?.links).toEqual([
      { typeId: 'blocked-by', canonical: true },
      { typeId: 'blocked-by', canonical: false },
      { typeId: 'improved-by', canonical: false },
    ])
    expect(r.plan?.nodes[0]).toEqual({ kind: 'existing', id: board.notes[0]!.id })
  })

  it('reuses notes with the same text', () => {
    const r = resolveChain(board, 'Raising MAX_connections limit -> new idea')
    expect(r.parts[0]).toMatchObject({ status: 'reuse', display: 'raising max_connections limit' })
    expect(r.newNoteCount).toBe(1)
  })

  it('reports references that match none or several notes', () => {
    expect(resolveChain(board, '@nothing').errors[0]).toMatch(/No note matches/)
    expect(resolveChain(board, '@performance').errors[0]).toMatch(/matches 2 notes/)
    expect(resolveChain(board, '@performance').plan).toBeNull()
  })

  it('reports relations without a note on both sides', () => {
    expect(resolveChain(board, 'a -improves> ').errors).toEqual(['The chain ends with a relation: add a note after it.'])
    expect(resolveChain(board, ' -improves> b').errors).toEqual(['A relation needs a note on both sides.'])
  })

  it('lists unknown relation names and gives no plan', () => {
    const r = resolveChain(board, 'a -depends-on> b')
    expect(r.unknownNames).toEqual(['depends-on'])
    expect(r.errors).toEqual([])
    expect(r.plan).toBeNull()
  })

  it('refuses a note linked to itself', () => {
    expect(resolveChain(board, 'a -> A').errors).toEqual(['A note can’t relate to itself.'])
  })

  it('gives no plan for empty input', () => {
    expect(resolveChain(board, '   ').plan).toBeNull()
  })

  it('builds a plan the model accepts', () => {
    const r = resolveChain(board, 'x -> y -> X')
    const applied = applyChain(board, r.plan!, testContext())
    expect(applied.createdNoteIds).toHaveLength(2)
    expect(applied.board.relations.every((rel) => rel.typeId === PLAIN_TYPE_ID)).toBe(true)
  })
})

describe('completionContext', () => {
  const board = boardWith('raising max_connections limit')

  it('asks for a relation after a space and a dash', () => {
    expect(completionContext(board, 'a -bl')).toEqual({ kind: 'relation', query: 'bl', start: 1 })
    expect(completionContext(board, 'a -')).toEqual({ kind: 'relation', query: '', start: 1 })
    expect(completionContext(board, 'a-bl')).toBeNull()
  })

  it('asks for a note after @', () => {
    expect(completionContext(board, 'x -> @max co')).toEqual({ kind: 'note', query: 'max co', start: 5 })
  })

  it('stops after a picked note or a relation', () => {
    expect(completionContext(board, '@raising max_connections limit ')).toBeNull()
    expect(completionContext(board, '@max -> b')).toBeNull()
  })
})

describe('relationOptions', () => {
  const { relationTypes } = createBoard(testContext())

  it('offers both names of each pair and the plain link', () => {
    const names = relationOptions(relationTypes, '').map((o) => o.name)
    expect(names).toContain('improved-by')
    expect(names).toContain('improves')
    expect(names.filter((n) => n === 'contradicts')).toHaveLength(1)
    expect(names.at(-1)).toBe('->')
  })

  it('filters with prefix matches first and offers to define a new name', () => {
    expect(relationOptions(relationTypes, 'bl').map((o) => o.name)).toEqual(['blocked-by', 'blocks', 'bl'])
    expect(relationOptions(relationTypes, 'by').map((o) => o.name)).toContain('improved-by')
    expect(relationOptions(relationTypes, 'depends').at(-1)).toEqual({ define: true, name: 'depends' })
    expect(relationOptions(relationTypes, 'blocks').some((o) => o.define)).toBe(false)
  })

  it('inserts picks into the input', () => {
    const [blocked] = relationOptions(relationTypes, 'bl')
    const input = 'a -bl b'
    expect(applyPick(input, 5, 1, relationInsert(blocked!))).toEqual({ value: 'a -blocked-by> b', cursor: 15 })
  })
})
