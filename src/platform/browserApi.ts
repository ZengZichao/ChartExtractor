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
 * 图表数据提取器 - 平台桥接层（纯浏览器版，GitHub Pages 部署用）
 *
 * 与 Tauri 版（api.ts）实现同一个 AppApi 接口，供 api.ts 按运行时环境切换：
 * `appApi = isTauri ? tauriAppApi : browserAppApi`。
 *
 * 设计要点：
 * - 无服务器、无上传：所有文件读取/写入/导出均在用户浏览器内完成，与"数据不出本机"承诺一致。
 * - 路径是虚拟的：浏览器拿不到真实文件路径，open/拖拽把 File 对象存入会话内虚拟存储，
 *   以文件名（或 webkitRelativePath）作为伪路径，后续 readFile/writeFile 按伪路径取还。
 * - 写入优先走 File System Access API（Chromium）：showSaveFilePicker/showDirectoryPicker
 *   可直接写入用户选定的真实文件/目录（批量导出不弹多次下载）；
 *   不支持的浏览器（Firefox/Safari）退回 Blob + <a download> 触发下载。
 * - 自动保存走 IndexedDB（工程是 zip，可能超出 localStorage 配额）；最近文件走 localStorage。
 */
import type { AppApi, DialogFilter, RecentFile, SimpleResult } from "./api";

// ========== File System Access API（渐进增强，Firefox/Safari 缺失时全部退回下载兜底） ==========

interface FsWritable {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}
interface FsHandle {
  kind: "file" | "directory";
  name: string;
}
interface FsFileHandle extends FsHandle {
  kind: "file";
  createWritable(): Promise<FsWritable>;
}
interface FsDirectoryHandle extends FsHandle {
  kind: "directory";
  values(): AsyncIterableIterator<FsFileHandle | FsDirectoryHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirectoryHandle>;
}
interface PickerWindow {
  showSaveFilePicker(opts: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }): Promise<FsFileHandle>;
  showDirectoryPicker(): Promise<FsDirectoryHandle>;
}
const pickerWin = () => window as unknown as Partial<PickerWindow>;
const hasFsAccess = typeof window !== "undefined" && "showSaveFilePicker" in window;

// ========== 会话内虚拟文件存储（伪路径 → File） ==========

const fileStore = new Map<string, File>();
const saveHandles = new Map<string, FsFileHandle>();
const dirHandles = new Map<string, FsDirectoryHandle>();

// ========== base64 编解码（Tauri 版约定：二进制以 base64 字符串往返） ==========

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000; // 分块避免超长参数列表炸栈
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ========== 常用扩展名 → MIME（构造 File System Access 的 accept 表） ==========

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  bmp: "image/bmp",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  prj: "application/octet-stream",
};

function savePickerTypes(filters?: DialogFilter[]) {
  const accept: Record<string, string[]> = {};
  for (const f of filters ?? []) {
    for (const ext of f.extensions) {
      if (ext === "*") continue;
      const mime = EXT_MIME[ext.toLowerCase()] ?? "application/octet-stream";
      (accept[mime] ??= []).push("." + ext.toLowerCase());
    }
  }
  return Object.keys(accept).length > 0
    ? [{ description: filters?.[0]?.name ?? "File", accept }]
    : undefined;
}

// ========== 写入：优先真实句柄，否则触发下载 ==========

async function writeToHandle(handle: FsFileHandle, data: BlobPart): Promise<SimpleResult> {
  const w = await handle.createWritable();
  await w.write(data);
  await w.close();
  return { success: true };
}

function download(name: string, data: BlobPart): SimpleResult {
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { success: true };
}

