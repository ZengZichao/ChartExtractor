# ChartExtractor（图表数据提取器）

**简体中文** | [English](./README.en.md)

纯本地离线运行的图表数据提取桌面软件（Tauri v2 + React + TypeScript），帮助科研工作者从论文图表（位图 / PDF）中高效、可复现地提取数值数据。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
![Platform: macOS 10.15+](https://img.shields.io/badge/platform-macOS%2010.15%2B-lightgrey)
![Offline](https://img.shields.io/badge/network-100%25%20offline-success)

> 📖 **使用手册**：[简体中文](./docs/USAGE.zh.md) | [English](./docs/USAGE.en.md)

## 特性

- **纯本地离线**：所有处理在本地完成，数据不出本机，适合处理未发表或敏感数据。CI 内置离线红线扫描，禁止任何出站联网调用。
- **多格式导入**：支持常见图片格式与多页 PDF 导入；支持拖拽打开与 `Ctrl/Cmd+V` 粘贴截图。
- **坐标标定**：在图上点击 4 个已知坐标点即可完成标定，支持线性 / 对数（含负对数）仿射标定，可记录轴名称与单位。
- **曲线与散点追踪**：基于颜色分割掩码自动追踪曲线（逐列扫描）、检测散点（色块聚类），并提供 X/Y 步长、平滑插值、直径过滤等参数；支持多曲线分离提取与散点按颜色分拣。
- **手动取点**：左键加点、右键删点或编辑，数据表格中可直接修改数值。
- **网格辅助**：自动检测图表网格线，辅助判断数据点位置。
- **批量处理**：选择文件夹后自动逐张导入图片，按当前标定参数提取并导出 CSV。
- **工程管理**：工程保存 / 打开（`.prj`）、自动保存与崩溃恢复、最近文件、多标签页、撤销 / 重做。
- **数据导出**：支持 xlsx / CSV / JSON；可选表头、元信息注释行（兼容 `pandas.read_csv` 的 `comment='#'`）与 GBK 编码。
- **中英双语界面**：一键切换，界面文案完整覆盖。
- **明暗主题**：跟随系统，亦可手动切换。
- **Radix UI 组件体系**：基于 Radix UI Primitives + Lucide 图标，提供无障碍焦点管理、键盘导航和平滑动画。

## 安装

### 方式一：下载安装包（推荐）

前往 [GitHub Releases](https://github.com/ZengZichao/ChartExtractor/releases) 下载对应平台的安装包（macOS 提供 `.dmg` / `.app`）。

### 方式二：从源码构建

前置要求：Node.js ≥ 22（或 ≥ 20.19）、Rust stable 工具链（含对应平台目标）。

```bash
npm install
npm run package   # tauri build，生成对应平台的安装包（macOS 为 .app）
```

macOS 可进一步生成 DMG 与签名公证：

```bash
scripts/create-dmg.sh   # 用系统 hdiutil 免交互生成 DMG（无需第三方工具）
scripts/notarize.sh     # Developer ID 签名 + 公证 + 盖章（需自行配置证书与环境变量）
```

## 快速上手

1. **导入**：拖入 / 打开图表图片或 PDF，或 `Ctrl/Cmd+V` 粘贴截图。
2. **标定**：在图上依次点击 4 个已知坐标的位置（Xmin / Xmax / Ymin / Ymax），选择线性或对数刻度并填入数值。
3. **取点**：左键手动加点；或用「颜色分割 → 追踪曲线 / 检测散点」自动提取。
4. **校正与导出**：在数据表格中校正数值，导出为 xlsx / CSV / JSON。

更多细节（批量处理、工程管理、快捷键、常见问题等）请阅读**[使用手册](./docs/USAGE.zh.md)**。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Cmd/Ctrl + O` | 导入图片 / PDF |
| `Cmd/Ctrl + S` | 保存工程 |
| `Cmd/Ctrl + Z` | 撤销 |
| `Shift + Cmd/Ctrl + Z` | 重做 |
| `Delete` | 删除最后一个点 |
| `空格 / 拖拽` | 平移画布 |
| `滚轮` | 缩放画布 |
| `F1` | 帮助 |

## 隐私与安全

- 全部图像解析、数据提取与导出均在本地完成，**无任何网络请求**；`src/` 中的 `fetch` / `XHR` / `WebSocket` 等出站调用模式被 CI 硬规则直接拒绝（`npm run lint:offline`）。
- 工程与自动保存文件仅写入本机应用数据目录。

## 开发

- 前端：React + TypeScript + Vite
- UI 组件：Radix UI Primitives（shadcn 风格）+ Lucide React 图标
- 桌面壳：Tauri v2（Rust）
- 常用命令：

```bash
npm run dev          # 前端开发（Vite，端口 5173）
npm run typecheck    # TypeScript 严格类型检查
npm test             # vitest 单测 + 离线隐私扫描 + i18n 一致性扫描
npm run package      # 构建 .app（tauri build）
cargo test           # Rust 命令层单测（在 src-tauri/ 下执行）
```

## 许可证

Copyright © 2026 Zichao Zeng

本项目以 GNU General Public License v3.0（GPL-3.0）发布。你可以自由使用、修改和分发本软件，但任何分发或衍生作品同样必须以 GPL-3.0 开源。详见 [`LICENSE`](./LICENSE)。

## 致谢

本软件的曲线追踪、网格检测、散点检测与坐标标定算法，是在 **WebPlotDigitizer（WPD，GPL-3.0）** 公开算法思想基础上的独立 clean-room 实现，未复制其源代码。感谢 WPD 作者 Ankit Rohatgi 的开创性工作；当用户需要更完整的图表类型支持时，建议参考原项目：

- WebPlotDigitizer: <https://github.com/automeris-io/WebPlotDigitizer>

## 引用

若本工具对你的研究有帮助，欢迎以下述方式引用（待 Zenodo 归档后将补充 DOI）：

```bibtex
@software{zeng2026chartextractor,
  author = {Zeng, Zichao},
  title  = {ChartExtractor: an offline chart data extraction tool},
  year   = {2026},
  url    = {https://github.com/ZengZichao/ChartExtractor}
}
```

---

_ChartExtractor 是一个面向科研场景的轻量工具，专注于离线隐私与双语（中/英）界面体验。_
