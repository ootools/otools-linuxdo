<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  fetchCategories,
  fetchTopics,
  LinuxdoApiError,
  netBusy,
} from './api';
import { formatCount } from './format';
import { useI18n } from './i18n';
import type { Category, DiscourseUser, ListSource, Topic } from './types';
import AppIcon from './components/AppIcon.vue';
import CategorySidebar from './components/CategorySidebar.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import TopicDetail from './components/TopicDetail.vue';
import TopicList from './components/TopicList.vue';
import logoUrl from '../logo.svg';

const { t, direction } = useI18n();

const rootRef = ref<HTMLElement | null>(null);
const categories = ref<Category[]>([]);
const categoriesLoading = ref(true);
const categoriesError = ref<LinuxdoApiError | null>(null);

const source = ref<ListSource>({ kind: 'latest' });
const topics = ref<Topic[]>([]);
const users = ref<DiscourseUser[]>([]);
const hasMore = ref(false);
const topicsLoading = ref(false);
const topicsError = ref<LinuxdoApiError | null>(null);
const topicsPage = ref(1);

const activeTopicId = ref<number | null>(null);
const query = ref('');
const narrow = ref(false);
const sidebarOpen = ref(false);
const settingsOpen = ref(false);

const isMock = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock');

const devTopicId = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('topic');
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
})();

const toApiError = (error: unknown): LinuxdoApiError =>
  error instanceof LinuxdoApiError ? error : new LinuxdoApiError('network', String(error));

const listTitle = computed(() => {
  switch (source.value.kind) {
    case 'hot':
      return t('hot');
    case 'top':
      return t('top');
    case 'cat': {
      const category = categories.value.find((item) => item.id === source.value.categoryId);
      return category?.name ?? t('categories');
    }
    default:
      return t('latest');
  }
});

const listSubtitle = computed(() => t('topicCount', { count: formatCount(topics.value.length) }));

const categoriesErrorText = computed(() => {
  const error = categoriesError.value;
  if (!error) return '';
  if (error.kind === 'rate') return t('errorRate');
  if (error.kind === 'blocked') return t('errorBlocked');
  if (error.kind === 'parse') return t('errorParse');
  return t('errorNetwork');
});

let topicsRequestToken = 0;

const loadCategories = async (force = false): Promise<void> => {
  categoriesLoading.value = true;
  categoriesError.value = null;
  try {
    categories.value = await fetchCategories(force);
  } catch (error) {
    categoriesError.value = toApiError(error);
  } finally {
    categoriesLoading.value = false;
  }
};

const loadTopics = async (force = false): Promise<void> => {
  const token = ++topicsRequestToken;
  topicsLoading.value = true;
  topicsError.value = null;
  topicsPage.value = 1;

  try {
    const result = await fetchTopics(source.value.kind, {
      categoryId: source.value.categoryId,
      slug: source.value.slug,
      period: source.value.period,
      force,
    });
    if (token !== topicsRequestToken) return;
    topics.value = result.topics;
    users.value = result.users;
    hasMore.value = result.hasMore;
  } catch (error) {
    if (token !== topicsRequestToken) return;
    topics.value = [];
    users.value = [];
    hasMore.value = false;
    topicsError.value = toApiError(error);
  } finally {
    if (token === topicsRequestToken) topicsLoading.value = false;
  }
};

const loadMoreTopics = async (): Promise<void> => {
  if (topicsLoading.value || !hasMore.value) return;
  const token = ++topicsRequestToken;
  const next = topicsPage.value + 1;
  topicsLoading.value = true;

  try {
    const result = await fetchTopics(source.value.kind, {
      categoryId: source.value.categoryId,
      slug: source.value.slug,
      period: source.value.period,
      page: next,
    });
    if (token !== topicsRequestToken) return;
    topicsPage.value = next;
    topics.value = [...topics.value, ...result.topics];
    users.value = [...users.value, ...result.users.filter((user) => !users.value.some((existing) => existing.id === user.id))];
    hasMore.value = result.hasMore;
  } catch (error) {
    if (token !== topicsRequestToken) return;
    topicsError.value = toApiError(error);
  } finally {
    if (token === topicsRequestToken) topicsLoading.value = false;
  }
};

const selectSource = (next: ListSource): void => {
  activeTopicId.value = null;
  query.value = '';
  topics.value = [];
  topicsError.value = null;
  source.value = next;
};

const closeSidebar = (): void => {
  sidebarOpen.value = false;
};

const openTopic = (id: number): void => {
  activeTopicId.value = id;
  sidebarOpen.value = false;
};

const openCategory = (category: Category): void => {
  selectSource({ kind: 'cat', categoryId: category.id, slug: category.slug });
};

const goBack = (): void => {
  activeTopicId.value = null;
};

const refreshCurrent = (): void => {
  void loadTopics(true);
};

let resizeObserver: ResizeObserver | null = null;

const syncNarrow = (width: number): void => {
  const next = width < 700;
  if (next === narrow.value) return;
  narrow.value = next;
  if (!next) sidebarOpen.value = false;
};

