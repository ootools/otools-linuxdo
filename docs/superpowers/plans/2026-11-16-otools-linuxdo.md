# otools-linuxdo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 独立 OTools 插件 otools-linuxdo：匿名只读浏览 linux.do（分类/最新/热门/精选/详情/回复 + 本地搜索），宿主 HTTP 通道 + cf_clearance 兜底档。

**Architecture:** 复刻 otools-v2ex 的三栏 Vue3 前端与工程底座（scripts/workflows/i18n/mock/theme 原样迁移），API 层按 Discourse JSON 契约重写；新增 clearance.ts（cookie+UA 存储、状态机）与 SettingsPanel.vue。请求全部走宿主 `otools_host_http_send`（rustls 指纹），被 CF 盾拦时引导用户粘贴浏览器 cookie。

**Tech Stack:** Vue 3.5.27 + TypeScript + Vite 6 + otools-plugin-sdk ^0.3.0（npm registry）+ node --test（仅 scripts）。

**Spec:** `docs/SPEC.md`（同仓，含接口契约实测样本 `.probe/`；本计划从它出发）。

## Global Constraints（全部任务隐含）

- 独立仓 `git@github.com:ootools/otools-linuxdo.git`；**禁止** import 宿主 `src/*`、`otools-plugin-vite-config-sdk`、宿主 vendor；直接在 `main` 开发，不开分支/worktree（otools/AGENTS.md）。
- deps 只允许：`vue 3.5.27`、`otools-plugin-sdk ^0.3.0`、devDeps 与 v2ex 完全同版本（`@types/node 22.19.8`、`@vitejs/plugin-vue 5.2.4`、`typescript 5.9.3`、`vite 6.4.1`、`vue-tsc 3.3.11`）。Node ≥ 22.18。
- `plugin.json`：uuid/packid `otools-linuxdo`，version `0.1.0`，`minOtoolsVersion "0.9.0"`，`devUrl http://127.0.0.1:6572`，`quickDev true`，`openMode panel`，panelWidth 1180 / panelHeight 800，entry `dist/index.html`，logo `logo.svg`。
- package.json scripts：dev 端口 **6572**（strictPort）、preview 端口 **6573**；其余命令名与 v2ex 相同。
- 红线：不抓网页 HTML、不自动求解 CF 盾、不做登录/写操作；cf_clearance 只由用户粘贴自己的浏览器 cookie。
- UA 默认值 = 写死的 Chrome stable 常量（`DEFAULT_UA`，实现期取当下 stable 串）；有覆写则全量替换 UA 头。
- 请求串行 + 300ms 间隔；缓存 TTL：分类 24h / latest 2min / hot·top 5min / 分类主题 3min / 详情 5min / 回复块 3min；localStorage 键前缀 `otools-linuxdo:`。
- i18n 8 语言文件齐全（zh-CN/en-US/ja-JP/ko-KR/de-DE/ru-RU/es-ES/ar-SA）；UI 无其他平台名、无外链按钮之外的外部引用。
- 匿名接口白名单（唯一允许的远端路径）：`categories.json`、`latest.json`、`hot.json`、`top.json`、`c/{slug}/{id}.json`、`t/{id}.json`、`t/{id}/posts.json`、头像图片 URL。
- `read_restricted=true` 的分类：侧栏灰显且**永不发起请求**。

## Review Focus（规格隐含但无任务测试覆盖的五个输入类）

1. **CF 盾判定**：部分边缘节点不给 `cf-mitigated` 头——判定须为「403 且 body 含 `Just a moment`/`请稍候`」的或逻辑。期望：进入设置引导而非裸报错。→ Task 3 步骤 3 的 `isChallengeBlocked` 单元逻辑以两条 mock 用例钉住（node --test 不适用 TS，改为 typecheck + mock 预览脚本自检）。
2. **tags 是对象数组** `{id,name,slug}`，不是 string[]（Discourse 通用习惯会写错）。期望：列表/详情直接渲染 `tag.name`。→ Task 3 types 钉死 `TopicTag` 接口，Task 6 UI 只读 `.name`，typecheck 兜底。
3. **头像两种形态**：`/user_avatar/…{size}….png` 与 `/letter_avatar_proxy/v4/letter/{ch}/{color}/{size}.png`，均相对路径。期望：`{size}`→96 替换 + 站内 origin 前缀，坏 URL 回退 letter 头。→ Task 6 LdAvatar 内 `resolveAvatar` 分支自检。
4. **clearance 失效循环**：cookie+UA 齐全仍 403 时，期望单次重试后停 blocked 态展示引导，**不得**无限重试打爆限流。→ Task 3 api 层重试上限 = 1。
5. **空分页**：`more_topics_url` 缺失 / posts 少于 chunk_size 时，期望隐藏「加载更多」且不报错。→ Task 6 TopicList/TopicDetail 空态分支 + mock 空页样例。

