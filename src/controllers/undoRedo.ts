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
 * 撤销/重做管理器（命令模式）
 * 思想来源：开发文档 1.6 节撤销/重做架构
 *
 * 栈管理
 * - 撤销栈与重做栈分离，执行新操作时清空重做栈
 * - 栈深度上限：100 步（超出时丢弃最早的操作）
 * - 跨向导步骤回退不清理栈
 */
import type { UndoableCommand } from "../types";
const MAX_STACK_SIZE = 100;
export class UndoRedoManager {
  private undoStack: UndoableCommand[] = [];
  private redoStack: UndoableCommand[] = [];
  private onStateChange?: () => void;
  setOnStateChange(callback: () => void): void {
    this.onStateChange = callback;
  }
  /** 执行命令并压入撤销栈 */
  execute(command: UndoableCommand): void {
    command.execute();
    this.pushToUndo(command);
    this.redoStack = [];
    this.notifyStateChange();
  }
  /** 直接将命令压入撤销栈（不执行，用于已执行的操作） */
  pushToUndo(command: UndoableCommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift(); // 丢弃最早的操作
    }
  }
  /** 撤销 */
  undo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      this.notifyStateChange();
    }
  }
  /** 重做 */
  redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      command.redo();
      this.undoStack.push(command);
      this.notifyStateChange();
    }
  }
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  /** 获取撤销栈顶描述 */
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }
  /** 获取重做栈顶描述 */
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }
  /** 清空所有历史（新工程/导入新图时） */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyStateChange();
  }
  /** P0-2: 获取栈快照（用于标签页切换时保存撤销历史） */
  getStacks(): { undo: UndoableCommand[]; redo: UndoableCommand[] } {
    return { undo: [...this.undoStack], redo: [...this.redoStack] };
  }
  /** P0-2: 恢复栈（标签页切回时恢复撤销历史） */
  setStacks(stacks: { undo: UndoableCommand[]; redo: UndoableCommand[] }): void {
    this.undoStack = [...stacks.undo];
    this.redoStack = [...stacks.redo];
    this.notifyStateChange();
  }
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}
