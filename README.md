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
- 默认列顺序以 `# | № | Total | Title` 开始。`#` 显示播放列表行序号；`№` 和 `Total` 分别显示文件标签中的音轨序号、总音轨数，不从播放列表数量推算。两列纯数字去除前导零（`01`、`04` 显示为 `1`、`4`，全零显示为 `0`），缺失留空，非数字保持原样。
- 仅 `#` 固定在列顺序首位；其余列（包括 `Title`）均可换序。所有列均可隐藏，新音轨列默认显示并居中，支持调宽和自动适配；全部隐藏后仍可右键表头恢复列。
- 有效的旧 12 列配置会在 `Title` 前插入两条新列，保留原有列相对顺序、宽度和显示状态；损坏或更旧的不完整列顺序恢复默认排列。新排列及显示状态在重载后保留。
- 表头右键可自动调整单列或全部列，并控制可选列的显示状态。`Filename` 默认隐藏；`Codec`、`Bitrate`、`Sample rate`、`Bit depth`、`Channels` 和 `File size` 六个技术列也默认隐藏，并使用与 Item details 相同的值格式。
- 普通滚轮纵向滚动；`Shift` + 滚轮横向滚动。列宽超出可视区域时会出现横向滚动条。
- 在面板内单按 `O` 执行 foobar2000 的 `File/Add files...`，不会注册全局快捷键。

### Artwork 与 Item details

- 有选中项目时显示选中内容；没有选择时回退到正在播放或暂停的项目。
- 多选时显示可聚合的信息；共同值正常显示，不同或不适用的值显示 `N/A`，全部缺失显示 `No data`。
- 多选不显示封面；空上下文显示 `No artwork` 和“没有选中的项目”。
- 单项封面由 foobar2000 的封面查询接口获取，图片按比例完整显示。

### Playback details

右栏下方提供 `Item details` 和 `Playback details` 两个标签，上方封面不随标签切换。每次启动默认打开 `Item details`；两页在本次会话中分别保留滚动位置。

