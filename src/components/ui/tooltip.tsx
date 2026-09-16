/**
 * Tooltip 组件 — 基于 Radix UI Tooltip Primitive
 * 替代原生 title 属性，提供：延迟显示、箭头、Portal 定位、动画
 */
import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "./cn";
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn("tooltip-content", className)}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="tooltip-arrow" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
