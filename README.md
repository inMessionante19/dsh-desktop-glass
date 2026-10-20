# DeepSeek Harness 原生毛玻璃 0.2.1

Windows 原生 Acrylic 背景，实时模糊窗口后方的桌面和应用。Wallpaper Engine 的动态画面由系统合成，拖动、缩放窗口时显示后方对应位置，文字保持不透明。**0.2.1 修复切换到其他应用后背景变成灰色的问题，窗口失焦后也保持玻璃。**

**0.2.0 已移除旧版静态壁纸方案。** 不再读取桌面壁纸文件或 Wallpaper Engine 静态缓存，不在窗口中铺一张背景图片，也不录制屏幕。

## 环境

- Windows 11 22H2 或更新版本；系统“辅助功能 → 视觉效果 → 透明效果”需开启。
- 已验证当前官方 Electron 桌面版 DeepSeek Harness 0.2.1-rc.2。
- Wallpaper Engine 是否播放还取决于它自身的暂停规则。如果它设为遇到前台或最大化窗口就暂停，需要在 Wallpaper Engine 中调整该规则。

## 使用

原生适配和插件安装完成后，进入 **设置 → 通用 → 原生桌面毛玻璃**。

- 开关：启用或关闭 Windows Acrylic。
- 附加遮罩：0–60%，默认 8%。提高遮罩便于阅读，降低遮罩能更明显地看到后方画面。
- 模糊由 Windows 控制，不提供无效的“模糊半径”滑块。
- **Ctrl + Alt + G** 快速切换；**恢复原界面** 同时恢复页面纯色和原生窗口背景。

当别的应用位于 Harness 和桌面之间时，玻璃也会模糊显示那个应用。本版本不随普通焦点切换回退成实色。节能、远程桌面或系统透明效果关闭时，Windows 的合成能力可能受到限制。

## 安装原理与备份

普通 Harness 插件运行在 Host / 页面中，无法直接调用 Electron 主进程的窗口材质 API。本版本由普通插件和一个极小的桌面适配组成：

1. 桌面主进程增加受限的 Acrylic 开关，只接受当前 Harness 主页面的布尔参数，使用随 Harness 附带的 Koffi 调用窗口级合成接口，避免默认系统材质的失焦实色回退。
2. 通过隔离的 preload 暴露专用开关，不暴露 Node、任意 IPC 或文件读取。
3. 界面插件把内容背景变成透明，并提供附加遮罩、明暗主题和恢复按钮。

原生安装器只修改 `resources/app.asar` 的 `lib/main.js`、`lib/preload-app.cjs`；不修改 EXE、沙箱设置或程序保护设置。已逐个校验当前归档中其余 **16,724 个打包文件**内容不变。

原版归档及校验信息保存在安装目录下插件的 `backups` 文件夹。原生适配需要在 Harness 完全退出后安装或恢复。**关闭右上角 × 只会放到后台，请从托盘菜单退出。**

## 安装命令

把插件目录放到 `D:/deepseekHARNESS/UserData/plugins/dsh-desktop-glass`，完全退出 Harness 后执行：

```powershell
node 'D:/deepseekHARNESS/UserData/plugins/dsh-desktop-glass/native/install.mjs' --app-dir 'D:/deepseekHARNESS/dsh'
& 'D:/deepseekHARNESS/dsh/resources/runtime/cli/bin/dsh.cmd' plugin --profile desktop add 'link:D:/deepseekHARNESS/UserData/plugins/dsh-desktop-glass' --store-dir 'D:/deepseekHARNESS/UserData/cache/pnpm-store'
```

之后用原来的启动入口打开 Harness。桌面程序自动更新可能覆盖原生适配，此时设置页会提示适配未加载，需要重新运行安装器。遇到不支持的版本时安装器会停止。

## 恢复和卸载

仅关闭效果：在设置中点 **恢复原界面**，立即生效。

恢复原桌面归档：完全退出 Harness 后执行：

```powershell
node 'D:/deepseekHARNESS/UserData/plugins/dsh-desktop-glass/native/install.mjs' --app-dir 'D:/deepseekHARNESS/dsh' --restore
```

如果桌面程序已经更新，安装器不会用旧备份覆盖新程序。普通插件可通过插件管理器卸载。

## 验证

使用当前安装的 Electron 44.7.0，创建原生测试窗口并使用同一主进程开关、preload 和界面插件：

- 在两个不同位置捕获系统实际合成后的窗口画面，确认背景随位置改变。
- 窗口静止时改变后方窗口画面，确认背景实时更新。
- 确认文字 opacity 为 1，并验证关闭效果恢复原生实色。
- 验证不可信页面、非主 frame、任意对象参数被开关拒绝。
- 让另一个窗口真正获得焦点，确认玻璃窗口保持失焦；失焦前后背景采样差异为 0。
- 在玻璃窗口失焦期间改变后方画面，确认背景仍实时更新，而不是冻结前一帧。
- 0.2.1 不再使用随焦点回退的 DWM 类型 3；由窗口合成策略设置持续 Acrylic。
