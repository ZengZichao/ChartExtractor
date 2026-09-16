/**
 * Slider 组件 — 基于 Radix UI Slider Primitive
 * 替代原生 <input type="range">，提供：键盘控制、触摸支持
 * 无障碍 aria-valuenow/min/max、动画 thumb
 */
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "./cn";
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );
  return (
    <SliderPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn("panel-slider-radix", className)}
      {...props}
    >
      <SliderPrimitive.Track className="panel-slider-track">
        <SliderPrimitive.Range className="panel-slider-range" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb key={index} className="panel-slider-thumb" />
      ))}
    </SliderPrimitive.Root>
  );
}
export { Slider };
