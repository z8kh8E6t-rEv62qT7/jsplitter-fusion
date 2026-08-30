# JSplitter Fusion

面向 foobar2000、Columns UI 与 JSplitter 的模块化自绘前端。界面采用 Fusion 风格三栏布局，在不依赖 JScript Panel、Spider Monkey Panel、WebView 或完整主题包的前提下，提供播放列表管理、歌曲列表、封面与详细信息以及底部播放控制区。

本仓库是源码目录；foobar2000 实际加载的是用户配置目录中的部署副本。

## 运行环境

当前版本在以下组合中开发和验证：

- foobar2000 2.26 x64
- Columns UI 3.6.0
- JSplitter 4.1.15 x64
- Windows 10/11

JSplitter 必须作为 Columns UI 面板运行。`main.js` 还会加载 JSplitter 自带的 `docs/Flags.js` 和 `docs/Helpers.js`。

## 安装与启用

1. 安装并启用 Columns UI 与 JSplitter。
2. 将本仓库中的全部文件复制到：

   ```text
   %APPDATA%\foobar2000-v2\jsplitter-fusion\
   ```

   部署后应能看到 `main.js`、`theme.js`、`core`、`views` 和 `assets`。不要只复制 `main.js`。

3. 在 Columns UI 的布局中加入一个 JSplitter 面板，并打开该面板的配置窗口。
4. 将脚本来源改为 **File**，选择：

   ```text
   %APPDATA%\foobar2000-v2\jsplitter-fusion\main.js
   ```

5. 应用布局并重新启动 foobar2000。成功加载后，主内容区会显示三栏界面和底部控制区；若脚本初始化失败，面板会直接显示错误信息。

`assets/transport-icons.png` 是运行时必需资源，必须随源码一起部署。它已包含所需图标，不需要安装 Material Icons 字体。

## 界面与操作

### Playlists

- 单击切换播放列表。
- 右键可新建、载入、保存、重命名或删除播放列表。
- 拖动播放列表可调整顺序。
- `Insert` 新建播放列表，`Delete` 删除当前播放列表。
- 只有内容溢出时才显示纵向滚动条。

### Playlist

- 列表按相邻项目的目录分组，只改变显示，不排序播放列表。
- 支持单选、`Ctrl`/`Shift` 多选以及方向键、`Home`、`End`、`Page Up`、`Page Down` 导航。
- 双击或按 `Enter` 播放，按 `Delete` 删除选中项目。
- 可从资源管理器拖入文件或文件夹，也可在列表内部拖动重排。
- 拖动表头分隔线调整绝对列宽；拖动表头主体调整列顺序。
- `#` 和 `Title` 固定在前两列；`Artist`、`Album`、`Filename`、`Length` 可换序。
- 表头右键可自动调整单列或全部列，并控制可选列的显示状态。`Filename` 默认隐藏。
- 普通滚轮纵向滚动；`Shift` + 滚轮横向滚动。列宽超出可视区域时会出现横向滚动条。
- 在面板内单按 `O` 执行 foobar2000 的 `File/Add files...`，不会注册全局快捷键。

### Artwork 与 Item details

- 有选中项目时显示选中内容；没有选择时回退到正在播放或暂停的项目。
- 多选时显示可聚合的信息；共同值正常显示，不同或不适用的值显示 `N/A`，全部缺失显示 `No data`。
- 多选不显示封面；空上下文显示 `No artwork` 和“没有选中的项目”。
- 单项封面由 foobar2000 的封面查询接口获取，图片按比例完整显示。

### 底部控制区

- 提供停止、播放/暂停、上一首、下一首、Shuffle Tracks、Repeat Track 和添加文件按钮。
- Shuffle Tracks 与 Repeat Track 是播放顺序切换，并通过同一个播放顺序自然互斥。
- 右侧播放顺序菜单包含 Default、Repeat Playlist、Repeat Track、Random、Shuffle Tracks、Shuffle Albums 和 Shuffle Folders。
- 进度条支持点击定位、拖动预览和释放跳转；未知长度流媒体禁用跳转。
- 音量条支持点击、拖动和滚轮调节。
- 进度条上方的 Now Playing 文本始终跟随正在播放项目，不受列表选择影响；停止后留空。

