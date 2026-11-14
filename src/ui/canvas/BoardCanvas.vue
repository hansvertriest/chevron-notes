<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Board, NoteId, RelationId, Tone } from '../../domain'
import { DEFAULT_LAYOUT, edgeGeometry, type Point, type Size } from '../../layout'
import { useCanvasGestures } from './gestures'
import NoteCard from './NoteCard.vue'
import type { CameraControls } from './useCamera'

const props = defineProps<{
  board: Board
  positions: Record<string, Point>
  sizes: Record<string, Size>
  roots: Set<NoteId>
  fresh: Set<string>
  highlighted: Set<NoteId>
  unsaved: Set<NoteId>
  selectedNote: NoteId | null
  selectedRelation: RelationId | null
  cam: CameraControls
}>()

const emit = defineEmits<{
  openNote: [id: NoteId, armDelete: boolean]
  openRelation: [id: RelationId]
  backToBar: []
  backgroundDown: []
}>()

const TONES: Tone[] = ['positive', 'negative', 'neutral']

const edges = computed(() =>
  props.board.relations.flatMap((r) => {
    const a = props.positions[r.from]
    const b = props.positions[r.to]
    const type = props.board.relationTypes.find((t) => t.id === r.typeId)
    if (!a || !b || !type) return []
    const size = (id: string) => props.sizes[id] ?? DEFAULT_LAYOUT.defaultSize
    const geo = edgeGeometry({ at: a, size: size(r.from) }, { at: b, size: size(r.to) }, DEFAULT_LAYOUT.rowGap)
    return [{ id: r.id, type, geo }]
  }),
)

/** The SVG covers every node with some margin; its content is shifted so world (0,0) stays at (0,0). */
const svgBox = computed(() => {
  const pts = Object.values(props.positions)
  const pad = 300
  const minX = Math.min(0, ...pts.map((p) => p.x)) - pad
  const minY = Math.min(0, ...pts.map((p) => p.y)) - pad
  const maxX = Math.max(0, ...pts.map((p) => p.x)) + pad
  const maxY = Math.max(0, ...pts.map((p) => p.y)) + pad
  return { minX, minY, width: maxX - minX, height: maxY - minY }
})

const worldStyle = computed(() => {
  const c = props.cam.camera.value
  return { transform: `translate(${c.x}px, ${c.y}px) scale(${c.s})` }
})

/* ---------- pan and zoom ---------- */
const frame = ref<HTMLElement>()
const gestures = useCanvasGestures(frame, props.cam, () => emit('backgroundDown'))
const dragging = gestures.dragging

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    props.cam.viewport.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  observer.observe(frame.value!)
})
onBeforeUnmount(() => observer?.disconnect())

/* ---------- focus ---------- */
function focusNote(id?: NoteId) {
  const sel = id ? `[data-note="${CSS.escape(id)}"]` : '.note'
  frame.value?.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true })
}
defineExpose({ focusNote })

function onLabelKey(e: KeyboardEvent, id: RelationId) {
  if (e.key === 'Enter') emit('openRelation', id)
  else if (e.key === 'Escape' || e.key === '/') emit('backToBar')
  else return
  e.preventDefault()
}
</script>

<template>
  <div
    ref="frame"
    class="frame"
    :class="{ dragging }"
    @pointerdown="gestures.onPointerDown"
    @pointermove="gestures.onPointerMove"
    @pointerup="gestures.onPointerUp"
    @pointercancel="gestures.onPointerUp"
    @click.capture="gestures.onClickCapture"
    @wheel.prevent="gestures.onWheel"
  >
    <div class="world" :style="worldStyle">
      <svg
        class="edges"
        :style="{ left: `${svgBox.minX}px`, top: `${svgBox.minY}px` }"
        :width="svgBox.width"
        :height="svgBox.height"
      >
        <defs>
          <marker
            v-for="tone in TONES"
            :id="`arrow-${tone}`"
            :key="tone"
            :class="`tone-${tone}`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" class="arrow" />
          </marker>
        </defs>
        <g :transform="`translate(${-svgBox.minX}, ${-svgBox.minY})`">
          <g v-for="e in edges" :key="e.id" :class="[`tone-${e.type.tone}`, { selected: e.id === selectedRelation }]">
            <path
              class="line"
              :d="e.geo.d"
              :marker-end="`url(#arrow-${e.type.tone})`"
              :stroke-dasharray="e.type.plain ? '4 4' : undefined"
            />
            <path class="hit" :d="e.geo.d" @click.stop="emit('openRelation', e.id)" />
          </g>
        </g>
      </svg>

      <template v-for="e in edges" :key="e.id">
        <div
          v-if="!e.type.plain"
          class="label edge-label"
          :class="[`tone-${e.type.tone}`, { fresh: fresh.has(e.id), selected: e.id === selectedRelation }]"
          :style="{ left: `${e.geo.label.x}px`, top: `${e.geo.label.y}px` }"
          :data-relation="e.id"
          tabindex="0"
          @click.stop="emit('openRelation', e.id)"
          @keydown="onLabelKey($event, e.id)"
        >
          <span>{{ e.type.canonical }}</span>
        </div>
      </template>

      <template v-for="n in board.notes" :key="n.id">
        <NoteCard
          v-if="positions[n.id]"
          :note="n"
          :at="positions[n.id]!"
          :size="sizes[n.id] ?? DEFAULT_LAYOUT.defaultSize"
          :root="roots.has(n.id)"
          :fresh="fresh.has(n.id)"
          :highlighted="highlighted.has(n.id)"
          :unsaved="unsaved.has(n.id)"
          :selected="selectedNote === n.id"
          @open="(arm) => emit('openNote', n.id, arm)"
          @back-to-bar="emit('backToBar')"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.frame {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.frame.dragging {
  cursor: grabbing;
}
.world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
.edges {
  position: absolute;
  overflow: visible;
  pointer-events: none;
}
.line {
  fill: none;
  stroke: var(--tone);
  stroke-width: 1.6;
}
.selected .line {
  stroke-width: 2.6;
}
.arrow {
  fill: var(--tone);
}
.hit {
  fill: none;
  stroke: transparent;
  stroke-width: 14;
  pointer-events: stroke;
  cursor: pointer;
}
.label {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 9px;
  background: var(--bg);
  color: var(--tone);
  white-space: nowrap;
  cursor: pointer;
  outline: none;
}
.label:hover,
.label:focus-visible,
.label.selected {
  outline: 1px solid currentColor;
}
.label span {
  display: inline-block;
}
.label.fresh span {
  animation: pop-in 0.5s ease-out;
}
</style>
