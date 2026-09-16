/**
 * GridDetector / CurveTracker 算法修复回归测试
 * - gridDetector：投影扫描外循环越界（<= 应为 <）修复
 * - curveTracker：合并窗口锚点过期（过度合并）修复、样条零步长死循环防御
 */
import { describe, it, expect } from "vitest";
import { GridDetector } from "./gridDetector";
import { CurveTracker } from "./curveTracker";
import type { BinaryData } from "./colorFilter";
/** 制造一个 dw×dh 的二值图，并在指定列/行填充亮像素 */
function makeBinary(
  dw: number,
  dh: number,
  fill?: (x: number, y: number) => boolean,
): BinaryData {
  const data = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      if (fill && fill(x, y)) data[y * dw + x] = 1;
    }
  }
  return data;
}
describe("GridDetector 投影扫描边界", () => {
  it("外循环不越界：检测范围边界等于图像尺寸时不报错且结果稳定", () => {
    const dw = 50;
    const dh = 40;
    // 在第 10 列画一条贯穿全高的竖线
    const bin = makeBinary(dw, dh, (x, y) => x === 10 && y < dh);
    const detector = new GridDetector({
      hasVertical: true,
      hasHorizontal: false,
      xFrac: 0.5,
      yFrac: 0.5,
    });
    // 用默认边界（xmax=dw, ymax=dh）应命中第 10 列，且不越界抛错
    const r1 = detector.detect(bin, dw, dh);
    expect(r1.verticalLines).toContain(10);
    expect(() =>
      detector.detect(bin, dw, dh, { xmin: 0, xmax: dw, ymin: 0, ymax: dh }),
    ).not.toThrow();
    const r2 = detector.detect(bin, dw, dh, {
      xmin: 0,
      xmax: dw,
      ymin: 0,
      ymax: dh,
    });
    expect(r2.verticalLines).toEqual(r1.verticalLines);
  });
  it("合并窗口锚点过期修复：相邻但不该合并的远点不会被并入同一簇", () => {
    const dw = 200;
    const dh = 20;
    // 在 y 方向构造两个相距较远（> yStep）的亮行程，它们不应被合并
    const bin = makeBinary(dw, dh, (x, y) => x < 3 && (y === 2 || y === 15));
    const tracker = new CurveTracker({ xStep: 5, yStep: 4, smoothing: false });
    const pts = tracker.track(bin, dw, dh);
    // 两个独立行程 → 至少两个点（未过度合并为 1 个）
    expect(pts.length).toBeGreaterThanOrEqual(2);
  });
});
describe("CurveTracker 样条零步长防御", () => {
  it("所有点 x 相同时不进入重采样死循环（step<=0 直接跳过）", () => {
    const dw = 10;
    const dh = 10;
    // 仅在单列有亮像素 → xs 基本单一，step 可能 <= 0
    const bin = makeBinary(dw, dh, (x, y) => x === 0 && y < 10);
    const tracker = new CurveTracker({ xStep: 5, yStep: 5, smoothing: true });
    let result: Array<{ x: number; y: number }> = [];
    // 设置短超时保护：若陷入死循环会被测试框架超时
    expect(() => {
      result = tracker.track(bin, dw, dh);
    }).not.toThrow();
    // 结果应为有限数组（不会无限增长）
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThan(100000);
  });
});