## Now Playing 标题模板

默认模板只显示标题；标题缺失时回退到文件名：

```text
$if2(%title%,$if2(%filename_ext%,no title))
```

右键单击底部控制行中央的标题区域，可以编辑模板或恢复默认值。模板使用 foobar2000 Title Formatting 语法，例如：

```text
%artist% — %title%
```

空模板或无法编译的表达式不会保存。对应面板属性为 `jsplitterFusion.nowPlaying.format`。

## 持久化设置

界面状态通过 JSplitter 面板属性保存，统一使用 `jsplitterFusion.*` 命名空间：

| 属性 | 用途 |
| --- | --- |
| `leftWidth` / `rightWidth` | 左右栏宽度 |
| `column.<id>` | 各列绝对宽度 |
| `column.visible.<id>` | 列显示状态 |
| `column.order` | 全局列顺序 |
| `scroll.<playlist-guid>` | 各播放列表纵向位置 |
| `hscroll.<playlist-guid>` | 各播放列表横向位置 |
| `nowPlaying.format` | Now Playing 标题模板 |

完整属性名需要加上 `jsplitterFusion.` 前缀。正常情况下应通过界面操作修改这些属性，而不是手动编辑配置文件。

## 源码结构

```text
main.js                         入口、回调注册和顶层错误保护
theme.js                        Fusion 调色板、字体、DPI 与控件尺寸
core/
  artwork.js                    封面请求、缓存和过期结果保护
  playlist-model.js             播放列表、显示上下文和详情数据
  settings.js                   面板属性读取、校验与迁移
  utils.js                      绘制、格式化和通用辅助函数
views/
  app.js                        总体布局与事件分发
  playlist-manager.js           左侧播放列表管理器
  playlist-view.js              中央歌曲列表、列和选择交互
  right-pane.js                 封面与 Item details
  scrollbar.js                  横纵通用滚动条
  transport-controls.js         播放按钮、播放顺序与标题模板菜单
  bottom-bar.js                 进度、摘要和音量控制
assets/
  transport-icons.png           播放控制图标精灵图
  README.md                     图标来源与精灵单元说明
```

`main.js` 使用相对路径按依赖顺序加载各模块。新增模块时需要同时更新入口加载顺序；模块通过 `FusionUI` 命名空间共享内部接口。

## 开发与验证

源码直接由 JSplitter 执行，没有打包步骤。修改完成后将仓库内容同步到运行目录，再重新加载面板或重启 foobar2000。

可先用 Node.js 对全部 JavaScript 文件进行语法检查：

```bash
find . -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

在本项目原始工作区中，回归测试入口位于仓库上一级：

```bash
node ../jsplitter-fusion-tests.js
```

提交前还应确认：

- 所有 JavaScript 文件语法检查通过。
- 回归测试通过。
- 没有引入 ActiveX、外部进程或网络请求。
- `main.js` 的模块路径与部署目录一致。
- 源码与 `%APPDATA%\foobar2000-v2\jsplitter-fusion\` 中的部署副本一致。

## 故障排查

- **面板显示脚本错误**：首先检查 JSplitter 是否使用 File 模式，以及 `main.js` 是否位于规定目录。
- **模块加载失败**：确认 `core`、`views`、`theme.js` 与 `main.js` 一起复制，目录层级没有变化。
- **按钮没有图标**：确认 `assets/transport-icons.png` 存在。
- **设置重启后丢失**：确认一直使用同一个 JSplitter 面板实例；属性属于面板配置，不写入源码目录。
- **修改源码没有生效**：foobar2000 加载的是 `%APPDATA%` 下的部署副本，需要先同步文件再重新加载。

## 约束

- 不修改音频文件、标签、媒体库位置或播放列表内容。
- 不使用 ActiveX、外部进程或网络请求。
- 不依赖 JScript Panel、Spider Monkey Panel 或 WebView。
- 运行时仅使用 Columns UI、JSplitter 以及 foobar2000/JSplitter 提供的接口。
