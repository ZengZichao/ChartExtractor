# 贡献指南 (Contributing Guide)

感谢你考虑为 **ChartExtractor** 做出贡献。本项目是一个纯本地离线的图表数据提取桌面软件（Tauri v2 + React + TypeScript + Rust），以 GPL-3.0 许可证发布。

## 开发环境

- **Node.js** ≥ 22.12（vitest 5 的硬性要求；该约束由 `package.json` 的 `engines.node` 声明，CI 与本地统一从 `.nvmrc` 读取）
- **Rust** 1.90（含 `rustfmt`、`clippy`；由 `src-tauri/rust-toolchain.toml` 锁定，CI 与本地使用同一版本）
- 推荐操作系统：macOS 10.15+（当前主要支持平台）

> Node 版本低于 22.12 时 `npm install` 会打印 `EBADENGINE` 警告但**不会失败**，
> 容易在本地漏掉。CI 已锁定 `22.12` 以保证与本地一致。
>
> Rust 侧的 MSRV 同样是真实约束：`Cargo.toml` 里的 `rust-version = "1.90"` 与
> `rust-toolchain.toml` 的 `channel = "1.90"` 一致，并由 CI 每次实际编译验证。
> 依赖 `tauri` 2.12.x / `tauri-build` 2.7.x 要求 rustc ≥ 1.90，不要下调。

## 本地搭建

```bash
npm install
npm run dev          # 前端开发（Vite，端口 5173）
```

构建桌面应用：

```bash
npm run package      # tauri build，生成 .app
```

### 已知问题：批量升级依赖时 npm 可能崩溃

`xlsx` 依赖指向 SheetJS 官方 CDN tarball（`cdn.sheetjs.com`）而非 npm registry。
这条远程 tarball 会触发 npm arborist 的已知缺陷：

```
npm error Cannot read properties of null (reading 'edgesOut')
```

表现为 `npm update`、以及一次安装多个 devDependencies 时直接失败。
绕过方式（二选一）：

```bash
# 方式一：逐个安装
npm install --save-dev vite@^8.3.1
npm install --save-dev vitest@^5.0.2

# 方式二：加 --legacy-peer-deps
npm install --save-dev vitest@5.0.2 --legacy-peer-deps
```

`npm install`（不带版本号）与 `npm ci` 不受影响，可正常使用。

## 常用命令

前端：

| 命令                   | 说明                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run typecheck`    | TypeScript 严格类型检查                                          |
| `npm test`             | Prettier 格式检查 + vitest 单测 + 离线隐私扫描 + i18n 一致性扫描 |
| `npm run lint:offline` | 校验前端无任何出站网络调用                                       |
| `npm run lint:i18n`    | 校验中英双语文案一致性                                           |
| `npm run format`       | 用 Prettier 原地格式化                                           |
| `npm run format:check` | 只检查格式不写入（等同 `npm test` 的第一段）                     |

Rust（下列命令均从仓库根目录执行，会自动定位 `src-tauri/Cargo.toml`）：

| 命令                | 说明                                   |
| ------------------- | -------------------------------------- |
| `npm run test:rs`   | `cargo test`，Rust 命令层单测          |
| `npm run lint:rs`   | `cargo clippy -D warnings`，警告即失败 |
| `npm run format:rs` | `cargo fmt`，按 rustfmt 规范原地格式化 |

## 代码规范

- 前端遵循 **TypeScript strict** 模式。
- 排版由 **Prettier** 统一（配置见 `.prettierrc`，printWidth 100），由 **rustfmt** 统一 Rust 排版。
  两者都已在 CI 中设为强制门禁：格式不符会直接让 CI 失败。
- 提交前请确保以下命令全部通过，它们与 CI 的门禁一一对应：

  ```bash
  npm test          # 格式 + vitest + 离线隐私 + i18n
  npm run typecheck
  npm run lint:rs   # clippy
  npm run test:rs   # cargo test
  ```

- 新增界面文案须同时提供中文与英文（见 `src` 内 i18n 资源）。

## 分支与提交流程

1. Fork 本仓库并基于 `main` 创建特性分支（`feat/xxx`、`fix/xxx`）。
2. 保持提交小而聚焦，信息清晰。
3. 提交 Pull Request 到 `main`，并在 PR 模板中勾选自检项。
4. 至少通过 CI 后方可合并。CI 分两个 job，任一失败都不可合并：
   - `Lint & Test`：Prettier 格式、Rust 格式、clippy、类型检查、前端单测、Rust 单测
   - `Build & Scan`：完整构建 Tauri `.app`

## 许可证说明

本项目以 **GPL-3.0** 发布，许可证正文见 [`LICENSE`](LICENSE)，本项目的版权与免责声明声明见 [`COPYRIGHT`](COPYRIGHT)。
提交贡献即表示你同意以相同许可证授权你的贡献。
如果你引入了第三方代码，请确保其许可证与 GPL-3.0 兼容，并在对应位置注明出处。