---

### Task 1: Spike —— 验证 rustls 指纹 + cf_clearance 能过盾

**Files:**
- Create: `../.spike-linuxdo-cf/`（仓外一次性 cargo 项目，**不提交**）

**Interfaces:**
- Produces: 结论 `PASS|FAIL`；PASS 时记录「必须随请求发送的头集合」与 `DEFAULT_UA` 实值，写入 Task 3 的 api.ts 常量。

- [ ] **Step 1: 取一枚测试 cf_clearance**
  在 IAB webview 的 linux.do 页面用 evaluate 读 `document.cookie`（cf_clearance 多为非 HttpOnly）。取不到 → 请用户从其浏览器 F12 复制 cf_clearance + navigator.userAgent 一对值。
- [ ] **Step 2: 建 cargo spike**
  `cargo new`，deps：`reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "gzip", "brotli", "deflate"] }`（与 `crates/ot-http-client/Cargo.toml` 完全一致），代理走 `https_proxy=http://127.0.0.1:7897` 环境变量。
- [ ] **Step 3: 跑四组对照**
  ① 无 cookie 无伪装 UA → 期望 403（对照）；② 无 cookie + Chrome UA → 期望 403；③ **cookie + 对应 UA → 期望 200 + JSON**；④ cookie + 默认 UA（不匹配）→ 记录实际行为。
- [ ] **Step 4: 判定**
  ③=200 → PASS，结论（含头集合）记入本计划末尾「Spike 结论」；③≠200 → **FAIL：停下回报用户改道，不得继续 Task 2+**。
- [ ] **Step 5: 清理**
  spike 项目留在仓外，`rm -rf` 或明确标注废弃；不进任何 commit。

### Task 2: 仓库脚手架（v2ex 底座平移）

**Files:**
- Create: `package.json`（name/description 改 linuxdo，dev 6572 / preview 6573，其余 scripts 原样）、`plugin.json`（约束见 Global Constraints；summary/key 词按 Discourse 语境）、`vite.config.ts`、`tsconfig.json`、`index.html`、`logo.svg`（原创：暗圆底 + 白 L + 青色 #32c3c3 点缀）、`THIRD_PARTY_NOTICES.md`
- Copy（不改）: `scripts/`（7 个 .mjs + 2 个 .test.mjs）、`.github/workflows/release-plugin.yml`（拷后 grep `v2ex` 改 `linuxdo`）、`.gitignore`（已有）

**Interfaces:**
- Produces: 可安装可构建的空壳；`plugin.json` 的 uuid/packid 供 scripts 打包读取。

- [ ] **Step 1:** 从 `../otools-v2ex/` 拷贝上列文件；改 package.json/plugin.json/workflow 的标识与端口；`logo.svg` 手写原创。
- [ ] **Step 2:** `npm install`，成功生成 lockfile（npm，不用 pnpm）。
- [ ] **Step 3:** 建 `src/main.ts` + `src/App.vue` 最小桩（App 暂只渲标题），`npm run typecheck` → PASS，`npm run build` → dist/ 产出。
- [ ] **Step 4:** `npm run verify` → 校验通过（.oplg 尚无，verify 针对已打包产物时先跳过，改为 `npm run pack` 一次成功）。
- [ ] **Step 5:** Commit：`feat: scaffold otools-linuxdo from v2ex baseline`。

### Task 3: 类型 + API 客户端 + clearance 状态机

