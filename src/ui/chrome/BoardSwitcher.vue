<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { DomainError, type BoardId } from '../../domain'
import { useBoardStore } from '../state/boardStore'

/**
 * The board name in the top-left corner. It opens a menu that lists the
 * boards and creates, renames and deletes them.
 */

const emit = defineEmits<{ switched: [] }>()

const store = useBoardStore()
const open = ref(false)
/** What the bottom of the menu shows: the actions, or one of their forms. */
const mode = ref<'menu' | 'new' | 'rename' | 'delete'>('menu')
const name = ref('')
const error = ref<string | null>(null)
const root = ref<HTMLElement>()
const nameInput = ref<HTMLInputElement>()

const current = computed(() => store.board.value)
const ready = computed(() => store.loadState.value === 'ready')
/** The open board is listed even before its first save. */
const list = computed(() => {
  const others = store.boards.value.filter((b) => b.id !== current.value.id)
  return ready.value ? [{ id: current.value.id, name: current.value.name }, ...others] : store.boards.value
})
const notes = computed(() => current.value.notes.length)

function toggle() {
  open.value = !open.value
  mode.value = 'menu'
  error.value = null
}
function close() {
  open.value = false
  mode.value = 'menu'
}

async function pick(id: BoardId) {
  close()
  if (await store.open(id)) emit('switched')
}

async function startForm(m: 'new' | 'rename' | 'delete') {
  mode.value = m
  error.value = null
  name.value = m === 'rename' ? current.value.name : ''
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

async function submit() {
  try {
    if (mode.value === 'new') {
      const ok = await store.newBoard(name.value)
      if (!ok) return void (error.value = 'This board isn’t saved yet. Retry the save first.')
      close()
      emit('switched')
    } else if (mode.value === 'rename') {
      if (name.value.trim() !== current.value.name) store.renameBoard(name.value)
      close()
    }
  } catch (e) {
    if (!(e instanceof DomainError)) throw e
    error.value = e.message
  }
}

async function confirmDelete() {
  close()
  await store.deleteOpenBoard()
  emit('switched')
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return
  e.stopPropagation()
  if (mode.value === 'menu') close()
  else mode.value = 'menu'
}

function onOutside(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onOutside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <div ref="root" class="switcher" @keydown="onKey" @pointerdown.stop @wheel.stop>
    <button class="current" :aria-expanded="open" aria-haspopup="menu" :disabled="store.loadState.value === 'offline'" @click="toggle">
      <span class="name">{{ current.name }}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
    </button>

    <div v-if="open" class="box menu" role="menu">
      <div class="hd">Boards</div>
      <ul>
        <li v-for="b in list" :key="b.id">
          <button role="menuitemradio" :aria-checked="b.id === current.id" :class="{ on: b.id === current.id }" @click="pick(b.id)">
            {{ b.name }}
          </button>
        </li>
      </ul>

      <div class="sep"></div>

      <div v-if="mode === 'menu'" class="actions">
        <button role="menuitem" @click="startForm('new')">+ New board</button>
        <button role="menuitem" :disabled="!ready" @click="startForm('rename')">Rename</button>
        <button role="menuitem" class="del" :disabled="!ready" @click="startForm('delete')">Delete…</button>
      </div>

      <form v-else-if="mode === 'new' || mode === 'rename'" class="form" @submit.prevent="submit">
        <input ref="nameInput" v-model="name" :placeholder="mode === 'new' ? 'New board name' : 'Board name'" maxlength="80" />
        <div class="row">
          <button type="submit" class="btn primary">{{ mode === 'new' ? 'Create' : 'Rename' }}</button>
          <button type="button" class="btn" @click="mode = 'menu'">Cancel</button>
        </div>
        <div v-if="error" class="msg">{{ error }}</div>
      </form>

      <div v-else class="form">
        <span>
          Delete <b>{{ current.name }}</b><template v-if="notes"> and its {{ notes }} note{{ notes === 1 ? '' : 's' }}</template>? This can’t be undone.
        </span>
        <div class="row">
          <button class="btn danger armed" @click="confirmDelete">Delete board</button>
          <button class="btn" @click="mode = 'menu'">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switcher {
  position: absolute;
  left: 8px;
  top: 6px;
  z-index: 7;
}
.current {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: min(60vw, 320px);
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: none;
  font-weight: 600;
  cursor: pointer;
}
.current:hover,
.current[aria-expanded='true'] {
  border-color: var(--line);
  background: var(--surface);
}
.current:focus-visible {
  outline: 2px solid var(--accent);
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: min(280px, calc(100vw - 16px));
  padding: 8px;
  display: grid;
  gap: 4px;
}
.hd {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
}
.menu li button,
.actions button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu li button:hover,
.actions button:hover:not(:disabled),
.menu button:focus-visible {
  background: var(--surface-2);
  outline: none;
}
.menu li button.on {
  color: var(--accent);
  font-weight: 600;
}
.actions button:disabled {
  color: var(--muted);
  cursor: default;
}
.actions .del {
  color: var(--negative);
}
.sep {
  height: 1px;
  background: var(--line);
  margin: 2px 0;
}
.form {
  display: grid;
  gap: 8px;
  padding: 4px;
}
.form input {
  font: inherit;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
}
.row {
  display: flex;
  gap: 6px;
}
.msg {
  font-size: 12px;
  color: var(--negative);
}
</style>
