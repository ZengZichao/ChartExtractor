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
 * 曲线自动追踪模块
 * Clean-room 实现，借鉴 WPD averagingWindowCore.js 的均值窗口算法思想
 * 思想来源：WPD core/curve_detection/averagingWindowCore.js
 *
 * 算法流程
 * 1. 逐列扫描二值化数据，将相邻亮像素行程(run)跨列合并
 * 2. 每列内的亮像素按 yStep 分组求均值，得到候选点
 * 3. 候选点按 xStep 窗口合并相邻点，输出平滑曲线
 */
import type { BinaryData } from "./colorFilter";
import { yieldToMain } from "./colorFilter";
import { cspline, csplineInterp, movingAverage } from "./mathUtils";
import type { DataPoint } from "../types";
export interface CurveTrackerParams {
  xStep: number; // ΔX 像素步长
  yStep: number; // ΔY 像素步长
  smoothing: boolean; // 是否启用三次样条平滑
}
export interface CurveTrackResult {
  pixelPoints: Array<{ x: number; y: number }>;
  dataPoints: DataPoint[];
}
export class CurveTracker {
  private params: CurveTrackerParams;
  constructor(params?: Partial<CurveTrackerParams>) {
    this.params = {
      xStep: 10,
      yStep: 10,
      smoothing: true,
      ...params,
    };
  }
  setParams(params: Partial<CurveTrackerParams>): void {
    this.params = { ...this.params, ...params };
  }
  getParams(): CurveTrackerParams {
    return { ...this.params };
  }
  /**
   * 执行曲线追踪
   * @param binaryData 二值化数据
   * @param imageWidth 图像宽度
   * @param imageHeight 图像高度
   * @returns 像素坐标点数组
   */
  track(
    binaryData: BinaryData,
    imageWidth: number,
    imageHeight: number,
  ): Array<{ x: number; y: number }> {
    const dw = imageWidth;
    const dh = imageHeight;
    const xStep = this.params.xStep;
    const yStep = this.params.yStep;
    // 第一步：逐列扫描，找每列中的亮像素行程(blobs)
    const xPoints: Array<[number, number, boolean]> = []; // [x, y, available]
    const blobAvg: number[] = [];
    for (let coli = 0; coli < dw; coli++) {
      let blobs = -1;
      let firstBlobY = -2.0 * yStep;
      let bi = 0;
      for (let rowi = 0; rowi < dh; rowi++) {
        const idx = rowi * dw + coli;
        if (binaryData[idx] === 1) {
          if (rowi > firstBlobY + yStep) {
            // 新行程
            blobs++;
            bi = 1;
            blobAvg[blobs] = rowi;
            firstBlobY = rowi;
          } else {
            // 继续当前行程，更新均值
            bi++;
            blobAvg[blobs] = (blobAvg[blobs] * (bi - 1) + rowi) / bi;
          }
        }
      }
      // 记录该列的候选点
      if (blobs >= 0) {
        const xi = coli + 0.5;
        for (let blbi = 0; blbi <= blobs; blbi++) {
          const yi = blobAvg[blbi] + 0.5;
          xPoints.push([xi, yi, true]);
        }
      }
    }
    if (xPoints.length === 0) return [];
    // 第二步：合并相邻候选点
    const result: Array<{ x: number; y: number }> = [];
    for (let pi = 0; pi < xPoints.length; pi++) {
      if (!xPoints[pi][2]) continue;
      let oldX = xPoints[pi][0];
      let oldY = xPoints[pi][1];
      let avgX = oldX;
      let avgY = oldY;
      let matches = 1;
      for (let xxi = pi + 1; xxi < xPoints.length; xxi++) {
        const newX = xPoints[xxi][0];
        const newY = xPoints[xxi][1];
        if (newX > oldX + 2 * xStep) break;
        if (
          xPoints[xxi][2] &&
          Math.abs(newX - oldX) <= xStep &&
          Math.abs(newY - oldY) <= yStep
        ) {
          avgX = (avgX * matches + newX) / (matches + 1);
          avgY = (avgY * matches + newY) / (matches + 1);
          matches++;
          xPoints[xxi][2] = false;
          // 修复：合并后将锚点前移到当前簇质心，使窗口向前“游走”，
          // 否则所有比较都基于初始原点，会把本不相邻的远点也并入同一簇（过度合并）。
          oldX = avgX;
          oldY = avgY;
        }
      }
      xPoints[pi][2] = false;
      result.push({ x: avgX, y: avgY });
    }
    // 第三步：可选的三次样条平滑
    if (this.params.smoothing && result.length >= 3) {
      // 按 x 排序
      result.sort((a, b) => a.x - b.x);
      // 提取唯一 x 值（样条插值要求 x 严格递增）
      const xs: number[] = [];
      const ys: number[] = [];
      for (const pt of result) {
        if (xs.length === 0 || pt.x > xs[xs.length - 1] + 0.01) {
          xs.push(pt.x);
          ys.push(pt.y);
        }
      }
      if (xs.length >= 3) {
        // 先对 y 做移动平均平滑
        const smoothedYs = movingAverage(ys, 3);
        const spline = cspline(xs, smoothedYs);
        if (spline) {
          // 用样条重新采样
          const smoothed: Array<{ x: number; y: number }> = [];
          const xMin = xs[0];
          const xMax = xs[xs.length - 1];
          const step = (xMax - xMin) / Math.max(result.length - 1, 1);
          // 防御：所有点 x 相同或采样退化时 step<=0 会让下面 for 循环死循环，故跳过重采样
          if (step > 0) {
            for (let x = xMin; x <= xMax; x += step) {
              const y = csplineInterp(spline, x);
              if (y !== null) {
                smoothed.push({ x, y });
              }
            }
          }
          if (smoothed.length >= 2) {
            return smoothed;
          }
        }
      }
    }
    return result;
  }
  /**
   * 曲线追踪（异步分块版本)
   * 与 track 算法一致，但逐列扫描分块让出主线程，并支持进度回调与取消。
   * @param binaryData 二值化数据
   * @param imageWidth 图像宽度
   * @param imageHeight 图像高度
   * @param onProgress 进度回调（0..1）
   * @param shouldCancel 取消判定（返回 true 时抛 cancelled）
   */
  async trackAsync(
    binaryData: BinaryData,
    imageWidth: number,
    imageHeight: number,
    onProgress?: (ratio: number) => void,
    shouldCancel?: () => boolean,
  ): Promise<Array<{ x: number; y: number }>> {
    const dw = imageWidth;
    const dh = imageHeight;
    const xStep = this.params.xStep;
    const yStep = this.params.yStep;
    // 第一步：逐列扫描（分块让出主线程）
    const xPoints: Array<[number, number, boolean]> = []; // [x, y, available]
    const blobAvg: number[] = [];
    const chunkCols = 96;
    for (let colStart = 0; colStart < dw; colStart += chunkCols) {
      if (shouldCancel?.()) throw new Error("cancelled");
      const colEnd = Math.min(colStart + chunkCols, dw);
      for (let coli = colStart; coli < colEnd; coli++) {
        let blobs = -1;
        let firstBlobY = -2.0 * yStep;
        let bi = 0;
        for (let rowi = 0; rowi < dh; rowi++) {
          const idx = rowi * dw + coli;
          if (binaryData[idx] === 1) {
            if (rowi > firstBlobY + yStep) {
              blobs++;
              bi = 1;
              blobAvg[blobs] = rowi;
              firstBlobY = rowi;
            } else {
              bi++;
              blobAvg[blobs] = (blobAvg[blobs] * (bi - 1) + rowi) / bi;
            }
          }
        }
        if (blobs >= 0) {
          const xi = coli + 0.5;
          for (let blbi = 0; blbi <= blobs; blbi++) {
            const yi = blobAvg[blbi] + 0.5;
            xPoints.push([xi, yi, true]);
          }
        }
      }
      if (onProgress) onProgress(Math.min(0.8, 0.1 + (colEnd / dw) * 0.7));
      await yieldToMain();
    }
    if (xPoints.length === 0) return [];
    // 第二步：合并相邻候选点
    const result: Array<{ x: number; y: number }> = [];
    for (let pi = 0; pi < xPoints.length; pi++) {
      if (pi % 4096 === 0 && shouldCancel?.()) throw new Error("cancelled");
      if (!xPoints[pi][2]) continue;
      let oldX = xPoints[pi][0];
      let oldY = xPoints[pi][1];
      let avgX = oldX;
      let avgY = oldY;
      let matches = 1;
      for (let xxi = pi + 1; xxi < xPoints.length; xxi++) {
        const newX = xPoints[xxi][0];
        const newY = xPoints[xxi][1];
        if (newX > oldX + 2 * xStep) break;
        if (
          xPoints[xxi][2] &&
          Math.abs(newX - oldX) <= xStep &&
          Math.abs(newY - oldY) <= yStep
        ) {
          avgX = (avgX * matches + newX) / (matches + 1);
          avgY = (avgY * matches + newY) / (matches + 1);
          matches++;
          xPoints[xxi][2] = false;
          oldX = avgX;
          oldY = avgY;
        }
      }
      xPoints[pi][2] = false;
      result.push({ x: avgX, y: avgY });
    }
    if (onProgress) onProgress(0.85);
    // 第三步：可选的三次样条平滑
    if (this.params.smoothing && result.length >= 3) {
      result.sort((a, b) => a.x - b.x);
      const xs: number[] = [];
      const ys: number[] = [];
      for (const pt of result) {
        if (xs.length === 0 || pt.x > xs[xs.length - 1] + 0.01) {
          xs.push(pt.x);
          ys.push(pt.y);
        }
      }
      if (xs.length >= 3) {
        const smoothedYs = movingAverage(ys, 3);
        const spline = cspline(xs, smoothedYs);
        if (spline) {
          const smoothed: Array<{ x: number; y: number }> = [];
          const xMin = xs[0];
          const xMax = xs[xs.length - 1];
          const step = (xMax - xMin) / Math.max(result.length - 1, 1);
          if (step > 0) {
            for (let x = xMin; x <= xMax; x += step) {
              if (shouldCancel?.()) throw new Error("cancelled");
              const y = csplineInterp(spline, x);
              if (y !== null) {
                smoothed.push({ x, y });
              }
            }
          }
          if (smoothed.length >= 2) {
            if (onProgress) onProgress(1);
            return smoothed;
          }
        }
      }
    }
    if (onProgress) onProgress(1);
    return result;
  }
}
