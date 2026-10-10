import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { fetchCategoryCounts, fetchProductBySlug, fetchProductsPage, fetchRelatedProducts } from "@/lib/catalogueApi";
import { tallyCategories, type CatalogueQuery, type CategoryCount, type Product, type ProductPage } from "@/lib/catalogue";
import { findSample, querySamples, sampleProducts } from "@/lib/sampleProducts";

const STALE_MS = 60_000;

const isUnfiltered = (query: CatalogueQuery) => !query.q.trim() && (!query.category || query.category === "All") && !query.slugs;

/**
 * Paged, searchable product list. Falls back to the built-in demo products only when the live
 * catalogue is unreachable, or is completely empty and no filter is applied.
 */
export function useCatalogue(query: CatalogueQuery) {
  const live = useInfiniteQuery({
    queryKey: ["catalogue", query],
    queryFn: ({ pageParam }) => fetchProductsPage(query, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    staleTime: STALE_MS,
    retry: 1,
  });

  const liveTotal = live.data?.pages[0]?.total ?? 0;
  const useSamples = live.isError || (live.isSuccess && liveTotal === 0 && isUnfiltered(query));
  const items = useSamples ? querySamples(query) : (live.data?.pages.flatMap(page => page.items) ?? []);

  return {
    items,
    total: useSamples ? items.length : liveTotal,
    isSample: useSamples,
    isLoading: live.isPending,
    isError: live.isError,
    hasMore: !useSamples && Boolean(live.hasNextPage),
    isLoadingMore: live.isFetchingNextPage,
    loadMore: () => void live.fetchNextPage(),
    retry: () => void live.refetch(),
  };
}

/** Category chips and home tiles, derived from the real catalogue. */
export function useCategoryCounts(): { categories: CategoryCount[]; isLoading: boolean; isSample: boolean } {
  const query = useQuery({ queryKey: ["category-counts"], queryFn: fetchCategoryCounts, staleTime: 5 * 60_000, retry: 1 });
  const useSamples = query.isError || (query.isSuccess && query.data.length === 0);
  return {
    categories: useSamples ? tallyCategories(sampleProducts.map(product => ({ category: product.category }))) : (query.data ?? []),
    isLoading: query.isPending,
    isSample: useSamples,
  };
}

/** Looks through already-loaded catalogue pages so a product page can paint instantly from the list. */
function findCachedProduct(queryClient: QueryClient, slug: string): Product | undefined {
  for (const [, data] of queryClient.getQueriesData<InfiniteData<ProductPage>>({ queryKey: ["catalogue"] })) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find(item => item.slug === slug);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function useProduct(slug: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug),
    enabled: Boolean(slug),
    staleTime: STALE_MS,
    retry: 1,
    placeholderData: () => findCachedProduct(queryClient, slug),
  });

  const settled = query.isError || (query.isSuccess && !query.data);
  const product = query.data ?? (settled ? (findSample(slug) ?? null) : null);

  return {
    product,
    isLoading: Boolean(slug) && query.isPending && !product,
    isSample: Boolean(product?.isSample),
    notFound: !slug || (settled && !product),
    loadFailed: query.isError && !product,
  };
}

export function useRelatedProducts(product: Pick<Product, "slug" | "category" | "isSample"> | null | undefined) {
  const query = useQuery({
    queryKey: ["related", product?.slug],
    queryFn: () => fetchRelatedProducts(product!),
    enabled: Boolean(product) && !product?.isSample,
    staleTime: STALE_MS,
    retry: 1,
  });
  if (product?.isSample) {
    return sampleProducts.filter(item => item.slug !== product.slug && item.category === product.category).slice(0, 8);
  }
  return query.data ?? [];
}
