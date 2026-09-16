/**
 * 轻量 className 合并工具（替代 clsx + tailwind-merge）
 * 支持 条件对象、数组嵌套
 */
type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === "object") {
      for (const key in input) {
        if (input[key]) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}
