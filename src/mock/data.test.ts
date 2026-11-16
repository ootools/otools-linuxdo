import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMock } from './data.ts';

const ORIGIN = 'https://linux.do';

test('mock: latest 返回信封（users + topics + tags 对象数组）且无 more_topics_url', () => {
  const res = resolveMock(`${ORIGIN}/latest.json?no_definitions=true&page=0`);
  assert.ok(res && res.status === 200);
  const data = JSON.parse(res.body);
  assert.equal(data.topic_list.topics.length, 12);
  assert.ok(Array.isArray(data.users) && data.users.length > 0);
  assert.equal(data.topic_list.more_topics_url, undefined);
  const withTags = data.topic_list.topics.find((t: { tags: unknown[] }) => Array.isArray(t.tags) && t.tags.length > 0);
  assert.ok(withTags);
  assert.equal(typeof withTags.tags[0].name, 'string');
});

test('mock: latest 第 2 页为空列表（空分页样例）', () => {
  const res = resolveMock(`${ORIGIN}/latest.json?no_definitions=true&page=2`);
  const data = JSON.parse(res!.body);
  assert.deepEqual(data.topic_list.topics, []);
  assert.equal(data.topic_list.more_topics_url, undefined);
});

test('mock: hot / top / categories 均可解析', () => {
  const hot = resolveMock(`${ORIGIN}/hot.json`);
  assert.equal(JSON.parse(hot!.body).topic_list.topics.length, 8);
  const top = resolveMock(`${ORIGIN}/top.json?period=daily`);
  assert.equal(JSON.parse(top!.body).topic_list.topics.length, 8);
  const cats = resolveMock(`${ORIGIN}/categories.json`);
  const parsed = JSON.parse(cats!.body);
  assert.equal(parsed.category_list.categories.length, 12);
});

test('mock: 详情第 1 页 5 楼、第 2 页 2 楼、stream 覆盖全部楼层', () => {
  const page1 = JSON.parse(resolveMock(`${ORIGIN}/t/3187153.json`)!.body);
  assert.equal(page1.post_stream.posts.length, 5);
  assert.equal(page1.post_stream.stream.length, 7);
  const page2 = JSON.parse(resolveMock(`${ORIGIN}/t/3187153.json?page=2`)!.body);
  assert.equal(page2.post_stream.posts.length, 2);
  assert.equal(page2.post_stream.posts[0].post_number, 6);
  const accepted = page1.post_stream.posts.find((p: { accepted_answer?: boolean }) => p.accepted_answer);
  assert.ok(accepted);
});

test('mock: 未知主题 404；未知路径返回 null', () => {
  assert.equal(resolveMock(`${ORIGIN}/t/999999.json`)!.status, 404);
  assert.equal(resolveMock(`${ORIGIN}/u/neo.json`), null);
});
