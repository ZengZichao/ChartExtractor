/**
 * Tabs 组件 — 基于 Radix UI Tabs Primitive
 * 替代手写的 dataset-tab / panel-section 切换
 */
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "./cn";
const Tabs = TabsPrimitive.Root;
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List className={cn("tabs-list", className)} {...props} />
  );
}
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn("tabs-trigger", className)}
      {...props}
    />
  );
}
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("tabs-content", className)}
      {...props}
    />
  );
}
export { Tabs, TabsList, TabsTrigger, TabsContent };
