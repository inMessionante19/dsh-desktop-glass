# DeepSeek Harness 桌面背景效果 0.3.0

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Native frosted glass and full transparency for DeepSeek Harness on Windows, with live Wallpaper Engine support.

这是社区插件，与 DeepSeek 官方无关联。当前已验证官方 Windows Electron 桌面版 **DeepSeek Harness 0.2.1-rc.2 / Electron 44.7.0**；其他版本的程序结构可能不同。

支持 **毛玻璃 / 完全透明** 两种原生背景模式，可在设置中随时切换并自动保存。毛玻璃实时模糊窗口后方的桌面和应用；完全透明关闭原生模糊、遮罩和主界面背景填充，直接透出后方画面。文字、图标保持不透明，设置弹窗和菜单保留可读底色。

Wallpaper Engine 的动态画面由系统合成，拖动、缩放窗口时显示后方对应位置，两种模式在失去焦点时均保持效果。沿用 0.2.1 的持续毛玻璃实现。

**0.2.0 已移除旧版静态壁纸方案。** 不再读取桌面壁纸文件或 Wallpaper Engine 静态缓存，不在窗口中铺一张背景图片，也不录制屏幕。

## 环境

- Windows 11 22H2 或更新版本；系统“辅助功能 → 视觉效果 → 透明效果”需开启。
- 已验证当前官方 Electron 桌面版 DeepSeek Harness 0.2.1-rc.2。
- 安装原生适配需要 Node.js 20 或更新版本；从源码下载可使用 Git，也可解压 GitHub 源码 ZIP。
- Wallpaper Engine 是否播放还取决于它自身的暂停规则。如果它设为遇到前台或最大化窗口就暂停，需要在 Wallpaper Engine 中调整该规则。

## 使用

原生适配和插件安装完成后，进入 **设置 → 通用 → 桌面背景效果**。

- 开关：启用当前模式，或关闭效果恢复原界面。
- 背景模式：**毛玻璃 / 完全透明**，立即生效。默认保持毛玻璃；升级保留现有开关和遮罩设置。
- 附加遮罩：仅在毛玻璃模式下显示，0–60%，默认 8%。切换到完全透明会隐藏遮罩，切回毛玻璃仍保留之前的数值。
- 模糊由 Windows 控制，不提供无效的“模糊半径”滑块。
- **Ctrl + Alt + G** 开关当前模式；**恢复原界面** 同时恢复页面纯色和原生窗口背景。**重置效果** 恢复默认毛玻璃与 8% 遮罩。

当别的应用位于 Harness 和桌面之间时，透明或玻璃背景也会显示那个应用。窗口仍可按原方式拖动、缩放和点击，透明效果不会把鼠标点击传给后方窗口。节能、远程桌面或系统透明效果关闭时，Windows 的合成能力可能受到限制。

## 安装原理与备份

普通 Harness 插件运行在 Host / 页面中，无法直接调用 Electron 主进程的窗口材质 API。本版本由普通插件和一个极小的桌面适配组成：

1. 桌面主进程增加受限的背景开关，只接受当前 Harness 主页面的布尔参数与 `glass` / `transparent` 模式枚举。使用随 Harness 附带的 Koffi 调用窗口级合成接口，玻璃启用持续 Acrylic，完全透明禁用原生模糊并清空窗口背景。
2. 通过隔离的 preload 暴露专用开关，不暴露 Node、任意 IPC 或文件读取。
3. 界面插件把内容背景变成透明，并提供模式选择、附加遮罩、明暗主题和恢复按钮。不会改变整个窗口或文字的 opacity。

原生安装器只修改 `resources/app.asar` 的 `lib/main.js`、`lib/preload-app.cjs`；不修改 EXE、沙箱设置或程序保护设置。已逐个校验当前归档中其余 **16,724 个打包文件**内容不变。

原版归档及校验信息保存在安装目录下插件的 `backups` 文件夹。原生适配需要在 Harness 完全退出后安装或恢复。**关闭右上角 × 只会放到后台，请从托盘菜单退出。**

## 安装命令

