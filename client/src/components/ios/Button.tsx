import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
  {
    variants: {
      variant: {
        filled: "bg-tint text-white hover:bg-tint-pressed active:bg-tint-pressed",
        tinted: "bg-tint-soft text-tint-text hover:bg-tint/20",
        gray: "bg-fill-3 text-label hover:bg-fill-2",
        plain: "text-tint-text hover:bg-tint-soft",
        outline: "border border-separator-strong bg-surface text-label hover:bg-fill-4",
        destructive: "bg-ios-red-solid text-white hover:opacity-90",
        /** For use on coloured or dark backgrounds */
        light: "bg-white text-[#0066cc] hover:bg-white/90",
        glass: "bg-white/20 text-white hover:bg-white/30",
      },
      size: {
        lg: "h-[50px] rounded-[14px] px-6 text-headline",
        md: "h-11 rounded-control px-5 text-callout",
        sm: "h-8 rounded-full px-3.5 text-subhead",
        // Text buttons may share a row (two `full` buttons split it) but never shrink below their label; icon buttons stay round.
        icon: "size-11 shrink-0 rounded-full",
        "icon-sm": "size-9 shrink-0 rounded-full",
      },
      full: { true: "w-full" },
    },
    defaultVariants: { variant: "filled", size: "md" },
  },
);

export type ButtonStyleProps = VariantProps<typeof buttonStyles>;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps & { loading?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, full, loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(buttonStyles({ variant, size, full }), className)} {...props}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

type ButtonLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & ButtonStyleProps & { href: string };

/** A link that looks like a button. Internal paths use the client router; others are plain anchors. */
export function ButtonLink({ href, className, variant, size, full, children, ...props }: ButtonLinkProps) {
  const classes = cn(buttonStyles({ variant, size, full }), className);
  if (/^(https?:|mailto:|tel:)/.test(href)) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
