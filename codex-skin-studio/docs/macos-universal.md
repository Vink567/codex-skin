# macOS 通用版

`npm run dist:mac` 会在 Studio 自身的 `dist` 文件夹中生成一个同时包含 Apple Silicon（M 系列）和 Intel 代码的 universal 版：

- `Codex-Skin-Studio-<version>-mac-universal.dmg`
- `Codex-Skin-Studio-<version>-mac-universal.zip`

请在 macOS 上执行构建。Windows 不能可靠地生成或签名 `.dmg`。

仓库中的 `.github/workflows/build-macos.yml` 可通过 GitHub Actions 手动运行，并附带 SHA-256 校验文件。它产出未签名构建；首次打开时，在 Finder 中按住 Control 点击应用，再选择“打开”。面向公开用户发布前，应使用 Apple Developer ID 进行签名并完成 notarization。

## 运行方式

Studio 不要求额外安装 Node。macOS 运行时会使用 Studio 自带的 Electron Node 启动皮肤监听器。

1. 导入主题包，在 Studio 内调整并点击“应用”。
2. 若官方 Codex 未打开，Studio 会以带本地调试端口的方式启动它并应用主题。
3. 若 Codex 已按普通方式打开，为避免强行结束正在进行的任务，Studio 不会自动关闭它。先退出 Codex，再点击“使用当前皮肤启动 Codex”。

默认查找 `/Applications/Codex.app` 和 `~/Applications/Codex.app`。若官方应用放在其他位置，可设置 `CODEX_SKIN_CODEX_APP_PATH` 为完整的 `Codex.app` 路径后再打开 Studio。
