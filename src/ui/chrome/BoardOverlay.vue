<script setup lang="ts">
import type { LoadState } from '../state/boardStore'

defineProps<{ load: LoadState; empty: boolean; error: string | null }>()
</script>

<template>
  <div v-if="load === 'loading'" class="over">
    <div class="skel-row"><div class="skel"></div></div>
    <div class="skel-row"><div class="skel"></div><div class="skel"></div></div>
    <span>Loading board…</span>
  </div>
  <div v-else-if="load === 'offline'" class="over">
    <b>Can’t reach the local API</b>
    <span>Nothing was loaded, and nothing is lost. Start it with <code>npm run api</code>, then press <kbd>↵</kbd> to retry.</span>
  </div>
  <div v-else-if="load === 'error'" class="over">
    <b>Can’t read this board</b>
    <span>{{ error }}</span>
    <span>Pick another board in the top-left, or fix its file in <code>data/boards/</code> and press <kbd>↵</kbd> to retry.</span>
  </div>
  <div v-else-if="empty" class="over">
    <b>An empty board</b>
    <div class="cheat">
      Type a thought and press <kbd>↵</kbd> to add a note<br />
      <code>caching resolver results -blocked-by&gt; how do we invalidate on writes?</code><br />
      <code>@</code> links an existing note · <code>-&gt;</code> is a plain link
    </div>
  </div>
</template>

<style scoped>
.over {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
  pointer-events: none;
  padding: 0 24px 130px;
}
.over b {
  color: var(--ink);
  font-size: 15px;
}
.cheat {
  font-size: 12px;
  line-height: 1.9;
}
.skel-row {
  display: flex;
  gap: 28px;
}
.skel {
  width: 168px;
  height: 46px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  animation: pulse 1.1s ease-in-out infinite alternate;
}
@keyframes pulse {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 0.9;
  }
}
</style>
