# 第三方声明

本插件随 `dist/` 分发的产物包含以下第三方代码：

## Vue

- 项目：https://github.com/vuejs/core
- 版本：3.5.x
- 许可证：MIT
- 用途：插件前端框架（运行时打包进 `dist/assets/*.js`）

## otools-plugin-sdk

- 来源：npm registry（`otools-plugin-sdk` ^0.3.0）
- 许可证：Apache-2.0
- 用途：跨运行时桥接，仅使用 `otools-plugin-sdk/runtime` 的 `invoke` / `openExternal` / `isOtoolsPluginRuntime`

## LINUX DO (linux.do) 内容

插件通过 linux.do 的公开 Discourse JSON 接口匿名读取公开数据，不包含 linux.do 的商标、
官方图标或任何站点资源；分类与主题内容版权归 linux.do 站方及对应作者所有。
