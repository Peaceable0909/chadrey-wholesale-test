import * as React from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PackagePlus, PackageSearch, Pencil } from "lucide-react";
import { toast } from "sonner";
import { isUncategorised } from "@shared/productMessage";
import { useAuth } from "@/_core/hooks/useAuth";
import { BulkBar } from "@/components/admin/BulkBar";
import { BulkCategorySheet } from "@/components/admin/BulkCategorySheet";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { LegacyCopyCard } from "@/components/admin/LegacyCopyCard";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, SearchField, SegmentedControl, Switch } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PriceLabel } from "@/components/store/Price";
import { ProductImage } from "@/components/store/ProductImage";
import { useCategoryCounts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { countOf, deleteSummary, selectionOf, splitSelection, toggleSelection, type Selection } from "@/lib/bulkSelection";
import { fetchAdminProductsPage, fetchAdminSummaries, fetchHiddenCount, type AdminStatusFilter, type AdminSummary } from "@/lib/catalogueApi";
import type { Product } from "@/lib/catalogue";
import { formatNumber, formatQty } from "@/lib/format";
import { hasPrice } from "@/lib/pricing";
import { deleteProductsBulk, setProductActive, setProductsActive, setProductsCategory } from "@/lib/productWriteApi";
import { errorMessage } from "@/lib/supabaseCompat";
import { cn } from "@/lib/utils";

/** Products made from Telegram messages link here with ?status=hidden, to review what is waiting. */
function statusFromAddress(): AdminStatusFilter {
  const value = new URLSearchParams(window.location.search).get("status");
  return value === "live" || value === "hidden" ? value : "all";
}

type RowProps = {
  product: Product;
  active: boolean;
  selecting: boolean;
  picked: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onActive: (next: boolean) => void;
};

function AdminProductRow({ product, active, selecting, picked, onOpen, onToggle, onActive }: RowProps) {
  const flags = [
    isUncategorised(product.category) && { label: "No category", tone: "orange" as const },
    !hasPrice(product.pricing) && { label: "No price", tone: "orange" as const },
    product.images.length === 0 && { label: "No photo", tone: "red" as const },
  ].filter((flag): flag is { label: string; tone: "orange" | "red" } => Boolean(flag));

  const summary = (
    <>
      <span className={cn("size-14 shrink-0 overflow-hidden rounded-[12px] bg-fill-4", !active && "opacity-50")}>
        <ProductImage product={product} variant="thumb" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-body font-semibold leading-snug">{product.name}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <PriceLabel pricing={product.pricing} className="text-subhead [&>span:first-child]:text-subhead" />
          <span className="whitespace-nowrap text-footnote text-label-2">MOQ {formatQty(product.moq, product.pricing.unit)}</span>
        </span>
        <span className="block truncate text-footnote text-label-2">
          {isUncategorised(product.category) ? "" : `${product.category} · `}
          {countOf(product.images.length, "photo")}
        </span>
        {flags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {flags.map(flag => (
              <Badge key={flag.label} tone={flag.tone}>
                {flag.label}
              </Badge>
            ))}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li className={cn("row-separator flex items-center gap-3 px-4 py-3 [--sep-inset:84px] transition-colors", selecting && "[--sep-inset:120px]", picked && "bg-tint-soft")}>
      {selecting ? (
        <>
          <button type="button" role="checkbox" aria-checked={picked} aria-label={`Select ${product.name}`} onClick={onToggle} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
            <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors", picked ? "border-tint bg-tint text-white" : "border-separator-strong")}>
              {picked && <Check className="size-4" strokeWidth={3} />}
            </span>
            {summary}
          </button>
          <Button variant="gray" size="icon-sm" onClick={onOpen} aria-label={`Edit ${product.name}`}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        </>
      ) : (
        <>
          <button type="button" onClick={onOpen} className="press flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${product.name}`}>
            {summary}
          </button>
          <Switch checked={active} onCheckedChange={onActive} aria-label={`${product.name} is ${active ? "visible" : "hidden"} in the store`} />
        </>
      )}
    </li>
  );
}

export default function AdminProducts() {
  usePageTitle("Products");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const { categories } = useCategoryCounts();
  const [search, setSearch] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [status, setStatus] = React.useState<AdminStatusFilter>(statusFromAddress);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // Switch flips instantly; the list catches up when it refetches.
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});

  // Choosing several products at once. Opening from a "waiting for approval" link starts in this mode.
  const [selecting, setSelecting] = React.useState(() => statusFromAddress() === "hidden");
  const [selection, setSelection] = React.useState<Selection>(() => new Map());
  const [categoryFor, setCategoryFor] = React.useState<null | "approve" | "all">(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "show" | "hide" | "category" | "delete" | "all">(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // A different list is a different job: start with nothing ticked.
  React.useEffect(() => setSelection(new Map()), [status]);

  const list = useInfiniteQuery({
    queryKey: ["admin-products", term, status],
    queryFn: ({ pageParam }) => fetchAdminProductsPage({ q: term, status }, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: isAdmin,
    staleTime: 15_000,
  });
  const hiddenCount = useQuery({ queryKey: ["admin-hidden-count"], queryFn: fetchHiddenCount, enabled: isAdmin, staleTime: 15_000 });
  const waiting = hiddenCount.data ?? 0;

  const items = list.data?.pages.flatMap(page => page.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const editing = items.find(product => product.id === editingId) ?? null;
  const split = React.useMemo(() => splitSelection(selection), [selection]);
  const knownCategories = React.useMemo(() => Array.from(new Set([...categories.map(item => item.category), ...items.map(product => product.category)])), [categories, items]);

  const refresh = React.useCallback(async () => {
    setOverrides({});
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-hidden-count"] });
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

  const summaryOf = (product: Product): AdminSummary => ({ id: product.id, name: product.name, category: product.category, isActive: overrides[product.id] ?? product.isActive });

  function stopSelecting() {
    setSelecting(false);
    setSelection(new Map());
  }

  const toggleSelecting = () => (selecting ? stopSelecting() : setSelecting(true));

  function reviewWaiting() {
    setStatus("hidden");
    setSelecting(true);
  }

  async function selectEverything() {
    setBusy("all");
    try {
      setSelection(selectionOf(await fetchAdminSummaries({ q: term, status })));
    } catch (caught) {
      toast.error(errorMessage(caught, "Could not select everything"));
    } finally {
      setBusy(null);
    }
  }

  /** Runs a change on the ticked products, then refreshes the list and clears the ticks. */
  async function runBulk(kind: NonNullable<typeof busy>, task: () => Promise<void>, failure: string) {
    setBusy(kind);
    try {
      await task();
      setCategoryFor(null);
      setConfirmDelete(false);
      setSelection(new Map());
      await refresh();
    } catch (caught) {
      toast.error(errorMessage(caught, failure));
    } finally {
      setBusy(null);
    }
  }

  const showInStore = (category?: string) =>
    runBulk(
      "show",
      async () => {
        // Products with no category get the chosen one; the others keep theirs.
        if (category && split.needsCategory.length) await setProductsCategory(split.needsCategory.map(item => item.id), category);
        await setProductsActive(split.hidden.map(item => item.id), true);
        toast.success(`${countOf(split.hidden.length)} now visible in the store`);
      },
      "Could not show these products",
    );

  function requestShow() {
    if (!split.hidden.length) return;
    if (split.needsCategory.length) setCategoryFor("approve");
    else void showInStore();
  }

  const hideFromStore = () =>
    runBulk(
      "hide",
      async () => {
        await setProductsActive(split.live.map(item => item.id), false);
        toast.success(`${countOf(split.live.length)} hidden from the store`);
      },
      "Could not hide these products",
    );

  const applyCategory = (category: string) =>
    categoryFor === "approve"
      ? showInStore(category)
      : runBulk(
          "category",
          async () => {
            await setProductsCategory(split.ids, category);
            toast.success(`${countOf(split.total)} moved to ${category}`);
          },
          "Could not change the category",
        );

  const deleteSelected = () =>
    runBulk(
      "delete",
      async () => {
        const summary = deleteSummary(await deleteProductsBulk(split.ids));
        if (summary.tone === "success") toast.success(summary.text);
        else toast.warning(summary.text);
      },
      "Could not delete these products",
    );

  return (
    <AdminLayout
      title="Products"
      subtitle={list.isPending ? "Loading…" : `${formatNumber(total)} ${total === 1 ? "product" : "products"}`}
      actions={
        <ButtonLink href="/admin/products/new" className="hidden lg:inline-flex">
          <PackagePlus className="size-5" aria-hidden /> Add product
        </ButtonLink>
      }>
      <div className={cn("space-y-4", selecting && split.total > 0 && "pb-28")}>
        <LegacyCopyCard enabled={isAdmin} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchField value={search} onValueChange={setSearch} placeholder="Search by name or category" wrapperClassName="md:flex-1" />
          <SegmentedControl
            aria-label="Filter by visibility"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "live", label: "Live" },
              { value: "hidden", label: waiting > 0 ? `Hidden · ${formatNumber(waiting)}` : "Hidden" },
            ]}
            className="md:w-[22rem]"
          />
          <Button variant={selecting ? "tinted" : "gray"} size="md" className="hidden md:inline-flex" disabled={!selecting && items.length === 0} onClick={toggleSelecting}>
            {selecting ? "Done" : "Select"}
          </Button>
        </div>

        {status !== "hidden" && waiting > 0 && !selecting && (
          <Notice tone="orange">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong>{countOf(waiting)}</strong> {waiting === 1 ? "is" : "are"} hidden and waiting for your OK.
              </span>
              <Button size="sm" onClick={reviewWaiting}>
                Review
              </Button>
            </div>
          </Notice>
        )}

        {(selecting || items.length > 0) && (
          <div className={cn("flex items-center justify-between gap-3", !selecting && "md:hidden")}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-subhead">
              {selecting && (
                <>
                  <span className="font-semibold">{split.total ? `${countOf(split.total)} selected` : "Tap products to select them"}</span>
                  {total > 0 && (
                    <button type="button" className="press text-tint-text disabled:opacity-40" disabled={busy !== null} onClick={() => void selectEverything()}>
                      {busy === "all" ? "Selecting…" : `Select all ${formatNumber(total)}`}
                    </button>
                  )}
                  {split.total > 0 && (
                    <button type="button" className="press text-tint-text" onClick={() => setSelection(new Map())}>
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>
            <Button variant={selecting ? "tinted" : "gray"} size="sm" className="md:hidden" onClick={toggleSelecting}>
              {selecting ? "Done" : "Select"}
            </Button>
          </div>
        )}

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
                {items.map(product => (
                  <AdminProductRow
                    key={product.id}
                    product={product}
                    active={overrides[product.id] ?? product.isActive}
                    selecting={selecting}
                    picked={selection.has(product.id)}
                    onOpen={() => setEditingId(product.id)}
                    onToggle={() => setSelection(current => toggleSelection(current, summaryOf(product)))}
                    onActive={next => void toggleActive(product.id, next)}
                  />
                ))}
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

      {selecting && split.total > 0 && (
        <BulkBar split={split} busy={busy !== null} onShow={requestShow} onHide={() => void hideFromStore()} onCategory={() => setCategoryFor("all")} onDelete={() => setConfirmDelete(true)} />
      )}

      <BulkCategorySheet
        open={categoryFor !== null}
        onOpenChange={open => !open && setCategoryFor(null)}
        target={categoryFor === "approve" ? countOf(split.needsCategory.length) : countOf(split.total)}
        note={
          categoryFor === "approve" ? (
            <>
              {countOf(split.needsCategory.length)} {split.needsCategory.length === 1 ? "has" : "have"} no category yet. Choose one and {split.needsCategory.length === 1 ? "it goes" : "they go"} live with the others.
            </>
          ) : undefined
        }
        knownCategories={knownCategories}
        confirmLabel={categoryFor === "approve" ? `Set category and show ${countOf(split.hidden.length)}` : `Apply to ${countOf(split.total)}`}
        busy={busy === "show" || busy === "category"}
        onApply={applyCategory}
      />

      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${countOf(split.total)}?`}
        description="They are removed for good, with their photos. A product that is part of a quote request cannot be deleted and is kept."
        confirmLabel={`Delete ${countOf(split.total)}`}
        loading={busy === "delete"}
        onConfirm={deleteSelected}
      />

      <ProductEditor product={editing} knownCategories={knownCategories} onClose={() => setEditingId(null)} onChanged={refresh} />
    </AdminLayout>
  );
}
