import { invoke } from 'otools-plugin-sdk/runtime';

/**
 * linuxdo-public 站点会话的本地薄 adapter。
 *
 * 路径/query 白名单与 plugin.json `webviewSessions` 声明严格一致；adapter 在
 * 调用宿主命令前先行校验，绝不为未声明的作用域发起 invoke，也绝不发送
 * origin、method、headers 或 body（宿主协议不接受这些字段）。
 */

export const SESSION_ID = 'linuxdo-public';
export const SITE_ORIGIN = 'https://linux.do';

export const DECLARED_LITERAL_PATHS: ReadonlySet<string> = new Set([
  '/categories.json',
  '/latest.json',
  '/hot.json',
  '/top.json',
]);
/** /c/{slug}/{categoryId}.json 与 /t/{topicId}.json：变量恰好一个 path segment。 */
export const DECLARED_PATTERN_PATHS: ReadonlyArray<RegExp> = [
  /^\/c\/[^/]+\/[^/]+\.json$/,
  /^\/t\/[^/]+\.json$/,
];
export const DECLARED_QUERY_KEYS: ReadonlySet<string> = new Set(['no_definitions', 'page', 'period']);

export type SiteSessionErrorCode =
  | 'permission_required'
  | 'permission_denied'
  | 'interaction_required'
  | 'unsupported_platform'
  | 'timeout'
  | 'http_error'
  | 'invalid_json'
  | 'response_too_large'
  | 'session_unavailable';

const WIRE_CODES: ReadonlySet<string> = new Set([
  'permission_required',
  'permission_denied',
  'interaction_required',
  'unsupported_platform',
  'timeout',
  'http_error',
  'invalid_json',
  'response_too_large',
  'session_unavailable',
]);

export type JsonRequestResult = {
  ok: boolean;
  status?: number;
  contentType?: string;
  data?: unknown;
  error?: SiteSessionErrorCode;
};

export type SiteSessionAccessStatus = { id: string; status: string; expiresAt: number };

export type SiteSessionGrantSummary = {
  source: string;
  uuid: string;
  pluginName: string;
  sessionId: string;
  scopeHash: string;
  origin: string;
  displayName: string;
  status: string;
  approvedAt: number;
  revokedAt?: number;
};

/** unsupported_host 是 adapter 本地判定（宿主版本过旧/能力缺失），不在宿主固定枚举内。 */
export class SiteSessionError extends Error {
  readonly code: SiteSessionErrorCode | 'unsupported_host';

  constructor(code: SiteSessionErrorCode | 'unsupported_host', message: string) {
    super(message);
    this.name = 'SiteSessionError';
    this.code = code;
  }
}

export type InvokeFn = (command: string, payload?: Record<string, unknown>) => Promise<unknown>;

/** 仅允许声明的路径与 query key；绝对 URL、路径穿越与编码分隔符一律拒绝。 */
export function assertDeclaredRequest(path: string, query: Record<string, string>): void {
  const validPath =
    typeof path === 'string' &&
    path.length <= 512 &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !path.includes('..') &&
    !path.includes('%2f') &&
    !path.includes('%2F') &&
    ((DECLARED_LITERAL_PATHS as Set<string>).has(path) ||
      DECLARED_PATTERN_PATHS.some((pattern) => pattern.test(path)));
  if (!validPath) {
    throw new SiteSessionError('session_unavailable', 'request path is outside the declared scope');
  }
  for (const key of Object.keys(query)) {
    if (!DECLARED_QUERY_KEYS.has(key)) {
      throw new SiteSessionError('session_unavailable', 'query key is outside the declared scope');
    }
  }
}

function normalizeCommandError(error: unknown): SiteSessionError {
  let value = error;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      // 纯文本错误串按无结构处理。
    }
  }
  const record = value && typeof value === 'object' ? (value as { code?: unknown; message?: unknown }) : undefined;
  const message = typeof record?.message === 'string' ? record.message : String(error);
  if (typeof record?.code === 'string' && WIRE_CODES.has(record.code)) {
    return new SiteSessionError(record.code as SiteSessionErrorCode, message);
  }
  if (/unknown command|not allowed|not found|no enabled route/i.test(message)) {
    return new SiteSessionError('unsupported_host', message);
  }
  return new SiteSessionError('session_unavailable', message);
}

export interface LinuxdoSiteSession {
  requestAccess(): Promise<SiteSessionAccessStatus>;
  accessStatus(id: string): Promise<SiteSessionAccessStatus>;
  request(path: string, query?: Record<string, string>): Promise<JsonRequestResult>;
  open(): Promise<void>;
  listGrants(): Promise<SiteSessionGrantSummary[]>;
  revoke(): Promise<void>;
}

const COMMANDS = {
  requestAccess: 'otools_host_webview_session_request_access',
  accessStatus: 'otools_host_webview_session_access_status',
  request: 'otools_host_webview_session_request',
  open: 'otools_host_webview_session_open',
  listGrants: 'otools_host_webview_session_list_grants',
  revoke: 'otools_host_webview_session_revoke',
} as const;

export function createLinuxdoSiteSession(invokeFn: InvokeFn = invoke): LinuxdoSiteSession {
  const call = async <T>(command: string, request?: Record<string, unknown>): Promise<T> => {
    try {
      return (await invokeFn(command, request === undefined ? undefined : { request })) as T;
    } catch (error) {
      throw normalizeCommandError(error);
    }
  };
  return {
    async requestAccess() {
      return call<SiteSessionAccessStatus>(COMMANDS.requestAccess, { sessionId: SESSION_ID });
    },
    async accessStatus(id: string) {
      return call<SiteSessionAccessStatus>(COMMANDS.accessStatus, { id });
    },
    async request(path: string, query: Record<string, string> = {}) {
      assertDeclaredRequest(path, query);
      return call<JsonRequestResult>(COMMANDS.request, { sessionId: SESSION_ID, path, query });
    },
    async open() {
      await call(COMMANDS.open, { sessionId: SESSION_ID });
    },
    async listGrants() {
      return call<SiteSessionGrantSummary[]>(COMMANDS.listGrants);
    },
    async revoke() {
      await call(COMMANDS.revoke, { sessionId: SESSION_ID });
    },
  };
}
