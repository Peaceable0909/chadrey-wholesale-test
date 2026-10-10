import * as React from "react";
import { cn } from "@/lib/utils";

/** White rounded surface on the grey canvas. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-group bg-surface", className)} {...props} />;
}

type SectionHeaderProps = {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
};

/** Section title with an optional trailing action such as "See all". */
export function SectionHeader({ title, action, className, as: Heading = "h2" }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <Heading className="text-title3 font-bold">{title}</Heading>
      {action}
    </div>
  );
}

/** Small uppercase caption used above grouped content. */
export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-footnote font-semibold uppercase tracking-wider text-label-2", className)} {...props} />;
}
