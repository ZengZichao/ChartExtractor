/**
 * ExportService 导出格式单元测试
 * 覆盖：长表/宽表 CSV、语义表头（轴名、单位）、数据集勾选过滤、JSON 元信息。
 */
import { describe, it, expect } from "vitest";
import { ExportService } from "./exportService";
import type { Dataset, ExportOptions, CalibrationConfig } from "../types";
function makeDs(
  id: string,
  name: string,
  points: Array<{ x: number; y: number }>,
): Dataset {
  return {
    id,
    name,
    color: "#4a9eff",
    points,
    metadata: { area: null, moment: null },
  };
}
const calib: CalibrationConfig = {
  points: [],
  scaleX: "linear",
  scaleY: "linear",
  isDateX: false,
  isDateY: false,
  noRotation: false,
  xLabel: "时间",
  xUnit: "s",
  yLabel: "浓度",
  yUnit: "mol/L",
};
const baseOptions: ExportOptions = {
  format: "csv",
  encoding: "utf-8",
  precision: 2,
  includeHeader: true,
};
describe("buildCSVText 长表（pandas 可直读）", () => {
  it("默认长表：dataset,X,Y 三列，无注释行", () => {
    const ds = makeDs("a", "数据集1", [
      { x: 1.234, y: 5.678 },
      { x: 2, y: 6 },
    ]);
    const text = ExportService.buildCSVText(
      [ds],
      { ...baseOptions, mergeMode: "long" },
      calib,
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("dataset,时间(s),浓度(mol/L)");
    expect(lines[1]).toBe("数据集1,1.23,5.68");
    expect(lines[2]).toBe("数据集1,2.00,6.00");
    expect(lines.every((l) => !l.startsWith("#"))).toBe(true); // 不再有注释式拼接
  });
  it("多数据集长表逐行拼接", () => {
    const a = makeDs("a", "A曲线", [{ x: 1, y: 2 }]);
    const b = makeDs("b", "B曲线", [{ x: 3, y: 4 }]);
    const text = ExportService.buildCSVText(
      [a, b],
      { ...baseOptions, mergeMode: "long" },
      calib,
    );
    const lines = text.split("\n");
    expect(lines[1]).toBe("A曲线,1.00,2.00");
    expect(lines[2]).toBe("B曲线,3.00,4.00");
  });
  it("数据集名含逗号时被正确引用", () => {
    const ds = makeDs("a", "曲线,1", [{ x: 1, y: 2 }]);
    const text = ExportService.buildCSVText(
      [ds],
      { ...baseOptions, mergeMode: "long" },
      calib,
    );
    expect(text.split("\n")[1]).toBe('"曲线,1",1.00,2.00');
  });
});
describe("buildCSVText 宽表（按 X 对齐）", () => {
  it("X 取并集对齐，缺值留空", () => {
    const a = makeDs("a", "A", [{ x: 1, y: 10 }]);
    const b = makeDs("b", "B", [
      { x: 1, y: 20 },
      { x: 2, y: 30 },
    ]);
    const text = ExportService.buildCSVText(
      [a, b],
      { ...baseOptions, mergeMode: "wide" },
      calib,
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("时间(s),A,B");
    expect(lines[1]).toBe("1.00,10.00,20.00");
    expect(lines[2]).toBe("2.00,,30.00");
  });
});
describe("数据集勾选过滤", () => {
  it("datasetIds 仅导出选中数据集，空点集被过滤", () => {
    const a = makeDs("a", "A", [{ x: 1, y: 2 }]);
    const b = makeDs("b", "B", [{ x: 3, y: 4 }]);
    const empty = makeDs("e", "空", []);
    const text = ExportService.buildCSVText(
      [a, b, empty],
      { ...baseOptions, mergeMode: "long", datasetIds: ["b"] },
      calib,
    );
    const lines = text.split("\n");
    expect(lines).toHaveLength(2); // 表头 + 1 行（不再有注释/空行拼接）
    expect(lines[1]).toContain("B,");
    expect(text).not.toContain("A,");
    expect(text).not.toContain("空");
  });
});
describe("XLSX/JSON 语义元信息", () => {
  it("JSON 导出携带 axes 元信息（label/unit）", async () => {
    const ds = makeDs("a", "A", [{ x: 1, y: 2 }]);
    const blob = await ExportService.export(
      [ds],
      { ...baseOptions, format: "json" },
      calib,
    );
    const json = JSON.parse(await blob.text());
    expect(json.calibration.axes.x.label).toBe("时间");
    expect(json.calibration.axes.x.unit).toBe("s");
    expect(json.calibration.axes.y.label).toBe("浓度");
  });
  it("XLSX 导出成功且可解析", async () => {
    const ds = makeDs("a", "A", [{ x: 1, y: 2 }]);
    const blob = await ExportService.export(
      [ds],
      { ...baseOptions, format: "xlsx" },
      calib,
    );
    expect(blob.size).toBeGreaterThan(100);
  });
});
describe("XLSX 表名清洗与唯一化", () => {
  it("两个同名数据集导出成功，且 sheet 名唯一", async () => {
    const a = makeDs("a", "数据集2", [{ x: 1, y: 2 }]);
    const b = makeDs("b", "数据集2", [{ x: 3, y: 4 }]);
    const blob = await ExportService.export(
      [a, b],
      { ...baseOptions, format: "xlsx", datasetIds: ["a", "b"] },
      calib,
    );
    expect(blob.size).toBeGreaterThan(100);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await blob.arrayBuffer, { type: "array" });
    expect(new Set(wb.SheetNames).size).toBe(wb.SheetNames.length); // 无重名 sheet
    expect(wb.SheetNames[0]).not.toBe(wb.SheetNames[1]);
  });
  it("含非法字符的表名被清洗，不再抛错", async () => {
    const ds = makeDs("a", "A[1]:b/c", [{ x: 1, y: 2 }]);
    const blob = await ExportService.export(
      [ds],
      { ...baseOptions, format: "xlsx" },
      calib,
    );
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await blob.arrayBuffer, { type: "array" });
    expect(wb.SheetNames[0]).not.toMatch(/[:\\/?*[\]]/);
  });
});
