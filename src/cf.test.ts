import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChallengeBlocked } from './cf.ts';

test('403 + cf-mitigated: challenge 头 → 判定为盾拦截', () => {
  assert.equal(isChallengeBlocked(403, 'challenge', ''), true);
});

test('403 + 无头但 body 含 Just a moment → 判定为盾拦截', () => {
  assert.equal(isChallengeBlocked(403, undefined, '<html><title>Just a moment...</title>'), true);
});

test('403 + 无头但 body 含中文「请稍候」→ 判定为盾拦截', () => {
  assert.equal(isChallengeBlocked(403, '', '<html><title>请稍候…</title>'), true);
});

test('非 403 状态码永不判为盾拦截', () => {
  assert.equal(isChallengeBlocked(429, 'challenge', 'Just a moment'), false);
  assert.equal(isChallengeBlocked(200, '', ''), false);
  assert.equal(isChallengeBlocked(502, 'challenge', 'x'), false);
});

test('403 但既无头也无盾特征 body → 不判为盾（走普通 http 错误）', () => {
  assert.equal(isChallengeBlocked(403, '', '{"errors":["permission denied"]}'), false);
});
