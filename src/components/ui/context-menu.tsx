/**
 * ContextMenu 组件 — 基于 Radix UI ContextMenu Primitive
 * 替代手写的 contextMenu state + fixed overlay 系统
 * 提供：右键定位、键盘导航、点击外部自动关闭、Portal 渲染
 */
import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { cn } from "./cn";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;
function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn("context-menu", className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}
function ContextMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      data-variant={variant}
      className={cn(
        "context-menu-item",
        variant === "destructive" && "context-menu-item-destructive",
        className,
      )}
      {...props}
    />
  );
}
function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn("context-menu-item", className)}
      checked={checked}
      {...props}
    >
      <span className="context-menu-indicator">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon size={14} />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}
function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn("context-menu-item", className)}
      {...props}
    >
      <span className="context-menu-indicator">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon size={8} fill="currentColor" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}
const ContextMenuLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) => (
  <ContextMenuPrimitive.Label
    className={cn("dropdown-label", className)}
    {...props}
  />
);
const ContextMenuSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) => (
  <ContextMenuPrimitive.Separator
    className={cn("context-menu-divider", className)}
    {...props}
  />
);
function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger>) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn("context-menu-item", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon size={14} style={{ marginLeft: "auto" }} />
    </ContextMenuPrimitive.SubTrigger>
  );
}
function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent
        className={cn("context-menu", className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
};
