## 描述 (Description)

<!-- 简要说明本 PR 解决的问题与所做的改动 -->

## 关联 Issue

<!-- 例如 Closes #12 -->

## 自检清单 (Checklist)

以下每一项都对应 CI 的一个门禁，不通过则无法合并：

- [ ] `npm test` 通过（Prettier 格式检查 + vitest + 离线隐私扫描 + i18n 扫描）
- [ ] `npm run typecheck` 通过
- [ ] `npm run lint:rs` 通过（`cargo clippy -D warnings`）
- [ ] `npm run test:rs` 通过（`cargo test`，Rust 命令层单测）
- [ ] `npm run format` / `npm run format:rs` 已执行，提交内容符合 Prettier 与 rustfmt
- [ ] 新增/修改的界面文案已同时提供中文与英文
- [ ] 如涉及 Rust 改动，未下调 `Cargo.toml` 的 `rust-version`（当前锁定 1.90）
- [ ] 更新了相关文档（README / docs / CHANGELOG）

## 额外说明

<!-- 任何需要审阅者注意的点，例如破坏性变更、待讨论项 -->
