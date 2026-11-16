<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { API_ORIGIN, fetchTopic, LinuxdoApiError } from '../api';
import { absoluteTimeIso, formatCount, parseTopicIdFromHref, relativeTimeIso, sanitizeHtml } from '../format';
import { copyText, openLink } from '../links';
import type { Category, Post, TopicDetail } from '../types';
import AppIcon from './AppIcon.vue';
import LdAvatar from './LdAvatar.vue';

const props = defineProps<{
  topicId: number;
  categories: Category[];
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'open-topic', topicId: number): void;
  (event: 'open-category', category: Category): void;
}>();

const topic = ref<TopicDetail | null>(null);
const posts = ref<Post[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<LinuxdoApiError | null>(null);
const page = ref(1);
const copyState = ref<'idle' | 'ok' | 'fail'>('idle');
const scrollRef = ref<HTMLElement | null>(null);
let copyTimer = 0;

const category = computed(() => props.categories.find((item) => item.id === topic.value?.category_id));

const topicUrl = computed(() => `${API_ORIGIN}/t/${topic.value?.slug || 'topic'}/${props.topicId}`);

const hasMorePosts = computed(() => {
  if (!topic.value) return false;
  const streamLength = topic.value.post_stream.stream?.length ?? 0;
  return streamLength > posts.value.length;
});

const contentHtml = computed(() => sanitizeHtml(posts.value.find((post) => post.post_number === 1)?.cooked ?? ''));

const replies = computed(() => posts.value.filter((post) => post.post_number > 1));

const errorText = computed(() => {
  const current = error.value;
  if (!current) return '';
  switch (current.kind) {
    case 'rate':
      return props.t('errorRate');
    case 'blocked':
      return props.t('errorBlocked');
    case 'notfound':
      return props.t('errorNotFound');
    case 'http':
      return props.t('errorHttp', { status: current.status ?? 0 });
    case 'parse':
      return props.t('errorParse');
    default:
      return props.t('errorNetwork');
  }
});

const isBlocked = computed(() => error.value?.kind === 'blocked');

const appendPosts = (incoming: Post[]): void => {
  const seen = new Set(posts.value.map((post) => post.id));
  for (const post of incoming) {
    if (!seen.has(post.id)) {
      posts.value.push(post);
      seen.add(post.id);
    }
  }
};

const load = async (force = false): Promise<void> => {
  loading.value = true;
  error.value = null;
  page.value = 1;
  copyState.value = 'idle';

  try {
    const detail = await fetchTopic(props.topicId, 1, force);
    topic.value = detail;
    posts.value = detail.post_stream.posts ?? [];
    if (scrollRef.value) scrollRef.value.scrollTop = 0;
  } catch (caught) {
    error.value = caught instanceof LinuxdoApiError ? caught : new LinuxdoApiError('network', String(caught));
    topic.value = null;
    posts.value = [];
  } finally {
    loading.value = false;
  }
};

const loadMore = async (): Promise<void> => {
  if (loadingMore.value || !topic.value) return;
  loadingMore.value = true;
  try {
    const next = page.value + 1;
    const detail = await fetchTopic(props.topicId, next);
    page.value = next;
    appendPosts(detail.post_stream.posts ?? []);
  } catch {
    // 加载更多失败静默保留当前楼层，下次点击再试。
  } finally {
    loadingMore.value = false;
  }
};

watch(
  () => props.topicId,
  () => {
    void load();
  },
  { immediate: true },
);

watch(
  () => topic.value?.id,
  async () => {
    await nextTick();
    if (scrollRef.value) scrollRef.value.scrollTop = 0;
  },
);

const REACTION_EMOJI: Record<string, string> = {
  heart: '❤️',
  '+1': '👍',
  laugh: '😄',
  laughing: '😆',
  open_mouth: '😮',
  clap: '👏',
  confetti_ball: '🎊',
  hugs: '🤗',
  distorted_face: '🥴',
  tada: '🎉',
  smile: '😄',
  thinking: '🤔',
};

const reactionLabel = (reaction: { id: string; count: number }): string =>
  `${REACTION_EMOJI[reaction.id] ?? `:${reaction.id}:`} ${formatCount(reaction.count)}`;

const handleContentClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const image = target.closest('img');
  if (image) {
    event.preventDefault();
    openLink((image as HTMLImageElement).src);
    return;
  }

  const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return;
  event.preventDefault();

  const href = anchor.getAttribute('href') || '';
  const linkedTopicId = parseTopicIdFromHref(href);
  if (linkedTopicId && linkedTopicId !== props.topicId) {
    emit('open-topic', linkedTopicId);
    return;
  }
  if (linkedTopicId === props.topicId) return;

  openLink(href);
};

const handleOpenBrowser = (): void => {
  openLink(topicUrl.value);
};

const handleCopy = async (): Promise<void> => {
  const ok = await copyText(topicUrl.value);
  copyState.value = ok ? 'ok' : 'fail';
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyState.value = 'idle';
  }, 1800);
};

