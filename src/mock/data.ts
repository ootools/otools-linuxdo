/**
 * mock 桩（Task 5 整体替换）。
 *
 * `?mock=1` 时 api 层会先来这里问一遍；桩恒返 null 表示「无 mock 数据」，
 * 让请求走真实网络分支，保证无 mock 时行为不变。
 */
export interface MockContext {
  method?: string;
}

export interface MockResponse {
  status: number;
  body: string;
}

export function resolveMock(_url: string, _ctx?: MockContext): MockResponse | null {
  return null;
}
