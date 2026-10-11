import * as React from "react";
import { PackagePlus } from "lucide-react";
import { PhotoPicker, type PhotoDraft } from "@/components/admin/PhotoPicker";
import { ProductFormSections } from "@/components/admin/ProductFormSections";
import { Button, ButtonLink, Card, FormSection, Notice } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PriceLabel } from "@/components/store/Price";
import { ProductImage } from "@/components/store/ProductImage";
import { useCategoryCounts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useScrollTopWhen } from "@/hooks/useScrollTopWhen";
import { prepareImage } from "@/lib/imageCompress";
import { emptyDraft, fieldsFromDraft, MAX_PRODUCT_IMAGES, MIN_PRODUCT_IMAGES, type ProductDraft } from "@/lib/productDraft";
import { createProductRecord, deleteProductRecord, setProductActive, uploadProductPhoto } from "@/lib/productWriteApi";
import { productHref } from "@/lib/productRoute";
import { ApiError } from "@/lib/shopApi";
import { errorMessage } from "@/lib/supabaseCompat";
import { useQueryClient } from "@tanstack/react-query";

type Progress = { stage: string; percent: number };
type Published = { slug: string; name: string; coverUrl?: string; fields: NonNullable<ReturnType<typeof fieldsFromDraft>["fields"]> };

/** Turns a failed write into something an admin can act on. */
function publishProblem(caught: unknown): string {
  if (caught instanceof ApiError && caught.code === "slug_taken") return "A product with this web address already exists. Please try publishing again.";
  return errorMessage(caught, "Unable to publish the product. Check your connection and try again.");
}

