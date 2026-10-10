import * as React from "react";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

/** The app-icon style mark: a blue rounded square holding an isometric box. */
export function LogoMark({ className }: { className?: string }) {
  const id = `logo-${React.useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="8" y1="0" x2="56" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3da0ff" />
          <stop offset="1" stopColor="#0058d0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.5" fill={`url(#${id})`} />
      <g strokeLinejoin="round">
        <path d="M32 11.5 49.5 21.5 32 31.5 14.5 21.5Z" fill="#fff" />
        <path d="M14.5 21.5 32 31.5V52.5L14.5 42.5Z" fill="#fff" fillOpacity=".42" />
        <path d="M49.5 21.5 32 31.5V52.5L49.5 42.5Z" fill="#fff" fillOpacity=".72" />
      </g>
    </svg>
  );
}

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8 shrink-0 drop-shadow-[0_1px_2px_rgba(0,70,160,0.35)]" />
      {showName && (
        <span className="text-headline font-semibold tracking-tight">
          {siteConfig.shortName}
          <span className="hidden font-normal text-label-2 xs:inline"> Wholesale</span>
        </span>
      )}
    </span>
  );
}
