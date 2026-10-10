import { Eye, Heart } from "lucide-react";
import { Link } from "wouter";
import { Badge, Skeleton } from "@/components/ios";
import type { Product } from "@/lib/catalogue";
import { formatMoney } from "@/lib/format";
import { productHref } from "@/lib/productRoute";
import { cn } from "@/lib/utils";
import { entryPrice, MoqLabel, PriceLabel } from "./Price";
import { ProductImage } from "./ProductImage";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isNew(product: Pick<Product, "createdAt" | "isSample">): boolean {
  if (product.isSample || !product.createdAt) return false;
  const age = Date.now() - new Date(product.createdAt).getTime();
  return age >= 0 && age < NEW_WINDOW_MS;
}

type ProductCardProps = {
  product: Product;
  saved?: boolean;
  onToggleSave?: () => void;
  /** Desktop only: a hover shortcut that previews the product without leaving the list. */
  onQuickView?: () => void;
  priority?: boolean;
  className?: string;
};

/**
 * Marketplace product tile: photo, name, price at the minimum order and the MOQ.
 * The whole card is one link (a stretched anchor), so the heart and quick view buttons stay separate targets.
 */
export function ProductCard({ product, saved = false, onToggleSave, onQuickView, priority, className }: ProductCardProps) {
  const price = entryPrice(product.pricing);
  const label = `${product.name}${price !== null ? `, ${formatMoney(price, product.pricing.currency)} per ${product.pricing.unit}` : ", price on request"}`;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card bg-surface shadow-card transition-[transform,box-shadow] duration-200 active:scale-[0.985] md:hover:-translate-y-0.5 md:hover:shadow-float",
        className,
      )}>
      <Link href={productHref(product.slug)} aria-label={label} className="absolute inset-0 z-10 rounded-card" />

      <div className="relative aspect-square overflow-hidden bg-fill-4">
        <ProductImage product={product} priority={priority} className="transition-transform duration-500 md:group-hover:scale-[1.04]" />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {product.isSample ? (
            <Badge tone="gray" className="bg-surface/90 backdrop-blur">
              Sample
            </Badge>
          ) : isNew(product) ? (
            <Badge tone="green" className="bg-surface/90 backdrop-blur">
              New
            </Badge>
          ) : null}
        </div>
        {onToggleSave && (
          <button
            type="button"
            aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
            aria-pressed={saved}
            onClick={onToggleSave}
            className="material press absolute right-2 top-2 z-20 grid size-9 place-items-center rounded-full">
            <Heart className={cn("size-[18px] transition-colors", saved ? "fill-ios-red text-ios-red" : "text-label")} strokeWidth={2} />
          </button>
        )}
        {onQuickView && (
          <button
            type="button"
            onClick={onQuickView}
            className="material absolute inset-x-3 bottom-3 z-20 hidden h-9 translate-y-1 items-center justify-center gap-1.5 rounded-full text-subhead font-semibold opacity-0 transition-all focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:flex">
            <Eye className="size-4" aria-hidden />
            Quick view
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <p className="truncate text-caption font-medium text-label-2">{product.category}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.75em] text-subhead font-semibold leading-snug">{product.name}</h3>
        <div className="mt-auto flex flex-col gap-0.5 pt-2">
          <PriceLabel pricing={product.pricing} />
          <MoqLabel moq={product.moq} unit={product.pricing.unit} />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-card bg-surface shadow-card">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2.5 p-3.5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
      </div>
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4";

/** Responsive product grid: 2 columns on phones, more as the screen grows. */
export function ProductGrid({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn(GRID, wide ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
}

export function ProductGridSkeleton({ count = 8, wide = false }: { count?: number; wide?: boolean }) {
  return (
    <ProductGrid wide={wide}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </ProductGrid>
  );
}

/** Horizontal swipe rail on phones, a regular grid on desktop. */
export function ProductRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-pl-6 sm:px-6 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 md:pb-0",
        "[&>*]:w-[44vw] [&>*]:max-w-[210px] [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-auto md:[&>*]:max-w-none",
        className,
      )}>
      {children}
    </div>
  );
}
