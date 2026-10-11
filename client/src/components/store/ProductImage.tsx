import * as React from "react";
import { categoryMeta } from "@/lib/categories";
import type { Product } from "@/lib/catalogue";
import { cn } from "@/lib/utils";
import { toneText, toneWash } from "@/components/ios/tone";

/**
 * Photos are the heaviest thing on the site, so a photo is only requested when it is about to scroll into view.
 * The browser's own lazy loading starts far too early on slow connections (about 2,500px ahead), which put a dozen
 * full-size photos on the first screen. One shared observer per margin keeps this cheap for a grid of 24 cards.
 */
const watchers = new Map<string, { observer: IntersectionObserver; callbacks: Map<Element, () => void> }>();

function whenNear(element: Element, margin: string, callback: () => void): () => void {
  let watcher = watchers.get(margin);
  if (!watcher) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver(
      records => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const run = callbacks.get(record.target);
          callbacks.delete(record.target);
          observer.unobserve(record.target);
          run?.();
        }
      },
      { rootMargin: margin },
    );
    watcher = { observer, callbacks };
    watchers.set(margin, watcher);
  }
  const { observer, callbacks } = watcher;
  callbacks.set(element, callback);
  observer.observe(element);
  return () => {
    callbacks.delete(element);
    observer.unobserve(element);
  };
}

type ProductImageProps = {
  product: Pick<Product, "name" | "category" | "images">;
  /** Index into the product's images. */
  index?: number;
  className?: string;
  fit?: "cover" | "contain";
  /** Load straight away, for the one photo that is the main content of a page. */
  priority?: boolean;
  /** How far outside the screen the photo may be before it starts loading (CSS margin syntax). */
  margin?: string;
  /** Wait before loading, even when on screen, e.g. thumbnails that should follow the main photo. */
  hold?: boolean;
  /** Called once the photo has loaded. */
  onLoaded?: () => void;
};

/** The product photo, or a soft category-coloured tile when the product has none yet or the photo cannot be loaded. */
export function ProductImage({ product, index = 0, className, fit = "cover", priority = false, margin = "150px", hold = false, onLoaded }: ProductImageProps) {
  const image = product.images[index];
  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  const [near, setNear] = React.useState(priority || typeof IntersectionObserver === "undefined");
  const holder = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (near || !image || !holder.current) return;
    return whenNear(holder.current, margin, () => setNear(true));
  }, [near, image, margin]);

  if (image && image.url !== brokenUrl) {
    if (!near || hold) return <div ref={holder} aria-hidden className={cn("size-full bg-fill-4", className)} />;
    return (
      <img
        src={image.url}
        alt={image.alt || (image.label ? `${product.name} – ${image.label}` : product.name)}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        draggable={false}
        onLoad={onLoaded}
        onError={() => setBrokenUrl(image.url)}
        className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain", className)}
      />
    );
  }
  const { icon: Icon, tone } = categoryMeta(product.category);
  return (
    <div role="img" aria-label={product.name} className={cn("grid size-full place-items-center bg-gradient-to-br", toneWash[tone], className)}>
      <Icon className={cn("size-[34%] opacity-70", toneText[tone])} strokeWidth={1.2} aria-hidden />
    </div>
  );
}
