import { Plus, X } from "lucide-react";
import { Button, Field, SelectInput, TextInput } from "@/components/ios";
import { TierTable } from "@/components/store/Price";
import { currencySymbol } from "@/lib/format";
import { CURRENCIES, UNITS, pricingFromDraft, type PriceDraft } from "@/lib/pricing";

type PriceTiersEditorProps = {
  value: PriceDraft;
  onChange: (value: PriceDraft) => void;
  /** The minimum order quantity: the first price always starts here. */
  moq: number;
};

function MoneyInput({ symbol, className, ...props }: { symbol: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-label-2" aria-hidden>
        {symbol}
      </span>
      <TextInput inputMode="decimal" autoComplete="off" className={`pl-9 ${className ?? ""}`} {...props} />
    </div>
  );
}

/**
 * Price ladder entry: one price at the minimum order, plus optional cheaper prices for bigger orders.
 * A live preview shows exactly what buyers will see on the product page.
 */
export function PriceTiersEditor({ value, onChange, moq }: PriceTiersEditorProps) {
  const symbol = currencySymbol(value.currency).trim();
  const preview = pricingFromDraft(value, moq);
  const touched = Boolean(value.base.trim() || value.breaks.some(row => row.minQty.trim() || row.price.trim()));
  const set = (patch: Partial<PriceDraft>) => onChange({ ...value, ...patch });
  const setBreak = (index: number, patch: Partial<PriceDraft["breaks"][number]>) =>
    set({ breaks: value.breaks.map((row, position) => (position === index ? { ...row, ...patch } : row)) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <SelectInput value={value.currency} onChange={event => set({ currency: event.target.value })}>
            {CURRENCIES.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.code} · {currency.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Price per">
          <SelectInput value={value.unit} onChange={event => set({ unit: event.target.value })}>
            {UNITS.map(unit => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field label={`Price at the minimum order (${moq || "…"} ${value.unit})`} hint="Leave empty to show “Price on request” in the store.">
        <MoneyInput symbol={symbol} value={value.base} onChange={event => set({ base: event.target.value })} placeholder="e.g. 18,500" aria-label="Price at the minimum order" />
      </Field>

      {value.breaks.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-subhead font-medium">Volume prices</p>
          {value.breaks.map((row, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <TextInput
                inputMode="numeric"
                aria-label={`Volume price ${index + 1}: from quantity`}
                placeholder="From qty"
                value={row.minQty}
                onChange={event => setBreak(index, { minQty: event.target.value })}
                className="w-[7.5rem] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <MoneyInput symbol={symbol} aria-label={`Volume price ${index + 1}: price`} placeholder="Price" value={row.price} onChange={event => setBreak(index, { price: event.target.value })} />
              </div>
              <Button variant="plain" size="icon-sm" aria-label={`Remove volume price ${index + 1}`} onClick={() => set({ breaks: value.breaks.filter((_, position) => position !== index) })}>
                <X className="size-5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="tinted" size="sm" onClick={() => set({ breaks: [...value.breaks, { minQty: "", price: "" }] })}>
        <Plus className="size-4" aria-hidden /> Add a volume price
      </Button>

      {touched && preview.error && (
        <p role="alert" className="text-footnote font-medium text-ios-red-text">
          {preview.error}
        </p>
      )}
      {touched && !preview.error && preview.pricing.tiers.length > 0 && (
        <div>
          <p className="mb-1.5 text-footnote font-medium uppercase tracking-wide text-label-2">What buyers will see</p>
          <TierTable pricing={preview.pricing} className="bg-canvas" />
        </div>
      )}
      <p className="text-footnote text-label-2">Prices are a guide for buyers. You set the final price in each quotation, so you can change these any time.</p>
    </div>
  );
}
