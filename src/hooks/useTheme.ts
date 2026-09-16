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
 * 主题管理（UX 方案第七节：浅 / 深 / 跟随系统）
 * - 默认 'system' 跟随系统；选择 light/dark 时写入 data-theme 属性
 * - localStorage 持久化用户选择
 * - index.css 通过 [data-theme] 与 prefers-color-scheme 提供三态令牌
 */
import { useState, useLayoutEffect, useCallback } from "react";
import type { ThemeMode } from "../types";
const STORAGE_KEY = "chart-extractor-theme";
function getInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
  } catch {
    /* localStorage 不可用时退回 system */
  }
  return "system";
}
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const apply = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }
  }, []);
  // useLayoutEffect 在浏览器绘制前同步写入 data-theme，避免显式深色用户首帧白闪（FOUC）
  useLayoutEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* 忽略持久化失败 */
    }
  }, [theme, apply]);
  const setTheme = useCallback((mode: ThemeMode) => setThemeState(mode), []);
  return { theme, setTheme };
}
