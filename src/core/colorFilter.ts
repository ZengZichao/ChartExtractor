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
 * 颜色分割 / 二值化模块
 * Clean-room 实现，借鉴 WPD autoDetection.js 的 RGB 距离阈值思想
 * 思想来源：WPD core/autoDetection.js（generateBinaryData 方法）
 *
 * 同时借鉴 Engauge ColorFilter 多模式阈值思想（强度/色相/饱和度/明度/前景）
 *
 * （架构评审报告 H1）
 * - BinaryData 由 `Set<number>` 改为 `Uint8Array` 位图（1=匹配像素），
 * 消除 16M 像素级 Set 的内存与查找开销，并支持分块异步扫描避免主线程硬冻结。
 */
import { colorDistance } from "./mathUtils";
import type { ColorDetectionParams } from "../types";
/**
 * 二值化位图：长度 = width*height 的 Uint8Array，1 表示该像素被匹配，0 表示未匹配。
 * 相比 Set<number>，内存占用从 每个像素一个对象槽降为 1 字节，且支持索引随机访问与分块并行扫描。
 */
export type BinaryData = Uint8Array;
/** 让出主线程一小段时间，避免大图扫描期间 UI 硬冻结（方案 B：分块 yields） */
export function yieldToMain(): Promise<void> {
  // 优先使用 requestIdleCallback，回退到 setTimeout(0)
  return new Promise<void>((resolve) => {
    const ric = (globalThis as any).requestIdleCallback;
    if (typeof ric === "function") {
      ric(() => resolve, { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
/**
 * 颜色过滤器
 * 基于 RGB 欧氏距离阈值进行前景/背景分割
 */
/**
 * 默认前景色
 */
export const DEFAULT_FG_COLOR: [number, number, number] = [0, 0, 200];
export class ColorFilter {
  private params: ColorDetectionParams;
  constructor(params?: Partial<ColorDetectionParams>) {
    this.params = {
      fgColor: DEFAULT_FG_COLOR,
      bgColor: [255, 255, 255],
      colorDistance: 120,
      mode: "foreground",
      ...params,
    };
  }
  setParams(params: Partial<ColorDetectionParams>): void {
    this.params = { ...this.params, ...params };
  }
  getParams(): ColorDetectionParams {
    return { ...this.params };
  }
  /** 单像素匹配判断 */
  private isMatch(r: number, g: number, b: number, a: number): boolean {
    // 透明像素视为白色背景
    let rr = r,
      gg = g,
      bb = b;
    if (a === 0) {
      rr = 255;
      gg = 255;
      bb = 255;
    }
    const threshold = this.params.colorDistance;
    const refColor =
      this.params.mode === "foreground"
        ? this.params.fgColor
        : this.params.bgColor;
    const dist = colorDistance(
      rr,
      gg,
      bb,
      refColor[0],
      refColor[1],
      refColor[2],
    );
    return this.params.mode === "foreground"
      ? dist <= threshold
      : dist >= threshold;
  }
  /**
   * 生成二值化数据（同步全图扫描）
   * @param imageData Canvas ImageData
   * @param mask 可选掩码区域（Uint8Array），仅处理掩码内像素；为空则处理全图
   * @returns 匹配的像素索引位图（1=匹配）
   */
  generateBinaryData(imageData: ImageData, mask?: BinaryData): BinaryData {
    const totalPixels = imageData.data.length / 4;
    const binaryData = new Uint8Array(totalPixels);
    const data = imageData.data;
    if (mask && mask.length > 0) {
      for (let idx = 0; idx < totalPixels; idx++) {
        if (!mask[idx]) continue;
        const i = idx * 4;
        if (this.isMatch(data[i], data[i + 1], data[i + 2], data[i + 3])) {
          binaryData[idx] = 1;
        }
      }
    } else {
      for (let idx = 0; idx < totalPixels; idx++) {
        const i = idx * 4;
        if (this.isMatch(data[i], data[i + 1], data[i + 2], data[i + 3])) {
          binaryData[idx] = 1;
        }
      }
    }
    return binaryData;
  }
  /**
   * 生成二值化数据（异步分块扫描）——大图（≥2000px）下每处理若干行让出主线程，
   * 避免界面硬冻结。
   * @param imageData Canvas ImageData
   * @param mask 可选掩码区域；为空则处理全图
   * @param chunkRows 每个分块处理的行数（默认 256 行），越小让出越频繁
   * @param onProgress 进度回调（0..1， 进度条）
   * @param shouldCancel 取消判定（ 取消按钮）
   */
  async generateBinaryDataAsync(
    imageData: ImageData,
    mask?: BinaryData,
    chunkRows = 256,
    onProgress?: (ratio: number) => void,
    shouldCancel?: () => boolean,
  ): Promise<BinaryData> {
    const width = imageData.width;
    const height = imageData.height;
    const totalPixels = width * height;
    const binaryData = new Uint8Array(totalPixels);
    const data = imageData.data;
    if (mask && mask.length > 0) {
      // P2-12 修复：掩码也可能很大，使用分块异步处理而非同步
      const width = imageData.width;
      const height = imageData.height;
      const chunkRows = 256;
      for (let rowStart = 0; rowStart < height; rowStart += chunkRows) {
        if (shouldCancel?.()) throw new Error("cancelled");
        const rowEnd = Math.min(rowStart + chunkRows, height);
        for (let yi = rowStart; yi < rowEnd; yi++) {
          let idx = yi * width;
          for (let xi = 0; xi < width; xi++, idx++) {
            if (!mask[idx]) continue;
            const i = idx * 4;
            if (this.isMatch(data[i], data[i + 1], data[i + 2], data[i + 3])) {
              binaryData[idx] = 1;
            }
          }
        }
        if (onProgress) onProgress(Math.min(1, (rowEnd / height) * 0.5));
        await yieldToMain();
      }
      return binaryData;
    }
    const threshold = this.params.colorDistance;
    const refColor =
      this.params.mode === "foreground"
        ? this.params.fgColor
        : this.params.bgColor;
    const refR = refColor[0],
      refG = refColor[1],
      refB = refColor[2];
    const mode = this.params.mode;
    for (let rowStart = 0; rowStart < height; rowStart += chunkRows) {
      if (shouldCancel?.()) throw new Error("cancelled");
      const rowEnd = Math.min(rowStart + chunkRows, height);
      for (let yi = rowStart; yi < rowEnd; yi++) {
        let i = yi * width * 4;
        for (let xi = 0; xi < width; xi++, i += 4) {
          let r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          const a = data[i + 3];
          if (a === 0) {
            r = 255;
            g = 255;
            b = 255;
          }
          const dr = r - refR,
            dg = g - refG,
            db = b - refB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          const match =
            mode === "foreground" ? dist <= threshold : dist >= threshold;
          if (match) binaryData[yi * width + xi] = 1;
        }
      }
      if (onProgress) onProgress(Math.min(1, (rowEnd / height) * 0.5));
      // 让出主线程，保持 UI 响应
      await yieldToMain();
    }
    return binaryData;
  }
  /**
   * 从图像中拾取颜色（用于前景色选择）
   */
  static pickColor(
    imageData: ImageData,
    px: number,
    py: number,
  ): [number, number, number] {
    const w = imageData.width;
    const h = imageData.height;
    const cx = Math.max(0, Math.min(w - 1, Math.floor(px)));
    const cy = Math.max(0, Math.min(h - 1, Math.floor(py)));
    const idx = (cy * w + cx) * 4;
    const data = imageData.data;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }
  /**
   * 从图像中获取主要颜色（简单颜色量化）
   * 思想来源：WPD colorAnalysis.js（贪心聚类 ColorGroup）
   */
  static getTopColors(
    imageData: ImageData,
    tolerance = 120,
    maxColors = 10,
  ): Array<{ color: [number, number, number]; count: number }> {
    const data = imageData.data;
    const groups: Array<{ color: [number, number, number]; count: number }> =
      [];
    const step = Math.max(1, Math.floor(Math.sqrt(data.length / 4 / 10000))); // 降采样
    for (let idx = 0; idx < data.length / 4; idx += step) {
      const i = idx * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) {
        r = 255;
        g = 255;
        b = 255;
      }
      // 查找是否已有相似颜色组
      let found = false;
      for (const group of groups) {
        const dist = colorDistance(
          r,
          g,
          b,
          group.color[0],
          group.color[1],
          group.color[2],
        );
        if (dist < tolerance) {
          // 合并到该组（更新平均颜色）
          const totalCount = group.count + 1;
          group.color[0] = Math.round(
            (group.color[0] * group.count + r) / totalCount,
          );
          group.color[1] = Math.round(
            (group.color[1] * group.count + g) / totalCount,
          );
          group.color[2] = Math.round(
            (group.color[2] * group.count + b) / totalCount,
          );
          group.count = totalCount;
          found = true;
          break;
        }
      }
      if (!found && groups.length < maxColors * 3) {
        groups.push({ color: [r, g, b], count: 1 });
      }
    }
    // 按像素数排序，返回 Top N
    groups.sort((a, b) => b.count - a.count);
    return groups.slice(0, maxColors);
  }
  /**
   * 将二值化数据可视化为 ImageData（用于掩码预览）
   */
  static binaryToImageData(
    binaryData: BinaryData,
    width: number,
    height: number,
  ): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    // 默认透明背景
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
    // 匹配像素显示为红色半透明
    for (let idx = 0; idx < binaryData.length; idx++) {
      if (binaryData[idx] !== 1) continue;
      data[idx * 4] = 255;
      data[idx * 4 + 1] = 0;
      data[idx * 4 + 2] = 0;
      data[idx * 4 + 3] = 180;
    }
    return new ImageData(data, width, height);
  }
}
