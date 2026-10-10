import { ButtonLink, Eyebrow, Sheet } from "@/components/ios";
import type { Product } from "@/lib/catalogue";
import { productHref } from "@/lib/productRoute";
import { MoqLabel, PriceLabel } from "./Price";
import { ProductGallery } from "./ProductGallery";

/** Preview a product from the catalogue without leaving the list. */
export function QuickView({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Sheet
      open={Boolean(product)}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={product?.name ?? "Product"}
      tone="plain"
      footer={
        product && (
          <div className="flex gap-3">
            <ButtonLink href={productHref(product.slug)} variant="gray" size="lg" full onClick={onClose}>
              View details
            </ButtonLink>
            {!product.isSample && (
              <ButtonLink href={`/quote?product=${encodeURIComponent(product.slug)}`} size="lg" full onClick={onClose}>
                Request a quote
              </ButtonLink>
            )}
          </div>
        )
      }>
      {product && (
        <div className="space-y-4 pb-2">
          <ProductGallery product={product} compact />
          <div>
            <Eyebrow>{product.category}</Eyebrow>
            <div className="mt-2 flex items-end justify-between gap-3">
              <PriceLabel pricing={product.pricing} size="hero" />
              <MoqLabel moq={product.moq} unit={product.pricing.unit} />
            </div>
            {product.summary && <p className="mt-3 text-body text-label-2">{product.summary}</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
