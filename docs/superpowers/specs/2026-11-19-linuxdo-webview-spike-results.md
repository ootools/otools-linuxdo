# LINUXDO 原生 WebView 会话最小验证结果

日期：2026-11-19。测试机：macOS 27.0 arm64，Swift 6.4.2。

## 结果

**当前 WebView 读取公开 JSON 的链路通过；Cloudflare challenge 交互仍未验证。** 用户说第一次没注意到窗口后，我把一次性探针打成 macOS `.app` 并重新打开。探针通过其窗口按钮发起请求，成功读取两个公开 JSON 接口；随后重建 `WKWebView` 窗口并沿用同一非持久 `WKWebsiteDataStore`，又成功读取主题接口。

- `/categories.json`：HTTP 200，12 个分类，477 ms。
- `/latest.json`：HTTP 200，30 个主题，1034 ms。
- 新 WebView/新窗口、同一进程内会话复用：`/latest.json` HTTP 200，30 个主题，960 ms。
- 按钮执行前的已知 challenge 页面文案检测结果为 `false`。这说明**本次没有在探测时检测到已知 challenge 标记**；不能据此证明 Cloudflare challenge 已被触发、完成或兼容，也不能证明其他网络/IP 下不会遇到挑战。
- 脱敏原始结果：`.probe/webview-session-spike/result.json`。文件只包含接口、HTTP 状态、条目数、耗时及测试范围，不含 Cookie、UA、响应正文或令牌。

## 可以得出的结论

1. 在本次 macOS 27.0 arm64 和当前网络环境中，WebKit 页内的同源只读 `fetch` 能读取 `linux.do` 公开 Discourse JSON。
2. 原生侧异步回调可以取得并校验结果，而无需将 `cf_clearance` 复制到插件或现有 Rust HTTP 请求。
3. 同一个非持久 data store 可由新 WebView 复用；本次已实际验证同进程的窗口重建场景。

这足以支持下一步**设计一个 OTools 受限的站点会话 API**：仅由宿主承载 `https://linux.do` WebView 会话，插件只能请求固定的公开只读 JSON 接口并取得结果。不是把 linux.do 放在普通 iframe，也不是给插件任意 WebView、Cookie 读取或通用脚本桥。正式接口还须单独设计权限、调用者身份校验、并发/超时、会话生命周期、平台支持和用户验证 UI。

## 尚未验证 / 限制

- Cloudflare challenge 的实际出现、人工完成及完成后继续请求：**未验证**。
- Windows / Linux、其他代理或网络出口、持久化/应用重启后会话：未验证。
- 正式接入 OTools 宿主、SDK、插件和插件市场：未实现。
- 该原生 WKWebView 探针是一次性可行性测试，不是生产就绪实现。
