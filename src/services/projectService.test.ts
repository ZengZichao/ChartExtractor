/**
 * ProjectService 工程保存→读取往返测试
 * 用真实 JSZip 做内存往返，不 mock zip —— 必须覆盖「ZIP 内含目录条目」这一现实结构，
 * 否则无法拦截「parseProjectZip 命中目录条目返回 null」类缺陷。
 */
import { describe, it, expect, vi } from "vitest";
// projectService 顶部 import '../platform/api'（@tauri-apps/api），测试环境无 Tauri，mock 掉
vi.mock("../platform/api", () => ({
  appApi: {
    writeWithBackup: vi.fn(async () => ({ success: true })),
    readFile: vi.fn(async () => ({ success: false, data: undefined })),
  },
}));
import { ProjectService } from "./projectService";
import type { ProjectData } from "../types";
function makeProjectData(): ProjectData {
  return {
    imageRef: "images/original.png",
    chartType: "xy",
    calibration: {
      points: [
        {
          px: 100,
          py: 100,
          dx: 0,
          dy: null,
          label: "X轴最小值",
          role: "xmin",
          placed: true,
        },
        {
          px: 500,
          py: 100,
          dx: 10,
          dy: null,
          label: "X轴最大值",
          role: "xmax",
          placed: true,
        },
        {
          px: 100,
          py: 400,
          dx: null,
          dy: 0,
          label: "Y轴最小值",
          role: "ymin",
          placed: true,
        },
        {
          px: 100,
          py: 100,
          dx: null,
          dy: 20,
          label: "Y轴最大值",
          role: "ymax",
          placed: true,
        },
      ],
      scaleX: "linear",
      scaleY: "linear",
      isDateX: false,
      isDateY: false,
      noRotation: false,
    },
    datasets: [
      {
        id: "ds1",
        name: "数据集1",
        color: "#007aff",
        points: [{ x: 1.5, y: 2.5 }],
        metadata: { area: null, moment: null },
      },
    ],
    settings: { precision: 3, units: { x: "s", y: "" } },
    detection: {
      colorParams: {
        fgColor: [0, 0, 200],
        bgColor: [255, 255, 255],
        colorDistance: 120,
        mode: "foreground",
      },
      curveParams: { xStep: 10, yStep: 10, smoothing: true },
      blobParams: { minDiameter: 2, maxDiameter: 50 },
    },
  };
}
describe("ProjectService buildProjectZip ↔ parseProjectZip 往返", () => {
  it("保存→读取还原数据、图像字节与清单（不 mock JSZip，覆盖目录条目结构）", async () => {
    const imageBytes = new Uint8Array([
      137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    const blob = new Blob([imageBytes], { type: "image/png" });
    const data = makeProjectData();
    const base64 = await ProjectService.buildProjectZip(
      data,
      blob,
      "示例图表.png",
    );
    expect(base64.length).toBeGreaterThan(0);
    // 关键断言：真实 ZIP 内含 images/ 目录条目，parseProjectZip 必须能正常读取
    const parsed = await ProjectService.parseProjectZip(base64);
    expect(parsed).not.toBeNull(); // 修复前恒为 null（P0-1）
    if (!parsed || !('data' in parsed)) return;
    expect(parsed.imageBlob.size).toBe(imageBytes.length);
    expect(parsed.manifest.originalFileName).toBe("示例图表.png");
    expect(parsed.data.datasets).toHaveLength(1);
    expect(parsed.data.datasets[0].points[0]).toEqual({ x: 1.5, y: 2.5 });
    expect(parsed.data.calibration.points).toHaveLength(4);
    expect(parsed.data.detection?.curveParams.xStep).toBe(10);
  });
  it("损坏的 base64 返回错误信息而非抛异常", async () => {
    const parsed = await ProjectService.parseProjectZip("not-a-zip-base64===");
    expect(parsed).not.toBeNull();
    expect('reason' in parsed).toBe(true);
  });
});
