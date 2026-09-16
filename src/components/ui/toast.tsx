/**
 * Toast 组件 — 基于状态管理的轻量实现
 * 替代手写 toast-container，提供：自动消失、类型图标、动画、堆叠
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  XIcon,
} from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
export interface ToastItem {
  id: number;
  msg: string;
  type: "success" | "error" | "warning" | "info";
}
let toastIdCounter = 0;
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);
  const toast = useCallback(
    (
      msg: string | null,
      type: "success" | "error" | "warning" | "info" = "info",
    ) => {
      if (!msg) return;
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, msg, type }]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, 3000);
      timersRef.current.set(id, timer);
    },
    [],
  );
  // 清理所有定时器
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);
  return { toasts, toast, dismiss };
}
const toastIcons = {
  success: CheckCircle2Icon,
  error: AlertCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};
const toastColors: Record<string, string> = {
  success: "var(--success)",
  error: "var(--error)",
  warning: "var(--warning)",
  info: "var(--primary)",
};
export function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}) {
  const { t } = useI18n();
  if (toasts.length === 0) return null;
  return (
    // 异步反馈对读屏可见（错误用 assertive alert，其余用 polite status）
    <div
      className="toast-container"
      role="region"
      aria-label={t("a11y.notifications")}
    >
      {toasts.map((tItem) => {
        const Icon = toastIcons[tItem.type];
        return (
          <div
            key={tItem.id}
            className={`toast ${tItem.type}`}
            role={tItem.type === "error" ? "alert" : "status"}
            aria-live={tItem.type === "error" ? "assertive" : "polite"}
          >
            <Icon
              size={16}
              style={{ color: toastColors[tItem.type], flexShrink: 0 }}
            />
            <span style={{ flex: 1 }}>{tItem.msg}</span>
            <button
              className="toast-close-btn"
              onClick={() => dismiss(tItem.id)}
              aria-label={t("a11y.close")}
            >
              <XIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
