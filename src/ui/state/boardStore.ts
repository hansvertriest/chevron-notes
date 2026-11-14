import { computed, inject, readonly, ref, shallowRef, type InjectionKey } from 'vue'
import {
  addRelationType,
  applyChain,
  createBoard,
  deleteNote,
  deleteRelation,
  setNoteQuestion,
  setRelationType,
  swapRelation,
  systemContext,
  updateNoteText,
  type Board,
  type ChainPlan,
  type ChainResult,
  type Context,
  type NoteId,
  type RelationId,
  type RelationType,
  type RelationTypeDraft,
  type RelationTypeId,
} from '../../domain'
import { RepositoryUnavailableError, type BoardRepository } from '../../storage'

/**
 * The app's state: the current board, whether it loaded, and whether it is
 * saved. Every change goes through a domain command and is then saved as a
 * whole board. Saves run one at a time; changes made during a save are saved
 * right after it.
 */

export type LoadState = 'loading' | 'ready' | 'offline' | 'error'
export type SaveState = 'saved' | 'saving' | 'failed'

export function createBoardStore(repo: BoardRepository, ctx: Context = systemContext) {
  const board = shallowRef<Board>(createBoard(ctx))
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

  async function load() {
    loadState.value = 'loading'
    loadError.value = null
    try {
      const b = await repo.load()
      board.value = b
      lastSaved.value = b
      saveState.value = 'saved'
      loadState.value = 'ready'
    } catch (e) {
      loadState.value = e instanceof RepositoryUnavailableError ? 'offline' : 'error'
      loadError.value = e instanceof Error ? e.message : String(e)
    }
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
    void save()
  }

  return {
    board: computed(() => board.value),
    loadState: readonly(loadState),
    loadError: readonly(loadError),
    saveState: readonly(saveState),
    saveError: readonly(saveError),
    unsavedNoteIds,
    load,
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
