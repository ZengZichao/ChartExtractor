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
 * CV 抽取编排服务
 * 思想来源：开发文档 1.2 节 controllers/services 分层（将重算法编排从渲染组件剥离，便于单测与演进）
 *
 * 职责：把「颜色分割 → 曲线/散点/网格检测」的多步流程封装为独立的异步函数，
 * 内部使用 ColorFilter.generateBinaryDataAsync 做分块让出主线程。
 * 渲染组件（App）只负责调用与把像素坐标经标定换算为数据坐标，不再内联重算法。
 */
import { ColorFilter, type BinaryData } from "../core/colorFilter";
import { CurveTracker, type CurveTrackerParams } from "../core/curveTracker";
import {
  BlobDetector,
  type BlobDetectorParams,
  type BlobResult,
} from "../core/blobDetector";
import {
  GridDetector,
  type GridDetectorParams,
  type GridDetectionResult,
} from "../core/gridDetector";
import type { ColorDetectionParams } from "../types";
export interface CurveTrackOutput {
  pixelPoints: Array<{ x: number; y: number }>;
  mask: BinaryData;
  width: number;
  height: number;
}
export interface BlobDetectOutput {
  blobs: BlobResult[];
  mask: BinaryData;
  width: number;
  height: number;
}
export interface GridDetectOutput {
  result: GridDetectionResult;
  mask: BinaryData;
  width: number;
  height: number;
}
/** 检测进度回调（进度条、取消） */
export type DetectionProgressFn = (ratio: number) => void;
export type CancelCheckFn = () => boolean;
/**
 * -伪点清理：从检测结果中去除落在网格线上的伪点。
 * 网格线上的像素经曲线追踪或散点检测后常产生伪数据点，
 * 此函数将落在检测到的网格线（±tolerance 像素）内的点剔除。
 */
export function removeGridNoise(
  points: Array<{ x: number; y: number }>,
  gridLines: GridDetectionResult,
  tolerance: number = 3,
): Array<{ x: number; y: number }> {
  if (
    gridLines.verticalLines.length === 0 &&
    gridLines.horizontalLines.length === 0
  )
    return points;
  return points.filter((pt) => {
    const onVertical = gridLines.verticalLines.some(
      (vx) => Math.abs(pt.x - vx) <= tolerance,
    );
    const onHorizontal = gridLines.horizontalLines.some(
      (hy) => Math.abs(pt.y - hy) <= tolerance,
    );
    return !(onVertical || onHorizontal);
  });
}
/**
 * -散点按颜色分拣：将散点检测结果按颜色聚类分组。
 * 对每个 blob 的平均颜色做简单 k-means 式贪心聚类，
 * 返回每组的中代表色及其 blob 列表。
 */
export interface ColorCluster {
  color: [number, number, number];
  blobs: BlobResult[];
}
export function clusterBlobsByColor(
  imageData: ImageData,
  blobs: BlobResult[],
  tolerance: number = 80,
  maxClusters: number = 10,
): ColorCluster[] {
  if (blobs.length === 0) return [];
  const data = imageData.data;
  const w = imageData.width;
  const clusters: ColorCluster[] = [];
  for (const blob of blobs) {
    // 采样 blob 中心像素颜色
    const cx = Math.max(0, Math.min(w - 1, Math.round(blob.centroid.x)));
    const cy = Math.max(
      0,
      Math.min(imageData.height - 1, Math.round(blob.centroid.y)),
    );
    const idx = (cy * w + cx) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // 查找已有相似颜色组
    let found = false;
    for (const cl of clusters) {
      const dr = r - cl.color[0];
      const dg = g - cl.color[1];
      const db = b - cl.color[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= tolerance) {
        // 合并到该组（更新平均颜色）
        const total = cl.blobs.length + 1;
        cl.color[0] = Math.round((cl.color[0] * cl.blobs.length + r) / total);
        cl.color[1] = Math.round((cl.color[1] * cl.blobs.length + g) / total);
        cl.color[2] = Math.round((cl.color[2] * cl.blobs.length + b) / total);
        cl.blobs.push(blob);
        found = true;
        break;
      }
    }
    if (!found && clusters.length < maxClusters) {
      clusters.push({ color: [r, g, b], blobs: [blob] });
    }
  }
  // 按数量排序
  clusters.sort((a, b) => b.blobs.length - a.blobs.length);
  return clusters;
}
/** 曲线自动追踪：颜色分割、均值窗口/样条曲线追踪（ 支持进度与取消） */
export async function extractCurve(
  imageData: ImageData,
  colorParams: ColorDetectionParams,
  curveParams: CurveTrackerParams,
  onProgress?: DetectionProgressFn,
  shouldCancel?: CancelCheckFn,
): Promise<CurveTrackOutput> {
  const filter = new ColorFilter(colorParams);
  const binary = await filter.generateBinaryDataAsync(
    imageData,
    undefined,
    256,
    (r) => onProgress?.(r * 0.5),
    shouldCancel,
  );
  const tracker = new CurveTracker(curveParams);
  const pixelPoints = await tracker.trackAsync(
    binary,
    imageData.width,
    imageData.height,
    (r) => onProgress?.(0.5 + r * 0.5),
    shouldCancel,
  );
  return {
    pixelPoints,
    mask: binary,
    width: imageData.width,
    height: imageData.height,
  };
}
/** 散点自动检测：颜色分割、连通域标记（ 支持进度与取消） */
export async function extractBlobs(
  imageData: ImageData,
  colorParams: ColorDetectionParams,
  blobParams: BlobDetectorParams,
  onProgress?: DetectionProgressFn,
  shouldCancel?: CancelCheckFn,
): Promise<BlobDetectOutput> {
  const filter = new ColorFilter(colorParams);
  const binary = await filter.generateBinaryDataAsync(
    imageData,
    undefined,
    256,
    (r) => onProgress?.(r * 0.5),
    shouldCancel,
  );
  const detector = new BlobDetector(blobParams);
  const blobs = await detector.detectAsync(
    binary,
    imageData.width,
    imageData.height,
    (r) => onProgress?.(0.5 + r * 0.5),
    shouldCancel,
  );
  return {
    blobs,
    mask: binary,
    width: imageData.width,
    height: imageData.height,
  };
}
/** 网格线识别（投影轮廓法， 支持进度与取消） */
export async function detectGrid(
  imageData: ImageData,
  colorParams: ColorDetectionParams,
  gridParams: GridDetectorParams,
  onProgress?: DetectionProgressFn,
  shouldCancel?: CancelCheckFn,
): Promise<GridDetectOutput> {
  const filter = new ColorFilter(colorParams);
  const binary = await filter.generateBinaryDataAsync(
    imageData,
    undefined,
    256,
    (r) => onProgress?.(r * 0.5),
    shouldCancel,
  );
  const detector = new GridDetector(gridParams);
  const result = await detector.detectAsync(
    binary,
    imageData.width,
    imageData.height,
    undefined,
    (r) => onProgress?.(0.5 + r * 0.5),
    shouldCancel,
  );
  return {
    result,
    mask: binary,
    width: imageData.width,
    height: imageData.height,
  };
}
