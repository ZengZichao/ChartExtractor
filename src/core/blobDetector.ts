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
 * 散点检测模块（连通域标记）
 * Clean-room 实现，借鉴 WPD blobdetector.js 的连通域标记、质心算法思想
 * 思想来源：WPD core/curve_detection/blobdetector.js
 *
 * 算法流程
 * 1. 8 邻域洪水填充标记连通域
 * 2. 计算每个连通域的质心、面积、二阶矩
 * 3. 按直径阈值过滤
 */
import type { BinaryData } from "./colorFilter";
import { yieldToMain } from "./colorFilter";
export interface BlobDetectorParams {
  minDiameter: number; // 最小直径（像素）
  maxDiameter: number; // 最大直径（像素）
}
export interface BlobResult {
  centroid: { x: number; y: number };
  area: number;
  moment: number;
  diameter: number;
}
export class BlobDetector {
  private params: BlobDetectorParams;
  constructor(params?: Partial<BlobDetectorParams>) {
    this.params = {
      minDiameter: 0,
      maxDiameter: 5000,
      ...params,
    };
  }
  setParams(params: Partial<BlobDetectorParams>): void {
    this.params = { ...this.params, ...params };
  }
  getParams(): BlobDetectorParams {
    return { ...this.params };
  }
  /**
   * 执行散点检测
   * @param binaryData 二值化数据
   * @param imageWidth 图像宽度
   * @param imageHeight 图像高度
   * @returns 检测到的散点列表
   */
  detect(
    binaryData: BinaryData,
    imageWidth: number,
    imageHeight: number,
  ): BlobResult[] {
    const dw = imageWidth;
    const dh = imageHeight;
    const visited = new Uint8Array(dw * dh);
    const blobs: BlobResult[] = [];
    if (dw <= 0 || dh <= 0 || binaryData.length === 0) return blobs;
    // 遍历所有像素，找连通域
    for (let startIdx = 0; startIdx < binaryData.length; startIdx++) {
      if (binaryData[startIdx] !== 1 || visited[startIdx]) continue;
      // BFS 洪水填充（指针队列 O(1) 出队，避免 Array.shift 的 O(n) 成本）
      const queue: number[] = [startIdx];
      let head = 0;
      visited[startIdx] = 1;
      // P2-4 修复：使用增量平方和统计二阶矩，避免存储全部像素坐标
      let sumX = 0;
      let sumY = 0;
      let sumX2 = 0;
      let sumY2 = 0;
      let count = 0;
      while (head < queue.length) {
        const idx = queue[head++];
        const xi = idx % dw;
        const yi = Math.floor(idx / dw);
        sumX += xi;
        sumY += yi;
        sumX2 += xi * xi;
        sumY2 += yi * yi;
        count++;
        // 8 邻域
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nxi = xi + dx;
            const nyi = yi + dy;
            if (nxi < 0 || nyi < 0 || nxi >= dw || nyi >= dh) continue;
            const nidx = nyi * dw + nxi;
            if (!visited[nidx] && binaryData[nidx] === 1) {
              visited[nidx] = 1;
              queue.push(nidx);
            }
          }
        }
      }
      // 计算质心
      const cx = sumX / count;
      const cy = sumY / count;
      // 计算二阶矩（增量平方和公式：Σ(x-cx)² = Σx² - n*cx²）
      const moment = sumX2 - count * cx * cx + sumY2 - count * cy * cy;
      // 计算直径
      const diameter = 2.0 * Math.sqrt(count / Math.PI);
      // 按直径阈值过滤
      if (
        diameter <= this.params.maxDiameter &&
        diameter >= this.params.minDiameter
      ) {
        blobs.push({
          centroid: { x: cx + 0.5, y: cy + 0.5 },
          area: count,
          moment,
          diameter,
        });
      }
    }
    return blobs;
  }
  /**
   * 散点检测（异步分块版本)
   * 与 detect 算法一致，但扫描过程分块让出主线程，并支持进度回调与取消。
   */
  async detectAsync(
    binaryData: BinaryData,
    imageWidth: number,
    imageHeight: number,
    onProgress?: (ratio: number) => void,
    shouldCancel?: () => boolean,
  ): Promise<BlobResult[]> {
    const dw = imageWidth;
    const dh = imageHeight;
    const visited = new Uint8Array(dw * dh);
    const blobs: BlobResult[] = [];
    if (dw <= 0 || dh <= 0 || binaryData.length === 0) return blobs;
    const total = binaryData.length;
    const chunk = Math.max(1 << 18, dw * 32); // 每处理约 1/4 百万像素让出一次
    let processed = 0;
    for (let startIdx = 0; startIdx < total; startIdx++) {
      if (shouldCancel?.()) throw new Error("cancelled");
      if (startIdx - processed >= chunk) {
        processed = startIdx;
        if (onProgress) onProgress(Math.min(0.95, startIdx / total));
        await yieldToMain();
      }
      if (binaryData[startIdx] !== 1 || visited[startIdx]) continue;
      // BFS 洪水填充（指针队列 O(1) 出队，避免 Array.shift 的 O(n) 成本）
      const queue: number[] = [startIdx];
      let head = 0;
      visited[startIdx] = 1;
      // P2-4 修复：使用增量平方和统计二阶矩，避免存储全部像素坐标
      let sumX = 0;
      let sumY = 0;
      let sumX2 = 0;
      let sumY2 = 0;
      let count = 0;
      while (head < queue.length) {
        const idx = queue[head++];
        const xi = idx % dw;
        const yi = Math.floor(idx / dw);
        sumX += xi;
        sumY += yi;
        sumX2 += xi * xi;
        sumY2 += yi * yi;
        count++;
        // 8 邻域
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nxi = xi + dx;
            const nyi = yi + dy;
            if (nxi < 0 || nyi < 0 || nxi >= dw || nyi >= dh) continue;
            const nidx = nyi * dw + nxi;
            if (!visited[nidx] && binaryData[nidx] === 1) {
              visited[nidx] = 1;
              queue.push(nidx);
            }
          }
        }
      }
      // 计算质心
      const cx = sumX / count;
      const cy = sumY / count;
      // 计算二阶矩（增量平方和公式：Σ(x-cx)² = Σx² - n*cx²）
      const moment = sumX2 - count * cx * cx + sumY2 - count * cy * cy;
      // 计算直径
      const diameter = 2.0 * Math.sqrt(count / Math.PI);
      // 按直径阈值过滤
      if (
        diameter <= this.params.maxDiameter &&
        diameter >= this.params.minDiameter
      ) {
        blobs.push({
          centroid: { x: cx + 0.5, y: cy + 0.5 },
          area: count,
          moment,
          diameter,
        });
      }
    }
    if (onProgress) onProgress(1);
    return blobs;
  }
}
