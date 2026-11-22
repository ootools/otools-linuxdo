import { ref } from 'vue';
import { readCache, writeCache } from './cache.ts';
import { isChallengeBlocked } from './cf.ts';
import { computeHasMore, filterVisibleCategories } from './filters.ts';
import {
  createLinuxdoSiteSession,
  SiteSessionError,
  type JsonRequestResult,
  type LinuxdoSiteSession,
} from './site-session.ts';
import type {
  CategoriesEnvelope,
  Category,
  DiscourseUser,
  ListKind,
  Topic,
  TopicDetail,
  TopicListEnvelope,
  TopPeriod,
} from './types.ts';

export type { ListKind, TopPeriod } from './types.ts';

/**
 * linux.do 公开 Discourse JSON 客户端（匿名只读）。
 *
 * 全部正式请求走宿主站点会话 API（otools_host_webview_session_request）：由宿主
 * 持有隔离的 linux.do WebView 会话，插件只能请求 plugin.json 声明过的只读 JSON
 * 路径与 query key。challenge/拦截以 interaction_required 返回（不透传页面内容）；
 * `?mock=1` 开发走查仍走本地 mock，无宿主环境清晰提示能力缺失。
 */

export const API_ORIGIN = 'https://linux.do';

const REQUEST_GAP_MS = 300;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const TTL = {
  categories: 24 * HOUR,
  latest: 2 * MINUTE,
  hot: 5 * MINUTE,
  top: 5 * MINUTE,
  categoryTopics: 3 * MINUTE,
  topic: 5 * MINUTE,
  /** 详情翻页（回复块）。 */
  topicPage: 3 * MINUTE,
};

export type LinuxdoErrorKind =
  | 'network'
  | 'rate'
  | 'blocked'
  | 'notfound'
  | 'http'
  | 'parse'
  | 'permission'
  | 'unsupported';

export class LinuxdoApiError extends Error {
  readonly kind: LinuxdoErrorKind;
  readonly status?: number;
  readonly detail?: string;

  constructor(kind: LinuxdoErrorKind, message: string, options: { status?: number; detail?: string } = {}) {
    super(message);
    this.name = 'LinuxdoApiError';
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
  }
}

/** 有真实网络请求在飞（不含缓存命中），状态栏显示「请求中」。 */
export const netBusy = ref(false);

export interface TopicPage {
  topics: Topic[];
  users: DiscourseUser[];
  hasMore: boolean;
}

interface HttpResult {
  status: number;
  text: string;
  headers: Record<string, string>;
  /** 会话 API 直接给出已解析 JSON；mock 分支仍走 text。 */
  data?: unknown;
}

interface RequestOptions {
  force?: boolean;
  /** 跳过 mock 分支（testConnection 用）。 */
  live?: boolean;
}

let siteSession: LinuxdoSiteSession = createLinuxdoSiteSession();

/** 仅测试注入使用；生产代码永远走默认 adapter。 */
export function setSiteSessionForTests(session: LinuxdoSiteSession): void {
  siteSession = session;
}

const devMockEnabled = (): boolean => {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('mock');
  } catch {
    return false;
  }
};

/** 把插件自建的绝对 URL 拆成声明作用域内的 path + query（origin 由宿主决定）。 */
export function splitRequestUrl(url: string): { path: string; query: Record<string, string> } {
  const parsed = new URL(url);
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return { path: parsed.pathname, query };
}

