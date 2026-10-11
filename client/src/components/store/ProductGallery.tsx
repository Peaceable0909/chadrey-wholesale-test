import * as React from "react";
import type { Product } from "@/lib/catalogue";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

type ProductGalleryProps = {
  product: Pick<Product, "name" | "category" | "images">;
  className?: string;
  /** Rounded corners (on by default). */
  rounded?: boolean;
  /** A shorter 4:3 frame without thumbnails, for places like the quick view where the price must stay in view. */
  compact?: boolean;
};

/**
 * Swipeable photo gallery built on native scroll-snap, so it has real iOS momentum.
 * Shows page dots and a counter, with thumbnails on larger screens.
 */
export function ProductGallery({ product, className, rounded = true, compact = false }: ProductGalleryProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  // The thumbnails reuse the same large photos, so they wait until the main photo has arrived.
  const [mainLoaded, setMainLoaded] = React.useState(false);
  const count = Math.max(1, product.images.length);
  const label = product.images[index]?.label;

  const onScroll = () => {
    const el = scroller.current;
    if (el && el.clientWidth) setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const goTo = (next: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.min(count - 1, Math.max(0, next)) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("relative overflow-hidden bg-surface", rounded && "rounded-card md:rounded-[28px]")}>
        <div
          ref={scroller}
          onScroll={onScroll}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${product.name} photos`}
          tabIndex={count > 1 ? 0 : -1}
          onKeyDown={event => {
            if (event.key === "ArrowRight") goTo(index + 1);
            if (event.key === "ArrowLeft") goTo(index - 1);
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-offset-[-3px]">
          {Array.from({ length: count }, (_, position) => (
            <div key={position} className={cn("w-full shrink-0 snap-center", compact ? "aspect-[4/3]" : "aspect-square")} aria-label={`Photo ${position + 1} of ${count}`}>
              {/* Only the first photo and the next one (one screen to the right) are requested up front. */}
              <ProductImage product={product} index={position} fit="contain" variant="main" priority={position === 0} margin="0px 100% 0px 100%" onLoaded={position === 0 ? () => setMainLoaded(true) : undefined} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <span className="material absolute right-3 top-3 rounded-full px-2.5 py-1 text-caption font-semibold tabular-nums">
              {index + 1} / {count}
            </span>
            <div className="material absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full px-2.5 py-2" aria-hidden>
              {Array.from({ length: count }, (_, position) => (
                <span key={position} className={cn("size-1.5 rounded-full transition-colors", position === index ? "bg-label" : "bg-label/25")} />
              ))}
            </div>
          </>
        )}
        {label && <span className="material absolute bottom-3 left-3 max-w-[40%] truncate rounded-full px-3 py-1 text-caption font-semibold">{label}</span>}
      </div>

      {count > 1 && !compact && (
        <div className="no-scrollbar hidden gap-2.5 overflow-x-auto md:flex" role="tablist" aria-label="Choose photo">
          {Array.from({ length: count }, (_, position) => (
            <button
              key={position}
              type="button"
              role="tab"
              aria-selected={position === index}
              aria-label={`Show photo ${position + 1}`}
              onClick={() => goTo(position)}
              className={cn(
                "press size-[68px] shrink-0 overflow-hidden rounded-[14px] bg-surface ring-offset-2 ring-offset-canvas transition-shadow",
                position === index ? "ring-2 ring-tint" : "opacity-80 hover:opacity-100",
              )}>
              <ProductImage product={product} index={position} variant="thumb" margin="0px" hold={!mainLoaded} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