const onWindowResize = (): void => {
  syncNarrow(window.innerWidth);
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape') return;
  if (settingsOpen.value) {
    settingsOpen.value = false;
    return;
  }
  if (narrow.value && sidebarOpen.value) {
    sidebarOpen.value = false;
    return;
  }
  if (activeTopicId.value !== null) {
    activeTopicId.value = null;
  }
};

watch(source, () => {
  void loadTopics();
});

onMounted(() => {
  if (devTopicId) activeTopicId.value = devTopicId;
  void loadCategories();
  void loadTopics();

  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? window.innerWidth;
      syncNarrow(width);
    });
    resizeObserver.observe(rootRef.value);
  } else {
    syncNarrow(window.innerWidth);
    window.addEventListener('resize', onWindowResize);
  }

  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div ref="rootRef" class="ld-app" :class="{ 'is-narrow': narrow }" :dir="direction">
    <header class="app-bar">
      <button
        v-if="narrow"
        class="icon-button bar-menu"
        :title="t('expandSidebar')"
        @click="sidebarOpen = true"
      >
        <AppIcon name="menu" :size="16" />
      </button>

      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="" />
        <span class="brand-title">{{ t('appName') }}</span>
      </div>

      <label class="search-box">
        <AppIcon class="search-icon" name="search" :size="14" />
        <input v-model="query" type="text" :placeholder="t('searchPlaceholder')" spellcheck="false" />
        <button v-if="query" class="search-clear" type="button" @click="query = ''">
          <AppIcon name="close" :size="12" />
        </button>
      </label>

      <button class="icon-button" :title="t('refresh')" @click="refreshCurrent">
        <AppIcon name="refresh" :size="16" />
      </button>

      <button class="icon-button" :title="t('settingsTitle')" @click="settingsOpen = true">
        <AppIcon name="settings" :size="16" />
      </button>
    </header>

    <div class="app-body">
      <div v-if="narrow && sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false" />

      <CategorySidebar
        v-show="!narrow || sidebarOpen"
        :categories="categories"
        :loading="categoriesLoading"
        :source="source"
        :query="query"
        :narrow="narrow"
        :error-text="categoriesErrorText"
        :t="t"
        @select="selectSource"
        @close="closeSidebar"
        @retry-categories="loadCategories(true)"
      />

      <main class="app-main">
        <TopicList
          v-if="activeTopicId === null"
          :title="listTitle"
          :subtitle="listSubtitle"
          :topics="topics"
          :users="users"
          :categories="categories"
          :has-more="hasMore"
          :loading="topicsLoading"
          :error="topicsError"
          :query="query"
          :t="t"
          @open="(topic) => openTopic(topic.id)"
          @load-more="loadMoreTopics"
          @retry="refreshCurrent"
          @open-settings="settingsOpen = true"
        />
        <TopicDetail
          v-else
          :topic-id="activeTopicId"
          :categories="categories"
          :t="t"
          @back="goBack"
          @open-topic="openTopic"
          @open-category="openCategory"
        />
      </main>
    </div>

    <footer class="status-bar">
      <span class="status-source">{{ t('source') }}</span>
      <span v-if="isMock" class="mock-badge">{{ t('mockHint') }}</span>
      <span class="status-spacer" />
      <span v-if="netBusy" class="status-busy">{{ t('loading') }}</span>
    </footer>

    <SettingsPanel :open="settingsOpen" :t="t" @close="settingsOpen = false" />
  </div>
</template>

<style scoped>
.ld-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--ld-bg);
  color: var(--ld-text);
}

.app-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 46px;
  padding: 0 12px;
  border-bottom: 1px solid var(--ld-border);
  background: var(--ld-bg);
}

.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
  padding-inline-end: 4px;
}

.brand-logo {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: block;
}

.brand-title {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--ld-text);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 340px;
  height: 28px;
  margin-inline-start: 4px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--ld-fill);
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  cursor: text;
}

.search-box:focus-within {
  background: var(--ld-bg);
  border-color: var(--ld-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ld-accent) 14%, transparent);
}

.search-icon {
  color: var(--ld-text-3);
}

.search-box input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ld-text);
  font-size: 12px;
  font-family: inherit;
}

.search-box input::placeholder {
  color: var(--ld-text-3);
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 50%;
  background: var(--ld-border);
  color: var(--ld-text-2);
  cursor: pointer;
  padding: 0;
}

.search-clear:hover {
  background: var(--ld-border-strong);
}

/* 刷新与设置入口靠右排列。 */
.app-bar > .icon-button:last-child {
  margin-inline-start: auto;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

.app-main {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  background: rgb(0 0 0 / 0.32);
  animation: backdrop-in 0.16s ease-out;
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.bar-menu {
  margin-inline-start: -4px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 24px;
  padding: 0 12px;
  border-top: 1px solid var(--ld-border);
  background: var(--ld-bg);
  color: var(--ld-text-3);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
}

.status-source {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-spacer {
  flex: 1;
}

.status-busy {
  font-variant-numeric: tabular-nums;
}

.mock-badge {
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(in srgb, #f0763a 16%, transparent);
  color: #d2601f;
  line-height: 14px;
}

.is-narrow .brand-title {
  font-size: 12.5px;
}

.is-narrow .search-box {
  max-width: none;
  margin-inline-start: 0;
}
</style>
