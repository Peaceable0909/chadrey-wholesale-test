import * as React from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, FormSection, ListGroup, ListRow, Notice, Sheet, TextInput } from "@/components/ios";
import { ProductFormSections } from "@/components/admin/ProductFormSections";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import type { Product } from "@/lib/catalogue";
import { prepareImage } from "@/lib/imageCompress";
import { draftFromProduct, fieldsFromDraft, type ProductDraft } from "@/lib/productDraft";
import { productHref } from "@/lib/productRoute";
import { photoSrc } from "@/lib/photos";
import { deleteImage, deleteProductRecord, isStillReferencedError, saveImageLabels, setCoverImage, updateProductRecord, uploadProductPhoto } from "@/lib/productWriteApi";
import { errorMessage } from "@/lib/supabaseCompat";
import { cn } from "@/lib/utils";

type ProductEditorProps = {
  product: Product | null;
  knownCategories: string[];
  onClose: () => void;
  /** Called after anything changes so the list can refresh. */
  onChanged: () => Promise<unknown> | void;
};

/** Edit a product in a sheet: details, price ladder, visibility and photos. */
export function ProductEditor({ product, knownCategories, onClose, onChanged }: ProductEditorProps) {
  const [draft, setDraft] = React.useState<ProductDraft | null>(null);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Start from the saved product whenever a different one is opened. Photo changes keep the typed edits.
  React.useEffect(() => {
    if (!product) return;
    setDraft(draftFromProduct(product));
    setLabels({});
    setError("");
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = saving || photoBusy || deleting;
  const labelFor = (id: string, saved: string | null) => labels[id] ?? saved ?? "";

  async function save() {
    if (!product || !draft) return;
    const { fields, error: problem } = fieldsFromDraft(draft);
    if (!fields) return setError(problem ?? "Check the product details.");
    setSaving(true);
    setError("");
    try {
      await updateProductRecord(product.id, fields);
      const changed = product.images.filter(image => labels[image.id] !== undefined && labels[image.id].trim() !== (image.label ?? ""));
      if (changed.length) await saveImageLabels(product.id, changed.map(image => ({ id: image.id, label: labels[image.id] })));
      toast.success("Product saved");
      await onChanged();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function runPhotoTask(task: () => Promise<void>, success: string) {
    setPhotoBusy(true);
    setError("");
    try {
      await task();
      await onChanged();
      toast.success(success);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function addPhotos(list: FileList | null) {
    if (!product || !list?.length) return;
    const files = Array.from(list).filter(file => file.type.startsWith("image/"));
    await runPhotoTask(async () => {
      const prepared = await Promise.all(files.map(file => prepareImage(file)));
      // The first photo of a product becomes its cover by itself; later ones go after the existing photos.
      for (const file of prepared) await uploadProductPhoto(product.id, file);
    }, files.length === 1 ? "Photo added" : "Photos added");
  }

  async function removePhoto(imageId: string) {
    if (!product) return;
    const image = product.images.find(item => item.id === imageId);
    if (!image) return;
    // If this was the cover, the next photo becomes the cover.
    await runPhotoTask(() => deleteImage(product.id, image.id), "Photo removed");
  }

  async function removeProduct() {
    if (!product) return;
    setDeleting(true);
    try {
      await deleteProductRecord(product.id);
      toast.success("Product deleted");
      setConfirmDelete(false);
      await onChanged();
      onClose();
    } catch (caught) {
      setConfirmDelete(false);
      setError(
        isStillReferencedError(caught)
          ? "This product is part of a quote request, so it cannot be deleted. Turn off “Visible in store” to hide it instead."
          : errorMessage(caught),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet
        open={Boolean(product)}
        onOpenChange={open => {
          if (!open && !busy) onClose();
        }}
        title={product?.name ?? "Edit product"}
        desktop="right"
        footer={
          <Button size="lg" full loading={saving} disabled={photoBusy || deleting} onClick={() => void save()}>
            Save changes
          </Button>
        }>
        {product && draft && (
          <div className="space-y-6 pb-4">
            {error && <Notice tone="red">{error}</Notice>}

            <ProductFormSections draft={draft} onChange={patch => setDraft(current => (current ? { ...current, ...patch } : current))} knownCategories={knownCategories} showVisibility disabled={busy} />

            <FormSection title="Photos">
              <ul className="space-y-3">
                {product.images.map((image, index) => (
                  <li key={image.id} className="flex items-center gap-3">
                    <img src={photoSrc(image.url, 160)} alt="" className="size-14 shrink-0 rounded-[12px] bg-fill-4 object-cover" />
                    <TextInput
                      aria-label={`Label for photo ${index + 1}`}
                      placeholder={index === 0 ? "Label (cover photo)" : "Label (optional)"}
                      value={labelFor(image.id, image.label)}
                      onChange={event => setLabels(current => ({ ...current, [image.id]: event.target.value }))}
                      disabled={busy}
                      className="h-10 min-w-0 flex-1 px-3 text-subhead"
                    />
                    <Button
                      variant="plain"
                      size="icon-sm"
                      aria-label={image.isPrimary ? "Cover photo" : `Make photo ${index + 1} the cover`}
                      aria-pressed={image.isPrimary}
                      disabled={busy || image.isPrimary}
                      onClick={() => void runPhotoTask(() => setCoverImage(product.id, image.id), "Cover photo updated")}>
                      <Star className={cn("size-5", image.isPrimary && "fill-ios-yellow text-ios-yellow")} />
                    </Button>
                    <Button
                      variant="plain"
                      size="icon-sm"
                      aria-label={`Remove photo ${index + 1}`}
                      disabled={busy || product.images.length <= 1}
                      className="text-ios-red-text hover:bg-ios-red/10"
                      onClick={() => void removePhoto(image.id)}>
                      <Trash2 className="size-[18px]" />
                    </Button>
                  </li>
                ))}
              </ul>
              <label className={cn("flex h-11 cursor-pointer items-center justify-center gap-2 rounded-control bg-tint-soft text-subhead font-semibold text-tint-text transition-colors hover:bg-tint/20", busy && "pointer-events-none opacity-50")}>
                <Plus className="size-4" aria-hidden />
                {photoBusy ? "Working…" : "Add photos"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={event => {
                    void addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </FormSection>

            <ListGroup>
              <ListRow href={productHref(product.slug)} title="View in store" chevron onClick={onClose} />
              <ListRow destructive title="Delete product" onClick={() => setConfirmDelete(true)} />
            </ListGroup>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this product?"
        description={
          <>
            “{product?.name}” and its photos will be removed for good. If it is part of a quote request it cannot be deleted. Hide it instead by turning off “Visible in store”.
          </>
        }
        confirmLabel="Delete product"
        loading={deleting}
        onConfirm={removeProduct}
      />
    </>
  );
}
