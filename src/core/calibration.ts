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
 * 坐标标定模块
 * Clean-room 实现，借鉴 WPD xy.js 的 4 点仿射标定数学思想
 * 思想来源：WPD core/axes/xy.js（2×2 仿射矩阵 A = dat_mat · inv(pix_mat)）
 *
 * 标准图表为平面仿射变换（正交轴、无非线性透视），
 * 采用 3-4 点仿射（6-DOF），透视校正由预处理阶段对图像做单应 warp 完成。
 */
import { mult2x2, inv2x2, mult2x2Vec } from "./mathUtils";
import type { CalibrationConfig, CalibrationPoint } from "../types";
/** 标定点的固定顺序角色。用于兼容未保存 role 字段的旧工程 .prj 数据。 */
const ROLE_BY_INDEX = ["xmin", "xmax", "ymin", "ymax"];
/** 取点的轴角色；旧数据缺 role 时按索引兜底，保证 allFilled / 残差计算不误判。 */
function roleOf(p: CalibrationPoint, i: number): string {
  return p.role ?? ROLE_BY_INDEX[i] ?? "";
}
export class Calibration {
  private aMat: number[] = [0, 0, 0, 0]; // 仿射矩阵 2×2
  private aInvMat: number[] = [0, 0, 0, 0]; // 逆矩阵
  private cVec: number[] = [0, 0]; // 平移向量
  private isLogX = false;
  private isLogY = false;
  private isLogXNegative = false;
  private isLogYNegative = false;
  private isXDate = false;
  private isYDate = false;
  private noRotation = false;
  private calibrated = false;
  /** 重投影残差（像素），标定质量指示（UX 方案 质量信号） */
  private residual = 0;
  /** 对数变换：将数据值转换为对数空间 */
  private toLogSpace(
    value: number,
    isLog: boolean,
    isNegative: boolean,
  ): number {
    if (!isLog) return value;
    if (isNegative) return Math.log(-value) / Math.log(10);
    return Math.log(value) / Math.log(10);
  }
  /** 对数逆变换：从对数空间恢复数据值 */
  private fromLogSpace(
    value: number,
    isLog: boolean,
    isNegative: boolean,
  ): number {
    if (!isLog) return value;
    if (isNegative) return -Math.pow(10, value);
    return Math.pow(10, value);
  }
  /**
   * 执行标定
   * 需要 4 个标定点：P1(xmin), P2(xmax), P3(ymin), P4(ymax)
   * 仿射矩阵 A = dat_mat · inv(pix_mat)，其中
   * dat_mat = [xmin-xmax, 0; 0, ymin-ymax]
   * pix_mat = [x1-x2, x3-x4; y1-y2, y3-y4]
   */
  calibrate(config: CalibrationConfig): boolean {
    const points = config.points;
    if (points.length < 4) return false;
    this.calibrated = false;
    // 每次标定都是一次全新的映射建立：先复位派生标志，避免上一次标定（或上一个工程，如
    // 重标定/加载工程路径，均不调用 reset）的负对数状态残留污染本次结果。
    this.isLogXNegative = false;
    this.isLogYNegative = false;
    this.residual = 0;
    // 守卫：位置必须齐全；数值按角色判定——xmin/xmax 只需 dx，ymin/ymax 只需 dy。
    // 修复：交互式标定每个点只渲染一个输入框（x 轴点填 dx、y 轴点填 dy），
    // 原逻辑要求每点同时具备 dx 与 dy，导致 allFilled 恒为 false、标定永远无法提交。
    const allFilled = points.every((p, i) => {
      const isX = roleOf(p, i) === "xmin" || roleOf(p, i) === "xmax";
      return (
        p.px != null && p.py != null && (isX ? p.dx != null : p.dy != null)
      );
    });
    if (!allFilled) return false;
    const p1 = points[0]; // xmin
    const p2 = points[1]; // xmax
    const p3 = points[2]; // ymin
    const p4 = points[3]; // ymax
    let xmin = p1.dx!;
    let xmax = p2.dx!;
    let ymin = p3.dy!;
    let ymax = p4.dy!;
    this.isLogX = config.scaleX === "log";
    this.isLogY = config.scaleY === "log";
    this.isXDate = config.isDateX;
    this.isYDate = config.isDateY;
    this.noRotation = config.noRotation;
    // 对数轴处理
    if (this.isLogX) {
      // P2-17 修复：对数轴数值必须同号且非零，否则返回 false
      if (xmin === 0 || xmax === 0 || (xmin > 0) !== (xmax > 0)) {
        this.residual = Infinity;
        return false;
      }
      if (xmin < 0 && xmax < 0) {
        this.isLogXNegative = true;
        xmin = Math.log(-xmin) / Math.log(10);
        xmax = Math.log(-xmax) / Math.log(10);
      } else {
        xmin = Math.log(xmin) / Math.log(10);
        xmax = Math.log(xmax) / Math.log(10);
      }
    }
    if (this.isLogY) {
      // P2-17 修复：对数轴数值必须同号且非零
      if (ymin === 0 || ymax === 0 || (ymin > 0) !== (ymax > 0)) {
        this.residual = Infinity;
        return false;
      }
      if (ymin < 0 && ymax < 0) {
        this.isLogYNegative = true;
        ymin = Math.log(-ymin) / Math.log(10);
        ymax = Math.log(-ymax) / Math.log(10);
      } else {
        ymin = Math.log(ymin) / Math.log(10);
        ymax = Math.log(ymax) / Math.log(10);
      }
    }
    const datMat = [xmin - xmax, 0, 0, ymin - ymax];
    const pixMat = [p1.px - p2.px, p3.px - p4.px, p1.py - p2.py, p3.py - p4.py];
    const pixInv = inv2x2(pixMat);
    if (!pixInv) {
      // 标定点共线 → 奇异矩阵，标定失败
      this.residual = Infinity;
      return false;
    }
    this.aMat = mult2x2(datMat, pixInv);
    // noRotation 模式：吸附水平/垂直
    if (this.noRotation) {
      const dxPix = p2.px - p1.px;
      const dyPix = p4.py - p3.py;
      if (
        Math.abs(this.aMat[0] * this.aMat[3]) >
        Math.abs(this.aMat[1] * this.aMat[2])
      ) {
        this.aMat[1] = 0;
        this.aMat[2] = 0;
        this.aMat[0] = Math.abs(dxPix) > 1e-12 ? (xmax - xmin) / dxPix : 0;
        this.aMat[3] = Math.abs(dyPix) > 1e-12 ? (ymax - ymin) / dyPix : 0;
      } else {
        this.aMat[0] = 0;
        this.aMat[3] = 0;
        const dy2 = p2.py - p1.py;
        const dx2 = p4.px - p3.px;
        this.aMat[1] = Math.abs(dy2) > 1e-12 ? (xmax - xmin) / dy2 : 0;
        this.aMat[2] = Math.abs(dx2) > 1e-12 ? (ymax - ymin) / dx2 : 0;
      }
    }
    const aInv = inv2x2(this.aMat);
    this.aInvMat = aInv ?? [0, 0, 0, 0];
    if (!aInv) {
      // aMat 奇异（如 noRotation 除零后）
      this.residual = Infinity;
      return false;
    }
    this.cVec[0] = xmin - this.aMat[0] * p1.px - this.aMat[1] * p1.py;
    this.cVec[1] = ymin - this.aMat[2] * p3.px - this.aMat[3] * p3.py;
    // 计算重投影残差（像素），作为标定质量信号供 UI 展示
    this.residual = this.computeResidual(points);
    this.calibrated = true;
    return true;
  }
  /**
   * 重投影残差：每个标定点由“已知轴的数据值”反解其在图上应有的像素位置，
   * 与真实点击位置比较，取 RMS（像素）。作为标定质量信号供 UI 展示。
   *
   * 修复：交互式标定下 x 轴点只有 dx、y 轴点只有 dy，原实现把 null 传给
   * dataToPixel 产生 NaN。此处仅用已知轴：按当前仿射反解该点应有的像素坐标，
   * 并在 noRotation 取垂直分支（aMat[0]≈0）时能正确改用 py 反解，避免除零与 NaN。
   */
  private computeResidual(points: CalibrationPoint[]): number {
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.px == null || p.py == null) continue;
      const isX = roleOf(p, i) === "xmin" || roleOf(p, i) === "xmax";
      let predPx = p.px;
      let predPy = p.py;
      if (isX && p.dx != null) {
        const dLog = this.toLogSpace(p.dx, this.isLogX, this.isLogXNegative);
        // xf = aMat[0]·px + aMat[1]·py + cVec[0]，用真实 py 反解 px（或反之）。
        if (Math.abs(this.aMat[0]) >= Math.abs(this.aMat[1])) {
          if (this.aMat[0] !== 0)
            predPx = (dLog - this.cVec[0] - this.aMat[1] * p.py) / this.aMat[0];
        } else if (this.aMat[1] !== 0) {
          predPy = (dLog - this.cVec[0] - this.aMat[0] * p.px) / this.aMat[1];
        }
      } else if (!isX && p.dy != null) {
        const dLog = this.toLogSpace(p.dy, this.isLogY, this.isLogYNegative);
        // yf = aMat[2]·px + aMat[3]·py + cVec[1]，用真实 px 反解 py（或反之）。
        if (Math.abs(this.aMat[3]) >= Math.abs(this.aMat[2])) {
          if (this.aMat[3] !== 0)
            predPy = (dLog - this.cVec[1] - this.aMat[2] * p.px) / this.aMat[3];
        } else if (this.aMat[2] !== 0) {
          predPx = (dLog - this.cVec[1] - this.aMat[3] * p.py) / this.aMat[2];
        }
      } else {
        continue;
      }
      const dpx = predPx - p.px;
      const dpy = predPy - p.py;
      sumSq += dpx * dpx + dpy * dpy;
      n++;
    }
    return n > 0 ? Math.sqrt(sumSq / n) : 0;
  }
  /** 残差（像素）。越大表示标定点与数据值越不一致，提示用户重标 */
  getResidual(): number {
    return this.residual;
  }
  /** 像素坐标 → 数据坐标（未标定时返回 null，UI 回退像素坐标） */
  pixelToData(px: number, py: number): [number, number] | null {
    if (!this.calibrated) return null;
    const datVec = mult2x2Vec(this.aMat, [px, py]);
    let xf = datVec[0] + this.cVec[0];
    let yf = datVec[1] + this.cVec[1];
    xf = this.fromLogSpace(xf, this.isLogX, this.isLogXNegative);
    yf = this.fromLogSpace(yf, this.isLogY, this.isLogYNegative);
    return [xf, yf];
  }
  /** 数据坐标 → 像素坐标 */
  dataToPixel(x: number, y: number): { x: number; y: number } {
    if (!this.calibrated) return { x: 0, y: 0 };
    x = this.toLogSpace(x, this.isLogX, this.isLogXNegative);
    y = this.toLogSpace(y, this.isLogY, this.isLogYNegative);
    const datVec = [x - this.cVec[0], y - this.cVec[1]];
    const pix = mult2x2Vec(this.aInvMat, datVec);
    return { x: pix[0], y: pix[1] };
  }
  isCalibrated(): boolean {
    return this.calibrated;
  }
  /** 复位标定状态（导入新图时调用，避免沿用旧仿射矩阵) */
  reset(): void {
    this.calibrated = false;
    this.aMat = [0, 0, 0, 0];
    this.aInvMat = [0, 0, 0, 0];
    this.cVec = [0, 0];
    this.isLogX = false;
    this.isLogY = false;
    this.isLogXNegative = false;
    this.isLogYNegative = false;
    this.isXDate = false;
    this.isYDate = false;
    this.noRotation = false;
    this.residual = 0;
  }
  getIsLogX(): boolean {
    return this.isLogX;
  }
  getIsLogY(): boolean {
    return this.isLogY;
  }
  getIsXDate(): boolean {
    return this.isXDate;
  }
  getIsYDate(): boolean {
    return this.isYDate;
  }
  /** 创建默认标定配置 */
  static createDefaultConfig(): CalibrationConfig {
    return {
      points: [],
      scaleX: "linear",
      scaleY: "linear",
      isDateX: false,
      isDateY: false,
      noRotation: false,
    };
  }
  /**
   * 创建默认标定点（仅提供轴角色与标签，dx/dy 为 null）
   * 不再填入假坐标（旧实现填 0/10 会导致未改值时算出无意义仿射矩阵)。
   * 位置由用户在图上点击设置（placed），数值由用户在右侧输入（必填）。
   */
  static getDefaultCalibrationPoints(): Omit<CalibrationPoint, "px" | "py">[] {
    return [
      { dx: null, dy: null, label: "calib.xmin", role: "xmin" },
      { dx: null, dy: null, label: "calib.xmax", role: "xmax" },
      { dx: null, dy: null, label: "calib.ymin", role: "ymin" },
      { dx: null, dy: null, label: "calib.ymax", role: "ymax" },
    ];
  }
}
