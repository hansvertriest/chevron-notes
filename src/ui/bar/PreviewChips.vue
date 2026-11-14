<script setup lang="ts">
import { computed } from 'vue'
import type { ResolvedChain } from '../../parser'

const props = defineProps<{ chain: ResolvedChain; message: string | null }>()

const summary = computed(() => {
  const r = props.chain.relationCount
  return `${props.chain.newNoteCount} new · ${r} relation${r === 1 ? '' : 's'}`
})
</script>

<template>
  <div class="preview">
    <template v-for="(p, i) in chain.parts" :key="i">
      <template v-if="p.kind === 'node'">
        <span v-if="p.status === 'unmatched'" class="chip err" title="no single note matches">@{{ p.text }} ?</span>
        <span v-else-if="p.status === 'ref'" class="chip ref" title="existing note">@ {{ p.display }}</span>
        <span v-else-if="p.status === 'reuse'" class="chip ref" title="same text as an existing note: reused">= {{ p.display }}</span>
        <span v-else-if="p.status === 'new'" class="chip new" title="new note">+ {{ p.display }}</span>
      </template>
      <template v-else>
        <span v-if="p.status === 'unknown'" class="chip err" title="unknown relation: you’ll define it on ↵">? {{ p.name }}</span>
        <span v-else-if="p.type?.plain" class="chip rel tone-neutral">→</span>
        <span v-else-if="p.canonical" class="chip rel" :class="`tone-${p.type!.tone}`">{{ p.name }} →</span>
        <span
          v-else
          class="chip rel"
          :class="`tone-${p.type!.tone}`"
          title="stored and shown in the canonical direction"
        >
          {{ p.name }} <span class="dim">(shown ← {{ p.type!.canonical }})</span>
        </span>
      </template>
    </template>
    <span class="sum">{{ summary }}</span>
    <span v-if="message" class="msg">{{ message }}</span>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 8px 12px 0 30px;
  font-size: 11.5px;
}
.chip {
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid var(--line);
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip.new {
  border-style: dashed;
  border-color: var(--accent);
}
.chip.ref {
  border-color: var(--accent);
  color: var(--accent);
}
.chip.err {
  border-color: var(--negative);
  color: var(--negative);
}
.chip.rel {
  border: 0;
  padding: 1px 2px;
  font-family: var(--mono);
  color: var(--tone);
}
.dim {
  opacity: 0.6;
}
.sum {
  margin-left: auto;
  color: var(--muted);
}
.msg {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--negative);
}
</style>
