import * as React from "react";
import { PackageSearch } from "lucide-react";
import { Button, EmptyState, ListGroup, ListRow, SearchField, Spinner } from "@/components/ios";
import { useCatalogue } from "@/hooks/useCatalogue";
import type { Product } from "@/lib/catalogue";
import { formatMoney, formatQty } from "@/lib/format";
import { Sheet } from "@/components/ios";
import { entryPrice } from "./Price";
import { ProductImage } from "./ProductImage";

type ProductPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (product: Product) => void;
  title?: string;
};

/** Searchable product chooser. Searches the live catalogue on the server, so it scales to hundreds of items. */
export function ProductPicker({ open, onOpenChange, onPick, title = "Choose a product" }: ProductPickerProps) {
  const [search, setSearch] = React.useState("");
  const [term, setTerm] = React.useState("");
  React.useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const catalogue = useCatalogue({ q: term, category: "All", sort: "newest" });
  // Demo products cannot be quoted, so they are never offered here.
  const items = catalogue.isSample ? [] : catalogue.items;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="sticky top-0 z-10 -mx-4 -mt-2 bg-canvas px-4 pb-3 pt-2">
        <SearchField value={search} onValueChange={setSearch} placeholder="Search products" autoFocus={false} />
      </div>

      {catalogue.isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner className="size-7" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No products found" description={term ? "Try a different search." : "The live catalogue has no products to choose from yet."} />
      ) : (
        <>
          <ListGroup>
            {items.map(product => {
              const price = entryPrice(product.pricing);
              return (
                <ListRow
                  key={product.id}
                  inset={84}
                  leading={
                    <span className="size-14 shrink-0 overflow-hidden rounded-[12px] bg-fill-4">
                      <ProductImage product={product} />
                    </span>
                  }
                  wrap
                  title={product.name}
                  subtitle={`${product.category} · MOQ ${formatQty(product.moq, product.pricing.unit)}`}
                  trailing={price !== null ? <span className="shrink-0 text-subhead font-semibold tabular-nums">{formatMoney(price, product.pricing.currency)}</span> : undefined}
                  onClick={() => onPick(product)}
                />
              );
            })}
          </ListGroup>
          {catalogue.hasMore && (
            <div className="mt-4 flex justify-center pb-2">
              <Button variant="gray" loading={catalogue.isLoadingMore} onClick={catalogue.loadMore}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
