// Copyright (C) 2026 Zichao Zeng
//
// This file is part of ChartExtractor.
// ChartExtractor is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// ChartExtractor is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
// (see <https://www.gnu.org/licenses/>)
/**
 * PDF 导入服务
 * 使用本地 pdfjs-dist 将 PDF 页面渲染为图片，全程离线、无网络请求。
 *
 * - 懒加载：仅在导入 PDF 时才动态 import pdfjs，不影响首屏。
 * - 单页渲染：渲染指定页（默认第 1 页）；多页时由调用方提示用户分页导入。
 * - 离线安全：worker 脚本经 Vite `?url` 打包为本地资源；任何失败均向上抛出，
 * 由 UI 层给出「解析失败，请另存为图片」的兜底提示，绝不静默崩溃。
 */
export interface PdfImportResult {
  blob: Blob; // 渲染后的图片（PNG）
  numPages: number; // PDF 总页数
  page: number; // 实际渲染的页号
}
/** 将 PDF 字节渲染为图片 */
export async function importPdf(
  bytes: Uint8Array,
  pageNumber = 1,
): Promise<PdfImportResult> {
  // 动态导入，确保仅在使用 PDF 时加载 pdfjs（懒加载）
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerMod: any =
    await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  try {
    const pageNum = Math.min(Math.max(1, pageNumber), doc.numPages);
    const page = await doc.getPage(pageNum);
    // P1-4: 自适应缩放 — 根据目标面积上限动态计算 scale，超限时降采样
    const MAX_CANVAS_AREA = 16_000_000; // 16M 像素上限（避免 WKWebView canvas 面积超限）
    const baseViewport = page.getViewport({ scale: 1 });
    let scale = 2; // 默认 2x
    const areaAt2x = baseViewport.width * 2 * baseViewport.height * 2;
    if (areaAt2x > MAX_CANVAS_AREA) {
      scale = Math.sqrt(MAX_CANVAS_AREA / (baseViewport.width * baseViewport.height));
      scale = Math.max(1, scale); // 至少 1x
    }
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PDF 页面渲染失败"))),
        "image/png",
      );
    });
    return { blob, numPages: doc.numPages, page: pageNum };
  } finally {
    // 释放 pdfjs 内部文档资源
    await doc.destroy().catch(() => {});
  }
}