onUnmounted(() => {
  window.clearTimeout(copyTimer);
});
</script>

<template>
  <section class="detail-pane">
    <header class="detail-head">
      <button class="back-button" :title="t('back')" @click="emit('back')">
        <AppIcon name="back" :size="15" />
        <span>{{ t('back') }}</span>
      </button>

      <span v-if="category" class="head-category">
        <button
          class="head-category-button"
          :style="{ background: `#${category.color}1c`, color: `#${category.color}` }"
          @click="emit('open-category', category)"
        >
          {{ category.emoji ? `${category.emoji} ` : '' }}{{ category.name }}
        </button>
      </span>

      <span class="head-spacer" />

      <button class="icon-button" :title="t('copyLink')" @click="handleCopy">
        <AppIcon name="copy" :size="15" />
      </button>
      <button class="icon-button" :title="t('openInBrowser')" @click="handleOpenBrowser">
        <AppIcon name="external" :size="15" />
      </button>
    </header>

    <div ref="scrollRef" class="detail-scroll">
      <div v-if="loading" class="detail-loading">
        <span class="detail-skeleton detail-skeleton-title" />
        <span class="detail-skeleton detail-skeleton-meta" />
        <span v-for="index in 6" :key="`detail-skeleton-${index}`" class="detail-skeleton" />
      </div>

      <div v-else-if="error" class="detail-state">
        <span class="state-icon"><AppIcon name="alert" :size="22" /></span>
        <p class="state-title">{{ errorText }}</p>
        <p v-if="error.detail" class="state-detail">{{ error.detail }}</p>
        <button v-if="isBlocked" class="text-button" @click="$emit('back')">{{ t('back') }}</button>
        <button v-else class="text-button" @click="load(true)">{{ t('retry') }}</button>
      </div>

      <template v-else-if="topic">
        <article class="article">
          <h1 class="article-title">{{ topic.title }}</h1>

          <div class="article-meta">
            <LdAvatar
              :template="topic.details?.created_by?.avatar_template ?? posts[0]?.avatar_template"
              :name="topic.details?.created_by?.username ?? posts[0]?.username ?? ''"
              :size="26"
              :radius="7"
            />
            <span class="article-author">{{ topic.details?.created_by?.username ?? posts[0]?.username }}</span>
            <span class="meta-divider" />
            <span :title="absoluteTimeIso(topic.created_at)">
              {{ t('postedAt', { time: relativeTimeIso(topic.created_at) }) }}
            </span>
            <span class="meta-divider" />
            <span class="meta-stat"><AppIcon name="reply" :size="11" /> {{ formatCount(topic.reply_count) }}</span>
            <span class="meta-stat"><AppIcon name="heart" :size="11" /> {{ formatCount(topic.like_count ?? 0) }}</span>
            <span class="meta-stat"><AppIcon name="eye" :size="11" /> {{ formatCount(topic.views) }}</span>
          </div>

          <div class="ld-rich article-content" @click="handleContentClick" v-html="contentHtml" />

          <div v-if="topic.details?.participants?.length" class="participants">
            <span class="participants-label">{{ t('participants') }}</span>
            <span class="participants-avatars">
              <LdAvatar
                v-for="participant in topic.details.participants.slice(0, 10)"
                :key="participant.id"
                :template="participant.avatar_template"
                :name="participant.username"
                :size="20"
                :radius="6"
              />
            </span>
          </div>

          <div class="article-replies-head">
            <span>{{ t('replyCount', { count: topic.reply_count ?? replies.length }) }}</span>
            <span v-if="copyState === 'ok'" class="copied-hint">{{ t('copied') }}</span>
            <span v-else-if="copyState === 'fail'" class="copied-hint is-error">{{ t('copyFailed') }}</span>
          </div>

          <div v-if="!replies.length" class="replies-state">{{ t('emptyTopics') }}</div>

          <div v-else class="reply-list">
            <article v-for="reply in replies" :key="reply.id" class="reply">
              <LdAvatar :template="reply.avatar_template" :name="reply.username" :size="26" :radius="7" />
              <div class="reply-body">
                <div class="reply-head">
                  <span class="reply-user">{{ reply.username }}</span>
                  <span v-if="reply.reply_to_post_number" class="reply-ref">
                    {{ t('floor', { floor: reply.reply_to_post_number }) }} ↩
                  </span>
                  <span class="reply-floor">{{ t('floor', { floor: reply.post_number }) }}</span>
                  <span v-if="reply.accepted_answer" class="accepted-chip">
                    <AppIcon name="check" :size="10" />
                    {{ t('acceptedAnswer') }}
                  </span>
                  <span class="reply-time" :title="absoluteTimeIso(reply.created_at)">
                    {{ relativeTimeIso(reply.created_at) }}
                  </span>
                </div>
                <div
                  class="ld-rich reply-content"
                  @click="handleContentClick"
                  v-html="sanitizeHtml(reply.cooked)"
                />
                <div v-if="reply.reactions?.length" class="reply-reactions">
                  <span
                    v-for="reaction in reply.reactions"
                    :key="reaction.id"
                    class="reaction-chip"
                  >
                    {{ reactionLabel(reaction) }}
                  </span>
                </div>
              </div>
            </article>
          </div>

          <div class="reply-footer">
            <button v-if="hasMorePosts" class="text-button" :disabled="loadingMore" @click="loadMore">
              {{ loadingMore ? t('loading') : t('loadMore') }}
            </button>
            <span v-else-if="replies.length" class="all-shown">{{ t('allRepliesShown') }}</span>
          </div>

          <div v-if="topic.suggested_topics?.topics?.length" class="suggested">
            <h3 class="suggested-title">{{ t('suggestedTopics') }}</h3>
            <button
              v-for="suggested in topic.suggested_topics.topics"
              :key="suggested.id"
              class="suggested-row"
              @click="emit('open-topic', suggested.id)"
            >
              <span class="suggested-text">{{ suggested.title }}</span>
              <span class="suggested-meta">{{ t('replyCount', { count: suggested.reply_count }) }}</span>
            </button>
          </div>
        </article>
      </template>
    </div>
  </section>
