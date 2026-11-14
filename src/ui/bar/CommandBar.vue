<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { DomainError, relationsOf, type ChainResult, type Note, type NoteId, type RelationTypeDraft } from '../../domain'
import {
  applyPick,
  completionContext,
  noteInsert,
  noteOptions,
  relationInsert,
  relationOptions,
  resolveChain,
  type RelationOption,
} from '../../parser'
import { useBoardStore } from '../state/boardStore'
import DefineRelation from './DefineRelation.vue'
import PreviewChips from './PreviewChips.vue'
import { useMediaQuery } from '../viewport'

const props = defineProps<{ ready: boolean }>()
const emit = defineEmits<{
  /** Notes the input refers to, to light up on the canvas. */
  highlight: [ids: NoteId[]]
  /** The note suggestion under the cursor, for the canvas to pan to. */
  peek: [id: NoteId | null]
  submitted: [result: ChainResult]
  tabToNodes: []
  retryLoad: []
}>()

const store = useBoardStore()
const narrow = useMediaQuery('(max-width: 640px)')
const input = ref<HTMLInputElement>()
const value = ref('')
const cursor = ref(0)
/** Esc closes the suggestions until the next keystroke. */
const suppressed = ref(false)
const selected = ref(0)
const message = ref<string | null>(null)
const defining = ref<{ name: string; error: string | null } | null>(null)

const chain = computed(() => resolveChain(store.board.value, value.value))
const context = computed(() =>
  suppressed.value || defining.value ? null : completionContext(store.board.value, value.value.slice(0, cursor.value)),
)

type Suggestions =
  | { kind: 'note'; items: Note[]; start: number }
  | { kind: 'relation'; items: RelationOption[]; start: number }
  | { kind: null; items: []; start: 0 }

const suggestions = computed<Suggestions>(() => {
  const c = context.value
  if (c?.kind === 'note') return { kind: 'note', items: noteOptions(store.board.value, c.query), start: c.start }
  if (c?.kind === 'relation')
    return { kind: 'relation', items: relationOptions(store.board.value.relationTypes, c.query), start: c.start }
  return { kind: null, items: [], start: 0 }
})

watch(suggestions, () => (selected.value = 0))

const peeked = computed(() => (suggestions.value.kind === 'note' ? (suggestions.value.items[selected.value]?.id ?? null) : null))
watch(peeked, (id) => emit('peek', id))

watch(chain, (c) => {
  const ids = c.parts.flatMap((p) => (p.kind === 'node' && p.noteId ? [p.noteId] : []))
  emit('highlight', ids)
})

/** Errors wait until the chain looks finished, so typing ` -improves> ` doesn't flash red. */
const shownMessage = computed(() => {
  if (message.value) return message.value
  if (/\s-[a-z0-9_-]*>?\s*$/i.test(value.value)) return null
  return chain.value.errors[0] ?? null
})

function syncCursor() {
  cursor.value = input.value?.selectionStart ?? value.value.length
}

function onInput() {
  suppressed.value = false
  message.value = null
  syncCursor()
}

function setValue(v: string, pos: number) {
  value.value = v
  cursor.value = pos
  void nextTick(() => input.value?.setSelectionRange(pos, pos))
}

function pick(i = selected.value) {
  const s = suggestions.value
  const item = s.items[i]
  if (!item) return
  const insert = s.kind === 'note' ? noteInsert(item as Note) : relationInsert(item as RelationOption)
  const r = applyPick(value.value, cursor.value, s.start, insert)
  setValue(r.value, r.cursor)
}

function submit() {
  if (!props.ready) return emit('retryLoad')
  if (!value.value.trim()) return
  const c = chain.value
  if (c.errors.length) {
    message.value = c.errors[0]!
    return
  }
  const unknown = c.unknownNames[0]
  if (unknown) {
    defining.value = { name: unknown, error: null }
    return
  }
  if (!c.plan) return
  try {
    const result = store.addChain(c.plan)
    setValue('', 0)
    emit('submitted', result)
  } catch (e) {
    if (!(e instanceof DomainError)) throw e
    message.value = e.message
  }
}

function define(draft: RelationTypeDraft) {
  try {
    store.defineRelationType(draft)
  } catch (e) {
    if (!(e instanceof DomainError)) throw e
    defining.value = { name: draft.name, error: e.message }
    return
  }
  defining.value = null
  focus()
  submit()
}

function cancelDefine() {
  defining.value = null
  focus()
}

function onKey(e: KeyboardEvent) {
  const n = suggestions.value.items.length
  if (n) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      selected.value = (selected.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      pick()
    } else if (e.key === 'Escape') {
      suppressed.value = true
    } else return
    e.preventDefault()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    submit()
  } else if (e.key === 'Tab' && !e.shiftKey && !value.value && store.board.value.notes.length) {
    e.preventDefault()
    emit('tabToNodes')
  } else if (e.key === 'Escape') {
    message.value = null
  }
}

