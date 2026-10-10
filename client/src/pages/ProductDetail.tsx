import * as React from "react";
import { ArrowRight, Boxes, Heart, MapPin, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { Link, useSearch } from "wouter";
import { Badge, BackLink, Button, ButtonLink, Card, Chip, Field, ListGroup, ListRow, Notice, SectionHeader, SelectInput, Skeleton, Stepper } from "@/components/ios";
import { stepForMoq } from "@/components/ios/Stepper";
import { CenteredState } from "@/components/layout/PageState";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import FormattedDescription from "@/components/FormattedDescription";
import ProductShareButton from "@/components/ProductShareButton";
import { entryPrice, TierTable } from "@/components/store/Price";
import { ProductCard, ProductRail } from "@/components/store/ProductCard";
import { ProductGallery } from "@/components/store/ProductGallery";
import { SampleNotice } from "@/components/store/SampleNotice";
import { useProduct, useRelatedProducts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProductMeta } from "@/hooks/useProductMeta";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import type { Product } from "@/lib/catalogue";
import { formatMoney, formatQty } from "@/lib/format";
import { hasPrice, lineTotal, unitPriceFor } from "@/lib/pricing";
import { productHref, productSlugFromLocation } from "@/lib/productRoute";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

const CHIP_LIMIT = 8;

/** Only the specs the buyer actually picked are carried into the quote form. */
function buildQuoteHref(product: Product, quantity: number, selections: Record<string, string>): string {
  const params = new URLSearchParams({ product: product.slug, qty: String(quantity) });
  for (const [key, value] of Object.entries(selections)) if (value) params.set(key, value);
  return `/quote?${params.toString()}`;
}

function DetailSkeleton() {
  return (
    <SiteLayout tabBar={false}>
      <Container className="pt-4 md:pt-8">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-card" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-40 rounded-group" />
            <Skeleton className="h-24 rounded-group" />
          </div>
        </div>
      </Container>
    </SiteLayout>
  );
}

function OptionPicker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  if (options.length > CHIP_LIMIT) {
    return (
      <Field label={label} optional>
        <SelectInput value={value} onChange={event => onChange(event.target.value)}>
          <option value="">Not specified</option>
          {options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </Field>
    );
  }
  return (
    <Field label={label} optional as="div">
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(option => (
          <Chip key={option} selected={value === option} onClick={() => onChange(value === option ? "" : option)}>
            {option}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

export default function ProductDetail() {
  const search = useSearch();
  const slug = productSlugFromLocation(`/product?${search}`);
  const { product, isLoading, notFound, loadFailed, isSample } = useProduct(slug);
  const saved = useSavedProducts();
  const related = useRelatedProducts(product);
  const recent = useRecentlyViewed(product);
  usePageTitle(product?.name);
  useProductMeta(product);

  const [quantity, setQuantity] = React.useState(1);
  const [selections, setSelections] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (product) {
      setQuantity(product.moq);
      setSelections({});
    }
  }, [product?.slug, product?.moq]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <DetailSkeleton />;
  if (notFound || !product) {
    return (
      <SiteLayout tabBar={false}>
        <CenteredState icon={PackageSearch} tone="gray" title="Product not found" description={loadFailed ? "We could not load this product right now. Please try again." : "This product may have been removed or the link is out of date."}>
          <ButtonLink href="/products" size="lg">
            Browse products
          </ButtonLink>
        </CenteredState>
      </SiteLayout>
    );
  }

  const { pricing } = product;
  const priced = hasPrice(pricing);
  const unitPrice = unitPriceFor(pricing, quantity);
  const total = lineTotal(pricing, quantity);
  const quoteHref = buildQuoteHref(product, quantity, selections);
  const isSaved = saved.isSaved(product.slug);
  const startingPrice = entryPrice(pricing);

  return (
    <SiteLayout tabBar={false} className="pb-32 md:pb-0">
      <Container className="pt-2 md:pt-6">
        <BackLink href="/products">Products</BackLink>

        <div className="mt-2 grid gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div className="md:sticky md:top-[calc(var(--nav-h)+24px)] md:self-start">
            <ProductGallery product={product} />
          </div>

          <div className="space-y-5">
            <header>
              <div className="flex items-center gap-2">
                <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="text-footnote font-semibold uppercase tracking-wider text-tint-text">
                  {product.category}
                </Link>
                {isSample && <Badge tone="gray">Sample</Badge>}
              </div>
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <h1 className="text-title1 font-bold md:text-[2rem] md:leading-tight">{product.name}</h1>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <Button variant="gray" size="icon" aria-pressed={isSaved} aria-label={isSaved ? "Remove from saved" : "Save product"} onClick={() => saved.toggle(product.slug)}>
                    <Heart className={cn("size-5", isSaved && "fill-ios-red text-ios-red")} strokeWidth={1.9} />
                  </Button>
                  <ProductShareButton url={productHref(product.slug)} name={product.name} description={product.summary} />
                </div>
              </div>
              {product.summary && <p className="mt-2 text-body text-label-2">{product.summary}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="blue">MOQ {formatQty(product.moq, pricing.unit)}</Badge>
                <Badge tone="teal">
                  <MapPin className="size-3" aria-hidden />
                  Sourced in {siteConfig.sourcingCountry}
                </Badge>
              </div>
            </header>

            {isSample && <SampleNotice />}
            {loadFailed && !isSample && <Notice tone="orange">Showing saved details. We could not refresh this product.</Notice>}

            <Card className="p-5">
              {priced && unitPrice !== null ? (
                <>
                  <p className="text-footnote font-medium uppercase tracking-wide text-label-2">Price per {pricing.unit} at {formatQty(quantity, pricing.unit)}</p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-largetitle font-bold tabular-nums">{formatMoney(unitPrice, pricing.currency)}</span>
                    <span className="text-callout text-label-2">/ {pricing.unit}</span>
                  </p>
                  {pricing.tiers.length > 1 && <TierTable pricing={pricing} quantity={quantity} className="mt-4 bg-canvas" />}
                  <div className="mt-4 flex items-center justify-between gap-4 border-t border-separator pt-4">
                    <span className="text-body text-label-2">Estimated total</span>
                    <span className="text-title3 font-bold tabular-nums">{total !== null ? formatMoney(total, pricing.currency) : "—"}</span>
                  </div>
                  <p className="mt-2 text-footnote text-label-2">{siteConfig.priceDisclaimer}</p>
                </>
              ) : (
                <>
                  <p className="text-title3 font-bold">Price on request</p>
                  <p className="mt-1 text-subhead text-label-2">Send a quote request and we will reply with pricing for your quantity.</p>
                </>
              )}
            </Card>

            <Card className="space-y-5 p-5">
              <Field label="Quantity" as="div" hint={`Minimum order is ${formatQty(product.moq, pricing.unit)}.`}>
                <Stepper label="Quantity" value={quantity} min={product.moq} step={stepForMoq(product.moq)} onChange={setQuantity} />
              </Field>
              {product.optionGroups.map(group => (
                <OptionPicker
                  key={group.key}
                  label={group.label}
                  options={group.options}
                  value={selections[group.key] ?? ""}
                  onChange={value => setSelections(current => ({ ...current, [group.key]: value }))}
                />
              ))}
              {product.optionGroups.length > 0 && <p className="text-footnote text-label-2">Specs are optional. You can adjust them, or add anything else, in your quote request.</p>}
            </Card>

            <div className="hidden gap-3 md:flex">
              {isSample ? (
                <ButtonLink href="/products" size="lg" full>
                  Browse live products
                </ButtonLink>
              ) : (
                <ButtonLink href={quoteHref} size="lg" full>
                  Request a quote <ArrowRight className="size-5" aria-hidden />
                </ButtonLink>
              )}
              <ButtonLink href="/contact" variant="gray" size="lg">
                Ask a question
              </ButtonLink>
            </div>

            <ListGroup header="Buying information">
              <ListRow icon={<Boxes />} tone="blue" title="Minimum order" value={formatQty(product.moq, pricing.unit)} />
              <ListRow icon={<Truck />} tone="teal" title="Lead time" value={siteConfig.leadTime} />
              <ListRow icon={<ShieldCheck />} tone="green" title="Pricing" value="Confirmed by quotation" />
            </ListGroup>

            {product.description.trim() && (
              <section>
                <h2 className="px-4 pb-2 text-footnote font-medium uppercase tracking-wide text-label-2">About this product</h2>
                <Card className="p-5">
                  <FormattedDescription text={product.description} omitLeadingTitle={product.name} />
                </Card>
              </section>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-12 md:mt-16" aria-labelledby="related-heading">
            <SectionHeader title={<span id="related-heading">More in {product.category}</span>} action={<Link href={`/products?category=${encodeURIComponent(product.category)}`} className="text-subhead text-tint-text">See all</Link>} />
            <div className="mt-4">
              <ProductRail>
                {related.slice(0, 4).map(item => (
                  <ProductCard key={item.id} product={item} saved={saved.isSaved(item.slug)} onToggleSave={() => saved.toggle(item.slug)} />
                ))}
              </ProductRail>
            </div>
          </section>
        )}

        {recent.items.length > 0 && (
          <section className="mt-12 md:mt-16" aria-labelledby="recent-heading">
            <SectionHeader title={<span id="recent-heading">Recently viewed</span>} action={<button type="button" onClick={recent.clear} className="text-subhead text-tint-text">Clear</button>} />
            <div className="mt-4">
              <ProductRail>
                {recent.items.slice(0, 4).map(item => (
                  <ProductCard key={item.slug} product={item} saved={saved.isSaved(item.slug)} onToggleSave={() => saved.toggle(item.slug)} />
                ))}
              </ProductRail>
            </div>
          </section>
        )}
      </Container>

      {/* Sticky action bar for phones; the same actions sit inline on larger screens */}
      <div className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div className="gutter flex items-center gap-3 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            {priced && total !== null ? (
              <>
                <p className="text-caption text-label-2">Est. total · {formatQty(quantity, pricing.unit)}</p>
                <p className="truncate text-headline font-bold tabular-nums">{formatMoney(total, pricing.currency)}</p>
              </>
            ) : (
              <>
                <p className="text-caption text-label-2">{startingPrice === null ? "Pricing" : "Price"}</p>
                <p className="truncate text-headline font-bold">On request</p>
              </>
            )}
          </div>
          {isSample ? (
            <ButtonLink href="/products" size="lg">
              Browse products
            </ButtonLink>
          ) : (
            <ButtonLink href={quoteHref} size="lg" className="px-7">
              Request a quote
            </ButtonLink>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
