<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import type { ChainResult, NoteId, RelationId } from '../domain'
import { boundsOf, DEFAULT_LAYOUT, edgeGeometry, layoutClusters, type Point } from '../layout'
import type { BoardRepository } from '../storage'
import CommandBar from './bar/CommandBar.vue'
import BoardCanvas from './canvas/BoardCanvas.vue'
import { useCamera } from './canvas/useCamera'
import BoardOverlay from './chrome/BoardOverlay.vue'
import SaveStatus from './chrome/SaveStatus.vue'
import SaveToast from './chrome/SaveToast.vue'
import ToneLegend from './chrome/ToneLegend.vue'
import NoteEditor from './edit/NoteEditor.vue'
import RelationEditor from './edit/RelationEditor.vue'
import { useAnimatedPositions } from './motion/useAnimatedPositions'
import { BOARD_STORE, createBoardStore } from './state/boardStore'

const props = defineProps<{ repository: BoardRepository }>()

const store = createBoardStore(props.repository)
provide(BOARD_STORE, store)
const board = store.board

/* ---------- layout and camera ---------- */
const NODE = { width: DEFAULT_LAYOUT.nodeWidth, height: DEFAULT_LAYOUT.nodeHeight }
const layout = computed(() =>
  layoutClusters({ nodes: board.value.notes.map((n) => n.id), edges: board.value.relations }),
)
const target = computed(() => layout.value.positions)
const shown = useAnimatedPositions(target)
const cam = useCamera()

function boundsFor(ids: readonly NoteId[]) {
  return boundsOf(
    ids.flatMap((id) => target.value[id] ?? []),
    NODE,
  )
}

// Fit the whole board once it has loaded and the canvas has a size.
let fitted = false
watch(
  [store.loadState, () => cam.viewport.value.width],
  ([state, width]) => {
    if (fitted || state !== 'ready' || !width) return
    fitted = true
    const b = boundsFor(board.value.notes.map((n) => n.id))
    if (b) cam.set(cam.fitting(b))
  },
)

/* ---------- what the canvas marks ---------- */
const fresh = shallowRef(new Set<string>())
const highlighted = shallowRef(new Set<NoteId>())
const peeked = ref<NoteId | null>(null)
const marked = computed(() => (peeked.value ? new Set([...highlighted.value, peeked.value]) : highlighted.value))

let freshTimer = 0
function onSubmitted(r: ChainResult) {
  fresh.value = new Set([...r.createdNoteIds, ...r.createdRelationIds])
  clearTimeout(freshTimer)
  freshTimer = window.setTimeout(() => (fresh.value = new Set()), 2600)
  const b = boundsFor(r.chainNoteIds)
  if (b) cam.animateTo(cam.fitting(b))
}

let peekTimer = 0
function onPeek(id: NoteId | null) {
  peeked.value = id
  clearTimeout(peekTimer)
  if (!id) return
  peekTimer = window.setTimeout(() => {
    const p = target.value[id]
    if (p) cam.animateTo(cam.centring(p), 420)
  }, 140)
}

/* ---------- editing ---------- */
type Editing = { kind: 'note'; id: NoteId; armDelete: boolean } | { kind: 'relation'; id: RelationId } | null
const editing = shallowRef<Editing>(null)
const bar = ref<InstanceType<typeof CommandBar>>()
const canvas = ref<InstanceType<typeof BoardCanvas>>()

function openNote(id: NoteId, armDelete: boolean) {
  editing.value = { kind: 'note', id, armDelete }
}
function openRelation(id: RelationId) {
  editing.value = { kind: 'relation', id }
}
function closeEditor() {
  editing.value = null
}
function focusBar() {
  editing.value = null
  bar.value?.focus()
}
function closeNoteEditor(id: NoteId, deleted: boolean) {
  editing.value = null
  if (deleted) bar.value?.focus()
  else void nextTick(() => canvas.value?.focusNote(id))
}

const editorAnchor = computed<Point | null>(() => {
  const e = editing.value
  if (!e) return null
  if (e.kind === 'note') {
    const p = shown.value[e.id]
    return p ? cam.toScreen(p) : null
  }
  const r = board.value.relations.find((x) => x.id === e.id)
  const a = r && shown.value[r.from]
  const b = r && shown.value[r.to]
  return a && b ? cam.toScreen(edgeGeometry(a, b, NODE).label) : null
})

/* ---------- keyboard ---------- */
function onGlobalKey(e: KeyboardEvent) {
  if (e.key !== '/') return
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, select')) return
  e.preventDefault()
  focusBar()
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  void store.load()
  bar.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <main class="app">
    <BoardCanvas
      ref="canvas"
      :board="board"
      :positions="shown"
      :roots="layout.roots"
      :fresh="fresh"
      :highlighted="marked"
      :unsaved="store.unsavedNoteIds.value"
      :selected-note="editing?.kind === 'note' ? editing.id : null"
      :selected-relation="editing?.kind === 'relation' ? editing.id : null"
      :cam="cam"
      @open-note="openNote"
      @open-relation="openRelation"
      @back-to-bar="focusBar"
      @background-down="closeEditor"
    />

    <BoardOverlay
      :load="store.loadState.value"
      :empty="board.notes.length === 0"
      :error="store.loadError.value"
    />
    <ToneLegend v-if="store.loadState.value === 'ready' && board.notes.length" :types="board.relationTypes" />
    <SaveStatus :load="store.loadState.value" :save="store.saveState.value" />

    <NoteEditor
      v-if="editing?.kind === 'note' && editorAnchor"
      :key="`n:${editing.id}:${editing.armDelete}`"
      :note-id="editing.id"
      :anchor="editorAnchor"
      :viewport="cam.viewport.value"
      :arm-delete="editing.armDelete"
      @close="(deleted) => closeNoteEditor((editing as { id: NoteId }).id, deleted)"
      @open-relation="openRelation"
    />
    <RelationEditor
      v-if="editing?.kind === 'relation' && editorAnchor"
      :key="`r:${editing.id}`"
      :relation-id="editing.id"
      :anchor="editorAnchor"
      :viewport="cam.viewport.value"
      @close="focusBar"
    />

    <SaveToast v-if="store.saveState.value === 'failed'" :error="store.saveError.value" @retry="store.retrySave" />

    <CommandBar
      ref="bar"
      :ready="store.loadState.value === 'ready'"
      @highlight="(ids) => (highlighted = new Set(ids))"
      @peek="onPeek"
      @submitted="onSubmitted"
      @tab-to-nodes="canvas?.focusNote()"
      @retry-load="store.load"
    />
  </main>
</template>

<style scoped>
.app {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
