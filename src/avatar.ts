const SITE_ORIGIN = 'https://linux.do';

/**
 * Discourse 的 `avatar_template` 是相对路径且带 `{size}` 占位符，两种形态：
 * `/user_avatar/linux.do/{user}/{id}/{size}/{n}.png` 与
 * `/letter_avatar_proxy/v4/letter/{ch}/{color}/{size}.png`。
 */
export function resolveAvatarUrl(template: string, size = 96): string {
  if (!template) return '';
  const replaced = template.replace('{size}', String(size));
  if (/^https?:\/\//i.test(replaced)) return replaced;
  return SITE_ORIGIN + (replaced.startsWith('/') ? replaced : `/${replaced}`);
}
