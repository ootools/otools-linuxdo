import { ref } from 'vue';

/**
 * cf_clearance 兜底档的本地存储与状态。
 *
 * cookie 只来自用户自己的浏览器（设置面板成对录入 cookie + UA），存 webview
 * 自己的 localStorage，仅本机，可随时清除；插件不做任何盾的自动求解（SPEC 红线）。
 */

export type ClearanceState = 'idle' | 'blocked' | 'testing' | 'ok';

export interface ClearancePair {
  cookie: string;
  ua: string;
}

const STORAGE_KEY = 'otools-linuxdo:clearance';

export const clearanceState = ref<ClearanceState>('idle');

interface MinimalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/* node --test 环境没有 localStorage，用内存表兜底，保证纯逻辑可单测。 */
const memoryStore = new Map<string, string>();
const fallbackStore: MinimalStore = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => void memoryStore.set(key, value),
  removeItem: (key) => void memoryStore.delete(key),
};

const store = (): MinimalStore => {
  try {
    return typeof globalThis.localStorage === 'undefined' ? fallbackStore : globalThis.localStorage;
  } catch {
    return fallbackStore;
  }
};

const normalize = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function getClearance(): ClearancePair {
  try {
    const raw = store().getItem(STORAGE_KEY);
    if (!raw) return { cookie: '', ua: '' };
    const parsed = JSON.parse(raw) as Partial<ClearancePair>;
    return { cookie: normalize(parsed.cookie), ua: normalize(parsed.ua) };
  } catch {
    return { cookie: '', ua: '' };
  }
}

export function setClearance(cookie: string, ua: string): void {
  const pair: ClearancePair = { cookie: normalize(cookie), ua: normalize(ua) };
  if (!pair.cookie) {
    clearClearance();
    return;
  }
  try {
    store().setItem(STORAGE_KEY, JSON.stringify(pair));
  } catch {
    // 存储不可用时仅保内存语义（getClearance 仍读不到，交给调用方提示）。
  }
  clearanceState.value = 'ok';
}

export function clearClearance(): void {
  try {
    store().removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  clearanceState.value = 'idle';
}

/** api 层检测到盾拦截时调用；下一次 setClearance 会恢复 ok。 */
export function markBlocked(): void {
  clearanceState.value = 'blocked';
}
