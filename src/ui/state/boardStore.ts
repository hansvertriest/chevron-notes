import { computed, inject, readonly, ref, shallowRef, type InjectionKey } from 'vue'
import {
  addRelationType,
  applyChain,
  createBoard,
  renameBoard,
  deleteNote,
  deleteRelation,
  setNoteQuestion,
  setRelationType,
  swapRelation,
  systemContext,
  updateNoteText,
  type Board,
  type BoardId,
  type ChainPlan,
  type ChainResult,
  type Context,
  type NoteId,
  type RelationId,
  type RelationType,
  type RelationTypeDraft,
  type RelationTypeId,
} from '../../domain'
import { BoardNotFoundError, RepositoryUnavailableError, type BoardRepository, type BoardSummary } from '../../storage'

/**
 * The app's state: the list of boards, the open board, whether it loaded, and
 * whether it is saved. Every change goes through a domain command and is then
 * saved as a whole board. Saves run one at a time; changes made during a save
 * are saved right after it. Switching boards waits for the open board's save.
 */

export type LoadState = 'loading' | 'ready' | 'offline' | 'error'
export type SaveState = 'saved' | 'saving' | 'failed'

export function createBoardStore(repo: BoardRepository, ctx: Context = systemContext) {
  const board = shallowRef<Board>(createBoard(ctx))
  const boards = shallowRef<BoardSummary[]>([])
  const lastSaved = shallowRef<Board | null>(null)
  const loadState = ref<LoadState>('loading')
  const loadError = ref<string | null>(null)
  const saveState = ref<SaveState>('saved')
  const saveError = ref<string | null>(null)

  let saving: Promise<void> | null = null
  let dirty = false

  /** Notes that exist here but not in the last saved board. */
  const unsavedNoteIds = computed(() => {
    const saved = new Set(lastSaved.value?.notes.map((n) => n.id))
    return new Set(board.value.notes.filter((n) => !saved.has(n.id)).map((n) => n.id))
  })

  /** Shows a board that is now loaded or new. */
  function show(b: Board, saved: boolean) {
    board.value = b
    lastSaved.value = saved ? b : null
    saveState.value = 'saved'
    saveError.value = null
    loadState.value = 'ready'
  }

  function failLoad(e: unknown) {
    loadState.value = e instanceof RepositoryUnavailableError ? 'offline' : 'error'
    loadError.value = e instanceof Error ? e.message : String(e)
  }

  /** Keeps the list entry of the open board in step with it. */
  function touchSummary(b: Board) {
    const entry = { id: b.id, name: b.name, updatedAt: ctx.now() }
    boards.value = [entry, ...boards.value.filter((s) => s.id !== b.id)]
  }

  /**
   * Loads the board list and opens `preferredId` when it exists, else the
   * most recent board. With no boards at all it starts a new one, which is
   * stored on its first change.
   */
  async function load(preferredId?: BoardId | null) {
    loadState.value = 'loading'
    loadError.value = null
    try {
      boards.value = await repo.list()
      const id = boards.value.find((s) => s.id === preferredId)?.id ?? boards.value[0]?.id
      if (id) show(await repo.load(id), true)
      else show(createBoard(ctx), false)
    } catch (e) {
      failLoad(e)
    }
  }

  /**
   * Waits for the open board's save. False when it failed: switching away
   * would drop those changes, so the switch doesn't happen.
   */
  async function settle(): Promise<boolean> {
    await (saving ?? Promise.resolve())
    return saveState.value !== 'failed'
  }

  async function open(id: BoardId): Promise<boolean> {
    if (id === board.value.id && loadState.value === 'ready') return true
    if (!(await settle())) return false
    loadState.value = 'loading'
    loadError.value = null
    try {
      show(await repo.load(id), true)
    } catch (e) {
      if (e instanceof BoardNotFoundError) boards.value = boards.value.filter((s) => s.id !== id)
      failLoad(e)
    }
    return true
  }

  /** Starts a new board, saves it right away so it shows up everywhere, and opens it. */
  async function newBoard(name: string): Promise<boolean> {
    const b = renameBoard(createBoard(ctx), name)
    if (!(await settle())) return false
    show(b, false)
    touchSummary(b)
    void save()
    return true
  }

  /** Deletes the open board and opens the next most recent one, or a new one. */
  async function deleteOpenBoard() {
    const id = board.value.id
    await (saving ?? Promise.resolve())
    try {
      await repo.delete(id)
    } catch (e) {
      saveState.value = 'failed'
      saveError.value = e instanceof Error ? e.message : String(e)
      return
    }
    boards.value = boards.value.filter((s) => s.id !== id)
    const next = boards.value[0]
    if (next) await open(next.id)
    else show(createBoard(ctx), false)
  }

  function save(): Promise<void> {
    dirty = true
    if (saving) return saving
    saving = (async () => {
      while (dirty) {
        dirty = false
        const snapshot = board.value
        saveState.value = 'saving'
        try {
          await repo.save(snapshot)
          lastSaved.value = snapshot
          saveError.value = null
        } catch (e) {
          saveState.value = 'failed'
          saveError.value = e instanceof Error ? e.message : String(e)
          dirty = false
          saving = null
          return
        }
      }
      saveState.value = 'saved'
      saving = null
    })()
    return saving
  }

  function change(next: Board) {
    board.value = next
    touchSummary(next)
    void save()
  }

  return {
    board: computed(() => board.value),
    boards: computed(() => boards.value),
    loadState: readonly(loadState),
    loadError: readonly(loadError),
    saveState: readonly(saveState),
    saveError: readonly(saveError),
    unsavedNoteIds,
    load,
    open,
    newBoard,
    deleteOpenBoard,
    renameBoard(name: string) {
      change(renameBoard(board.value, name))
    },
    retrySave: save,
    /** Resolves when no save is running. */
    whenSaved: () => saving ?? Promise.resolve(),

    addChain(plan: ChainPlan): ChainResult {
      const result = applyChain(board.value, plan, ctx)
      change(result.board)
      return result
    },
    defineRelationType(draft: RelationTypeDraft): RelationType {
      const result = addRelationType(board.value, draft, ctx)
      change(result.board)
      return result.type
    },
    /** Text and question mark together, as one change. */
    editNote(id: NoteId, text: string, question: boolean) {
      change(setNoteQuestion(updateNoteText(board.value, id, text), id, question))
    },
    deleteNote(id: NoteId) {
      change(deleteNote(board.value, id))
    },
    setRelationType(id: RelationId, typeId: RelationTypeId) {
      change(setRelationType(board.value, id, typeId))
    },
    swapRelation(id: RelationId) {
      change(swapRelation(board.value, id))
    },
    deleteRelation(id: RelationId) {
      change(deleteRelation(board.value, id))
    },
  }
}

export type BoardStore = ReturnType<typeof createBoardStore>

export const BOARD_STORE: InjectionKey<BoardStore> = Symbol('boardStore')

export function useBoardStore(): BoardStore {
  const store = inject(BOARD_STORE)
  if (!store) throw new Error('No board store provided')
  return store
}
