import * as React from "react";
import { categoryMeta } from "@/lib/categories";
import type { Product } from "@/lib/catalogue";
import { cn } from "@/lib/utils";
import { toneText, toneWash } from "@/components/ios/tone";

type ProductImageProps = {
  product: Pick<Product, "name" | "category" | "images">;
  /** Index into the product's images. */
  index?: number;
  className?: string;
  fit?: "cover" | "contain";
  priority?: boolean;
};

/** The product photo, or a soft category-coloured tile when the product has none yet or the photo cannot be loaded. */
export function ProductImage({ product, index = 0, className, fit = "cover", priority = false }: ProductImageProps) {
  const image = product.images[index];
  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  if (image && image.url !== brokenUrl) {
    return (
      <img
        src={image.url}
        alt={image.alt || (image.label ? `${product.name} – ${image.label}` : product.name)}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
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
