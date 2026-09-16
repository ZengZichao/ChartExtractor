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
 * 示例工程生成器（离线、确定性、无需打包二进制资源）
 *
 * 在浏览器内用 Canvas 绘制一张带坐标轴的示例图表（PNG Blob），
 * 并按「相同仿射几何」生成标定配置与已提取数据集，二者像素严格对齐
 * Canvas 上绘制曲线/散点的像素位置 == 加载后叠加层 dataToPixel 还原的位置。
 *
 * 设计要点
 * - 全程不走任何联网调用（base64/canvas.toBlob 均为本地），满足离线红线。
 * - 标定采用「角点标定」：P1(xmin) 与 P3(ymin) 共用左下角原点，P2(xmax) 右下角，
 * P4(ymax) 左上角；pixMat 仍可逆（PL≠PR、PB≠PT），残差≈0。
 * - 通过 applyLoadedProject 载入，复用现有工程加载链路，零额外状态逻辑。
 */
import type {
  CalibrationConfig,
  Dataset,
  ProjectData,
  ProjectManifest,
} from "../types";
import { generateId } from "../core/mathUtils";
import { APP_VERSION } from "../version";
// ========== 图像几何与坐标轴范围（图像像素空间） ==========
const W = 800;
const H = 600;
const PL = 90; // 绘图区左
const PR = 760; // 绘图区右
const PT = 50; // 绘图区上
const PB = 550; // 绘图区下
const X_MIN = 0;
const X_MAX = 10;
const Y_MIN = 0;
const Y_MAX = 100;
/** 数据坐标 → 图像像素坐标（与下方标定仿射完全等价，保证 PNG 绘制与叠加层对齐） */
function dataToPixel(x: number, y: number): { x: number; y: number } {
  return {
    x: PL + ((x - X_MIN) / (X_MAX - X_MIN)) * (PR - PL),
    y: PB - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (PB - PT),
  };
}
export interface SampleProject {
  data: ProjectData;
  blob: Blob;
  manifest: ProjectManifest;
}
/** 生成示例工程：示例图表图像、已标定的工程数据、清单 */
export async function generateSampleProject(): Promise<SampleProject> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");
  // 背景
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // 标题
  ctx.fillStyle = "#1d1d1f";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("示例图表：温度随反应时间变化", W / 2, 28);
  // 网格线
  ctx.strokeStyle = "#e5e5ea";
  ctx.lineWidth = 1;
  const xticks = [0, 2, 4, 6, 8, 10];
  const yticks = [0, 20, 40, 60, 80, 100];
  ctx.beginPath();
  for (const t of xticks) {
    const { x } = dataToPixel(t, 0);
    ctx.moveTo(x, PT);
    ctx.lineTo(x, PB);
  }
  for (const v of yticks) {
    const { y } = dataToPixel(0, v);
    ctx.moveTo(PL, y);
    ctx.lineTo(PR, y);
  }
  ctx.stroke();
  // 绘图区边框
  ctx.strokeStyle = "#8e8e93";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PL, PT, PR - PL, PB - PT);
  // 刻度标签
  ctx.fillStyle = "#6e6e73";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  for (const t of xticks) {
    const { x } = dataToPixel(t, 0);
    ctx.fillText(String(t), x, PB + 18);
  }
  ctx.textAlign = "right";
  for (const v of yticks) {
    const { y } = dataToPixel(0, v);
    ctx.fillText(String(v), PL - 8, y + 4);
  }
  // 轴名称
  ctx.textAlign = "center";
  ctx.fillText("时间 t (s)", (PL + PR) / 2, PB + 40);
  ctx.save();
  ctx.translate(22, (PT + PB) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("温度 T (°C)", 0, 0);
  ctx.restore();
  // 数据集 1：实测曲线（正弦）
  const curve: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * 10;
    const y = 50 + 30 * Math.sin(x * 0.6);
    curve.push({ x, y });
  }
  ctx.strokeStyle = "#007aff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  curve.forEach((p, i) => {
    const { x, y } = dataToPixel(p.x, p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#007aff";
  curve.forEach((p, i) => {
    if (i % 2 !== 0) return; // 隔点标记，避免过密
    const { x, y } = dataToPixel(p.x, p.y);
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  // 数据集 2：参考线（虚线、散点）
  const ref = [
    { x: 0.5, y: 16 },
    { x: 2.0, y: 28 },
    { x: 3.5, y: 40 },
    { x: 5.0, y: 52 },
    { x: 6.5, y: 64 },
    { x: 8.0, y: 76 },
    { x: 9.5, y: 90 },
  ];
  ctx.strokeStyle = "#ff3b30";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ref.forEach((p, i) => {
    const { x, y } = dataToPixel(p.x, p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff3b30";
  ref.forEach((p) => {
    const { x, y } = dataToPixel(p.x, p.y);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  // 图例
  ctx.font = "13px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#007aff";
  ctx.fillRect(PR - 150, PT + 10, 16, 4);
  ctx.fillText("实测曲线", PR - 128, PT + 16);
  ctx.fillStyle = "#ff3b30";
  ctx.fillRect(PR - 150, PT + 32, 16, 4);
  ctx.fillText("参考线", PR - 128, PT + 38);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("生成示例图片失败"));
    }, "image/png");
  });
  // 标定配置：角点标定，与图像几何严格一致（残差≈0）
  const calibration: CalibrationConfig = {
    points: [
      {
        px: PL,
        py: PB,
        dx: X_MIN,
        dy: null,
        label: "X轴最小值",
        role: "xmin",
        placed: true,
      },
      {
        px: PR,
        py: PB,
        dx: X_MAX,
        dy: null,
        label: "X轴最大值",
        role: "xmax",
        placed: true,
      },
      {
        px: PL,
        py: PB,
        dx: null,
        dy: Y_MIN,
        label: "Y轴最小值",
        role: "ymin",
        placed: true,
      },
      {
        px: PL,
        py: PT,
        dx: null,
        dy: Y_MAX,
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
    xLabel: "时间 t",
    xUnit: "s",
    yLabel: "温度 T",
    yUnit: "°C",
  };
  const datasets: Dataset[] = [
    {
      id: generateId(),
      name: "实测曲线",
      color: "#007aff",
      points: curve.map((p) => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })),
      metadata: { area: null, moment: null },
    },
    {
      id: generateId(),
      name: "参考线",
      color: "#ff3b30",
      points: ref.map((p) => ({ x: p.x, y: p.y })),
      metadata: { area: null, moment: null },
    },
  ];
  const data: ProjectData = {
    imageRef: "images/original.png",
    chartType: "xy",
    calibration,
    datasets,
    settings: { precision: 3, units: { x: "s", y: "°C" } },
  };
  const now = new Date().toISOString();
  const manifest: ProjectManifest = {
    formatVersion: "1.0",
    appVersion: APP_VERSION,
    createdAt: now,
    modifiedAt: now,
    originalFileName: "示例图表.png",
  };
  return { data, blob, manifest };
}
