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
 * 工程文件归一化与版本迁移（纯函数，无 DOM / Tauri 依赖，便于单测）
 * 从 projectService 抽离：避免测试时牵扯 appApi / Tauri 链。
 */
import type {
  ProjectData,
  CalibrationConfig,
  Dataset,
  ProjectSettings,
  DetectionParams,
} from "../types";
import { DEFAULT_FG_COLOR } from "../core/colorFilter"; // 默认前景色单一来源
/**
 * 版本迁移链：key 为「当前版本号」，value 将该版本 raw 升级到下一版本。
 * 未来新增格式版本时，在此追加条目即可（如 '1.0' -> '1.1'）。
 */
export const MIGRATIONS: Record<
  string,
  (raw: any) => { data: any; nextVersion: string }
> = {
  // 示例（尚未定义后续版本）
  // '1.0': (raw) => ({ data: { ...raw, newField: raw.newField ?? default }, nextVersion: '1.1' }),
};
/** 运行迁移链，返回最终数据与版本号 */
export function runMigrations(
  raw: any,
  fromVersion: string,
): { data: any; version: string } {
  let data = raw;
  let version = fromVersion;
  let guard = 0;
  while (MIGRATIONS[version] && guard < 50) {
    const step = MIGRATIONS[version](data);
    data = step.data;
    version = step.nextVersion;
    guard++;
  }
  return { data, version };
}
/** 前向兼容：补齐缺失的可选字段，未知字段原样保留 */
export function normalizeProjectData(raw: any): ProjectData {
  // 标定点完整性校验：旧工程点数≠4 会导致标定矩阵构造错误，
  // 归一化阶段若点数不为 4 且不为 0，则清空 points（需重新标定）而非抛异常，
  // 保证前向兼容——旧工程加载后 UI 显示为未标定状态，而非崩溃。
  const rawPoints: any[] = Array.isArray(raw?.calibration?.points)
    ? raw.calibration.points
    : [];
  const validPoints = rawPoints.length === 4 ? rawPoints : [];
  // 按 role ?? index 归一，保证旧工程缺 role 字段时按索引兜底
  const ROLE_BY_INDEX = ["xmin", "xmax", "ymin", "ymax"];
  const normalizedPoints = validPoints.map((p: any, i: number) => ({
    ...p,
    role: p?.role ?? ROLE_BY_INDEX[i] ?? ``,
  }));
  const calibration: CalibrationConfig = {
    points: normalizedPoints,
    scaleX: raw?.calibration?.scaleX ?? "linear",
    scaleY: raw?.calibration?.scaleY ?? "linear",
    isDateX: raw?.calibration?.isDateX ?? false,
    isDateY: raw?.calibration?.isDateY ?? false,
    noRotation: raw?.calibration?.noRotation ?? false,
    // 轴名称/单位（旧工程缺省空串）
    xLabel: raw?.calibration?.xLabel ?? "",
    xUnit: raw?.calibration?.xUnit ?? "",
    yLabel: raw?.calibration?.yLabel ?? "",
    yUnit: raw?.calibration?.yUnit ?? "",
  };
  const datasets: Dataset[] = Array.isArray(raw?.datasets)
    ? raw.datasets.map((ds: any, i: number) => ({
        id: ds?.id ?? `ds_${i}`,
        name: ds?.name ?? `数据集${i + 1}`,
        color: ds?.color ?? "#4a9eff",
        // P1-3: 强校验点元素类型 — x/y 必须为有限数值，脏数据丢弃
        points: Array.isArray(ds?.points)
          ? ds.points.filter(
              (pt: any) =>
                pt != null &&
                typeof pt.x === "number" &&
                typeof pt.y === "number" &&
                Number.isFinite(pt.x) &&
                Number.isFinite(pt.y),
            )
          : [],
        metadata: {
          area: ds?.metadata?.area ?? null,
          moment: ds?.metadata?.moment ?? null,
        },
      }))
    : [];
  const settings: ProjectSettings = {
    precision: raw?.settings?.precision ?? 3,
    units: {
      x: raw?.settings?.units?.x ?? "",
      y: raw?.settings?.units?.y ?? "",
    },
  };
  // 自动检测参数（缺省用默认值，前向兼容旧工程）
  const detection: DetectionParams | undefined = raw?.detection
    ? {
        colorParams: {
          fgColor: Array.isArray(raw.detection.colorParams?.fgColor)
            ? raw.detection.colorParams.fgColor
            : DEFAULT_FG_COLOR,
          bgColor: Array.isArray(raw.detection.colorParams?.bgColor)
            ? raw.detection.colorParams.bgColor
            : [255, 255, 255],
          colorDistance: raw.detection.colorParams?.colorDistance ?? 120,
          mode: raw.detection.colorParams?.mode ?? "foreground",
        },
        curveParams: {
          xStep: raw.detection.curveParams?.xStep ?? 10,
          yStep: raw.detection.curveParams?.yStep ?? 10,
          smoothing: raw.detection.curveParams?.smoothing ?? true,
        },
        blobParams: {
          minDiameter: raw.detection.blobParams?.minDiameter ?? 2,
          maxDiameter: raw.detection.blobParams?.maxDiameter ?? 50,
        },
      }
    : undefined;
  return {
    imageRef: raw?.imageRef ?? "images/original.png",
    chartType: raw?.chartType ?? "xy",
    calibration,
    datasets,
    settings,
    detection,
  };
}
