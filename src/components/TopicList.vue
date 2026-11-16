<script setup lang="ts">
import { computed } from 'vue';
import type { LinuxdoApiError } from '../api';
import { formatCount, relativeTimeIso, truncate } from '../format';
import type { Category, DiscourseUser, Topic } from '../types';
import AppIcon from './AppIcon.vue';
import LdAvatar from './LdAvatar.vue';

const props = defineProps<{
  title: string;
  subtitle: string;
  topics: Topic[];
  users: DiscourseUser[];
  categories: Category[];
  hasMore: boolean;
  loading: boolean;
  error: LinuxdoApiError | null;
  query: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'open', topic: Topic): void;
  (event: 'load-more'): void;
  (event: 'retry'): void;
  (event: 'open-settings'): void;
}>();

const userById = computed(() => {
  const map = new Map<number, DiscourseUser>();
  for (const user of props.users) map.set(user.id, user);
  return map;
});

const categoryById = computed(() => {
  const map = new Map<number, Category>();
  for (const category of props.categories) map.set(category.id, category);
  return map;
});

const filteredTopics = computed(() => {
  const query = props.query.trim().toLocaleLowerCase();
  if (!query) return props.topics;
  return props.topics.filter((topic) => {
    const author = props.users.find((user) => user.id === topic.posters?.[0]?.user_id);
    const category = categoryById.value.get(topic.category_id);
    return `${topic.title} ${author?.username ?? ''} ${category?.name ?? ''}`
      .toLocaleLowerCase()
      .includes(query);
  });
});

const rows = computed(() =>
  filteredTopics.value.map((topic) => {
    const author = userById.value.get(topic.posters?.[0]?.user_id ?? -1);
    const category = categoryById.value.get(topic.category_id);
    return {
      topic,
      author,
      category,
      reactions: topic.like_count ?? topic.op_like_count ?? 0,
    };
  }),
);

const displaySubtitle = computed(() =>
  props.query.trim() ? props.t('topicCount', { count: rows.value.length }) : props.subtitle,
);

const errorText = computed(() => {
  const error = props.error;
  if (!error) return '';
  switch (error.kind) {
    case 'rate':
      return props.t('errorRate');
    case 'blocked':
      return props.t('errorBlocked');
    case 'notfound':
      return props.t('errorNotFound');
    case 'http':
      return props.t('errorHttp', { status: error.status ?? 0 });
    case 'parse':
      return props.t('errorParse');
    default:
      return props.t('errorNetwork');
  }
});

const isBlocked = computed(() => props.error?.kind === 'blocked');
</script>

<template>
  <section class="topic-pane">
    <header class="pane-head">
      <div class="pane-head-text">
        <h2>{{ title }}</h2>
        <p>{{ displaySubtitle }}</p>
      </div>
      <button
        class="icon-button"
        :class="{ 'is-busy': loading }"
        :title="t('refresh')"
        :disabled="loading"
        @click="emit('retry')"
      >
        <AppIcon name="refresh" :size="15" />
      </button>
    </header>

    <div class="pane-scroll">
      <div v-if="loading && !topics.length" class="topic-skeleton">
        <div v-for="index in 7" :key="`topic-skeleton-${index}`" class="skeleton-row">
          <span class="skeleton-avatar" />
          <span class="skeleton-lines">
            <span class="skeleton-line skeleton-line-title" />
            <span class="skeleton-line skeleton-line-meta" />
          </span>
        </div>
      </div>

      <div v-else-if="error && !topics.length" class="pane-state">
        <span class="state-icon"><AppIcon name="alert" :size="22" /></span>
        <p class="state-title">{{ errorText }}</p>
        <p v-if="error.detail" class="state-detail">{{ error.detail }}</p>
        <button v-if="isBlocked" class="text-button" @click="emit('open-settings')">
          {{ t('goToSettings') }}
        </button>
        <button v-else class="text-button" @click="emit('retry')">{{ t('retry') }}</button>
      </div>

      <div v-else-if="!rows.length" class="pane-state">
        <span class="state-icon"><AppIcon name="inbox" :size="22" /></span>
        <p class="state-title">{{ query.trim() ? t('noMatchingTopics') : t('emptyTopics') }}</p>
      </div>

      <div v-else class="topic-rows">
        <button
          v-for="{ topic, author, category, reactions } in rows"
          :key="topic.id"
          class="topic-row"
          @click="emit('open', topic)"
        >
          <LdAvatar
            :template="author?.avatar_template"
            :name="author?.username ?? ''"
            :size="36"
            :radius="9"
          />
          <span class="topic-body">
            <span class="topic-title">{{ topic.title }}</span>
            <span class="topic-meta">
              <span
                v-if="category"
                class="node-badge"
                :style="{ background: `#${category.color}22`, color: `#${category.color}` }"
              >
                {{ category.emoji ? `${category.emoji} ` : '' }}{{ category.name }}
              </span>
              <span class="topic-author">{{ author?.username }}</span>
              <span class="meta-dot">·</span>
              <span>{{ relativeTimeIso(topic.last_posted_at || topic.created_at) }}</span>
              <template v-if="topic.tags.length">
                <span v-for="tag in topic.tags" :key="tag.id" class="tag-chip">{{ tag.name }}</span>
              </template>
            </span>
            <span v-if="topic.has_accepted_answer" class="accepted-chip">
              <AppIcon name="check" :size="11" />
              {{ t('top') }}
            </span>
          </span>
          <span class="topic-side">
            <span v-if="reactions" class="stat-pill">
              <AppIcon name="heart" :size="11" />
              {{ formatCount(reactions) }}
            </span>
            <span v-if="topic.reply_count" class="reply-pill">
              <AppIcon name="reply" :size="11" />
              {{ formatCount(topic.reply_count) }}
            </span>
          </span>
        </button>

        <div v-if="hasMore" class="load-more-row">
          <button class="text-button" :disabled="loading" @click="emit('load-more')">
            {{ loading ? t('settingsTesting') : t('loadMore') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.topic-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
  background: var(--ld-bg);
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--ld-border);
  background: var(--ld-bg);
}

