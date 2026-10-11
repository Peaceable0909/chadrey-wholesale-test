import { FilePlus2 } from "lucide-react";
import { ButtonLink, Eyebrow, Notice, Sheet } from "@/components/ios";
import { useIsMobile } from "@/hooks/useMobile";
import type { Product } from "@/lib/catalogue";
import { formatQty } from "@/lib/format";
import { hasPrice } from "@/lib/pricing";
import { productHref, quoteHref } from "@/lib/productRoute";
import { siteConfig } from "@/lib/siteConfig";
import { PriceLabel, TierTable } from "./Price";
import { ProductGallery } from "./ProductGallery";

const OPTIONS_SHOWN = 8;

/** What a buyer can choose between, shown as plain read-only labels (choosing happens on the quote request). */
function Variations({ product }: { product: Product }) {
  const groups = product.optionGroups.filter(group => group.options.length > 0);
  if (!groups.length) return null;
  return (
    <dl className="space-y-3">
      {groups.map(group => (
        <div key={group.key}>
          <dt className="text-footnote font-semibold uppercase tracking-wide text-label-2">{group.label}</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {group.options.slice(0, OPTIONS_SHOWN).map(option => (
              <span key={option} className="rounded-full border border-separator-strong bg-surface px-2.5 py-1 text-footnote text-label">
                {option}
              </span>
            ))}
            {group.options.length > OPTIONS_SHOWN && <span className="px-1 py-1 text-footnote text-label-2">+{group.options.length - OPTIONS_SHOWN} more</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Preview a product from the catalogue without leaving the list: photos, price and minimum order, what can be chosen,
 * and the two things a buyer does next. Closing it (the button, Escape, or a tap outside) returns to the list exactly as it was.
 */
export function QuickView({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const isMobile = useIsMobile();
  const priced = product ? hasPrice(product.pricing) : false;
  return (
    <Sheet
      open={Boolean(product)}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Quick view"
      srDescription={product ? `Preview of ${product.name}` : undefined}
      size="xl"
      tone="plain"
      footer={
        product && (
          <div className="flex gap-3 sm:justify-end">
            <ButtonLink href={productHref(product.slug)} variant="outline" size="lg" className={product.isSample ? "w-full sm:w-auto sm:min-w-44" : "flex-1 px-4 sm:min-w-44 sm:flex-none"} onClick={onClose}>
              <span className="sm:hidden">View details</span>
              <span className="hidden sm:inline">View full details</span>
            </ButtonLink>
            {!product.isSample && (
              <ButtonLink href={quoteHref(product.slug)} size="lg" className="flex-[1.6] px-4 sm:min-w-56 sm:flex-none" onClick={onClose}>
                <FilePlus2 className="size-5 shrink-0" aria-hidden /> Request a Quote
              </ButtonLink>
            )}
          </div>
        )
      }>
      {product && (
        <div className="grid gap-5 pb-2 md:grid-cols-2 md:gap-8">
          <ProductGallery product={product} compact={isMobile} />

          <div className="min-w-0 space-y-5">
            <div>
              <Eyebrow>{product.category}</Eyebrow>
              <h2 className="mt-1 text-title2 font-bold leading-tight text-label">{product.name}</h2>
            </div>

            <div className="rounded-tile bg-fill-4 p-4">
              <PriceLabel pricing={product.pricing} size="hero" />
              <p className="mt-1 text-subhead text-label-2">
                {priced ? (
                  <>
                    Price at the minimum order of <span className="font-semibold text-label">{formatQty(product.moq, product.pricing.unit)}</span>.
                  </>
                ) : (
                  <>
                    We confirm the price in your quotation. <span className="font-semibold text-label">Minimum order: {formatQty(product.moq, product.pricing.unit)}</span>
                  </>
                )}
              </p>
            </div>

            {product.pricing.tiers.length > 1 && <TierTable pricing={product.pricing} className="border border-separator" />}

            {product.summary && <p className="text-body text-label-2">{product.summary}</p>}

            <Variations product={product} />

            {product.isSample ? (
              <Notice tone="blue">This is a sample product, shown while the live catalogue is unavailable. It cannot be quoted.</Notice>
            ) : (
              <div className="rounded-tile border border-separator p-3.5 text-subhead text-label-2">
                <p className="font-semibold text-label">What happens next</p>
                <p className="mt-1">Request a quote with the quantities you need. Our team reviews it and sends your quotation, with the final price confirmed.</p>
                {priced && <p className="mt-2 text-footnote">{siteConfig.priceDisclaimer}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
