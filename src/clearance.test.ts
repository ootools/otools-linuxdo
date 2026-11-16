import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getClearance, setClearance, clearClearance, clearanceState, markBlocked } from './clearance.ts';

test('无存储值时返回空对且状态 idle', () => {
  clearClearance();
  assert.deepEqual(getClearance(), { cookie: '', ua: '' });
  assert.equal(clearanceState.value, 'idle');
});

test('setClearance 成对保存并置 ok', () => {
  setClearance('CKT_abc', 'Mozilla/5.0 Chrome/157.0.0.0 Safari/537.36');
  assert.deepEqual(getClearance(), {
    cookie: 'CKT_abc',
    ua: 'Mozilla/5.0 Chrome/157.0.0.0 Safari/537.36',
  });
  assert.equal(clearanceState.value, 'ok');
});

test('markBlocked 置 blocked；重新 setClearance 恢复 ok', () => {
  setClearance('CKT_abc', 'ua');
  markBlocked();
  assert.equal(clearanceState.value, 'blocked');
  setClearance('CKT_abc', 'ua');
  assert.equal(clearanceState.value, 'ok');
});

test('clearClearance 清空并回 idle', () => {
  setClearance('CKT_abc', 'ua');
  clearClearance();
  assert.deepEqual(getClearance(), { cookie: '', ua: '' });
  assert.equal(clearanceState.value, 'idle');
});

test('setClearance 空串等价于清除', () => {
  setClearance('', '');
  assert.deepEqual(getClearance(), { cookie: '', ua: '' });
  assert.equal(clearanceState.value, 'idle');
});
