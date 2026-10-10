import * as React from "react";
import { Button, Sheet } from "@/components/ios";

type ConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
};

/** The iOS-style "Are you sure?" action sheet. */
export function ConfirmSheet({ open, onOpenChange, title, description, confirmLabel, onConfirm, loading, destructive = true }: ConfirmSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} tone="plain" desktop="center">
      <div className="space-y-5 pb-3 pt-1 text-center">
        <p className="text-body text-label-2">{description}</p>
        <div className="flex flex-col gap-3">
          <Button variant={destructive ? "destructive" : "filled"} size="lg" full loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
          <Button variant="gray" size="lg" full disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