1. 下载 [最新发布包](https://github.com/inMessionante19/dsh-desktop-glass/releases/latest) 并解压，或克隆源码：

```powershell
git clone https://github.com/inMessionante19/dsh-desktop-glass.git
```

2. 从系统托盘完全退出 Harness，打开 PowerShell，填写下面两个目录。`$appDir` 应是包含 `DeepSeek Harness.exe` 的目录，`$pluginDir` 应是本插件的目录：

```powershell
$appDir = 'C:\path\to\DeepSeek Harness'
$pluginDir = (Resolve-Path '.\dsh-desktop-glass').Path
node (Join-Path $pluginDir 'native\install.mjs') --app-dir $appDir
```

3. 把插件加入桌面 profile：

```powershell
$dshCli = Join-Path $appDir 'resources\runtime\cli\bin\dsh.cmd'
$pluginLink = 'link:' + ($pluginDir -replace '\\', '/')
& $dshCli plugin --profile desktop add $pluginLink
```

如果启动器自定义了 `DSH_HOME`，请先在当前 PowerShell 中把 `$env:DSH_HOME` 设置为启动器使用的同一目录。如果提示 `ERR_PNPM_UNEXPECTED_STORE`，在插件添加命令末尾追加 `--store-dir '<现有 store 目录>'`，使用错误信息中列出的现有目录。

4. 用原来的入口启动 Harness，在 **设置 → 通用 → 桌面背景效果** 中选择模式。

链接安装会直接读取本目录，请保留插件目录。程序自动更新可能覆盖原生适配，此时设置页会提示适配未加载，需要完全退出后重新运行安装器。遇到不支持的程序结构或归档保护配置时，安装器会停止。

## 恢复和卸载

仅关闭效果：在设置中点 **恢复原界面**，立即生效。

恢复原桌面归档：完全退出 Harness 后执行：

```powershell
node (Join-Path $pluginDir 'native\install.mjs') --app-dir $appDir --restore
```

如果桌面程序已经更新，安装器不会用旧备份覆盖新程序。普通插件可通过插件管理器卸载。

## 验证

维护者曾使用 Electron 44.7.0 创建原生测试窗口，使用同一主进程开关、preload 和界面插件完成以下本地验证：

- 在两个不同位置捕获系统实际合成后的窗口画面，确认背景随位置改变。
- 窗口静止时改变后方窗口画面，确认背景实时更新。
- 确认文字 opacity 为 1，并验证关闭效果恢复原生实色。
- 验证不可信页面、非主 frame、任意对象参数被开关拒绝。
- 让另一个窗口真正获得焦点，确认玻璃窗口保持失焦；失焦前后背景采样差异为 0。
- 在玻璃窗口失焦期间改变后方画面，确认背景仍实时更新，而不是冻结前一帧。
- 0.2.1 不再使用随焦点回退的 DWM 类型 3；由窗口合成策略设置持续 Acrylic。
- 0.3.0 在高频棋盘图案前验证完全透明：背景采样与隐藏窗口时一致，毛玻璃采样显著不同；透明模式启动、失焦、移动、缩放后均保持透明。
- 使用实际设置组件验证模式保存、重启恢复、快捷键、关闭效果、遮罩数值保留、弹窗底色、错误回退与卸载清理。

## 开发与测试

运行自动测试无需安装依赖，也不会修改当前安装的 Harness：

```powershell
cd dsh-desktop-glass
npm test
```

测试使用现场生成的最小 ASAR，覆盖补丁升级、幂等、原文件保留、未匹配版本停止、IPC 调用来源校验和参数限制。Linux 只验证跨平台逻辑，不支持窗口特效。毛玻璃、动态壁纸、焦点和移动效果仍需在 Windows 桌面上手动验证。

`examples/github-actions.yml` 提供可选的 Windows / Linux 自动测试配置。仓库所有者可通过 GitHub 网页将其保存为 `.github/workflows/test.yml` 以启用；当前仓库未启用 Actions 工作流。

可选：仅检查自己已安装的归档是否包含当前桥接代码：

```powershell
$env:GLASS_ARCHIVE = Join-Path $appDir 'resources\app.asar'
npm test
Remove-Item Env:GLASS_ARCHIVE
```

`native/desktop-patch.mjs` 负责归档适配及受限的原生桥接，`lib/client.js` 负责背景样式与设置组件，`native/install.mjs` 负责备份、校验和恢复。原生合成使用 Windows 的窗口合成接口，未来 Windows 或 Harness 更新可能需要适配。

遇到问题请在 [Issues](https://github.com/inMessionante19/dsh-desktop-glass/issues) 中描述 Windows、Harness 版本、当前模式和复现步骤，日志请先移除个人信息。

## 许可证

[MIT](LICENSE)。
