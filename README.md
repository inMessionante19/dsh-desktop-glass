# DSH Desktop Glass

**让桌面壁纸透过 DeepSeek Harness。**

为 Windows 桌面版提供可切换的 **原生毛玻璃 / 完全透明** 背景。文字保持清晰，背景跟随窗口位置实时变化。

[![Release](https://img.shields.io/github/v/release/inMessionante19/dsh-desktop-glass)](https://github.com/inMessionante19/dsh-desktop-glass/releases/latest) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![Windows 11](https://img.shields.io/badge/Windows-11-0078D4)

**[下载 v0.3.0 ZIP](https://github.com/inMessionante19/dsh-desktop-glass/releases/download/v0.3.0/dsh-desktop-glass-0.3.0.zip)** · [安装指南](#安装命令) · [使用方式](#使用) · [English](README.en.md)

![10 秒原生效果演示：原界面、毛玻璃、完全透明与窗口移动](assets/demo.gif)

*10 秒演示，约 1.5 MB。使用插件的真实原生效果与设置组件录制；独立演示窗口中的界面和背景为演示素材。*

## 两种背景，随时切换

| 模式 | 看到的效果 |
| --- | --- |
| **毛玻璃** | 模糊透出窗口后方画面，附加遮罩可调 0–60%。 |
| **完全透明** | 关闭背景模糊与遮罩，清晰显示窗口后方细节。 |

- **实时背景**：支持透出 Wallpaper Engine 动态画面，移动或缩放窗口时显示后方对应位置。
- **清晰文字**：文字、图标保持不透明；设置弹窗和菜单保留可读底色。
- **记住选择**：模式与遮罩自动保存，切回毛玻璃保留之前的遮罩数值。
- **随时恢复**：设置中可恢复原界面，`Ctrl + Alt + G` 开关当前效果。

> **Windows 桌面版专用，需要一次手动原生适配。** 从插件市场安装界面插件后，也需完成下方的原生适配步骤。适配未加载时，界面会保持原样并显示设置提示。

## 环境

- **Windows 11 22H2 或更新版本**，开启系统“辅助功能 → 视觉效果 → 透明效果”。
- 已验证 **DeepSeek Harness 0.2.1-rc.2 / Electron 44.7.0**；其他程序版本可能需要适配。
- **Node.js 20 或更新版本**，用于运行原生适配安装器。

这是社区插件，与 DeepSeek 官方无关联。

## 安装命令

### 1. 下载并退出 Harness

下载并解压 [v0.3.0 ZIP](https://github.com/inMessionante19/dsh-desktop-glass/releases/download/v0.3.0/dsh-desktop-glass-0.3.0.zip)。从 **系统托盘右键菜单 → 退出** 完全退出 Harness；右上角 × 通常只会隐藏窗口。

<details>
<summary>也可以通过 Git 下载源码</summary>

```powershell
git clone https://github.com/inMessionante19/dsh-desktop-glass.git
```

</details>

### 2. 安装原生适配

在解压目录的上一级打开 PowerShell，填写应用目录。`$appDir` 是包含 `DeepSeek Harness.exe` 的目录，`$pluginDir` 是插件目录：

```powershell
$appDir = 'C:\path\to\DeepSeek Harness'
$pluginDir = (Resolve-Path '.\dsh-desktop-glass').Path
node (Join-Path $pluginDir 'native\install.mjs') --app-dir $appDir
```

安装器会备份并校验程序归档。确认命令完成后继续下一步。

### 3. 添加界面插件

**已经从插件市场安装过此插件，可以跳过这一步。** 手动安装时执行：

```powershell
$dshCli = Join-Path $appDir 'resources\runtime\cli\bin\dsh.cmd'
$pluginLink = 'link:' + ($pluginDir -replace '\\', '/')
& $dshCli plugin --profile desktop add $pluginLink
```

链接安装会直接读取本目录，请保留插件文件夹。

<details>
<summary>自定义启动器、DSH_HOME 或 pnpm store</summary>

如果启动器自定义了 `DSH_HOME`，请先在当前 PowerShell 中把 `$env:DSH_HOME` 设置为启动器使用的同一目录。

如果提示 `ERR_PNPM_UNEXPECTED_STORE`，在插件添加命令末尾追加 `--store-dir '<现有 store 目录>'`，使用错误信息中列出的现有目录。

</details>

### 4. 启动并选择模式

用原来的启动入口打开 Harness，进入 **设置 → 通用 → 桌面背景效果**。

## 使用

| 设置 | 作用 |
| --- | --- |
| 启用桌面背景效果 | 开关当前模式，关闭时恢复原界面。 |
| 背景模式 | 选择毛玻璃或完全透明，立即生效。 |
| 附加遮罩 | 仅在毛玻璃模式显示，默认 8%。 |
| 重置效果 | 恢复默认毛玻璃与 8% 遮罩。 |
| 恢复原界面 | 恢复页面纯色和原生窗口背景。 |

**快捷键：`Ctrl + Alt + G`**，开关当前效果并保留选定模式。

## 常见问题

**为什么安装后仍是纯色？**

查看设置中的状态提示，确认已完成原生适配，并从系统托盘完全退出、重新打开 Harness。市场安装只添加界面插件，原生适配需要手动执行。遇到不支持的程序结构或归档保护配置时，安装器会停止。

**透出来的是桌面，还是其他应用？**

显示的是窗口后方的实际画面；其他应用位于 Harness 与桌面之间时，也会被透出或模糊。Wallpaper Engine 的播放状态还取决于它自己的暂停规则。

**失去焦点后会变灰吗？**

当前版本沿用 0.2.1 的持续 Acrylic 实现，在已验证环境中，普通焦点切换后保持毛玻璃。节能、远程桌面或系统透明效果关闭可能限制 Windows 合成能力。

**Harness 更新后效果消失了？**

桌面更新可能覆盖原生适配。完全退出后重新运行安装器；如果新版不兼容，安装器会停止，等待后续适配。

## 恢复和卸载

仅关闭效果：在设置中点 **恢复原界面**，立即生效。

恢复原桌面归档：完全退出 Harness，在 PowerShell 中沿用安装时填写的 `$appDir`、`$pluginDir` 执行：

```powershell
node (Join-Path $pluginDir 'native\install.mjs') --app-dir $appDir --restore
```

原版归档和校验信息保存在插件目录的 `backups` 文件夹。如果桌面程序已更新，安装器会停止使用旧备份恢复。普通界面插件可通过插件管理器卸载。

<details>
<summary>安装原理与验证记录</summary>

普通 Harness 插件运行在 Host / 页面中，原生窗口材质需要主进程适配。本项目由界面插件与桌面适配组成：

1. 主进程只接受当前主页面的布尔开关和 `glass` / `transparent` 模式枚举，调用随 Harness 附带的 Koffi 设置窗口合成策略。
2. 隔离的 preload 暴露专用桥接；不会暴露任意 IPC、Node 或文件读取。
3. 界面插件调整背景样式、提供设置与恢复操作，文字和图标不随窗口背景淡化。

安装器只修改 `resources/app.asar` 的 `lib/main.js` 和 `lib/preload-app.cjs`，逐个校验其余打包文件。在已验证归档中，共校验 **16,724 个其他打包文件**内容不变。EXE、沙箱与程序保护设置保持原样。

使用 Electron 44.7.0 与相同插件代码完成的本地验证包括：窗口移动、动态后方画面、失焦后持续合成、完全透明的背景像素对照、文字 opacity 为 1、关闭效果恢复实色、受限 IPC 参数与来源校验、设置保存及卸载清理。Windows 或 Harness 更新可能需要后续适配。

0.2.0 起使用原生合成，插件本身不读取 Wallpaper Engine 缓存、不铺静态壁纸，也不录制屏幕。上方文档演示动图单独录制于受控演示窗口。

</details>

<details>
<summary>开发与测试</summary>

运行测试无需安装依赖，也不会修改当前安装的 Harness：

```powershell
cd dsh-desktop-glass
npm test
```

测试使用现场生成的最小 ASAR，覆盖补丁升级、幂等、原文件保留、未匹配版本停止、IPC 来源与参数限制。Linux 只验证跨平台逻辑；毛玻璃、焦点与动态背景需在 Windows 桌面验证。

`examples/github-actions.yml` 提供可选的 Windows / Linux 测试配置。仓库所有者可通过 GitHub 网页将其保存为 `.github/workflows/test.yml` 以启用；当前仓库未启用 Actions 工作流。

可选检查自己已安装的归档：

```powershell
$env:GLASS_ARCHIVE = Join-Path $appDir 'resources\app.asar'
npm test
Remove-Item Env:GLASS_ARCHIVE
```

`native/desktop-patch.mjs` 负责归档适配与原生桥接，`lib/client.js` 负责样式和设置，`native/install.mjs` 负责备份、校验和恢复。

</details>

## 历史版本

- [v0.3.0](https://github.com/inMessionante19/dsh-desktop-glass/releases/tag/v0.3.0)：毛玻璃与完全透明双模式。
- [v0.2.1](https://github.com/inMessionante19/dsh-desktop-glass/releases/tag/v0.2.1)：毛玻璃失焦修复版。
- [v0.2.0](https://github.com/inMessionante19/dsh-desktop-glass/releases/tag/v0.2.0)：初始原生毛玻璃版，失焦可能回退为灰色。

## 反馈与许可证

遇到问题请在 [Issues](https://github.com/inMessionante19/dsh-desktop-glass/issues) 中提供 Windows / Harness 版本、当前模式和复现步骤，日志请先移除个人信息。

如果这个插件对你有用，欢迎 Star；安装和显示反馈也有助于后续改进。

[MIT License](LICENSE)。
