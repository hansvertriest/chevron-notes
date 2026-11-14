<script setup lang="ts">
import type { Note } from '../../domain'
import type { Point } from '../../layout'

defineProps<{
  note: Note
  at: Point
  root: boolean
  fresh: boolean
  highlighted: boolean
  unsaved: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  open: [armDelete: boolean]
  backToBar: []
}>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('open', false)
  else if (e.key === 'Backspace' || e.key === 'Delete') emit('open', true)
  else if (e.key === 'Escape' || e.key === '/') emit('backToBar')
  else return
  e.preventDefault()
}
</script>

<template>
  <div
    class="note"
    :class="{ root, fresh, highlighted, unsaved, selected }"
    :style="{ transform: `translate(${at.x - 84}px, ${at.y - 23}px)` }"
    :title="note.text"
    :data-note="note.id"
    tabindex="0"
    @click.stop="emit('open', false)"
    @keydown="onKey"
  >
    <span class="inner"><span class="text">{{ note.text }}</span></span>
  </div>
</template>

<style scoped>
.note {
  position: absolute;
  left: 0;
  top: 0;
  width: 168px;
  height: 46px;
  cursor: pointer;
  outline: none;
}
.inner {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  line-height: 1.3;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}
.text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.root .inner {
  border-width: 1.5px;
  font-weight: 600;
}
.note:focus-visible .inner,
.selected .inner {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
}
.highlighted .inner {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
}
.fresh .inner {
  animation: pop-in 0.5s ease-out;
  border-color: var(--accent);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 18%, transparent);
}
.unsaved .inner {
  border-style: dashed;
}
</style>
