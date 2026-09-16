/**
 * projectNormalize 单元测试
 * 覆盖：normalizeProjectData 前向兼容（缺字段补默认、未知结构不崩溃）
 * runMigrations 无迁移链时原样返回（guard 不死循环）。
 * 纯函数、无 DOM / Tauri 依赖，Node 环境可直接运行。
 */
import { describe, it, expect } from "vitest";
import { normalizeProjectData, runMigrations } from "./projectNormalize";
describe("normalizeProjectData 前向兼容", () => {
  it("空输入补齐全部默认字段", () => {
    const p = normalizeProjectData(undefined);
    expect(p.imageRef).toBe("images/original.png");
    expect(p.chartType).toBe("xy");
    expect(p.calibration.points).toEqual([]);
    expect(p.calibration.scaleX).toBe("linear");
    expect(p.calibration.scaleY).toBe("linear");
    expect(p.datasets).toEqual([]);
    expect(p.settings.precision).toBe(3);
    expect(p.settings.units).toEqual({ x: "", y: "" });
    expect(p.detection).toBeUndefined();
  });
  it("：旧工程缺省轴 label/unit 补空串", () => {
    const p = normalizeProjectData({ calibration: { scaleX: "log" } });
    expect(p.calibration.xLabel).toBe("");
    expect(p.calibration.xUnit).toBe("");
    expect(p.calibration.yLabel).toBe("");
    expect(p.calibration.yUnit).toBe("");
  });
  it("：检测参数被归一化（缺省补默认值）", () => {
    const p = normalizeProjectData({
      detection: {
        colorParams: {
          fgColor: [1, 2, 3],
          colorDistance: 80,
          mode: "background",
        },
        curveParams: { xStep: 20 },
      },
    });
    expect(p.detection).toBeDefined();
    expect(p.detection!.colorParams.fgColor).toEqual([1, 2, 3]);
    expect(p.detection!.colorParams.bgColor).toEqual([255, 255, 255]); // 缺省
    expect(p.detection!.colorParams.mode).toBe("background");
    expect(p.detection!.curveParams.xStep).toBe(20);
    expect(p.detection!.curveParams.smoothing).toBe(true); // 缺省
    expect(p.detection!.blobParams).toEqual({
      minDiameter: 2,
      maxDiameter: 50,
    }); // 缺省
  });
  it("保留已提供字段并补齐缺失项", () => {
    const raw = {
      chartType: "bar",
      calibration: { points: [{ px: 1, py: 2, dx: 0, dy: 0, label: "P" }] },
      datasets: [{ points: [{ x: 1, y: 2 }] }],
      settings: { precision: 5 },
    };
    const p = normalizeProjectData(raw);
    expect(p.chartType).toBe("bar");
    expect(p.calibration.points).toEqual([]); // 点数≠4，清空待重新标定
    expect(p.calibration.scaleX).toBe("linear"); // 未提供 → 默认
    expect(p.datasets).toHaveLength(1);
    expect(p.datasets[0].id).toBeTruthy(); // 缺失 id 自动补
    expect(p.datasets[0].name).toBe("数据集1"); // 缺失 name 自动补
    expect(p.datasets[0].points).toEqual([{ x: 1, y: 2 }]);
    expect(p.datasets[0].metadata).toEqual({ area: null, moment: null });
    expect(p.settings.precision).toBe(5);
  });
  it("损坏的 datasets 元素（非数组 / 缺字段）被安全归一", () => {
    const raw = {
      datasets: "not-an-array",
      calibration: null,
    };
    const p = normalizeProjectData(raw);
    expect(Array.isArray(p.datasets)).toBe(true);
    expect(p.datasets).toEqual([]);
    expect(p.calibration.points).toEqual([]);
    expect(p.calibration.scaleX).toBe("linear");
  });
});
describe("runMigrations 迁移链", () => {
  it("无迁移链时原样返回且版本不变", () => {
    const raw = { a: 1, b: [2, 3] };
    const res = runMigrations(raw, "1.0");
    expect(res.data).toEqual(raw);
    expect(res.version).toBe("1.0");
  });
});