**Files:**
- Create: `src/types.ts`、`src/api.ts`、`src/clearance.ts`、`src/cache.ts`
- Modify: 无（全新）

**Interfaces:**
- Consumes: `otools-plugin-sdk/runtime` 的 `invoke/isOtoolsPluginRuntime`（v2ex 同款）；Task 1 的头集合与 `DEFAULT_UA`。
- Produces（后续任务只按这些签名用）:
  - `types.ts`: `interface Category { id:number; name:string; slug:string; color:string; text_color:string; emoji?:string; description_excerpt?:string; topic_count:number; read_restricted:boolean; subcategory_ids?:number[] }`；`interface TopicTag { id:number; name:string; slug:string }`；`interface Topic { id:number; title:string; slug:string; posts_count:number; reply_count:number; like_count?:number; op_like_count?:number; views:number; created_at:string; last_posted_at?:string; category_id:number; tags:TopicTag[]; closed?:boolean; pinned?:boolean; has_accepted_answer?:boolean; posters?:TopicPoster[] }`；`interface TopicPoster { user_id:number; description?:string }`；`interface DiscourseUser { id:number; username:string; name?:string; avatar_template:string; flair_name?:string; flair_url?:string; flair_bg_color?:string }`；`interface Post { id:number; username:string; name?:string; avatar_template:string; created_at:string; cooked:string; post_number:number; reply_to_post_number?:number|null; reads?:number; reactions?:PostReaction[]; trust_level?:number; wiki?:boolean; accepted_answer?:boolean; user_signature?:string }`；`interface PostReaction { id:string; count:number }`；`interface TopicDetail { id:number; title:string; slug:string; posts_count:number; category_id:number; like_count?:number; views:number; created_at:string; tags:TopicTag[]; closed?:boolean; post_stream:{ posts:Post[]; stream:number[] }; details?:{ participants?:DiscourseUser[] }; suggested_topics?:{ topics?:Topic[] } }`；`interface TopicListEnvelope { users?:DiscourseUser[]; topic_list:{ topics:Topic[]; more_topics_url?:string; per_page?:number } }`
  - `clearance.ts`: `export type ClearanceState = "idle"|"blocked"|"testing"|"ok"`；`export function getClearance(): { cookie:string; ua:string }`（localStorage `otools-linuxdo:clearance`，缺失返空串）；`export function setClearance(cookie:string, ua:string): void`；`export function clearClearance(): void`；`export const clearanceState: Ref<ClearanceState>`
  - `api.ts`: `export const DEFAULT_UA: string`；`export class LinuxdoApiError extends Error { kind:"network"|"rate"|"blocked"|"notfound"|"http"|"parse"; status?:number }`；`export function fetchCategories(force?:boolean): Promise<Category[]>`（过滤 read_restricted）；`export type ListKind = "latest"|"hot"|"top"|"cat"`；`export type TopPeriod = "daily"|"weekly"|"monthly"|"quarterly"|"yearly"|"all"`；`export function fetchTopics(kind:ListKind, opts?:{ categoryId?:number; slug?:string; page?:number; period?:TopPeriod; force?:boolean }): Promise<{ topics:Topic[]; users:DiscourseUser[]; hasMore:boolean }>`（kind="top" 时 `top.json?period=${period??"daily"}`；kind="cat" 时 `c/{slug}/{id}.json?page=N`）；`export function fetchTopic(id:number, page?:number, force?:boolean): Promise<TopicDetail>`；`export function resolveAvatarUrl(template:string, size?:number): string`（`{size}`→`size??96`，相对路径补 `https://linux.do`）；`export function testConnection(): Promise<{ ok:boolean; blocked:boolean; status:number }>`（请求 latest.json，供设置面板按钮）
- `cache.ts` 从 v2ex 拷贝，键前缀改 `otools-linuxdo:`。

