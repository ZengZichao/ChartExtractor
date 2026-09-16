/**
 * 离线隐私红线静态扫描
 * 扫描 src/ 下所有源码，禁止出现任何出站联网调用模式。
 * 与开发文档 1.4 节「代码审查硬规则」对齐，把隐私红线从「约定」变为 CI 卡点。
 *
 * 用法：npm run lint:offline
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const FORBIDDEN = [
  { re: /\bfetch\s*\(/, label: "fetch(" },
  { re: /XMLHttpRequest/, label: "XMLHttpRequest" },
  { re: /\bWebSocket\b/, label: "WebSocket" },
  { re: /net\s*\.\s*request/, label: "net.request" },
  { re: /\baxios\b/, label: "axios" },
  { re: /electron-updater/, label: "electron-updater" },
  { re: /\bsentry\b/i, label: "sentry" },
];
function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      acc.push(p);
    }
  }
}
const files = [];
walk(SRC, files);
let violations = 0;
for (const f of files) {
  const text = fs.readFileSync(f, "utf-8");
  for (const { re, label } of FORBIDDEN) {
    const m = text.match(re);
    if (m) {
      violations++;
      const line = text.slice(0, m.index).split("\n").length;
      console.error(
        `✗ ${path.relative(ROOT, f)}:${line} 禁止的联网模式: ${label}`,
      );
    }
  }
}
if (violations > 0) {
  console.error(
    `\n离线隐私红线扫描失败：${violations} 处违规（src/ 不得出现 fetch/XHR/WebSocket/net.request 等）`,
  );
  process.exit(1);
}
console.log(
  `✓ 离线隐私红线扫描通过：未发现 src/ 中的联网调用模式（扫描 ${files.length} 个文件）`,
);
