/**
 * Progress 组件 — 基于 Radix UI Progress Primitive
 * 替代手写检测进度条，提供：无障碍 aria-valuenow/min/max、动画
 */
import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "./cn";
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn("progress-bar", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="progress-bar-indicator"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
export { Progress };
