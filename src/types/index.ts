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
 * 图表数据提取器 - 类型定义
 */
// 像素坐标
export interface PixelPoint {
  px: number;
  py: number;
}
// 数据坐标
export interface DataPoint {
  x: number;
  y: number;
}
// 标定点轴角色
export type CalibRole = "xmin" | "xmax" | "ymin" | "ymax";
/** 4 个标定点的固定轴角色（顺序即 P1..P4 的点击顺序）。
 * label 字段为 i18n 键前缀（如 "calib.xmin"），由 UI 层经 t() 翻译后展示。
 */
export const CALIB_ROLES: Array<{ role: CalibRole; label: string }> = [
  { role: "xmin", label: "calib.xmin" },
  { role: "xmax", label: "calib.xmax" },
  { role: "ymin", label: "calib.ymin" },
  { role: "ymax", label: "calib.ymax" },
];
// 标定点：像素坐标、数据坐标
// dx/dy 可为 null（未填写真实值，杜绝默认假值导致的静默错误)
// placed 标记该点的图上位置是否已被点击设置（用于画布叠加层渲染）
export interface CalibrationPoint extends PixelPoint {
  dx: number | null;
  dy: number | null;
  label: string;
  role?: CalibRole;
  placed?: boolean;
}
// 坐标轴类型
export type ChartType = "xy" | "polar" | "ternary" | "bar" | "map" | "image";
// 坐标轴刻度类型
export type ScaleType = "linear" | "log";
// 标定配置
// xLabel/xUnit/yLabel/yUnit：轴名称与单位（可选字段，旧工程缺省时回退空串）
export interface CalibrationConfig {
  points: CalibrationPoint[];
  scaleX: ScaleType;
  scaleY: ScaleType;
  isDateX: boolean;
  isDateY: boolean;
  noRotation: boolean;
  xLabel?: string;
  xUnit?: string;
  yLabel?: string;
  yUnit?: string;
}
// 数据集
export interface Dataset {
  id: string;
  name: string;
  color: string;
  points: DataPoint[];
  metadata: {
    area: number | null;
    moment: number | null;
  };
}
// 工程设置
export interface ProjectSettings {
  precision: number;
  units: { x: string; y: string };
}
// 检测参数（随工程保存，保证重开复现性）
export interface DetectionParams {
  colorParams: ColorDetectionParams;
  curveParams: { xStep: number; yStep: number; smoothing: boolean };
  blobParams: { minDiameter: number; maxDiameter: number };
}
// 工程文件数据
export interface ProjectData {
  imageRef: string;
  chartType: ChartType;
  calibration: CalibrationConfig;
  datasets: Dataset[];
  settings: ProjectSettings;
  /** 自动检测参数（旧工程缺省） */
  detection?: DetectionParams;
}
// 工程清单
export interface ProjectManifest {
  formatVersion: string;
  appVersion: string;
  createdAt: string;
  modifiedAt: string;
  originalFileName: string;
}
// ========== UX 单一真相状态机（替代松散 step 字符串) ==========
export type UXState =
  | "EMPTY" // 无工程
  | "IMAGE_READY" // 已导入图像，待标定
  | "CALIBRATING" // 标定中（已点 N/4 位置）
  | "CALIBRATED" // 已标定，待取点
  | "EXTRACTING" // 取点/检测中
  | "EXPORTING"; // 导出确认
// 主题模式
export type ThemeMode = "light" | "dark" | "system";
// 撤销/重做命令接口
export interface UndoableCommand {
  execute(): void;
  undo(): void;
  redo(): void;
  description: string;
  mergeable?: boolean;
}
// 颜色检测模式
export type ColorDetectionMode = "foreground" | "background";
// 颜色检测参数
export interface ColorDetectionParams {
  fgColor: [number, number, number];
  bgColor: [number, number, number];
  colorDistance: number;
  mode: ColorDetectionMode;
}
// 最近文件项
export interface RecentFile {
  path: string;
  name: string;
  lastOpened: string;
}
// 导出格式
export type ExportFormat = "xlsx" | "csv" | "json";
// 多数据集 CSV 合并形态：宽表（按 X 对齐）或长表（dataset,X,Y 三列）
export type CsvMergeMode = "long" | "wide";
// 导出选项
export interface ExportOptions {
  format: ExportFormat;
  encoding: "utf-8" | "gbk";
  precision: number;
  includeHeader: boolean;
  /** CSV 是否写入 # 元信息注释行（默认 false，保持 pandas read_csv 默认可直接解析） */
  includeMetadata?: boolean;
  /** 仅导出勾选的数据集（空数组/缺省 = 全部） */
  datasetIds?: string[];
  /** 自定义列名（缺省回退轴 label） */
  xColumn?: string;
  yColumn?: string;
  /** 多数据集 CSV 合并形态，默认长表 */
  mergeMode?: CsvMergeMode;
}
// ========== UX 状态机人类可读标签（/：状态栏不再暴露内部枚举） ==========
export const UX_STATE_LABEL: Record<UXState, string> = {
  EMPTY: "未开始",
  IMAGE_READY: "图像就绪",
  CALIBRATING: "标定中",
  CALIBRATED: "已标定",
  EXTRACTING: "取点中",
  EXPORTING: "导出中",
};
// pdfjs-dist 动态导入的模块声明（避免 TS 报找不到模块）
// 注：*.mjs?url 由 vite/client 的 declare module '*?url' 覆盖，无需手写。
declare module "pdfjs-dist/legacy/build/pdf.mjs";
