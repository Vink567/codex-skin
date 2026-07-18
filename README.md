# Codex Skin Studio 使用指南

Codex Skin Studio 是一个给 Windows 和 macOS 版 Codex Desktop 换主题的小工具。

完整流程是：

1. 让 Codex 安装 `$codex-skin` Skill。
2. 用 `$codex-skin` 根据图片或文字描述生成主题 ZIP。
3. 下载并打开 Codex Skin Studio。
4. 在 Studio 里导入主题 ZIP。
5. 预览、调整，然后应用到 Codex。

请注意：Studio 只导入 `.zip` 主题资源包，不能直接导入 `.png`、`.jpg` 这类普通图片。

## 下载 Studio

### Windows

点击下面这个链接下载 Windows 便携版：

[下载 Codex-Skin-Studio-0.1.6-portable.exe](https://github.com/Vink567/codex-skin/releases/download/v0.1.6/Codex-Skin-Studio-0.1.6-portable.exe)

这是便携版，不需要安装。下载后双击运行即可。

### macOS（Intel + Apple Silicon 通用版）

优先下载 DMG：

[下载 Codex-Skin-Studio-0.1.6-mac-universal.dmg](https://github.com/Vink567/codex-skin/releases/download/v0.1.6/Codex-Skin-Studio-0.1.6-mac-universal.dmg)

也可以下载 ZIP：

[下载 Codex-Skin-Studio-0.1.6-mac-universal.zip](https://github.com/Vink567/codex-skin/releases/download/v0.1.6/Codex-Skin-Studio-0.1.6-mac-universal.zip)

这是同时支持 Intel 和 Apple Silicon（M 系列）的通用版。当前包尚未经过 Apple notarization；若首次打开被 macOS 拦截，请在 Finder 中按住 Control 点击应用，再选择“打开”。

如果你想查看完整发行页，可以打开：

[Codex Skin Studio v0.1.6 Release](https://github.com/Vink567/codex-skin/releases/tag/v0.1.6)

## 安装 Skill

`$codex-skin` Skill 用来生成 Studio 能导入的主题 ZIP。你不需要手动复制文件夹，直接让 Codex 安装即可。

打开 Codex，新建一个任务，把下面这句话发给 Codex：

```text
请从 GitHub 安装这个 Codex skill：https://github.com/Vink567/codex-skin/tree/main/codex-skin
```

安装完成后，重启 Codex。

## 确认 Skill 可用

重启 Codex 后，新建一个任务，输入：

```text
使用 $codex-skin，生成一个测试主题资源包。
```

如果 Codex 能识别 `$codex-skin`，说明 Skill 已经装好。

## 用 Skill 生成主题 ZIP

如果你有参考图片，可以把图片发给 Codex，然后这样说：

```text
使用 $codex-skin，把这张图片做成 Codex Skin Studio 可导入的主题资源包。
主题名叫：暖色书桌。
希望修改背景、侧边栏、输入框、按钮和首页建议卡片。
要求：背景不要影响文字阅读，整体颜色柔和。
```

如果你没有图片，也可以只写主题描述：

```text
使用 $codex-skin，生成一个 Codex Skin Studio 可导入的主题资源包。
主题名叫：Forest Desk。
风格：清爽的浅色森林书桌，背景不要太花，文字要清楚。
希望修改背景、顶部栏、侧边栏、侧边栏图标、首页建议卡片、输入框和项目选择栏。
```

完成后，Codex 会告诉你一个 `.zip` 文件路径。文件名通常类似：

```text
codex-skin-forest-desk.zip
```

这个 ZIP 就是 Studio 要导入的主题包。

## 用 Studio 导入主题

1. 打开下载的 Codex Skin Studio。
2. 点击左侧的“导入主题资源包”。
3. 选择 `$codex-skin` 生成的 `codex-skin-xxx.zip`。
4. 等待 Studio 检查主题包。
5. 检查通过后，中间会显示预览。

如果导入失败，通常说明这个 ZIP 不是 Studio 支持的主题包，或者主题包缺少文件。重新让 `$codex-skin` 生成一次即可。

## 调整主题效果

导入主题后，右侧可以做一些简单调整：

- “背景遮罩”：背景太亮或太花时，把它调高一点。
- “图片适配”：决定背景是铺满、完整显示，还是拉伸。
- “表面样式”：调整顶部栏和侧边栏颜色。
- “SVG 图标”：调整侧边栏图标颜色。
- “建议卡片”：调整首页四张建议卡片颜色。
- “Composer 输入组件”：调整底部输入框和按钮颜色。
- “当前项目选择栏”：调整项目选择区域。
- “区域开关”：不想改哪个区域，就关掉哪个区域。

调整完成后，点击“应用全部区域到 Codex”。

## 应用到 Codex

点击“应用全部区域到 Codex”后，Studio 会把主题应用到 Codex。

如果 Codex 已经打开，通常会直接看到变化。  
如果没有变化，先关闭 Codex，再重新打开 Codex，然后回到 Studio 点击“检查当前状态”。

在 macOS 上，如果 Codex 正以普通方式运行，请先退出它，再点击 Studio 的“使用当前皮肤启动 Codex”。这样 Studio 才能以可换肤模式启动官方 Codex。

## 恢复默认外观

如果你不想继续使用当前主题：

1. 打开 Codex Skin Studio。
2. 点击“检查当前状态”。
3. 点击恢复按钮。

恢复只会停止当前主题效果，不会删除你的主题 ZIP。

## 常见问题

### Studio 能直接导入图片吗？

不能。Studio 只导入 `.zip` 主题资源包。普通图片需要先交给 `$codex-skin` Skill，生成 ZIP 后再导入。

### Skill 生成的 ZIP 在哪里？

Codex 完成任务时会告诉你资源包路径。复制这个路径，或者在文件管理器里找到它，再导入 Studio。

### 应用后 Codex 没变化怎么办？

先关闭 Codex，再重新打开。  
如果还是没有变化，回到 Studio 里点击“检查当前状态”。

### 背景太花，文字看不清怎么办？

在 Studio 里把“背景遮罩”调高一点。也可以让 `$codex-skin` 重新生成一个更干净、更适合阅读的背景。

### 可以随时换主题吗？

可以。重新导入一个新的主题 ZIP，然后再次点击“应用全部区域到 Codex”。

## 给 Skill 的提示词模板

你可以直接复制下面这段发给 Codex：

```text
使用 $codex-skin，帮我生成一个 Codex Skin Studio 可导入的主题资源包。
主题名：
风格：
参考图片：
希望修改的区域：背景、顶部栏、侧边栏、侧边栏图标、首页建议卡片、输入框、项目选择栏。
要求：背景不要影响文字阅读，整体颜色柔和，最后给我可导入 Studio 的 ZIP 文件路径。
```

## 注意事项

- 这个工具支持 Windows 与 macOS 版 Codex Desktop；macOS 包同时支持 Intel 和 Apple Silicon。
- Studio 导入的是 ZIP，不是普通图片。
- 不建议把私人照片、聊天截图或包含敏感信息的图片做成主题。
- 如果 Windows 弹出安全提醒，请确认软件来源可信后再运行。
- 遇到问题时，优先尝试关闭 Codex 后重新打开。