/** 宿主固定枚举 → 原有 UX 错误类别；错误结果不含页面内容，故 detail 恒为空。 */
export function sessionFailureToApiError(result: JsonRequestResult): LinuxdoApiError {
  const error = result.error ?? 'session_unavailable';
  switch (error) {
    case 'interaction_required':
      return new LinuxdoApiError('blocked', 'cloudflare challenge', { status: result.status });
    case 'http_error':
      if (result.status === 429) return new LinuxdoApiError('rate', 'rate limit exceeded', { status: 429 });
      if (result.status === 404) return new LinuxdoApiError('notfound', 'resource not found', { status: 404 });
      return new LinuxdoApiError('http', `unexpected status ${result.status ?? ''}`, { status: result.status });
    case 'permission_required':
    case 'permission_denied':
      return new LinuxdoApiError('permission', 'site session permission required', { status: result.status });
    case 'unsupported_platform':
      return new LinuxdoApiError('unsupported', 'isolated site sessions unsupported here', {});
    case 'invalid_json':
      return new LinuxdoApiError('parse', 'response is not json', {});
    default:
      return new LinuxdoApiError('network', 'site session request failed', {});
  }
}

const performRequest = async (url: string, options: RequestOptions): Promise<HttpResult> => {
  if (!options.live && devMockEnabled()) {
    const { resolveMock } = await import('./mock/data');
    const mocked = resolveMock(url, { method: 'GET' });
    if (mocked !== null) {
      return { status: mocked.status, text: mocked.body, headers: {} };
    }
  }

  const { path, query } = splitRequestUrl(url);
  const result = await siteSession.request(path, query);
  if (result.ok) {
    return {
      status: result.status ?? 200,
      text: '',
      headers: { 'content-type': result.contentType ?? 'application/json' },
      data: result.data,
    };
  }
  throw sessionFailureToApiError(result);
};

let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = requestChain.then(task, task);
  requestChain = run.catch(() => undefined);
  return run;
};