function degree(id: NoteId) {
  const n = relationsOf(store.board.value, id).length
  return `${n} relation${n === 1 ? '' : 's'}`
}

function relationHint(o: RelationOption) {
  if (o.define) return 'new relation: you’ll define it on ↵'
  if (o.type.plain) return 'plain link, no name'
  if (!o.canonical) return `shown as ← ${o.type.canonical}`
  return o.type.canonical === o.type.inverse ? 'symmetric' : 'shown as is'
}

function focus() {
  input.value?.focus({ preventScroll: true })
}
defineExpose({ focus })
</script>

<template>
  <div class="bar">
    <div v-if="defining" class="box pop">
      <DefineRelation :key="defining.name" :name="defining.name" :error="defining.error" @create="define" @cancel="cancelDefine" />
    </div>
    <div v-else-if="suggestions.items.length" class="box pop" role="listbox">
      <div class="hd">
        <template v-if="suggestions.kind === 'note'">Link an existing note · <kbd>↑↓</kbd> <kbd>Tab</kbd></template>
        <template v-else>Relation · <kbd>↑↓</kbd> <kbd>Tab</kbd> · the canvas always shows the first name of a pair</template>
      </div>
      <template v-if="suggestions.kind === 'note'">
        <div
          v-for="(n, i) in suggestions.items"
          :key="n.id"
          class="it"
          :class="{ on: i === selected }"
          role="option"
          :aria-selected="i === selected"
          @mousedown.prevent
          @click="pick(i)"
          @mouseenter="selected = i"
        >
          <span class="txt">@ {{ n.text }}</span><span class="sub">{{ degree(n.id) }}</span>
        </div>
      </template>
      <template v-else>
        <div
          v-for="(o, i) in suggestions.items"
          :key="o.define ? `define:${o.name}` : `${o.type.id}:${o.name}`"
          class="it"
          :class="{ on: i === selected }"
          role="option"
          :aria-selected="i === selected"
          @mousedown.prevent
          @click="pick(i)"
          @mouseenter="selected = i"
        >
          <span class="dot" :class="o.define ? 'dashed' : `tone-${o.type.tone}`"></span>
          <span class="mono">{{ o.name }}</span>
          <span class="sub">{{ relationHint(o) }}</span>
        </div>
      </template>
    </div>

    <div class="box">
      <PreviewChips v-if="value.trim()" :chain="chain" :message="shownMessage" />
      <div class="in-row">
        <span class="prompt">›</span>
        <input
          ref="input"
          v-model="value"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="send"
          aria-label="Command bar"
          :placeholder="narrow ? 'Type a thought…' : 'Type a thought · @ to link a note · space - for a relation'"
          @input="onInput"
          @keydown="onKey"
          @keyup="syncCursor"
          @click="syncCursor"
        />
        <button class="send" type="button" aria-label="Add" @mousedown.prevent @click="submit">↵</button>
      </div>
      <div class="keys">
        <span><kbd>@</kbd> link note</span>
        <span><kbd>␣-</kbd> relation</span>
        <span><kbd>Tab</kbd> pick / go to notes</span>
        <span><kbd>Esc</kbd> close</span>
        <span><kbd>/</kbd> back to bar</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar {
  position: absolute;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(700px, calc(100% - 32px));
  z-index: 5;
}
.send {
  flex: none;
  min-width: 32px;
  height: 28px;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: 12px var(--mono);
  cursor: pointer;
}
.send:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.pop {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  padding: 4px;
  max-height: 50vh;
  overflow: auto;
}
.hd {
  font-size: 11px;
  color: var(--muted);
  padding: 4px 9px 2px;
}
.it {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 9px;
  border-radius: 7px;
  cursor: pointer;
}
.it.on {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  margin-left: auto;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
  background: var(--tone);
}
.dot.dashed {
  background: none;
  border: 1px dashed var(--muted);
}
.mono {
  font-family: var(--mono);
}
.in-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}
.prompt {
  color: var(--accent);
  font-weight: 700;
}
input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: 14px var(--mono);
}
.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 12px 8px 30px;
  font-size: 11px;
  color: var(--muted);
}
/* Phones: edge to edge, and no keyboard hints on touch screens. */
@media (max-width: 640px) {
  .keys {
    display: none;
  }
  .bar {
    width: calc(100% - 16px);
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  }
  .pop {
    max-height: 40vh;
  }
}
@media (pointer: coarse) {
  .keys {
    display: none;
  }
  .it {
    padding: 10px 9px;
  }
  .send {
    min-width: 44px;
    height: 36px;
  }
}
</style>
