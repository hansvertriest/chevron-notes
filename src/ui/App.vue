<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import type { ChainResult, NoteId, RelationId } from '../domain'
import { boundsOf, clusterRoots, DEFAULT_LAYOUT, edgeGeometry, layoutClusters, type Point, type Size } from '../layout'
import type { BoardRepository } from '../storage'
import CommandBar from './bar/CommandBar.vue'
import BoardCanvas from './canvas/BoardCanvas.vue'
import { measureLabel, measureNote } from './canvas/measure'
import { useCamera } from './canvas/useCamera'
import BoardOverlay from './chrome/BoardOverlay.vue'
import BoardSwitcher from './chrome/BoardSwitcher.vue'
import SaveStatus from './chrome/SaveStatus.vue'
import SaveToast from './chrome/SaveToast.vue'
import ToneLegend from './chrome/ToneLegend.vue'
import NoteEditor from './edit/NoteEditor.vue'
import RelationEditor from './edit/RelationEditor.vue'
import { useAnimatedPositions } from './motion/useAnimatedPositions'
import { BOARD_STORE, createBoardStore } from './state/boardStore'
import { hasFinePointer } from './viewport'

const props = defineProps<{ repository: BoardRepository }>()

const store = createBoardStore(props.repository)
provide(BOARD_STORE, store)
const board = store.board

/* ---------- layout and camera ---------- */
const graph = computed(() => ({
  nodes: board.value.notes.map((n) => n.id),
  edges: board.value.relations.map((r) => {
    const type = board.value.relationTypes.find((t) => t.id === r.typeId)
    // Plain links have no label; the layout keeps room for every other label.
    return { from: r.from, to: r.to, labelWidth: type && !type.plain ? measureLabel(type.canonical) : 0 }
  }),
}))
// Roots are bold, and bold text is wider, so they are known before measuring.
const sizes = computed(() => {
  const roots = clusterRoots(graph.value)
  return Object.fromEntries(board.value.notes.map((n) => [n.id, measureNote(n.text, roots.has(n.id))]))
})
const sizeOf = (id: NoteId): Size => sizes.value[id] ?? DEFAULT_LAYOUT.defaultSize
const layout = computed(() => layoutClusters({ ...graph.value, sizes: sizes.value }))
const target = computed(() => layout.value.positions)
const shown = useAnimatedPositions(target)
const cam = useCamera()

function boundsFor(ids: readonly NoteId[]) {
  return boundsOf(ids.flatMap((id) => (target.value[id] ? [{ at: target.value[id], size: sizeOf(id) }] : [])))
}

// Fit the whole board once it has loaded and the canvas has a size, and again
// each time another board opens.
let fitted: string | null = null
watch(
  [store.loadState, () => cam.viewport.value.width, () => board.value.id],
  ([state, width, id]) => {
    if (fitted === id || state !== 'ready' || !width) return
    fitted = id
    const b = boundsFor(board.value.notes.map((n) => n.id))
    cam.set(b ? cam.fitting(b) : { x: 0, y: 0, s: 1 })
  },
)

/* ---------- which board: kept in the URL, as #<board id> ---------- */
const idFromHash = () => decodeURIComponent(location.hash.slice(1)) || null

watch([() => board.value.id, store.loadState], ([id, state]) => {
  if (state === 'ready' && idFromHash() !== id) history.replaceState(null, '', `#${encodeURIComponent(id)}`)
})

async function onHashChange() {
  const id = idFromHash()
  if (id && id !== board.value.id && (await store.open(id))) onSwitched()
}

/** Another board is open: nothing marked or edited carries over. */
function onSwitched() {
  editing.value = null
  fresh.value = new Set()
  highlighted.value = new Set()
  peeked.value = null
  if (hasFinePointer()) bar.value?.focus()
}

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
  return a && b && r
    ? cam.toScreen(edgeGeometry({ at: a, size: sizeOf(r.from) }, { at: b, size: sizeOf(r.to) }).label)
    : null
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
  window.addEventListener('hashchange', onHashChange)
  void store.load(idFromHash())
  // On touch screens focusing would pop up the keyboard over the board.
  if (hasFinePointer()) bar.value?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <main class="app">
    <BoardCanvas
      ref="canvas"
      :board="board"
      :positions="shown"
      :sizes="sizes"
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
    <BoardSwitcher @switched="onSwitched" />
    <ToneLegend v-if="store.loadState.value === 'ready' && board.notes.length" :types="board.relationTypes" />
    <SaveStatus :load="store.loadState.value" :save="store.saveState.value" />

    <NoteEditor
      v-if="editing?.kind === 'note' && editorAnchor"
      :key="`n:${editing.id}:${editing.armDelete}`"
      :note-id="editing.id"
      :anchor="editorAnchor"
      :viewport="cam.viewport.value"
      :arm-delete="editing.armDelete"
      :below="(sizeOf(editing.id).height / 2) * cam.camera.value.s + 8"
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
      @retry-load="store.load(idFromHash())"
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
