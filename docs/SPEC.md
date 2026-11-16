# otools-linuxdo 设计文档（L 站浏览器）

> 状态：设计稿（待 builder check + 用户批准） · 2026-11-16
> 复刻对象：`xyito/otools/otools-v2ex`（已上架 v0.2.0，端口 6570）

## 一句话

独立 OTools 插件：左侧分类栏 / 右侧主题列表 / 点击进详情与回复，数据全部来自 linux.do 公开 Discourse JSON 接口，**匿名只读、不登录、不发帖**；被 Cloudflare 静默盾拦截时允许用户粘贴 `cf_clearance` 自救。

## 背景与为什么

- 用户（OTools 作者）指令：「复制 v2ex 插件，建一个 linuxdo 插件走公开接口」，方案 2 已拍板。
- linux.do 基于 **Discourse**（改版：点赞被 reactions/boosts 替换，post-voting 有 accepted_answer），匿名 JSON 接口与 V2EX 官方 API 同级可靠。
- **硬约束（2026-11-16 实测）**：linux.do 对一切非浏览器请求挂 Cloudflare 静默盾（403 + `cf-mitigated: challenge`）。宿主 HTTP 通道（reqwest 0.12 + rustls 指纹，`crates/ot-http-client`）大概率撞盾；真实 webview/浏览器可过。社区通行做法是携带浏览器过盾后签发的 `cf_clearance` cookie（绑定 UA + IP，会过期）。
- 宿主 HTTP 会读系统代理（macOS `scutil --proxy`），与用户浏览器同一出口 IP——IP 绑定天然满足，UA 绑定由设置面板解决。

## 目标 / 非目标 / 反目标

**目标**

1. 匿名浏览：分类树、最新/热门/精选列表、主题详情、回复分页、相关主题、本地搜索。
2. CF 兜底档：403 质询检测 → 设置面板引导粘贴 `cf_clearance` + 浏览器 UA（**成对必填**，CF 把 cookie 绑定到精确 UA 字符串，只给 cookie 大概率无效）→ 请求自动携带；失败统一提示。
3. 完整复用 v2ex 的工程底座：i18n 8 语言、mock 预览、主题自持、缓存/节流、打包校验、发布工作流。

**非目标（本期不做）**

- 登录 / 通知 / Personal API Key / User API Key 流程。
- 发帖、回复、点赞、收藏等一切写操作。
- 服务端搜索（匿名 `search.json` 返回 `not_logged_in`，实测被禁）——搜索为**本地过滤**（分类名 + 已加载主题标题）。

**反目标（红线）**

- 不抓网页 HTML、不注入脚本、不绕过 CF 盾本身（只携带用户自己浏览器合法获得的 cookie）。
- 不引入账号体系、不接触任何密码。
- 不做「全自动过盾」（Turnstile 求解器之类）。

## 已拍板的方案

三条路：① 纯复刻 v2ex（裸 reqwest 指纹直连）；② 复刻 + cf_clearance 兜底档；③ webview/iframe 直嵌（死于无 CORS 头 + `X-Frame-Options: SAMEORIGIN`，否）。**选 ②**：① 是 ② 的子集（默认行为完全一致），② 让插件「默认可用 + 被拦可自救」，代价是多一块设置 UI + cookie/UA 存储与失效检测。

## 接口契约（2026-11-16 用真实 Chrome 过盾抓样，样本存 `.probe/`）

Base：`https://linux.do`。全部 GET，走宿主 `otools_host_http_send`（linux.do 无 CORS 头，浏览器 fetch 不可用）。UA 伪装 Chrome；带 `cf_clearance` 时附 Cookie。

| 能力 | 端点 | 说明 |
| --- | --- | --- |
| 分类树 | `categories.json` | 返回 `{category_list:{categories:[…]}}`；匿名拿到 12 个顶层分类（无子分类）；渲染时过滤 `read_restricted`/`permission≠1`；用 `color` `text_color` `emoji` `description_excerpt` `topic_count` |
| 最新 | `latest.json?no_definitions=true&page=N` | `per_page=30`；`topic_list.more_topics_url` 判断还有下一页 |
| 热门 | `hot.json` | 同 latest 信封，无 period 参数 |
| 精选 | `top.json?period=daily` | period ∈ daily/weekly/monthly/quarterly/yearly/all |
| 分类主题 | `c/{slug}/{id}.json?page=N` | 信封同 latest |
| 主题详情 | `t/{id}.json?page=N` | `post_stream.posts`（每页 20，`chunk_size`）+ `stream`（全部楼层数组）+ `timeline_lookup` + `details.participants` + `suggested_topics`；页 1 拿主贴与元信息 |
| 回复续页 | `t/{id}.json?page=N`（或 `t/{id}/posts.json?post_ids[]=…`，实现期选稳定的那个） | — |
| 头像 | `avatar_template` 相对路径，`{size}` 替换为 96/240 | 两种形态：`/user_avatar/linux.do/{u}/{id}/{size}/{n}.png` 与 `/letter_avatar_proxy/v4/letter/{ch}/{color}/{size}.png`，都要接站内 origin |

