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
 * 数据导出服务
 * 支持 CSV / Excel(.xlsx) / JSON 格式导出
 * 编码：UTF-8（默认）/ GBK
 *
 * SheetJS (xlsx@0.18.5) Apache-2.0 许可证，版本锁定禁止升级。
 *
 *
 * saveBlobToFile 的分块 base64 编码，避免大文件 `String.fromCharCode(...spread)` 触发
 * RangeError: too many arguments。
 * GBK 编码因渲染进程无 Node Buffer，改由 Rust 命令层经 invoke（write_text_encoded）用 encoding_rs 完成；
 * CSV 文本通过 buildCSVText 产出，UTF-8 走 write_text_file、GBK 走 write_text_encoded。
 */
import { appApi } from "../platform/api";
import type {
  Dataset,
  ExportOptions,
  CalibrationConfig,
  DetectionParams,
} from "../types";
// xlsx 仅在导出 xlsx 时动态 import（避免进首屏包）
export class ExportService {
  /**
   * 导出 xlsx / json 为 Blob（CSV 不在此路径，见 buildCSVText + 调用方写盘）
   */
  static async export(
    datasets: Dataset[],
    options: ExportOptions,
    calibration?: CalibrationConfig,
    metadata?: {
      appVersion: string;
      residual: number;
      totalPoints: number;
      extractedAt: string;
    },
    detection?: DetectionParams, // JSON 元信息携带检测参数，与工程复现口径一致
  ): Promise<Blob> {
    switch (options.format) {
      case "xlsx":
        return this.exportXLSX(datasets, options, calibration);
      case "json":
        return this.exportJSON(
          datasets,
          options,
          calibration,
          metadata,
          detection,
        );
      default:
        throw new Error(
          `不支持的 Blob 导出格式: ${options.format}（CSV 请使用 buildCSVText）`,
        );
    }
  }
  /**
   * 构建 CSV 文本（不含 BOM；UTF-8 由调用方加 BOM，GBK 由主进程编码）
   * 支持数据集勾选、自定义列名、长表（dataset,X,Y）/ 宽表（按 X 对齐）两种形态。
   * 元信息注释行改为可选（options.includeMetadata，默认 false）——
   * pandas.read_csv 的 comment 参数默认 None，带 # 注释行的 CSV 无法被默认解析直接读入，
   * 因此默认不写入注释行以保持「pandas 可直接解析」的既定目标。
   */
  static buildCSVText(
    datasets: Dataset[],
    options: ExportOptions,
    calibration?: CalibrationConfig,
    metadata?: { appVersion: string; residual: number; extractedAt: string },
  ): string {
    const dsList = this.selectDatasets(datasets, options);
    const xCol = options.xColumn || calibration?.xLabel || "X";
    const yCol = options.yColumn || calibration?.yLabel || "Y";
    const xHeader = this.headerWithUnit(xCol, calibration?.xUnit);
    const yHeader = this.headerWithUnit(yCol, calibration?.yUnit);
    const lines: string[] = [];
    const fmt = (v: number) =>
      options.precision > 0 ? v.toFixed(options.precision) : Math.round(v).toString();
    // 元信息注释行默认关闭（需显式开启）；开启后用户需以 comment='#' 解析
    if (options.includeHeader && options.includeMetadata && metadata) {
      lines.push(
        `# ChartExtractor v${metadata.appVersion} | Offline | Extracted: ${metadata.extractedAt}`,
      );
      lines.push(
        `# Calibration residual: ${metadata.residual.toFixed(4)}px | Precision: ${options.precision} decimals`,
      );
      if (calibration?.scaleX === "log" || calibration?.scaleY === "log") {
        lines.push(
          `# Scale: X=${calibration?.scaleX ?? "linear"}, Y=${calibration?.scaleY ?? "linear"}`,
        );
      }
      lines.push(`# Note: All data extracted locally. No data uploaded.`);
    }
    if (options.mergeMode === "wide" && dsList.length > 0) {
      // 宽表：按 X 对齐合并。取各数据集 X 的并集（按精度取整排序），每行一个 X + 各数据集 Y。
      const xIndex = new Map<number, number>();
      const rows: Array<{ x: number; ys: Map<string, number | null> }> = [];
      const keyOf = (v: number) =>
        options.precision > 0 ? parseFloat(v.toFixed(options.precision)) : v;
      for (const ds of dsList) {
        for (const pt of ds.points) {
          const xk = keyOf(pt.x);
          // P2-5 修复：同 X 覆盖改为计数追加（同 X 多点不再丢失）
          const rowIdx = xIndex.get(xk);
          if (rowIdx != null) {
            const existing = rows[rowIdx].ys.get(ds.id);
            if (existing != null) {
              // 已有同数据集同 X 的点：追加到新行
              rows.push({
                x: xk,
                ys: new Map(dsList.map((d) => [d.id, null])),
              });
              rows[rows.length - 1].ys.set(ds.id, pt.y);
            } else {
              rows[rowIdx].ys.set(ds.id, pt.y);
            }
          } else {
            xIndex.set(xk, rows.length);
            rows.push({
              x: xk,
              ys: new Map(dsList.map((d) => [d.id, null])),
            });
            rows[xIndex.get(xk)!].ys.set(ds.id, pt.y);
          }
        }
      }
      rows.sort((a, b) => a.x - b.x);
      if (options.includeHeader) {
        lines.push(
          [xHeader, ...dsList.map((d) => this.quoteCsv(d.name))].join(","),
        );
      }
      for (const row of rows) {
        lines.push(
          [
            fmt(row.x),
            ...dsList.map((d) =>
              row.ys.get(d.id) != null ? fmt(row.ys.get(d.id)!) : "",
            ),
          ].join(","),
        );
      }
      return lines.join("\n");
    }
    // 长表：dataset,X,Y 三列，pandas.read_csv 可直接解析
    if (options.includeHeader) {
      lines.push(["dataset", xHeader, yHeader].join(","));
    }
    for (const dataset of dsList) {
      const name = this.quoteCsv(dataset.name);
      for (const pt of dataset.points) {
        lines.push(`${name},${fmt(pt.x)},${fmt(pt.y)}`);
      }
    }
    return lines.join("\n");
  }
  /** 按 options.datasetIds 过滤数据集（缺省/空 = 全部） */
  private static selectDatasets(
    datasets: Dataset[],
    options: ExportOptions,
  ): Dataset[] {
    const ids = options.datasetIds;
    if (ids && ids.length > 0) {
      return datasets.filter((d) => ids.includes(d.id) && d.points.length > 0);
    }
    return datasets.filter((d) => d.points.length > 0);
  }
  /** 表头：名称、单位，如「时间(s)」；无单位时仅名称 */
  private static headerWithUnit(label: string, unit?: string): string {
    const base = label || "X";
    return unit ? `${base}(${unit})` : base;
  }
  /** CSV 字段引用（含逗号/引号/换行时加引号并转义）
   * P2-6 修复：中和公式注入（= / + / - / @ 开头的字段加前缀单引号）
   */
  private static quoteCsv(s: string): string {
    // 防公式注入：= / + / - / @ 开头的字段前加单引号
    let safe = s;
    if (/^[=+@-]/.test(safe)) {
      safe = `'${safe}`;
    }
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
  /** Excel 表名清洗、唯一化：Sheet 名禁止 : \\ / ? * [ ]，首尾不能为单引号，上限 31 字符 */
  private static sanitizeSheetName(raw: string, used: Set<string>): string {
    let base = (raw || "数据")
      .replace(/[:\\/?*[\]]/g, "_")
      .replace(/^'+|'+$/g, "").trim();
    if (!base) base = "数据";
    base = base.substring(0, 31);
    let name = base;
    let i = 2;
    while (used.has(name)) {
      const suffix = `(${i++})`;
      name = base.substring(0, 31 - suffix.length) + suffix;
    }
    used.add(name);
    return name;
  }
  /** 导出 XLSX（仅导勾选数据集、语义列名；每个数据集一个 Sheet） */
  private static async exportXLSX(
    datasets: Dataset[],
    options: ExportOptions,
    calibration?: CalibrationConfig,
  ): Promise<Blob> {
    const XLSX = await import("xlsx"); // 仅导出 xlsx 时加载
    const wb = XLSX.utils.book_new();
    const xCol = options.xColumn || calibration?.xLabel || "X";
    const yCol = options.yColumn || calibration?.yLabel || "Y";
    const xHeader = this.headerWithUnit(xCol, calibration?.xUnit);
    const yHeader = this.headerWithUnit(yCol, calibration?.yUnit);
    const usedSheetNames = new Set<string>();
    for (const dataset of this.selectDatasets(datasets, options)) {
      const data: any[][] = [];
      if (options.includeHeader) {
        data.push([xHeader, yHeader]);
      }
      for (const pt of dataset.points) {
        const x =
          options.precision > 0
            ? parseFloat(pt.x.toFixed(options.precision))
            : pt.x;
        const y =
          options.precision > 0
            ? parseFloat(pt.y.toFixed(options.precision))
            : pt.y;
        data.push([x, y]);
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      const sheetName = this.sanitizeSheetName(dataset.name, usedSheetNames);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    const arrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  /** 导出 JSON（仅导勾选数据集；含 calibration/版本/提取元信息；-8：含检测参数） */
  private static exportJSON(
    datasets: Dataset[],
    options: ExportOptions,
    calibration?: CalibrationConfig,
    metadata?: {
      appVersion: string;
      residual: number;
      totalPoints: number;
      extractedAt: string;
    },
    detection?: DetectionParams,
  ): Blob {
    const json: any = {
      meta: {
        appVersion: metadata?.appVersion ?? "unknown",
        extractedAt: metadata?.extractedAt ?? new Date().toISOString(),
        precision: options.precision,
        totalPoints:
          metadata?.totalPoints ??
          datasets.reduce((s, d) => s + d.points.length, 0),
        calibrationResidual: metadata?.residual ?? 0,
        offline: true,
        note: "All data extracted locally. No data was uploaded to any server.",
      },
      datasets: this.selectDatasets(datasets, options).map((ds) => ({
        name: ds.name,
        color: ds.color,
        pointCount: ds.points.length,
        points: ds.points.map((pt) => ({
          x:
            options.precision > 0
              ? parseFloat(pt.x.toFixed(options.precision))
              : pt.x,
          y:
            options.precision > 0
              ? parseFloat(pt.y.toFixed(options.precision))
              : pt.y,
        })),
      })),
    };
    if (calibration) {
      json.calibration = {
        scaleType: { x: calibration.scaleX, y: calibration.scaleY },
        isDate: { x: calibration.isDateX, y: calibration.isDateY },
        noRotation: calibration.noRotation,
        axes: {
          x: {
            label: options.xColumn || calibration.xLabel || "X",
            unit: calibration.xUnit || "",
          },
          y: {
            label: options.yColumn || calibration.yLabel || "Y",
            unit: calibration.yUnit || "",
          },
        },
      };
    }
    // 检测参数随 JSON 导出，与工程文件保存的复现口径一致
    if (detection) {
      json.detection = detection;
    }
    const content = JSON.stringify(json, null, 2);
    return new Blob([content], { type: "application/json" });
  }
  /** 将 ArrayBuffer 分块转为 base64（避免大数组展开触发栈溢出) */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB，安全低于参数长度上限
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }
  /**
   * 将 Blob 保存到文件（经 Tauri invoke 调 Rust 命令层写盘）
   */
  static async saveBlobToFile(blob: Blob, filePath: string): Promise<boolean> {
    try {
      const buffer = await blob.arrayBuffer();
      const base64 = this.arrayBufferToBase64(buffer);
      const result = await appApi.writeFile(filePath, base64);
      return result.success;
    } catch (err) {
      console.error("保存文件失败:", err);
      return false;
    }
  }
  /** 将 CSV 文本写盘（UTF-8 带 BOM / GBK 经主进程编码） */
  static async saveCSVToFile(
    text: string,
    filePath: string,
    encoding: "utf-8" | "gbk",
  ): Promise<boolean> {
    try {
      if (encoding === "gbk") {
        const result = await appApi.writeTextEncoded(filePath, text, "gbk");
        return result.success;
      }
      // UTF-8 前置 BOM，便于 Excel 识别中文
      const result = await appApi.writeTextFile(filePath, "﻿" + text);
      return result.success;
    } catch (err) {
      console.error("保存 CSV 失败:", err);
      return false;
    }
  }
}
