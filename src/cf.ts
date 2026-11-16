/**
 * Cloudflare 静默盾判定。
 *
 * linux.do 对非浏览器请求返回 403 质询页；部分边缘节点不带
 * `cf-mitigated: challenge` 头，所以用「头 或 body 特征」的或逻辑兜底
 * （SPEC「Cloudflare 挡板判定」）。
 */
export function isChallengeBlocked(status: number, cfMitigated: string | undefined, bodyHead: string): boolean {
  if (status !== 403) return false;
  if (cfMitigated === 'challenge') return true;
  return bodyHead.includes('Just a moment') || bodyHead.includes('请稍候');
}
