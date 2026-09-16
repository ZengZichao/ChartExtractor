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
 * 单一真相 UX 状态机（修复 ：步骤可绕过 / UI 失同步 / 守卫遗漏）
 *
 * 用类型化状态机替换松散 `step` 字符串。所有状态迁移带事件与守卫
 * - can(event) 当前是否允许该迁移（UI 可点击性由此派生，杜绝手写 disabled 判断）
 * - reasonFor(event) 不允许时的原因字符串（显示给用户，而非仅 toast 一闪）
 * - go(event) 执行迁移；返回是否成功，并在失败时记录 blockReason
 *
 * UI 三处（步骤导航 / ribbon / 面板）共用同一 hook 实例，保证不彼此失同步。
 */
import { useState, useCallback, useRef } from "react";
import type { UXState } from "../types";
export type UXEvent =
  | "import"
  | "startCalibrate"
  | "commit"
  | "cancel"
  | "recalibrate"
  | "enterExtract"
  | "backToCalib"
  | "openExport"
  | "closeExport";
export interface UXFacts {
  hasImage: boolean;
  isCalibrated: boolean;
  positionsSet: number; // 已点位置数 0..4
  // 已填数值数 0..4：按角色统计——xmin/xmax 点填了 dx 计 1，ymin/ymax 点填了 dy 计 1。
  // 注意：交互式标定每个点只渲染一个输入框，故“填满 4 个数值”指 4 个点各自的本轴数值都填了。
  valuesEntered: number;
  totalPoints: number;
}
type TransitionMap = Partial<Record<UXEvent, UXState>>;
/** 状态迁移表（导出供单测： 回归验证 EMPTY 收紧） */
export const TRANSITIONS: Record<UXState, TransitionMap> = {
  // 修复：EMPTY 只允许 import，杜绝空状态下进入无图的不一致状态（校准/取点/导出）
  EMPTY: { import: "IMAGE_READY" },
  IMAGE_READY: {
    startCalibrate: "CALIBRATING",
    enterExtract: "EXTRACTING",
    openExport: "EXPORTING",
  },
  CALIBRATING: { commit: "CALIBRATED", cancel: "IMAGE_READY" },
  CALIBRATED: {
    recalibrate: "CALIBRATING",
    enterExtract: "EXTRACTING",
    openExport: "EXPORTING",
  },
  EXTRACTING: { backToCalib: "CALIBRATED", openExport: "EXPORTING" },
  EXPORTING: { closeExport: "EXTRACTING" },
};
/** 守卫：返回 string 表示拦截原因，返回 null 表示放行（导出供单测） */
export function guard(
  state: UXState,
  event: UXEvent,
  f: UXFacts,
): string | null {
  switch (state) {
    case "IMAGE_READY":
      if (event === "startCalibrate") return f.hasImage ? null : "请先导入图像";
      if (event === "enterExtract")
        return f.isCalibrated ? null : "请先完成标定";
      return null;
    case "CALIBRATING":
      if (event === "commit") {
        if (f.positionsSet < 4) return `还需标定 ${4 - f.positionsSet} 个位置`;
        if (f.valuesEntered < 4)
          return `还有 ${4 - f.valuesEntered} 个数值未填写`;
        return null;
      }
      if (event === "cancel") return null;
      return "当前不可执行";
    case "CALIBRATED":
      if (event === "enterExtract" || event === "recalibrate") return null;
      if (event === "openExport")
        return f.totalPoints > 0 ? null : "尚未取点，无数据可导出";
      return "当前不可执行";
    case "EXTRACTING":
      if (event === "backToCalib") return null;
      if (event === "openExport")
        return f.totalPoints > 0 ? null : "尚未取点，无数据可导出";
      return "当前不可执行";
    case "EXPORTING":
      if (event === "closeExport") return null;
      return "当前不可执行";
    case "EMPTY":
      // EMPTY 下除 import 外全部拦截，给出可读原因（TRANSITIONS 已收紧，此处为兜底语义）
      return event === "import" ? null : "请先导入图像";
  }
  return null;
}
export function useUXMachine(initial: UXState = "EMPTY") {
  const [state, setState] = useState<UXState>(initial);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const factsRef = useRef<UXFacts>({
    hasImage: false,
    isCalibrated: false,
    positionsSet: 0,
    valuesEntered: 0,
    totalPoints: 0,
  });
  const setFacts = useCallback((f: UXFacts) => {
    factsRef.current = f;
  }, []);
  const can = useCallback(
    (event: UXEvent): boolean => {
      if (event === "import") return true; // 导入新图是显式重置动作，任何状态都允许
      if (!TRANSITIONS[state][event]) return false;
      return guard(state, event, factsRef.current) === null;
    },
    [state],
  );
  const reasonFor = useCallback(
    (event: UXEvent): string | null => {
      if (event === "import") return null;
      if (!TRANSITIONS[state][event]) return "当前状态不可达";
      return guard(state, event, factsRef.current);
    },
    [state],
  );
  const go = useCallback(
    (event: UXEvent): boolean => {
      if (event === "import") {
        setState("IMAGE_READY");
        setBlockReason(null);
        return true;
      }
      const target = TRANSITIONS[state][event];
      if (!target) {
        setBlockReason("当前状态不可达");
        return false;
      }
      const reason = guard(state, event, factsRef.current);
      if (reason) {
        setBlockReason(reason);
        return false;
      }
      setBlockReason(null);
      setState(target);
      return true;
    },
    [state],
  );
  return { state, setState, blockReason, setFacts, can, reasonFor, go };
}
