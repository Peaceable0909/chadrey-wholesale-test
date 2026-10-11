import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** The familiar iOS-style toggle, in brand navy when on (orange in dark mode, where navy would disappear). */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full bg-fill-2 outline-offset-2 transition-colors duration-200 data-[state=checked]:bg-navy dark:data-[state=checked]:bg-tint disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}>
      <SwitchPrimitive.Thumb className="block size-[27px] translate-x-0.5 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}
