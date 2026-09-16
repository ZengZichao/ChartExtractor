/**
 * Separator 组件 — 基于 Radix UI Separator Primitive
 * 替代手写的 dropdown-divider / context-menu-divider
 */
import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { cn } from "./cn";
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "separator",
        orientation === "vertical" && "separator-vertical",
        className,
      )}
      {...props}
    />
  );
}
export { Separator };
