import { Check } from "lucide-react";
import { formatMoney, formatQty } from "@/lib/format";
import { formatRange, hasPrice, tierRanges, type Pricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** The price a buyer pays at the minimum order (first tier). Cards show this so the figure is honest. */
export function entryPrice(pricing: Pricing): number | null {
  return pricing.tiers[0]?.price ?? null;
}

type PriceLabelProps = {
  pricing: Pricing;
  /** Quantity-dependent price shown on the product page; cards use the minimum-order price. */
  quantity?: number;
  className?: string;
  size?: "card" | "hero";
};

/** "₦12,500 / pc", or a quiet "Price on request" when no price has been set. */
export function PriceLabel({ pricing, className, size = "card" }: PriceLabelProps) {
  const price = entryPrice(pricing);
  if (price === null) {
    return <p className={cn("font-semibold text-tint-text", size === "hero" ? "text-title2" : "text-subhead", className)}>Price on request</p>;
  }
  return (
    <p className={cn("flex items-baseline gap-1 whitespace-nowrap", className)}>
      <span className={cn("font-bold tabular-nums", size === "hero" ? "text-title1" : "text-headline")}>{formatMoney(price, pricing.currency)}</span>
      <span className={cn("text-label-2", size === "hero" ? "text-subhead" : "text-footnote")}>/ {pricing.unit}</span>
    </p>
  );
}

type TierTableProps = {
  pricing: Pricing;
  /** Highlights the band the current quantity falls into. */
  quantity?: number;
  className?: string;
};

/** The wholesale price ladder: a unit price per quantity band. */
export function TierTable({ pricing, quantity, className }: TierTableProps) {
  if (!hasPrice(pricing)) return null;
  const ranges = tierRanges(pricing);
  return (
    <div className={cn("overflow-hidden rounded-group bg-surface", className)}>
      <div className="grid grid-cols-2 px-4 py-2.5 text-footnote font-medium uppercase tracking-wide text-label-2">
        <span>Quantity</span>
        <span className="text-right">Price per {pricing.unit}</span>
      </div>
      <ul>
        {ranges.map(range => {
          const active = quantity !== undefined && quantity >= range.from && (range.to === null || quantity <= range.to);
          return (
            <li
              key={range.from}
              aria-current={active ? "true" : undefined}
              className={cn("row-separator grid grid-cols-2 items-center px-4 py-3 transition-colors", active && "bg-tint-soft")}>
              <span className="flex items-center gap-2 text-body">
                {active && <Check className="size-4 text-tint-text" strokeWidth={3} aria-hidden />}
                {formatRange(range)} <span className="text-label-2">{pricing.unit === "pc" ? "pcs" : pricing.unit}</span>
              </span>
              <span className={cn("text-right text-body font-semibold tabular-nums", active && "text-tint-text")}>{formatMoney(range.price, pricing.currency)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "MOQ 50 pcs" */
export function MoqLabel({ moq, unit, className }: { moq: number; unit: string; className?: string }) {
  return <span className={cn("text-footnote text-label-2", className)}>MOQ {formatQty(moq, unit)}</span>;
}