- [ ] **Step 1:** 写 `types.ts`（签名如上，字段可多不可少）与 `cache.ts` 平移。
- [ ] **Step 2:** 写 `clearance.ts`：localStorage 存取 + `clearanceState` ref；签名如上。
- [ ] **Step 3:** 写 `api.ts`：串行队列 + 300ms 节流 + TTL 表 + host http（headers：`Accept: application/json`、`User-Agent: 覆写或 DEFAULT_UA`、cookie 非空时追加 `Cookie: cf_clearance=<v>`）；**盾判定** = `status===403 && (headers["cf-mitigated"]==="challenge" || body 含 "Just a moment" || body 含 "请稍候")` → 抛 `LinuxdoApiError("blocked")` 并置 `clearanceState="blocked"`；重试上限 1 次且仅当请求失败原因为 network。mock 分支（`?mock=1`）沿用 v2ex 模式。
- [ ] **Step 4:** `npm run typecheck` → PASS。
- [ ] **Step 5:** Commit：`feat: discourse api client + clearance fallback state machine`。

### Task 4: i18n / format / links / theme / styles / index.html

**Files:**
- Create: `i18n/{zh-CN,en-US,ja-JP,ko-KR,de-DE,ru-RU,es-ES,ar-SA}.json`、`src/i18n.ts`、`src/format.ts`、`src/links.ts`、`src/theme.ts`、`src/styles.css`
- Modify: `index.html`（lang/title）

**Interfaces:**
- Consumes: Task 3 的错误 kind（文案键含 `error.blocked` 引导）。
- Produces: `t(key)` 函数、`formatRelativeTime`、`sanitizeHtml`（白名单清洗，站内 `/t/{id}`、`/u/{user}` 链接改站内跳转）、`styles.css` 令牌（`--ld-accent`，`html.dark` 暗色）。

- [ ] **Step 1:** v2ex 四件平移：`i18n.ts`/`format.ts`/`theme.ts`/`styles.css`，改前缀 `v2-`→`ld-`、accent 色换 `#32c3c3` 系。
- [ ] **Step 2:** `links.ts`：白名单清洗照搬 v2ex，站内链接正则改 `/^\/t\/topic\/(\d+)/` 与 `/^\/u\//`。
- [ ] **Step 3:** 8 语言 JSON：键结构随 v2ex 增删（删登录/提醒相关键，增 `settings.*`（clearance 引导、测试连接、UA 覆写说明）、`list.top`、`error.blocked`）。zh-CN 与 en-US 人工写准，其余 6 语按 v2ex 语气平移。
- [ ] **Step 4:** `npm run typecheck` → PASS。
- [ ] **Step 5:** Commit：`feat: i18n(8 langs), formatting, sanitizer, theme tokens`。

### Task 5: mock 数据

**Files:**
- Create: `src/mock/data.ts`

**Interfaces:**
- Consumes: Task 3 的 URL 形状（`resolveMock(url)` 的匹配键）；`.probe/*.json` 原始样本。
- Produces: `resolveMock(url, ctx): { status:number; body:string } | null`（v2ex 同签名）。

- [ ] **Step 1:** 以 `.probe/` 样本为底裁剪：latest 30→12 条、hot 8 条、top 8 条、categories 全 12 条、1 个主题详情（posts 裁 5 楼，cooked 换短 HTML）、1 个空分页样例（`more_topics_url` 缺失）、tags 全部用对象数组、用户头像两种形态各留一例。真人内容只保留标题与用户名（公开数据），cooked 正文一律替换为编写的占位 HTML。
- [ ] **Step 2:** `npm run dev` 起 6572，浏览器开 `http://127.0.0.1:6572/?mock=1`，确认无 JS 错误（此刻 UI 还是桩，只验证 mock 可加载）。
- [ ] **Step 3:** `npm run typecheck` → PASS。
- [ ] **Step 4:** Commit：`feat: mock dataset from probed linux.do samples`。

### Task 6: UI 组件与装配

**Files:**
- Create: `src/App.vue`（重写桩）、`src/components/{CategorySidebar,TopicList,TopicDetail,LdAvatar,SettingsPanel,AppIcon}.vue`
- Modify: `src/main.ts`（挂载 i18n/theme）

**Interfaces:**
- Consumes: Task 3 全部 exports、Task 4 的 `t/sanitizeHtml/formatRelativeTime`、Task 5 mock。
- Produces: 三栏装配完成、mock 模式可完整走通的插件 UI。组件 props：`CategorySidebar(props:{ categories:Category[]; activeKind:ListKind; activeCategoryId?:number; filter:string })`，`TopicList(props:{ topics:Topic[]; users:DiscourseUser[]; hasMore:boolean; loading:boolean })`，`TopicDetail(props:{ topicId:number })`，`SettingsPanel(props:{ open:boolean })`（emit close）。事件走 App 层简单 ref 路由（无 vue-router，沿用 v2ex 模式）。

