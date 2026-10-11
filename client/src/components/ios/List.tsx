import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { Tone } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toneSolid } from "./tone";

type ListGroupProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** iOS "inset grouped" list: a titled white card whose rows are divided by hairlines. */
export function ListGroup({ header, footer, className, children }: ListGroupProps) {
  return (
    <section className={className}>
      {header && <h2 className="px-4 pb-2 text-footnote font-medium uppercase tracking-wide text-label-2">{header}</h2>}
      <div className="overflow-hidden rounded-group bg-surface">{children}</div>
      {footer && <p className="px-4 pt-2 text-footnote text-label-2">{footer}</p>}
    </section>
  );
}

type ListRowProps = {
  /** Settings-style icon tile. */
  icon?: React.ReactNode;
  tone?: Tone;
  /** Custom leading element such as a product thumbnail. Pass `inset` to align the separator. */
  leading?: React.ReactNode;
  inset?: number;
  title: React.ReactNode;
  /** Sits on the title line, right-aligned (e.g. a status badge). It drops to its own line rather than cutting the title short. */
  titleTrailing?: React.ReactNode;
  /** Let a long title wrap instead of truncating, for data people need in full such as an address. */
  wrap?: boolean;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** Marks the current row in a master-detail list. */
  selected?: boolean;
  destructive?: boolean;
  className?: string;
};

const isExternal = (href: string) => /^(https?:|mailto:|tel:)/.test(href);

export function ListRow({ icon, tone = "blue", leading, inset, title, titleTrailing, wrap, subtitle, value, trailing, chevron, href, onClick, selected, destructive, className }: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const separatorInset = inset ?? (icon ? 60 : 16);
  const classes = cn(
    "row-separator flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left",
    interactive && "transition-colors active:bg-fill-4 hover:bg-fill-4/60",
    selected && "bg-tint-soft hover:bg-tint-soft",
    className,
  );
  const style = { "--sep-inset": `${separatorInset}px` } as React.CSSProperties;
  const current = selected ? ("true" as const) : undefined;
  const hasValue = value !== undefined && value !== null;
  const titleTone = destructive ? "text-ios-red-text" : "text-label";

  const content = (
    <>
      {icon && <span className={cn("grid size-8 shrink-0 place-items-center rounded-[8px] [&>svg]:size-[18px]", toneSolid[tone])}>{icon}</span>}
      {leading}
      <span className={cn("min-w-0", hasValue ? "shrink-0" : "flex-1")}>
        {titleTrailing ? (
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className={cn("min-w-0 max-w-full truncate text-body", titleTone)}>{title}</span>
            {titleTrailing}
          </span>
        ) : (
          <span className={cn("block text-body", wrap ? "break-words" : hasValue ? "whitespace-nowrap" : "truncate", titleTone)}>{title}</span>
        )}
        {subtitle && <span className="block text-subhead text-label-2">{subtitle}</span>}
      </span>
      {hasValue && <span className="min-w-0 flex-1 text-right text-body text-label-2">{value}</span>}
      {trailing}
      {chevron && <ChevronRight className="-mr-1 size-[18px] shrink-0 text-label-3" aria-hidden />}
    </>
  );

  if (href) {
    return isExternal(href) ? (
      <a href={href} className={classes} style={style}>
        {content}
      </a>
    ) : (
      <Link href={href} className={classes} style={style} onClick={onClick} aria-current={current}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={classes} style={style} onClick={onClick} aria-current={current}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} style={style}>
      {content}
    </div>
  );
}
