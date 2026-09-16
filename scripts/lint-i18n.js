#!/usr/bin/env node
/**
 * lint-i18n.js —— 国际化与版本一致性红线
 *
 * 检查
 * 1. zh / en 字典键集合必须完全相等（缺任一语言即失败）
 * 2. src 下 .tsx / .ts 源码（注释、字典文件、测试除外）禁止出现中文字面量，
 * 防止「字典已写好却又硬编码中文」回归
 * 3. 提交前并行于 lint-offline（离线红线）执行，纳入 `npm test`
 *
 * 用法：node scripts/lint-i18n.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const TRANSLATIONS = path.join(SRC, "i18n", "translations.ts");
let failed = false;
const fail = (msg) => {
  console.error("✗ " + msg);
  failed = true;
};
// ---- 1) zh/en 键集合相等 ----
const src = fs.readFileSync(TRANSLATIONS, "utf8");
const zhBlock = src.slice(src.indexOf("zh: {"), src.indexOf("en: {"));
const enBlock = src.slice(src.indexOf("en: {"));
const keys = (block) =>
  [...block.matchAll(/^\s*['"]([a-zA-Z0-9_.]+)['"]\s*:/gm)]
    .map((m) => m[1])
    .filter(Boolean);
const zh = new Set(keys(zhBlock));
const en = new Set(keys(enBlock));
const missingEn = [...zh].filter((k) => !en.has(k));
const missingZh = [...en].filter((k) => !zh.has(k));
if (missingEn.length || missingZh.length) {
  fail(
    `字典键不平衡：en 缺 ${missingEn.length}（${missingEn.join(", ")}），zh 缺 ${missingZh.length}（${missingZh.join(", ")}）`,
  );
} else {
  console.log(`✓ 字典键集一致（${zh.size} 键 × 2 语言）`);
}
// ---- 2) 禁止 src 源码中的中文字面量（注释/字典/测试/视频帧除外） ----
const CJK = /[\u4e00-\u9fff]/;
const EXCLUDED = [
  "translations.ts",
  // 状态机原因桩：中文用于单测断言，显示时经 App 层 trReason 用 ux.reason.* 翻译
  "useUXMachine.ts",
  // 类型/常量定义（UX_STATE_LABEL 死代码保留排除；CALIB_ROLES 标签已改 i18n 键）
  "index.ts",
];
const EXT = [".ts", ".tsx"];
const intentionalWhitelist = [
  // 「中文」语言名在任意语言界面都保持原文（语言切换按钮）
  'title="中文"',
  'aria-label="中文"',
];
// 允许出现的「内部字符串」模式：非用户可见 UI 文案
// 注意：模式对单/双引号均兼容（源码为双引号风格，早期白名单仅匹配单引号导致漏放行）
const skipPatterns = [
  /description:\s*["'`]/, // undo/redo 命令描述（状态栏诊断信息，非 UI 文案）
  /makePointsCommand\(/, // 命令描述参数（内部诊断文本）
  /makeProjectCommand\(/, // 导入撤销命令描述
  /userError\(/, // userError 的 PDF 分支内部拼接
  /safeStartNewProject\(/, // 剪贴板粘贴的默认名（'截图粘贴'）
  /["']\u672a\u547d\u540d["']/, // '未命名' —— 无扩展名兜底文件名
  /["']\u622a\u56fe\u7c98\u8d34["']/, // '截图粘贴' —— 剪贴板粘贴的默认名
  /{\s*name:\s*["'`]|name:\s*["'`][\u4e00-\u9fff]/, // 原生对话框过滤器名（由系统对话框展示）
  /_\u6570\u636e\./, // '_数据.' 文件名后缀
  /["']\u56fe\u8868\u6570\u636e["']/, // '图表数据' —— 导出文件兜底名
  /originalFileName\s*\|\|/, // '工程' + '.prj' —— 保存工程兜底文件名
  /PDF \u89e3\u6790\u5931\u8d25/, // userError 内部 PDF 提示分支
  /preview\.kind\s*===/, // 检测预览命令描述（内部诊断文本）：曲线追踪/散点检测
  /^\s*`\$\{label\}/, // 检测预览命令描述拼接行（追加/替换）
  /^\s*`\u6dfb\u52a0\u70b9/, // 命令描述：添加点
  /^\s*`\u79fb\u52a8\u70b9/, // 命令描述：移动点
  /^\s*`\u5220\u9664\u70b9/, // 命令描述：删除点
  /^\s*`\u7f16\u8f91\u70b9/, // 命令描述：编辑点
  /^\s*`\u53bb\u9664\u7f51\u683c\u4f2a\u70b9/, // 命令描述：去除网格伪点
  /^\s*`\u6e05\u7a7a\u6570\u636e\u96c6/, // 命令描述：清空数据集
  /["']\u5220\u9664\u6700\u540e\u4e00\u4e2a\u70b9["']/, // 命令描述：删除最后一个点
  /^\s*`\u4e0d\u652f\u6301\u7684 Blob/, // 导出格式抛错信息（多行 template 内容行）
  /\u8f74\u6700\u5c0f\u503c|\u8f74\u6700\u5927\u503c/, // 标定点默认标签（随工程持久化，非 UI 文案）
  /console\.(error|log)/, // 日志输出（开发者终端信息）
  /throw new Error|new Error\(/, // 抛错/拒绝内部信息
  /["']\u6570\u636e["']/, // '数据' —— XLSX/CSV sheet 名兜底
  /\u6570\u636e\u96c6\$\{i \+ 1\}/, // projectNormalize 缺失数据集名兜底
  /\u65e0\u6cd5\u521b\u5efa\u753b\u5e03\u4e0a\u4e0b\u6587|\u751f\u6210\u793a\u4f8b\u56fe\u7247\u5931\u8d25/, // 画布/示例生成内部错误
  /\u793a\u4f8b\u56fe\u8868|\u65f6\u95f4 t|\u6e29\u5ea6 T|\u5b9e\u6d4b\u66f2\u7ebf|\u53c2\u8003\u7ebf/, // 示例工程内嵌图内容与轴标签
  /case\s+["']\u8bf7\u5148\u5bfc\u5165\u56fe\u50cf["']|case\s+["']\u5c1a\u672a\u53d6\u70b9\uff0c\u65e0\u6570\u636e\u53ef\u5bfc\u51fa["']|case\s+["']\u5f53\u524d\u72b6\u6001\u4e0d\u53ef\u8fbe["']|case\s+["']\u5f53\u524d\u4e0d\u53ef\u6267\u884c["']/, // trReason 匹配的状态机桩
  /\u8fd8\u9700\u6807\u5b9a|\u8fd8\u6709 /, // trReason needX 正则
];
function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (
      ent.isDirectory() &&
      !ent.name.startsWith(".") &&
      ent.name !== "node_modules"
    )
      out.push(...walk(p));
    else if (
      ent.isFile() &&
      EXT.includes(path.extname(ent.name)) &&
      !EXCLUDED.includes(ent.name)
    )
      out.push(p);
  }
  return out;
}
const files = walk(SRC).filter((f) => !f.includes(".test."));
let hits = 0;
let inBlock = false; // 跨行块注释状态
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (inBlock) {
      if (line.includes("*/")) inBlock = false;
      return; // 块注释内放行
    }
    // 剥离块注释（兼容跨行 JSDoc）
    const openIdx = line.indexOf("/*");
    if (openIdx >= 0) {
      const closeIdx = line.indexOf("*/", openIdx + 2);
      if (closeIdx < 0) {
        inBlock = true;
        return;
      }
      line = line.slice(0, openIdx) + line.slice(closeIdx + 2);
    }
    // 剥离行注释（含行尾内联注释），再判断残留的中文字面量
    const cleaned = line.replace(/\/\/.*$/g, "");
    if (!CJK.test(cleaned)) return;
    // 内部字符串白名单（非 UI 文案）放行
    if (skipPatterns.some((p) => p.test(cleaned))) return;
    // 显式白名单放行
    if (intentionalWhitelist.some((w) => line.includes(w))) return;
    // 语言切换按钮的短标签（「中」/「EN」，任意语言界面保持原文）
    if (cleaned.trim() === "中") return;
    hits++;
    const rel = path.relative(ROOT, file);
    if (hits <= 30)
      console.error(
        `✗ ${rel}:${i + 1} 含中文字面量: ${cleaned.trim().slice(0, 90)}`,
      );
  });
}
if (hits > 0) {
  fail(
    `源码中硬编码中文 ${hits} 处（上述列出前 30 处），请改用 t('...') 并确保键已入字典`,
  );
} else {
  console.log("✓ 源码中无硬编码中文（注释除外）");
}
if (failed) {
  console.error("\n❌ i18n 红线检查未通过");
  process.exit(1);
}
console.log("\n✅ i18n 红线检查通过");
