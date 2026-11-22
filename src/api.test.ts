import { test } from 'node:test';
import assert from 'node:assert/strict';

// node --test 没有 window/localStorage：接入内存存根以验证缓存语义。
const memoryStorage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => void memoryStorage.set(key, value),
    removeItem: (key: string) => void memoryStorage.delete(key),
  },
};

import {
  buildListUrl,
  fetchCategories,
  fetchTopics,
  fetchTopic,
  setSiteSessionForTests,
  sessionFailureToApiError,
  splitRequestUrl,
} from './api.ts';
import {
  DECLARED_LITERAL_PATHS,
  DECLARED_PATTERN_PATHS,
  DECLARED_QUERY_KEYS,
  type JsonRequestResult,
} from './site-session.ts';

const envelope = (topics: Array<Record<string, unknown>> = []): unknown => ({
  topic_list: { topics, more_topics_url: topics.length ? '/latest.json?page=2' : undefined },
  users: [{ id: 1, username: 'u' }],
});

test('buildListUrl 产出的全部请求都落在声明的作用域内', () => {
  const urls = [
    buildListUrl('latest', {}),
    buildListUrl('latest', { page: 3 }),
    buildListUrl('hot', {}),
    buildListUrl('top', { period: 'weekly' }),
    buildListUrl('cat', { slug: 'develop', categoryId: 62 }),
    buildListUrl('cat', { slug: 'develop', categoryId: 62, page: 2 }),
  ];
  for (const url of urls) {
    const { path, query } = splitRequestUrl(url);
    const declared = (DECLARED_LITERAL_PATHS as ReadonlySet<string>).has(path)
      || DECLARED_PATTERN_PATHS.some((pattern) => pattern.test(path));
    assert.ok(declared, `${path} must be declared`);
    for (const key of Object.keys(query)) {
      assert.ok(DECLARED_QUERY_KEYS.has(key), `${key} must be a declared query key`);
    }
  }
  assert.equal(splitRequestUrl(`${'https://linux.do'}/t/42.json?page=2`).path, '/t/42.json');
});

test('会话失败结果映射为原有 UX 且不携带页面内容', () => {
  const blocked = sessionFailureToApiError({ ok: false, error: 'interaction_required', status: 403 });
  assert.equal(blocked.kind, 'blocked');
  assert.equal(blocked.detail, undefined);
  assert.equal(sessionFailureToApiError({ ok: false, error: 'http_error', status: 429 }).kind, 'rate');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'http_error', status: 404 }).kind, 'notfound');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'http_error', status: 500 }).kind, 'http');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'http_error' }).kind, 'http');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'permission_required' }).kind, 'permission');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'permission_denied' }).kind, 'permission');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'unsupported_platform' }).kind, 'unsupported');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'invalid_json' }).kind, 'parse');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'timeout' }).kind, 'network');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'response_too_large' }).kind, 'network');
  assert.equal(sessionFailureToApiError({ ok: false, error: 'session_unavailable' }).kind, 'network');
});

test('fetchTopics 映射列表、用户与分页；缓存命中不重复发起会话请求', async () => {
  let calls = 0;
  setSiteSessionForTests({
    async request(path, query) {
      calls += 1;
      assert.equal(path, '/latest.json');
      assert.deepEqual(query, { no_definitions: 'true', page: '1' });
      return { ok: true, status: 200, contentType: 'application/json', data: envelope([{ id: 7 }]) } as JsonRequestResult;
    },
    async requestAccess() { throw new Error('not used'); },
    async accessStatus() { throw new Error('not used'); },
    async open() { throw new Error('not used'); },
    async listGrants() { throw new Error('not used'); },
    async revoke() { throw new Error('not used'); },
  });
  const page = await fetchTopics('latest');
  assert.equal(page.topics.length, 1);
  assert.deepEqual(page.users, [{ id: 1, username: 'u' }]);
  assert.equal(page.hasMore, true);
  const again = await fetchTopics('latest');
  assert.equal(again.topics.length, 1);
  assert.equal(calls, 1, 'second read must hit the cache');

  const forced = await fetchTopics('latest', { force: true });
  assert.equal(forced.topics.length, 1);
  assert.equal(calls, 2, 'force bypasses the cache');
});

test('interaction_required 抛 blocked，429/404 保持原有 UX', async () => {
  const scripted: JsonRequestResult[] = [
    { ok: false, error: 'interaction_required', status: 403 },
    { ok: false, error: 'http_error', status: 429 },
    { ok: false, error: 'http_error', status: 404 },
    { ok: true, status: 200, contentType: 'application/json', data: { id: 9 } },
  ];
  setSiteSessionForTests({
    async request() {
      const result = scripted.shift();
      assert.ok(result, 'unexpected extra request');
      return result;
    },
    async requestAccess() { throw new Error('not used'); },
    async accessStatus() { throw new Error('not used'); },
    async open() { throw new Error('not used'); },
    async listGrants() { throw new Error('not used'); },
    async revoke() { throw new Error('not used'); },
  });
  await assert.rejects(() => fetchTopic(9), (error: { kind: string; detail?: string }) => {
    assert.equal(error.kind, 'blocked');
    assert.equal(error.detail, undefined);
    return true;
  });
  await assert.rejects(() => fetchTopic(9), (error: { kind: string }) => error.kind === 'rate');
  await assert.rejects(() => fetchTopic(9), (error: { kind: string }) => error.kind === 'notfound');
  const detail = await fetchTopic(9);
  assert.equal(detail.id, 9);
});

test('fetchCategories 过滤可见分类', async () => {
  setSiteSessionForTests({
    async request() {
      return {
        ok: true, status: 200, contentType: 'application/json',
        data: { category_list: { categories: [{ id: 1, name: 'A', permission: 1 }, { id: 2, name: 'B', read_restricted: true }] } },
      } as JsonRequestResult;
    },
    async requestAccess() { throw new Error('not used'); },
    async accessStatus() { throw new Error('not used'); },
    async open() { throw new Error('not used'); },
    async listGrants() { throw new Error('not used'); },
    async revoke() { throw new Error('not used'); },
  });
  const categories = await fetchCategories(true);
  assert.deepEqual(categories.map((category) => category.name), ['A']);
});
