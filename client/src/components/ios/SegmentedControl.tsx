import * as React from "react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: React.ReactNode };

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
};

/** iOS segmented control with a sliding thumb. */
export function SegmentedControl<T extends string>({ value, onChange, options, size = "md", className, ...aria }: SegmentedControlProps<T>) {
  const index = Math.max(0, options.findIndex(option => option.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn("relative grid auto-cols-fr grid-flow-col rounded-[9px] bg-fill-3 p-0.5", size === "sm" ? "h-8" : "h-9", className)}>
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 rounded-[7px] bg-raised shadow-[0_1px_3px_rgba(0,0,0,0.14),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-out"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn("relative z-10 truncate px-3 text-subhead text-label transition-[font-weight]", option.value === value ? "font-semibold" : "font-medium")}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
