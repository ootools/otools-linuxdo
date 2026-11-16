import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absoluteUrl, parseTopicIdFromHref, truncate } from './format.ts';

test('linux.do 站内相对链接补全为绝对 URL', () => {
  assert.equal(absoluteUrl('/t/topic/3187153'), 'https://linux.do/t/topic/3187153');
  assert.equal(absoluteUrl('/u/neo'), 'https://linux.do/u/neo');
});

test('协议相对与绝对 URL 原样通过', () => {
  assert.equal(absoluteUrl('//linux.do/t/topic/1'), 'https://linux.do/t/topic/1');
  assert.equal(absoluteUrl('https://example.com/a'), 'https://example.com/a');
});

test('解析 /t/{slug}/{id} 与 /t/topic/{id} 两种主题链接', () => {
  assert.equal(parseTopicIdFromHref('https://linux.do/t/topic/3187153'), 3187153);
  assert.equal(parseTopicIdFromHref('https://linux.do/t/some-slug/123456'), 123456);
  assert.equal(parseTopicIdFromHref('https://linux.do/t/3153778'), 3153778);
  assert.equal(parseTopicIdFromHref('/t/topic/99'), 99);
});

test('非主题链接返回 null', () => {
  assert.equal(parseTopicIdFromHref('https://linux.do/u/neo'), null);
  assert.equal(parseTopicIdFromHref('https://example.com/t/1'), null);
  assert.equal(parseTopicIdFromHref(''), null);
});

test('truncate 截断加省略号', () => {
  assert.equal(truncate('abc', 5), 'abc');
  assert.equal(truncate('abcdefg', 5), 'abcde…');
});
