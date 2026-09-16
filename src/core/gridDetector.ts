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
 * 网格线识别模块（投影轮廓法）
 * Clean-room 实现，借鉴 WPD gridDetectionCore.js 的投影统计思想
 * 思想来源：WPD core/gridDetectionCore.js
 *
 * 算法流程
 * 1. 逐列统计二值像素数（垂直投影），超阈值判为垂直网格线
 * 2. 逐行统计二值像素数（水平投影），超阈值判为水平网格线
 */
import type { BinaryData } from "./colorFilter";
import { yieldToMain } from "./colorFilter";
export interface GridDetectorParams {
  hasVertical: boolean; // 检测垂直线
  hasHorizontal: boolean; // 检测水平线
  xFrac: number; // 水平线阈值比例（0-1）
  yFrac: number; // 垂直线阈值比例（0-1）
}
export interface GridDetectionResult {
  verticalLines: number[]; // 垂直网格线的 x 坐标
  horizontalLines: number[]; // 水平网格线的 y 坐标
}
export class GridDetector {
  private params: GridDetectorParams;
  constructor(params?: Partial<GridDetectorParams>) {
    this.params = {
      hasVertical: true,
      hasHorizontal: true,
      xFrac: 0.1,
      yFrac: 0.1,
      ...params,
    };
  }
  setParams(params: Partial<GridDetectorParams>): void {
    this.params = { ...this.params, ...params };
  }
  getParams(): GridDetectorParams {
    return { ...this.params };
  }
  /**
   * 执行网格检测
   * @param binaryData 二值化数据
   * @param imageWidth 图像宽度
   * @param imageHeight 图像高度
   * @param bounds 检测范围 {xmin, xmax, ymin, ymax}
   */
  detect(
    binaryData: BinaryData,
    imageWidth: number,
    imageHeight: number,
    bounds?: { xmin: number; xmax: number; ymin: number; ymax: number },
  ): GridDetectionResult {
    const dw = imageWidth;
    const dh = imageHeight;
    const xmin = bounds?.xmin ?? 0;
    const xmax = bounds?.xmax ?? dw;
    const ymin = bounds?.ymin ?? 0;
    const ymax = bounds?.ymax ?? dh;
    const result: GridDetectionResult = {
      verticalLines: [],
      horizontalLines: [],
    };
    // 检测垂直网格线
    if (this.params.hasVertical) {
      // 修复：外层按列遍历，索引上限用 < xmax（xmax 为“开区间上界”，默认 dw），
      // 原 <= 会越界多扫一列，且与内层行循环的 < ymax 不一致。
      for (let xi = xmin; xi < xmax; xi++) {
        let linePixCount = 0;
        for (let yi = ymin; yi < ymax; yi++) {
          if (binaryData[yi * dw + xi] === 1) {
            linePixCount++;
          }
        }
        if (linePixCount > this.params.yFrac * (ymax - ymin)) {
          result.verticalLines.push(xi);
        }
      }
    }
    // 检测水平网格线
    if (this.params.hasHorizontal) {
      for (let yi = ymin; yi < ymax; yi++) {
        let linePixCount = 0;
        // 修复：内层按行遍历，索引上限同样用 < xmax，与外层保持一致，避免越界一行。
        for (let xi = xmin; xi < xmax; xi++) {
          if (binaryData[yi * dw + xi] === 1) {
            linePixCount++;
          }
        }
        if (linePixCount > this.params.xFrac * (xmax - xmin)) {
          result.horizontalLines.push(yi);
        }
      }
    }
    return result;
  }
  /**
   * 网格检测（异步分块版本)
   * 与 detect 算法一致，但扫描过程分块让出主线程，并支持进度回调与取消。
   */
  async detectAsync(
    binaryData: BinaryData,
    imageWidth: number,
    imageHeight: number,
    bounds?: { xmin: number; xmax: number; ymin: number; ymax: number },
    onProgress?: (ratio: number) => void,
    shouldCancel?: () => boolean,
  ): Promise<GridDetectionResult> {
    const dw = imageWidth;
    const dh = imageHeight;
    const xmin = bounds?.xmin ?? 0;
    const xmax = bounds?.xmax ?? dw;
    const ymin = bounds?.ymin ?? 0;
    const ymax = bounds?.ymax ?? dh;
    const result: GridDetectionResult = {
      verticalLines: [],
      horizontalLines: [],
    };
    // 检测垂直网格线
    if (this.params.hasVertical) {
      const chunk = 64;
      for (let colStart = xmin; colStart < xmax; colStart += chunk) {
        if (shouldCancel?.()) throw new Error("cancelled");
        const colEnd = Math.min(colStart + chunk, xmax);
        for (let xi = colStart; xi < colEnd; xi++) {
          let linePixCount = 0;
          for (let yi = ymin; yi < ymax; yi++) {
            if (binaryData[yi * dw + xi] === 1) {
              linePixCount++;
            }
          }
          if (linePixCount > this.params.yFrac * (ymax - ymin)) {
            result.verticalLines.push(xi);
          }
        }
        if (onProgress)
          onProgress(
            Math.min(
              0.5,
              0.05 + ((colEnd - xmin) / Math.max(xmax - xmin, 1)) * 0.45,
            ),
          );
        await yieldToMain();
      }
    }
    // 检测水平网格线
    if (this.params.hasHorizontal) {
      const chunk = 64;
      for (let rowStart = ymin; rowStart < ymax; rowStart += chunk) {
        if (shouldCancel?.()) throw new Error("cancelled");
        const rowEnd = Math.min(rowStart + chunk, ymax);
        for (let yi = rowStart; yi < rowEnd; yi++) {
          let linePixCount = 0;
          for (let xi = xmin; xi < xmax; xi++) {
            if (binaryData[yi * dw + xi] === 1) {
              linePixCount++;
            }
          }
          if (linePixCount > this.params.xFrac * (xmax - xmin)) {
            result.horizontalLines.push(yi);
          }
        }
        if (onProgress)
          onProgress(
            Math.min(
              1,
              0.55 + ((rowEnd - ymin) / Math.max(ymax - ymin, 1)) * 0.45,
            ),
          );
        await yieldToMain();
      }
    }
    if (onProgress) onProgress(1);
    return result;
  }
}
