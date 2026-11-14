<script setup lang="ts">
import { computed } from 'vue'
import type { Point } from '../../layout'

/** A box placed below an anchor on screen, or above it when there's no room, kept inside the viewport. */
const props = defineProps<{ anchor: Point; viewport: { width: number; height: number }; below?: number }>()

const MAX_WIDTH = 290
const HEIGHT = 260

const style = computed(() => {
  const below = props.below ?? 30
  // Never wider than the screen, so it fits on a phone.
  const width = Math.min(MAX_WIDTH, props.viewport.width - 20)
  const x = Math.max(10, Math.min(props.anchor.x - width / 2, props.viewport.width - width - 10))
  let y = props.anchor.y + below
  if (y + HEIGHT > props.viewport.height - 140) y = Math.max(10, props.anchor.y - below - HEIGHT)
  // A short viewport (a phone with the keyboard up): keep it on screen, even over its note.
  y = Math.max(10, Math.min(y, props.viewport.height - HEIGHT - 10))
  return { left: `${x}px`, top: `${y}px`, width: `${width}px` }
})
</script>

<template>
  <div class="box popover" :style="style" @pointerdown.stop @wheel.stop>
    <slot />
  </div>
</template>

<style scoped>
.popover {
  position: absolute;
  z-index: 6;
  padding: 12px;
  display: grid;
  gap: 9px;
}
.popover :deep(.hd) {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.popover :deep(input),
.popover :deep(select) {
  font: inherit;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
}
.popover :deep(.row) {
  display: flex;
  gap: 6px;
  align-items: center;
}
.popover :deep(.row .hint) {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
}
.popover :deep(.msg) {
  font-size: 12px;
  color: var(--negative);
}
</style>
