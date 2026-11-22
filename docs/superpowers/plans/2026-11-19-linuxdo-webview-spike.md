# LINUXDO WebView Session Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is an approved-direction, throwaway feasibility experiment; production implementation requires a separate decision.

**Goal:** 在当前 macOS 上判断“原生 WebView 正常验证 + 同会话读取公开 JSON + 原生接收结果”是否可行。

**Architecture:** 使用独立 Swift/AppKit/WKWebView 程序模拟未来宿主的受限站点会话。浏览器内运行固定同源 GET 请求，WebKit 原生异步完成回调返回已验证的摘要；使用同一个非持久 data store 重建窗口测试进程内会话复用。

**Tech Stack:** 本机 Xcode Swift、AppKit、WebKit、Foundation；不安装第三方依赖。

**Spec:** `docs/superpowers/specs/2026-11-19-linuxdo-webview-spike-design.md`

## Global Constraints

- 只在当前 `main` 工作；不创建分支、worktree 或子代理。
- 正式宿主工作区有既有未提交改动，不修改宿主、SDK 或正式插件源码。
- 一次性源码、构建产物和脱敏结果位于已忽略的 `.probe/webview-session-spike/`。
- 只访问 linux.do 的公开只读接口；不登录、不自动点击挑战、不导出 Cookie。
- 不升版、不发布、不提交任何父仓库子模块指针。
- 用户确认本计划后才开始编写和运行验证程序。

## Review Focus

- 错误来源或非 HTTPS 主页面必须拒绝；不能阻断挑战的正常子资源。
- HTTP 200 的挑战 HTML 不能被误当成 JSON 成功。
- 导航失败、用户取消、网络超时必须有独立失败结果。
- 新窗口必须实际复用同一 data store，不能误称重启持久化。
- 没有观察到挑战时，不宣称已经验证 Cloudflare 交互。

### Task 1: 构建有边界的原生验证程序

**Files:**
- Create: `.probe/webview-session-spike/SpikePolicy.swift`
- Create: `.probe/webview-session-spike/SpikePolicyTests.swift`
- Create: `.probe/webview-session-spike/SpikeApp.swift`

**Interfaces:**
- Consumes: 固定 origin `https://linux.do`、公开端点 `/categories.json` 与 `/latest.json`。
- Produces: `allowsMainFrameNavigation(_ url: URL) -> Bool`；`validatePublicJSON(path: String, status: Int, contentType: String, body: Data) throws -> ProbeSummary`；`ProbeSummary` 仅含端点、状态、条目数和耗时等非秘密字段。

- [x] 先写策略测试：允许 linux.do HTTPS；拒绝 HTTP、外站、含用户名密码的 URL；只接受两个固定路径；拒绝 200 HTML、非法 JSON、缺少 `category_list.categories` / `topic_list.topics` 的响应。
- [x] 运行 `xcrun swiftc .probe/webview-session-spike/SpikePolicy.swift .probe/webview-session-spike/SpikePolicyTests.swift -o .probe/webview-session-spike/policy-tests`，确认因缺少实现失败。
- [x] 实现最小策略与摘要类型，重新编译并运行 `policy-tests`；所有明确断言通过后继续。
- [x] 编写 AppKit/WKWebView 程序：新的非持久 data store、受限主框架导航、固定只读请求、原生完成回调、120 秒交互期限、15 秒单请求期限、明确取消和失败结果；不注入通用消息桥。
- [x] 编译 `xcrun swiftc -swift-version 5 .probe/webview-session-spike/SpikePolicy.swift .probe/webview-session-spike/SpikeApp.swift -framework AppKit -framework WebKit -o .probe/webview-session-spike/linuxdo-webview-spike`；要求退出码 0。

### Task 2: 执行现场验证并如实记录

**Files:**
- Create: `.probe/webview-session-spike/result.json`
- Create: `docs/superpowers/specs/2026-11-19-linuxdo-webview-spike-results.md`

**Interfaces:**
- Consumes: Task 1 的可执行文件与摘要类型。
- Produces: 脱敏结果：运行时间、平台、是否观察到挑战、两个端点结构检查、窗口重建检查、失败分类、结论边界。

- [x] 启动原生验证程序，告知用户这是一次性验证窗口；需要人工验证时等待用户操作，不代点。
- [x] 核验两个端点均得到 HTTP 200、JSON 与最小结构；仅有窗口加载完成不能判定通过。
- [x] 使用同一 data store 重建窗口，`/latest.json` 再次通过；仅记录为同进程复用。
- [x] 如果 120 秒内未完成，则记录当前状态并结束，不连续重试挑战。若探测按钮未触发，challengeObserved 记录为 null（未检查），不填 false。
- [x] 检查结果文件和日志未包含 Cookie、令牌或响应正文，再写结论；不把 standalone 结果表述为插件已完成接入。
- [x] 重跑策略测试、`npm test`、`npm run test:src` 与 `npm run build`；检查插件仓库 diff 仅含本次文档，宿主原有改动保持不变。
- [x] 向用户报告通过项、未覆盖项及是否值得进入正式宿主/SDK/插件设计；本次不发布。