/** 按伪路径写入：saveDialog 句柄 > 目录句柄下相对路径 > 下载兜底 */
async function writePath(path: string, bytes: Uint8Array<ArrayBuffer>): Promise<SimpleResult> {
  const handle = saveHandles.get(path);
  if (handle) return writeToHandle(handle, bytes);
  const slash = path.indexOf("/");
  if (slash > 0) {
    const dirName = path.slice(0, slash);
    const dir = dirHandles.get(dirName);
    if (dir) {
      const parts = path.slice(slash + 1).split("/");
      let cur: FsDirectoryHandle = dir;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = await cur.getDirectoryHandle(parts[i], { create: true });
      }
      const fh = await cur.getFileHandle(parts[parts.length - 1], { create: true });
      return writeToHandle(fh, bytes);
    }
  }
  return download(path.split("/").pop() || path, bytes);
}

function writeTextBytes(text: string, encoding: string): Uint8Array<ArrayBuffer> {
  if (encoding.toLowerCase() === "gbk") {
    // 浏览器原生只有 UTF-8 编码器；GBK 兜底写 UTF-8 + BOM（Excel 可正确识别）。
    // UI 侧在浏览器模式下隐藏 GBK 选项，此分支仅为 API 兼容兜底。
    return new TextEncoder().encode("﻿" + text);
  }
  return new TextEncoder().encode(text);
}

// ========== IndexedDB 键值存储（自动保存用） ==========

const IDB_NAME = "chart-extractor";
const IDB_STORE = "kv";

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key: string): Promise<string | undefined> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key: string, value: string): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ========== 最近文件（localStorage，容量上限与桌面版一致） ==========

const RECENT_KEY = "chart-extractor.recentFiles";
const MAX_RECENT_FILES = 20;

function readRecent(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentFile[]) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: RecentFile[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT_FILES)));
  } catch {
    /* 隐私模式等场景下静默失败，不影响主流程 */
  }
}

// ========== 文件/目录选择（动态 input，用户手势内触发） ==========

function pickFiles(options?: { accept?: string; directory?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (options?.accept) input.accept = options.accept;
    if (options?.directory) input.setAttribute("webkitdirectory", "");
    input.style.display = "none";
    document.body.appendChild(input);
    const done = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener("change", () => done(Array.from(input.files ?? [])));
    input.addEventListener("cancel", () => done([]));
    input.click();
  });
}

function storeFiles(files: File[], useRelativePath: boolean): void {
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    const key = useRelativePath && rel ? rel : f.name;
    fileStore.set(key, f);
  }
}

async function walkDirectory(
  dir: FsDirectoryHandle,
  prefix: string,
  extensions: Set<string> | null,
  out: Array<{ path: string; name: string }>,
  depth: number,
): Promise<void> {
  if (depth > 6 || out.length >= 2000) return; // 防御性上限，避免误选巨型目录卡死页面
  try {
    for await (const entry of dir.values()) {
      if (entry.kind === "file") {
        const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
        if (!extensions || extensions.has(ext)) {
          out.push({ path: prefix + entry.name, name: entry.name });
        }
      } else {
        await walkDirectory(entry, prefix + entry.name + "/", extensions, out, depth + 1);
      }
    }
  } catch {
    /* 单个子目录不可读时跳过，不中断整体列举 */
  }
}

function toExtSet(extensions?: string[]): Set<string> | null {
  if (!extensions || extensions.length === 0) return null;
  return new Set(extensions.map((e) => e.toLowerCase()));
}

// ========== AppApi 实现 ==========

