<script setup lang="ts">
import { computed } from 'vue'
import type { LoadState, SaveState } from '../state/boardStore'

const props = defineProps<{ load: LoadState; save: SaveState }>()

const text = computed(() => {
  if (props.load === 'loading') return 'Loading…'
  if (props.load === 'offline') return 'Offline'
  if (props.load === 'error') return 'Can’t read board.json'
  if (props.save === 'saving') return 'Saving…'
  if (props.save === 'failed') return 'Not saved · board.json'
  return 'Saved · board.json'
})
const bad = computed(() => props.load === 'offline' || props.load === 'error' || props.save === 'failed')
</script>

<template>
  <div class="status" :class="{ bad }" role="status" aria-live="polite">{{ text }}</div>
</template>

<style scoped>
.status {
  position: absolute;
  right: 14px;
  top: 12px;
  font-size: 11.5px;
  color: var(--muted);
  z-index: 4;
}
.status.bad {
  color: var(--negative);
}
</style>