**Topic 关键字段**：`id,title,slug,posts_count,reply_count,like_count,op_like_count,views,created_at,last_posted_at,category_id,tags（对象数组 {id,name,slug}，不是字符串数组！）,closed,pinned,bumped,has_accepted_answer,posters[{user_id,description,…}]`；作者信息经 `posters[].user_id` 连 `users[]`（`username,name,avatar_template,flair_*`）。

**Post 关键字段**：`username,name,avatar_template,created_at,cooked（服务端洗净 HTML，直接渲染）,post_number,reply_to_post_number,reads,reactions:[{id,count}]（emoji 表情，不是 like_count）,trust_level,flair_*,wiki,accepted_answer,user_signature`。linux.do 是 Discourse 改版：**没有 like_count 概念于楼层**，用 `reactions`；主题级 `like_count`/`op_like_count` 仍在。

**搜索**：匿名 `search.json` 返回 `{"errors":["您需要登录才能执行此操作。"],"error_type":"not_logged_in"}`（实测）——搜索框只做本地过滤。

**Cloudflare 挡板判定**：HTTP 403 且（响应头 `cf-mitigated: challenge` 或 body 含 `Just a moment` / `请稍候`）→ 进入兜底流程；429 → 限流提示；其余按 http 错误走。

## 架构

复刻 v2ex 的三栏布局与文件拓扑，**全部前端**（无 native、无宿主源码引用）：

```
otools-linuxdo/                 独立仓 git@github.com:ootools/otools-linuxdo.git
├── plugin.json                 uuid/packid: otools-linuxdo · devUrl http://127.0.0.1:6572（已扫全量端口，空闲）· 单合包
├── package.json                npm；deps: vue 3.5.x + otools-plugin-sdk ^0.3.0（registry 依赖，v2ex 同款）
├── vite.config.ts / tsconfig.json / index.html / logo.svg
├── scripts/                    pack-plugin.mjs / verify-plugin.mjs / serve-dist.mjs / platform-packages.mjs /
│                               publish-market.mjs(.test.mjs) / release-policy.mjs(.test.mjs) —— 从 v2ex 原样拷贝（已验证 0 处硬编码）
├── .github/workflows/release-plugin.yml        从 v2ex 拷贝
├── i18n/                       8 语言（zh-CN/en-US/ja-JP/ko-KR/de-DE/ru-RU/es-ES/ar-SA），键结构随 v2ex，按 Discourse 语境改词
└── src/
    ├── api.ts                  端点表 + host http + 序列化队列（180ms→300ms）+ 缓存 TTL + CF 挡板判定/兜底注入
    ├── clearance.ts            【新】cf_clearance + UA 覆写的存取（localStorage `otools-linuxdo:clearance`）与失效状态机
    ├── types.ts                Discourse 模型（Topic/Post/Category/User/…）
    ├── cache.ts / format.ts / links.ts / theme.ts / i18n.ts / main.ts   原样迁移（links.ts 站内链接正则改 /t/topic/{id}）
    ├── mock/data.ts            以 .probe/ 真实样本裁剪生成（不含真人帖全文，标题+结构保留）
    ├── styles.css              颜色令牌自持（--ld-accent），html.dark 暗色
    ├── App.vue                 顶栏（标题/搜索框/设置入口）+ 三栏路由
    └── components/
        ├── CategorySidebar.vue ← NodeSidebar.vue 改造：分类树（含 read_restricted 灰显）、最新/热门/精选入口、本地过滤
        ├── TopicList.vue       徽章（分类色块+emoji）、作者、相对时间、reactions/回复/浏览数、已采纳答案角标
        ├── TopicDetail.vue     cooked HTML 白名单清洗渲染、楼层 reactions、回复分页、相关主题、板块跳转
        ├── SettingsPanel.vue   【新】cf_clearance / UA 覆写 / 清缓存 / 数据源说明 / 挡板引导（替代 AccountMenu 的位置）
        ├── LdAvatar.vue        ← V2Avatar.vue 改造（{size} 模板 + letter_avatar 形态）
        └── AppIcon.vue
```

**删除不迁移**：`auth.ts`、`token.ts`、`notifications.ts`、`AccountMenu.vue`（登录/提醒整块）。