export default function AdminProductCreate() {
  usePageTitle("Add product");
  const queryClient = useQueryClient();
  const { categories } = useCategoryCounts();
  const [draft, setDraft] = React.useState<ProductDraft>(emptyDraft);
  const [photos, setPhotos] = React.useState<PhotoDraft[]>([]);
  const [coverId, setCoverId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [published, setPublished] = React.useState<Published | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const busy = progress !== null;

  React.useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  useScrollTopWhen(published);

  const patchDraft = (patch: Partial<ProductDraft>) => setDraft(current => ({ ...current, ...patch }));
  const ready = draft.name.trim() && draft.category.trim() && photos.length >= MIN_PRODUCT_IMAGES;

  async function publish() {
    setError("");
    const { fields, error: problem } = fieldsFromDraft(draft);
    if (!fields) return setError(problem ?? "Check the product details.");
    if (photos.length < MIN_PRODUCT_IMAGES) return setError(`Add at least ${MIN_PRODUCT_IMAGES} photos before publishing.`);

    let createdId: string | null = null;
    try {
      setProgress({ stage: "Preparing photos…", percent: 3 });
      const prepared: File[] = [];
      for (let index = 0; index < photos.length; index += 1) {
        prepared.push(await prepareImage(photos[index].file));
        setProgress({ stage: `Preparing photo ${index + 1} of ${photos.length}…`, percent: 3 + Math.round(((index + 1) / photos.length) * 17) });
      }

      // The product starts hidden, so nobody sees it half-finished while its photos upload. It goes live at the end.
      setProgress({ stage: "Saving product…", percent: 22 });
      // The id is chosen here and remembered first, so if the reply is lost on a weak connection the half-made product
      // can still be removed (and sending the request again would not make a second one).
      const newId = crypto.randomUUID();
      createdId = newId;
      const created = await createProductRecord({ ...fields, isActive: false }, { id: newId });

      const coverIndex = Math.max(0, photos.findIndex(photo => photo.id === coverId));
      let coverUrl: string | undefined;
      for (let index = 0; index < prepared.length; index += 1) {
        const uploaded = await uploadProductPhoto(created.id, prepared[index], { label: photos[index].label, primary: index === coverIndex, sort: index });
        if (index === coverIndex) coverUrl = uploaded.url;
        setProgress({ stage: `Uploading photo ${index + 1} of ${prepared.length}…`, percent: 22 + Math.round(((index + 1) / prepared.length) * 63) });
      }

      setProgress({ stage: "Publishing product…", percent: 90 });
      if (fields.isActive) await setProductActive(created.id, true);

      setProgress({ stage: "Done", percent: 100 });
      void queryClient.invalidateQueries({ queryKey: ["catalogue"] });
      void queryClient.invalidateQueries({ queryKey: ["category-counts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-hidden-count"] });
      setPublished({ slug: created.slug, name: fields.name, coverUrl, fields });
    } catch (caught) {
      // Leave nothing half-finished behind: no product record without its photos.
      try {
        if (createdId) await deleteProductRecord(createdId);
      } catch (cleanupError) {
        // "Not found" just means the product was never made, which is the state we wanted.
        if (!(cleanupError instanceof ApiError && cleanupError.status === 404)) console.error("Cleanup after failed publish:", cleanupError);
      }
      setError(publishProblem(caught));
    } finally {
      setProgress(null);
    }
  }

  function addAnother() {
    photos.forEach(photo => URL.revokeObjectURL(photo.preview));
    // Goods from the same dealer usually share a category, currency and unit, so keep those.
    setDraft({ ...emptyDraft(), category: draft.category, moq: draft.moq, price: { ...emptyDraft().price, currency: draft.price.currency, unit: draft.price.unit } });
    setPhotos([]);
    setCoverId(null);
    setPublished(null);
    setError("");
    window.scrollTo({ top: 0 });
  }

  if (published) {
    return (
      <AdminLayout title="Product published" width="form">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-ios-green/15" style={{ animation: "pop-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both" }}>
            <svg viewBox="0 0 24 24" className="size-10 text-ios-green" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7" strokeDasharray="24" style={{ animation: "draw-check 450ms 250ms ease-out both" }} />
            </svg>
          </span>
          <div className="mx-auto flex max-w-xs items-center gap-3 rounded-group bg-canvas p-3 text-left">
            <span className="size-14 shrink-0 overflow-hidden rounded-[12px] bg-fill-4">
              <ProductImage variant="thumb" product={{ name: published.name, category: published.fields.category, images: published.coverUrl ? [{ id: "cover", url: published.coverUrl, storagePath: null, label: null, alt: null, isPrimary: true, sortOrder: 0 }] : [] }} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-headline font-semibold">{published.name}</p>
              <PriceLabel pricing={published.fields.pricing} />
            </div>
          </div>
          <p className="mt-4 text-body text-label-2">
            {published.fields.isActive ? "It is live in the store now." : "Saved as hidden. Shoppers cannot see it until you turn it on in Products."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" full onClick={addAnother}>
              <PackagePlus className="size-5" aria-hidden /> Add another product
            </Button>
            {published.fields.isActive && (
              <ButtonLink href={productHref(published.slug)} variant="gray" size="lg" full>
                View in store
              </ButtonLink>
            )}
            <ButtonLink href="/admin/products" variant="plain" size="lg" full>
              All products
            </ButtonLink>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Add product" subtitle="Photos first, then the details. Prices are optional and can be changed any time." back={{ href: "/admin/products", label: "Products" }} width="form" tabBar={false}>
      <div className="space-y-6 pb-28">
        <FormSection title="Photos">
          <PhotoPicker
            photos={photos}
            coverId={coverId}
            onChange={(next, cover) => {
              setPhotos(next);
              setCoverId(cover);
            }}
            min={MIN_PRODUCT_IMAGES}
            max={MAX_PRODUCT_IMAGES}
            disabled={busy}
            onProblem={setError}
          />
        </FormSection>

        <ProductFormSections draft={draft} onChange={patchDraft} knownCategories={categories.map(item => item.category)} showVisibility disabled={busy} />

        <div ref={errorRef}>{error && <Notice tone="red">{error}</Notice>}</div>
      </div>

      <div className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 lg:left-64">
        <div className="gutter mx-auto max-w-[760px] py-3">
          {progress && (
            <div className="mb-2.5" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-footnote text-label-2">
                <span>{progress.stage}</span>
                <span className="tabular-nums">{progress.percent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill-2">
                <div className="h-full rounded-full bg-tint transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}
          <Button size="lg" full loading={busy} disabled={!ready} onClick={() => void publish()}>
            Publish product
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
