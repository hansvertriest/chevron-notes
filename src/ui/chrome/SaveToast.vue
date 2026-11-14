<script setup lang="ts">
defineProps<{ error: string | null }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="box toast" role="alert">
    <span class="msg">Couldn’t write board.json. Your changes are kept here.</span>
    <span v-if="error" class="detail">{{ error }}</span>
    <button class="btn primary" type="button" @click="emit('retry')">Retry</button>
  </div>
</template>

<style scoped>
.toast {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 140px;
  padding: 7px 12px;
  font-size: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  z-index: 6;
}
.msg {
  color: var(--negative);
}
.detail {
  color: var(--muted);
}
</style>
