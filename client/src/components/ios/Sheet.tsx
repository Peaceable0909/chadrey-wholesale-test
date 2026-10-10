import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** How the sheet appears on larger screens: a centred panel or a panel docked to the right. */
  desktop?: "center" | "right";
  /** Sticky action area below the content. */
  footer?: React.ReactNode;
  /** Left header action, e.g. "Cancel". */
  leading?: React.ReactNode;
  /** Right header action. Defaults to a round close button. */
  trailing?: React.ReactNode;
  /** "grouped" gives the grey canvas that white list groups sit on. */
  tone?: "grouped" | "plain";
  className?: string;
  children: React.ReactNode;
};

type HeaderParts = {
  Title: React.ElementType;
  Description: React.ElementType;
  Close: React.ElementType;
};

function SheetHeader({ title, description, leading, trailing, Title, Description, Close }: Pick<SheetProps, "title" | "description" | "leading" | "trailing"> & HeaderParts) {
  return (
    <div className="shrink-0 px-4 pb-2 pt-1">
      <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">{leading}</div>
        <Title className="max-w-[56vw] truncate text-center text-headline font-semibold md:max-w-[22rem]">{title}</Title>
        <div className="justify-self-end">
          {trailing ?? (
            <Close aria-label="Close" className="press grid size-8 place-items-center rounded-full bg-fill-3 text-label-2">
              <X className="size-4" strokeWidth={2.5} />
            </Close>
          )}
        </div>
      </div>
      <Description className={description ? "pb-1 text-center text-subhead text-label-2" : "sr-only"}>{description ?? title}</Description>
    </div>
  );
}

const bodyClass = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2";
const footerClass = "material shrink-0 border-t border-separator px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]";

function BottomSheet({ open, onOpenChange, title, description, footer, leading, trailing, tone = "grouped", className, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[61] mt-24 flex max-h-[92dvh] flex-col rounded-t-sheet shadow-sheet outline-none",
            tone === "grouped" ? "bg-canvas" : "bg-surface",
          )}>
          <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-fill-1" aria-hidden />
          <SheetHeader title={title} description={description} leading={leading} trailing={trailing} Title={Drawer.Title} Description={Drawer.Description} Close={Drawer.Close} />
          <div className={cn(bodyClass, className)}>{children}</div>
          {footer && <div className={footerClass}>{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function DesktopDialog({ open, onOpenChange, title, description, desktop = "center", footer, leading, trailing, tone = "grouped", className, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-[61] flex flex-col overflow-hidden rounded-[22px] shadow-float outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            tone === "grouped" ? "bg-canvas" : "bg-surface",
            desktop === "right"
              ? "inset-y-3 right-3 w-[min(520px,calc(100vw-24px))] data-[state=closed]:slide-out-to-right-10 data-[state=open]:slide-in-from-right-10"
              : "left-1/2 top-1/2 max-h-[min(86dvh,780px)] w-[min(600px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}>
          <div className="pt-2" />
          <SheetHeader title={title} description={description} leading={leading} trailing={trailing} Title={Dialog.Title} Description={Dialog.Description} Close={Dialog.Close} />
          <div className={cn(bodyClass, className)}>{children}</div>
          {footer && <div className={footerClass}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Bottom sheet you can drag down on a phone; a centred (or right-docked) panel on larger screens. */
export function Sheet(props: SheetProps) {
  const isMobile = useIsMobile();
  return isMobile ? <BottomSheet {...props} /> : <DesktopDialog {...props} />;
}
