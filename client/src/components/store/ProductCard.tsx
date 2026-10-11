import { Eye, Heart } from "lucide-react";
import { Link } from "wouter";
import { ButtonLink, Skeleton } from "@/components/ios";
import type { Product } from "@/lib/catalogue";
import { variationSummary } from "@/lib/catalogueView";
import { formatMoney } from "@/lib/format";
import { productHref, quoteHref } from "@/lib/productRoute";
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
  /** Opens a preview of the product without leaving the list. Always visible, so it works on a phone too. */
  onQuickView?: () => void;
  priority?: boolean;
  /** How far outside the screen the photo may be before it loads; rails pass "0px" so only visible cards fetch photos. */
  imageMargin?: string;
  /** The product name's heading level, so headings never skip a level: h2 under the page title, h3 under a section title. */
  headingLevel?: "h2" | "h3";
  className?: string;
};

/** The round white buttons that sit on a product photo. 40px wide, so a thumb can hit them. */
const photoButton =
  "press absolute z-20 grid size-10 place-items-center rounded-full bg-surface/95 text-label shadow-sm ring-1 ring-separator transition-colors hover:bg-surface";

/**
 * Marketplace product tile: photo, category, name, price at the minimum order, the MOQ and one clear action.
 * The whole card is one link (a stretched anchor); the heart, quick view and quote buttons are separate targets above it.
 * Nothing important appears only on hover, so every action is there on a phone.
 */
export function ProductCard({ product, saved = false, onToggleSave, onQuickView, priority, imageMargin, headingLevel: Heading = "h3", className }: ProductCardProps) {
  const price = entryPrice(product.pricing);
  const label = `${product.name}${price !== null ? `, ${formatMoney(price, product.pricing.currency)} per ${product.pricing.unit}` : ", price on request"}`;
  const variations = variationSummary(product.optionGroups);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-tile border border-separator bg-surface transition-[border-color,box-shadow] duration-200 hover:border-separator-strong hover:shadow-card",
        // The stretched link is clipped by the card's rounded edge, so its focus ring is drawn around the whole card instead.
        "has-[>a:focus-visible]:ring-2 has-[>a:focus-visible]:ring-[var(--focus-ring)] has-[>a:focus-visible]:ring-offset-2 has-[>a:focus-visible]:ring-offset-[var(--surface)]",
        className,
      )}>
      <Link href={productHref(product.slug)} aria-label={label} className="absolute inset-0 z-10 rounded-tile outline-none" />

      <div className="relative aspect-square overflow-hidden bg-fill-4">
        <ProductImage product={product} fit="auto" fade caption priority={priority} margin={imageMargin} className="transition-transform duration-500 md:group-hover:scale-[1.03]" />
        {(product.isSample || isNew(product)) && (
          <span
            className={cn(
              "absolute left-2.5 top-2.5 inline-flex h-6 items-center rounded-md px-2 text-caption font-semibold",
              product.isSample ? "bg-surface/95 text-label-2 ring-1 ring-separator" : "bg-tint text-on-tint",
            )}>
            {product.isSample ? "Sample" : "New"}
          </span>
        )}
        {onToggleSave && (
          <button type="button" aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`} aria-pressed={saved} onClick={onToggleSave} className={cn(photoButton, "right-2 top-2")}>
            <Heart className={cn("size-5 transition-colors", saved ? "fill-tint" : "fill-transparent")} strokeWidth={2} aria-hidden />
          </button>
        )}
        {onQuickView && (
          <button type="button" aria-label={`Quick view: ${product.name}`} title="Quick view" onClick={onQuickView} className={cn(photoButton, "bottom-2 right-2")}>
            <Eye className="size-5" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="truncate text-caption font-semibold uppercase tracking-wide text-label-2">{product.category}</p>
        <Heading className="mt-1 line-clamp-2 text-subhead font-semibold leading-snug text-label">{product.name}</Heading>
        {variations && <p className="mt-1 truncate text-caption text-label-2">{variations}</p>}

        <div className="mt-auto flex flex-col gap-0.5 pt-3">
          <PriceLabel pricing={product.pricing} />
          <MoqLabel moq={product.moq} unit={product.pricing.unit} />
        </div>

        <div className="relative z-20 mt-3">
          {product.isSample ? (
            <ButtonLink href={productHref(product.slug)} variant="outline" size="sm" full>
              View details
            </ButtonLink>
          ) : (
            <ButtonLink href={quoteHref(product.slug)} size="sm" full aria-label={`Request quote for ${product.name}`}>
              Request quote
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  );
}

/** Same shape as a real card, so the page does not jump when products arrive. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="flex h-full flex-col overflow-hidden rounded-tile border border-separator bg-surface">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-2 h-4 w-11/12" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
        <div className="mt-auto pt-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-1.5 h-3.5 w-1/3" />
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-control" />
      </div>
    </div>
  );
}

/** Two columns on phones (one on the very narrowest), three on tablets, four on desktop. */
const GRID = "grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:gap-5";

/** Responsive product grid. `wide` is the main catalogue (four columns on desktop); otherwise a narrower three. */
export function ProductGrid({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn(GRID, wide ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
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
