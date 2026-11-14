<script setup lang="ts">
import { computed } from 'vue'
import type { RelationType, Tone } from '../../domain'

const props = defineProps<{ types: readonly RelationType[] }>()

const TONES: Tone[] = ['positive', 'negative', 'neutral']

/** One entry per colour, naming the relations that use it as the canvas shows them. */
const groups = computed(() =>
  TONES.map((tone) => ({
    tone,
    names: props.types.filter((t) => t.tone === tone).map((t) => (t.plain ? 'plain' : t.canonical)),
  })).filter((g) => g.names.length),
)
</script>

<template>
  <div class="legend">
    <span v-for="g in groups" :key="g.tone"><i class="dot" :class="`tone-${g.tone}`"></i>{{ g.names.join(' / ') }}</span>
  </div>
</template>

<style scoped>
.legend {
  position: absolute;
  left: 14px;
  top: 12px;
  font-size: 11px;
  color: var(--muted);
  display: flex;
  gap: 12px;
  z-index: 4;
  pointer-events: none;
}
.legend span {
  display: flex;
  gap: 4px;
  align-items: center;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--tone);
}
</style>
