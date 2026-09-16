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
 * 数学工具函数
 * Clean-room 实现，借鉴线性代数与数值分析的标准方法
 * 思想来源：WPD mathFunctions.js（仅借鉴数学公式，不复制实现）
 */
/** 2×2 矩阵行列式 */
export function det2x2(m: number[]): number {
  return m[0] * m[3] - m[1] * m[2];
}
/** 2×2 矩阵求逆；奇异矩阵返回 null（调用方据此报错而非静默输出零矩阵）
 * 使用相对阈值判奇异：|det| / max(‖row0‖², ‖row1‖²) < ε，
 * 避免微小量级数据（nm/nM/pA 级）的行列式绝对值极小但矩阵实际可逆时被误判。
 */
export function inv2x2(m: number[]): number[] | null {
  const d = det2x2(m);
  // 相对阈值：按矩阵范数归一化后判断，适配 nm/nM/pA 等微小量级
  const row0Norm = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
  const row1Norm = Math.sqrt(m[2] * m[2] + m[3] * m[3]);
  const maxNorm = Math.max(row0Norm, row1Norm);
  if (maxNorm === 0 || Math.abs(d) / (maxNorm * maxNorm) < 1e-15) {
    return null;
  }
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
}
/** 2×2 矩阵乘法 */
export function mult2x2(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
  ];
}
/** 2×2 矩阵乘向量 */
export function mult2x2Vec(m: number[], v: number[]): number[] {
  return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
}
/** 2D 距离平方 */
export function sqDist2d(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}
/** 2D 距离 */
export function dist2d(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(sqDist2d(x1, y1, x2, y2));
}
/** 3D 距离 */
export function dist3d(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): number {
  return Math.sqrt(
    (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2) + (z1 - z2) * (z1 - z2),
  );
}
/** RGB 颜色距离 */
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return dist3d(r1, g1, b1, r2, g2, b2);
}
/**
 * 三次样条插值（非等距自然三次样条）
 * 使用标准三弯矩方程，支持任意间距的 x 坐标。
 * 返回样条对象，可用于 csplineInterp 查询。
 */
export interface CubicSpline {
  x: number[];
  y: number[];
  len: number;
  /** 各节点处的二阶导数 M_i */
  m: number[];
}
export function cspline(x: number[], y: number[]): CubicSpline | null {
  const n = x.length;
  if (n < 3) return null;
  // 计算步长 h_i = x[i+1] - x[i]
  const h: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    if (h[i] <= 0) return null; // x 必须严格递增
  }
  // 构造三弯矩方程 A·M = d，其中 A 是三对角矩阵
  // 自然样条：M_0 = 0, M_{n-1} = 0
  const m: number[] = new Array(n).fill(0);
  // 内部节点 1..n-2 的方程：
  // h[i-1]*M[i-1] + 2*(h[i-1]+h[i])*M[i] + h[i]*M[i+1] = 6*((y[i+1]-y[i])/h[i] - (y[i]-y[i-1])/h[i-1])
  // 使用追赶法（Thomas algorithm）求解三对角系统
  const size = n - 2; // 内部未知数个数
  if (size <= 0) {
    return { x, y, len: n, m };
  }
  // 下对角 a[i], 主对角 b[i], 上对角 c[i], 右端 d[i] (i=0..size-1)
  // 对应内部节点 1..n-2
  const a: number[] = new Array(size); // 下对角（a[0] 不用）
  const b: number[] = new Array(size); // 主对角
  const c: number[] = new Array(size); // 上对角（c[size-1] 不用）
  const d: number[] = new Array(size); // 右端项
  for (let j = 0; j < size; j++) {
    const i = j + 1; // 实际节点索引
    b[j] = 2 * (h[i - 1] + h[i]);
    if (j > 0) a[j] = h[i - 1];
    if (j < size - 1) c[j] = h[i];
    d[j] = 6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]);
  }
  // 追赶法
  // 前消去
  const cp: number[] = new Array(size);
  const dp: number[] = new Array(size);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let j = 1; j < size; j++) {
    const denom = b[j] - a[j] * cp[j - 1];
    cp[j] = j < size - 1 ? c[j] / denom : 0;
    dp[j] = (d[j] - a[j] * dp[j - 1]) / denom;
  }
  // 回代
  m[n - 2] = dp[size - 1];
  for (let j = size - 2; j >= 0; j--) {
    m[j + 1] = dp[j] - cp[j] * m[j + 2];
  }
  // m[0] = 0, m[n-1] = 0 (自然样条，已初始化)
  return { x, y, len: n, m };
}
/** 三次样条插值查询（非等距自然样条） */
export function csplineInterp(cs: CubicSpline, x: number): number | null {
  if (x > cs.x[cs.len - 1] || x < cs.x[0]) return null;
  // 二分查找区间 [i, i+1]
  let lo = 0;
  let hi = cs.len - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cs.x[mid] <= x) lo = mid;
    else hi = mid;
  }
  const i = lo;
  const hi_x = cs.x[i + 1];
  const lo_x = cs.x[i];
  const h = hi_x - lo_x;
  if (h === 0) return cs.y[i];
  // 非等距样条公式：用二阶导数 M_i 表示
  // S_i(x) = M_i*(x_{i+1}-x)^3/(6h) + M_{i+1}*(x-x_i)^3/(6h)
  //        + (y_i/h - M_i*h/6)*(x_{i+1}-x) + (y_{i+1}/h - M_{i+1}*h/6)*(x-x_i)
  const mi = cs.m[i];
  const mi1 = cs.m[i + 1];
  const a = (hi_x - x) / h;
  const b = (x - lo_x) / h;
  return (
    mi * a * a * a * h * h / 6 +
    mi1 * b * b * b * h * h / 6 +
    (cs.y[i] - mi * h * h / 6) * a +
    (cs.y[i + 1] - mi1 * h * h / 6) * b
  );
}
/** 移动平均平滑 */
export function movingAverage(values: number[], windowSize: number): number[] {
  if (values.length === 0) return [];
  const half = Math.floor(windowSize / 2);
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - half);
      j <= Math.min(values.length - 1, i + half);
      j++
    ) {
      sum += values[j];
      count++;
    }
    result.push(sum / count);
  }
  return result;
}
/** 将角度规范化到 [0, 2π) */
export function normalizeAngleRad(rad: number): number {
  let norm = rad % (2 * Math.PI);
  if (norm < 0) norm += 2 * Math.PI;
  return norm;
}
/** 限制值在范围内 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
/** 生成唯一ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
