/**
 * useUXMachine 状态机单元测试（ 回归修复）
 * 覆盖：EMPTY 只能 import、左栏入口无法进入无图状态、守卫可读原因。
 * 直接测纯逻辑（TRANSITIONS + guard），无 DOM 依赖。
 */
import { describe, it, expect } from "vitest";
import { TRANSITIONS, guard, type UXEvent } from "./useUXMachine";
import type { UXFacts } from "./useUXMachine";
const noFacts: UXFacts = {
  hasImage: false,
  isCalibrated: false,
  positionsSet: 0,
  valuesEntered: 0,
  totalPoints: 0,
};
const withImage: UXFacts = {
  hasImage: true,
  isCalibrated: false,
  positionsSet: 0,
  valuesEntered: 0,
  totalPoints: 0,
};
const calibrated: UXFacts = {
  hasImage: true,
  isCalibrated: true,
  positionsSet: 4,
  valuesEntered: 4,
  totalPoints: 0,
};
const withPoints: UXFacts = {
  hasImage: true,
  isCalibrated: true,
  positionsSet: 4,
  valuesEntered: 4,
  totalPoints: 5,
};
describe("：EMPTY 状态机收紧", () => {
  it("EMPTY 的迁移表只含 import（校准/取点/导出不可达）", () => {
    expect(Object.keys(TRANSITIONS.EMPTY)).toEqual(["import"]);
    for (const ev of [
      "startCalibrate",
      "enterExtract",
      "openExport",
      "commit",
      "cancel",
    ] as UXEvent[]) {
      expect(TRANSITIONS.EMPTY[ev]).toBeUndefined();
    }
  });
  it("EMPTY 下任何非 import 事件被守卫拦截且原因可读", () => {
    for (const ev of [
      "startCalibrate",
      "enterExtract",
      "openExport",
    ] as UXEvent[]) {
      expect(guard("EMPTY", ev, noFacts)).toBe("请先导入图像");
    }
  });
  it("IMPORT_READY 无图时 startCalibrate 被拦截，有图放行", () => {
    expect(guard("IMAGE_READY", "startCalibrate", noFacts)).toBe(
      "请先导入图像",
    );
    expect(guard("IMAGE_READY", "startCalibrate", withImage)).toBeNull();
  });
  it("CALIBRATED 无数据时 openExport 被拦截，有数据放行", () => {
    expect(guard("CALIBRATED", "openExport", calibrated)).toBe(
      "尚未取点，无数据可导出",
    );
    expect(guard("CALIBRATED", "openExport", withPoints)).toBeNull();
  });
});
