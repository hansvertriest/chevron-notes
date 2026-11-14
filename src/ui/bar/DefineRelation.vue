<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RelationTypeDraft, Tone } from '../../domain'

const props = defineProps<{ name: string; error: string | null }>()
const emit = defineEmits<{ create: [draft: RelationTypeDraft]; cancel: [] }>()

const inverse = ref('')
const symmetric = ref(false)
const canvasShows = ref<'name' | 'inverse'>('name')
const tone = ref<Tone>('neutral')
const inverseInput = ref<HTMLInputElement>()

const TONES: { value: Tone; label: string }[] = [
  { value: 'neutral', label: 'neutral' },
  { value: 'positive', label: 'green' },
  { value: 'negative', label: 'red' },
]

const inverseLabel = computed(() => inverse.value.trim() || 'inverse')

function create() {
  emit('create', {
    name: props.name,
    inverse: symmetric.value ? null : inverse.value,
    canvasShows: canvasShows.value,
    tone: tone.value,
  })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') create()
  else if (e.key === 'Escape') emit('cancel')
  else return
  e.preventDefault()
}

onMounted(() => inverseInput.value?.focus({ preventScroll: true }))
</script>

<template>
  <div class="define" @keydown="onKey">
    <div>
      <b class="mono">{{ name }}</b> isn’t a relation yet. Define it once and it’s in the list from now on.
    </div>
    <div class="row">
      <label for="define-inverse">Inverse</label>
      <input
        id="define-inverse"
        ref="inverseInput"
        v-model="inverse"
        type="text"
        placeholder="e.g. needed-by"
        :disabled="symmetric"
        spellcheck="false"
        autocomplete="off"
      />
      <label class="small"><input v-model="symmetric" type="checkbox" /> symmetric (same both ways)</label>
    </div>
    <div class="row">
      <span>Canvas shows</span>
      <span class="toggle" :class="{ off: symmetric }" role="radiogroup">
        <button type="button" :class="{ on: canvasShows === 'name' }" @click="canvasShows = 'name'">{{ name }}</button>
        <button type="button" :class="{ on: canvasShows === 'inverse' }" @click="canvasShows = 'inverse'">
          {{ inverseLabel }}
        </button>
      </span>
      <span class="gap">Colour</span>
      <span class="toggle" role="radiogroup">
        <button
          v-for="t in TONES"
          :key="t.value"
          type="button"
          :class="[`tone-${t.value}`, { on: tone === t.value }]"
          @click="tone = t.value"
        >
          {{ t.label }}
        </button>
      </span>
    </div>
    <div class="row keys">
      <span><kbd>↵</kbd> create and add the chain</span>
      <span><kbd>Tab</kbd> next field</span>
      <span><kbd>Esc</kbd> back to the input</span>
      <span v-if="error" class="msg">{{ error }}</span>
    </div>
  </div>
</template>

<style scoped>
.define {
  padding: 12px 14px;
  display: grid;
  gap: 9px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.mono {
  font-family: var(--mono);
}
input[type='text'] {
  font: inherit;
  font-family: var(--mono);
  padding: 4px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  width: 170px;
}
.small {
  font-size: 12px;
}
.gap {
  margin-left: 10px;
}
.toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 7px;
  overflow: hidden;
}
.toggle.off {
  opacity: 0.4;
  pointer-events: none;
}
.toggle button {
  font-size: 12px;
  border: 0;
  background: transparent;
  padding: 4px 10px;
  cursor: pointer;
  font-family: var(--mono);
  color: var(--tone, var(--ink));
}
.toggle button.on {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
}
.toggle button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.keys {
  font-size: 11px;
  color: var(--muted);
}
.msg {
  font-size: 12px;
  color: var(--negative);
}
</style>