### CF 兜底状态机

```
请求 → host http（UA=设置面板覆写值；默认写死当前 Chrome stable UA 字符串常量，无 cookie 时也用它）
 ├─ 200        → 正常渲染；clearanceState=idle
 ├─ 403+盾特征 → clearanceState=blocked；若已粘贴 cookie 仍 403 → 仍为 blocked（「失效」「UA 不匹配」
 │               「出口 IP 变了」客户端不可区分，引导文案统一覆盖三种原因与重新复制步骤）
 │               设置面板亮引导：「系统浏览器打开 linux.do → 过盾 → F12 → Application → Cookies
 │               复制 cf_clearance + Console 复制 navigator.userAgent，两个都粘进插件」
 └─ 429/其他   → 按 v2ex 的错误样式呈现
设置面板保存 cookie/UA 成对生效；提供「测试连接」按钮（请求 latest.json 验证并显示结果）。
```

状态存 webview `localStorage`，仅本机；用户可随时清除。cookie 来自用户自己的浏览器，插件不做任何盾的自动求解。

### 缓存与节流（对齐 v2ex，数值微调）

分类 24h / 列表 2–5min / 详情 5min / 回复（分页块）3min；请求串行 + 300ms 间隔；linux.do 无 `X-Rate-Limit-*` 头，状态栏改显「缓存命中/请求中」与最近错误。

## 打包与发布

- 纯前端 → 单合包 `packageMode=0`（`packageUrl`），`npm run pack` 出扁平 ZIP `.oplg`。
- 新仓首上架三件套（`release` environment + `XYCLOUD_PAT` secret + `OTOOLS_PUBLISH_MARKET=true` variable）在**发布阶段**执行，不在本次实现范围。
- 版本起步 `0.1.0`；发布走 tag `v0.1.0` → `release-plugin.yml`（v2ex 同款）。

## 留给 builder 的

- `t/{id}.json?page=N` 与 `t/{id}/posts.json?post_ids[]=…` 二选一的实测（用 .probe 的主题验证翻页）。
- mock 数据裁剪的具体粒度；i18n 各语言文案；logo.svg 具体图形（暗圆 + 白 L + 青色点缀，原创不抄官方 logo）。
- 分类树 `subcategory_ids` 的递归渲染预留（匿名当前为空，登录用户目录形态未验证，本期只按匿名数据做）。

## 实施顺序（builder check 归并后新增）

1. **前置 spike（先于一切 UI）**：用 OTools 宿主同款 `crates/ot-http-client`（reqwest 0.12 + rustls）写一次性小程序，配一枚真实 `cf_clearance` + 对应 UA 实测能否过盾。cookie 来源：先试从 IAB webview cookie 罐提取（未验证 HttpOnly 与否）；取不到请用户提供一枚测试 cookie。**spike 失败 = 方案 ② 前提坍塌，停下回报用户改道。**
2. spike 通过 → 按「架构」一节全量实现（api 层先行，UI 随后）。
3. `npm run typecheck / build / pack / verify` 全绿，mock 预览自检。
4. 验收口径见开放问题（用户拍板）。
5. 发布（建远端仓 / 推送 / 打 tag / 上架三件套）按用户拍板的方式执行；xyito 子模块按 AGENTS.md 登记、不主动提交指针。

## builder check 归并记录（2026-11-16）

- **UA 绑定**：cookie + UA 成对必填引导（已并入状态机）；默认 UA 为写死的 Chrome stable 常量——已拍板（builder 问题 1）。
- **抓样法 / 补采**：IAB webview 抓样法已被实测验证可用；`c/{slug}/{id}.json` 与回复翻页样本实现期补采——已拍板（问题 2 子项）。
- **远端仓创建方式、验收是否含宿主端到端**：用户已拍板（2026-11-16）——验收 = spike + agent 自检 + 用户终验；远端仓由 agent `gh repo create ootools/otools-linuxdo --public` 并推送。

## 开放问题

（已全部拍板，见 builder check 归并记录。）

## 实测记录（2026-11-16，本机 Clash 代理 + ZCode IAB webview）

- curl/远程 reader：403 `cf-mitigated: challenge`（含全套 Chrome 头）——TLS 指纹级拦截，改 UA 无效。
- IAB webview（真实浏览器内核）：「请稍候…」→ 自动过盾 → JSON 正常返回。四个端点样本齐：latest(86KB)/categories(64KB)/top-daily(154KB)/hot(96KB)/topic-detail/search(错误样例)。
- 匿名 categories：12 顶层、无子分类、含 `read_restricted` 字段。
