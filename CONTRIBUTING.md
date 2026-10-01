# 贡献指南 (Contributing Guide)

感谢你考虑为 **ChartExtractor** 做出贡献。本项目是一个纯本地离线的图表数据提取桌面软件（Tauri v2 + React + TypeScript + Rust），以 GPL-3.0 许可证发布。

## 开发环境

- **Node.js** ≥ 22.12（vitest 5 的硬性要求；该约束由 `package.json` 的 `engines.node` 声明）
- **Rust** stable 工具链（含 `macOS` 目标）
- 推荐操作系统：macOS 10.15+（当前主要支持平台）

> Node 版本低于 22.12 时 `npm install` 会打印 `EBADENGINE` 警告但**不会失败**，
> 容易在本地漏掉。CI 已锁定 `22.12` 以保证与本地一致。

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

| 命令 | 说明 |
| --- | --- |
| `npm run typecheck` | TypeScript 严格类型检查 |
| `npm test` | vitest 单测 + 离线隐私扫描 + i18n 一致性扫描 |
| `cargo test` | Rust 命令层单测（在 `src-tauri/` 下执行） |
| `npm run lint:offline` | 校验前端无任何出站网络调用 |
| `npm run lint:i18n` | 校验中英双语文案一致性 |

## 代码规范

- 前端遵循 **TypeScript strict** 模式；使用 **Prettier** 格式化。
- 提交前请确保 `npm test` 与 `npm run typecheck` 全部通过。
- 新增界面文案须同时提供中文与英文（见 `src` 内 i18n 资源）。

## 分支与提交流程

1. Fork 本仓库并基于 `main` 创建特性分支（`feat/xxx`、`fix/xxx`）。
2. 保持提交小而聚焦，信息清晰。
3. 提交 Pull Request 到 `main`，并在 PR 模板中勾选自检项。
4. 至少通过 CI（构建 + 扫描 + 单测）后方可合并。

## 许可证说明

本项目以 **GPL-3.0** 发布。提交贡献即表示你同意以相同许可证授权你的贡献。
如果你引入了第三方代码，请确保其许可证与 GPL-3.0 兼容，并在对应位置注明出处。
