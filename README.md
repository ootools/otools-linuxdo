# LINUXDO

OTools 的 linux.do 浏览插件（独立仓库，与宿主 `OTools` 仓平级）：左侧分类、右侧主题列表，点击进入正文与回复。

- 数据源：linux.do 公开 Discourse JSON 接口（`latest.json` / `hot.json` / `top.json` / `categories.json` / `c/{slug}/{id}.json` / `t/{id}.json`），不抓取网页、不注入脚本。
- **匿名只读**：不登录、不发帖、不回复、不点赞——linux.do 没有开放的普通用户 API Key，本插件不触碰账号。
- 纯前端：没有 native cdylib，网络请求走宿主 `otools_host_http_send`（linux.do 不返回 CORS 头）。
- `?mock=1` 离线预览（内置过盾样本裁剪数据）；`?mock=1&topic=3187153` 直达示例详情；`?mock=1&blocked=1` 演示盾拦截引导。

## Cloudflare 盾与自救

linux.do 站方对所有非浏览器请求挂了 Cloudflare 静默质询（403 `cf-mitigated: challenge`）。
宿主 HTTP 通道（reqwest + rustls 指纹）直连会被拦（2026-11-16 实测）。

插件的兜底：被拦时设置面板引导用户粘贴**自己浏览器**的凭证——

1. 用平时看 linux.do 的浏览器过一次盾；
2. F12 → Application → Cookies → 复制 `cf_clearance`；
3. F12 → Console 运行 `navigator.userAgent` 复制整串；
4. 两个值**成对**粘进插件设置并保存。

Cloudflare 把 clearance 绑定到精确 UA 字符串与出口 IP（spike 实测：cookie + 匹配 UA → 200，cookie + 错配 UA → 403）。
cookie 失效（过期 / 换网 / 浏览器升级）时重复以上步骤即可；凭证只存本机 webview localStorage，可随时清除。

## 功能

- 左侧分类栏：最新 / 热门 / 精选（六档周期）入口、分类列表（色块 + emoji + 主题数）、受限分类灰显禁点、本地过滤。
- 右侧主题列表：分类徽章、作者、相对时间、标签、反应数、回复数；顶部搜索框同时过滤分类与当前列表。
- 详情页：正文与回复 HTML 经白名单清洗后渲染，emoji 反应条、采纳答案角标、回复引用标记、参与者头像、相关主题；回复按 Discourse chunk 分页（20/页）。
- 外部动作：复制原帖链接、在系统浏览器打开原帖。
- 缓存：分类 24h，列表 2–5min，详情 5min，回复分页块 3min；请求串行并保持 300ms 间隔。
- 窄面板（宽度 < 700px）下分类栏自动变抽屉。
- i18n 8 语言（zh-CN / en-US / ja-JP / ko-KR / de-DE / ru-RU / es-ES / ar-SA）。

## 仓库结构

```
src/             Vue 3 + TS 前端（组件、API 客户端、i18n、主题令牌）
i18n/            8 语言文案
scripts/         pack-plugin.mjs（手写 ZIP → .oplg）、verify-plugin.mjs、serve-dist.mjs、发布脚本
plugin.json      插件清单（宿主读它，entry 指向 dist/index.html）
docs/SPEC.md     设计文档（接口契约实测 + CF 兜底方案）
docs/superpowers/plans/   实施计划与 spike 结论
```

## 开发

```bash
npm install
npm run dev          # http://127.0.0.1:6572（devUrl 端口 6572）
npm run typecheck
npm run test         # 发布脚本回归测试
npm run test:src     # src 单元测试（node --test --experimental-strip-types）
npm run build        # vue-tsc + vite build → dist/
npm run preview      # 静态托管 dist/（6573）
```

本地没有宿主运行时（或需要离线预览）时，访问 `?mock=1` 使用内置示例数据。

## 打包与校验

```bash
npm run pack         # dist-pack/otools-linuxdo-<version>.oplg + SHA256SUMS + meta.json
npm run verify       # 校验 ZIP 结构、CRC、entry、logo.svg、摘要清单
```

`.oplg` 是扁平 ZIP（`plugin.json` / `logo.svg` / `dist/**`），宿主插件仓库的「本地安装」可直接装。

## 发布

版本标签触发 `.github/workflows/release-plugin.yml`：

```bash
git tag -a v0.1.1 -m "LINUXDO 插件 v0.1.1" && git push origin v0.1.1
```

- `v<版本>` 与 `plugin.json` 的 `version` 必须一致，否则 `publish-market.mjs meta` 直接失败。
- 仓库变量 `OTOOLS_PUBLISH_MARKET=true` 时同步上架插件市场（默认 `false`：只发 GitHub Release）。
- 补发市场：Actions → release-plugin → `publish_market=true`、`dry_run=false`，`release_tag` 填已推的 `v<版本>`。
- 纯前端、无平台相关产物 → 单合包（`packageMode=0` + `packageUrl`），不产出六平台分包。

## 主题

插件 webview 不加载宿主样式表，颜色令牌由 `src/styles.css` 自持：`html.dark` 切换暗色，`--ld-accent`
由 `src/theme.ts` 按宿主强调色档位写入（优先 `window.__OTOOLS_THEME__`，其次本地缓存，最后跟随系统）。
不依赖 Element Plus 的 css-vars。
