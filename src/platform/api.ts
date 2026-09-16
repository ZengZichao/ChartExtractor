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
 * 图表数据提取器 - 平台桥接层（Tauri 版）
 *
 * 取代 Electron 的 `window.electronAPI`（contextBridge）。方法签名与 electronAPI 1:1 对齐，
 * 内部通过 `@tauri-apps/api/core` 的 invoke 调用 Rust 命令层（见 src-tauri/src/commands.rs）。
 *
 * 设计要点（Tauri迁移设计方案.md）
 * - 所有 OS 能力集中在 Rust 命令层（ADR-002），前端只经 invoke 调用，无特权。
 * - 初期保留 base64 往返（ADR-003），与 Electron 行为一致，渲染进程改动最小。
 * - registerDropHandler：Tauri 下用窗口 dragDrop 事件接管（WebView 不暴露真实路径）；
 * 纯浏览器 dev 下用标准 HTML5 拖拽兜底（仅用于无外壳联调）。
 */
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
export interface DialogFilter {
  name: string;
  extensions: string[];
}
export interface FileReadResult {
  success: boolean;
  data?: string;
  size?: number;
  error?: string;
}
export interface SimpleResult {
  success: boolean;
  error?: string;
}
export interface FileStatResult {
  success: boolean;
  size?: number;
  isFile?: boolean;
  isDirectory?: boolean;
  error?: string;
}
export interface RecentFile {
  path: string;
  name: string;
  lastOpened: string;
}
export interface AppApi {
  openFileDialog(filters?: DialogFilter[]): Promise<string | null>;
  saveFileDialog(
    defaultName: string,
    filters?: DialogFilter[],
  ): Promise<string | null>;
  readFile(filePath: string): Promise<FileReadResult>;
  writeFile(filePath: string, data: string): Promise<SimpleResult>;
  writeWithBackup(filePath: string, data: string): Promise<SimpleResult>;
  readTextFile(filePath: string): Promise<FileReadResult>;
  writeTextFile(filePath: string, content: string): Promise<SimpleResult>;
  writeTextEncoded(
    filePath: string,
    content: string,
    encoding: string,
  ): Promise<SimpleResult>;
  fileStat(filePath: string): Promise<FileStatResult>;
  openPath(filePath: string): Promise<SimpleResult>;
  getUserDataPath(): Promise<string>;
  getRecentFiles(): Promise<RecentFile[]>;
  addRecentFile(entry: { path: string; name: string }): Promise<SimpleResult>;
  /** 自动保存：写入/读取/清除应用数据目录下的 autosave.prj（会话恢复） */
  saveAutosave(data: string): Promise<SimpleResult>;
  loadAutosave(): Promise<FileReadResult>;
  clearAutosave(): Promise<SimpleResult>;
  /** 注册原生拖拽导入处理器（Tauri 窗口 dragDrop 事件 / 浏览器兜底）；返回清理函数 */
  registerDropHandler(handler: (paths: string[]) => void): () => void;
  /** -批量处理：打开目录选择对话框 */
  openDirectoryDialog(): Promise<string | null>;
  /** -批量处理：列出目录下指定扩展名的文件 */
  listDirectory(
    dirPath: string,
    extensions?: string[],
  ): Promise<Array<{ path: string; name: string }>>;
}
/** 是否运行在 Tauri 环境（区别于纯浏览器 dev） */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const appApi: AppApi = {
  openFileDialog(filters) {
    return invoke<string | null>("open_file", { filters: filters ?? null });
  },
  saveFileDialog(defaultName, filters) {
    return invoke<string | null>("save_file", {
      defaultName,
      filters: filters ?? null,
    });
  },
  readFile(filePath) {
    return invoke<FileReadResult>("read_file", { path: filePath });
  },
  writeFile(filePath, data) {
    return invoke<SimpleResult>("write_file", { path: filePath, data });
  },
  writeWithBackup(filePath, data) {
    return invoke<SimpleResult>("write_with_backup", { path: filePath, data });
  },
  readTextFile(filePath) {
    return invoke<FileReadResult>("read_text_file", { path: filePath });
  },
  writeTextFile(filePath, content) {
    return invoke<SimpleResult>("write_text_file", { path: filePath, content });
  },
  writeTextEncoded(filePath, content, encoding) {
    return invoke<SimpleResult>("write_text_encoded", {
      path: filePath,
      content,
      encoding,
    });
  },
  fileStat(filePath) {
    return invoke<FileStatResult>("file_stat", { path: filePath });
  },
  openPath(filePath) {
    return invoke<SimpleResult>("open_path", { path: filePath });
  },
  getUserDataPath() {
    return invoke<string>("get_user_data_path");
  },
  getRecentFiles() {
    return invoke<RecentFile[]>("get_recent_files");
  },
  addRecentFile(entry) {
    return invoke<SimpleResult>("add_recent_file", { entry });
  },
  saveAutosave(data) {
    return invoke<SimpleResult>("save_autosave", { data });
  },
  loadAutosave() {
    return invoke<FileReadResult>("load_autosave");
  },
  clearAutosave() {
    return invoke<SimpleResult>("clear_autosave");
  },
  registerDropHandler(handler) {
    if (isTauri) {
      // Tauri：WebView 不暴露真实文件路径，必须用窗口 dragDrop 事件
      let unlisten: (() => void) | null = null;
      const p = getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            handler(event.payload.paths);
          }
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => {});
      // 返回清理函数，卸载 p 后注销监听
      return () => {
        void p;
        unlisten?.();
      };
    }
    // 浏览器兜底：标准 HTML5 拖拽（仅用于无外壳联调，拿不到真实路径）
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const paths = Array.from(files).map(
          (f) => (f as unknown as { path?: string }).path || f.name,
        );
        handler(paths);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    // 返回清理函数，组件卸载时注销浏览器兜底监听
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  },
  openDirectoryDialog() {
    if (!isTauri) return Promise.resolve(null);
    return invoke<string | null>("open_directory");
  },
  listDirectory(dirPath, extensions) {
    return invoke<Array<{ path: string; name: string }>>("list_directory", {
      dirPath,
      extensions: extensions ?? null,
    });
  },
};