`Playback details` 需要已安装 [Output Info（foo_outinfo）](https://foobar.hyv.fi/?view=foo_outinfo)，通过动态 Title Formatting 读取输出链路，与歌曲选择和多选无关。缺少组件或字段读取失败时显示 `No data`，不影响其他界面功能。

| 分组 | 中文字段 | Title Formatting 字段 |
| --- | --- | --- |
| 输出 | 输出设备 | `%output_device%` |
| 输出 | 输出采样率 | `%output_samplerate%` |
| 输出 | 声道数 | `%output_channels%` |
| 输出 | 声道布局 | `%output_channel_mask%` |
| 输出 | 输出位深 | `%output_bitdepth%` |
| 输出 | 播放音量 | `%output_volume%` |
| 输出 | 缓冲长度 | `%output_buffer_length%` |
| DSP | 活动 DSP | `%output_dsps%` |
| DSP | DSP 链预设 | `%output_dsp_preset%` |
| ReplayGain | 来源模式 | `%output_rg_source%` |
| ReplayGain | 处理模式 | `%output_rg_mode%` |
| ReplayGain | 有效增益 | `%output_rg_gain%` |
| ReplayGain | 有效峰值 | `%output_rg_peak%` |
| ReplayGain | 有效峰值（dBFS） | `%output_rg_peak_db%` |

采样率和声道描述的是进入输出组件的音频；输出位深由组件报告，在输出组件没有提供位深时可能是估计值，并非硬件实测保证。数值补充对应的 Hz、bit、dB、dBFS 或 ms 单位，已带单位的内容不重复添加。零值和组件返回的 `-inf` 静音值会保留。

标签显示时每秒读取一次，切入标签及播放状态、音量变化时立即读取；仅内容变化才触发详情区重绘。长设备名和 DSP 内容会自动换行，可在正文区域滚轮浏览。切回 `Item details` 或脚本卸载时清理定时器。

停止播放后仍尝试读取组件可提供的字段，缺失显示 `No data`。前端不会用上次读取值补空，但组件自身可能返回缓存信息，因此停止时看到的值不代表设备仍在输出。

### 底部控制区

- 按钮行左侧提供停止、播放/暂停、上一首、下一首、Shuffle Tracks、Repeat Track 和添加文件按钮。
- 按钮行右侧依次显示静音按钮、dB 数值和音量条；静音按钮调用 foobar2000 原生 Mute。
- 音量大于 `-100 dB` 时显示 `volume_up`，等于 `-100 dB` 时显示 `volume_off`。手动将音量调到最低也使用后者。
- 最低音量在用户界面显示为 `−∞ dB`；内部仍使用 JSplitter 的 `-100 dB` 下限。
- Shuffle Tracks 与 Repeat Track 是播放顺序切换，并通过同一个播放顺序自然互斥。
- 其他播放顺序通过 foobar2000 原生 Playback 菜单选择；自绘控制区不提供播放顺序下拉框。
- 进度条支持点击定位、拖动预览和释放跳转；未知长度流媒体禁用跳转。
- 音量条支持点击、拖动和滚轮调节，轨道宽度按 DPI 缩放限制在 96–180px。
- 右键 dB 数值或音量条可切换曲线系数、虚拟宽度与混合模式，并调整当前模式的 `k`。
- 进度条上方的 Now Playing 文本始终跟随正在播放项目，不受列表选择影响；停止后留空。

## 音量条映射

音量条只改变 dB 值与滑块位置之间的换算，不改变 foobar2000 的 `-100…0 dB` 音量范围或音频处理。右键菜单提供三种持久化模式。

**曲线系数模式**保持原有公式：

```text
position = 10^((dB × k) / 20)
dB = 20 × log10(position) / k
```

曲线系数 `k` 默认值为 `0.5`。较小的值会把更多轨道长度分配给约 `-40～-10 dB` 的常用中低音量区间，代价是靠近 `0 dB` 的区间更紧凑。

**虚拟宽度模式**以标准振幅曲线为基础，将物理位置除以虚拟宽度倍率：

```text
physicalRatio = (x - left) / (width - 1)
virtualPosition = physicalRatio / k
dB = 20 × log10(virtualPosition)

physicalRatio = 10^(dB / 20) × k
```

虚拟宽度倍率默认值为 `1`。最左像素固定为 `−∞ dB`，最右像素固定为 `0 dB`；所有中间像素严格使用上述公式，点击与拖动完全一致。`k>1` 时最后一个中间像素和 `0 dB` 之间存在不可选断层，部分高音量值会共同绘制在最右端；`k<1` 时会提前达到 `0 dB`。这是虚拟宽度模式的预期行为，不进行平滑或重新归一化。

**混合模式**依次应用曲线系数和虚拟宽度倍率：

```text
position = 10^((dB × curveK) / 20) × virtualWidthK
dB = 20 × log10(position / virtualWidthK) / curveK
```

混合模式独立保存两个系数，默认 `curveK = 0.5`、`virtualWidthK = 1`。最左像素固定为 `−∞ dB`，最右像素固定为 `0 dB`，中间像素严格使用组合公式；虚拟宽度倍率造成的端点断层不做归一化。曲线系数越低，常用中低音量区间越精细；虚拟宽度倍率越高，中间像素步进越精细，但靠近 `0 dB` 的端点断层也越大。

三种模式的 `k` 均允许任意大于 `0` 的有限数字，输入框同时接受小数点和小数逗号。混合模式的两个系数可分别设置和重置。菜单中的“打开说明”会显示各模式的调整方向和混合公式。空值、非数字、`0`、负数和无穷值会被拒绝，原设置保持不变。切换模式或改变 `k` 只会重算滑块位置，不会主动修改当前 dB 值。

当前模式及各模式系数分别保存在 `jsplitterFusion.volume.mode`、`jsplitterFusion.volume.curveK`、`jsplitterFusion.volume.virtualWidthK`、`jsplitterFusion.volume.hybridCurveK` 和 `jsplitterFusion.volume.hybridVirtualWidthK`。升级后默认保持曲线系数模式；属性缺失或无效时会写入对应默认值，不执行迁移。旧版 `jsplitterFusion.volume.mapping` 属性不会删除，但已不再读取。滚轮仍调用 foobar2000 原生音量步进，不受模式或 `k` 影响。

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
| `volume.mode` | 音量映射模式：`curve`、`virtualWidth` 或 `hybrid` |
| `volume.curveK` | 音量条真实振幅曲线系数，必须为大于 `0` 的有限数字 |
| `volume.virtualWidthK` | 虚拟宽度倍率，必须为大于 `0` 的有限数字 |
| `volume.hybridCurveK` | 混合模式独立曲线系数，必须为大于 `0` 的有限数字 |
| `volume.hybridVirtualWidthK` | 混合模式独立虚拟宽度倍率，必须为大于 `0` 的有限数字 |

完整属性名需要加上 `jsplitterFusion.` 前缀。正常情况下应通过界面操作修改这些属性，而不是手动编辑配置文件。

## 源码结构

```text
main.js                         入口、回调注册和顶层错误保护
theme.js                        Fusion 调色板、字体、DPI 与控件尺寸
core/
  artwork.js                    封面请求、缓存和过期结果保护
  output-info.js                foo_outinfo 输出字段、单位与动态快照
  playlist-model.js             播放列表、显示上下文和详情数据
  settings.js                   面板属性读取、校验与迁移
  utils.js                      绘制、格式化和通用辅助函数
  volume-mapping.js             音量 dB 与滑块位置双向换算
views/
  app.js                        总体布局与事件分发
  playlist-manager.js           左侧播放列表管理器
  playlist-view.js              中央歌曲列表、列和选择交互
  right-pane.js                 封面、详情标签和输出信息轮询
  scrollbar.js                  横纵通用滚动条
  transport-controls.js         播放、静音、音量、播放顺序按钮与标题模板菜单
  bottom-bar.js                 进度与信息摘要
assets/
  transport-icons.png           播放控制图标精灵图
  README.md                     图标来源与精灵单元说明
tests/
  jsplitter-fusion-tests.js      Node.js 回归测试入口
  output-info-tests.js           输出字段、标签绘制及刷新生命周期测试
tools/
  generate-transport-icons.py   Material Icons 精灵图生成工具
```

`main.js` 使用相对路径按依赖顺序加载各模块。新增模块时需要同时更新入口加载顺序；模块通过 `FusionUI` 命名空间共享内部接口。

## 开发与验证

源码直接由 JSplitter 执行，没有打包步骤。修改完成后将仓库内容同步到运行目录，再重新加载面板或重启 foobar2000。

运行脚本中的中文和其他非 ASCII 字符使用 `\uXXXX` 转义，避免 File/include 加载时受系统代码页影响而显示乱码；README 和测试中的中文仍使用 UTF-8。输出详情测试会检查相关运行脚本的字节编码和中文值。

可先用 Node.js 对全部 JavaScript 文件进行语法检查：

```bash
find . -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

从仓库根目录运行回归测试：

```bash
node tests/jsplitter-fusion-tests.js
```

图标生成工具需要开发环境安装 Pillow，并要求显式传入 Material Icons Round 字体路径：

```bash
python tools/generate-transport-icons.py --font /path/to/MaterialIconsRound-Regular.otf
```

生成结果固定写入 `assets/transport-icons.png`；foobar2000 运行时不需要 Python、Pillow 或字体文件。

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
