<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isSymmetric, noteById, type RelationId } from '../../domain'
import type { Point } from '../../layout'
import { useBoardStore } from '../state/boardStore'
import Popover from './Popover.vue'

const props = defineProps<{
  relationId: RelationId
  anchor: Point
  viewport: { width: number; height: number }
}>()
const emit = defineEmits<{ close: [] }>()

const store = useBoardStore()
const relation = computed(() => store.board.value.relations.find((r) => r.id === props.relationId))
const from = computed(() => relation.value && noteById(store.board.value, relation.value.from)?.text)
const to = computed(() => relation.value && noteById(store.board.value, relation.value.to)?.text)
const select = ref<HTMLSelectElement>()

function typeLabel(t: (typeof store.board.value.relationTypes)[number]) {
  if (t.plain) return '-> plain link'
  return isSymmetric(t) ? t.canonical : `${t.canonical} / ${t.inverse}`
}

function setType(e: Event) {
  store.setRelationType(props.relationId, (e.target as HTMLSelectElement).value)
}

function remove() {
  store.deleteRelation(props.relationId)
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if ((e.key === 'Backspace' || e.key === 'Delete') && e.target !== select.value) remove()
  else return
  e.preventDefault()
}

onMounted(() => select.value?.focus({ preventScroll: true }))
</script>

<template>
  <Popover v-if="relation" :anchor="anchor" :viewport="viewport" :below="16" @keydown="onKey">
    <div class="hd">Relation</div>
    <div class="ends">
      <b>{{ from }}</b>
      <select ref="select" :value="relation.typeId" aria-label="Relation type" @change="setType">
        <option v-for="t in store.board.value.relationTypes" :key="t.id" :value="t.id">{{ typeLabel(t) }}</option>
      </select>
      <b>{{ to }}</b>
    </div>
    <div class="row">
      <button class="btn" type="button" @click="store.swapRelation(relationId)">Swap direction ⇄</button>
      <button class="btn danger" type="button" @click="remove">Delete ⌫</button>
      <span class="hint">Esc</span>
    </div>
  </Popover>
</template>

<style scoped>
.ends {
  display: grid;
  gap: 4px;
  font-size: 12.5px;
  justify-items: start;
}
.ends b {
  overflow-wrap: anywhere;
}
</style>