</template>

<style scoped>
.detail-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--ld-bg);
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--ld-border);
  background: var(--ld-bg);
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ld-text-2);
  font-size: 11.5px;
  cursor: pointer;
}

.back-button:hover {
  background: var(--ld-hover);
  color: var(--ld-text);
}

.head-category {
  display: inline-flex;
  min-width: 0;
  padding-inline-start: 4px;
  border-inline-start: 1px solid var(--ld-border);
}

.head-category-button {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 8px;
  border: 0;
  border-radius: 6px;
  font-size: 10.5px;
  cursor: pointer;
}

.head-spacer {
  flex: 1;
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.detail-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 780px;
  padding: 26px 22px;
}

.detail-skeleton {
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

.detail-skeleton-title {
  height: 18px;
  width: 68%;
}

.detail-skeleton-meta {
  width: 34%;
  margin-bottom: 8px;
}

@keyframes skeleton-wave {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.detail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 70px 24px;
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
  max-width: 340px;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--ld-text-3);
  word-break: break-word;
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

.article {
  max-width: 780px;
  margin: 0 auto;
  padding: 22px 24px 40px;
}

.article-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: -0.012em;
  color: var(--ld-text);
  word-break: break-word;
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--ld-text-3);
}

.article-author {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ld-text-2);
}

.meta-divider {
  width: 1px;
  height: 9px;
  background: var(--ld-border-strong);
  opacity: 0.7;
}

.meta-stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-variant-numeric: tabular-nums;
}

.article-content {
  margin-top: 16px;
}

.participants {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  font-size: 10.5px;
  color: var(--ld-text-3);
}

.participants-avatars {
  display: inline-flex;
  gap: 4px;
}

.article-replies-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 26px;
  padding: 12px 0 10px;
  border-top: 1px solid var(--ld-border);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ld-text-2);
}

.copied-hint {
  font-size: 10.5px;
  font-weight: 400;
  color: var(--ld-success);
}

.copied-hint.is-error {
  color: var(--ld-danger);
}

.replies-state {
  padding: 22px 0;
  font-size: 11.5px;
  color: var(--ld-text-3);
  text-align: center;
}

.reply-list {
  display: flex;
  flex-direction: column;
}

.reply {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ld-border-soft);
}

.reply:last-child {
  border-bottom: 0;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ld-text-3);
}

.reply-user {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ld-text-2);
}

.reply-floor {
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.reply-ref {
  opacity: 0.7;
}

.accepted-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ld-success) 14%, transparent);
  color: var(--ld-success);
  font-size: 10px;
  line-height: 16px;
}

.reply-time {
  margin-inline-start: auto;
  font-size: 10px;
}

.reply-content {
  margin-top: 4px;
  font-size: 12.5px;
}

.reply-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.reaction-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--ld-fill);
  color: var(--ld-text-2);
  font-size: 10.5px;
  line-height: 18px;
}

.reply-footer {
  display: flex;
  justify-content: center;
  padding-top: 14px;
}

.all-shown {
  font-size: 10.5px;
  color: var(--ld-text-3);
}

.suggested {
  margin-top: 30px;
  border-top: 1px solid var(--ld-border);
  padding-top: 14px;
}

.suggested-title {
  margin: 0 0 8px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ld-text-2);
}

.suggested-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: start;
  cursor: pointer;
  transition: background 0.12s ease;
}

.suggested-row:hover {
  background: var(--ld-hover);
}

.suggested-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ld-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggested-meta {
  flex: none;
  font-size: 10.5px;
  color: var(--ld-text-3);
}

@media (max-width: 560px) {
  .article {
    padding: 16px 16px 32px;
  }

  .article-title {
    font-size: 16px;
  }
}
</style>
