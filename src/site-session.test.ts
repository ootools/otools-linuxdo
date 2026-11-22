import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDeclaredRequest,
  createLinuxdoSiteSession,
  SESSION_ID,
  SITE_ORIGIN,
  SiteSessionError,
  type JsonRequestResult,
} from './site-session.ts';

test('仅放行声明的六类路径与三个 query key', () => {
  for (const path of ['/categories.json', '/latest.json', '/hot.json', '/top.json']) {
    assertDeclaredRequest(path, {});
  }
  assertDeclaredRequest('/c/develop/62.json', { page: '2' });
  assertDeclaredRequest('/t/9150.json', {});
  for (const path of [
    '/admin.json',
    '//linux.do/latest.json',
    '/latest.json/../admin.json',
    '/c/a/b/c.json',
    '/t/1.json/extra',
    'https://evil.example/latest.json',
    '/latest.json%2F..',
    '/latest.json?x=1',
  ]) {
    assert.throws(() => assertDeclaredRequest(path, {}), SiteSessionError);
  }
  for (const key of ['period', 'page', 'no_definitions']) {
    assert.doesNotThrow(() => assertDeclaredRequest('/latest.json', { [key]: '1' }));
  }
  for (const key of ['q', 'callback', 'X-Filter']) {
    assert.throws(() => assertDeclaredRequest('/latest.json', { [key]: '1' }), SiteSessionError);
  }
});

test('adapter 只调用声明的会话命令且请求形状精确', async () => {
  const calls: Array<[string, unknown]> = [];
  const session = createLinuxdoSiteSession(async (command, payload) => {
    calls.push([command, payload]);
    if (command === 'otools_host_webview_session_request_access') {
      return { id: 'req-1', status: 'pending', expiresAt: 999 };
    }
    if (command === 'otools_host_webview_session_request') {
      return { ok: true, status: 200, contentType: 'application/json', data: { fixture: true } } satisfies JsonRequestResult;
    }
    if (command === 'otools_host_webview_session_list_grants') return [];
    return undefined;
  });
  const status = await session.requestAccess();
  assert.equal(status.status, 'pending');
  await session.accessStatus('req-1');
  const result = await session.request('/latest.json', { no_definitions: 'true', page: '2' });
  assert.equal(result.ok, true);
  await session.open();
  await session.listGrants();
  await session.revoke();
  assert.deepEqual(calls, [
    ['otools_host_webview_session_request_access', { request: { sessionId: SESSION_ID } }],
    ['otools_host_webview_session_access_status', { request: { id: 'req-1' } }],
    ['otools_host_webview_session_request', { request: { sessionId: SESSION_ID, path: '/latest.json', query: { no_definitions: 'true', page: '2' } } }],
    ['otools_host_webview_session_open', { request: { sessionId: SESSION_ID } }],
    ['otools_host_webview_session_list_grants', undefined],
    ['otools_host_webview_session_revoke', { request: { sessionId: SESSION_ID } }],
  ]);
  // 绝不发送 origin/method/headers/body 等字段。
  const requestPayload = calls[2][1] as { request: Record<string, unknown> };
  for (const forbidden of ['origin', 'method', 'headers', 'body', 'url']) {
    assert.ok(!(forbidden in requestPayload.request), `${forbidden} must never be sent`);
  }
});

test('未声明作用域在 invoke 之前即被拒绝', async () => {
  const calls: Array<[string, unknown]> = [];
  const session = createLinuxdoSiteSession(async (command, payload) => {
    calls.push([command, payload]);
    return undefined;
  });
  await assert.rejects(() => session.request('/admin.json', {}), SiteSessionError);
  await assert.rejects(() => session.request('/latest.json', { q: '1' }), SiteSessionError);
  assert.deepEqual(calls, []);
});

test('宿主错误归一化为有限枚举并识别旧版本宿主', async () => {
  const wire = (code: string): unknown => JSON.stringify({ code, message: 'm' });
  const session = createLinuxdoSiteSession(async () => {
    throw wire('interaction_required');
  });
  await assert.rejects(
    () => session.request('/latest.json', {}),
    (error: SiteSessionError) => error.code === 'interaction_required',
  );
  const legacy = createLinuxdoSiteSession(async () => {
    throw 'Command otools_host_webview_session_request not found';
  });
  await assert.rejects(
    () => legacy.request('/latest.json', {}),
    (error: SiteSessionError) => error.code === 'unsupported_host',
  );
  const forbidden = createLinuxdoSiteSession(async () => {
    throw JSON.stringify({ code: 'permission_denied', message: 'denied' });
  });
  await assert.rejects(
    () => forbidden.request('/latest.json', {}),
    (error: SiteSessionError) => error.code === 'permission_denied',
  );
  // 非结构化错误归为 session_unavailable。
  const opaque = createLinuxdoSiteSession(async () => {
    throw 'weird failure';
  });
  await assert.rejects(
    () => opaque.request('/latest.json', {}),
    (error: SiteSessionError) => error.code === 'session_unavailable',
  );
  assert.equal(SITE_ORIGIN, 'https://linux.do');
});
