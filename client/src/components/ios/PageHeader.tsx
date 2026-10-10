import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** iOS "large title" header. */
export function PageHeader({ title, subtitle, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-footnote font-semibold uppercase tracking-wider text-label-2">{eyebrow}</p>}
        <h1 className="text-largetitle font-bold md:text-[2.5rem] md:leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-body text-label-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
    </header>
  );
}

/** "‹ Products" style back link in the iOS navigation-bar position. */
export function BackLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("press -ml-1.5 inline-flex min-h-11 items-center gap-0.5 text-body text-tint-text", className)}>
      <ChevronLeft className="size-6" strokeWidth={2.25} aria-hidden />
      {children}
    </Link>
  );
}
