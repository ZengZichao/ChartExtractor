/**
 * Calibration 仿射标定单元测试
 * 覆盖：未标定返回零、线性/对数像素↔数据往返一致性、reset 复位。
 * 纯函数、无 DOM 依赖，Node 环境可直接运行。
 */
import { describe, it, expect } from "vitest";
import { Calibration } from "./calibration";
import type { CalibrationConfig, CalibrationPoint } from "../types";
/** 构造一个轴对齐 4 点标定配置（左上=min/max 角，右下=min/min 角） */
function makeLinearConfig(): CalibrationConfig {
  const pt = (
    px: number,
    py: number,
    dx: number,
    dy: number,
    label: string,
  ): CalibrationPoint => ({
    px,
    py,
    dx,
    dy,
    label,
  });
  return {
    points: [
      pt(100, 100, 0, 0, "X轴最小值"), // 左上：xmin
      pt(500, 100, 10, 0, "X轴最大值"), // 右上：xmax
      pt(100, 400, 0, 0, "Y轴最小值"), // 左下：ymin
      pt(100, 100, 0, 20, "Y轴最大值"), // 左上：ymax
    ],
    scaleX: "linear",
    scaleY: "linear",
    isDateX: false,
    isDateY: false,
    noRotation: false,
  };
}
describe("Calibration 未标定状态", () => {
  it("未标定时 pixelToData / dataToPixel 返回零", () => {
    const c = new Calibration();
    expect(c.isCalibrated()).toBe(false);
    expect(c.pixelToData(123, 456)).toBeNull();
    expect(c.dataToPixel(1, 2)).toEqual({ x: 0, y: 0 });
  });
});
describe("Calibration 线性仿射往返", () => {
  it("已知角点像素映射到正确数据坐标", () => {
    const c = new Calibration();
    expect(c.calibrate(makeLinearConfig())).toBe(true);
    expect(c.isCalibrated()).toBe(true);
    // 左上角 (100,100) → (xmin=0, ymax=20)
    expect(c.pixelToData(100, 100)![0]).toBeCloseTo(0, 6);
    expect(c.pixelToData(100, 100)![1]).toBeCloseTo(20, 6);
    // 右下角 (500,400) → (xmax=10, ymin=0)
    expect(c.pixelToData(500, 400)![0]).toBeCloseTo(10, 6);
    expect(c.pixelToData(500, 400)![1]).toBeCloseTo(0, 6);
  });
  it("像素↔数据坐标往返一致（容差 1e-6）", () => {
    const c = new Calibration();
    c.calibrate(makeLinearConfig());
    const samples: Array<[number, number]> = [
      [5, 10],
      [3.2, 7.7],
      [8.9, 1.1],
      [0, 0],
      [10, 20],
    ];
    for (const [x, y] of samples) {
      const px = c.dataToPixel(x, y);
      const back = c.pixelToData(px.x, px.y);
      expect(back![0]).toBeCloseTo(x, 6);
      expect(back![1]).toBeCloseTo(y, 6);
    }
  });
});
describe("Calibration 对数轴往返", () => {
  it("log X 轴上数据↔像素往返一致", () => {
    const cfg = makeLinearConfig();
    cfg.scaleX = "log";
    // 用 xmin=1, xmax=100 的正数对数区间（避免负对数分支）
    cfg.points[0] = { ...cfg.points[0], dx: 1 };
    cfg.points[1] = { ...cfg.points[1], dx: 100 };
    cfg.points[3] = { ...cfg.points[3], dx: 1 };
    const c = new Calibration();
    expect(c.calibrate(cfg)).toBe(true);
    const samples: Array<[number, number]> = [
      [10, 5],
      [1, 10],
      [100, 0],
      [31.6, 7.7],
    ];
    for (const [x, y] of samples) {
      const px = c.dataToPixel(x, y);
      const back = c.pixelToData(px.x, px.y);
      expect(back![0]).toBeCloseTo(x, 5);
      expect(back![1]).toBeCloseTo(y, 6);
    }
  });
});
describe("Calibration reset", () => {
  it("reset 后回到未标定且像素映射归零", () => {
    const c = new Calibration();
    c.calibrate(makeLinearConfig());
    expect(c.isCalibrated()).toBe(true);
    c.reset();
    expect(c.isCalibrated()).toBe(false);
    expect(c.pixelToData(300, 250)).toBeNull();
  });
  it("createDefaultConfig 返回空 points 与线性轴", () => {
    const d = Calibration.createDefaultConfig();
    expect(d.points).toEqual([]);
    expect(d.scaleX).toBe("linear");
    expect(d.scaleY).toBe("linear");
  });
});
describe("Calibration 负对数标志复位", () => {
  it("先负对数 X 标定、再正对数 X 标定（不 reset），取出的 X 符号应为正", () => {
    const neg = makeInteractiveConfig();
    neg.scaleX = "log";
    neg.points[0] = { ...neg.points[0], dx: -100 }; // xmin 负
    neg.points[1] = { ...neg.points[1], dx: -10 }; // xmax 负
    const c = new Calibration();
    expect(c.calibrate(neg)).toBe(true);
    // 负对数区间残留：若标志未复位，正数区间会被整体取负
    const [xNeg] = c.pixelToData(300, 250)!;
    expect(xNeg).toBeLessThan(0);
    const pos = makeInteractiveConfig();
    pos.scaleX = "log";
    pos.points[0] = { ...pos.points[0], dx: 1 }; // xmin 正
    pos.points[1] = { ...pos.points[1], dx: 100 }; // xmax 正
    expect(c.calibrate(pos)).toBe(true); // 不调用 reset，直接重新标定
    const [xPos] = c.pixelToData(300, 250)!;
    expect(xPos).toBeGreaterThan(0); // 修复前为 -1（符号被污染）
  });
});
/** 构造交互式标定的真实数据形状：每个点只填“本轴”数值，且 role 明确 */
function makeInteractiveConfig(): CalibrationConfig {
  return {
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
  };
}
describe("Calibration 交互式标定（单轴录入，修复 BUG）", () => {
  it("每点仅填本轴数值也能标定成功（不再因缺另一轴而 allFilled=false）", () => {
    const c = new Calibration();
    expect(c.calibrate(makeInteractiveConfig())).toBe(true);
    expect(c.isCalibrated()).toBe(true);
  });
  it("标定后像素↔数据映射正确（x 用 dx、y 用 dy）", () => {
    const c = new Calibration();
    c.calibrate(makeInteractiveConfig());
    // (100,100) 同时是 xmin 与 ymax → 数据应为 (0, 20)
    expect(c.pixelToData(100, 100)![0]).toBeCloseTo(0, 6);
    expect(c.pixelToData(100, 100)![1]).toBeCloseTo(20, 6);
    // (500,100) 是 xmax → 数据 x=10
    expect(c.pixelToData(500, 100)![0]).toBeCloseTo(10, 6);
    // (100,400) 是 ymin → 数据 y=0
    expect(c.pixelToData(100, 400)![1]).toBeCloseTo(0, 6);
  });
  it("缺失任一“本轴”数值时标定被守卫拦截（返回 false）", () => {
    const cfg = makeInteractiveConfig();
    // 让 xmax 缺 dx（交互式标定下它本就不该有 dy）
    cfg.points[1] = { ...cfg.points[1], dx: undefined as unknown as number };
    const c = new Calibration();
    expect(c.calibrate(cfg)).toBe(false);
    expect(c.isCalibrated()).toBe(false);
  });
  it("残差计算不再产生 NaN，且为有限非负数（修复 computeResidual 喂 null）", () => {
    const c = new Calibration();
    c.calibrate(makeInteractiveConfig());
    const res = c.getResidual();
    expect(Number.isFinite(res)).toBe(true);
    expect(res).toBeGreaterThanOrEqual(0);
  });
  it("兼容旧工程数据（无 role 字段）按索引兜底仍可标定", () => {
    const cfg = makeInteractiveConfig();
    // 去掉 role，模拟早期 .prj 未保存 role 的情况
    cfg.points = cfg.points.map(
      ({ role: _role, ...rest }) => rest as CalibrationConfig["points"][number],
    );
    const c = new Calibration();
    expect(c.calibrate(cfg)).toBe(true);
  });
});
describe("Calibration 退化几何不崩溃", () => {
  it("标定点退化（像素共线导致矩阵奇异）时标定失败、residual 为 Infinity", () => {
    const cfg = makeInteractiveConfig();
    // 让 xmin/xmax 落在同一像素，造成 pixMat 奇异
    cfg.points[1] = { ...cfg.points[1], px: 100, py: 100 };
    const c = new Calibration();
    expect(() => c.calibrate(cfg)).not.toThrow();
    expect(c.calibrate(cfg)).toBe(false);
    expect(c.getResidual()).toBe(Infinity);
  });
});