- [ ] **Step 1:** `LdAvatar.vue`：`resolveAvatarUrl` 两分支 + onerror 回退 letter 头；`AppIcon.vue` 平移。
- [ ] **Step 2:** `CategorySidebar.vue`：最新/热门/精选（period 六档切换器，默认 daily）入口、分类列表（色块+emoji+计数）、`read_restricted` 灰显禁点、本地过滤框（分类名 + 已加载主题标题）。
- [ ] **Step 3:** `TopicList.vue`：分类徽章（`categories` 色映射）、作者（posters→users join）、相对时间、reactions 数（列表级用 `like_count??op_like_count`）、已采纳角标、`hasMore` 控制「加载更多」、空态与错误态（blocked 错误态显示「去设置」按钮）。
- [ ] **Step 4:** `TopicDetail.vue`：楼 1 主贴 + `cooked` 经 `sanitizeHtml` 渲染、楼层 `reactions` emoji 文本化渲染、`reply_to_post_number` 引用标记、回复分页（`fetchTopic(id, page)`，少于 chunk_size 隐藏加载更多）、`details.participants` 头像条、`suggested_topics` 列表、「复制链接 / 系统浏览器打开」（`otools-plugin-sdk` 的 `openExternal`）。
- [ ] **Step 5:** `SettingsPanel.vue`：cf_clearance 输入、UA 覆写输入（placeholder 显示 DEFAULT_UA）、「测试连接」按钮调 `testConnection` 并显示 ok/blocked/HTTP 码、清缓存按钮、数据源与红线说明文案。
- [ ] **Step 6:** `App.vue` 装配：顶栏（标题/搜索框/设置齿轮）+ 三栏；`?mock=1&topic=<id>` 直达详情；窄面板 <700px 侧栏变抽屉（v2ex 同法）。
- [ ] **Step 7:** `npm run dev` + `?mock=1` 人工走查六条路径（列表→详情→翻页→相关主题→设置面板→blocked 引导用 mock 的 403 样例触发）；`npm run typecheck` 与 `npm run build` → PASS。
- [ ] **Step 8:** Commit：`feat: full UI assembly (sidebar/list/detail/settings)`。

### Task 7: 打包、文档与自检

**Files:**
- Create: `README.md`（v2ex 结构：功能/登录红线改为公开接口说明/开发/打包/发布/主题）、`docs/MOCK.md` 可并入 README
- Modify: `THIRD_PARTY_NOTICES.md`（如 sdk 许可变化）

**Interfaces:**
- Consumes: 全部前序产物。

- [ ] **Step 1:** `npm run test`（scripts 的 2 个 .test.mjs）→ PASS。
- [ ] **Step 2:** `npm run pack` → `dist-pack/otools-linuxdo-0.1.0.oplg` + SHA256SUMS；`npm run verify` → PASS。
- [ ] **Step 3:** 写 README.md：明确「匿名只读；CF 盾被拦时用你自己浏览器的 cf_clearance 自救；不登录不发帖」。
- [ ] **Step 4:** Commit：`feat: packaging verified, docs`。

### Task 8: 发布远端仓

**Files:**
- 无新文件；远端动作。

- [ ] **Step 1:** `gh repo create ootools/otools-linuxdo --public --source . --remote origin --push`（用户已授权；权限不足则停下回报）。
- [ ] **Step 2:** xyito 超仓 `git submodule add git@github.com:ootools/otools-linuxdo.git otools/otools-linuxdo`（**只登记不提交指针**，AGENTS.md 约定）。
- [ ] **Step 3:** 回报：仓库 URL、commit 列表、spike 结论、待用户终验清单（宿主里加载 dev 插件 / 填 cookie / 测试连接）。

---

## Spike 结论

（Task 1 完成后回填：PASS/FAIL、可行头集合、DEFAULT_UA 实值、四组对照结果。）
