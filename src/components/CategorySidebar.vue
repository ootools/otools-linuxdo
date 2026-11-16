<script setup lang="ts">
import { computed } from 'vue';
import type { ListSource, TopPeriod } from '../types';
import type { Category } from '../types';
import { formatCount } from '../format';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  categories: Category[];
  loading: boolean;
  source: ListSource;
  query: string;
  narrow: boolean;
  errorText?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'select', source: ListSource): void;
  (event: 'close'): void;
  (event: 'retry-categories'): void;
}>();

const PERIODS: TopPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all'];

const filteredCategories = computed(() => {
  const query = props.query.trim().toLocaleLowerCase();
  if (!query) return props.categories;
  return props.categories.filter((category) =>
    `${category.name} ${category.slug}`.toLocaleLowerCase().includes(query),
  );
});

const isActive = (source: ListSource): boolean => {
  if (props.source.kind !== source.kind) return false;
  if (source.kind === 'cat') return props.source.categoryId === source.categoryId;
  if (source.kind === 'top') return (props.source.period ?? 'daily') === (source.period ?? 'daily');
  return true;
};

const isCategoryActive = (category: Category): boolean =>
  props.source.kind === 'cat' && props.source.categoryId === category.id;

const selectCategory = (category: Category): void => {
  if (category.read_restricted) return;
  emit('select', { kind: 'cat', categoryId: category.id, slug: category.slug });
  if (props.narrow) emit('close');
};

const selectQuick = (source: ListSource): void => {
  emit('select', source);
  if (props.narrow) emit('close');
};
</script>

<template>
  <aside class="category-sidebar" :class="{ 'is-overlay': narrow }">
    <div v-if="narrow" class="sidebar-mobile-head">
      <span>{{ t('categories') }}</span>
      <button class="icon-button" :title="t('collapseSidebar')" @click="emit('close')">
        <AppIcon name="close" :size="15" />
      </button>
    </div>

    <div class="sidebar-scroll">
      <section v-if="!query.trim()" class="quick-section">
        <button
          class="quick-item"
          :class="{ 'is-active': isActive({ kind: 'latest' }) }"
          @click="selectQuick({ kind: 'latest' })"
        >
          <span class="quick-icon quick-icon-latest"><AppIcon name="clock" :size="15" /></span>
          <span class="quick-text">
            <strong>{{ t('latest') }}</strong>
          </span>
          <AppIcon class="quick-arrow" name="chevron-right" :size="13" />
        </button>
        <button
          class="quick-item"
          :class="{ 'is-active': isActive({ kind: 'hot' }) }"
          @click="selectQuick({ kind: 'hot' })"
        >
          <span class="quick-icon quick-icon-hot"><AppIcon name="fire" :size="15" /></span>
          <span class="quick-text">
            <strong>{{ t('hot') }}</strong>
          </span>
          <AppIcon class="quick-arrow" name="chevron-right" :size="13" />
        </button>
        <button
          class="quick-item"
          :class="{ 'is-active': source.kind === 'top' }"
          @click="selectQuick({ kind: 'top', period: 'daily' })"
        >
          <span class="quick-icon quick-icon-top"><AppIcon name="check" :size="15" /></span>
          <span class="quick-text">
            <strong>{{ t('top') }}</strong>
          </span>
          <AppIcon class="quick-arrow" name="chevron-right" :size="13" />
        </button>

        <div v-if="source.kind === 'top'" class="period-row">
          <button
            v-for="period in PERIODS"
            :key="period"
            class="period-chip"
            :class="{ 'is-active': (source.period ?? 'daily') === period }"
            @click="selectQuick({ kind: 'top', period })"
          >
            {{ t(`period${period.charAt(0).toUpperCase()}${period.slice(1)}`) }}
          </button>
        </div>
      </section>

      <section class="side-section">
        <h3 class="section-title">
          <span>{{ query.trim() ? t('categories') : t('categories') }}</span>
          <span v-if="!loading" class="section-count">{{ filteredCategories.length }}</span>
        </h3>

        <div v-if="loading && !categories.length" class="category-skeleton">
          <span v-for="index in 6" :key="`category-skeleton-${index}`" class="skeleton-line" />
        </div>

        <div v-else-if="errorText && !categories.length" class="side-error">
          <p>{{ errorText }}</p>
          <button class="text-button" @click="emit('retry-categories')">{{ t('retry') }}</button>
        </div>

        <div v-else class="category-list">
          <button
            v-for="category in filteredCategories"
            :key="category.id"
            class="category-row"
            :class="{ 'is-active': isCategoryActive(category), 'is-restricted': category.read_restricted }"
            :disabled="category.read_restricted"
            :title="category.read_restricted ? '' : category.description_excerpt"
            @click="selectCategory(category)"
          >
            <span
              class="category-dot"
              :style="{ background: `#${category.color}` }"
            />
            <span v-if="category.emoji" class="category-emoji">{{ category.emoji }}</span>
            <span class="category-title">{{ category.name }}</span>
            <span class="category-count">{{ formatCount(category.topic_count) }}</span>
          </button>
          <p v-if="!filteredCategories.length" class="side-empty">{{ t('noMatchingCategories') }}</p>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.category-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 246px;
  width: 246px;
  min-height: 0;
  border-inline-end: 1px solid var(--ld-border);
  background: var(--ld-sidebar);
}

