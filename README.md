# Codex Skin

Codex Skin 是一套面向 Windows 版 Codex Desktop 的主题资源工作流。仓库里包含用于生成主题资源包的 Codex Skill、用于导入和应用主题的 Codex Skin Studio 桌面应用，以及当前最新的发布产物。

## 仓库内容

- `codex-skin/` - Codex Skill，用来生成 Studio 可导入的主题资源包。
- `codex-skin-studio/` - Electron 桌面应用，用来导入、预览、应用、检查和恢复 Codex 主题。
- `dist/codex-skin-cozy-cat-room.zip` - 当前可导入的主题资源包。
- `dist/codex-skin-studio-theme-resource-packager-skill-v0.3.4.zip` - 当前打包好的 Skill 发布包。
- `codex-skin-studio/dist-v18/Codex-Skin-Studio-0.1.3-portable.exe` - 最新 Studio v18 便携版 Windows 构建。

## Codex Skin Studio

Studio 负责运行时侧的主题管理：

1. 导入 `.zip` 主题资源包。
2. 校验 manifest、SHA-256、路径安全、图片资源和 SVG 图标。
3. 预览主题，并在编辑器里调整各区域颜色与开关。
4. 通过本地运行时脚本把选中的主题应用到 Codex。
5. 检查当前状态，或恢复默认外观。

当前上传的最新 Studio 构建是 v18 便携版：

```text
codex-skin-studio/dist-v18/Codex-Skin-Studio-0.1.3-portable.exe
```

旧版 Electron 构建目录已被 `.gitignore` 排除，仓库只保留最新 v18 版本，避免上传 v2-v17 的历史构建产物。

## 主题资源包格式

主题 ZIP 是纯资源包，不应该包含运行时脚本、安装脚本、恢复脚本、可执行文件或用户本机路径。

一个完整主题资源包通常包含：

```text
theme.json
SHA256SUMS.txt
preview.png
assets/background.<png|jpg|jpeg|webp|gif>
assets/theme.css
assets/icons/*.svg
```

完整 manifest 约定和校验规则见 `codex-skin/references/theme-package-format.md`。

## 构建主题资源包

在 `codex-skin/` 目录下，可以用下面的命令生成 Studio 可导入的主题 ZIP：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-theme-pack.ps1 `
  -ThemePath "<absolute-theme-json>" `
  -OutputDirectory "<absolute-output-directory>" `
  -Force
```

构建脚本会按下面的格式命名资源包：

```text
codex-skin-<theme-slug>.zip
```

## 从源码运行 Studio

```powershell
cd codex-skin-studio
npm install
npm start
```

## 构建 Studio

```powershell
cd codex-skin-studio
npm install
npm run dist
```

Studio 使用 `electron-builder` 打包，并会把 Codex Skin 的运行时脚本与资源作为 extra resources 放入应用。

## 安全边界

- 不修改 Codex MSIX 包或 `app.asar`。
- 不把凭据、对话内容、绝对本机路径或浏览器数据放进主题包。
- SVG 图标只能是静态安全标记，不能包含脚本、事件处理器、外部 URL、data URL、frame 或 embedded object。
- Studio 会在应用主题前校验导入的资源包。
