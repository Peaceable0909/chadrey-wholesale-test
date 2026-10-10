import * as React from "react";
import { ArrowUpDown, Heart, PackageSearch } from "lucide-react";
import { useSearchParams } from "wouter";
import { Button, ButtonLink, Chip, EmptyState, Notice, PageHeader, SearchField } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { BackToTop } from "@/components/store/BackToTop";
import { ProductCard, ProductGrid, ProductGridSkeleton } from "@/components/store/ProductCard";
import { QuickView } from "@/components/store/QuickView";
import { SampleNotice } from "@/components/store/SampleNotice";
import { useCatalogue, useCategoryCounts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import type { CatalogueSort, Product } from "@/lib/catalogue";
import { formatNumber } from "@/lib/format";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

const SORTS: Array<{ value: CatalogueSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "moq", label: "Lowest MOQ" },
  { value: "name", label: "Name A–Z" },
];

const isSort = (value: string | null): value is CatalogueSort => SORTS.some(sort => sort.value === value);

export default function Catalogue() {
  usePageTitle("Products");
  const [params, setParams] = useSearchParams();
  const saved = useSavedProducts();
  const { categories } = useCategoryCounts();
  const searchRef = React.useRef<HTMLInputElement>(null);

  const category = params.get("category") || "All";
  const sort = isSort(params.get("sort")) ? (params.get("sort") as CatalogueSort) : "newest";
  const savedOnly = params.get("saved") === "1";
  const urlQuery = params.get("q") ?? "";

  // Typing updates the box immediately; the URL (and the request) follow after a short pause.
  const [search, setSearch] = React.useState(urlQuery);
  React.useEffect(() => setSearch(urlQuery), [urlQuery]);
  React.useEffect(() => {
    if (search === urlQuery) return;
    const timer = window.setTimeout(() => update({ q: search }), 300);
    return () => window.clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (params.get("focus") === "1") {
      searchRef.current?.focus();
      update({ focus: "" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "All" && !(key === "sort" && value === "newest")) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const catalogue = useCatalogue({ q: urlQuery, category, sort, slugs: savedOnly ? saved.slugs : undefined });
  const [quickView, setQuickView] = React.useState<Product | null>(null);

  const chipNames = categories.map(item => item.category);
  if (category !== "All" && !chipNames.includes(category)) chipNames.unshift(category);
  const filtered = Boolean(urlQuery || savedOnly || category !== "All");

  return (
    <SiteLayout>
      <Container className="pt-4 md:pt-8">
        <PageHeader
          title="Products"
          subtitle={catalogue.isLoading ? "Loading the catalogue…" : `${formatNumber(catalogue.total)} ${catalogue.total === 1 ? "product" : "products"}, sourced in ${siteConfig.sourcingCountry}`}
          actions={
            <ButtonLink href="/quote" className="hidden md:inline-flex">
              Request a quote
            </ButtonLink>
          }
        />
      </Container>

      {/* Search and categories stay in view while scrolling, like the App Store */}
      <div className="material hairline-b sticky top-[calc(var(--nav-h)+env(safe-area-inset-top))] z-30 mt-4 py-3">
        <Container className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <SearchField
            ref={searchRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Search products"
            wrapperClassName="md:w-80 md:shrink-0"
          />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0" role="group" aria-label="Categories">
            <Chip selected={category === "All" && !savedOnly} onClick={() => update({ category: "All", saved: "" })}>
              All
            </Chip>
            {saved.slugs.length > 0 && (
              <Chip
                selected={savedOnly}
                icon={<Heart className={cn("size-3.5", savedOnly && "fill-current")} aria-hidden />}
                onClick={() => update({ saved: savedOnly ? "" : "1", category: "All" })}>
                Saved
              </Chip>
            )}
            {chipNames.map(name => (
              <Chip key={name} selected={category === name && !savedOnly} count={categories.find(item => item.category === name)?.count} onClick={() => update({ category: name, saved: "" })}>
                {name}
              </Chip>
            ))}
          </div>
        </Container>
      </div>

      <Container className="pt-5 md:pt-7">
        {catalogue.isSample && <SampleNotice className="mb-5" />}
        {catalogue.isError && !catalogue.isSample && (
          <Notice tone="red" className="mb-5">
            We could not load the catalogue.{" "}
            <button type="button" className="font-semibold underline" onClick={catalogue.retry}>
              Try again
            </button>
          </Notice>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-subhead text-label-2" aria-live="polite">
            {catalogue.isLoading ? "" : savedOnly ? "Saved products" : urlQuery ? `Results for “${urlQuery}”` : category !== "All" ? category : "All products"}
          </p>
          <label className="relative inline-flex h-9 items-center rounded-full bg-surface pl-3 pr-8 text-subhead shadow-[inset_0_0_0_0.5px_var(--separator-strong)]">
            <ArrowUpDown className="mr-1.5 size-4 text-label-2" aria-hidden />
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={event => update({ sort: event.target.value })}
              className="appearance-none bg-transparent pr-1 text-subhead font-medium outline-none">
              {SORTS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {catalogue.isLoading ? (
          <ProductGridSkeleton count={8} wide />
        ) : catalogue.items.length === 0 ? (
          <EmptyState
            icon={savedOnly ? Heart : PackageSearch}
            title={savedOnly ? "No saved products yet" : "No products found"}
            description={savedOnly ? "Tap the heart on a product to keep it here for later." : "Try a different search, or clear the filters to see everything."}
            action={
              filtered && (
                <Button variant="tinted" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <>
            <ProductGrid wide>
              {catalogue.items.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 4}
                  saved={saved.isSaved(product.slug)}
                  onToggleSave={() => saved.toggle(product.slug)}
                  onQuickView={() => setQuickView(product)}
                />
              ))}
            </ProductGrid>
            {catalogue.hasMore && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <Button variant="gray" size="lg" loading={catalogue.isLoadingMore} onClick={catalogue.loadMore}>
                  Show more products
                </Button>
                <p className="text-footnote text-label-2">
                  Showing {formatNumber(catalogue.items.length)} of {formatNumber(catalogue.total)}
                </p>
              </div>
            )}
          </>
        )}
      </Container>

      <QuickView product={quickView} onClose={() => setQuickView(null)} />
      <BackToTop />
    </SiteLayout>
  );
}
