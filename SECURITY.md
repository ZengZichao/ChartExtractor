# 安全政策 (Security Policy)

## Supported Versions

| 版本  | 安全更新支持 |
| ----- | ------------ |
| 0.1.x | ✅ 支持      |

## 漏洞上报 (Reporting a Vulnerability)

ChartExtractor 是一个**纯本地离线运行**的桌面工具，所有图像解析、数据提取与导出均在用户本机完成，**不发起任何网络请求**，因此不存在服务端远程攻击面。

若你发现安全相关的问题（例如：本地文件处理中的路径穿越、反序列化缺陷、依赖项已知漏洞等），请通过 GitHub 私有安全公告**私密**上报：

- **唯一推荐渠道**：在仓库的 **Security → Report a vulnerability** 提交私有安全公告。

> 此前这里还提供过「或在 Issue 中提交并明确标注 `security`」这条路径。
> 已移除：Issue 是公开的，安全报告一旦发到 Issue 就不再是私密报告，
> 等于在漏洞修复前主动公开了可被利用的细节。需要讨论非敏感问题时再开 Issue。

请尽量提供：

1. 受影响版本；
2. 复现步骤与环境（操作系统、架构）；
3. 潜在影响评估。

我们会在收到报告后 **7 个工作日内** 确认并评估，修复后通过 Release 与 CHANGELOG 公开致谢（如你愿意）。

## 依赖安全

项目依赖通过 `npm`（前端）与 `cargo`（Rust）管理。仓库已开启
**Dependabot security updates**：npm / cargo 依赖出现已知漏洞时，Dependabot 会直接开 PR 提醒。

需要手动复查时：

```bash
npm audit
cargo audit   # 需安装 cargo-audit
```
