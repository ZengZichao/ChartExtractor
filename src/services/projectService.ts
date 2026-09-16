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
 * 工程文件服务（.prj 格式）
 * ZIP 容器 + JSON 元数据、原始图片
 *
 * 工程文件结构
 * project.prj (ZIP)
 * ├── manifest.json # 工程元数据
 * ├── project.json # 标定参数、数据点、设置
 * ├── images/
 * │ └── original.png # 原始图片
 * └── thumbnails/
 * └── preview.png # 缩略图
 *
 * （L5）：实现格式版本迁移链、加载前自动备份（.prj.bak）+ 前向兼容（缺失字段补默认值、未知字段忽略）。
 */
import { appApi } from "../platform/api";
import type { ProjectData, ProjectManifest } from "../types";
import { runMigrations, normalizeProjectData } from "./projectNormalize";
import { APP_VERSION } from "../version";
// 注意：JSZip 在 buildProjectZip / parseProjectZip 内动态 import
const FORMAT_VERSION = "1.0";
export class ProjectService {
  /**
   * 保存工程文件（写盘前自动备份旧文件为 .prj.bak）
   */
  static async saveProject(
    filePath: string,
    data: ProjectData,
    imageBlob: Blob,
    originalFileName: string,
  ): Promise<boolean> {
    try {
      const zipBase64 = await this.buildProjectZip(
        data,
        imageBlob,
        originalFileName,
      );
      // 经主进程写盘并在覆盖前备份旧文件（.prj.bak）
      const result = await appApi.writeWithBackup(filePath, zipBase64);
      return result.success;
    } catch (err) {
      console.error("保存工程失败:", err);
      return false;
    }
  }
  /**
   * 构建工程 ZIP（base64）。saveProject 与 自动保存共用。
   */
  static async buildProjectZip(
    data: ProjectData,
    imageBlob: Blob,
    originalFileName: string,
  ): Promise<string> {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const now = new Date().toISOString();
    const manifest: ProjectManifest = {
      formatVersion: FORMAT_VERSION,
      appVersion: APP_VERSION,
      createdAt: now,
      modifiedAt: now,
      originalFileName,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("project.json", JSON.stringify(data, null, 2));
    const imageArrayBuffer = await imageBlob.arrayBuffer();
    // 扩展名收敛到白名单（粘贴截图等无扩展名/非法扩展名回退 png），保证 imageRef 与条目名一致
    const rawExt = originalFileName.split(".").pop()?.toLowerCase() || "";
    const ext = /^(png|jpe?g|bmp|webp|gif|svg)$/i.test(rawExt) ? rawExt : "png";
    zip.file(`images/original.${ext}`, imageArrayBuffer);
    return zip.generateAsync({ type: "base64" });
  }
  /**
   * 解析工程 ZIP（base64）→ 归一化数据、图像。loadProject 与 会话恢复共用。
   */
  static async parseProjectZip(zipBase64: string): Promise<{
    data: ProjectData;
    imageBlob: Blob;
    manifest: ProjectManifest;
  } | { ok: false; reason: string; errorCode: string }> {
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(zipBase64, { base64: true });
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) return { ok: false, reason: "MISSING_MANIFEST", errorCode: "MISSING_MANIFEST" };
      const manifest: ProjectManifest = JSON.parse(
        await manifestFile.async("string"),
      );
      const projectFile = zip.file("project.json");
      if (!projectFile) return { ok: false, reason: "MISSING_PROJECT_JSON", errorCode: "MISSING_PROJECT_JSON" };
      const rawData = JSON.parse(await projectFile.async("string"));
      // 版本迁移、前向兼容归一化
      const { data: migratedRaw, version } = runMigrations(
        rawData,
        manifest.formatVersion || FORMAT_VERSION,
      );
      const data = normalizeProjectData(migratedRaw);
      manifest.formatVersion = version;
      // 过滤目录条目（JSZip 写 images/original.png 时会同时创建目录条目 images/，且插入顺序在前），
      // 并按图片扩展名优先命中，避免 zip.file 取到 dir 条目返回 null。
      const imageFiles = Object.keys(zip.files).filter(
        (k) => k.startsWith("images/") && !zip.files[k].dir,
      );
      if (imageFiles.length === 0) return { ok: false, reason: "NO_IMAGE", errorCode: "NO_IMAGE" };
      const preferred = imageFiles.find((k) =>
        /\.(png|jpe?g|bmp|webp|gif|svg)$/i.test(k),
      );
      const imageKey = preferred ?? imageFiles[0];
      const imageFile = zip.file(imageKey);
      if (!imageFile) return { ok: false, reason: "IMAGE_READ_FAIL", errorCode: "IMAGE_READ_FAIL" };
      const imageArrayBuffer = await imageFile.async("arraybuffer");
      // 带 MIME 构造 Blob，避免无类型 Blob 依赖浏览器嗅探
      const ext = imageKey.split(".").pop()!.toLowerCase();
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "svg"
            ? "image/svg+xml"
            : `image/${ext}`;
      const imageBlob = new Blob([imageArrayBuffer], { type: mime });
      return { data, imageBlob, manifest };
    } catch (err) {
      console.error("解析工程失败:", err);
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `CORRUPT:${msg}`, errorCode: "CORRUPT" };
    }
  }
  /**
   * 加载工程文件（含版本迁移与备份）
   */
  static async loadProject(filePath: string): Promise<{
    data: ProjectData;
    imageBlob: Blob;
    manifest: ProjectManifest;
  } | { ok: false; reason: string; errorCode: string } | null> {
    try {
      const result = await appApi.readFile(filePath);
      if (!result.success || !result.data)
        return { ok: false, reason: result.error || "READ_FAIL", errorCode: "READ_FAIL" };
      return await this.parseProjectZip(result.data);
    } catch (err) {
      console.error("加载工程失败:", err);
      return null;
    }
  }
  /** 创建默认工程数据 */
  static createDefaultProjectData(chartType: "xy" = "xy"): ProjectData {
    return {
      imageRef: "images/original.png",
      chartType,
      calibration: {
        points: [],
        scaleX: "linear",
        scaleY: "linear",
        isDateX: false,
        isDateY: false,
        noRotation: false,
      },
      datasets: [],
      settings: {
        precision: 3,
        units: { x: "", y: "" },
      },
    };
  }
}
