import { ref } from 'vue';
import { invoke, isOtoolsPluginRuntime } from 'otools-plugin-sdk/runtime';
import { readCache, writeCache } from './cache';
import { getClearance, markBlocked } from './clearance';
import { isChallengeBlocked } from './cf';
import { computeHasMore, filterVisibleCategories } from './filters';
import type {
  CategoriesEnvelope,
  Category,
  DiscourseUser,
  ListKind,
  Topic,
  TopicDetail,
  TopicListEnvelope,
  TopPeriod,
} from './types';

export type { ListKind, TopPeriod } from './types';

/**
 * linux.do 公开 Discourse JSON 客户端（匿名只读）。
 *
 * 全部请求走宿主 `otools_host_http_send`（linux.do 不返回 CORS 头）。
 * CF 静默盾：403 + 盾特征 → 抛 blocked 并置 clearanceState=blocked，
 * 设置面板引导用户粘贴自己浏览器的 cf_clearance + UA（Spike 结论：整串精确配对）。
 */

export const API_ORIGIN = 'https://linux.do';

/** Spike（2026-11-16）实测的默认 UA：无用户覆写时使用；带 cookie 时必须换成用户浏览器 UA。 */
export const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';

const HOST_HTTP_COMMAND = 'otools_host_http_send';
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

export type LinuxdoErrorKind = 'network' | 'rate' | 'blocked' | 'notfound' | 'http' | 'parse';

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
}

interface HostHttpResponse {
  status: number;
  body_text?: string | null;
  headers?: Array<{ key: string; value: string }>;
}

interface RequestOptions {
  force?: boolean;
  /** 跳过 mock 分支（testConnection 用）。 */
  live?: boolean;
}

const devMockEnabled = (): boolean => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('mock');
  } catch {
    return false;
  }
};

const canUseHostHttp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window as unknown as { __TAURI_INTERNALS__?: unknown };
  return Boolean(host.__TAURI_INTERNALS__) || isOtoolsPluginRuntime();
};

const toHeaderMap = (items: Array<{ key: string; value: string }> | undefined): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const item of items ?? []) {
    if (!item || typeof item.key !== 'string') continue;
    headers[item.key.toLowerCase()] = String(item.value ?? '');
  }
  return headers;
};

/** Spike 结论：Accept + User-Agent（覆写优先），cookie 非空时附 Cookie。 */
const buildHeaders = (): Array<{ key: string; value: string }> => {
  const { cookie, ua } = getClearance();
  const headers = [
    { key: 'Accept', value: 'application/json' },
    { key: 'User-Agent', value: ua || DEFAULT_UA },
  ];
  if (cookie) headers.push({ key: 'Cookie', value: `cf_clearance=${cookie}` });
  return headers;
};

const hostRequest = async (url: string): Promise<HttpResult> => {
  const response = await invoke<HostHttpResponse>(HOST_HTTP_COMMAND, {
    request: {
      id: '',
      name: 'linuxdo',
      method: 'GET',
      url,
      headers: buildHeaders(),
      cookies: [],
      params: [],
      body_type: 'none',
      body: '',
      timeout_secs: 20,
      follow_redirects: true,
    },
  });

  return {
    status: Number(response?.status ?? 0),
    text: String(response?.body_text ?? ''),
    headers: toHeaderMap(response?.headers),
  };
};

const browserRequest = async (url: string): Promise<HttpResult> => {
  const headers: Record<string, string> = {};
  for (const header of buildHeaders()) headers[header.key] = header.value;

  const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  const text = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });
  return { status: response.status, text, headers: responseHeaders };
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

/** 网络失败重试上限 1 次（SPEC Review Focus #4：blocked 不重试，防打爆限流）。 */
const performRequest = async (url: string, options: RequestOptions): Promise<HttpResult> => {
  if (!options.live && devMockEnabled()) {
    const { resolveMock } = await import('./mock/data');
    const mocked = resolveMock(url, { method: 'GET' });
    if (mocked !== null) {
      return { status: mocked.status, text: mocked.body, headers: {} };
    }
  }

  if (canUseHostHttp()) {
    let attempt = 0;
    for (;;) {
      try {
        return await hostRequest(url);
      } catch (error) {
        attempt += 1;
        // 宿主命令不可用（旧版本宿主）时回退 webview fetch；跨域失败会落到 network 错误。
        if (attempt >= 2) {
          if (import.meta.env.DEV) {
            console.warn('[linuxdo] host http failed, falling back to fetch', error);
          }
          break;
        }
      }
    }
  }

  return browserRequest(url);
};

const readResult = async (result: HttpResult): Promise<string> => {
  const text = result.text.trim();
  if (!text) throw new LinuxdoApiError('parse', 'empty response');

  if (isChallengeBlocked(result.status, result.headers['cf-mitigated'], text.slice(0, 400))) {
    markBlocked();
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
      const message = error instanceof Error ? error.message : String(error);
      throw new LinuxdoApiError('network', 'network request failed', { detail: message });
    } finally {
      netBusy.value = false;
    }

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

const buildListUrl = (kind: ListKind, opts: { categoryId?: number; slug?: string; page?: number; period?: TopPeriod }): string => {
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

/** 设置面板「测试连接」：绕过 mock 与缓存，报告 ok/blocked/HTTP 状态。 */
export async function testConnection(): Promise<{ ok: boolean; blocked: boolean; status: number }> {
  await throttle();
  netBusy.value = true;
  try {
    const result = await performRequest(`${API_ORIGIN}/latest.json?no_definitions=true&page=1`, { live: true });
    const text = result.text.trim();
    const blocked = isChallengeBlocked(result.status, result.headers['cf-mitigated'], text.slice(0, 400));
    if (blocked) markBlocked();
    return { ok: !blocked && result.status === 200 && text.startsWith('{'), blocked, status: result.status };
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[linuxdo] testConnection failed', error);
    return { ok: false, blocked: false, status: 0 };
  } finally {
    netBusy.value = false;
  }
}
