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
- **Rust MSRV 修正为 1.90**：`Cargo.toml` 此前声明 `rust-version = "1.77"`，但
  `tauri` 2.12.x 与 `tauri-build` 2.7.x 均要求 rustc ≥ 1.90，声明值与实际要求
  相差 13 个版本且从未被验证。新增 `src-tauri/rust-toolchain.toml` 锁定工具链，
  CI 与本地使用同一版本，MSRV 从此由 CI 实际编译验证。
- **Node 版本单一来源**：新增 `.nvmrc`，`ci.yml` / `release.yml` 改用
  `node-version-file` 读取，不再各自硬编码。
- **CI 拆分并提速**：拆为 `Lint & Test`（格式 / clippy / 类型 / 单测）与
  `Build & Scan`（完整打包）两个 job，格式与 lint 失败可在数分钟内暴露，
  不必等 `tauri build` 跑完。
- **prettier 正式接入**：此前 prettier 仅在 `devDependencies` 声明、被 Dependabot
  反复升级，但仓库无任何脚本调用、无配置文件、CI 也不检查，等于一把从未被用过的梳子。
  现补齐 `.prettierrc` / `.prettierignore` 与 `format` / `format:check` 脚本，
  并纳入 `npm test` 与 CI 门禁。
- **Release 改为自动发布**：`release.yml` 此前写死 `draft: true`，打 tag 只生成草稿、
  不公开发布且无任何通知（v0.1.0 当初即手动补发布）。现改为 `draft: false`。
- **所有第三方 Action 锁定 commit SHA**：`actions/checkout`、`actions/setup-node`、
  `actions/cache`、`dtolnay/rust-toolchain`、`softprops/action-gh-release` 此前引用
  可变 tag（`@v4` / `@1.90` / `@v2`），仓库的 Actions 权限也未要求 SHA 锁定，
  存在「tag 被劫持即向 CI 注入任意代码」的供应链风险。现全部 pin 到完整 SHA，
  由 Dependabot 的 github-actions 段以聚合 PR 继续更新。

### 修复

- **Rust 侧恢复 CI 门禁**：`commands.rs` 中一直存在 4 个 `#[test]`，`CONTRIBUTING.md`
  与 PR 模板也都要求 `cargo test`，但 `ci.yml` 里**一条 cargo 命令都没有**——
  Rust 回归可以全绿合入，PR 模板的勾选项形同虚设。现已接入 `cargo test`、
  `cargo fmt --check` 与 `cargo clippy -D warnings`。
- **修复 clippy 告警**：`list_recent_files` 中的 `sort_by` 改为 `sort_by_key`，
  使 `-D warnings` 门禁可通过。
- **消除 CI 重复运行**：`ci.yml` 的 `on: push` 未限定分支，功能分支推送会同时命中
  `push` 与 `pull_request`，同一 commit 跑两遍（实测 35 个 commit 产生 54 次 CI 运行，
  其中 19 个重复）。现限定为 `push: branches: [main]`。
- **补齐 workflow 健壮性**：`ci.yml` 增加 `permissions: contents: read`、
  `concurrency`（取消过时运行）与 `timeout-minutes`；`release.yml` 同样补齐。
  `macOS` runner 上 `tauri build` 带 lto，此前挂起会一直烧到 6 小时上限。
- **Dependabot 补上 GitHub Actions 生态**：此前 `ci.yml` / `release.yml` 中用到的
  `actions/checkout`、`actions/setup-node`、`actions/cache`、
  `softprops/action-gh-release` 与 `dtolnay/rust-toolchain` 完全没有升级通道。
  新增该段但**刻意不屏蔽 major**——action 的 major 升级常是必须跟进的
  （旧 Node 运行时弃用后 action 会直接失败），与 npm / cargo 屏蔽 major 的理由相反；
  风险由 `groups` 收敛为单个 PR。
- **修复 LICENSE 无法被识别**：版权声明块原本置于 GPL-3.0 正文之前，导致 GitHub 的
  `licenseInfo.spdx_id` 退化为 `NOASSERTION`、仓库页不显示许可证徽章。
  现将声明移入独立的 [`COPYRIGHT`](COPYRIGHT)，`LICENSE` 只保留未经改动的 GPL-3.0 全文。
- **修复 SECURITY.md 的私密上报流程**：文档在「私密上报」标题下却提供了
  「在公开 Issue 中提交」这条路径，安全报告一旦发到 Issue 即已公开。现已移除，
  只保留 GitHub 私有安全公告渠道。
- **终结 Dependabot 的 glib 更新死循环**：glib 安全告警（GHSA-wrw7-89jp-8q8g，
  迭代器 soundness，修复版要求 ≥0.20.0）被 tauri 2.x 的 gtk-rs 0.18 依赖链锁死，
  Dependabot 每轮报 `security_update_not_possible`，Actions 页面常红。
  现于 `dependabot.yml` 忽略 glib，并在仓库设置中按 tolerable_risk dismiss 该告警
  （漏洞代码只在 Linux GTK 依赖链上编译，macOS 产物不包含；tauri 迁移后应重新评估）。
- **Release 缓存瘦身**：`release.yml` 的 `actions/cache` 此前把 `node_modules` 一并
  缓存，但 `npm ci` 每次都会先删光该目录，这份缓存从未被真正复用。现改为
  `setup-node` 的 `cache: "npm"` 托管 npm 下载缓存，`actions/cache` 只保留 cargo 目录。
- 缓存 `cargo` 依赖目录，缩短 CI 冷启动时间。
- 文档中的 Node 版本要求与实际约束对齐。
- 新增 `.editorconfig` 与 `.github/CODEOWNERS`。
- 全仓库按 Prettier（printWidth 100）与 rustfmt 统一排版。

### 更早的修复（保留记录）

- `dependabot.yml` 增加 `groups`：按生态聚合为单个 PR。`Cargo.lock` 与
  `package-lock.json` 均为单文件锁，此前会同时开出多个互相冲突的 PR。
- `ci.yml` / `release.yml` 的 Node 版本由 `'22'` 固定为 `'22.12'`，消除 engine 漂移。
- CI 单测步骤由 `npx vitest run` 改为 `npm test`，使离线隐私红线与 i18n
  一致性扫描在 CI 中真正执行（此前被绕过）。

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
