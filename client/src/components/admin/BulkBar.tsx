import { Eye, EyeOff, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { countOf, type splitSelection } from "@/lib/bulkSelection";
import { cn } from "@/lib/utils";

type BulkBarProps = {
  split: ReturnType<typeof splitSelection>;
  busy: boolean;
  onShow: () => void;
  onHide: () => void;
  onCategory: () => void;
  onDelete: () => void;
};

/** On a phone the two smaller actions shrink to icons so everything fits on one line; their names stay for screen readers. */
const iconOnPhone = "max-md:w-11 max-md:px-0";

/** Actions for the ticked products. Sits above the phone tab bar, or along the bottom next to the sidebar on a computer. */
export function BulkBar({ split, busy, onShow, onHide, onCategory, onDelete }: BulkBarProps) {
  return (
    <div role="toolbar" aria-label="Actions for the selected products" className="material hairline-t fixed inset-x-0 bottom-[calc(var(--tab-h)+env(safe-area-inset-bottom))] z-30 py-3 lg:bottom-0 lg:left-64">
      {/* The same column as the page above, so the buttons line up with the list. */}
      <Container className="flex items-center gap-2 lg:max-w-[1040px]">
        <span className="mr-auto hidden text-subhead font-semibold md:block">{countOf(split.total)} selected</span>
        {split.hidden.length > 0 && (
          <Button size="md" className="min-w-0 flex-1 md:flex-none" disabled={busy} onClick={onShow}>
            <Eye className="size-[18px] shrink-0" aria-hidden /> Show {split.hidden.length} in store
          </Button>
        )}
        {split.live.length > 0 && (
          <Button variant="gray" size="md" className="min-w-0 flex-1 md:flex-none" disabled={busy} onClick={onHide}>
            <EyeOff className="size-[18px] shrink-0" aria-hidden /> Hide {split.live.length}
          </Button>
        )}
        <Button variant="gray" size="md" className={cn(iconOnPhone)} disabled={busy} onClick={onCategory}>
          <Tag className="size-[18px] shrink-0" aria-hidden />
          <span className="max-md:sr-only">Category</span>
        </Button>
        <Button variant="gray" size="md" className={cn(iconOnPhone, "text-ios-red-text")} disabled={busy} onClick={onDelete}>
          <Trash2 className="size-[18px] shrink-0" aria-hidden />
          <span className="max-md:sr-only">Delete</span>
        </Button>
      </Container>
    </div>
  );
}
