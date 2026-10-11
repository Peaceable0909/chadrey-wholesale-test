import * as React from "react";
import { ChevronDown, FilePlus2, Heart, PackageSearch, Search, Tag, X } from "lucide-react";
import { useSearchParams } from "wouter";
import { Button, ButtonLink, Chip, EmptyState, SearchField, Skeleton } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { BackToTop } from "@/components/store/BackToTop";
import { ProductCard, ProductGrid, ProductGridSkeleton } from "@/components/store/ProductCard";
import { QuickView } from "@/components/store/QuickView";
import { SampleNotice } from "@/components/store/SampleNotice";
import { useCatalogue, useCategoryCounts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import { activeFilters, type ActiveFilter } from "@/lib/catalogueView";
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

const FILTER_ICONS = { category: Tag, q: Search, saved: Heart } as const;

/** A native select (so phones show their own picker), with a visible label and a chevron. */
function SortSelect({ value, onChange }: { value: CatalogueSort; onChange: (value: CatalogueSort) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-footnote font-medium text-label-2">
      <span>Sort by</span>
      <span className="relative">
        <select
          value={value}
          onChange={event => onChange(event.target.value as CatalogueSort)}
          className="h-10 appearance-none rounded-control border border-control bg-surface pl-3 pr-9 text-subhead font-medium text-label transition-colors hover:border-label-2">
          {SORTS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-label-2" aria-hidden />
      </span>
    </label>
  );
}

function FilterPill({ filter, onRemove }: { filter: ActiveFilter; onRemove: () => void }) {
  const Icon = FILTER_ICONS[filter.key];
  const what = filter.key === "category" ? "category" : filter.key === "q" ? "search" : "saved";
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${what} filter: ${filter.label}`}
      className="press inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-fill-3 pl-3 pr-2.5 text-footnote font-medium text-label transition-colors hover:bg-fill-2">
      <Icon className="size-3.5 shrink-0 text-label-2" aria-hidden />
      <span className="truncate">{filter.label}</span>
      <X className="size-3.5 shrink-0 text-label-2" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

export default function Catalogue() {
  usePageTitle("Wholesale Products");
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

  /** Removes every filter (search, category, saved) but keeps the chosen sort order. */
  function clearFilters() {
    update({ q: "", category: "All", saved: "" });
  }

  const catalogue = useCatalogue({ q: urlQuery, category, sort, slugs: savedOnly ? saved.slugs : undefined });
  const [quickView, setQuickView] = React.useState<Product | null>(null);

  const chipNames = categories.map(item => item.category);
  if (category !== "All" && !chipNames.includes(category)) chipNames.unshift(category);
  const countOf = (name: string) => categories.find(item => item.category === name)?.count;
  const everything = categories.length ? categories.reduce((sum, item) => sum + item.count, 0) : undefined;

  const filters = activeFilters({ q: urlQuery, category, savedOnly });
  const filtered = filters.length > 0;
  const removeFilter = (key: ActiveFilter["key"]) => update(key === "category" ? { category: "All" } : key === "q" ? { q: "" } : { saved: "" });

  const shown = catalogue.items.length;
  const total = catalogue.total;

  return (
    <SiteLayout background="white">
      <Container className="pt-5 md:pt-8">
        <header className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
          <h1 className="col-start-1 row-start-1 min-w-0 text-title2 font-bold leading-tight tracking-tight md:text-largetitle">Wholesale Products</h1>
          {/* Phones and tablets: the top bar has no quote button there. On the very narrowest phones it gets a row of its own instead of squeezing the title. */}
          <ButtonLink href="/quote" size="sm" className="col-start-2 row-start-1 max-[339px]:col-span-2 max-[339px]:col-start-1 max-[339px]:row-start-3 max-[339px]:mt-1 max-[339px]:w-full md:hidden">
            <FilePlus2 className="size-4" aria-hidden />
            Request a Quote
          </ButtonLink>
          <p className="col-span-2 row-start-2 max-w-2xl text-subhead text-label-2 md:text-body">
            Browse our range of goods sourced in {siteConfig.sourcingCountry} and request a wholesale quotation. Prices are indicative and confirmed in your quotation.
          </p>
        </header>
      </Container>

      {/* Search and categories stay in view while scrolling */}
      <div className="sticky top-[calc(var(--nav-h)+env(safe-area-inset-top))] z-30 mt-4 border-y border-separator bg-surface/95 py-3 backdrop-blur-md md:mt-6">
        <Container className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <SearchField ref={searchRef} value={search} onValueChange={setSearch} placeholder="Search products" wrapperClassName="lg:w-[22rem] lg:shrink-0" />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:min-w-0 lg:flex-1 lg:px-0" role="group" aria-label="Categories">
            <Chip selected={category === "All" && !savedOnly} count={everything} onClick={() => update({ category: "All", saved: "" })}>
              All
            </Chip>
            {saved.slugs.length > 0 && (
              <Chip
                selected={savedOnly}
                count={saved.slugs.length}
                icon={<Heart className={cn("size-3.5", savedOnly && "fill-current")} aria-hidden />}
                onClick={() => update({ saved: savedOnly ? "" : "1", category: "All" })}>
                Saved
              </Chip>
            )}
            {chipNames.map(name => (
              <Chip key={name} selected={category === name && !savedOnly} count={countOf(name)} onClick={() => update({ category: name, saved: "" })}>
                {name}
              </Chip>
            ))}
          </div>
        </Container>
      </div>

      <Container className="pt-5 md:pt-6">
        {catalogue.isSample && <SampleNotice className="mb-5" loadFailed={catalogue.isError} onRetry={catalogue.retry} />}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="min-h-6 text-subhead text-label-2" aria-live="polite">
            {catalogue.isLoading ? (
              <Skeleton className="h-5 w-28" />
            ) : (
              <>
                <strong className="font-semibold text-label">{formatNumber(total)}</strong> {total === 1 ? "product" : "products"}
              </>
            )}
          </p>
          <SortSelect value={sort} onChange={value => update({ sort: value })} />
        </div>

        {filtered && (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Active filters">
            {filters.map(filter => (
              <FilterPill key={filter.key} filter={filter} onRemove={() => removeFilter(filter.key)} />
            ))}
            <Button variant="plain" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}

        <div className="mt-5">
          {catalogue.isLoading ? (
            <ProductGridSkeleton count={8} wide />
          ) : shown === 0 ? (
            <EmptyState
              icon={savedOnly ? Heart : PackageSearch}
              title={savedOnly ? "No saved products yet" : urlQuery ? `No products match “${urlQuery}”` : category !== "All" ? `No products in ${category} yet` : "No products yet"}
              description={
                savedOnly
                  ? "Tap the heart on a product to keep it here for later."
                  : filtered
                    ? "Check the spelling, try a shorter or more general word, or clear the filters to see everything."
                    : "New products are added regularly. You can still tell us what you are looking for and we will source it."
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {filtered && (
                    <Button variant="navy" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                  <ButtonLink href="/quote" variant={filtered ? "outline" : "filled"}>
                    <FilePlus2 className="size-[18px]" aria-hidden />
                    Can’t find it? Request a Quote
                  </ButtonLink>
                </div>
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
                    headingLevel="h2"
                    saved={saved.isSaved(product.slug)}
                    onToggleSave={() => saved.toggle(product.slug)}
                    onQuickView={() => setQuickView(product)}
                  />
                ))}
              </ProductGrid>

              {catalogue.hasMore ? (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <p className="text-footnote text-label-2" aria-live="polite">
                    Showing {formatNumber(shown)} of {formatNumber(total)}
                  </p>
                  <div className="h-1 w-48 overflow-hidden rounded-full bg-fill-3" aria-hidden>
                    <div className="h-full rounded-full bg-label" style={{ width: `${Math.min(100, Math.round((shown / Math.max(total, 1)) * 100))}%` }} />
                  </div>
                  <Button variant="outline" size="lg" loading={catalogue.isLoadingMore} onClick={catalogue.loadMore} className="min-w-56">
                    Show more products
                  </Button>
                </div>
              ) : (
                total > 24 && <p className="mt-10 text-center text-footnote text-label-2">All {formatNumber(total)} products are shown.</p>
              )}
            </>
          )}
        </div>
      </Container>

      <QuickView product={quickView} onClose={() => setQuickView(null)} />
      <BackToTop />
    </SiteLayout>
  );
}