.pane-head-text {
  min-width: 0;
}

.pane-head-text h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ld-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pane-head-text p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--ld-text-3);
}

.icon-button.is-busy :deep(svg) {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pane-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.topic-rows {
  display: flex;
  flex-direction: column;
}

.topic-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  width: 100%;
  padding: 11px 16px 12px;
  border: 0;
  border-bottom: 1px solid var(--ld-border-soft);
  background: transparent;
  text-align: start;
  cursor: pointer;
  transition: background 0.12s ease;
}

.topic-row:hover {
  background: var(--ld-hover);
}

.topic-row:active {
  background: var(--ld-hover-strong);
}

.topic-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.topic-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--ld-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.topic-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 10.5px;
  color: var(--ld-text-3);
  line-height: 1.5;
}

.node-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 16px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-chip {
  padding: 0 5px;
  border: 1px solid var(--ld-border);
  border-radius: 4px;
  font-size: 10px;
  line-height: 14px;
  color: var(--ld-text-3);
}

.accepted-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  align-self: flex-start;
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ld-success) 14%, transparent);
  color: var(--ld-success);
  font-size: 10px;
  line-height: 16px;
}

.topic-author {
  color: var(--ld-text-2);
}

.meta-dot {
  opacity: 0.6;
}

.topic-side {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding-top: 2px;
}

.reply-pill,
.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--ld-fill);
  color: var(--ld-text-3);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.topic-skeleton {
  display: flex;
  flex-direction: column;
}

.skeleton-row {
  display: flex;
  gap: 11px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--ld-border-soft);
}

.skeleton-avatar {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  flex: none;
  background: var(--ld-skeleton);
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  padding-top: 2px;
}

.skeleton-line {
  height: 10px;
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

.skeleton-line-title {
  width: 74%;
  height: 12px;
}

.skeleton-line-meta {
  width: 42%;
}

@keyframes skeleton-wave {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.pane-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 64px 24px;
  text-align: center;
}

.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--ld-fill);
  color: var(--ld-text-3);
}

.state-title {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--ld-text-2);
}

.state-detail {
  margin: 0;
  max-width: 320px;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--ld-text-3);
  word-break: break-word;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 14px 0 18px;
}

.text-button {
  margin-top: 4px;
  padding: 4px 10px;
  border: 1px solid var(--ld-border);
  border-radius: 7px;
  background: transparent;
  color: var(--ld-text-2);
  font-size: 11.5px;
  cursor: pointer;
}

.text-button:hover:not(:disabled) {
  background: var(--ld-hover);
  border-color: var(--ld-border-strong);
}

.text-button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
