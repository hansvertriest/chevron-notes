<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { DomainError, nameFrom, splitQuestion, noteById, relationsOf, relationTypeById, type NoteId, type RelationId } from '../../domain'
import type { Point } from '../../layout'
import { useBoardStore } from '../state/boardStore'
import Popover from './Popover.vue'

const props = defineProps<{
  noteId: NoteId
  anchor: Point
  viewport: { width: number; height: number }
  /** Opened with Backspace: go straight to deleting. */
  armDelete: boolean
}>()

const emit = defineEmits<{
  /** `deleted` tells the parent the note is gone, so focus goes back to the bar. */
  close: [deleted: boolean]
  openRelation: [id: RelationId]
}>()

const store = useBoardStore()
const note = computed(() => noteById(store.board.value, props.noteId))
const relations = computed(() =>
  relationsOf(store.board.value, props.noteId).map((r) => {
    const other = noteById(store.board.value, r.from === props.noteId ? r.to : r.from)
    const type = relationTypeById(store.board.value, r.typeId)
    return {
      id: r.id,
      name: type?.plain ? '→' : nameFrom(store.board.value, r, props.noteId),
      tone: type?.tone ?? 'neutral',
      other: other?.text ?? '?',
    }
  }),
)

const text = ref(note.value?.text ?? '')
const question = ref(note.value?.question ?? false)
const error = ref<string | null>(null)
const armed = ref(false)
const textInput = ref<HTMLInputElement>()
const deleteButton = ref<HTMLButtonElement>()

function save() {
  try {
    // Same rule as the bar: a trailing ? marks a question and isn't kept in the text.
    const split = splitQuestion(text.value)
    const q = question.value || split.question
    if (split.text !== note.value?.text || q !== !!note.value?.question) store.editNote(props.noteId, split.text, q)
    emit('close', false)
  } catch (e) {
    if (!(e instanceof DomainError)) throw e
    error.value = e.message
  }
}

/** Deleting a note with relations takes a second press. */
function remove() {
  if (relations.value.length && !armed.value) {
    armed.value = true
    void nextTick(() => deleteButton.value?.focus({ preventScroll: true }))
    return
  }
  store.deleteNote(props.noteId)
  emit('close', true)
}

function onKey(e: KeyboardEvent) {
  const inText = e.target === textInput.value
  if (e.key === 'Escape') emit('close', false)
  else if (e.key === 'Enter' && inText) save()
  else if ((e.key === 'Backspace' || e.key === 'Delete') && (!inText || e.metaKey || e.ctrlKey)) remove()
  else return
  e.preventDefault()
}

onMounted(() => {
  if (props.armDelete) remove()
  else {
    textInput.value?.focus({ preventScroll: true })
    textInput.value?.select()
  }
})
</script>

<template>
  <Popover v-if="note" :anchor="anchor" :viewport="viewport" @keydown="onKey">
    <div class="hd">Note</div>
    <input ref="textInput" v-model="text" aria-label="Note text" @input="error = null" />
    <label class="q"><input v-model="question" type="checkbox" /> Question <span class="hint">(or end the text with ?)</span></label>
    <div v-if="error" class="msg">{{ error }}</div>
    <div v-if="relations.length" class="rels">
      <button v-for="r in relations" :key="r.id" type="button" @click="emit('openRelation', r.id)">
        <span class="name" :class="`tone-${r.tone}`">{{ r.name }}</span> {{ r.other }}
      </button>
    </div>
    <div v-else class="none">No relations yet. Link it with <code>@</code> from the bar.</div>
    <div class="row">
      <button class="btn primary" type="button" @click="save">Save ↵</button>
      <button ref="deleteButton" class="btn danger" :class="{ armed }" type="button" @click="remove">
        <template v-if="armed">Delete with {{ relations.length }} relation{{ relations.length > 1 ? 's' : '' }}? ⌫ again</template>
        <template v-else>Delete</template>
      </button>
      <span class="hint">Esc closes</span>
    </div>
  </Popover>
</template>

<style scoped>
.rels {
  display: grid;
  gap: 3px;
  font-size: 12px;
  max-height: 140px;
  overflow: auto;
}
.rels button {
  all: unset;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rels button:hover,
.rels button:focus-visible {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.name {
  font-family: var(--mono);
  color: var(--tone);
}
.q {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
}
.q input {
  accent-color: var(--question);
}
.q .hint {
  color: var(--muted);
}
.none {
  font-size: 12px;
  color: var(--muted);
}
</style>
