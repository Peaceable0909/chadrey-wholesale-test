import { Check, Trash2 } from "lucide-react";
import { Button, Card, Field, SelectInput, Stepper, TextArea, TextInput } from "@/components/ios";
import { stepForMoq } from "@/components/ios/Stepper";
import { formatMoney, formatQty } from "@/lib/format";
import { lineTotal, unitPriceFor } from "@/lib/pricing";
import { OTHER, type QuoteLine } from "@/lib/quote";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

type QuoteLineCardProps = {
  line: QuoteLine;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<QuoteLine>) => void;
  onRemove: () => void;
  onChangeProduct: () => void;
};

/** One product in a quote request: quantity, its own options, preferred photos and notes. */
export function QuoteLineCard({ line, index, canRemove, onChange, onRemove, onChangeProduct }: QuoteLineCardProps) {
  const product = line.product;
  if (!product) return null;
  const { pricing } = product;
  const unit = unitPriceFor(pricing, line.quantity);
  const total = lineTotal(pricing, line.quantity);

  const togglePhoto = (id: string) =>
    onChange({ preferredImageIds: line.preferredImageIds.includes(id) ? line.preferredImageIds.filter(item => item !== id) : [...line.preferredImageIds, id] });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="size-16 shrink-0 overflow-hidden rounded-[14px] bg-fill-4">
          <ProductImage product={product} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase tracking-wider text-label-2">Item {index + 1}</p>
          <h3 className="line-clamp-2 text-headline font-semibold leading-snug">{product.name}</h3>
          <p className="truncate text-subhead text-label-2">
            {product.category} · MOQ {formatQty(product.moq, pricing.unit)}
          </p>
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          <Button variant="plain" size="sm" onClick={onChangeProduct}>
            Change
          </Button>
          {canRemove && (
            <Button variant="plain" size="icon-sm" aria-label={`Remove ${product.name}`} onClick={onRemove} className="text-ios-red-text hover:bg-ios-red/10">
              <Trash2 className="size-[18px]" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5 border-t border-separator p-4">
        <Field label="Quantity" as="div" hint={`Minimum order is ${formatQty(product.moq, pricing.unit)}.`}>
          <Stepper label={`Quantity for ${product.name}`} value={line.quantity} min={product.moq} step={stepForMoq(product.moq)} onChange={quantity => onChange({ quantity })} />
          {unit !== null && total !== null && (
            <p className="mt-2 text-footnote text-label-2">
              About <span className="font-semibold text-label">{formatMoney(unit, pricing.currency)}</span> / {pricing.unit} ·{" "}
              <span className="font-semibold text-label">{formatMoney(total, pricing.currency)}</span> in total. Indicative only.
            </p>
          )}
        </Field>

        {product.optionGroups.length > 0 && (
          <div className="grid items-start gap-5 sm:grid-cols-2">
            {product.optionGroups.map(group => {
              const value = line.selections[group.key] ?? "";
              return (
                <div key={group.key} className="space-y-2.5">
                  <Field label={group.label} optional>
                    <SelectInput value={value} onChange={event => onChange({ selections: { ...line.selections, [group.key]: event.target.value } })}>
                      <option value="">Not specified</option>
                      {group.options.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={OTHER}>Other / not listed</option>
                    </SelectInput>
                  </Field>
                  {value === OTHER && (
                    <TextInput
                      aria-label={`Your ${group.label.toLowerCase()}`}
                      placeholder={`Enter ${group.label.toLowerCase()}`}
                      value={line.customValues[group.key] ?? ""}
                      onChange={event => onChange({ customValues: { ...line.customValues, [group.key]: event.target.value } })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {product.images.length > 1 && (
          <Field label="Preferred photos" as="div" hint="Tap the designs or views you like best.">
            <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto p-1" role="group" aria-label="Preferred photos">
              {product.images.map((image, position) => {
                const selected = line.preferredImageIds.includes(image.id);
                return (
                  <button
                    key={image.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={image.label || `Photo ${position + 1}`}
                    onClick={() => togglePhoto(image.id)}
                    className={cn("press relative size-[68px] shrink-0 overflow-hidden rounded-[14px] bg-fill-4 transition-opacity", selected ? "ring-2 ring-tint ring-offset-2 ring-offset-surface" : "opacity-70")}>
                    <ProductImage product={product} index={position} />
                    {selected && (
                      <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-tint text-white">
                        <Check className="size-3" strokeWidth={3.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Notes for this product" optional hint="Sizes breakdown, materials, branding, deadline, or anything not covered above.">
          <TextArea rows={3} value={line.requirements} onChange={event => onChange({ requirements: event.target.value })} placeholder="e.g. 20 M, 20 L, 10 XL with our logo on the chest" />
        </Field>
      </div>
    </Card>
  );
}
