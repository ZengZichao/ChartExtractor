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
 * 图表数据提取器 - 主应用组件
 *
 * UX 架构重设计方案（-）落地、体验层修复（用户体验架构师 / 用户体验研究员 ）
 * - 单一真相状态机 useUXMachine（ + ：EMPTY 收紧，双入口守卫统一）
 * - 标定合一交互（// + 可重定位已 placed 点、轴名称/单位）
 * - 导入统一入口 startNewProject + safeStartNewProject 二次确认、数据安全红线）
 * - 可编辑数据表：全量渲染、X/Y 可编辑、单点删除/复制、全走撤销栈
 * - 画布悬停显示数据坐标（/）+ 右键命中删点/编辑
 * - 自动检测：进度条、取消、结果预览后 应用/追加/丢弃、实时掩码预览
 * - 导出：数据集勾选、列名、宽/长表、全量预览、数据校验拦截（/ + ）
 * - 自动保存与会话恢复、脏标记
 * - 中文状态/友好错误/格式文案一致（///）
 * - 多页 PDF 保留标定追加为新数据集（/）
 * - 工程保存/恢复检测参数
 * - 无障碍：Esc 关闭、焦点陷阱、aria-label、键盘菜单导航（/）
 * - 取点面板折叠分组、Ribbon 收口 ux.can、大图降采样
 * - 画布缩放控件、首次提示
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import ChartCanvas, { type CanvasHandle } from "./components/ChartCanvas";
import type {
  CalibrationConfig,
  Dataset,
  ColorDetectionParams,
  ExportFormat,
  ExportOptions,
  UXState,
  CsvMergeMode,
  UndoableCommand,
  ProjectData,
  ProjectManifest,
} from "./types";
import { CALIB_ROLES } from "./types";
import { Calibration } from "./core/calibration";
import { ColorFilter, DEFAULT_FG_COLOR } from "./core/colorFilter";
import { UndoRedoManager } from "./controllers/undoRedo";
import { ExportService } from "./services/exportService";
import { ProjectService } from "./services/projectService";
import { APP_VERSION } from "./version";
import { generateSampleProject } from "./services/sampleProject";
import {
  extractCurve,
  extractBlobs,
  detectGrid,
  removeGridNoise,
  clusterBlobsByColor,
} from "./services/extractionService";
import { importPdf } from "./services/pdfService";
import { generateId } from "./core/mathUtils";
import { appApi, isTauri } from "./platform/api";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUXMachine } from "./hooks/useUXMachine";
import { useTheme } from "./hooks/useTheme";
import { useI18n } from "./hooks/useI18n";
import {
  UploadIcon,
  CrosshairIcon,
  PenLineIcon,
  DownloadIcon,
  SaveIcon,
  UndoIcon,
  RedoIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  LightbulbIcon,
  AlertTriangleIcon,
  XIcon,
  PlusIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  TrashIcon,
  CircleIcon,
  BarChartIcon,
  InfoIcon,
  LoaderIcon,
} from "./components/Icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  Slider,
  TooltipProvider,
  useToasts,
  ToastContainer,
} from "./components/ui";
/** base64 → Uint8Array：图片导入直接由字节构造 Blob，避免触发被禁的联网模式（离线安全） */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
/** 由 UXState 推导右侧面板内容 */
function panelOf(s: UXState): "import" | "calibrate" | "extract" | "export" {
  switch (s) {
    case "EMPTY":
    case "IMAGE_READY":
      return "import";
    case "CALIBRATING":
      return "calibrate";
    case "CALIBRATED":
    case "EXTRACTING":
      return "extract";
    case "EXPORTING":
      return "export";
  }
}
/** 把原始 Error 转为「人话、下一步」提示 */
function userError(e: unknown, fallback: string): string {
  let msg = "";
  if (e instanceof Error) msg = e.message;
  else if (typeof e === "string") msg = e;
  const cleaned = msg
    .replace(/^\s*Error:\s*/i, "")
    .replace(/^\s*Error\s*/i, "")
    .trim();
  if (/invalidpdf|password|worker|pdf/i.test(cleaned)) {
    return `${fallback}：PDF 解析失败，建议将 PDF 另存为 PNG 图片后再导入`;
  }
  if (cleaned && cleaned !== "[object Object]")
    return `${fallback}：${cleaned.slice(0, 120)}`;
  return fallback;
}
/** 以浏览器可解码白名单为唯一真相生成引导文案 */
const SUPPORTED_FORMATS = [
  "png",
  "jpg",
  "jpeg",
  "bmp",
  "webp",
  "gif",
  "svg",
] as const;
const DECODABLE = new Set<string>(SUPPORTED_FORMATS);
const FORMAT_HINT = SUPPORTED_FORMATS.filter((f) => f !== "jpeg")
  .map((f) => f.toUpperCase())
  .join(" / ");
