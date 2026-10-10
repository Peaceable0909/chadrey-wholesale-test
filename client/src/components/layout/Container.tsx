import * as React from "react";
import { cn } from "@/lib/utils";

const widths = {
  wide: "max-w-[1200px]",
  form: "max-w-[760px]",
  narrow: "max-w-[640px]",
} as const;

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & { size?: keyof typeof widths };

/** Centered page column with consistent gutters (and iPhone landscape safe areas). */
export function Container({ size = "wide", className, ...props }: ContainerProps) {
  return <div className={cn("gutter mx-auto w-full", widths[size], className)} {...props} />;
}
