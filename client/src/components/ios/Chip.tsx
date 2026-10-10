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
        "press inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-subhead font-medium transition-colors",
        selected ? "bg-tint text-white" : "bg-surface text-label shadow-[inset_0_0_0_0.5px_var(--separator-strong)] hover:bg-fill-4",
        className,
      )}
      {...props}>
      {icon}
      {children}
      {count !== undefined && <span className={cn("text-footnote", selected ? "text-white/80" : "text-label-2")}>{count}</span>}
    </button>
  );
}
