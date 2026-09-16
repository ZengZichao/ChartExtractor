/**
 * Dialog 组件 — 基于 Radix UI Dialog Primitive
 * 适配项目 CSS Token（Apple HIG 风格），替代手写 modal-overlay/modal
 * 提供：焦点陷阱、Esc 关闭、点击遮罩关闭、无障碍 aria 属性、平滑动画
 */
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "./cn";
import { XIcon } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("modal-overlay", className)}
      {...props}
    />
  );
}
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  const { t } = useI18n();
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content className={cn("modal", className)} {...props}>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="modal-close-btn"
            aria-label={t("a11y.close")}
          >
            <XIcon size={16} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
// DialogHeader 直接输出 Radix DialogTitle，消除「缺标题语义」与开发期告警
function DialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("modal-header", className)}
      {...props}
    />
  );
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("modal-footer", className)} {...props} />;
}
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
