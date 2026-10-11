import * as React from "react";
import { cn } from "@/lib/utils";

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  count?: number;
  icon?: React.ReactNode;
};

/** Filter pill used for categories, status filters and option pickers. */
export function Chip({ selected = false, count, icon, className, children, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "press inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-subhead font-medium transition-colors",
        selected ? "border-tint bg-tint font-semibold text-on-tint" : "border-separator-strong bg-surface text-label hover:bg-fill-4",
        className,
      )}
      {...props}>
      {icon}
      {children}
      {count !== undefined && <span className={cn("text-footnote tabular-nums", selected ? "text-on-tint" : "text-label-2")}>{count}</span>}
    </button>
  );
}