.category-sidebar.is-overlay {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  z-index: 40;
  width: 268px;
  flex-basis: 268px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.22);
  animation: sidebar-in 0.18s ease-out;
}

@keyframes sidebar-in {
  from {
    transform: translateX(-12px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

[dir='rtl'] .category-sidebar.is-overlay {
  animation-name: sidebar-in-rtl;
}

@keyframes sidebar-in-rtl {
  from {
    transform: translateX(12px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.sidebar-mobile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ld-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--ld-text-2);
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 8px 18px;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
}

.quick-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  text-align: start;
  cursor: pointer;
  color: var(--ld-text);
  transition: background 0.14s ease;
}

.quick-item:hover {
  background: var(--ld-hover);
}

.quick-item.is-active {
  background: var(--ld-active);
}

.quick-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  flex: none;
}

.quick-icon-latest {
  background: color-mix(in srgb, #5b8def 16%, transparent);
  color: #4a7fe0;
}

.quick-icon-hot {
  background: color-mix(in srgb, #f0763a 16%, transparent);
  color: #e2682c;
}

.quick-icon-top {
  background: color-mix(in srgb, #32c3c3 18%, transparent);
  color: #239e9e;
}

.quick-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.quick-text strong {
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.3;
}

.quick-arrow {
  color: var(--ld-text-3);
  opacity: 0;
  transition: opacity 0.14s ease;
}

.quick-item:hover .quick-arrow,
.quick-item.is-active .quick-arrow {
  opacity: 1;
}

.period-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px 2px;
}

.period-chip {
  padding: 2px 8px;
  border: 1px solid var(--ld-border);
  border-radius: 999px;
  background: transparent;
  color: var(--ld-text-3);
  font-size: 10.5px;
  line-height: 1.5;
  cursor: pointer;
}

.period-chip:hover {
  border-color: var(--ld-border-strong);
  color: var(--ld-text-2);
}

.period-chip.is-active {
  border-color: color-mix(in srgb, var(--ld-accent) 45%, transparent);
  color: var(--ld-accent);
  background: var(--ld-active);
}

.side-section + .side-section {
  margin-top: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 12px 8px 6px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ld-text-3);
}

.section-count {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  opacity: 0.75;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ld-text-2);
  font-size: 12.5px;
  text-align: start;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.category-row:hover:not(:disabled) {
  background: var(--ld-hover);
}

.category-row.is-active {
  background: var(--ld-active);
  color: var(--ld-accent);
}

.category-row.is-restricted {
  opacity: 0.45;
  cursor: not-allowed;
}

.category-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}

.category-emoji {
  font-size: 12px;
  line-height: 1;
}

.category-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  font-size: 10.5px;
  color: var(--ld-text-3);
  font-variant-numeric: tabular-nums;
  padding-inline-end: 2px;
}

.category-row.is-active .category-count {
  color: color-mix(in srgb, var(--ld-accent) 70%, transparent);
}

.category-skeleton {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 6px 8px;
}

.skeleton-line {
  height: 12px;
  border-radius: 5px;
  background: linear-gradient(
    90deg,
    var(--ld-skeleton) 25%,
    var(--ld-skeleton-shine) 37%,
    var(--ld-skeleton) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-wave 1.4s ease infinite;
}

.skeleton-line:nth-child(2n) {
  width: 72%;
}

@keyframes skeleton-wave {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.side-empty {
  margin: 0;
  padding: 18px 10px;
  font-size: 11.5px;
  color: var(--ld-text-3);
  text-align: center;
}

.side-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 6px 6px;
  padding: 10px;
  border: 1px solid var(--ld-border);
  border-radius: 8px;
  background: var(--ld-fill);
}

.side-error p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--ld-text-2);
}

.text-button {
  padding: 3px 9px;
  border: 1px solid var(--ld-border);
  border-radius: 6px;
  background: var(--ld-bg);
  color: var(--ld-text-2);
  font-size: 11px;
  cursor: pointer;
}

.text-button:hover {
  border-color: var(--ld-border-strong);
}
</style>
