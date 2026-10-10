import * as React from "react";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toneSoft } from "./tone";

const NOTICE_ICONS: Partial<Record<Tone, LucideIcon>> = { red: CircleAlert, green: CircleCheck, blue: Info, orange: TriangleAlert };

type NoticeProps = { tone?: "red" | "green" | "blue" | "orange"; className?: string; children: React.ReactNode };

/** Inline banner for errors, confirmations and tips. */
export function Notice({ tone = "blue", className, children }: NoticeProps) {
  const Icon = NOTICE_ICONS[tone] ?? Info;
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-control px-3.5 py-3 text-subhead", toneSoft[tone], className)}>
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-5 animate-spin text-label-2", className)} aria-hidden />;
}

/** Centered loading state for a whole page or panel. */
export function LoadingBlock({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-3 py-24 text-label-2", className)}>
      <Spinner className="size-7" />
      <p className="text-subhead">{label}</p>
    </div>
  );
}

type EmptyStateProps = {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <span className="mb-4 grid size-16 place-items-center rounded-full bg-fill-4 text-label-2">
        <Icon className="size-8" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="text-title3 font-bold">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-body text-label-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