export const browserAppApi: AppApi = {
  async openFileDialog(filters) {
    const accept = (filters ?? [])
      .flatMap((f) => f.extensions.filter((e) => e !== "*").map((e) => "." + e.toLowerCase()))
      .join(",");
    const files = await pickFiles({ accept: accept || undefined });
    if (files.length === 0) return null;
    storeFiles(files, false);
    return files[0].name;
  },

  async saveFileDialog(defaultName, filters) {
    if (hasFsAccess) {
      try {
        const handle = await pickerWin().showSaveFilePicker!({
          suggestedName: defaultName,
          types: savePickerTypes(filters),
        });
        saveHandles.set(handle.name, handle);
        return handle.name;
      } catch (err) {
        // 用户取消 → 返回 null（与桌面版行为一致）；API 受限 → 退回下载兜底
        if ((err as DOMException)?.name === "AbortError") return null;
      }
    }
    return defaultName;
  },

  async readFile(filePath) {
    const file = fileStore.get(filePath);
    if (!file)
      return {
        success: false,
        error: "File not in current browser session (browsers cannot access disk paths)",
      };
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { success: true, data: bytesToBase64(bytes), size: bytes.length };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async writeFile(filePath, data) {
    try {
      return await writePath(filePath, base64ToBytes(data));
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async writeWithBackup(filePath, data) {
    // 句柄写入本身是先写临时、close 时提交（File System Access 语义），无需额外备份层
    return this.writeFile(filePath, data);
  },

  async readTextFile(filePath) {
    const file = fileStore.get(filePath);
    if (!file) return { success: false, error: "File not in current browser session" };
    try {
      return { success: true, data: await file.text(), size: file.size };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async writeTextFile(filePath, content) {
    try {
      return await writePath(filePath, new TextEncoder().encode(content));
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async writeTextEncoded(filePath, content, encoding) {
    try {
      return await writePath(filePath, writeTextBytes(content, encoding));
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async fileStat(filePath) {
    const file = fileStore.get(filePath);
    if (!file) return { success: false, error: "File not in current browser session" };
    return { success: true, size: file.size, isFile: true, isDirectory: false };
  },

  async openPath() {
    // 浏览器没有"在文件管理器中显示"的概念；写入时已经下载/落盘，这里无需动作
    return { success: true };
  },

  async getUserDataPath() {
    return "browser-session";
  },

  async getRecentFiles() {
    return readRecent();
  },

  async addRecentFile(entry) {
    const list = readRecent().filter((r) => r.path !== entry.path);
    list.unshift({ ...entry, lastOpened: new Date().toISOString() });
    writeRecent(list);
    return { success: true };
  },

  async saveAutosave(data) {
    try {
      await idbSet("autosave", data);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async loadAutosave() {
    try {
      const data = await idbGet("autosave");
      return data != null
        ? { success: true, data }
        : { success: false, error: "No autosave found" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async clearAutosave() {
    try {
      await idbDel("autosave");
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  registerDropHandler(handler) {
    // 与 api.ts 的浏览器兜底思路一致，但把 File 存入会话存储，使后续 readFile 按文件名可取
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const list = Array.from(files);
        storeFiles(list, false);
        handler(list.map((f) => f.name));
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  },

  async openDirectoryDialog() {
    // Chromium：选真实目录（批量导出可直接落盘，不弹多次下载）
    if (typeof pickerWin().showDirectoryPicker === "function") {
      try {
        const dir = await pickerWin().showDirectoryPicker!();
        dirHandles.set(dir.name, dir);
        return dir.name;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return null;
      }
    }
    // 其他浏览器：webkitdirectory 选择，文件以相对路径存入会话存储
    const files = await pickFiles({ directory: true });
    if (files.length === 0) return null;
    storeFiles(files, true);
    const root = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
    return root?.includes("/") ? root.split("/")[0] : "";
  },

  async listDirectory(dirPath, extensions) {
    const exts = toExtSet(extensions);
    const dir = dirHandles.get(dirPath);
    if (dir) {
      const out: Array<{ path: string; name: string }> = [];
      await walkDirectory(dir, dirPath + "/", exts, out, 0);
      return out;
    }
    // 虚拟存储：webkitdirectory 的键自带 "根目录/子路径" 前缀
    const prefix = dirPath ? dirPath + "/" : "";
    const out: Array<{ path: string; name: string }> = [];
    for (const key of fileStore.keys()) {
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length);
      if (name.includes("/")) continue;
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      if (!exts || exts.has(ext)) out.push({ path: key, name });
    }
    return out;
  },
};
