import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Notice } from "@/components/ios";
import { copyLegacyProduct, findUncopied, type CopyProgress } from "@/lib/legacyCopy";
import { errorMessage } from "@/lib/supabaseCompat";

const DISMISSED = "legacy-copy-dismissed";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

/**
 * Shown while the old store (Supabase) still holds products that the new store does not have.
 * One tap copies them, photos included. It disappears by itself once everything is across.
 */
export function LegacyCopyCard({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = React.useState(wasDismissed);
  const [progress, setProgress] = React.useState<CopyProgress | null>(null);
  const [error, setError] = React.useState("");
  const [position, setPosition] = React.useState<{ index: number; count: number } | null>(null);

  const waiting = useQuery({ queryKey: ["legacy-uncopied"], queryFn: findUncopied, enabled: enabled && !dismissed, staleTime: Infinity, retry: false });
  const items = waiting.data ?? [];
  if (!enabled || dismissed || items.length === 0) return null;

  async function copyAll() {
    setError("");
    let copied = 0;
    try {
      for (let index = 0; index < items.length; index += 1) {
        setPosition({ index, count: items.length });
        await copyLegacyProduct(items[index], setProgress);
        copied += 1;
      }
      toast.success(copied === 1 ? "Copied 1 product to the new store" : `Copied ${copied} products to the new store`);
    } catch (caught) {
      setError(`${errorMessage(caught, "The copy did not finish.")} Nothing is lost: press the button again to carry on.`);
    } finally {
      setProgress(null);
      setPosition(null);
      for (const key of ["legacy-uncopied", "admin-products", "admin-hidden-count", "catalogue", "product", "category-counts"]) void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // Remembering is a convenience only.
    }
    setDismissed(true);
  }

  const busy = progress !== null || position !== null;
  const count = items.length;

  return (
    <Notice tone="blue">
      <div className="flex flex-col gap-3">
        <p>
          <strong>{count === 1 ? "1 product" : `${count} products`}</strong> from your old store {count === 1 ? "has" : "have"} not been copied to the new one yet, so {count === 1 ? "it does" : "they do"} not show in the shop.
          {items.length > 0 && !busy && <span className="block text-footnote text-label-2">{items.map(item => item.name).slice(0, 3).join(", ")}{count > 3 ? " and more" : ""}</span>}
        </p>
        {busy && progress && (
          <p role="status" aria-live="polite" className="text-footnote text-label-2">
            {position && position.count > 1 ? `Product ${position.index + 1} of ${position.count}: ` : ""}
            {progress.name}. {progress.step}…
          </p>
        )}
        {error && <p className="text-footnote text-ios-red-text">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={busy} onClick={() => void copyAll()}>
            <Download className="size-4" aria-hidden /> {error ? "Try again" : "Copy now"}
          </Button>
          <Button size="sm" variant="plain" disabled={busy} onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </Notice>
  );
}
