import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHasMore, filterVisibleCategories } from './filters.ts';
import type { Category, ListKind } from './types.ts';

const category = (overrides: Partial<Category>): Category => ({
  id: 1,
  name: '开发调优',
  slug: 'develop',
  color: '32c3c3',
  text_color: '000000',
  topic_count: 100,
  read_restricted: false,
  ...overrides,
});

test('permission:null 的公开分类必须保留（.probe 实测：全部 12 个匿名分类都是 null）', () => {
  const categories = [category({ permission: null as unknown as number }), category({ id: 2, name: '搞七捻三', slug: 'gossip' })];
  const kept = filterVisibleCategories(categories);
  assert.equal(kept.length, 2);
});

test('read_restricted 分类被过滤，不进侧栏', () => {
  const kept = filterVisibleCategories([
    category({ read_restricted: true }),
    category({ id: 3, name: '资源荟萃', slug: 'resource' }),
  ]);
  assert.deepEqual(kept.map((item) => item.id), [3]);
});

test('permission:1 保留、permission:2 过滤（数字权限仅 1 为完全公开）', () => {
  const kept = filterVisibleCategories([
    category({ permission: 1 }),
    category({ id: 4, name: '受限', slug: 'locked', permission: 2 }),
  ]);
  assert.deepEqual(kept.map((item) => item.id), [1]);
});

test('computeHasMore：latest/cat 由 more_topics_url 决定', () => {
  assert.equal(computeHasMore('latest', '/latest?no_definitions=true&page=1'), true);
  assert.equal(computeHasMore('cat', undefined), false);
  assert.equal(computeHasMore('cat', '/c/develop/4?page=1'), true);
});

test('computeHasMore：hot/top 恒为 false（分页参数不被 Discourse 支持恒翻到第一页）', () => {
  assert.equal(computeHasMore('hot', '/hot?page=1'), false);
  assert.equal(computeHasMore('top', '/top?page=1&per_page=50&period=daily'), false);
  assert.equal(computeHasMore('top', undefined), false);
});

test('computeHasMore 的 kind 参数与 ListKind 对齐', () => {
  const kinds: ListKind[] = ['latest', 'hot', 'top', 'cat'];
  for (const kind of kinds) computeHasMore(kind, undefined);
});
