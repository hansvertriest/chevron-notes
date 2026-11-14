<script setup lang="ts">
import type { Note } from '../../domain'
import type { Point, Size } from '../../layout'

defineProps<{
  note: Note
  at: Point
  size: Size
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
    :class="{ root, fresh, highlighted, unsaved, selected, question: note.question }"
    :style="{
      transform: `translate(${at.x - size.width / 2}px, ${at.y - size.height / 2}px)`,
      width: `${size.width}px`,
      height: `${size.height}px`,
    }"
    :title="note.question ? `${note.text}?` : note.text"
    :data-note="note.id"
    tabindex="0"
    @click.stop="emit('open', false)"
    @keydown="onKey"
  >
    <span class="inner note-box" :class="{ bold: root }">{{ note.text }}</span>
  </div>
</template>

<style scoped>
.note {
  position: absolute;
  left: 0;
  top: 0;
  cursor: pointer;
  outline: none;
}
/* Size comes from measureNote; .note-box (theme.css) holds the font, padding and border. */
.inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-width: none;
  background: var(--surface);
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
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
.question .inner {
  border-color: var(--question);
  background: color-mix(in srgb, var(--question) 22%, var(--surface));
}
.unsaved .inner {
  border-style: dashed;
}
</style>
