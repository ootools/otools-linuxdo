<script setup lang="ts">
import { computed } from 'vue';

type IconName =
  | 'search'
  | 'refresh'
  | 'menu'
  | 'back'
  | 'reply'
  | 'external'
  | 'chevron-right'
  | 'chevron-down'
  | 'close'
  | 'copy'
  | 'fire'
  | 'clock'
  | 'inbox'
  | 'alert'
  | 'hash'
  | 'user'
  | 'trash'
  | 'loader'
  | 'settings'
  | 'check'
  | 'eye'
  | 'heart';

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 });

const icons: Record<IconName, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.6 6.1"/><path d="M20 4v7h-7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  reply:
    '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-5 2 1.6-4.6A8.5 8.5 0 1 1 21 11.5Z"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  fire:
    '<path d="M12 3c3 3.4 6 6.1 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2-4.9.6 1.5 1.5 2 2.4 2 .6-2.5.5-4.6 1.6-7.1Z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.2l3 1.8"/>',
  inbox:
    '<path d="M4 13h4l1.6 2.4h4.8L16 13h4"/><path d="M4 13 6.4 5.6A2 2 0 0 1 8.3 4h7.4a2 2 0 0 1 1.9 1.6L20 13v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>',
  alert:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.2v5.6"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2c.5-3.5 3.5-5.4 7.2-5.4s6.7 1.9 7.2 5.4"/>',
  trash:
    '<path d="M4.4 7h15.2M9.4 7V5.6A1.6 1.6 0 0 1 11 4h2a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.8 12.1A1.9 1.9 0 0 0 9.3 21h5.4a1.9 1.9 0 0 0 1.9-1.9L17.4 7"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  eye:
    '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  heart:
    '<path d="M12 20.3 4.9 13a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.5 0l.6.7.6-.7a4.5 4.5 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6Z"/>',
};

const inner = computed(() => icons[props.name] ?? '');
</script>

<template>
  <svg
    class="app-icon"
    :class="{ 'is-spinning': name === 'loader' }"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="inner"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  flex: none;
}

.app-icon.is-spinning {
  animation: app-icon-spin 0.9s linear infinite;
}

@keyframes app-icon-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