/** 可折叠面板分组 */
function Section({
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-section">
      <div
        className="panel-section-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="panel-title">{title}</span>
        {badge && <span className="panel-section-badge">{badge}</span>}
        <span className="panel-section-arrow">
          {open ? (
            <ChevronDownIcon size={10} />
          ) : (
            <ChevronRightIcon size={10} />
          )}
        </span>
      </div>
      {open && <div className="panel-section-body">{children}</div>}
    </div>
  );
}
// 以下手写键盘导航已由 Radix DropdownMenu 内置替代，无需手写 menuKeyNav
/** 多标签页：每个标签页保存一个完整的工程快照 */
interface TabState {
  id: string;
  name: string;
  snapshot: ProjectSnapshot | null; // null = 空白标签页（尚未导入）
  /** P0-2: 每标签页独立的撤销栈快照 */
  undoStacks?: { undo: UndoableCommand[]; redo: UndoableCommand[] };
}
/** 工程级快照（导入可撤销 / ：工程级命令入栈） */
interface ProjectSnapshot {
  image: HTMLImageElement | null;
  imageBlob: Blob | null;
  originalFileName: string;
  calibConfig: CalibrationConfig;
  datasets: Dataset[];
  activeDatasetId: string | null;
  precision: number;
  colorParams: ColorDetectionParams;
  curveParams: { xStep: number; yStep: number; smoothing: boolean };
  blobParams: { minDiameter: number; maxDiameter: number };
  pdfState: { bytes: Uint8Array; numPages: number } | null;
  calibratePointIndex: number;
  calibResidual: number;
  calibrated: boolean;
  showMask: boolean;
  maskImageData: ImageData | null;
  /** 图像派生状态：随工程快照隔离，避免跨标签页/新工程泄漏 */
  lastGridResult: { verticalLines: number[]; horizontalLines: number[] } | null;
  overlayVerify: boolean;
  uxState: UXState;
  dirty: boolean;
  /** P0-2: 每标签页独立的撤销栈快照 */
  undoStack?: Array<{ undo: () => void; redo: () => void; description: string }>;
}
/** 可疑数据点（/ 数据校验） */
interface PointIssue {
  dsId: string;
  idx: number;
  reason: "nan" | "out" | "dup";
}
/** 自动检测预览（先预览后提交） */
interface DetectionPreview {
  kind: "curve" | "blob";
  dsId: string;
  pixelPoints: Array<{ x: number; y: number }>;
}
function App() {
  // ========== UX 状态机（单一真相， + ） ==========
  const ux = useUXMachine("EMPTY");
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  // 状态机拦截原因（hook 内为中文桩以利单测）→ App 层按 ux.reason.* 翻译
  const trReason = (s: string | null): string | null => {
    if (!s) return s;
    const needCalib = s.match(/还需标定 (\d+) 个位置/);
    if (needCalib) return t("ux.reason.needCalib", { n: needCalib[1] });
    const needValues = s.match(/还有 (\d+) 个数值未填写/);
    if (needValues) return t("ux.reason.needValues", { n: needValues[1] });
    switch (s) {
      case "请先导入图像":
        return t("ux.reason.importFirst");
      case "尚未取点，无数据可导出":
        return t("ux.reason.noData");
      case "当前状态不可达":
      case "当前不可执行":
        return t("ux.reason.notAllowed");
      default:
        return s;
    }
  };
  // ========== 窗口拖动（macOS Overlay 标题栏：CSS app-region 不可靠时用 JS 兜底） ==========
  const handleWindowDrag = useCallback(
    (e: ReactMouseEvent) => {
      // 只响应左键、且不在 no-drag 元素上
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-drag="true"]')) return;
      if (isTauri) {
        e.preventDefault();
        getCurrentWindow().startDragging().catch(() => {});
      }
    },
    [],
  );
  // ========== 多标签页状态 ==========
  const [tabs, setTabs] = useState<TabState[]>([
    { id: "tab-0", name: t("tab.untitled"), snapshot: null },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-0");
  const tabCounterRef = useRef(1);
  const switchingTabRef = useRef(false);
  // ========== 核心状态 ==========
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [originalFileName, setOriginalFileName] = useState("");
  // 标定
  const [calibConfig, setCalibConfig] = useState<CalibrationConfig>(
    Calibration.createDefaultConfig,
  );
  const [calibratePointIndex, setCalibratePointIndex] = useState(0);
  const [calibResidual, setCalibResidual] = useState(0);
  const [focusValueIndex, setFocusValueIndex] = useState<number | null>(null);
  const valueInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const calibrationRef = useRef(new Calibration());
  // 数据集
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  // 数据点总数（派生，提升声明位置以在上方 effect 中可用）
  const totalPoints = datasets.reduce((sum, ds) => sum + ds.points.length, 0);
  // 颜色检测
  const [colorParams, setColorParams] = useState<ColorDetectionParams>({
    fgColor: DEFAULT_FG_COLOR, // 与 ColorFilter 构造/工程回退同一来源
    bgColor: [255, 255, 255],
    colorDistance: 120,
    mode: "foreground",
  });
  const [colorPickMode, setColorPickMode] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [maskImageData, setMaskImageData] = useState<ImageData | null>(null);
  const [liveMaskPreview, setLiveMaskPreview] = useState(false); // 实时掩码
  // 曲线追踪参数
  const [curveParams, setCurveParams] = useState({
    xStep: 10,
    yStep: 10,
    smoothing: true,
  });
  // 散点检测参数
  const [blobParams, setBlobParams] = useState({
    minDiameter: 2,
    maxDiameter: 50,
  });
  // 网格检测阈值（暴露到 UI 可调，含密集曲线的图可适当调大避免误判）
  const [gridParams, setGridParams] = useState({ xFrac: 0.1, yFrac: 0.1 });
  // 导出
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exportEncoding, setExportEncoding] = useState<"utf-8" | "gbk">(
    "utf-8",
  );
  const [precision, setPrecision] = useState(3);
  const [includeHeader, setIncludeHeader] = useState(true);
  // CSV 是否写入 # 元信息注释行（默认关，pandas read_csv 默认可直读）
  const [includeMetadata, setIncludeMetadata] = useState(false);
  // 导出选择（数据集/列名/合并形态）
  const [exportSel, setExportSel] = useState<{
    datasetIds: string[];
    xColumn: string;
    yColumn: string;
    mergeMode: CsvMergeMode;
  }>({ datasetIds: [], xColumn: "", yColumn: "", mergeMode: "long" });
  // UI 状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    imgX: number;
    imgY: number;
    hit: { dsId: string; idx: number } | null; // 右键命中
  } | null>(null);
  const { toasts, toast: showToast, dismiss: dismissToast } = useToasts();
  const [showExportModal, setShowExportModal] = useState(false);
  const [recentFiles, setRecentFiles] = useState<
    Array<{ path: string; name: string; lastOpened: string }>
  >([]);
  const [, setUndoRedoVersion] = useState(0); // 用于触发重渲染
  const [pdfState, setPdfState] = useState<{
    bytes: Uint8Array;
    numPages: number;
  } | null>(null);
  // 脏标记（状态栏 ● 未保存）
  const [isDirty, setDirty] = useState(false);
  // 自动检测：进度、取消、预览
  const [detectionState, setDetectionState] = useState<{
    running: "curve" | "blob" | "grid" | null;
    progress: number;
  }>({
    running: null,
    progress: 0,
  });
  const cancelDetectionRef = useRef(false);
  // 前端审查 P0-5：5 个自动检测入口的在途保护（防连点并发、取消语义被破坏）
  const detectionRunningRef = useRef(false);
  const [detectionPreview, setDetectionPreview] =
    useState<DetectionPreview | null>(null);
  // 网格线检测结果（用于伪点清理）
  const [lastGridResult, setLastGridResult] = useState<{
    verticalLines: number[];
    horizontalLines: number[];
  } | null>(null);
  // 叠加校验模式
  const [overlayVerify, setOverlayVerify] = useState(false);
  // 关于弹窗
  const [showAbout, setShowAbout] = useState(false);
  // 批量处理状态
  const [batchState, setBatchState] = useState<{
    running: boolean;
    inputDir: string;
    outputDir: string;
    files: Array<{ path: string; name: string }>;
    currentIdx: number;
    okCount: number;
  } | null>(null);
  const batchCancelRef = useRef(false);
  // 多曲线分离模式
  // multiCurveMode 已移除，由 Radix Tabs 替代
  // 左右面板可拖拽调宽（默认 200 / 300，夹取上下限，宽绘 localStorage）
  const LEFT_MIN = 150,
    LEFT_MAX = 420,
    RIGHT_MIN = 220,
    RIGHT_MAX = 560;
  // 画布保底宽度，防止左右面板同时拉满把画布压到 32px
  const CANVAS_MIN = 320;
  const RESIZER_TOTAL = 12; // 两条 6px resizer
  const loadWidth = (key: string, fallback: number) => {
    try {
      const v = parseInt(localStorage.getItem(key) || "", 10);
      if (Number.isFinite(v) && v > 0) return v;
    } catch {
      /* ignore */
    }
    return fallback;
  };
  const [leftWidth, setLeftWidth] = useState(() =>
    loadWidth("cde.leftWidth", 180),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    loadWidth("cde.rightWidth", 300),
  );
  const [leftDragging, setLeftDragging] = useState(false);
  const [rightDragging, setRightDragging] = useState(false);
  const resizingRef = useRef<null | "left" | "right">(null);
  // 用 ref 保存最新宽度，避免 mouseup 时读到 mousedown 那一轮的旧值
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);
  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);
  const onResizeMove = useCallback((e: MouseEvent) => {
    // 联合约束——两侧面板宽度之和不得把画布压到 CANVAS_MIN 以下
    if (resizingRef.current === "left") {
      const maxByCanvas = Math.max(
        LEFT_MIN,
        window.innerWidth - rightWidthRef.current - CANVAS_MIN - RESIZER_TOTAL,
      );
      const upper = Math.min(LEFT_MAX, maxByCanvas);
      setLeftWidth(Math.min(Math.max(e.clientX, LEFT_MIN), upper));
    } else if (resizingRef.current === "right") {
      const maxByCanvas = Math.max(
        RIGHT_MIN,
        window.innerWidth - leftWidthRef.current - CANVAS_MIN - RESIZER_TOTAL,
      );
      const upper = Math.min(RIGHT_MAX, maxByCanvas);
      setRightWidth(
        Math.min(Math.max(window.innerWidth - e.clientX, RIGHT_MIN), upper),
      );
    }
  }, []);
  // 窗口缩放时按比例收敛两侧宽度，避免恢复出越界宽度
  useEffect(() => {
    const clamp = () => {
      const avail = window.innerWidth - CANVAS_MIN - RESIZER_TOTAL;
      if (leftWidthRef.current + rightWidthRef.current > avail) {
        const ratio = avail / (leftWidthRef.current + rightWidthRef.current);
        const nl = Math.min(
          LEFT_MAX,
          Math.max(LEFT_MIN, Math.round(leftWidthRef.current * ratio)),
        );
        const nr = Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, avail - nl));
        setLeftWidth(nl);
        setRightWidth(nr);
      }
    };
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);
  const stopResize = useCallback(() => {
    if (!resizingRef.current) return;
    const side = resizingRef.current;
    resizingRef.current = null;
    setLeftDragging(false);
    setRightDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", stopResize);
    // 落盘持久化（读取 ref 中的最新宽度）
    try {
      if (side === "left")
        localStorage.setItem("cde.leftWidth", String(leftWidthRef.current));
      else
        localStorage.setItem("cde.rightWidth", String(rightWidthRef.current));
    } catch {
      /* ignore */
    }
  }, [onResizeMove]);
  const startResize = useCallback(
    (side: "left" | "right") => (e: ReactMouseEvent) => {
      e.preventDefault();
      resizingRef.current = side;
      if (side === "left") setLeftDragging(true);
      else setRightDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onResizeMove);
      window.addEventListener("mouseup", stopResize);
    },
    [onResizeMove, stopResize],
  );
  // / 编辑点弹窗
  const [editPoint, setEditPoint] = useState<{
    dsId: string;
    idx: number;
  } | null>(null);
  const [editPointDraft, setEditPointDraft] = useState<{
    x: string;
    y: string;
  }>({ x: "", y: "" });
  // 导出校验拦截
  const [exportWarning, setExportWarning] = useState<PointIssue[] | null>(null);
  // P0-1: 应用内确认 Dialog（替代 window.confirm，macOS Tauri 下后者恒 false）
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    resolve: ((v: boolean) => void) | null;
  }>({ open: false, message: "", resolve: null });
  const confirmDialog = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, resolve });
    });
  }, []);
  const closeConfirm = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState({ open: false, message: "", resolve: null });
  };
  const pointEditStartRef = useRef<{
    dsId: string;
    idx: number;
    axis: "x" | "y";
    prev: number;
  } | null>(null);
  // Refs
  const canvasRef = useRef<CanvasHandle>(null);
  const undoRedoRef = useRef(new UndoRedoManager());
  // exportModalRef 已由 Radix Dialog 内置焦点陷阱替代
  const dirtyRef = useRef(false);
  const imageBlobRef = useRef<Blob | null>(null);
  const autosaveRunningRef = useRef(false);
  // 让 [] 依赖的 effect（粘贴/拖拽/自动保存/快捷键）始终调用最新闭包，避免过期状态
  const latestRef = useRef<{
    safeStartNewProject: (
      blob: Blob,
      name: string,
      pdf?: { bytes: Uint8Array; numPages: number },
    ) => void;
    handleImportFile: (path?: string | null) => void;
    doAutosave: () => void;
    handleSaveProject: () => void;
    handleUndo: () => void;
    handleRedo: () => void;
  } | null>(null);
  const panel = panelOf(ux.state);
  // 按角色统计"已填本轴数值"的点数：xmin/xmax 只需 dx，ymin/ymax 只需 dy。
  const valuesEntered = calibConfig.points.filter((p) => {
    const isX = p.role === "xmin" || p.role === "xmax";
    return isX ? p.dx != null : p.dy != null;
  }).length;
  // ========== 初始化 ==========
  useEffect(() => {
    undoRedoRef.current.setOnStateChange(() =>
      setUndoRedoVersion((v) => v + 1),
    );
    loadRecentFiles();
    // 同步初始事实
    ux.setFacts({
      hasImage: false,
      isCalibrated: false,
      positionsSet: 0,
      valuesEntered: 0,
      totalPoints: 0,
    });
    // 启动时提示恢复上次未保存会话
    (async () => {
      try {
        const r = await appApi.loadAutosave();
        if (r.success && r.data) {
    const ok = await confirmDialog(t("toast.confirmRecoverSession"));
    if (ok) {
            const parsed = await ProjectService.parseProjectZip(r.data);
            if (parsed && 'data' in parsed) {
              applyLoadedProject(
                parsed.data,
                parsed.imageBlob,
                parsed.manifest,
              );
              await appApi.clearAutosave().catch(() => {});
            } else {
              showToast(t("toast.autosaveCorrupt"), "warning");
            }
          } else {
            // 用户明确放弃恢复才清除，避免解析失败时静默吞掉未保存会话
            await appApi.clearAutosave().catch(() => {});
          }
        }
      } catch {
        /* 自动保存恢复失败静默 */
      }
    })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 实时同步状态机事实（驱动 can/go 派生）
  useEffect(() => {
    ux.setFacts({
      hasImage: image != null,
      isCalibrated: calibrationRef.current.isCalibrated(),
      positionsSet: calibConfig.points.filter((p) => p.placed).length,
      valuesEntered,
      totalPoints,
    });
  }, [image, calibConfig, totalPoints, valuesEntered, ux]);
  // 注册原生拖拽导入（Tauri 窗口 dragDrop 事件接管；浏览器下走 HTML5 兜底）
  useEffect(() => {
    const cleanup = appApi.registerDropHandler((paths) => {
      if (paths.length > 0) latestRef.current?.handleImportFile(paths[0]);
    });
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 下拉菜单点击外部关闭已由 Radix DropdownMenu 内置处理，无需手写
  // 标定数值输入聚焦（点击位置后自动聚焦对应数值框)
  useEffect(() => {
    if (focusValueIndex != null) {
      const el = valueInputRefs.current[focusValueIndex];
      if (el) el.focus();
      setFocusValueIndex(null);
    }
  }, [focusValueIndex]);
  // 粘贴导入（走 safeStartNewProject 二次确认，不再无确认清空工程）
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            latestRef.current?.safeStartNewProject(blob, "截图粘贴");
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Esc 关闭所有弹层
  const escHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  escHandlerRef.current = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (showExportModal) {
      ux.go("closeExport");
      setShowExportModal(false);
    }
    if (editPoint) setEditPoint(null);
    if (exportWarning) setExportWarning(null);
    if (contextMenu) setContextMenu(null);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => escHandlerRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // 焦点陷阱已由 Radix Dialog 内置实现，无需手写
  // 脏标记镜像到 ref（供自动保存定时器读取）
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    imageBlobRef.current = imageBlob;
  }, [imageBlob]);
  // 定时自动保存（每 60s）
  useEffect(() => {
    const id = window.setInterval(() => {
      void latestRef.current?.doAutosave();
    }, 60000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 每次渲染后刷新 latestRef，保证 [] 依赖的 effect 使用最新闭包
  useEffect(() => {
    latestRef.current = {
      safeStartNewProject,
      handleImportFile,
      doAutosave,
      handleSaveProject,
      handleUndo,
      handleRedo,
    };
  });
  // 实时掩码预览（防抖 150ms）
  useEffect(() => {
    if (!liveMaskPreview || !image) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const imgData = canvasRef.current?.getImageData();
      if (!imgData || cancelled) return;
      try {
        const filter = new ColorFilter(colorParams);
        const binary = await filter.generateBinaryDataAsync(
          imgData,
          undefined,
          256,
        );
        if (cancelled) return;
        setMaskImageData(
          ColorFilter.binaryToImageData(binary, imgData.width, imgData.height),
        );
        setShowMask(true);
      } catch {
        /* 预览失败静默 */
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [liveMaskPreview, colorParams, image]);
  // ========== 数据校验（/） ==========
  const validationIssues = useMemo<PointIssue[]>(() => {
    if (datasets.length === 0) return [];
    const issues: PointIssue[] = [];
    const calPts = calibConfig.points.filter(
      (p) => p.placed && p.px != null && p.py != null,
    );
    const pixBounds =
      calPts.length === 4
        ? {
            xmin: Math.min(...calPts.map((p) => p.px!)) - 10,
            xmax: Math.max(...calPts.map((p) => p.px!)) + 10,
            ymin: Math.min(...calPts.map((p) => p.py!)) - 10,
            ymax: Math.max(...calPts.map((p) => p.py!)) + 10,
          }
        : null;
    for (const ds of datasets) {
      const seen = new Map<string, number>();
      ds.points.forEach((pt, idx) => {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
          issues.push({ dsId: ds.id, idx, reason: "nan" });
          return;
        }
        if (pixBounds && calibrationRef.current.isCalibrated()) {
          const pix = calibrationRef.current.dataToPixel(pt.x, pt.y);
          if (
            pix.x < pixBounds.xmin ||
            pix.x > pixBounds.xmax ||
            pix.y < pixBounds.ymin ||
            pix.y > pixBounds.ymax
          ) {
            issues.push({ dsId: ds.id, idx, reason: "out" });
            return;
          }
        }
        const key = `${pt.x.toFixed(3)}_${pt.y.toFixed(3)}`;
        if (seen.has(key)) issues.push({ dsId: ds.id, idx, reason: "dup" });
        else seen.set(key, 1);
      });
    }
    return issues;
    // 补 calibResidual 依赖——标定提交后 validationIssues 需即刻重算
  }, [datasets, calibConfig, calibResidual, calibrationRef]);
  const issueSet = useMemo(
    () => new Set(validationIssues.map((iss) => `${iss.dsId}:${iss.idx}`)),
    [validationIssues],
  );
  const loadRecentFiles = async () => {
    try {
      const list = await appApi.getRecentFiles();
      setRecentFiles(Array.isArray(list) ? list : []);
    } catch {
      setRecentFiles([]);
    }
  };
  // ========== 辅助函数 ==========
  // showToast 现已由 useToasts hook 提供，支持堆叠显示
  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || null;
  const updateDataset = (id: string, updater: (ds: Dataset) => Dataset) => {
    setDatasets((prev) => prev.map((d) => (d.id === id ? updater(d) : d)));
    setDirty(true);
  };
  // 构造「替换数据集 points」的撤销命令
  const makePointsCommand = (
    dsId: string,
    prevPoints: { x: number; y: number }[],
    nextPoints: { x: number; y: number }[],
    description: string,
    prevMetadata: { area: number | null; moment: number | null },
    nextMetadata: { area: number | null; moment: number | null },
  ): UndoableCommand => {
    const clone = (pts: { x: number; y: number }[]) =>
      pts.map((p) => ({ x: p.x, y: p.y }));
    return {
      execute: () =>
        updateDataset(dsId, (d) => ({
          ...d,
          points: clone(nextPoints),
          metadata: { ...nextMetadata },
        })),
      undo: () =>
        updateDataset(dsId, (d) => ({
          ...d,
          points: clone(prevPoints),
          metadata: { ...prevMetadata },
        })),
      redo: () =>
        updateDataset(dsId, (d) => ({
          ...d,
          points: clone(nextPoints),
          metadata: { ...nextMetadata },
        })),
      description,
    };
  };
  // ========== 工程级快照（导入可撤销 / 一致性） ==========
  const captureSnapshot = (): ProjectSnapshot => ({
    image,
    imageBlob,
    originalFileName,
    calibConfig: {
      ...calibConfig,
      points: calibConfig.points.map((p) => ({ ...p })),
    },
    datasets: datasets.map((d) => ({
      ...d,
      points: d.points.map((p) => ({ ...p })),
      metadata: { ...d.metadata },
    })),
    activeDatasetId,
    precision,
    colorParams: { ...colorParams },
    curveParams: { ...curveParams },
    blobParams: { ...blobParams },
    pdfState,
    calibratePointIndex,
    calibResidual,
    calibrated: calibrationRef.current.isCalibrated(),
    showMask,
    maskImageData,
    lastGridResult,
    overlayVerify,
    uxState: ux.state,
    dirty: isDirty,
  });
  const applySnapshot = (s: ProjectSnapshot) => {
    setImage(s.image);
    setImageBlob(s.imageBlob);
    setOriginalFileName(s.originalFileName);
    setCalibConfig({
      ...s.calibConfig,
      points: s.calibConfig.points.map((p) => ({ ...p })),
    });
    setDatasets(
      s.datasets.map((d) => ({
        ...d,
        points: d.points.map((p) => ({ ...p })),
        metadata: { ...d.metadata },
      })),
    );
    setActiveDatasetId(s.activeDatasetId);
    setPrecision(s.precision);
    setColorParams({ ...s.colorParams });
    setCurveParams({ ...s.curveParams });
    setBlobParams({ ...s.blobParams });
    setPdfState(s.pdfState);
    setCalibratePointIndex(s.calibratePointIndex);
    setCalibResidual(s.calibResidual);
    setShowMask(s.showMask);
    setMaskImageData(s.maskImageData);
    setLastGridResult(s.lastGridResult);
    setOverlayVerify(s.overlayVerify);
    if (s.calibrated && s.calibConfig.points.length >= 4) {
      calibrationRef.current.calibrate(s.calibConfig);
    } else {
      calibrationRef.current.reset();
    }
    ux.setState(s.uxState);
    setDirty(s.dirty);
  };
  // ========== 多标签页管理 ==========
  /** 新增标签页 */
  const addTab = () => {
    // 保存当前标签页快照
    const snap = hasWork() ? captureSnapshot() : null;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, snapshot: snap } : tab,
      ),
    );
    // 创建新标签页
    tabCounterRef.current += 1;
    const newId = `tab-${tabCounterRef.current}`;
    const newTab: TabState = {
      id: newId,
      name: `${t("tab.new")} ${tabCounterRef.current}`,
      snapshot: null,
    };
    setTabs((prev) => [...prev, newTab]);
    // 切换到新标签页（重置状态）
    switchingTabRef.current = true;
    setDatasets([]);
    setActiveDatasetId(null);
    setCalibConfig(Calibration.createDefaultConfig);
    setCalibratePointIndex(0);
    setCalibResidual(0);
    setFocusValueIndex(null);
    calibrationRef.current.reset();
    undoRedoRef.current.clear();
    setShowMask(false);
    setMaskImageData(null);
    setLastGridResult(null); // 网格线结果与图像强绑定，重置时一并清空
    setOverlayVerify(false);
    setPrecision(3);
    setPdfState(null);
    setDirty(false);
    setImage(null);
    setImageBlob(null);
    setOriginalFileName("");
    ux.setState("EMPTY");
    ux.setFacts({
      hasImage: false,
      isCalibrated: false,
      positionsSet: 0,
      valuesEntered: 0,
      totalPoints: 0,
    });
    setActiveTabId(newId);
    setTimeout(() => {
      switchingTabRef.current = false;
    }, 100);
  };
  /** 切换标签页 */
  const switchTab = (tabId: string) => {
    if (tabId === activeTabId || switchingTabRef.current) return;
    // P0-2: 保存当前标签页快照 + 撤销栈
    const snap = hasWork() ? captureSnapshot() : null;
    const undoStacks = undoRedoRef.current.getStacks();
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, snapshot: snap, undoStacks } : tab,
      ),
    );
    // 加载目标标签页快照
    const targetTab = tabs.find((tab) => tab.id === tabId);
    switchingTabRef.current = true;
    if (targetTab?.snapshot) {
      applySnapshot(targetTab.snapshot);
      // P0-2: 恢复目标标签页的撤销栈
      if (targetTab.undoStacks) {
        undoRedoRef.current.setStacks(targetTab.undoStacks);
      } else {
        undoRedoRef.current.clear();
      }
    } else {
      // 空白标签页：重置状态
      setDatasets([]);
      setActiveDatasetId(null);
      setCalibConfig(Calibration.createDefaultConfig);
      setCalibratePointIndex(0);
      setCalibResidual(0);
      setFocusValueIndex(null);
      calibrationRef.current.reset();
      undoRedoRef.current.clear();
      setShowMask(false);
      setMaskImageData(null);
      setPrecision(3);
      setPdfState(null);
      setDirty(false);
      setImage(null);
      setImageBlob(null);
      setOriginalFileName("");
      ux.setState("EMPTY");
      ux.setFacts({
        hasImage: false,
        isCalibrated: false,
        positionsSet: 0,
        valuesEntered: 0,
        totalPoints: 0,
      });
    }
    setActiveTabId(tabId);
    setTimeout(() => {
      switchingTabRef.current = false;
    }, 100);
  };
  /** 关闭标签页 */
  const closeTab = async (tabId: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return; // 至少保留一个标签页
    const target = tabs.find((tab) => tab.id === tabId);
    const targetDirty =
      (tabId === activeTabId && isDirty) || target?.snapshot?.dirty === true;
    if (targetDirty && !(await confirmDialog(t("toast.confirmCloseTab")))) return;
    const idx = tabs.findIndex((tab) => tab.id === tabId);
    if (idx < 0) return;
    // 确定切换到哪个标签页
    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);
    if (tabId === activeTabId) {
      const nextTab = newTabs[Math.min(idx, newTabs.length - 1)];
      if (nextTab) {
        switchingTabRef.current = true;
        if (nextTab.snapshot) {
          applySnapshot(nextTab.snapshot);
        } else {
          setDatasets([]);
          setActiveDatasetId(null);
          setCalibConfig(Calibration.createDefaultConfig);
          setCalibratePointIndex(0);
          setCalibResidual(0);
          setFocusValueIndex(null);
          calibrationRef.current.reset();
          undoRedoRef.current.clear();
          setShowMask(false);
          setMaskImageData(null);
          setPrecision(3);
          setPdfState(null);
          setDirty(false);
          setImage(null);
          setImageBlob(null);
          setOriginalFileName("");
          ux.setState("EMPTY");
          ux.setFacts({
            hasImage: false,
            isCalibrated: false,
            positionsSet: 0,
            valuesEntered: 0,
            totalPoints: 0,
          });
        }
        setActiveTabId(nextTab.id);
        setTimeout(() => {
          switchingTabRef.current = false;
        }, 100);
      }
    }
  };
  const makeProjectCommand = (
    prev: ProjectSnapshot,
    next: ProjectSnapshot,
    description: string,
  ): UndoableCommand => ({
    execute: () => applySnapshot(next),
    undo: () => applySnapshot(prev),
    redo: () => applySnapshot(next),
    description,
  });
  // 是否有"已有工作"（标定/数据/图像）
  const hasWork = () =>
    datasets.length > 0 || calibrationRef.current.isCalibrated() || image != null;
  /** 新增数据集时的唯一命名 */
  const nextDatasetName = (existing: Dataset[]): string => {
    const used = new Set(existing.map((d) => d.name));
    let n = existing.length + 1;
    while (used.has(t("dataset.default", { n }))) n++;
    return t("dataset.default", { n });
  };
  // ========== 文件导入统一入口 + /） ==========
  /** 所有"导入新图"路径（文件/拖拽/粘贴/最近文件）必须调用：统一重置后再载入 */
  const startNewProject = (
    blob: Blob,
    fileName: string,
    pdf?: { bytes: Uint8Array; numPages: number },
    onReady?: (img: HTMLImageElement, blobUsed: Blob) => void,
  ) => {
    // P1-6 修复：先捕获重置前快照，图片加载失败时回滚，避免数据丢失不可撤销
    const prevSnapshot = captureSnapshot();
    // 重置工程状态（与 .prj 加载路径的 reset 保持一致，杜绝旧数据/矩阵污染）
    setDatasets([]);
    setActiveDatasetId(null);
    setCalibConfig(Calibration.createDefaultConfig);
    setCalibratePointIndex(0);
    setCalibResidual(0);
    setFocusValueIndex(null);
    calibrationRef.current.reset();
    undoRedoRef.current.clear();
    setShowMask(false);
    setMaskImageData(null);
    setLastGridResult(null); // 网格线结果与图像强绑定，重置时一并清空
    setOverlayVerify(false);
    setPrecision(3);
    setPdfState(pdf ?? null);
    setDirty(false);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url); // 释放 Object URL，避免内存泄漏
      const finish = (displayImg: HTMLImageElement, displayBlob: Blob) => {
        setImage(displayImg);
        setImageBlob(displayBlob);
        setOriginalFileName(fileName);
        ux.setState("IMAGE_READY"); // 任何状态导入新图均回到 IMAGE_READY
        ux.setFacts({
          hasImage: true,
          isCalibrated: false,
          positionsSet: 0,
          valuesEntered: 0,
          totalPoints: 0,
        });
        showToast(t("toast.imported", { name: fileName }), "success");
        onReady?.(displayImg, displayBlob);
      };
      // 大图降采样（可选）
      const big = img.naturalWidth > 4000 || img.naturalHeight > 4000;
      if (!big) {
        finish(img, blob);
        return;
      }
      if (
        !(await confirmDialog(
          t("toast.confirmLargeImage", {
            w: String(img.naturalWidth),
            h: String(img.naturalHeight),
          }),
        ))
      ) {
        finish(img, blob);
        return;
      }
      const scale = 4000 / Math.max(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext("2d");
      if (!ctx) {
        finish(img, blob);
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b) {
          finish(img, blob);
          return;
        }
        const u2 = URL.createObjectURL(b);
        const img2 = new Image();
        img2.onload = () => {
          URL.revokeObjectURL(u2);
          finish(img2, b);
        };
        img2.onerror = () => {
          URL.revokeObjectURL(u2);
          finish(img, blob);
        };
        img2.src = u2;
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url); // 加载失败也要释放
      // P1-6 修复：加载失败时回滚到导入前状态，避免用户数据丢失不可撤销
      applySnapshot(prevSnapshot);
      showToast(t("toast.imageLoadFail"), "error");
    };
    img.src = url;
  };
  /** 带"已有工作"二次确认的安全导入；导入动作可撤销（工程快照） */
  const safeStartNewProject = async (
    blob: Blob,
    fileName: string,
    pdf?: { bytes: Uint8Array; numPages: number },
  ) => {
    if (hasWork()) {
      const ok = await confirmDialog(t("toast.confirmClear"));
      if (!ok) return;
    }
    const prev = captureSnapshot();
    const paramsSnapshot = { colorParams, curveParams, blobParams }; // 检测参数保留
    startNewProject(blob, fileName, pdf, (img, blobUsed) => {
      const next: ProjectSnapshot = {
        image: img,
        imageBlob: blobUsed,
        originalFileName: fileName,
        calibConfig: Calibration.createDefaultConfig(),
        datasets: [],
        activeDatasetId: null,
        precision: 3,
        colorParams: paramsSnapshot.colorParams,
        curveParams: paramsSnapshot.curveParams,
        blobParams: paramsSnapshot.blobParams,
        pdfState: pdf ?? null,
        calibratePointIndex: 0,
        calibResidual: 0,
        calibrated: false,
        showMask: false,
        maskImageData: null,
        lastGridResult: null,
        overlayVerify: false,
        uxState: "IMAGE_READY",
        dirty: false,
      };
      undoRedoRef.current.pushToUndo(
        makeProjectCommand(prev, next, `导入 ${fileName}`),
      );
    });
  };
  /** 多页 PDF 切页——已标定时保留标定并作为新数据集追加；未标定走安全重置 */
  const importPdfPage = async (page: number) => {
    if (!pdfState) return;
    const keepCalib = calibrationRef.current.isCalibrated();
    const hasWork =
      datasets.length > 0 ||
      calibrationRef.current.isCalibrated() ||
      image != null;
    if (hasWork) {
      const msg = keepCalib
        ? t("toast.confirmSwitchPage.keep")
        : t("toast.confirmSwitchPage.reset");
      if (!(await confirmDialog(msg))) return;
    }
    try {
      const pdfResult = await importPdf(pdfState.bytes, page);
      if (keepCalib) {
        const colors = [
          "#007aff",
          "#ff3b30",
          "#34c759",
          "#5856d6",
          "#ff9500",
          "#af52de",
        ];
        const ds: Dataset = {
          id: generateId(),
          name: nextDatasetName(datasets),
          color: colors[datasets.length % colors.length],
          points: [],
          metadata: { area: null, moment: null },
        };
        const url = URL.createObjectURL(pdfResult.blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          setImage(img);
          setImageBlob(pdfResult.blob);
          setOriginalFileName(
            `${originalFileName}${t("pdf.pageSuffix", { n: page })}`,
          );
          setDatasets((cur) => [...cur, ds]);
          setActiveDatasetId(ds.id);
          setPdfState({ bytes: pdfState.bytes, numPages: pdfState.numPages });
          setDirty(true);
          ux.setState("EXTRACTING");
          ux.setFacts({
            hasImage: true,
            isCalibrated: true,
            positionsSet: 4,
            valuesEntered: 4,
            totalPoints: datasets.reduce((s, d) => s + d.points.length, 0),
          });
          showToast(t("toast.pdfPageImported", { n: page }), "success");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          showToast(t("toast.pdfPageImgFail"), "error");
        };
        img.src = url;
      } else {
        safeStartNewProject(
          pdfResult.blob,
          `${originalFileName}${t("pdf.pageSuffix", { n: page })}`,
          {
            bytes: pdfState.bytes,
            numPages: pdfState.numPages,
          },
        );
      }
    } catch (e) {
      showToast(userError(e, t("toast.pdfPageFail", { n: page })), "warning");
    }
  };
  const handleImportFile = async (filePath?: string | null) => {
    try {
      if (!filePath) {
        filePath = await appApi.openFileDialog([
          {
            name: "图片和PDF",
            extensions: [
              "png",
              "jpg",
              "jpeg",
              "bmp",
              "webp",
              "gif",
              "svg",
              "pdf",
            ],
          },
          { name: "工程文件", extensions: ["prj"] },
          { name: "所有文件", extensions: ["*"] },
        ]);
      }
      if (!filePath) return;
      // 检查是否为工程文件
      if (filePath.toLowerCase().endsWith(".prj")) {
        await loadProject(filePath);
        return;
      }
      const ext = filePath.split(".").pop()?.toLowerCase();
      const fileName =
        filePath.split("/").pop() || filePath.split("\\").pop() || "未命名";
      // 浏览器 Image 可解码的图片格式白名单；TIFF 等无法解码，提前给出明确提示避免静默失败。
      // 注意：PDF 由 pdfjs 解码（非浏览器 Image），必须放行；否则下方 PDF 分支不可达。
      // 无扩展名（ext 为 undefined）或白名单外格式给出明确提示，避免静默生成 image/undefined 导致加载失败（建议3）。
      if (!ext || (ext !== "pdf" && !DECODABLE.has(ext))) {
        showToast(
          ext
            ? t("toast.unsupportedFormat", { ext, formats: FORMAT_HINT })
            : t("toast.noExtension", { formats: FORMAT_HINT }),
          "warning",
        );
        return;
      }
      const readResult = await appApi.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        showToast(t("toast.fileReadFail"), "error");
        return;
      }
      const bytes = base64ToBytes(readResult.data);
      let blob: Blob;
      let pdfInfo: { bytes: Uint8Array; numPages: number } | undefined;
      if (ext === "pdf") {
        try {
          const pdfResult = await importPdf(bytes, 1);
          blob = pdfResult.blob;
          pdfInfo = { bytes, numPages: pdfResult.numPages };
          if (pdfResult.numPages > 1) {
            showToast(t("toast.pdfPages", { n: pdfResult.numPages }), "info");
          }
        } catch (pdfErr) {
          showToast(userError(pdfErr, t("toast.pdfParseFail")), "warning");
          return;
        }
      } else {
        const mime =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "svg"
              ? "image/svg+xml"
              : `image/${ext}`; // png/bmp/webp/gif
        blob = new Blob([new Uint8Array(bytes)], { type: mime });
      }
      safeStartNewProject(blob, fileName, pdfInfo); // 统一二次确认
      appApi.addRecentFile({ path: filePath, name: fileName }).catch(() => {});
    } catch (err) {
      showToast(userError(err, t("toast.importFail")), "error");
    }
  };
  // ========== 标定（合一交互，// + ） ==========
  const startCalibration = () => {
    if (ux.state !== "CALIBRATING") {
      if (!ux.can("startCalibrate")) {
        showToast(trReason(ux.reasonFor("startCalibrate")), "warning");
        return;
      }
    }
    setCalibratePointIndex(0);
    setFocusValueIndex(null);
    setCalibConfig((prev) => ({
      ...prev,
      points: CALIB_ROLES.map((r) => ({
        px: 0,
        py: 0,
        dx: null,
        dy: null,
        label: r.label,
        role: r.role,
        placed: false,
      })),
    }));
    if (ux.state !== "CALIBRATING") ux.go("startCalibrate");
    showToast(t("toast.calibStart"), "info");
  };
  const handleCalibrationClick = (imgX: number, imgY: number) => {
    if (ux.state !== "CALIBRATING") return;
    const idx = calibratePointIndex;
    // 点击已放置的标定点 → 重新定位该点（命中测试、设为当前激活）
    // 修复：当当前标定点尚未放置时，优先放置当前点，跳过命中测试。
    // 否则当两个标定点位置重合（如 X轴零点与Y轴零点在同一位置）时，
    // 后放的点会被命中测试拦截导致无法标定。
    const currentNotPlaced = idx < 4 && !calibConfig.points[idx]?.placed;
    if (!currentNotPlaced) {
      const hitIdx = calibConfig.points.findIndex(
        (p) =>
          p.placed &&
          p.px != null &&
          p.py != null &&
          Math.hypot(p.px - imgX, p.py - imgY) <= 12,
      );
      if (hitIdx >= 0) {
        setCalibratePointIndex(hitIdx);
        setCalibConfig((prev) => {
          const newPoints = [...prev.points];
          newPoints[hitIdx] = {
            ...newPoints[hitIdx],
            px: imgX,
            py: imgY,
            placed: true,
          };
          return { ...prev, points: newPoints };
        });
        setFocusValueIndex(hitIdx);
        setDirty(true);
        showToast(
          t("toast.calibRelocated", {
            n: String(hitIdx + 1),
            label: CALIB_ROLES[hitIdx].label,
          }),
          "info",
        );
        return;
      }
    }
    if (idx >= 4) return;
    setCalibConfig((prev) => {
      const newPoints = [...prev.points];
      newPoints[idx] = { ...newPoints[idx], px: imgX, py: imgY, placed: true };
      return { ...prev, points: newPoints };
    });
    setDirty(true);
    const nextIndex = idx + 1;
    if (nextIndex >= 4) {
      setCalibratePointIndex(4);
      setFocusValueIndex(3); // 聚焦最后一个数值框，便于收尾
      showToast(t("toast.calibAllPlaced"), "info");
    } else {
      setCalibratePointIndex(nextIndex);
      setFocusValueIndex(idx); // 聚焦刚点击点的数值输入框（位置与数值同一注意力流）
      showToast(
        t("toast.calibPointSet", {
          n: String(idx + 1),
          next: String(nextIndex + 1),
          label: CALIB_ROLES[nextIndex].label,
        }),
        "info",
      );
    }
  };
  const setPointValue = (i: number, axis: "x" | "y", raw: string) => {
    const v = raw === "" ? null : parseFloat(raw);
    setCalibConfig((prev) => {
      const newPoints = [...prev.points];
      newPoints[i] =
        axis === "x" ? { ...newPoints[i], dx: v } : { ...newPoints[i], dy: v };
      return { ...prev, points: newPoints };
    });
    setDirty(true);
  };
  const commitCalibration = () => {
    // 守卫：4 位置齐全且 4 数值非空（杜绝假值静默标定）
    const reason = trReason(ux.reasonFor("commit"));
    if (reason) {
      showToast(reason, "warning");
      return;
    }
    const calibConfigSnapshot = calibConfig;
    const success = calibrationRef.current.calibrate(calibConfigSnapshot);
    if (!success) {
      showToast(t("toast.calibFail"), "error");
      return;
    }
    const res = calibrationRef.current.getResidual();
    setCalibResidual(res);
    let createdDs: Dataset | null = null;
    if (datasets.length === 0) {
      createdDs = {
        id: generateId(),
        name: nextDatasetName(datasets),
        color: "#007aff",
        points: [],
        metadata: { area: null, moment: null },
      };
      setDatasets([createdDs]);
      setActiveDatasetId(createdDs.id);
    }
    ux.setFacts({
      hasImage: !!image,
      isCalibrated: true,
      positionsSet: 4,
      valuesEntered: 4,
      totalPoints,
    });
    ux.go("commit"); // → CALIBRATED
    setDirty(true);
    showToast(
      t("toast.calibDone", {
        residual: res.toFixed(2),
        warn: res > 2 ? t("toast.calibResidualWarn") : "",
      }),
      res > 2 ? "warning" : "success",
    );
    // 标定可撤销（Ctrl+Z 回到未标定，位置与数值保留）
    undoRedoRef.current.pushToUndo({
      execute: () => {
        calibrationRef.current.calibrate(calibConfigSnapshot);
        setCalibResidual(calibrationRef.current.getResidual());
        if (createdDs) {
          setDatasets((prev) =>
            prev.some((d) => d.id === createdDs!.id)
              ? prev
              : [...prev, createdDs!],
          );
          setActiveDatasetId(createdDs.id);
        }
        ux.setState("CALIBRATED");
      },
      undo: () => {
        calibrationRef.current.reset();
        setCalibResidual(0);
        if (createdDs) {
          setDatasets((prev) => prev.filter((d) => d.id !== createdDs!.id));
          setActiveDatasetId((cur) => (cur === createdDs!.id ? null : cur));
        }
        ux.setState("CALIBRATING");
      },
      redo: () => {
        calibrationRef.current.calibrate(calibConfigSnapshot);
        setCalibResidual(calibrationRef.current.getResidual());
        if (createdDs) {
          setDatasets((prev) =>
            prev.some((d) => d.id === createdDs!.id)
              ? prev
              : [...prev, createdDs!],
          );
          setActiveDatasetId(createdDs.id);
        }
        ux.setState("CALIBRATED");
      },
      description: "完成标定",
    });
  };
  const cancelCalibration = () => {
    calibrationRef.current.reset();
    setCalibConfig(Calibration.createDefaultConfig);
    setCalibResidual(0);
    setCalibratePointIndex(0);
    ux.go("cancel"); // → IMAGE_READY
  };
  const recalibrate = () => {
    if (!ux.can("recalibrate")) {
      showToast(trReason(ux.reasonFor("recalibrate")), "warning");
      return;
    }
    setCalibratePointIndex(0);
    setFocusValueIndex(null);
    ux.go("recalibrate"); // → CALIBRATING，保留已有位置与数值
    showToast(t("toast.calibCancel"), "info");
  };
  // ========== 取点 ==========
  const handleCanvasClick = (imgX: number, imgY: number) => {
    if (ux.state === "CALIBRATING") {
      handleCalibrationClick(imgX, imgY);
      return;
    }
    if (
      (ux.state === "CALIBRATED" || ux.state === "EXTRACTING") &&
      activeDataset &&
      calibrationRef.current.isCalibrated()
    ) {
      const data = calibrationRef.current.pixelToData(imgX, imgY);
      if (!data) return;
      const [dx, dy] = data;
      const dsId = activeDataset.id;
      const prevPoints = activeDataset.points.map((p) => ({ x: p.x, y: p.y }));
      const nextPoints = [...prevPoints, { x: dx, y: dy }];
      const meta = { ...activeDataset.metadata };
      const command = makePointsCommand(
        dsId,
        prevPoints,
        nextPoints,
        `添加点 (${dx.toFixed(2)}, ${dy.toFixed(2)})`,
        meta,
        meta,
      );
      undoRedoRef.current.execute(command);
    }
  };
  /** 右键命中测试（最近 8px 内的数据点） */
  const findPointAt = (
    imgX: number,
    imgY: number,
  ): { dsId: string; idx: number } | null => {
    if (!calibrationRef.current.isCalibrated()) return null;
    let best: { dsId: string; idx: number; d: number } | null = null;
    for (const ds of datasets) {
      for (let i = 0; i < ds.points.length; i++) {
        const pix = calibrationRef.current.dataToPixel(
          ds.points[i].x,
          ds.points[i].y,
        );
        const d = Math.hypot(pix.x - imgX, pix.y - imgY);
        if (d <= 8 && (!best || d < best.d)) best = { dsId: ds.id, idx: i, d };
      }
    }
    return best ? { dsId: best.dsId, idx: best.idx } : null;
  };
  const handleCanvasRightClick = (
    imgX: number,
    imgY: number,
    screenX: number,
    screenY: number,
  ) => {
    const hit = findPointAt(imgX, imgY);
    setContextMenu({ x: screenX, y: screenY, imgX, imgY, hit });
  };
  const handleColorPick = (imgX: number, imgY: number) => {
    const imgData = canvasRef.current?.getImageData();
    if (!imgData) return;
    const color = ColorFilter.pickColor(imgData, imgX, imgY);
    setColorParams((prev) => ({ ...prev, fgColor: color }));
    setColorPickMode(false);
    setDirty(true);
    showToast(
      t("toast.colorPicked", { r: color[0], g: color[1], b: color[2] }),
      "success",
    );
  };
  /** 画布拖拽改位（走撤销栈） */
  const handleCanvasPointMove = (
    dsIdx: number,
    ptIdx: number,
    imgX: number,
    imgY: number,
  ) => {
    const ds = datasets[dsIdx];
    if (!ds || !ds.points[ptIdx] || !calibrationRef.current.isCalibrated())
      return;
    const data = calibrationRef.current.pixelToData(imgX, imgY);
    if (!data) return;
    const [nx, ny] = data;
    const prevPoints = ds.points.map((p) => ({ x: p.x, y: p.y }));
    const nextPoints = prevPoints.map((p, i) =>
      i === ptIdx ? { x: nx, y: ny } : p,
    );
    const meta = { ...ds.metadata };
    undoRedoRef.current.execute(
      makePointsCommand(
        ds.id,
        prevPoints,
        nextPoints,
        `移动点 ${ptIdx + 1}`,
        meta,
        meta,
      ),
    );
    showToast(
      t("toast.pointMoved", {
        n: String(ptIdx + 1),
        x: nx.toFixed(precision),
        y: ny.toFixed(precision),
      }),
      "success",
    );
  };
  // ========== ：数据点编辑（表格/右键） ==========
  const deletePointAt = (dsId: string, idx: number) => {
    const ds = datasets.find((d) => d.id === dsId);
    if (!ds || idx < 0 || idx >= ds.points.length) return;
    const prevPoints = ds.points.map((p) => ({ x: p.x, y: p.y }));
    const nextPoints = prevPoints.filter((_, i) => i !== idx);
    const meta = { ...ds.metadata };
    undoRedoRef.current.execute(
      makePointsCommand(
        dsId,
        prevPoints,
        nextPoints,
        `删除点 ${idx + 1}`,
        meta,
        meta,
      ),
    );
  };
  const copyPoint = async (dsId: string, idx: number) => {
    const ds = datasets.find((d) => d.id === dsId);
    const pt = ds?.points[idx];
    if (!pt) return;
    try {
      await navigator.clipboard.writeText(
        `${pt.x.toFixed(precision)}, ${pt.y.toFixed(precision)}`,
      );
      showToast(t("toast.copied"), "success");
    } catch {
      showToast(t("toast.copyFail"), "error");
    }
  };
  /** 表格输入：聚焦时记录原值，失焦时压入一条撤销命令 */
  const beginPointEdit = (
    dsId: string,
    idx: number,
    axis: "x" | "y",
    value: number,
  ) => {
    pointEditStartRef.current = { dsId, idx, axis, prev: value };
  };
  const changePointValue = (
    dsId: string,
    idx: number,
    axis: "x" | "y",
    raw: string,
  ) => {
    // 拒绝「清空单元格」写入 NaN（输入框失焦回滚原值），避免不可撤销的脏值污染
    if (raw.trim() === "") return;
    const v = parseFloat(raw);
    // P2-7 修复：拒绝 NaN（如 "1e" 等部分输入态），避免脏数据写入
    if (Number.isNaN(v)) return;
    updateDataset(dsId, (d) => ({
      ...d,
      points: d.points.map((p, i) => (i === idx ? { ...p, [axis]: v } : p)),
    }));
  };
  const commitPointEdit = () => {
    const s = pointEditStartRef.current;
    pointEditStartRef.current = null;
    if (!s) return;
    const ds = datasets.find((d) => d.id === s.dsId);
    if (!ds || !ds.points[s.idx]) return;
    const cur = s.axis === "x" ? ds.points[s.idx].x : ds.points[s.idx].y;
    const same = (Number.isNaN(cur) && Number.isNaN(s.prev)) || cur === s.prev;
    if (same) return;
    const prevPoints = ds.points.map((p) => ({ x: p.x, y: p.y }));
    const nextPoints = prevPoints.map((p, i) =>
      i === s.idx ? { ...p, [s.axis]: cur } : p,
    );
    const meta = { ...ds.metadata };
    undoRedoRef.current.execute(
      makePointsCommand(
        ds.id,
        prevPoints,
        nextPoints,
        `编辑点 ${s.idx + 1}`,
        meta,
        meta,
      ),
    );
  };
  const openEditPoint = (dsId: string, idx: number) => {
    const ds = datasets.find((d) => d.id === dsId);
    const pt = ds?.points[idx];
    if (!pt) return;
    setEditPointDraft({ x: String(pt.x), y: String(pt.y) });
    setEditPoint({ dsId, idx });
  };
  const saveEditPoint = () => {
    if (!editPoint) return;
    const ds = datasets.find((d) => d.id === editPoint.dsId);
    if (!ds || !ds.points[editPoint.idx]) return;
    const x = parseFloat(editPointDraft.x);
    const y = parseFloat(editPointDraft.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      showToast(t("toast.invalidValue"), "warning");
      return;
    }
    const prevPoints = ds.points.map((p) => ({ x: p.x, y: p.y }));
    const nextPoints = prevPoints.map((p, i) =>
      i === editPoint.idx ? { x, y } : p,
    );
    const meta = { ...ds.metadata };
    undoRedoRef.current.execute(
      makePointsCommand(
        ds.id,
        prevPoints,
        nextPoints,
        `编辑点 ${editPoint.idx + 1}`,
        meta,
        meta,
      ),
    );
    setEditPoint(null);
    showToast(t("toast.pointUpdated"), "success");
  };
  // ========== 自动检测（进度/取消/预览、实时掩码） ==========
  const runCurveTracking = async () => {
    if (detectionRunningRef.current) return; // 前端审查 P0-5：在途保护，防连点并发
    const imgData = canvasRef.current?.getImageData();
    if (!imgData || !image || !activeDataset) return;
    if (!calibrationRef.current.isCalibrated()) {
      showToast(t("toast.noCalib"), "warning");
      return;
    }
    detectionRunningRef.current = true;
    cancelDetectionRef.current = false;
    setDetectionState({ running: "curve", progress: 0 });
    try {
      const { pixelPoints, mask, width, height } = await extractCurve(
        imgData,
        colorParams,
        curveParams,
        (r) => setDetectionState({ running: "curve", progress: r }),
        () => cancelDetectionRef.current,
      );
      if (cancelDetectionRef.current) {
        setDetectionState({ running: null, progress: 0 });
        showToast(t("toast.curveCancelled"), "info");
        return;
      }
      setDetectionState({ running: null, progress: 0 });
      if (pixelPoints.length === 0) {
        showToast(t("toast.curveEmpty"), "warning");
        setShowMask(true);
        setMaskImageData(ColorFilter.binaryToImageData(mask, width, height));
        return;
      }
      // 先预览，后由用户选择 应用/追加/丢弃（不再静默替换）
      setDetectionPreview({
        kind: "curve",
        dsId: activeDataset.id,
        pixelPoints,
      });
      setShowMask(true);
      setMaskImageData(ColorFilter.binaryToImageData(mask, width, height));
      showToast(t("toast.curveFound", { n: pixelPoints.length }), "info");
    } catch (err) {
      setDetectionState({ running: null, progress: 0 });
      if (cancelDetectionRef.current) {
        showToast(t("toast.curveCancelled"), "info");
        return;
      }
      showToast(userError(err, t("toast.curveFail")), "error");
    } finally {
      detectionRunningRef.current = false;
    }
  };
  const runBlobDetection = async () => {
    if (detectionRunningRef.current) return; // 前端审查 P0-5：在途保护
    const imgData = canvasRef.current?.getImageData();
    if (!imgData || !image || !activeDataset) return;
    if (!calibrationRef.current.isCalibrated()) {
      showToast(t("toast.noCalib"), "warning");
      return;
    }
    detectionRunningRef.current = true;
    cancelDetectionRef.current = false;
    setDetectionState({ running: "blob", progress: 0 });
    try {
      const { blobs, mask, width, height } = await extractBlobs(
        imgData,
        colorParams,
        blobParams,
        (r) => setDetectionState({ running: "blob", progress: r }),
        () => cancelDetectionRef.current,
      );
      if (cancelDetectionRef.current) {
        setDetectionState({ running: null, progress: 0 });
        showToast(t("toast.blobCancelled"), "info");
        return;
      }
      setDetectionState({ running: null, progress: 0 });
      if (blobs.length === 0) {
        showToast(t("toast.blobEmpty"), "warning");
        setShowMask(true);
        setMaskImageData(ColorFilter.binaryToImageData(mask, width, height));
        return;
      }
      setDetectionPreview({
        kind: "blob",
        dsId: activeDataset.id,
        pixelPoints: blobs.map((b) => b.centroid),
      });
      setShowMask(true);
      setMaskImageData(ColorFilter.binaryToImageData(mask, width, height));
      showToast(t("toast.blobFound", { n: blobs.length }), "info");
    } catch (err) {
      setDetectionState({ running: null, progress: 0 });
      if (cancelDetectionRef.current) {
        showToast(t("toast.blobCancelled"), "info");
        return;
      }
      showToast(userError(err, t("toast.blobFail")), "error");
    } finally {
      detectionRunningRef.current = false;
    }
  };
  const runGridDetection = async () => {
    if (detectionRunningRef.current) return; // 前端审查 P0-5：在途保护
    const imgData = canvasRef.current?.getImageData();
    if (!imgData || !image) return;
    detectionRunningRef.current = true;
    cancelDetectionRef.current = false;
    setDetectionState({ running: "grid", progress: 0 });
    try {
      const { result, mask, width, height } = await detectGrid(
        imgData,
        colorParams,
        { hasVertical: true, hasHorizontal: true, xFrac: gridParams.xFrac, yFrac: gridParams.yFrac },
        (r) => setDetectionState({ running: "grid", progress: r }),
        () => cancelDetectionRef.current,
      );
      if (cancelDetectionRef.current) {
        setDetectionState({ running: null, progress: 0 });
        showToast(t("toast.gridCancelled"), "info");
        return;
      }
      setDetectionState({ running: null, progress: 0 });
      // 保存网格检测结果用于伪点清理
      setLastGridResult({
        verticalLines: result.verticalLines,
        horizontalLines: result.horizontalLines,
      });
      setShowMask(true);
      setMaskImageData(ColorFilter.binaryToImageData(mask, width, height));
      showToast(
        t("toast.gridDone", {
          v: result.verticalLines.length,
          h: result.horizontalLines.length,
        }),
        "success",
      );
    } catch (err) {
      setDetectionState({ running: null, progress: 0 });
      if (cancelDetectionRef.current) {
        showToast(t("toast.gridCancelled"), "info");
        return;
      }
      showToast(userError(err, t("toast.gridFail")), "error");
    } finally {
      detectionRunningRef.current = false;
    }
  };
  /** 去除网格伪点 — 从当前数据集中删除落在网格线上的点 */
  const handleRemoveGridNoise = () => {
    if (!lastGridResult || !activeDataset) {
      showToast(t("detect.noGridResult"), "warning");
      return;
    }
    if (!calibrationRef.current.isCalibrated()) return;
    const prevPoints = activeDataset.points.map((p) => ({ x: p.x, y: p.y }));
    // 将数据坐标转回像素坐标，再用网格线判断
    const pixelPoints = prevPoints.map((p) => {
      const pix = calibrationRef.current.dataToPixel(p.x, p.y);
      return { x: pix.x, y: pix.y };
    });
    const cleaned = removeGridNoise(pixelPoints, lastGridResult, 3);
    if (cleaned.length === pixelPoints.length) {
      showToast(t("detect.noGridNoise"), "info");
      return;
    }
    const removedCount = pixelPoints.length - cleaned.length;
    // 转回数据坐标
    const nextPoints = cleaned.flatMap((pt): Array<{ x: number; y: number }> => {
      const data = calibrationRef.current.pixelToData(pt.x, pt.y);
      // P2-14 修复：未标定时跳过该点而非写入 (0,0) 假数据
      if (!data) return [];
      return [{ x: data[0], y: data[1] }];
    });
    const meta = { ...activeDataset.metadata };
    undoRedoRef.current.execute(
      makePointsCommand(
        activeDataset.id,
        prevPoints,
        nextPoints,
        `去除网格伪点 (移除 ${removedCount})`,
        meta,
        meta,
      ),
    );
    showToast(t("detect.gridNoiseRemoved", { n: removedCount }), "success");
  };
  /** 多曲线分离 — 用当前前景色提取曲线到新数据集 */
  const handleMultiCurveExtract = async () => {
    if (detectionRunningRef.current) return; // 前端审查 P0-5：在途保护
    const imgData = canvasRef.current?.getImageData();
    if (!imgData || !image || !calibrationRef.current.isCalibrated()) {
      showToast(t("toast.noCalib"), "warning");
      return;
    }
    detectionRunningRef.current = true;
    cancelDetectionRef.current = false;
    setDetectionState({ running: "curve", progress: 0 });
    try {
      const { pixelPoints } = await extractCurve(
        imgData,
        colorParams,
        curveParams,
        (r) => setDetectionState({ running: "curve", progress: r }),
        () => cancelDetectionRef.current,
      );
      setDetectionState({ running: null, progress: 0 });
      if (pixelPoints.length === 0) {
        showToast(t("toast.curveEmpty"), "warning");
        return;
      }
      // 创建新数据集
      const colors = [
        "#007aff",
        "#ff3b30",
        "#34c759",
        "#5856d6",
        "#ff9500",
        "#af52de",
      ];
      const dsColor = colors[datasets.length % colors.length];
      const newDs: Dataset = {
        id: generateId(),
        name: nextDatasetName(datasets),
        color: dsColor,
points: pixelPoints.flatMap((pt): Array<{ x: number; y: number }> => {
const data = calibrationRef.current.pixelToData(pt.x, pt.y);
if (!data) return [];
return [{ x: data[0], y: data[1] }];
}),
        metadata: { area: null, moment: null },
      };
      const newDsId = newDs.id;
      undoRedoRef.current.execute({
        execute: () => {
          setDatasets((prev) => [...prev, newDs]);
          setActiveDatasetId(newDsId);
          setDirty(true);
        },
        undo: () => {
          setDatasets((prev) => prev.filter((d) => d.id !== newDsId));
          setDirty(true);
        },
        redo: () => {
          setDatasets((prev) => [...prev, newDs]);
          setActiveDatasetId(newDsId);
          setDirty(true);
        },
        description: `多曲线提取 → ${newDs.name}`,
      });
      showToast(
        t("detect.multiCurve.added", {
          n: pixelPoints.length,
          name: newDs.name,
        }),
        "success",
      );
    } catch (err) {
      setDetectionState({ running: null, progress: 0 });
      showToast(userError(err, t("toast.curveFail")), "error");
    } finally {
      detectionRunningRef.current = false;
    }
  };
  /** 按颜色分拣散点到不同数据集 */
  const handleBlobColorCluster = async () => {
    if (detectionRunningRef.current) return; // 前端审查 P0-5：在途保护
    const imgData = canvasRef.current?.getImageData();
    if (!imgData || !image || !calibrationRef.current.isCalibrated()) {
      showToast(t("toast.noCalib"), "warning");
      return;
    }
    detectionRunningRef.current = true;
    cancelDetectionRef.current = false;
    setDetectionState({ running: "blob", progress: 0 });
    try {
      const { blobs } = await extractBlobs(
        imgData,
        colorParams,
        blobParams,
        (r) => setDetectionState({ running: "blob", progress: r }),
        () => cancelDetectionRef.current,
      );
      setDetectionState({ running: null, progress: 0 });
      if (blobs.length === 0) {
        showToast(t("toast.blobEmpty"), "warning");
        return;
      }
      // 按颜色聚类
      const clusters = clusterBlobsByColor(imgData, blobs, 80, 10);
      if (clusters.length === 0) {
        showToast(t("detect.clusterFail"), "warning");
        return;
      }
      // 每组创建一个数据集
      const colors = [
        "#007aff",
        "#ff3b30",
        "#34c759",
        "#5856d6",
        "#ff9500",
        "#af52de",
        "#30b0c7",
        "#ff2d55",
        "#5ac8fa",
        "#ffcc00",
      ];
      const newDatasets: Dataset[] = clusters.map((cl, i) => {
        const color = colors[(datasets.length + i) % colors.length];
        return {
          id: generateId(),
          name: t("dataset.cluster", { n: i + 1 }),
          color,
          points: cl.blobs.flatMap((b): Array<{ x: number; y: number }> => {
            const data = calibrationRef.current.pixelToData(
              b.centroid.x,
              b.centroid.y,
            );
            if (!data) return [];
            return [{ x: data[0], y: data[1] }];
          }),
          metadata: { area: null, moment: null },
        };
      });
      const newDsIds = newDatasets.map((d) => d.id);
      const firstNewId = newDatasets[0].id;
      undoRedoRef.current.execute({
        execute: () => {
          setDatasets((prev) => [...prev, ...newDatasets]);
          setActiveDatasetId(firstNewId);
          setDirty(true);
        },
        undo: () => {
          setDatasets((prev) => prev.filter((d) => !newDsIds.includes(d.id)));
          setDirty(true);
        },
        redo: () => {
          setDatasets((prev) => [...prev, ...newDatasets]);
          setActiveDatasetId(firstNewId);
          setDirty(true);
        },
        description: `按颜色分拣散点 → ${newDatasets.length} 个数据集`,
      });
      showToast(
        t("detect.clusterCount", { n: clusters.length }) +
          t("detect.clusterSuffix", { datasets: newDatasets.length }),
        "success",
      );
    } catch (err) {
      setDetectionState({ running: null, progress: 0 });
      showToast(userError(err, t("toast.blobFail")), "error");
    } finally {
      detectionRunningRef.current = false;
    }
  };
  /** 批量处理 — 选择目录并逐张提取 */
  const handleBatchSelectDir = async () => {
    const dir = await appApi.openDirectoryDialog();
    if (!dir) return;
    const files = await appApi.listDirectory(dir, [
      "png",
      "jpg",
      "jpeg",
      "bmp",
      "webp",
      "gif",
    ]);
    if (files.length === 0) {
      showToast(t("batch.noFiles"), "warning");
      return;
    }
    setBatchState({
      running: false,
      inputDir: dir,
      outputDir: dir,
      files,
      currentIdx: 0,
      okCount: 0,
    });
  };
  const handleBatchSelectOutputDir = async () => {
    const dir = await appApi.openDirectoryDialog();
    if (!dir) return;
    setBatchState((prev) => (prev ? { ...prev, outputDir: dir } : prev));
  };
  const handleBatchRun = async () => {
    if (!batchState || batchState.files.length === 0) return;
    if (!calibrationRef.current.isCalibrated()) {
      showToast(t("batch.needCalib"), "warning");
      return;
    }
    batchCancelRef.current = false;
    setBatchState((prev) =>
      prev ? { ...prev!, running: true, currentIdx: 0, okCount: 0 } : prev,
    );
    let ok = 0;
    let skipped = 0;
    for (let i = 0; i < batchState.files.length; i++) {
      if (batchCancelRef.current) break;
      const file = batchState.files[i];
      setBatchState((prev) => (prev ? { ...prev!, currentIdx: i } : prev));
      try {
        // 读取文件
        const readResult = await appApi.readFile(file.path);
        if (!readResult.success || !readResult.data) {
          continue;
        }
        const bytes = base64ToBytes(readResult.data);
        const ext = file.path.split(".").pop()?.toLowerCase() || "png";
        const mime =
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        const blob = new Blob([new Uint8Array(bytes)], { type: mime });
        // 加载图片
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(blob);
          const el = new Image();
          el.onload = () => {
            URL.revokeObjectURL(url);
            resolve(el);
          };
          el.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("load fail"));
          };
          el.src = url;
        });
        // 批量以当前图的标定套用，各图尺寸/几何不一致则跳过
        if (
          image &&
          (img.naturalWidth !== image.naturalWidth ||
            img.naturalHeight !== image.naturalHeight)
        ) {
          skipped++;
          continue;
        }
        // 获取 ImageData
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = img.naturalWidth;
        tmpCanvas.height = img.naturalHeight;
        const tmpCtx = tmpCanvas.getContext("2d");
        if (!tmpCtx) continue;
        tmpCtx.drawImage(img, 0, 0);
        const imgData = tmpCtx.getImageData(
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
        );
        // 曲线追踪
        const { pixelPoints } = await extractCurve(
          imgData,
          colorParams,
          curveParams,
        );
        if (pixelPoints.length === 0) continue;
        // 转数据坐标
