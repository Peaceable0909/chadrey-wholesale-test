import * as React from "react";
import type { Tone } from "@/lib/categories";
import { statusLabel, statusTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { toneSoft } from "./tone";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

/** Small tinted capsule for statuses and tags. */
export function Badge({ tone = "gray", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold", toneSoft[tone], className)}
      {...props}>
      {children}
    </span>
  );
}

/** Badge for a quote / order status with a friendly label and a colour that matches its meaning. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
