import * as React from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Button, ButtonLink, Card, EmptyState, Notice, SearchField, SegmentedControl, Switch } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PriceLabel } from "@/components/store/Price";
import { ProductImage } from "@/components/store/ProductImage";
import { useCategoryCounts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { fetchAdminProductsPage, type AdminStatusFilter } from "@/lib/catalogueApi";
import { formatNumber, formatQty } from "@/lib/format";
import { setProductActive } from "@/lib/productWriteApi";
import { errorMessage } from "@/lib/supabaseCompat";
import { cn } from "@/lib/utils";

export default function AdminProducts() {
  usePageTitle("Products");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const { categories } = useCategoryCounts();
  const [search, setSearch] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [status, setStatus] = React.useState<AdminStatusFilter>("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // Switch flips instantly; the list catches up when it refetches.
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const list = useInfiniteQuery({
    queryKey: ["admin-products", term, status],
    queryFn: ({ pageParam }) => fetchAdminProductsPage({ q: term, status }, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const items = list.data?.pages.flatMap(page => page.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const editing = items.find(product => product.id === editingId) ?? null;
  const refresh = React.useCallback(async () => {
    setOverrides({});
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    void queryClient.invalidateQueries({ queryKey: ["catalogue"] });
    void queryClient.invalidateQueries({ queryKey: ["product"] });
    void queryClient.invalidateQueries({ queryKey: ["category-counts"] });
  }, [queryClient]);

  async function toggleActive(id: string, next: boolean) {
    setOverrides(current => ({ ...current, [id]: next }));
    try {
      await setProductActive(id, next);
      toast.success(next ? "Now visible in the store" : "Hidden from the store");
      await refresh();
    } catch (caught) {
      setOverrides(current => {
        const { [id]: _reverted, ...rest } = current;
        return rest;
      });
      toast.error(errorMessage(caught, "Could not change visibility"));
    }
  }

  return (
    <AdminLayout
      title="Products"
      subtitle={list.isPending ? "Loading…" : `${formatNumber(total)} ${total === 1 ? "product" : "products"}`}
      actions={
        <ButtonLink href="/admin/products/new" className="hidden lg:inline-flex">
          <PackagePlus className="size-5" aria-hidden /> Add product
        </ButtonLink>
      }>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchField value={search} onValueChange={setSearch} placeholder="Search by name or category" wrapperClassName="md:flex-1" />
          <SegmentedControl
            aria-label="Filter by visibility"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "live", label: "Live" },
              { value: "hidden", label: "Hidden" },
            ]}
            className="md:w-64"
          />
        </div>

        {list.isError && <Notice tone="red">{errorMessage(list.error, "We could not load the products.")}</Notice>}

        {list.isPending ? (
          <Card className="divide-y divide-separator">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 p-4" aria-hidden>
                <div className="skeleton size-14 rounded-[12px]" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={PackageSearch}
              title={term || status !== "all" ? "No matching products" : "No products yet"}
              description={term || status !== "all" ? "Try a different search or filter." : "Add your first product and it will appear in the store straight away."}
              action={
                !term && status === "all" ? (
                  <ButtonLink href="/admin/products/new" size="lg">
                    <PackagePlus className="size-5" aria-hidden /> Add product
                  </ButtonLink>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <ul>
                {items.map(product => {
                  const active = overrides[product.id] ?? product.isActive;
                  return (
                    <li key={product.id} className="row-separator flex items-center gap-3 px-4 py-3 [--sep-inset:84px]">
                      <button type="button" onClick={() => setEditingId(product.id)} className="press flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${product.name}`}>
                        <span className={cn("size-14 shrink-0 overflow-hidden rounded-[12px] bg-fill-4", !active && "opacity-50")}>
                          <ProductImage product={product} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-body font-semibold leading-snug">{product.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                            <PriceLabel pricing={product.pricing} className="text-subhead [&>span:first-child]:text-subhead" />
                            <span className="whitespace-nowrap text-footnote text-label-2">MOQ {formatQty(product.moq, product.pricing.unit)}</span>
                          </span>
                          <span className="block truncate text-footnote text-label-2">{product.category}</span>
                        </span>
                      </button>
                      <Switch checked={active} onCheckedChange={next => void toggleActive(product.id, next)} aria-label={`${product.name} is ${active ? "visible" : "hidden"} in the store`} />
                    </li>
                  );
                })}
              </ul>
            </Card>
            {list.hasNextPage && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <Button variant="gray" size="lg" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                  Show more
                </Button>
                <p className="text-footnote text-label-2">
                  Showing {formatNumber(items.length)} of {formatNumber(total)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <ProductEditor product={editing} knownCategories={categories.map(item => item.category)} onClose={() => setEditingId(null)} onChanged={refresh} />
    </AdminLayout>
  );
}