const points = pixelPoints.flatMap((pt): Array<{ x: number; y: number }> => {
const data = calibrationRef.current.pixelToData(pt.x, pt.y);
if (!data) return [];
return [{ x: data[0], y: data[1] }];
});
        // 导出 CSV
        const dsName = file.name.replace(/\.[^.]+$/, "");
        const csvText = ExportService.buildCSVText(
          [
            {
              id: "batch",
              name: dsName,
              color: "#007aff",
              points,
              metadata: { area: null, moment: null },
            },
          ],
          {
            format: "csv",
            encoding: "utf-8",
            precision,
            includeHeader: true,
            mergeMode: "long",
          },
          calibConfig,
          {
            appVersion: APP_VERSION,
            residual: calibResidual,
            extractedAt: new Date().toISOString(),
          },
        );
        const outPath = `${batchState.outputDir}/${dsName}_数据.csv`;
        const saveOk = await ExportService.saveCSVToFile(csvText, outPath, "utf-8");
        // P2-8 修复：检查写盘返回值，失败不计入成功
        if (saveOk) ok++;
      } catch {
        // 单张失败继续
      }
    }
    setBatchState((prev) =>
      prev ? { ...prev!, running: false, okCount: ok } : prev,
    );
    showToast(
      t("batch.done", { ok, total: batchState.files.length }) +
        (skipped > 0 ? t("batch.skipped", { n: skipped }) : ""),
      "success",
    );
  };
  const handleBatchStop = () => {
    batchCancelRef.current = true;
  };
  /** 应用/丢弃检测预览结果（默认可选追加，不再静默覆盖） */
  const applyDetection = (mode: "replace" | "append" | "discard") => {
    const preview = detectionPreview;
    setDetectionPreview(null);
    setShowMask(false);
    setMaskImageData(null);
    if (!preview) return;
    if (mode === "discard") {
      showToast(t("toast.detectDiscard"), "info");
      return;
    }
    const ds = datasets.find((d) => d.id === preview.dsId);
    if (!ds) return;
const dataPoints = preview.pixelPoints.flatMap((pt): Array<{ x: number; y: number }> => {
const data = calibrationRef.current.pixelToData(pt.x, pt.y);
if (!data) return [];
return [{ x: data[0], y: data[1] }];
});
    const prevPoints = ds.points.map((p) => ({ x: p.x, y: p.y }));
    const nextPoints =
      mode === "replace" ? dataPoints : [...prevPoints, ...dataPoints];
    const meta = { ...ds.metadata };
    const label = preview.kind === "curve" ? "曲线追踪" : "散点检测";
    undoRedoRef.current.execute(
      makePointsCommand(
        ds.id,
        prevPoints,
        nextPoints,
        `${label}${mode === "replace" ? "替换" : "追加"} (${dataPoints.length} 点)`,
        meta,
        meta,
      ),
    );
    showToast(
      mode === "replace"
        ? t("toast.detectReplace", { n: dataPoints.length })
        : t("toast.detectAppend", { n: dataPoints.length }),
      "success",
    );
  };
  // ========== 导出（/） ==========
  const openExportModal = () => {
    if (!ux.can("openExport")) {
      showToast(trReason(ux.reasonFor("openExport")), "warning");
      return;
    }
    ux.go("openExport");
    setExportSel({
      datasetIds: datasets.map((d) => d.id),
      xColumn: calibConfig.xLabel ?? "",
      yColumn: calibConfig.yLabel ?? "",
      mergeMode: "long",
    });
    setShowExportModal(true);
  };
  const closeExportModal = () => {
    ux.go("closeExport");
    setShowExportModal(false);
  };
  const doExport = async () => {
    const selected = datasets.filter(
      (d) => exportSel.datasetIds.includes(d.id) && d.points.length > 0,
    );
    if (selected.length === 0) {
      showToast(t("toast.selectDataset"), "warning");
      return;
    }
    const options: ExportOptions = {
      format: exportFormat,
      encoding: exportEncoding,
      precision,
      includeHeader,
      includeMetadata, // CSV 元信息注释行开关
      datasetIds: selected.map((d) => d.id),
      xColumn: exportSel.xColumn || undefined,
      yColumn: exportSel.yColumn || undefined,
      mergeMode: exportSel.mergeMode,
    };
    try {
      const ext =
        exportFormat === "xlsx"
          ? "xlsx"
          : exportFormat === "csv"
            ? "csv"
            : "json";
      // 去扩展名；兜底避免原名形如 ".png" 或空串时导出名变成 "_数据.csv"
      const base =
        originalFileName.replace(/\.[^.]+$/, "") ||
        originalFileName ||
        "图表数据";
      const defaultName = base + "_数据." + ext;
      const filePath = await appApi.saveFileDialog(defaultName, [
        { name: exportFormat.toUpperCase(), extensions: [ext] },
      ]);
      if (!filePath) return;
      let success = false;
      const exportMeta = {
        appVersion: APP_VERSION,
        residual: calibResidual,
        totalPoints: selected.reduce((s, d) => s + d.points.length, 0),
        extractedAt: new Date().toISOString(),
      };
      if (exportFormat === "csv") {
        const text = ExportService.buildCSVText(
          selected,
          options,
          calibConfig,
          exportMeta,
        );
        success = await ExportService.saveCSVToFile(
          text,
          filePath,
          exportEncoding,
        );
      } else {
        const blob = await ExportService.export(
          selected,
          options,
          calibConfig,
          exportMeta,
          { colorParams, curveParams, blobParams },
        );
        success = await ExportService.saveBlobToFile(blob, filePath);
      }
      if (success) {
        showToast(t("toast.exported", { path: filePath }), "success");
        closeExportModal();
        setDirty(false);
      } else {
        showToast(t("toast.exportFail"), "error");
      }
    } catch (err) {
      showToast(userError(err, "导出失败"), "error");
    }
  };
  /** 导出前校验——有可疑点先拦截，让用户选择 */
  const handleExport = async () => {
    if (datasets.length === 0 || datasets.every((d) => d.points.length === 0)) {
      showToast(t("toast.noExportData"), "warning");
      return;
    }
    const selected = datasets.filter(
      (d) => exportSel.datasetIds.includes(d.id) && d.points.length > 0,
    );
    if (selected.length === 0) {
      showToast(t("toast.selectDataset"), "warning");
      return;
    }
    if (validationIssues.length > 0) {
      setExportWarning(validationIssues);
      return;
    }
    await doExport();
  };
  /** 移除可疑点后导出（进入撤销栈） */
  const removeIssuesAndExport = () => {
    const issues = exportWarning;
    setExportWarning(null);
    if (!issues || issues.length === 0) {
      void doExport();
      return;
    }
    const byDs = new Map<string, Set<number>>();
    issues.forEach((iss) => {
      if (!byDs.has(iss.dsId)) byDs.set(iss.dsId, new Set());
      byDs.get(iss.dsId)!.add(iss.idx);
    });
    const prevMap = new Map(
      datasets.map((d) => [d.id, d.points.map((p) => ({ x: p.x, y: p.y }))]),
    );
    const nextMap = new Map<string, Array<{ x: number; y: number }>>();
    datasets.forEach((d) => {
      const rm = byDs.get(d.id);
      nextMap.set(
        d.id,
        rm
          ? d.points
              .filter((_, i) => !rm.has(i))
              .map((p) => ({ x: p.x, y: p.y }))
          : d.points.map((p) => ({ x: p.x, y: p.y })),
      );
    });
    const dsIds = datasets.map((d) => d.id);
    undoRedoRef.current.execute({
      execute: () => {
        dsIds.forEach((id) =>
          updateDataset(id, (cur) => ({
            ...cur,
            points: nextMap.get(id)!.map((p) => ({ ...p })),
          })),
        );
      },
      undo: () => {
        dsIds.forEach((id) =>
          updateDataset(id, (cur) => ({
            ...cur,
            points: prevMap.get(id)!.map((p) => ({ ...p })),
          })),
        );
      },
      redo: () => {
        dsIds.forEach((id) =>
          updateDataset(id, (cur) => ({
            ...cur,
            points: nextMap.get(id)!.map((p) => ({ ...p })),
          })),
        );
      },
      description: `移除 ${issues.length} 个可疑点`,
    });
    void doExport();
  };
  // ========== 工程保存/加载（含检测参数） ==========
  const buildProjectData = (): ProjectData => {
    // imageRef 与实际写入 ZIP 的条目名保持一致（扩展名收敛白名单，非法/缺失回退 png）
    const rawExt = originalFileName.split(".").pop()?.toLowerCase() || "";
    const ext = /^(png|jpe?g|bmp|webp|gif|svg)$/i.test(rawExt) ? rawExt : "png";
    return {
      imageRef: `images/original.${ext}`,
      chartType: "xy",
      calibration: calibConfig,
      datasets,
      settings: {
        precision,
        units: { x: calibConfig.xUnit ?? "", y: calibConfig.yUnit ?? "" },
      },
      detection: { colorParams, curveParams, blobParams },
    };
  };
  const doAutosave = async () => {
    if (
      !dirtyRef.current ||
      !imageBlobRef.current ||
      autosaveRunningRef.current
    )
      return;
    // P1-1: 先将当前活动标签页快照同步到 tabs 状态，确保多标签页数据不丢
    const currentSnap = hasWork() ? captureSnapshot() : null;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, snapshot: currentSnap } : tab,
      ),
    );
    autosaveRunningRef.current = true;
    try {
      const zip = await ProjectService.buildProjectZip(
        buildProjectData(),
        imageBlobRef.current,
        originalFileName,
      );
      await appApi.saveAutosave(zip);
    } catch {
      /* 自动保存失败静默，不打断用户 */
    }
    autosaveRunningRef.current = false;
  };
  const handleSaveProject = async () => {
    if (!imageBlob) {
      showToast(t("toast.noSaveData"), "warning");
      return;
    }
    const filePath = await appApi.saveFileDialog(
      (originalFileName || "工程") + ".prj",
      [{ name: "工程文件", extensions: ["prj"] }],
    );
    if (!filePath) return;
    const projectData = buildProjectData();
    const success = await ProjectService.saveProject(
      filePath,
      projectData,
      imageBlob,
      originalFileName,
    );
    if (success) {
      showToast(t("toast.projectSaved"), "success");
      setDirty(false);
      appApi.clearAutosave().catch(() => {});
    } else {
      showToast(t("toast.projectSaveFail"), "error");
    }
  };
  /** 应用已解析的工程（loadProject 与会话恢复共用） */
  const applyLoadedProject = (
    data: ProjectData,
    blob: Blob,
    manifest: ProjectManifest,
  ) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setImage(img);
      setImageBlob(blob);
      setOriginalFileName(manifest.originalFileName);
      const points = data.calibration.points.map((p, i) => ({
        ...p,
        placed: true,
        role: p.role ?? CALIB_ROLES[i]?.role,
      }));
      setCalibConfig({ ...data.calibration, points });
      setDatasets(data.datasets);
      if (data.datasets.length > 0) setActiveDatasetId(data.datasets[0].id);
      setPrecision(data.settings.precision);
      // 恢复检测参数，保证复现性
      if (data.detection) {
        setColorParams(data.detection.colorParams);
        setCurveParams(data.detection.curveParams);
        setBlobParams(data.detection.blobParams);
      }
      const ok = calibrationRef.current.calibrate(data.calibration);
      undoRedoRef.current.clear();
      setCalibResidual(ok ? calibrationRef.current.getResidual() : 0);
      // P1-2: 清空上一工程的派生状态，避免跨工程污染
      setShowMask(false);
      setMaskImageData(null);
      setLastGridResult(null);
      setOverlayVerify(false);
      const tp = data.datasets.reduce((s, d) => s + d.points.length, 0);
      ux.setFacts({
        hasImage: true,
        isCalibrated: ok,
        positionsSet: ok ? 4 : 0,
        valuesEntered: ok ? 4 : 0,
        totalPoints: tp,
      });
      ux.setState(ok ? "CALIBRATED" : "IMAGE_READY"); // 含有效标定 → CALIBRATED，否则回到待标定
      setDirty(false);
      showToast(t("toast.projectLoaded"), "success");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast(t("toast.imageLoadFail2"), "error");
    };
    img.src = url;
  };
  const loadProject = async (filePath: string) => {
    const result = await ProjectService.loadProject(filePath);
    if (!result || !('data' in result)) {
      let msg = t("toast.projectLoadFail");
      if (result && 'errorCode' in result) {
        const ec = result.errorCode;
        if (ec === "MISSING_MANIFEST") msg = t("toast.projectLoadFail.missingManifest");
        else if (ec === "MISSING_PROJECT_JSON") msg = t("toast.projectLoadFail.missingProjectJson");
        else if (ec === "NO_IMAGE") msg = t("toast.projectLoadFail.noImage");
        else if (ec === "IMAGE_READ_FAIL") msg = t("toast.projectLoadFail.imageReadFail");
        else if (ec === "CORRUPT") msg = t("toast.projectLoadFail.corrupt", { msg: result.reason.replace(/^CORRUPT:/, "") });
        else if (ec === "READ_FAIL") msg = t("toast.projectLoadFail.readFail", { msg: result.reason });
      }
      showToast(msg, "error");
      return;
    }
    applyLoadedProject(result.data, result.imageBlob, result.manifest);
    // 打开 .prj 也记录到最近文件（此前只在图片导入时记录）
    const name =
      filePath.split("/").pop() || filePath.split("\\").pop() || filePath;
    appApi.addRecentFile({ path: filePath, name }).catch(() => {});
  };
  /** 打开内置示例工程：程序化生成示例图表、已标定数据，经统一加载链路载入 */
  const openSampleProject = async () => {
    if (hasWork()) {
      const ok = await confirmDialog(t("toast.confirmSampleReplace"));
      if (!ok) return;
    }
    try {
      const sample = await generateSampleProject();
      applyLoadedProject(sample.data, sample.blob, sample.manifest);
      showToast(t("toast.sampleLoaded"), "success");
    } catch (err) {
      showToast(userError(err, "打开示例工程失败"), "error");
    }
  };
  // ========== 撤销/重做 ==========
  const handleUndo = () => undoRedoRef.current.undo();
  const handleRedo = () => undoRedoRef.current.redo();
  // ========== 键盘快捷键 ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void latestRef.current?.handleSaveProject();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        void latestRef.current?.handleImportFile();
      } else if (e.key === "Delete" && activeDataset) {
        if (activeDataset.points.length > 0) {
          const dsId = activeDataset.id;
          const prevPoints = activeDataset.points.map((p) => ({
            x: p.x,
            y: p.y,
          }));
          const nextPoints = prevPoints.slice(0, -1);
          const meta = { ...activeDataset.metadata };
          const command = makePointsCommand(
            dsId,
            prevPoints,
            nextPoints,
            "删除最后一个点",
            meta,
            meta,
          );
          undoRedoRef.current.execute(command);
        }
      } else if (e.key === "F1") {
        e.preventDefault();
        showToast(t("toast.shortcuts"), "info");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataset]);
  // ========== 数据集管理（增删可撤销） ==========
  const addDataset = () => {
    const colors = [
      "#007aff",
      "#ff3b30",
      "#34c759",
      "#5856d6",
      "#ff9500",
      "#af52de",
    ];
    const ds: Dataset = {
      id: generateId(),
      name: nextDatasetName(datasets),
      color: colors[datasets.length % colors.length],
      points: [],
      metadata: { area: null, moment: null },
    };
    setDatasets([...datasets, ds]);
    setActiveDatasetId(ds.id);
    setDirty(true);
    undoRedoRef.current.pushToUndo({
      execute: () => {
        setDatasets((prev) =>
          prev.some((d) => d.id === ds.id) ? prev : [...prev, ds],
        );
        setActiveDatasetId(ds.id);
      },
      undo: () => {
        setDatasets((prev) => prev.filter((d) => d.id !== ds.id));
        setActiveDatasetId((cur) => (cur === ds.id ? null : cur));
      },
      redo: () => {
        setDatasets((prev) =>
          prev.some((d) => d.id === ds.id) ? prev : [...prev, ds],
        );
        setActiveDatasetId(ds.id);
      },
      description: `新增数据集 ${ds.name}`,
    });
  };
  const deleteDataset = async (id: string) => {
    const ds = datasets.find((d) => d.id === id);
    if (!ds) return;
    if (
      ds.points.length > 0 &&
      !(await confirmDialog(
        t("toast.confirmDeleteDataset", { name: ds.name, n: ds.points.length }),
      ))
    )
      return;
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    setActiveDatasetId((cur) =>
      cur === id ? (datasets.find((d) => d.id !== id)?.id ?? null) : cur,
    );
    setDirty(true);
    undoRedoRef.current.pushToUndo({
      execute: () => {
        setDatasets((prev) =>
          prev.some((d) => d.id === id) ? prev : [...prev, ds],
        );
        setActiveDatasetId(id);
      },
      undo: () => {
        setDatasets((prev) => prev.filter((d) => d.id !== id));
        setActiveDatasetId((cur) => (cur === id ? null : cur));
      },
      redo: () => {
        setDatasets((prev) =>
          prev.some((d) => d.id === id) ? prev : [...prev, ds],
        );
        setActiveDatasetId(id);
      },
      description: `删除数据集 ${ds.name}`,
    });
  };
  const deleteLastPoint = () => {
    if (!activeDataset || activeDataset.points.length === 0) return;
    const dsId = activeDataset.id;
    const prevPoints = activeDataset.points.map((p) => ({ x: p.x, y: p.y }));
    const nextPoints = prevPoints.slice(0, -1);
    const meta = { ...activeDataset.metadata };
    const command = makePointsCommand(
      dsId,
      prevPoints,
      nextPoints,
      "删除最后一个点",
      meta,
      meta,
    );
    undoRedoRef.current.execute(command);
  };
  const clearAllPoints = () => {
    if (!activeDataset) return;
    const dsId = activeDataset.id;
    const prevPoints = activeDataset.points.map((p) => ({ x: p.x, y: p.y }));
    const meta = { ...activeDataset.metadata };
    const command = makePointsCommand(
      dsId,
      prevPoints,
      [],
      `清空数据集 ${activeDataset.name}`,
      meta,
      meta,
    );
    undoRedoRef.current.execute(command);
  };
  // ========== 渲染辅助 ==========
  const undoMgr = undoRedoRef.current;
  const canvasDataPoints = useMemo(
    () =>
      datasets.map((ds) => {
        if (!calibrationRef.current.isCalibrated()) {
          return { points: [], color: ds.color };
        }
        return {
          points: ds.points.map((pt) => {
            const pix = calibrationRef.current.dataToPixel(pt.x, pt.y);
            return { x: pix.x, y: pix.y };
          }),
          color: ds.color,
        };
        // calibResidual 作为「标定已变更」的代理依赖，避免 App 无关重渲染时重建数组引用
      }),
    [datasets, calibResidual],
  );
  // 步骤导航高亮/完成态
  const stepActive = {
    import: ux.state === "EMPTY" || ux.state === "IMAGE_READY",
    calibrate: ux.state === "CALIBRATING",
    extract: ux.state === "CALIBRATED" || ux.state === "EXTRACTING",
    export: ux.state === "EXPORTING",
  };
  const stepCompleted = {
    import: image != null,
    calibrate: calibrationRef.current.isCalibrated(),
    extract: totalPoints > 0,
    export: false,
  };
  // 左栏步骤可用性由状态机派生（与顶栏/面板同源）
  const stepUsable = {
    calibrate: ux.can("startCalibrate"),
    extract: ux.can("enterExtract"),
    export: ux.can("openExport"),
  };
  // 上下文提示条（随状态变化，P3）— i18n 国际化
  const HINTS: Record<UXState, string> = {
    EMPTY: t("hint.empty", { formats: FORMAT_HINT }),
    IMAGE_READY: t("hint.imageReady"),
    CALIBRATING:
      calibratePointIndex < 4
        ? t("hint.calibrating", {
            n: String(calibratePointIndex + 1),
            label: t(`calib.${CALIB_ROLES[calibratePointIndex].role}` as never),
          })
        : t("hint.calibrating.done"),
    CALIBRATED: t("hint.calibrated", { residual: calibResidual.toFixed(2) }),
    EXTRACTING: t("hint.extracting"),
    EXPORTING: t("hint.exporting"),
  };
  // 菜单状态已由 Radix DropdownMenu 内部管理（open/onOpenChange），无需 toggleMenu
  // 导出预览中的校验统计
  const issueCounts = useMemo(() => {
    const c = { nan: 0, out: 0, dup: 0 };
    validationIssues.forEach((iss) => c[iss.reason]++);
    return c;
  }, [validationIssues]);
  return (
    <div className="app">
      {/* 标签页栏：与 macOS 红绿灯平齐，圆角矩形标签，下方留间隙不融合 */}
      <div className="tab-bar" onMouseDown={handleWindowDrag}>
        <div className="tab-bar-spacer" data-no-drag="true" />
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
            data-no-drag="true"
            onClick={() => switchTab(tab.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                switchTab(tab.id);
              }
            }}
          >
            <span className="tab-name">{tab.name}</span>
            {tabs.length > 1 && (
              <span
                className="tab-close"
                role="button"
                tabIndex={0}
                aria-label={t("tab.close")}
                onClick={(e) => closeTab(tab.id, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    closeTab(tab.id, e as unknown as ReactMouseEvent);
                  }
                }}
              >
                <XIcon size={12} />
              </span>
            )}
          </div>
        ))}
        <button
          className="tab-add-btn"
          data-no-drag="true"
          onClick={addTab}
          title={t("tab.new")}
          aria-label={t("tab.new")}
        >
          <PlusIcon size={16} />
        </button>
      </div>
      {/* 菜单栏（Radix DropdownMenu：焦点管理、键盘导航、点击外部关闭均内置） */}
      <TooltipProvider delayDuration={400}>
        <div className="menu-bar" onMouseDown={handleWindowDrag}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="menu-item"
                data-no-drag="true"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
              >
                {t("menu.file")}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleImportFile()}>
                {t("menu.file.import")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImportFile(undefined)}>
                {t("menu.file.openProject")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSampleProject()}>
                {t("menu.file.openSample")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSaveProject()}>
                {t("menu.file.saveProject")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {t("menu.file.recentFiles")}
              </DropdownMenuLabel>
              {recentFiles.length === 0 ? (
                <DropdownMenuItem disabled>
                  {t("menu.file.noRecent")}
                </DropdownMenuItem>
              ) : (
                recentFiles.map((f, i) => (
                  <DropdownMenuItem
                    key={i}
                    title={f.path}
                    onClick={() => handleImportFile(f.path)}
                  >
                    {f.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="menu-item"
                data-no-drag="true"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
              >
                {t("menu.edit")}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                disabled={!undoMgr.canUndo()}
                onClick={() => handleUndo()}
              >
                {t("menu.edit.undo")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!undoMgr.canRedo()}
                onClick={() => handleRedo()}
              >
                {t("menu.edit.redo")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!activeDataset}
                onClick={() => clearAllPoints()}
              >
                {t("menu.edit.clearDataset")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="menu-item"
                data-no-drag="true"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
              >
                {t("menu.view")}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => canvasRef.current?.zoomToFit()}>
                {t("menu.view.zoomFit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowMask((m) => !m)}>
                {showMask ? "✓ " : ""}
                {t("menu.view.showMask")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="menu-item"
                data-no-drag="true"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
              >
                {t("menu.tools")}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setColorPickMode((m) => !m)}>
                {colorPickMode ? "✓ " : ""}
                {t("menu.tools.colorPick")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runGridDetection()}>
                {t("menu.tools.gridDetect")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOverlayVerify((v) => !v)}>
                {overlayVerify ? "✓ " : ""}
                {t("detect.overlayVerify")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setBatchState({
                    running: false,
                    inputDir: "",
                    outputDir: "",
                    files: [],
                    currentIdx: 0,
                    okCount: 0,
                  })
                }
              >
                {t("batch.title")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="menu-item"
                data-no-drag="true"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
              >
                {t("menu.help")}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => showToast(t("toast.shortcuts"), "info")}
              >
                {t("menu.help.shortcuts")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowAbout(true)}>
                {t("menu.help.about")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="menu-bar-spacer" />
          {/* 语言切换（中/英） */}
          <div className="lang-toggle" data-no-drag="true" role="radiogroup" aria-label="Language">
            <button
              className={`lang-toggle-option ${lang === "zh" ? "active" : ""}`}
              role="radio"
              aria-checked={lang === "zh"}
              onClick={() => setLang("zh")}
              title="中文"
              aria-label="中文"
            >
              中
            </button>
            <button
              className={`lang-toggle-option ${lang === "en" ? "active" : ""}`}
              role="radio"
              aria-checked={lang === "en"}
              onClick={() => setLang("en")}
              title="English"
              aria-label="English"
            >
              EN
            </button>
          </div>
          {/* 主题切换（浅/深/系统） */}
          <div
            className="theme-toggle"
            data-no-drag="true"
            role="radiogroup"
            aria-label={t("menu.theme")}
          >
            <button
              className={`theme-toggle-option ${theme === "light" ? "active" : ""}`}
              role="radio"
              aria-checked={theme === "light"}
              onClick={() => setTheme("light")}
              title={t("theme.light")}
              aria-label={t("theme.light")}
            >
              <SunIcon size={14} /> {t("theme.light")}
            </button>
            <button
              className={`theme-toggle-option ${theme === "dark" ? "active" : ""}`}
              role="radio"
              aria-checked={theme === "dark"}
              onClick={() => setTheme("dark")}
              title={t("theme.dark")}
              aria-label={t("theme.dark")}
            >
              <MoonIcon size={14} /> {t("theme.dark")}
            </button>
            <button
              className={`theme-toggle-option ${theme === "system" ? "active" : ""}`}
              role="radio"
              aria-checked={theme === "system"}
              onClick={() => setTheme("system")}
              title={t("theme.system")}
              aria-label={t("theme.system")}
            >
              <MonitorIcon size={14} /> {t("theme.system")}
            </button>
          </div>
        </div>
      </TooltipProvider>
      {/* Ribbon 功能区（精简：仅保留核心流程按钮，撤销/重做/保存等收至菜单） */}
      <div className="ribbon" onMouseDown={handleWindowDrag}>
        <div className="ribbon-group" data-no-drag="true">
          <button
            className="ribbon-btn"
            onClick={() => handleImportFile()}
            title="⌘O"
            aria-label={t("ribbon.import")}
          >
            <span className="icon">
              <UploadIcon size={15} />
            </span>
            <span className="label">{t("ribbon.import")}</span>
          </button>
          <button
            className="ribbon-btn"
            onClick={() => {
              if (ux.can("startCalibrate")) startCalibration();
              else
                showToast(trReason(ux.reasonFor("startCalibrate")), "warning");
            }}
            disabled={!ux.can("startCalibrate")}
            title={t("ribbon.calibrate")}
            aria-label={t("ribbon.calibrate")}
          >
            <span className="icon">
              <CrosshairIcon size={15} />
            </span>
            <span className="label">{t("ribbon.calibrate")}</span>
          </button>
          <button
            className="ribbon-btn"
            onClick={() => {
              if (ux.can("enterExtract")) ux.go("enterExtract");
              else showToast(trReason(ux.reasonFor("enterExtract")), "warning");
            }}
            disabled={!ux.can("enterExtract")}
            title={t("ribbon.extract")}
            aria-label={t("ribbon.extract")}
          >
            <span className="icon">
              <PenLineIcon size={15} />
            </span>
            <span className="label">{t("ribbon.extract")}</span>
          </button>
          <button
            className="ribbon-btn"
            onClick={openExportModal}
            disabled={!ux.can("openExport")}
            title={t("ribbon.export")}
            aria-label={t("ribbon.export")}
          >
            <span className="icon">
              <DownloadIcon size={15} />
            </span>
            <span className="label">{t("ribbon.export")}</span>
          </button>
        </div>
        <div className="ribbon-group" data-no-drag="true">
          <button
            className="ribbon-btn"
            onClick={handleSaveProject}
            disabled={!image}
            title="⌘S"
            aria-label={t("ribbon.save")}
          >
            <span className="icon">
              <SaveIcon size={15} />
            </span>
            <span className="label">{t("ribbon.save")}</span>
          </button>
          <button
            className="ribbon-btn"
            onClick={handleUndo}
            disabled={!undoMgr.canUndo()}
            title="⌘Z"
            aria-label={t("ribbon.undo")}
          >
            <span className="icon">
              <UndoIcon size={15} />
            </span>
            <span className="label">{t("ribbon.undo")}</span>
          </button>
          <button
            className="ribbon-btn"
            onClick={handleRedo}
            disabled={!undoMgr.canRedo()}
            title="⇧⌘Z"
            aria-label={t("ribbon.redo")}
          >
            <span className="icon">
              <RedoIcon size={15} />
            </span>
            <span className="label">{t("ribbon.redo")}</span>
          </button>
        </div>
      </div>
      {/* 主内容区 */}
      <div className="main-content">
        {/* 左侧向导导航（可用性由 ux.can 派生） */}
        <div className="wizard-nav" style={{ width: leftWidth }}>
          <div
            className={`wizard-step ${stepActive.import ? "active" : ""} ${stepCompleted.import ? "completed" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => handleImportFile()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleImportFile();
              }
            }}
          >
            <div className="step-number">
              {stepCompleted.import ? <CheckIcon size={12} /> : "1"}
            </div>
            <div className="step-info">
              <div className="step-title">{t("wizard.import")}</div>
            </div>
          </div>
          <div
            className={`wizard-step ${stepActive.calibrate ? "active" : ""} ${stepCompleted.calibrate ? "completed" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (ux.can("startCalibrate")) startCalibration();
              else
                showToast(trReason(ux.reasonFor("startCalibrate")), "warning");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (ux.can("startCalibrate")) startCalibration();
                else
                  showToast(
                    trReason(ux.reasonFor("startCalibrate")),
                    "warning",
                  );
              }
            }}
            style={{ opacity: stepUsable.calibrate ? 1 : 0.4 }}
          >
            <div className="step-number">
              {stepCompleted.calibrate ? <CheckIcon size={12} /> : "2"}
            </div>
            <div className="step-info">
              <div className="step-title">{t("wizard.calibrate")}</div>
            </div>
          </div>
          <div
            className={`wizard-step ${stepActive.extract ? "active" : ""} ${stepCompleted.extract ? "completed" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (ux.can("enterExtract")) ux.go("enterExtract");
              else showToast(trReason(ux.reasonFor("enterExtract")), "warning");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (ux.can("enterExtract")) ux.go("enterExtract");
                else
                  showToast(trReason(ux.reasonFor("enterExtract")), "warning");
              }
            }}
            style={{ opacity: stepUsable.extract ? 1 : 0.4 }}
          >
            <div className="step-number">
              {stepCompleted.extract ? <CheckIcon size={12} /> : "3"}
            </div>
            <div className="step-info">
              <div className="step-title">{t("wizard.extract")}</div>
            </div>
          </div>
          <div
            className={`wizard-step ${stepActive.export ? "active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={openExportModal}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openExportModal();
              }
            }}
            style={{ opacity: stepUsable.export ? 1 : 0.4 }}
          >
            <div className="step-number">4</div>
            <div className="step-info">
              <div className="step-title">{t("wizard.export")}</div>
            </div>
          </div>
          {recentFiles.length > 0 && (
            <>
              <div className="wizard-section-title">
                {t("wizard.recentFiles")}
              </div>
              {recentFiles.map((f, i) => (
                <div
                  key={i}
                  className="recent-file-item"
                  role="button"
                  tabIndex={0}
                  title={f.path}
                  onClick={() => handleImportFile(f.path)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleImportFile(f.path);
                    }
                  }}
                >
                  {f.name}
                </div>
              ))}
            </>
          )}
        </div>
        {/* 拖拽调整左侧面板宽度 */}
        <div
          className={`resizer resizer-left${leftDragging ? " dragging" : ""}`}
          onMouseDown={startResize("left")}
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          aria-label={t("a11y.resizeLeft")}
          aria-valuenow={leftWidth}
          aria-valuemin={LEFT_MIN}
          aria-valuemax={LEFT_MAX}
          title={t("a11y.resizeLeft")}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              const n = Math.min(LEFT_MAX, Math.max(LEFT_MIN, leftWidth - 8));
              setLeftWidth(n);
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              const n = Math.min(LEFT_MAX, Math.max(LEFT_MIN, leftWidth + 8));
              setLeftWidth(n);
            }
          }}
        />
        {/* 画布区 */}
        <div className="canvas-col">
          <div className="hint-bar" aria-live="polite">
            <span className="hint-icon">
              <LightbulbIcon size={14} />
            </span>
            <span className="hint-text">{HINTS[ux.state]}</span>
            {ux.blockReason && (
              <span className="hint-warn">
                <AlertTriangleIcon size={14} /> {trReason(ux.blockReason)}
              </span>
            )}
          </div>
          {detectionState.running && (
            <div
              className="detection-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(detectionState.progress * 100)}
              aria-label={t("detect.progressLabel")}
            >
              <span>
                {detectionState.running === "curve"
                  ? t("toast.curveStart")
                  : detectionState.running === "blob"
                    ? t("detect.blobDetect")
                    : t("detect.detectGrid")}
                … {Math.round(detectionState.progress * 100)}%
              </span>
              <button
                className="panel-btn"
                onClick={() => {
                  cancelDetectionRef.current = true;
                }}
              >
                {t("detect.cancel")} {/* 取消按钮文案不再复用「丢弃」 */}
              </button>
            </div>
          )}
          <ChartCanvas
            ref={canvasRef}
            image={image}
            calibrationPoints={calibConfig.points}
            dataPoints={canvasDataPoints}
            calibrating={ux.state === "CALIBRATING"}
            calibratePointIndex={calibratePointIndex}
            showDataPoints={
              ux.state === "CALIBRATED" ||
              ux.state === "EXTRACTING" ||
              ux.state === "EXPORTING"
            }
            onCanvasClick={handleCanvasClick}
            onCanvasRightClick={handleCanvasRightClick}
            onCanvasPointMove={handleCanvasPointMove}
            onColorPick={handleColorPick}
            colorPickMode={colorPickMode}
            maskImageData={maskImageData}
            showMask={showMask}
            pixelToData={(px, py) =>
              calibrationRef.current.isCalibrated()
                ? calibrationRef.current.pixelToData(px, py)
                : null
            }
            showDataReadout={calibrationRef.current.isCalibrated()}
            precision={precision}
            previewPixelPoints={detectionPreview?.pixelPoints ?? null}
            previewColor={
              detectionPreview?.kind === "blob" ? "#ff375f" : "#ff9500"
            }
            // 叠加校验真正接管数据点渲染
            overlayStyle={overlayVerify ? "translucent" : "solid"}
          />
        </div>
        {/* 拖拽调整右侧面板宽度（空状态时一同隐藏） */}
        {!image ? null : (
          <div
            className={`resizer resizer-right${rightDragging ? " dragging" : ""}`}
            onMouseDown={startResize("right")}
            role="separator"
            aria-orientation="vertical"
            tabIndex={0}
            aria-label={t("a11y.resizeRight")}
            aria-valuenow={rightWidth}
            aria-valuemin={RIGHT_MIN}
            aria-valuemax={RIGHT_MAX}
            title={t("a11y.resizeRight")}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                const n = Math.min(
                  RIGHT_MAX,
                  Math.max(RIGHT_MIN, rightWidth + 8),
                );
                setRightWidth(n);
              }
              if (e.key === "ArrowRight") {
                e.preventDefault();
                const n = Math.min(
                  RIGHT_MAX,
                  Math.max(RIGHT_MIN, rightWidth - 8),
                );
                setRightWidth(n);
              }
            }}
          />
        )}
        {/* 右侧属性面板（空状态时隐藏，让视线集中在中间拖拽区） */}
        <div
          className={`properties-panel${!image ? " empty-hidden" : ""}`}
          style={{ width: rightWidth }}
        >
          {/* 导入面板 */}
          {panel === "import" && (
            <div className="panel-section">
              <div className="panel-title">{t("panel.import.title")}</div>
              <div className="help-text" style={{ marginBottom: 12 }}>
                {image
                  ? t("panel.import.help.withImage")
                  : t("panel.import.help.noImage")}
              </div>
              <button
                className="panel-btn primary full"
                onClick={() => handleImportFile()}
                style={{ marginBottom: 8 }}
              >
                {image
                  ? t("panel.import.changeImage")
                  : t("panel.import.openFile")}
              </button>
              {!image && (
                <button
                  className="panel-btn full"
                  onClick={() => openSampleProject()}
                  style={{ marginBottom: 8 }}
                >
                  {t("panel.import.openSample")}
                </button>
              )}
              {!image && (
                <div className="help-text" style={{ marginTop: 8 }}>
                  {t("panel.import.help.drag")}
                  <br />
                  {t("panel.import.help.paste")}
                  <br />
                  {t("panel.import.help.formats", { formats: FORMAT_HINT })}
                  <br />
                  {t("panel.import.help.pdfPages")}
                  <br />
                  {t("panel.import.help.sample")}
                </div>
              )}
              {image && (
                <button
                  className="panel-btn full"
                  onClick={() => {
                    if (ux.can("startCalibrate")) startCalibration();
                    else
                      showToast(
                        trReason(ux.reasonFor("startCalibrate")),
                        "warning",
                      );
                  }}
                  style={{ marginTop: 8 }}
                >
                  {t("panel.import.startCalibrate")}
                </button>
              )}
              {pdfState && pdfState.numPages > 1 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    className="panel-title"
                    style={{ fontSize: 12, marginBottom: 6 }}
                  >
                    {t("panel.import.pdfPages")}
                  </div>
                  <div className="dataset-tabs">
                    {Array.from(
                      { length: pdfState.numPages },
                      (_, i) => i + 1,
                    ).map((p) => (
                      <div
                        key={p}
                        className="dataset-tab"
                        role="button"
                        tabIndex={0}
                        onClick={() => importPdfPage(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            importPdfPage(p);
                          }
                        }}
                      >
                        {t("panel.import.pdfPage", { n: p })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* 标定面板（合一交互、轴元数据、说明） */}
          {panel === "calibrate" && (
            <>
              <div className="step-guide">
                <span className="guide-icon">
                  <CrosshairIcon size={20} />
                </span>
                <span className="guide-text">
                  {calibratePointIndex < 4
                    ? t("guide.calibrate.title", {
                        n: String(calibratePointIndex + 1),
                        label:
                          calibConfig.points[calibratePointIndex]?.label ?? "",
                      })
                    : t("guide.calibrate.done")}
                  <span className="sub">
                    {t("guide.calibrate.sub", {
                      placed: String(calibratePointIndex),
                      values: String(valuesEntered),
                    })}
                  </span>
                </span>
              </div>
              <div className="panel-section">
                <div className="panel-title">{t("panel.calibrate.title")}</div>
                <div className="panel-row">
                  <span className="panel-label" aria-hidden="true">
                    {t("panel.calibrate.xScaleType")}
                  </span>
                  <select
                    className="panel-select"
                    aria-label={t("panel.calibrate.xScaleType")}
                    value={calibConfig.scaleX}
                    onChange={(e) => {
                      setCalibConfig((prev) => ({
                        ...prev,
                        scaleX: e.target.value as "linear" | "log",
                      }));
                      setDirty(true);
                    }}
                  >
                    <option value="linear">
                      {t("panel.calibrate.linear")}
                    </option>
                    <option value="log">{t("panel.calibrate.log")}</option>
                  </select>
                </div>
                <div className="panel-row">
                  <span className="panel-label" aria-hidden="true">
                    {t("panel.calibrate.yScaleType")}
                  </span>
                  <select
                    className="panel-select"
                    aria-label={t("panel.calibrate.yScaleType")}
                    value={calibConfig.scaleY}
                    onChange={(e) => {
                      setCalibConfig((prev) => ({
                        ...prev,
                        scaleY: e.target.value as "linear" | "log",
                      }));
                      setDirty(true);
                    }}
                  >
                    <option value="linear">
                      {t("panel.calibrate.linear")}
                    </option>
                    <option value="log">{t("panel.calibrate.log")}</option>
                  </select>
                </div>
                <div className="panel-row">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={calibConfig.noRotation}
                      onChange={(e) => {
                        setCalibConfig((prev) => ({
                          ...prev,
                          noRotation: e.target.checked,
                        }));
                        setDirty(true);
                      }}
                    />
                    {t("panel.calibrate.snap")}
                  </label>
                </div>
                <div className="help-text" style={{ marginTop: 8 }}>
                  {t("panel.calibrate.help")}
                </div>
              </div>
              <div className="panel-section">
                <div className="panel-title">
                  {t("panel.calibrate.pointsTitle")}
                </div>
                {calibConfig.points.map((pt, i) => {
                  const axis =
                    pt.role === "xmin" || pt.role === "xmax" ? "x" : "y";
                  const val = axis === "x" ? pt.dx : pt.dy;
                  return (
                    <div key={i} className="calib-point-row">
                      <span className="point-label">
                        P{i + 1} {t(pt.label as never)}
                      </span>
                      <input
                        ref={(el) => {
                          valueInputRefs.current[i] = el;
                        }}
                        className="panel-input"
                        type="number"
                        placeholder={t("panel.calibrate.placeholder")}
                        value={val ?? ""}
                        onChange={(e) => setPointValue(i, axis, e.target.value)}
                      />
                      <span
                        className={`point-state ${pt.placed ? "set" : "unset"}`}
                      >
                        {pt.placed ? (
                          <CheckIcon size={12} />
                        ) : (
                          <CircleIcon size={12} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="panel-section">
                <div className="panel-title">
                  {t("panel.calibrate.axisMeta")}
                </div>
                <div className="panel-row">
                  <span className="panel-label" aria-hidden="true">
                    {t("panel.calibrate.xLabel")}
                  </span>
                  <input
                    className="panel-input"
                    placeholder=""
                    aria-label={t("panel.calibrate.xLabel")}
                    value={calibConfig.xLabel ?? ""}
                    onChange={(e) => {
                      setCalibConfig((prev) => ({
                        ...prev,
                        xLabel: e.target.value,
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="panel-row">
                  <span className="panel-label" aria-hidden="true">
                    {t("panel.calibrate.xUnit")}
                  </span>
                  <input
                    className="panel-input"
                    placeholder=""
                    aria-label={t("panel.calibrate.xUnit")}
                    value={calibConfig.xUnit ?? ""}
                    onChange={(e) => {
                      setCalibConfig((prev) => ({
                        ...prev,
                        xUnit: e.target.value,
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="panel-row">
                  <span className="panel-label" aria-hidden="true">
                    {t("panel.calibrate.yLabel")}
                  </span>
                  <input
                    className="panel-input"
                    placeholder=""
                    aria-label={t("panel.calibrate.yLabel")}
                    value={calibConfig.yLabel ?? ""}
                    onChange={(e) => {
                      setCalibConfig((prev) => ({
                        ...prev,
                        yLabel: e.target.value,
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="panel-row">
                  <span className="panel-label" aria-hidden="true">
                    {t("panel.calibrate.yUnit")}
                  </span>
                  <input
                    className="panel-input"
                    placeholder=""
                    aria-label={t("panel.calibrate.yUnit")}
                    value={calibConfig.yUnit ?? ""}
                    onChange={(e) => {
                      setCalibConfig((prev) => ({
                        ...prev,
                        yUnit: e.target.value,
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="help-text">{t("panel.calibrate.axisHelp")}</div>
              </div>
              <div className="panel-section">
                <button
                  className="panel-btn primary full"
                  onClick={commitCalibration}
                  disabled={calibratePointIndex < 4 || valuesEntered < 4}
                >
                  {calibratePointIndex < 4
                    ? t("panel.calibrate.calibrating", {
                        n: String(calibratePointIndex),
                      })
                    : t("panel.calibrate.commit")}
                </button>
                <button
                  className="panel-btn full"
                  onClick={cancelCalibration}
                  style={{ marginTop: 8 }}
                >
                  {t("panel.calibrate.cancel")}
                </button>
                <button
                  className="panel-btn full"
                  onClick={startCalibration}
                  style={{ marginTop: 8 }}
                >
                  {t("panel.calibrate.reset")}
                </button>
              </div>
            </>
          )}
          {/* 取点面板（折叠分组） */}
          {panel === "extract" && (
            <>
              <div className="step-guide">
                <span className="guide-icon">
                  <PenLineIcon size={20} />
                </span>
                <span className="guide-text">
                  {t("guide.extract.title")}
                  <span className="sub">{t("guide.extract.sub")}</span>
                </span>
              </div>
              <Section title={t("panel.extract.calibInfo")}>
                <button
                  className="panel-btn full"
                  onClick={recalibrate}
                  style={{ marginBottom: 8 }}
                >
                  {t("panel.extract.recalibrate")}
                </button>
                {calibrationRef.current.isCalibrated() && (
                  <div className="help-text">
                    {t("status.residual", { val: calibResidual.toFixed(2) })}{" "}
                    {calibResidual > 2
                      ? t("panel.extract.residual.bad")
                      : t("panel.extract.residual.good")}
                  </div>
                )}
              </Section>
              <div className="panel-section">
                <div className="panel-title">{t("panel.extract.datasets")}</div>
                <div className="dataset-tabs">
                  {datasets.map((ds) => (
                    <div
                      key={ds.id}
                      className={`dataset-tab ${ds.id === activeDatasetId ? "active" : ""}`}
                      onClick={() => setActiveDatasetId(ds.id)}
                    >
                      <span
                        className="dataset-color-dot"
                        style={{ background: ds.color }}
                      />
                      {ds.name} ({ds.points.length})
                      <span
                        className="dataset-tab-close"
                        role="button"
                        tabIndex={0}
                        title={t("dataset.delete", { name: ds.name })}
                        aria-label={t("dataset.delete", { name: ds.name })}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDataset(ds.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteDataset(ds.id);
                          }
                        }}
                      >
                        <XIcon size={10} />
                      </span>
                    </div>
                  ))}
                </div>
                <button className="panel-btn full" onClick={addDataset}>
                  {t("panel.extract.addDataset")}
                </button>
              </div>
              {activeDataset && (
                <Section title={t("panel.extract.manualPick")}>
                  <div className="panel-row">
                    <button
                      className="panel-btn"
                      onClick={deleteLastPoint}
                      disabled={activeDataset.points.length === 0}
                    >
                      {t("panel.extract.deleteLast")}
                    </button>
                    <button
                      className="panel-btn"
                      onClick={clearAllPoints}
                      disabled={activeDataset.points.length === 0}
                    >
                      {t("panel.extract.clear")}
                    </button>
                  </div>
                </Section>
              )}
              <Section
                title={t("panel.extract.autoDetect")}
                defaultOpen={false}
              >
                <div className="panel-section-inner">
                  <div className="detect-intro">{t("detect.intro")}</div>
                  <div className="detect-flow">
                    <div className="detect-flow-step">
                      <b>{t("detect.flow.pickColor")}</b>
                      {t("detect.flow.pickColor.desc")}
                    </div>
                    <span className="detect-flow-arrow">→</span>
                    <div className="detect-flow-step">
                      <b>{t("detect.flow.genMask")}</b>
                      {t("detect.flow.genMask.desc")}
                    </div>
                    <span className="detect-flow-arrow">→</span>
                    <div className="detect-flow-step">
                      <b>{t("detect.flow.track")}</b>
                      {t("detect.flow.track.desc")}
                    </div>
                  </div>
                  {/* ===== 颜色分割 ===== */}
                  <div className="detect-group-title">
                    <span className="dot" />
                    <span>
                      {t("detect.colorSeg")}
                      <span className="sub">{t("detect.colorSeg.sub")}</span>
                    </span>
                  </div>
                  <div className="detect-tip">{t("detect.colorSeg.tip")}</div>
                  <div className="panel-row" style={{ marginTop: 10 }}>
                    <span className="panel-label">{t("detect.fgColor")}</span>
                    <div className="color-display">
                      <div
                        className="color-swatch"
                        style={{
                          background: `rgb(${colorParams.fgColor.join(",")})`,
                        }}
                      />
                      <button
                        className="panel-btn"
                        onClick={() => setColorPickMode((m) => !m)}
                      >
                        {colorPickMode
                          ? t("detect.cancelPick")
                          : t("detect.pick")}
                      </button>
                    </div>
                  </div>
                  <div className="detect-tip">{t("detect.pickTip")}</div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <span className="panel-label" aria-hidden="true">
                      {t("detect.mode")}
                    </span>
                    <select
                      className="panel-select"
                      aria-label={t("detect.mode")}
                      value={colorParams.mode}
                      onChange={(e) => {
                        setColorParams((prev) => ({
                          ...prev,
                          mode: e.target.value as "foreground" | "background",
                        }));
                        setDirty(true);
                      }}
                    >
                      <option value="foreground">{t("detect.mode.fg")}</option>
                      <option value="background">{t("detect.mode.bg")}</option>
                    </select>
                  </div>
                  <div className="detect-tip">
                    <b>{t("detect.mode.fg")}</b>：{t("detect.mode.fg.desc")}
                    <br />
                    <b>{t("detect.mode.bg")}</b>：{t("detect.mode.bg.desc")}
                  </div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <span className="panel-label" aria-hidden="true">
                      {t("detect.tolerance")}
                    </span>
                    {/* 不再叠加 .panel-slider（遗留原生 range 规则），避免容器套上灰底 */}
                    <Slider
                      aria-label={t("detect.tolerance")}
                      min={0}
                      max={255}
                      value={[colorParams.colorDistance]}
                      onValueChange={(v) => {
                        setColorParams((prev) => ({
                          ...prev,
                          colorDistance: v[0],
                        }));
                        setDirty(true);
                      }}
                    />
                    <span className="slider-value">
                      {colorParams.colorDistance}
                    </span>
                  </div>
                  <div className="detect-tip">{t("detect.tolerance.tip")}</div>
                  {/* 实时掩码预览 */}
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={liveMaskPreview}
                        onChange={(e) => setLiveMaskPreview(e.target.checked)}
                      />
                      {t("detect.livePreview")}
                    </label>
                  </div>
                  <div className="detect-tip">
                    {t("detect.livePreview.tip")}
                  </div>
                  {/* ===== 曲线自动追踪 ===== */}
                  <div className="detect-group-title">
                    <span className="dot" />
                    <span>
                      {t("detect.curveTrack")}
                      <span className="sub">{t("detect.curveTrack.sub")}</span>
                    </span>
                  </div>
                  <div className="detect-tip">{t("detect.curveTrack.tip")}</div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <span className="panel-label" aria-hidden="true">
                      {t("detect.xStep")}
                    </span>
                    <input
                      className="panel-input"
                      aria-label={t("detect.xStep")}
                      type="number"
                      value={curveParams.xStep}
                      onChange={(e) => {
                        setCurveParams((prev) => ({
                          ...prev,
                          xStep: Math.max(1, parseInt(e.target.value) || 10),
                        }));
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="detect-tip">{t("detect.xStep.tip")}</div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <span className="panel-label" aria-hidden="true">
                      {t("detect.yStep")}
                    </span>
                    <input
                      className="panel-input"
                      aria-label={t("detect.yStep")}
                      type="number"
                      value={curveParams.yStep}
                      onChange={(e) => {
                        setCurveParams((prev) => ({
                          ...prev,
                          yStep: Math.max(1, parseInt(e.target.value) || 10),
                        }));
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="detect-tip">{t("detect.yStep.tip")}</div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={curveParams.smoothing}
                        onChange={(e) => {
                          setCurveParams((prev) => ({
                            ...prev,
                            smoothing: e.target.checked,
                          }));
                          setDirty(true);
                        }}
                      />
                      {t("detect.smoothing")}
                    </label>
                  </div>
                  <div className="detect-tip">{t("detect.smoothing.tip")}</div>
                  <button
                    className="panel-btn primary full"
                    onClick={runCurveTracking}
                    style={{ marginTop: 8 }}
                  >
                    {t("detect.trackCurve")}
                  </button>
                  {/* ===== 散点自动检测 ===== */}
                  <div className="detect-group-title">
                    <span className="dot" />
                    <span>
                      {t("detect.blobDetect")}
                      <span className="sub">{t("detect.blobDetect.sub")}</span>
                    </span>
                  </div>
                  <div className="detect-tip">{t("detect.blobDetect.tip")}</div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <span className="panel-label" aria-hidden="true">
                      {t("detect.minDiameter")}
                    </span>
                    <input
                      className="panel-input"
                      aria-label={t("detect.minDiameter")}
                      type="number"
                      value={blobParams.minDiameter}
                      onChange={(e) => {
                        setBlobParams((prev) => ({
                          ...prev,
                          minDiameter: parseFloat(e.target.value) || 0,
                        }));
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="detect-tip">
                    {t("detect.minDiameter.tip")}
                  </div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <span className="panel-label" aria-hidden="true">
                      {t("detect.maxDiameter")}
                    </span>
                    <input
                      className="panel-input"
                      aria-label={t("detect.maxDiameter")}
                      type="number"
                      value={blobParams.maxDiameter}
                      onChange={(e) => {
                        setBlobParams((prev) => ({
                          ...prev,
                          maxDiameter: parseFloat(e.target.value) || 50,
                        }));
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="detect-tip">
                    {t("detect.maxDiameter.tip")}
                  </div>
                  <button
                    className="panel-btn primary full"
                    onClick={runBlobDetection}
                    style={{ marginTop: 8 }}
                  >
                    {t("detect.detectBlob")}
                  </button>
                  {/* ===== 网格线识别 ===== */}
                  <div className="detect-group-title">
                    <span className="dot" />
                    <span>
                      {t("detect.gridDetect")}
                      <span className="sub">{t("detect.gridDetect.sub")}</span>
                    </span>
                  </div>
                  <div className="detect-tip">{t("detect.gridDetect.tip")}</div>
                  <div style={{ marginTop: 8 }}>
                    <label
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span>{t("detect.gridThreshold")}</span>
                      <span>{(gridParams.xFrac * 100).toFixed(0)}%</span>
                    </label>
                    <input
                      type="range"
                      min={0.02}
                      max={0.5}
                      step={0.01}
                      value={gridParams.xFrac}
                      onChange={(e) =>
                        setGridParams((prev) => ({
                          ...prev,
                          xFrac: parseFloat(e.target.value),
                          yFrac: parseFloat(e.target.value),
                        }))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>
                  <button
                    className="panel-btn primary full"
                    onClick={runGridDetection}
                    style={{ marginTop: 8 }}
                  >
                    {t("detect.detectGrid")}
                  </button>
                  {/* 去除网格伪点 */}
                  <div className="detect-tip" style={{ marginTop: 8 }}>
                    {t("detect.removeGridNoise.tip")}
                  </div>
                  <button
                    className="panel-btn full"
                    onClick={handleRemoveGridNoise}
                    disabled={!lastGridResult || !activeDataset}
                    style={{ marginTop: 4 }}
                  >
                    {t("detect.removeGridNoise")}
                  </button>
                  {/* 多曲线分离 */}
                  <div className="detect-group-title" style={{ marginTop: 12 }}>
                    <span className="dot" />
                    <span>
                      {t("detect.multiCurve")}
                      <span className="sub" />
                    </span>
                  </div>
                  <div className="detect-tip">{t("detect.multiCurve.tip")}</div>
                  <button
                    className="panel-btn primary full"
                    onClick={handleMultiCurveExtract}
                    style={{ marginTop: 8 }}
                  >
                    {t("detect.multiCurve.extract")}
                  </button>
                  {/* 按颜色分拣散点 */}
                  <div className="detect-group-title" style={{ marginTop: 12 }}>
                    <span className="dot" />
                    <span>
                      {t("detect.blobColorCluster")}
                      <span className="sub" />
                    </span>
                  </div>
                  <div className="detect-tip">
                    {t("detect.blobColorCluster.tip")}
                  </div>
                  <button
                    className="panel-btn primary full"
                    onClick={handleBlobColorCluster}
                    style={{ marginTop: 8 }}
                  >
                    {t("detect.clusterToDatasets")}
                  </button>
                  {/* 叠加校验 */}
                  <div className="detect-group-title" style={{ marginTop: 12 }}>
                    <span className="dot" />
                    <span>
                      {t("detect.overlayVerify")}
                      <span className="sub" />
                    </span>
                  </div>
                  <div className="detect-tip">
                    {t("detect.overlayVerify.tip")}
                  </div>
                  <div className="panel-row" style={{ marginTop: 8 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={overlayVerify}
                        onChange={(e) => setOverlayVerify(e.target.checked)}
                      />
                      {overlayVerify
                        ? t("detect.overlayOn")
                        : t("detect.overlayOff")}
                    </label>
                  </div>
                </div>
              </Section>
              {activeDataset && (
                <Section
                  title={t("panel.extract.dataTable", {
                    n: activeDataset.points.length,
                  })}
                  badge={issueSet.size > 0 ? `⚠ ${issueSet.size}` : undefined}
                >
                  <div className="help-text" style={{ marginBottom: 8 }}>
                    {t("panel.extract.tableHint")}
                  </div>
                  <div className="data-preview tall">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>X</th>
                          <th>Y</th>
                          <th className="col-action">{t("table.colAction")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDataset.points.map((pt, i) => (
                          <tr
                            key={i}
                            className={
                              issueSet.has(`${activeDataset.id}:${i}`)
                                ? "issue"
                                : ""
                            }
                          >
                            <td className="idx">{i + 1}</td>
                            <td>
                              <input
                                className="table-cell-input"
                                type="number"
                                step={Math.pow(10, -Math.min(precision, 6))}
                                value={Number.isFinite(pt.x) ? pt.x : ""}
                                onFocus={() =>
                                  beginPointEdit(activeDataset.id, i, "x", pt.x)
                                }
                                onChange={(e) =>
                                  changePointValue(
                                    activeDataset.id,
                                    i,
                                    "x",
                                    e.target.value,
                                  )
                                }
                                onBlur={commitPointEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    (e.target as HTMLInputElement).blur();
                                }}
                                aria-label={t("table.cellX", { n: i + 1 })}
                              />
                            </td>
                            <td>
                              <input
                                className="table-cell-input"
                                type="number"
                                step={Math.pow(10, -Math.min(precision, 6))}
                                value={Number.isFinite(pt.y) ? pt.y : ""}
                                onFocus={() =>
                                  beginPointEdit(activeDataset.id, i, "y", pt.y)
                                }
                                onChange={(e) =>
                                  changePointValue(
                                    activeDataset.id,
                                    i,
                                    "y",
                                    e.target.value,
                                  )
                                }
                                onBlur={commitPointEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    (e.target as HTMLInputElement).blur();
                                }}
                                aria-label={t("table.cellY", { n: i + 1 })}
                              />
                            </td>
                            <td className="col-action">
                              <button
                                className="table-cell-btn"
                                onClick={() => copyPoint(activeDataset.id, i)}
                                title={t("table.copyTip")}
                                aria-label={t("table.copyPoint", { n: i + 1 })}
                              >
                                <CopyIcon size={13} />
                              </button>
                              <button
                                className="table-cell-btn"
                                onClick={() =>
                                  deletePointAt(activeDataset.id, i)
                                }
                                title={t("ctx.deletePoint")}
                                aria-label={t("table.deletePoint", {
                                  n: i + 1,
                                })}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}
            </>
          )}
          {/* 导出面板（只读汇总，控件仅存于弹窗) */}
          {panel === "export" && (
            <>
              <div className="panel-section">
                <div className="panel-title">{t("panel.export.preview")}</div>
                <div className="help-text" style={{ marginBottom: 8 }}>
                  {t("panel.export.summary", {
                    datasets: datasets.length,
                    points: totalPoints,
                  })}
                </div>
                {datasets.map((ds) => (
                  <div
                    key={ds.id}
                    className="calib-point-row"
                    style={{ marginBottom: 4 }}
                  >
                    <span
                      className="dataset-color-dot"
                      style={{
                        background: ds.color,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                      }}
                    />
                    <span className="point-coord">
                      {ds.name}: {ds.points.length}
                    </span>
                  </div>
                ))}
                {validationIssues.length > 0 && (
                  <div className="help-text warn-text" style={{ marginTop: 6 }}>
                    {t("status.issues", { n: validationIssues.length })}
                  </div>
                )}
              </div>
              <div className="panel-section">
                <button
                  className="panel-btn primary full"
                  onClick={openExportModal}
                >
                  {t("panel.export.openDialog")}
                </button>
                <button
                  className="panel-btn full"
                  onClick={() => ux.go("closeExport")}
                  style={{ marginTop: 8 }}
                >
                  {t("panel.export.back")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {/* 状态栏 */}
      <div className="status-bar" role="status" aria-live="polite">
        <div className="status-item">
          {t("status.state")}: {t(`uxstate.${ux.state}` as never)}
        </div>
        {isDirty && (
          <div className="status-item dirty">{t("status.unsaved")}</div>
        )}
        <div className="status-item">
          {calibrationRef.current.isCalibrated()
            ? t("status.calibrated")
            : t("status.notCalibrated")}
          {calibResidual > 0
            ? ` ${t("status.residual", { val: calibResidual.toFixed(2) })}`
            : ""}
        </div>
        <div className="status-item">
          {t("status.calibPoints")}:{" "}
          {calibConfig.points.filter((p) => p.placed).length}/4
        </div>
        <div className="status-item">
          {t("status.dataPoints")}: {totalPoints}
        </div>
        {validationIssues.length > 0 && (
          <div className="status-item warn">
            {t("status.issues", { n: validationIssues.length })}
          </div>
        )}
        {colorPickMode && (
          <div className="status-item">{t("status.colorPick")}</div>
        )}
        <div className="status-spacer" />
        <div className="status-item">{t("status.offline")}</div>
        <div className="status-item">
          {undoMgr.canUndo()
            ? `${t("status.canUndo")}: ${undoMgr.getUndoDescription()}`
            : ""}
        </div>
        <div className="status-item">
          {undoMgr.canRedo()
            ? `${t("status.canRedo")}: ${undoMgr.getRedoDescription()}`
            : ""}
        </div>
        <div className="status-item">
          {t("status.version", { version: APP_VERSION })}
        </div>
      </div>
      {/* 右键菜单（Radix ContextMenu 受控模式：右键定位、键盘导航、Portal 渲染均内置） */}
      <ContextMenu
        open={!!contextMenu}
        onOpenChange={(open) => {
          if (!open) setContextMenu(null);
        }}
      >
        <ContextMenuTrigger asChild>
          <div style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, pointerEvents: "none" }} />
        </ContextMenuTrigger>
        {contextMenu && (
        <ContextMenuContent
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
              {contextMenu.hit ? (
                <>
                  <ContextMenuItem
                    onClick={() => {
                      openEditPoint(
                        contextMenu.hit!.dsId,
                        contextMenu.hit!.idx,
                      );
                      setContextMenu(null);
                    }}
                  >
                    {t("ctx.editPoint")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                      deletePointAt(
                        contextMenu.hit!.dsId,
                        contextMenu.hit!.idx,
                      );
                      setContextMenu(null);
                    }}
                  >
                    {t("ctx.deletePoint")}
                  </ContextMenuItem>
                </>
              ) : (
                <>
                  <ContextMenuItem
                    onClick={() => {
                      deleteLastPoint();
                      setContextMenu(null);
                    }}
                  >
                    {t("ctx.deleteLastPoint")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                      clearAllPoints();
                      setContextMenu(null);
                    }}
                  >
                    {t("ctx.clearAll")}
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  setColorPickMode(true);
                  setContextMenu(null);
                }}
              >
                {t("ctx.pickColor")}
              </ContextMenuItem>
        </ContextMenuContent>
        )}
      </ContextMenu>
      {/* 检测结果预览确认— Radix Dialog */}
      <Dialog
        open={!!detectionPreview}
        onOpenChange={(open) => {
          if (!open) {
            setDetectionPreview(null);
            setShowMask(false);
            setMaskImageData(null);
          }
        }}
      >
        <DialogContent aria-label={t("detect.confirm.title")}>
          <DialogHeader>{t("detect.confirm.title")}</DialogHeader>
          <div className="modal-body">
            {detectionPreview && (
              <>
                <p>
                  {t("detect.confirm.body", {
                    n: detectionPreview.pixelPoints.length,
                  })}
                </p>
                <p className="help-text" style={{ marginTop: 8 }}>
                  {t("detect.confirm.help")}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <button
              className="panel-btn"
              onClick={() => applyDetection("discard")}
            >
              {t("detect.confirm.discard")}
            </button>
            <button
              className="panel-btn"
              onClick={() => applyDetection("append")}
            >
              {t("detect.confirm.append")}
            </button>
            <button
              className="panel-btn primary"
              onClick={() => applyDetection("replace")}
            >
              {t("detect.confirm.replace")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 编辑点弹窗（/）— Radix Dialog */}
      <Dialog
        open={!!editPoint}
        onOpenChange={(open) => {
          if (!open) setEditPoint(null);
        }}
      >
        <DialogContent
          aria-label={
            editPoint ? t("editPoint.title", { n: editPoint.idx + 1 }) : ""
          }
        >
          <DialogHeader>
            {editPoint ? t("editPoint.title", { n: editPoint.idx + 1 }) : ""}
            {editPoint && datasets.find((d) => d.id === editPoint.dsId)
              ? ` · ${datasets.find((d) => d.id === editPoint.dsId)!.name}`
              : ""}
          </DialogHeader>
          <div className="modal-body">
            <div className="panel-row">
              <span className="panel-label">X</span>
              <input
                className="panel-input"
                type="number"
                value={editPointDraft.x}
                onChange={(e) =>
                  setEditPointDraft((d) => ({ ...d, x: e.target.value }))
                }
                aria-label="X"
              />
            </div>
            <div className="panel-row">
              <span className="panel-label">Y</span>
              <input
                className="panel-input"
                type="number"
                value={editPointDraft.y}
                onChange={(e) =>
                  setEditPointDraft((d) => ({ ...d, y: e.target.value }))
                }
                aria-label="Y"
              />
            </div>
          </div>
          <DialogFooter>
            <button className="panel-btn" onClick={() => setEditPoint(null)}>
              {t("editPoint.cancel")}
            </button>
            <button className="panel-btn primary" onClick={saveEditPoint}>
              {t("editPoint.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 导出前校验警告— Radix Dialog */}
      <Dialog
        open={!!exportWarning}
        onOpenChange={(open) => {
          if (!open) setExportWarning(null);
        }}
      >
        <DialogContent aria-label={t("validate.title")}>
          <DialogHeader>{t("validate.title")}</DialogHeader>
          <div className="modal-body">
            {exportWarning && (
              <>
                <p>{t("validate.body", { n: exportWarning.length })}</p>
                <ul style={{ margin: "8px 0 8px 20px" }}>
                  <li>{t("validate.nan", { n: issueCounts.nan })}</li>
                  <li>{t("validate.out", { n: issueCounts.out })}</li>
                  <li>{t("validate.dup", { n: issueCounts.dup })}</li>
                </ul>
                <p className="help-text">{t("validate.help")}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <button
              className="panel-btn"
              onClick={() => setExportWarning(null)}
            >
              {t("validate.cancel")}
            </button>
            <button className="panel-btn" onClick={removeIssuesAndExport}>
              {t("validate.remove")}
            </button>
            <button
              className="panel-btn primary"
              onClick={() => {
                setExportWarning(null);
                void doExport();
              }}
            >
              {t("validate.force")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 导出对话框（数据集勾选、列名、宽/长表、全量预览）— Radix Dialog */}
      <Dialog
        open={showExportModal}
        onOpenChange={(open) => {
          if (!open) closeExportModal();
        }}
      >
        <DialogContent aria-label={t("export.title")}>
          <DialogHeader>{t("export.title")}</DialogHeader>
          <div className="modal-body">
            <p>
              {t("export.summary", {
                datasets: datasets.length,
                points: totalPoints,
              })}
            </p>
            <div style={{ marginTop: 16 }}>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                {t("export.selectDatasets")}
              </div>
              {datasets.length === 0 ? (
                <div className="help-text">{t("export.noDatasets")}</div>
              ) : (
                datasets.map((ds) => (
                  <label
                    key={ds.id}
                    className="checkbox-row"
                    style={{ marginBottom: 4 }}
                  >
                    <input
                      type="checkbox"
                      checked={exportSel.datasetIds.includes(ds.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setExportSel((s) => ({
                          ...s,
                          datasetIds: checked
                            ? s.datasetIds.includes(ds.id)
                              ? s.datasetIds
                              : [...s.datasetIds, ds.id]
                            : s.datasetIds.filter((id) => id !== ds.id),
                        }));
                      }}
                    />
                    <span
                      className="dataset-color-dot"
                      style={{ background: ds.color }}
                    />
                    {t("dataset.count", { name: ds.name, n: ds.points.length })}
                  </label>
                ))
              )}
            </div>
            <div className="panel-row" style={{ marginTop: 12 }}>
              <span className="panel-label">{t("export.xColumn")}</span>
              <input
                className="panel-input"
                value={exportSel.xColumn}
                placeholder={calibConfig.xLabel || "X"}
                onChange={(e) =>
                  setExportSel((s) => ({ ...s, xColumn: e.target.value }))
                }
                aria-label={t("export.xColumn")}
              />
            </div>
            <div className="panel-row">
              <span className="panel-label">{t("export.yColumn")}</span>
              <input
                className="panel-input"
                value={exportSel.yColumn}
                placeholder={calibConfig.yLabel || "Y"}
                onChange={(e) =>
                  setExportSel((s) => ({ ...s, yColumn: e.target.value }))
                }
                aria-label={t("export.yColumn")}
              />
            </div>
            {exportFormat === "csv" && (
              <div className="panel-row">
                <span className="panel-label" aria-hidden="true">
                  {t("export.mergeMode")}
                </span>
                <select
                  className="panel-select"
                  aria-label={t("export.mergeMode")}
                  value={exportSel.mergeMode}
                  onChange={(e) =>
                    setExportSel((s) => ({
                      ...s,
                      mergeMode: e.target.value as CsvMergeMode,
                    }))
                  }
                >
                  <option value="long">{t("export.merge.long")}</option>
                  <option value="wide">{t("export.merge.wide")}</option>
                </select>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div className="export-format-grid">
                <button
                  className={`export-format-btn ${exportFormat === "xlsx" ? "active" : ""}`}
                  onClick={() => setExportFormat("xlsx")}
                >
                  Excel (.xlsx)
                </button>
                <button
                  className={`export-format-btn ${exportFormat === "csv" ? "active" : ""}`}
                  onClick={() => setExportFormat("csv")}
                >
                  CSV
                </button>
                <button
                  className={`export-format-btn ${exportFormat === "json" ? "active" : ""}`}
                  onClick={() => setExportFormat("json")}
                >
                  JSON
                </button>
              </div>
              <div className="panel-row">
                <span className="panel-label" aria-hidden="true">
                  {t("export.encoding")}
                </span>
                <select
                  className="panel-select"
                  aria-label={t("export.encoding")}
                  value={exportEncoding}
                  onChange={(e) =>
                    setExportEncoding(e.target.value as "utf-8" | "gbk")
                  }
                >
                  <option value="utf-8">{t("export.encoding.utf8")}</option>
                  <option value="gbk">{t("export.encoding.gbk")}</option>
                </select>
              </div>
              <div className="panel-row">
                <span className="panel-label" aria-hidden="true">
                  {t("export.precision")}
                </span>
                <input
                  className="panel-input"
                  aria-label={t("export.precision")}
                  type="number"
                  min="0"
                  max="10"
                  value={precision}
                  onChange={(e) => {
                    setPrecision(parseInt(e.target.value) || 3);
                    setDirty(true);
                  }}
                />
              </div>
              {exportFormat !== "json" ? (
                <div className="panel-row">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={includeHeader}
                      onChange={(e) => setIncludeHeader(e.target.checked)}
                    />
                    {t("export.includeHeader")}
                  </label>
                </div>
              ) : (
                <div className="help-text">{t("export.jsonNote")}</div>
              )}
              {exportFormat === "csv" && (
                <div className="panel-row" style={{ marginTop: 4 }}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                    />
                    {t("export.includeMetadata")}
                  </label>
                  <span className="help-text" style={{ fontSize: 11 }}>
                    {t("export.includeMetadata.tip")}
                  </span>
                </div>
              )}
            </div>
            {/* /：全量预览（全部数据集） */}
            <div style={{ marginTop: 16 }}>
              <div className="panel-title">{t("export.previewTitle")}</div>
              <div className="data-preview">
                {datasets.filter(
                  (d) =>
                    exportSel.datasetIds.includes(d.id) && d.points.length > 0,
                ).length === 0 ? (
                  <div className="help-text" style={{ padding: 8 }}>
                    {t("export.noDataSelected")}
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("panel.extract.datasets")}</th>
                        <th>#</th>
                        <th>X</th>
                        <th>Y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets
                        .filter(
                          (d) =>
                            exportSel.datasetIds.includes(d.id) &&
                            d.points.length > 0,
                        )
                        .flatMap((ds) =>
                          ds.points.slice(0, 5).map((pt, i) => (
                            <tr
                              key={`${ds.id}-${i}`}
                              className={
                                issueSet.has(`${ds.id}:${i}`) ? "issue" : ""
                              }
                            >
                              <td>{i === 0 ? ds.name : ""}</td>
                              <td className="idx">{i + 1}</td>
                              <td>{Number.isFinite(pt.x) ? pt.x.toFixed(precision) : String(pt.x)}</td>
                              <td>{Number.isFinite(pt.y) ? pt.y.toFixed(precision) : String(pt.y)}</td>
                            </tr>
                          )),
                        )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button className="panel-btn" onClick={closeExportModal}>
              {t("export.cancel")}
            </button>
            <button
              className="panel-btn primary"
              onClick={() => {
                void handleExport();
              }}
            >
              {t("export.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 关于弹窗（隐私声明）— Radix Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent aria-label={t("about.title")} style={{ maxWidth: 440 }}>
          <DialogHeader>{t("about.title")}</DialogHeader>
          <div className="modal-body">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 48,
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <BarChartIcon size={48} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                ChartExtractor
              </div>
              <div
                style={{
                  color: "var(--text-secondary, #8e8e93)",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {t("about.version")}: v{APP_VERSION}
              </div>
            </div>
            <div
              style={{
                background: "var(--bg-secondary, #f5f5f7)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <InfoIcon size={14} /> {t("about.privacy")}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text-secondary, #8e8e93)",
                }}
              >
                {t("about.privacy.body")}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--success, #34c759)",
              }}
            >
              {t("about.offline")}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-tertiary, #c7c7cc)",
                marginTop: 8,
              }}
            >
              Copyright © 2026 Zichao Zeng · GPL-3.0
            </div>
          </div>
          <DialogFooter>
            <button
              className="panel-btn primary"
              onClick={() => setShowAbout(false)}
            >
              {t("about.close")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 批量处理面板— Radix Dialog */}
      <Dialog
        open={!!batchState}
        onOpenChange={(open) => {
          if (!open && batchState && !batchState.running) setBatchState(null);
        }}
      >
        <DialogContent aria-label={t("batch.title")} style={{ maxWidth: 520 }}>
          <DialogHeader>{t("batch.title")}</DialogHeader>
          <div className="modal-body">
            <div className="help-text" style={{ marginBottom: 12 }}>
              {t("batch.intro")}
            </div>
            <div className="panel-row" style={{ marginBottom: 8 }}>
              <button
                className="panel-btn"
                onClick={handleBatchSelectDir}
                disabled={!!batchState?.running}
              >
                {t("batch.selectDir")}
              </button>
              <span
                className="panel-label"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {batchState?.inputDir || "—"}
              </span>
            </div>
            <div className="panel-row" style={{ marginBottom: 8 }}>
              <button
                className="panel-btn"
                onClick={handleBatchSelectOutputDir}
                disabled={!!batchState?.running}
              >
                {t("batch.selectOutputDir")}
              </button>
              <span
                className="panel-label"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {batchState?.outputDir || "—"}
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                {t("batch.progress", {
                  done: String(
                    (batchState?.currentIdx ?? 0) +
                      (batchState?.running
                        ? 0
                        : (batchState?.okCount ?? 0) > 0
                          ? (batchState?.files.length ?? 0)
                          : 0),
                  ),
                  total: String(batchState?.files.length ?? 0),
                })}
              </div>
              {(batchState?.files.length ?? 0) > 0 ? (
                <div className="data-preview" style={{ maxHeight: 180 }}>
                  {batchState!.files.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 4,
                        background:
                          i === batchState!.currentIdx && batchState!.running
                            ? "var(--bg-accent, #e8e8ed)"
                            : "transparent",
                        fontWeight:
                          i === batchState!.currentIdx && batchState!.running
                            ? 600
                            : 400,
                      }}
                    >
                      {i < batchState!.currentIdx ? (
                        <CheckIcon size={12} />
                      ) : i === batchState!.currentIdx &&
                        batchState!.running ? (
                        <LoaderIcon size={12} className="spin" />
                      ) : (
                        <span style={{ fontSize: 10, opacity: 0.4 }}>
                          {i + 1}
                        </span>
                      )}
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="help-text">{t("batch.noFiles")}</div>
              )}
            </div>
{!calibrationRef.current.isCalibrated() && (
          <div className="help-text warn-text" style={{ marginTop: 8 }}>
                ⚠ {t("batch.needCalib")}
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              className="panel-btn"
              onClick={() => setBatchState(null)}
              disabled={!!batchState?.running}
            >
              {t("export.cancel")}
            </button>
            {batchState?.running ? (
              <button className="panel-btn primary" onClick={handleBatchStop}>
                {t("batch.stop")}
              </button>
            ) : (
              <button
                className="panel-btn primary"
                onClick={handleBatchRun}
                disabled={
                  (batchState?.files.length ?? 0) === 0 ||
                  !calibrationRef.current.isCalibrated()
                }
              >
                {t("batch.start")}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* P0-1: 应用内确认 Dialog — 替代 window.confirm */}
      <Dialog open={confirmState.open} onOpenChange={(v) => { if (!v) closeConfirm(false); }}>
        <DialogContent style={{ maxWidth: 400 }} showCloseButton={false}>
          <DialogHeader>{t("toast.confirmTitle")}</DialogHeader>
          <div className="modal-body">{confirmState.message}</div>
          <DialogFooter>
            <button className="panel-btn" onClick={() => closeConfirm(false)}>
              {t("toast.confirmCancel")}
            </button>
            <button className="panel-btn primary" onClick={() => closeConfirm(true)}>
              {t("toast.confirmOK")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Toast 提示 — Radix 风格，支持堆叠和手动关闭 */}
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}
export default App;
