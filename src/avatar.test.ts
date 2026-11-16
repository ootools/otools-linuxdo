import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAvatarUrl } from './avatar.ts';

test('user_avatar 相对模板：替换 {size} 并补站内 origin', () => {
  assert.equal(
    resolveAvatarUrl('/user_avatar/linux.do/bobox/{size}/2082940_2.png', 240),
    'https://linux.do/user_avatar/linux.do/bobox/240/2082940_2.png',
  );
});

test('letter_avatar 相对模板：同样处理', () => {
  assert.equal(
    resolveAvatarUrl('/letter_avatar_proxy/v4/letter/b/32c3c3/{size}/2.png'),
    'https://linux.do/letter_avatar_proxy/v4/letter/b/32c3c3/96/2.png',
  );
});

test('缺省 size 为 96', () => {
  assert.equal(
    resolveAvatarUrl('/user_avatar/linux.do/neo/{size}/136369_2.png'),
    'https://linux.do/user_avatar/linux.do/neo/96/136369_2.png',
  );
});

test('绝对 URL 原样返回（仅替换 {size}）', () => {
  assert.equal(
    resolveAvatarUrl('https://cdn.example.com/avatar/{size}/x.png', 48),
    'https://cdn.example.com/avatar/48/x.png',
  );
});

test('空模板返回空串（交由组件回退）', () => {
  assert.equal(resolveAvatarUrl(''), '');
});

test('缺斜杠的相对路径自动补 /', () => {
  assert.equal(
    resolveAvatarUrl('user_avatar/linux.do/x/{size}/1.png', 48),
    'https://linux.do/user_avatar/linux.do/x/48/1.png',
  );
});