const throttle = async (): Promise<void> => {
  const wait = Math.max(0, lastRequestAt + REQUEST_GAP_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
};

/** mock 分支专用：沿用 CF 盾判定，支撑 `?mock=1&blocked=1` 走查。 */
const readResult = async (result: HttpResult): Promise<string> => {
  const text = result.text.trim();
  if (!text) throw new LinuxdoApiError('parse', 'empty response');

  if (isChallengeBlocked(result.status, result.headers['cf-mitigated'], text.slice(0, 400))) {
    throw new LinuxdoApiError('blocked', 'cloudflare challenge', { status: result.status });
  }
  if (result.status === 429) {
    throw new LinuxdoApiError('rate', 'rate limit exceeded', { status: 429 });
  }
  if (result.status === 404) {
    throw new LinuxdoApiError('notfound', 'resource not found', { status: 404 });
  }
  if (!result.status || result.status >= 400) {
    throw new LinuxdoApiError('http', `unexpected status ${result.status}`, { status: result.status });
  }
  return text;
};

const getJson = async <T>(url: string, ttlMs: number, options: RequestOptions = {}): Promise<T> => {
  const force = Boolean(options.force);

  if (!force) {
    const cached = readCache<T>(url, ttlMs);
    if (cached !== null) return cached;
  }

  return enqueue(async () => {
    if (!force) {
      const cached = readCache<T>(url, ttlMs);
      if (cached !== null) return cached;
    }

    await throttle();
    netBusy.value = true;

    let result: HttpResult;
    try {
      result = await performRequest(url, options);
    } catch (error) {
      if (error instanceof LinuxdoApiError) throw error;
      if (error instanceof SiteSessionError) {
        // adapter 的本地判定：宿主能力缺失或作用域校验失败。
        if (error.code === 'unsupported_host') {
          throw new LinuxdoApiError('unsupported', 'host does not support site sessions');
        }
        throw new LinuxdoApiError('network', 'site session request failed', { detail: error.message });
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new LinuxdoApiError('network', 'network request failed', { detail: message });
    } finally {
      netBusy.value = false;
    }

    if (result.data !== undefined) {
      if (ttlMs > 0) writeCache(url, result.data);
      return result.data as T;
    }

    // mock 分支：文本形态，保留原有状态码/盾判定语义。
    const text = await readResult(result);

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      // 配额用尽或节点维护时可能返回 HTML 错误页。
      throw new LinuxdoApiError('parse', 'response is not json', { detail: text.slice(0, 160) });
    }

    if (ttlMs > 0) writeCache(url, data);
    return data;
  });
};

export const buildListUrl = (kind: ListKind, opts: { categoryId?: number; slug?: string; page?: number; period?: TopPeriod }): string => {
  const page = Math.max(1, opts.page ?? 1);
  switch (kind) {
    case 'latest':
      return `${API_ORIGIN}/latest.json?no_definitions=true&page=${page}`;
    case 'hot':
      return `${API_ORIGIN}/hot.json`;
    case 'top':
      return `${API_ORIGIN}/top.json?period=${opts.period ?? 'daily'}`;
    case 'cat': {
      const slug = encodeURIComponent(opts.slug ?? '');
      const suffix = page > 1 ? `?page=${page}` : '';
      return `${API_ORIGIN}/c/${slug}/${opts.categoryId ?? 0}.json${suffix}`;
    }
  }
};

const listTtl = (kind: ListKind): number => {
  switch (kind) {
    case 'latest':
      return TTL.latest;
    case 'hot':
      return TTL.hot;
    case 'top':
      return TTL.top;
    case 'cat':
      return TTL.categoryTopics;
  }
};

export function fetchTopics(
  kind: ListKind,
  opts: { categoryId?: number; slug?: string; page?: number; period?: TopPeriod; force?: boolean } = {},
): Promise<TopicPage> {
  const url = buildListUrl(kind, opts);
  return getJson<TopicListEnvelope>(url, listTtl(kind), { force: opts.force }).then((envelope) => ({
    topics: Array.isArray(envelope?.topic_list?.topics) ? envelope.topic_list.topics : [],
    users: Array.isArray(envelope?.users) ? envelope.users : [],
    hasMore: computeHasMore(kind, envelope?.topic_list?.more_topics_url),
  }));
}

export function fetchCategories(force = false): Promise<Category[]> {
  return getJson<CategoriesEnvelope>(`${API_ORIGIN}/categories.json`, TTL.categories, { force }).then(
    (envelope) => filterVisibleCategories(envelope?.category_list?.categories ?? []),
  );
}

export function fetchTopic(id: number, page = 1, force = false): Promise<TopicDetail> {
  const url = page > 1 ? `${API_ORIGIN}/t/${id}.json?page=${page}` : `${API_ORIGIN}/t/${id}.json`;
  return getJson<TopicDetail>(url, page > 1 ? TTL.topicPage : TTL.topic, { force }).then((detail) => {
    if (!detail || !detail.id) {
      throw new LinuxdoApiError('notfound', 'topic not found', { status: 404 });
    }
    return detail;
  });
}

/** 设置面板「测试连接」：绕过 mock 与缓存，报告 ok/blocked/权限/平台支持状态。 */
export async function testConnection(): Promise<{
  ok: boolean;
  blocked: boolean;
  permission: boolean;
  unsupported: boolean;
  status: number;
}> {
  await throttle();
  netBusy.value = true;
  try {
    const result = await siteSession.request('/latest.json', { no_definitions: 'true', page: '1' });
    if (result.ok) {
      return { ok: true, blocked: false, permission: false, unsupported: false, status: result.status ?? 200 };
    }
    const failure = sessionFailureToApiError(result);
    return {
      ok: false,
      blocked: failure.kind === 'blocked',
      permission: failure.kind === 'permission',
      unsupported: failure.kind === 'unsupported',
      status: result.status ?? 0,
    };
  } catch (error) {
    if (import.meta.env?.DEV) console.warn('[linuxdo] testConnection failed', error);
    return {
      ok: false,
      blocked: false,
      permission: false,
      unsupported: error instanceof SiteSessionError && error.code === 'unsupported_host',
      status: 0,
    };
  } finally {
    netBusy.value = false;
  }
}
