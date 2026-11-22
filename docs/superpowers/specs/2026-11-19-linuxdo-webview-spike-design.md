# LINUXDO 原生 WebView 会话最小验证

状态：macOS 最小验证已完成，公开 JSON 同会话读取通过；Cloudflare challenge 交互未验证。结果见 `2026-11-19-linuxdo-webview-spike-results.md`。

## 意图

判断 macOS 原生 WKWebView 能否承载用户正常完成 linux.do 的 Cloudflare 验证，并在同一浏览器会话读取公开 JSON，避免要求用户复制 Cookie 和 User-Agent。

## 方案与选择

- 普通 iframe：不采用。不能解决插件父页面跨域读取数据以及宿主 HTTP 不共享浏览器会话的问题。
- 原生验证窗后导出 Cookie 给现有 HTTP 通道：暂不采用，仍引入跨请求链路复用凭证的不确定性。
- 原生 WebView 内验证、同会话请求：采用，先做一次性 macOS 验证，不直接建设正式宿主 API。

## 本次范围

1. 在插件仓库已忽略的 `.probe/webview-session-spike/` 编写独立 Swift/AppKit/WebKit 验证程序。
2. 使用新的非持久 WKWebsiteDataStore，不读取或导出用户浏览器 Cookie，不登录账号。
3. 显示加载 `https://linux.do/` 的独立原生窗口；等待正常页面加载，必要时由用户亲自完成验证，不自动点击或求解挑战。
4. 原生程序调用页面内同源 `fetch`，依次读取 `/categories.json`、`/latest.json`。使用 WebKit 的异步 JavaScript 完成回调取得结果，不向页面暴露通用宿主桥接、文件系统或任意命令能力。
5. 原生侧核验 HTTP 状态、JSON 类型和接口结构，只输出端点、状态、分类数/主题数等摘要，不记录响应正文、Cookie、UA、挑战令牌或账号数据。
6. 复用同一 data store 重建窗口，再读一个公开 JSON 端点，验证本次进程内会话复用；不把这个结果表述为跨进程持久化已验证。

## 安全与失败边界

- 仅允许 linux.do 的 HTTPS 主框架导航。保留正常挑战所需的子资源/子框架加载；禁止其他来源成为主页面或打开任意外部窗口。
- 只执行固定的同源、只读请求代码，不加载外部脚本，不修改站点业务页面或账号状态；这仅是本次获准 spike 对原 SPEC“不注入脚本”原则的受限实验例外，不更改正式插件行为。
- 挑战一直未完成、用户关闭窗口、导航失败、网络不可达、接口非 JSON、超时均分别记录，不报告成功，不连续自动重试挑战。
- 如需用户交互，明确提示验证窗口的位置；不代替用户点击 Cloudflare 验证或输入任何秘密。

## 通过标准与结论边界

- `/categories.json` 和 `/latest.json` 均返回 HTTP 200、可解析 JSON、符合最小结构，结果通过原生回调返回本地测试程序。
- 重建窗口后至少一个端点仍符合上述标准。
- 测试得到的只是当前 macOS、当前网络下 WKWebView 的可行性；不代表 Windows/Linux、正式 Tauri 接入或 Cloudflare 长期兼容性已验证。
- 没看到挑战、但端点可读：只能报告“同会话请求可行，本次未覆盖挑战交互”，不能报告“过盾已验证”。

## 非目标

不改宿主、SDK、插件正式源码和已有 Cookie 兜底；不增加依赖；不升版、不打包发布、不提交 xyito 子模块指针；不绕过网站验证。若实验通过，正式宿主 API、插件 UI、持久化和跨平台方案另行设计确认。
