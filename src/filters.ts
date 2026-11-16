import type { Category, ListKind } from './types';

/**
 * 匿名分类过滤。
 *
 * .probe（2026-11-16 过盾抓样）实测：匿名 categories.json 里所有公开分类的
 * `permission` 都是 `null`（键存在但无值），只有 read_restricted / 数字权限
 * 需要剔除 —— `permission == null` 必须按「未限制」处理，否则线上分类全灭
 * （终审 P0）。`permission === 1`（完全公开）与缺失/空值都保留。
 */
export function filterVisibleCategories(categories: Category[]): Category[] {
  return categories.filter(
    (category) => !category.read_restricted && (category.permission == null || category.permission === 1),
  );
}

/**
 * 列表是否还有下一页。
 *
 * latest / cat 的 URL 带 ?page=N，Discourse 支持翻页；hot / top 的分页参数
 * 不被接口支持（实测 more_topics_url 指回第一页），继续「加载更多」只会把
 * 第一页重复追加（终审 P1），因此恒为 false。
 */
export function computeHasMore(kind: ListKind, moreTopicsUrl: string | undefined): boolean {
  if (kind === 'hot' || kind === 'top') return false;
  return Boolean(moreTopicsUrl);
}
