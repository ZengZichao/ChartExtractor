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
 * 国际化 Hook（中/英双语切换）
 * - 默认中文
 * - 语言选择持久化到 localStorage
 * - 通过 t(key, params) 获取翻译文本，支持 {placeholder} 插值
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from "react";
import {
  translations,
  type Lang,
  type TranslationKey,
} from "../i18n/translations";
const STORAGE_KEY = "chart-extractor-lang";
function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    /* localStorage 不可用时退回中文 */
  }
  return "zh"; // 默认中文
}
type InterpolationParams = Record<string, string | number>;
interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: InterpolationParams) => string;
}
const I18nContext = createContext<I18nContextValue | null>(null);
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* 忽略持久化失败 */
    }
    // 语言切换时同步 <html lang>，读屏/断词/字体回退按正确语言处理
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback(
    (key: TranslationKey, params?: InterpolationParams): string => {
      const table = translations[lang] as Record<string, string>;
      let text = table[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          // P3-6 修复：使用函数式替换避免 $& / $' 等替换模式被解释
          text = text.split(`{${k}}`).join(String(v));
        }
      }
      return text;
    },
    [lang],
  );
  // P3-6 修复：memoize context value 避免每次渲染创建新对象
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components rendered outside provider (shouldn't happen in practice)
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
