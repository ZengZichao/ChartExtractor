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
 * 画布组件
 * 负责图像渲染、缩放/平移、标定点和数据点叠加层显示
 * 处理鼠标交互：左键取点/标定、右键上下文菜单、滚轮缩放、空格、拖拽平移
 */
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { CalibrationPoint, DataPoint, PixelPoint } from "../types";
import { useI18n } from "../hooks/useI18n";
import {
  BarChartIcon,
  MinusIcon,
  PlusIcon,
  MaximizeIcon,
  LockIcon,
} from "./Icons";
export interface CanvasHandle {
  getCanvas(): HTMLCanvasElement | null;
  getImageData(): ImageData | null;
  setImageData(data: ImageData): void;
  zoomToFit(): void;
  zoomIn(): void;
  zoomOut(): void;
  redraw(): void;
  screenToImage(sx: number, sy: number): PixelPoint;
  imageToScreen(ix: number, iy: number): PixelPoint;
}
interface ChartCanvasProps {
  image: HTMLImageElement | null;
  calibrationPoints: CalibrationPoint[];
  dataPoints: Array<{ points: DataPoint[]; color: string }>;
  calibrating: boolean; // 是否在标定模式
  calibratePointIndex: number; // 当前标定的点索引
  showDataPoints: boolean;
  onCanvasClick: (imgX: number, imgY: number) => void;
  onCanvasRightClick: (
    imgX: number,
    imgY: number,
    screenX: number,
    screenY: number,
  ) => void;
  /** 拖拽数据点改位（dsIdx=数据集下标，ptIdx=点下标，imgX/imgY=新图像坐标） */
  onCanvasPointMove?: (
    dsIdx: number,
    ptIdx: number,
    imgX: number,
    imgY: number,
  ) => void;
  onColorPick: (imgX: number, imgY: number) => void;
  colorPickMode: boolean;
  maskImageData?: ImageData | null;
  showMask: boolean;
  /** 标定后的像素→数据坐标换算（未标定时传 null 回退像素读数） */
  pixelToData?: (px: number, py: number) => [number, number] | null;
  /** 是否显示数据坐标读数（= 已标定） */
  showDataReadout?: boolean;
  /** 读数精度 */
  precision?: number;
  /** 自动检测结果预览（图像像素坐标，半透明叠加） */
  previewPixelPoints?: Array<{ x: number; y: number }> | null;
  previewColor?: string;
  /** 叠加校验——translucent 以半透明无连线方式渲染数据点，直观校验精度 */
  overlayStyle?: "solid" | "translucent";
}
const ChartCanvas = forwardRef<CanvasHandle, ChartCanvasProps>(
  (
    {
      image,
      calibrationPoints,
      dataPoints,
      calibrating,
      calibratePointIndex,
      showDataPoints,
      onCanvasClick,
      onCanvasRightClick,
      onCanvasPointMove,
      onColorPick,
      colorPickMode,
      maskImageData,
      showMask,
      pixelToData,
      showDataReadout = false,
      precision = 3,
      previewPixelPoints = null,
      previewColor = "#ff9500",
      overlayStyle = "solid",
    },
    ref,
  ) => {
    const { t } = useI18n();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const hintTimer = useRef<number | null>(null);
    const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
    const imageDataRef = useRef<ImageData | null>(null);
    // 原图离屏 canvas 缓存——放大镜像素采样复用，不再每次 mousemove 新建全尺寸画布
    const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const srcCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    // 画布底色在主题变化时读取一次并缓存，避免每次 draw 强制 getComputedStyle
    const canvasBgRef = useRef("#f2f2f7");
    // P2-10 修复：掩码叠加层离屏画布缓存，避免每帧新建临时 canvas
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const maskImageRef = useRef<ImageData | null>(null);
    // 放大镜 rAF 节流（每帧最多更新一次）
    const rafIdRef = useRef<number | null>(null);
    const pendingMoveRef = useRef<{
      clientX: number;
      clientY: number;
      rect: DOMRect;
    } | null>(null);
    // 滚轮缩放原生监听器读取的最新值镜像
    const zoomRef = useRef(zoom);
    const offsetRef = useRef(offset);
    useEffect(() => {
      zoomRef.current = zoom;
    }, [zoom]);
    useEffect(() => {
      offsetRef.current = offset;
    }, [offset]);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
      null,
    );
    // 放大镜状态：跟随鼠标显示像素级放大图、颜色信息
    const [magnifier, setMagnifier] = useState<{
      visible: boolean;
      screenX: number;
      screenY: number;
      imgX: number;
      imgY: number;
      rgb: [number, number, number];
      hex: string;
    } | null>(null);
    const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
    // 拖拽改位状态（dsIdx/ptIdx = dataPoints 下标）
    const [dragPoint, setDragPoint] = useState<{
      dsIdx: number;
      ptIdx: number;
    } | null>(null);
    const [dragImgPos, setDragImgPos] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const dragStart = useRef({ imgX: 0, imgY: 0, moved: false });
    // 缩放适配
    const zoomToFit = useCallback(() => {
      if (!image || !canvasRef.current || !containerRef.current) return;
      const container = containerRef.current;
      const cw = container.clientWidth - 32;
      const ch = container.clientHeight - 32;
      const iw = image.naturalWidth;
      const ih = image.naturalHeight;
      if (iw === 0 || ih === 0) return;
      const scale = Math.min(cw / iw, ch / ih, 1);
      setZoom(scale);
      setOffset({
        x: (container.clientWidth - iw * scale) / 2,
        y: (container.clientHeight - ih * scale) / 2,
      });
    }, [image]);
    // 以图像中心为锚点缩放（画布控件；-2：锚点用 CSS 像素，不再依赖位图尺寸）
    const zoomBy = useCallback(
      (factor: number) => {
        const cssW = containerRef.current?.clientWidth ?? 0;
        const cssH = containerRef.current?.clientHeight ?? 0;
        if (cssW === 0 || cssH === 0) return;
        const cx = cssW / 2;
        const cy = cssH / 2;
        const next = Math.max(0.05, Math.min(50, zoom * factor));
        const ratio = next / zoom;
        setOffset((o) => ({
          x: cx - (cx - o.x) * ratio,
          y: cy - (cy - o.y) * ratio,
        }));
        setZoom(next);
      },
      [zoom],
    );
    const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy]);
    const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy]);
    // 图片加载后自动适配、首次提示（缩放/平移可发现）
    useEffect(() => {
      if (image) {
        zoomToFit();
        setShowHint(true);
        if (hintTimer.current) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setShowHint(false), 6000);
        return () => {
          if (hintTimer.current) window.clearTimeout(hintTimer.current);
        };
      }
    }, [image, zoomToFit]);
    // 原图离屏 canvas 只在图像变化时构建一次；同时缓存画布底色（P2-7）
    useEffect(() => {
      if (!image) {
        srcCanvasRef.current = null;
        srcCtxRef.current = null;
        return;
      }
      const c = document.createElement("canvas");
      c.width = image.naturalWidth;
      c.height = image.naturalHeight;
      const cx = c.getContext("2d", { willReadFrequently: true });
      if (!cx) {
        srcCanvasRef.current = null;
        srcCtxRef.current = null;
        return;
      }
      cx.drawImage(image, 0, 0);
      srcCanvasRef.current = c;
      srcCtxRef.current = cx;
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(
          "--canvas-bg",
        ).trim();
        if (v) canvasBgRef.current = v;
      } catch {
        /* 忽略，回退默认 */
      }
    }, [image]);
    // 屏幕坐标 → 图像坐标
    const screenToImage = useCallback(
      (sx: number, sy: number): PixelPoint => {
        const canvas = canvasRef.current;
        if (!canvas) return { px: 0, py: 0 };
        const rect = canvas.getBoundingClientRect();
        const x = sx - rect.left - offset.x;
        const y = sy - rect.top - offset.y;
        return { px: x / zoom, py: y / zoom };
      },
      [offset, zoom],
    );
    // 图像坐标 → 屏幕坐标
    const imageToScreen = useCallback(
      (ix: number, iy: number): PixelPoint => {
        return { px: ix * zoom + offset.x, py: iy * zoom + offset.y };
      },
      [offset, zoom],
    );
    // 绘制
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // 按 devicePixelRatio 设置后备存储（Retina 清晰度），所有绘制坐标仍按 CSS 像素书写
      const dpr = window.devicePixelRatio || 1;
      const cssW = containerRef.current?.clientWidth ?? 0;
      const cssH = containerRef.current?.clientHeight ?? 0;
      if (cssW === 0 || cssH === 0) return;
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // 画布底色跟随主题（缓存于 canvasBgRef，-7：避免每次 draw 强制样式重算）
      ctx.fillStyle = canvasBgRef.current;
      ctx.fillRect(0, 0, cssW, cssH);
      if (!image) return;
      // 绘制图像
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);
      ctx.imageSmoothingEnabled = zoom < 1;
      ctx.drawImage(image, 0, 0);
      // 绘制掩码叠加层
      if (showMask && maskImageData) {
        ctx.globalAlpha = 0.5;
        // P2-10 修复：复用缓存的离屏画布，仅在掩码数据变化时重建
        if (maskImageRef.current !== maskImageData) {
          if (!maskCanvasRef.current) {
            maskCanvasRef.current = document.createElement("canvas");
          }
          const mc = maskCanvasRef.current;
          mc.width = maskImageData.width;
          mc.height = maskImageData.height;
          const mcCtx = mc.getContext("2d");
          if (mcCtx) {
            mcCtx.putImageData(maskImageData, 0, 0);
          }
          maskImageRef.current = maskImageData;
        }
        if (maskCanvasRef.current) {
          ctx.drawImage(maskCanvasRef.current, 0, 0);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // 绘制标定点（仅绘制已 placed 的点；未放置的点无位置，跳过)
      if (calibrationPoints.length > 0) {
        ctx.save();
        ctx.textAlign = "center";
        calibrationPoints.forEach((pt, i) => {
          if (pt.px == null || pt.py == null || !pt.placed) return; // 未点击设置位置，不绘制
          const sx = pt.px * zoom + offset.x;
          const sy = pt.py * zoom + offset.y;
          const isCurrent = calibrating && i === calibratePointIndex;
          // 十字线（当前激活点）
          if (isCurrent) {
            ctx.strokeStyle = "rgba(255, 149, 0, 0.6)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, cssH);
            ctx.moveTo(0, sy);
            ctx.lineTo(cssW, sy);
            ctx.stroke();
          }
          // 圆圈
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          // P3-12 修复：移除恒真 isSet 变量，直接使用颜色逻辑
          const color = isCurrent ? "#ff9500" : "#34c759";
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.stroke();
          // 序号、轴角色标签（图上直接标序号与角色）
          const shortRole =
            pt.role === "xmin"
              ? "Xmin"
              : pt.role === "xmax"
                ? "Xmax"
                : pt.role === "ymin"
                  ? "Ymin"
                  : pt.role === "ymax"
                    ? "Ymax"
                    : "";
          // P1-8: 标定点编号加描边/底衬，确保白底图上可见
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 3;
          ctx.font = "bold 11px sans-serif";
          ctx.strokeText(`P${i + 1}`, sx, sy - 14);
          ctx.fillStyle = "white";
          ctx.fillText(`P${i + 1}`, sx, sy - 14);
          if (shortRole) {
            ctx.font = "10px sans-serif";
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 2.5;
          ctx.strokeText(shortRole, sx, sy + 22);
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillText(shortRole, sx, sy + 22);
          }
        });
        ctx.restore();
      }
      // 标定中引导文字（标明当前该点对应哪个轴）
      if (calibrating && calibrationPoints.length === 4) {
        const nextIdx = calibrationPoints.findIndex((p) => !p.placed);
        if (nextIdx >= 0) {
          const label = t(calibrationPoints[nextIdx].label as never) || `P${nextIdx + 1}`;
          ctx.save();
          ctx.fillStyle = "rgba(255, 149, 0, 0.92)";
          ctx.fillRect(cssW / 2 - 150, 16, 300, 30);
          ctx.fillStyle = "#1d1d1f";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            t("canvas.calibrateGuide", { n: String(nextIdx + 1), label }),
            cssW / 2,
            36,
          );
          ctx.restore();
        }
      }
      // 绘制数据点
      if (showDataPoints && dataPoints.length > 0) {
        ctx.save();
        const translucent = overlayStyle === "translucent";
        dataPoints.forEach((dataset) => {
          ctx.fillStyle = dataset.color;
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;
          if (translucent) ctx.globalAlpha = 0.45;
          dataset.points.forEach((pt) => {
            const sx = pt.x * zoom + offset.x;
            const sy = pt.y * zoom + offset.y;
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
          // 连线（叠加校验模式下不画连线，便于独立观察每个点）
          if (!translucent && dataset.points.length > 1) {
            ctx.strokeStyle = dataset.color;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            dataset.points.forEach((pt, i) => {
              const sx = pt.x * zoom + offset.x;
              const sy = pt.y * zoom + offset.y;
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (translucent) ctx.globalAlpha = 1;
        });
        ctx.restore();
      }
      // 拖拽中的点高亮（新位置预览）
      if (dragPoint && dragImgPos && dataPoints[dragPoint.dsIdx]) {
        ctx.save();
        const sx = dragImgPos.x * zoom + offset.x;
        const sy = dragImgPos.y * zoom + offset.y;
        ctx.fillStyle = dataPoints[dragPoint.dsIdx].color;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // 自动检测结果预览（半透明叠加，未提交前让用户确认）
      if (previewPixelPoints && previewPixelPoints.length > 0) {
        ctx.save();
        ctx.fillStyle = previewColor;
        ctx.globalAlpha = 0.7;
        previewPixelPoints.forEach((pt) => {
          const sx = pt.x * zoom + offset.x;
          const sy = pt.y * zoom + offset.y;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // 绘制悬停十字线
      if (hoverPos && image) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hoverPos.x, 0);
        ctx.lineTo(hoverPos.x, cssH);
        ctx.moveTo(0, hoverPos.y);
        ctx.lineTo(cssW, hoverPos.y);
        ctx.stroke();
        ctx.restore();
      }
    }, [
      image,
      offset,
      zoom,
      calibrationPoints,
      calibrating,
      calibratePointIndex,
      dataPoints,
      showDataPoints,
      hoverPos,
      maskImageData,
      showMask,
      previewPixelPoints,
      previewColor,
      dragPoint,
      dragImgPos,
      overlayStyle,
      t,
    ]);
    // 重绘
    useEffect(() => {
      draw();
    }, [draw]);
    // P2-9 修复：容器尺寸变化时自动重绘，避免 CSS 拉伸变形
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const ro = new ResizeObserver(() => {
        draw();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }, [draw]);
    // 键盘事件
    useEffect(() => {
      const isTypingTarget = (el: EventTarget | null) => {
        const t = el as HTMLElement | null;
        if (!t) return false;
        const tag = t.tagName;
        return (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t.isContentEditable
        );
      };
      const isActivatable = (el: EventTarget | null) =>
        (el as HTMLElement | null)?.closest(
          'button, [role="button"], [role="checkbox"], [role="radio"], [role="menuitem"], input[type="checkbox"], input[type="radio"]',
        );
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code !== "Space" || e.repeat) return;
        if (isTypingTarget(e.target)) return; // 输入类控件放行
        if (isActivatable(e.target)) return; // 可激活控件放行，由浏览器执行默认激活
        e.preventDefault();
        setSpacePressed(true);
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          setSpacePressed(false);
          setIsPanning(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, []);
    // 鼠标事件
    const handleMouseDown = (e: React.MouseEvent) => {
      if (spacePressed || e.button === 1) {
        setIsPanning(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          ox: offset.x,
          oy: offset.y,
        };
        return;
      }
      // 左键命中已有点 → 开始拖拽改位（未移动则按普通点击新增点）
      if (e.button === 0 && !colorPickMode && showDataPoints) {
        const imgPos = screenToImage(e.clientX, e.clientY);
        dragStart.current = { imgX: imgPos.px, imgY: imgPos.py, moved: false };
        const hitRadius = Math.min(10, 8 / Math.max(zoom, 0.05));
        for (let di = 0; di < dataPoints.length; di++) {
          const ds = dataPoints[di];
          for (let pi = 0; pi < ds.points.length; pi++) {
            if (
              Math.hypot(
                ds.points[pi].x - imgPos.px,
                ds.points[pi].y - imgPos.py,
              ) <= hitRadius
            ) {
              setDragPoint({ dsIdx: di, ptIdx: pi });
              setDragImgPos({ x: imgPos.px, y: imgPos.py });
              return;
            }
          }
        }
      }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setHoverPos({ x: mx, y: my });
      // 放大镜：只在有图像且非平移时显示
      if (image && !isPanning) {
        pendingMoveRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          rect,
        };
        if (rafIdRef.current == null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const p = pendingMoveRef.current;
            pendingMoveRef.current = null;
            if (p) updateMagnifier(p.clientX, p.clientY, p.rect);
          });
        }
      } else {
        if (magnifier?.visible) setMagnifier(null);
      }
      if (isPanning) {
        setOffset({
          x: panStart.current.ox + (e.clientX - panStart.current.x),
          y: panStart.current.oy + (e.clientY - panStart.current.y),
        });
        return;
      }
      if (dragPoint) {
        const imgPos = screenToImage(e.clientX, e.clientY);
        if (
          Math.hypot(
            imgPos.px - dragStart.current.imgX,
            imgPos.py - dragStart.current.imgY,
          ) > 3
        ) {
          dragStart.current.moved = true;
        }
        setDragImgPos({ x: imgPos.px, y: imgPos.py });
      }
    };
    /** 更新放大镜：采样鼠标周围像素并绘制到放大镜 canvas */
    const updateMagnifier = (
      clientX: number,
      clientY: number,
      canvasRect: DOMRect,
    ) => {
      if (!image || !magnifierCanvasRef.current) return;
      const imgPos = screenToImage(clientX, clientY);
      const ix = Math.round(imgPos.px);
      const iy = Math.round(imgPos.py);
      // 采样中心像素颜色（复用缓存的离屏原图画布，不再每次 new 一张全尺寸 canvas）
      const srcCtx = srcCtxRef.current;
      if (!srcCtx) return;
      const cx = Math.max(0, Math.min(image.naturalWidth - 1, ix));
      const cy = Math.max(0, Math.min(image.naturalHeight - 1, iy));
      const pixel = srcCtx.getImageData(cx, cy, 1, 1).data;
      const rgb: [number, number, number] = [pixel[0], pixel[1], pixel[2]];
      const hex =
        "#" +
        [pixel[0], pixel[1], pixel[2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();
      // 放大镜参数
      const MAG_SIZE = 160;
      const MAG_ZOOM = 8;
      const SAMPLE_RADIUS = Math.floor(MAG_SIZE / (2 * MAG_ZOOM));
      const sx0 = Math.max(0, ix - SAMPLE_RADIUS);
      const sy0 = Math.max(0, iy - SAMPLE_RADIUS);
      const sw = Math.min(image.naturalWidth - sx0, SAMPLE_RADIUS * 2);
      const sh = Math.min(image.naturalHeight - sy0, SAMPLE_RADIUS * 2);
      const magCanvas = magnifierCanvasRef.current;
      magCanvas.width = MAG_SIZE;
      magCanvas.height = MAG_SIZE;
      const magCtx = magCanvas.getContext("2d");
      if (!magCtx) return;
      magCtx.imageSmoothingEnabled = false;
      magCtx.fillStyle = "#000";
      magCtx.fillRect(0, 0, MAG_SIZE, MAG_SIZE);
      if (sw > 0 && sh > 0) {
        magCtx.drawImage(
          srcCanvasRef.current!,
          sx0,
          sy0,
          sw,
          sh,
          0,
          0,
          sw * MAG_ZOOM,
          sh * MAG_ZOOM,
        );
      }
      // 十字准星、中心像素方框
      const centerX = (ix - sx0) * MAG_ZOOM;
      const centerY = (iy - sy0) * MAG_ZOOM;
      magCtx.strokeStyle = "rgba(0, 122, 255, 0.8)";
      magCtx.lineWidth = 1;
      magCtx.beginPath();
      magCtx.moveTo(centerX - 6, centerY);
      magCtx.lineTo(centerX + 6, centerY);
      magCtx.moveTo(centerX, centerY - 6);
      magCtx.lineTo(centerX, centerY + 6);
      magCtx.stroke();
      magCtx.strokeStyle = "rgba(0, 122, 255, 1)";
      magCtx.strokeRect(
        centerX - MAG_ZOOM / 2,
        centerY - MAG_ZOOM / 2,
        MAG_ZOOM,
        MAG_ZOOM,
      );
      setMagnifier({
        visible: true,
        screenX: clientX - canvasRect.left,
        screenY: clientY - canvasRect.top,
        imgX: ix,
        imgY: iy,
        rgb,
        hex,
      });
    };
    const handleMouseUp = (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }
      if (e.button === 0) {
        if (dragPoint) {
          const dp = dragPoint;
          const imgPos = screenToImage(e.clientX, e.clientY);
          setDragPoint(null);
          setDragImgPos(null);
          if (dragStart.current.moved) {
            // 拖拽改位：提交新位置（走撤销栈）
            onCanvasPointMove?.(dp.dsIdx, dp.ptIdx, imgPos.px, imgPos.py);
          } else {
            // 未移动 → 普通点击
            if (colorPickMode) onColorPick(imgPos.px, imgPos.py);
            else onCanvasClick(imgPos.px, imgPos.py);
          }
          return;
        }
        // 左键
        const imgPos = screenToImage(e.clientX, e.clientY);
        if (colorPickMode) {
          onColorPick(imgPos.px, imgPos.py);
        } else {
          onCanvasClick(imgPos.px, imgPos.py);
        }
      }
    };
    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      const imgPos = screenToImage(e.clientX, e.clientY);
      onCanvasRightClick(imgPos.px, imgPos.py, e.clientX, e.clientY);
    };
    // 滚轮缩放改用原生非被动监听器（React 17+ 的 onWheel 为 passive，preventDefault 失效）
    useEffect(() => {
      const el = canvasRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        if (!rect) return;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const current = zoomRef.current;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.05, Math.min(50, current * delta));
        const ratio = newZoom / current;
        const o = offsetRef.current;
        setOffset({ x: mx - (mx - o.x) * ratio, y: my - (my - o.y) * ratio });
        setZoom(newZoom);
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);
    // 获取 ImageData
    const getImageData = useCallback((): ImageData | null => {
      // P1-7 修复：复用已缓存的离屏原图画布（srcCtxRef），避免每次全量重建
      const srcCtx = srcCtxRef.current;
      if (!srcCtx || !image) return null;
      return srcCtx.getImageData(
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
      );
    }, [image]);
    useImperativeHandle(ref, (): CanvasHandle => ({
      getCanvas: () => canvasRef.current,
      getImageData,
      setImageData: (data: ImageData) => {
        imageDataRef.current = data;
      },
      zoomToFit,
      zoomIn,
      zoomOut,
      redraw: draw,
      screenToImage,
      imageToScreen,
    }));
    if (!image) {
      return (
        <div className="canvas-container" ref={containerRef}>
          <div className="canvas-empty">
            <div className="icon">
              <BarChartIcon size={64} />
            </div>
            <div className="title">{t("guide.welcome.title")}</div>
            <div className="hint" style={{ marginBottom: 6 }}>
              {t("guide.welcome.desc")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--success, #34c759)",
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <LockIcon size={12} /> {t("about.offline")}
            </div>
            <div className="hint">{t("canvas.empty.hint")}</div>
            <div className="drop-zone">
              <div
                style={{
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: 10,
                }}
              >
                {t("guide.quickstart")}
              </div>
              <ol className="quick-start">
                <li>{t("guide.step1")}</li>
                <li>{t("guide.step2")}</li>
                <li>{t("guide.step3")}</li>
                <li>{t("guide.step4")}</li>
              </ol>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className={isPanning || spacePressed ? "panning" : ""}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoverPos(null);
            setIsPanning(false);
            setDragPoint(null);
            setDragImgPos(null);
            setMagnifier(null);
          }}
          onContextMenu={handleContextMenu}
          style={{ width: "100%", height: "100%" }}
        />
        <div className="canvas-overlay">
          <div className="canvas-info">
            {t("canvas.zoom")}: {(zoom * 100).toFixed(0)}% |{" "}
            {image.naturalWidth}×{image.naturalHeight}px
          </div>
          {hoverPos && (
            <div className="canvas-info">
              {(() => {
                const rect = canvasRef.current?.getBoundingClientRect();
                const sx = hoverPos.x + (rect?.left ?? 0);
                const sy = hoverPos.y + (rect?.top ?? 0);
                const img = screenToImage(sx, sy);
                // 已标定时换算数据坐标；未标定阶段回退像素坐标
                const data =
                  showDataReadout && pixelToData
                    ? pixelToData(img.px, img.py)
                    : null;
                if (
                  data &&
                  Number.isFinite(data[0]) &&
                  Number.isFinite(data[1])
                ) {
                  return `${t("canvas.data")}: X=${data[0].toFixed(precision)}, Y=${data[1].toFixed(precision)}（${t("canvas.coord")}: ${img.px.toFixed(0)}, ${img.py.toFixed(0)}）`;
                }
                return `${t("canvas.coord")}: ${img.px.toFixed(0)}, ${img.py.toFixed(0)}`;
              })()}
            </div>
          )}
        </div>
        {showHint && (
          <div className="canvas-hint" onClick={() => setShowHint(false)}>
            {t("canvas.hint")}
          </div>
        )}
        <div className="canvas-controls">
          <button
            className="canvas-ctrl-btn"
            onClick={zoomOut}
            title={t("canvas.ctrl.zoomOut")}
          >
            <MinusIcon size={14} />
          </button>
          <span className="canvas-zoom-label">{(zoom * 100).toFixed(0)}%</span>
          <button
            className="canvas-ctrl-btn"
            onClick={zoomIn}
            title={t("canvas.ctrl.zoomIn")}
          >
            <PlusIcon size={14} />
          </button>
          <button
            className="canvas-ctrl-btn"
            onClick={zoomToFit}
            title={t("canvas.ctrl.zoomFit")}
          >
            <MaximizeIcon size={14} />
          </button>
        </div>
        {magnifier?.visible && (
          <div
            className="magnifier"
            style={{
              left: Math.min(
                magnifier.screenX + 20,
                (containerRef.current?.clientWidth ?? 800) - 170,
              ),
              top: Math.min(
                magnifier.screenY + 20,
                (containerRef.current?.clientHeight ?? 600) - 200,
              ),
            }}
          >
            <canvas
              ref={magnifierCanvasRef}
              className="magnifier-canvas"
              width={160}
              height={160}
            />
            <div className="magnifier-info">
              <div
                className="magnifier-color-bar"
                style={{ background: magnifier.hex }}
              />
              <div className="magnifier-text">
                <div className="magnifier-rgb">
                  RGB({magnifier.rgb[0]}, {magnifier.rgb[1]}, {magnifier.rgb[2]}
                  )
                </div>
                <div className="magnifier-hex">{magnifier.hex}</div>
                <div className="magnifier-pix">
                  ({magnifier.imgX}, {magnifier.imgY})
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
ChartCanvas.displayName = "ChartCanvas";
export default ChartCanvas;
