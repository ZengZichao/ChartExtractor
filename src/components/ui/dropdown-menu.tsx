/**
 * DropdownMenu 组件 — 基于 Radix UI DropdownMenu Primitive
 * 替代手写的 openMenu/dropdown 系统，提供：焦点管理、键盘导航
 * 点击外部关闭、子菜单、Portal 定位
 */
import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "./cn";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn("dropdown", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-variant={variant}
      className={cn(
        "dropdown-item",
        variant === "destructive" && "dropdown-item-destructive",
        className,
      )}
      {...props}
    />
  );
}
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn("dropdown-item dropdown-item-checkbox", className)}
      checked={checked}
      {...props}
    >
      <span className="dropdown-item-indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon size={14} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn("dropdown-item dropdown-item-radio", className)}
      {...props}
    >
      <span className="dropdown-item-indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon size={8} fill="currentColor" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}
const DropdownMenuLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) => (
  <DropdownMenuPrimitive.Label
    className={cn("dropdown-label", className)}
    {...props}
  />
);
const DropdownMenuSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) => (
  <DropdownMenuPrimitive.Separator
    className={cn("dropdown-divider", className)}
    {...props}
  />
);
function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn("dropdown-item", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon size={14} style={{ marginLeft: "auto" }} />
    </DropdownMenuPrimitive.SubTrigger>
  );
}
function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        className={cn("dropdown", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
};
