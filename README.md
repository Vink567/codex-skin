# Codex Skin Studio 使用指南

Codex Skin Studio 是一个给 Windows 版 Codex Desktop 换主题的小工具。

它的流程很简单：

1. 先安装 `$codex-skin` Skill。
2. 用 `$codex-skin` 根据图片或文字描述生成主题 ZIP。
3. 下载并打开 Codex Skin Studio。
4. 在 Studio 里导入这个 ZIP。
5. 预览、调整，然后应用到 Codex。

请注意：Studio 只导入 `.zip` 主题资源包，不能直接选择 `.png`、`.jpg` 这类普通图片。

## 下载 Studio

打开 GitHub 仓库的 Releases 页面：

```text
https://github.com/Vink567/codex-skin/releases
```

在最新版 `v0.1.4` 里下载：

```text
Codex-Skin-Studio-0.1.4-portable.exe
```

这是便携版，不需要安装。下载后双击运行即可。

如果 Windows 弹出安全提醒，请确认文件来自这个仓库后再运行。

## 下载 Skill

`$codex-skin` Skill 用来生成 Studio 能导入的主题 ZIP。你有两种下载方式。

### 方法一：下载仓库 ZIP

1. 打开仓库首页：

```text
https://github.com/Vink567/codex-skin
```

2. 点击绿色的 `Code`。
3. 点击 `Download ZIP`。
4. 解压下载的压缩包。
5. 找到里面的 `codex-skin` 文件夹。
6. 把这个 `codex-skin` 文件夹复制到你的 Codex skills 目录。

Windows 上通常是：

```text
C:\Users\你的用户名\.codex\skills\codex-skin
```

复制完成后，重启 Codex。

### 方法二：用 Git 下载

如果你会用 Git，可以运行：

```powershell
git clone https://github.com/Vink567/codex-skin.git
```

然后把仓库里的 `codex-skin` 文件夹复制到：

```text
C:\Users\你的用户名\.codex\skills\codex-skin
```

复制完成后，重启 Codex。

## 怎么确认 Skill 可用

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

1. 打开 `Codex-Skin-Studio-0.1.4-portable.exe`。
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

## 恢复默认外观

如果你不想继续使用当前主题：

1. 打开 Codex Skin Studio。
2. 点击“检查当前状态”。
3. 点击恢复按钮。

恢复只会停止当前主题效果，不会删除你的主题 ZIP。

## 常见问题

### Studio 能导入图片吗？

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

- 这个工具面向 Windows 版 Codex Desktop。
- Studio 导入的是 ZIP，不是普通图片。
- 不建议把私人照片、聊天截图或包含敏感信息的图片做成主题。
- 如果 Windows 弹出安全提醒，请确认软件来源可信后再运行。
- 遇到问题时，优先尝试关闭 Codex 后重新打开。
