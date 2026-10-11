import * as React from "react";
import { isUncategorised } from "@shared/productMessage";
import { Button, Chip, Field, Notice, Sheet, TextInput } from "@/components/ios";
import { STARTER_CATEGORIES } from "@/lib/categories";

type BulkCategorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the choice applies to, for example "3 products". */
  target: string;
  /** Why a category is being asked for. */
  note?: React.ReactNode;
  /** Categories already used in the catalogue, offered first. */
  knownCategories: string[];
  confirmLabel: string;
  busy: boolean;
  onApply: (category: string) => void | Promise<void>;
};

const MAX_CATEGORY = 60;

/** Choose one category for several products at once: tap a suggestion or type a new one. */
export function BulkCategorySheet({ open, onOpenChange, target, note, knownCategories, confirmLabel, busy, onApply }: BulkCategorySheetProps) {
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const suggestions = Array.from(new Set([...knownCategories.filter(name => !isUncategorised(name)), ...STARTER_CATEGORIES])).slice(0, 18);
  const category = value.trim();
  const valid = category.length > 0 && category.length <= MAX_CATEGORY && !isUncategorised(category);

  return (
    <Sheet
      open={open}
      onOpenChange={next => {
        if (!busy) onOpenChange(next);
      }}
      title="Choose a category"
      description={`For ${target}`}
      desktop="center"
      footer={
        <Button full size="lg" disabled={!valid} loading={busy} onClick={() => void onApply(category)}>
          {confirmLabel}
        </Button>
      }>
      <div className="space-y-4 pb-2">
        {note && <Notice tone="orange">{note}</Notice>}
        <Field label="Category" as="div">
          <TextInput value={value} onChange={event => setValue(event.target.value)} placeholder="e.g. Beauty & skincare" aria-label="Category" autoComplete="off" maxLength={MAX_CATEGORY} disabled={busy} />
          <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Suggested categories">
            {suggestions.map(name => (
              <Chip key={name} selected={category.toLowerCase() === name.toLowerCase()} onClick={() => setValue(name)} className="h-8 px-3 text-footnote" disabled={busy}>
                {name}
              </Chip>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
