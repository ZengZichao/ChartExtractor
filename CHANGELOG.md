# 更新日志 (Changelog)

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/) 规范，版本号遵循
[语义化版本 (SemVer)](https://semver.org/lang/zh-CN/)。

所有历史版本的二进制构建可在 [GitHub Releases](https://github.com/ZengZichao/ChartExtractor/releases) 获取。

## [Unreleased]

### 变更
- **依赖升级**：Tauri 全家桶对齐至 2.12.x（`tauri` 2.12.1 / `tauri-build` 2.7.1 /
  `tauri-plugin-dialog` 2.8.1 / `tauri-plugin-opener` 2.7.0），前端侧同步升级
  `vite` 8.3.1、`vitest` 5.0.2、`lucide-react` 1.49.0、`encoding_rs` 0.8.42 等。
  `tauri` 与 `tauri-build` 必须同版本联动，此前由 Dependabot 单独升级会导致 CI 构建失败。
- **Node 版本要求提高至 ≥ 22.12**（vitest 5 的硬性要求），此前未声明导致
  Node 20 环境下仅打印 `EBADENGINE` 警告。

### 修复
- `dependabot.yml` 增加 `groups`：按生态聚合为单个 PR。`Cargo.lock` 与
  `package-lock.json` 均为单文件锁，此前会同时开出多个互相冲突的 PR。
- `ci.yml` / `release.yml` 的 Node 版本由 `'22'` 固定为 `'22.12'`，消除 engine 漂移。
- CI 单测步骤由 `npx vitest run` 改为 `npm test`，使离线隐私红线与 i18n
  一致性扫描在 CI 中真正执行（此前被绕过）。
- 文档中的 Node 版本要求与实际约束对齐。

## [0.1.0] - 2026-09-16

### 新增
- 首次公开版本。
- **多格式导入**：支持常见图片格式与多页 PDF；支持拖拽打开与 `Ctrl/Cmd+V` 粘贴截图。
- **坐标标定**：在图上点击 4 个已知坐标点完成仿射标定，支持线性 / 对数（含负对数）刻度，可记录轴名称与单位。
- **曲线与散点追踪**：基于颜色分割掩码自动追踪曲线（逐列扫描）、检测散点（色块聚类），提供 X/Y 步长、平滑插值、直径过滤等参数；支持多曲线分离与散点按颜色分拣。
- **手动取点**：左键加点、右键删点或编辑，数据表格中可直接修改数值。
- **网格辅助**：自动检测图表网格线，辅助判断数据点位置。
- **批量处理**：选择文件夹后自动逐张导入图片，按当前标定参数提取并导出 CSV。
- **工程管理**：工程保存 / 打开（`.prj`）、自动保存与崩溃恢复、最近文件、多标签页、撤销 / 重做。
- **数据导出**：支持 xlsx / CSV / JSON；可选表头、元信息注释行（兼容 `pandas.read_csv(comment='#')`）与 GBK 编码。
- **中英双语界面**与**明暗主题**（跟随系统或手动切换）。
- **纯本地离线运行**：所有处理在本地完成，无任何网络请求（由 CI 离线红线扫描强制保证）。

[0.1.0]: https://github.com/ZengZichao/ChartExtractor/releases/tag/v0.1.0
