import { useMemo, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Loader2, PackagePlus, Trash2, UploadCloud } from "lucide-react";
import { Link, useLocation } from "wouter";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseStorage, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type ImageDraft = { file: File; preview: string };

const csv = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);

export default function AdminProductCreate() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const createProduct = trpc.catalogue.adminCreate.useMutation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Apparel");
  const [moq, setMoq] = useState("24");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [packagingOptions, setPackagingOptions] = useState("");
  const [customizationOptions, setCustomizationOptions] = useState("");
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const canSubmit = useMemo(() => Boolean(
    name.trim() && slug.trim() && description.trim().length >= 20 && category.trim() &&
      Number(moq) > 0 && csv(colors).length > 0 && csv(sizes).length > 0 &&
      csv(packagingOptions).length > 0 && csv(customizationOptions).length > 0 && images.length >= 10
  ), [name, slug, description, category, moq, colors, sizes, packagingOptions, customizationOptions, images.length]);

  function selectImages(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const accepted = selected.filter(file => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
    const next = accepted.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setImages(current => [...current, ...next].slice(0, 30));
    setError(accepted.length !== selected.length ? "Only image files up to 10 MB each were added." : "");
    event.target.value = "";
  }

  function removeImage(index: number) {
    setImages(current => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    setPrimaryIndex(current => current > index ? current - 1 : current === index ? 0 : current);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isFirebaseConfigured()) return setError("Firebase is not configured for this environment.");
    if (images.length < 10) return setError("Select at least 10 product images before publishing.");
    if (primaryIndex >= images.length) return setError("Choose a primary image.");

    setUploading(true);
    try {
      const safeSlug = slug.trim().toLowerCase();
      const uploaded = await Promise.all(images.map(async ({ file }, index) => {
        const objectRef = ref(firebaseStorage(), `products/${safeSlug}/${String(index + 1).padStart(2, "0")}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`);
        const snapshot = await uploadBytes(objectRef, file, { contentType: file.type });
        return getDownloadURL(snapshot.ref);
      }));
      await createProduct.mutateAsync({
        slug: safeSlug,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        moq: Number(moq),
        colors: csv(colors),
        sizes: csv(sizes),
        packagingOptions: csv(packagingOptions),
        customizationOptions: csv(customizationOptions),
        images: uploaded,
        primaryImage: uploaded[primaryIndex]!,
      });
      navigate("/admin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create product.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="confirmation-page"><Loader2 className="spin" /><h1>Loading operations…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">ADMIN OPERATIONS</span><h1>Admin sign-in required.</h1><Link href="/login" className="button button-primary">Sign in</Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page"><span className="eyebrow">ADMIN OPERATIONS</span><h1>Access restricted.</h1><p>Your account does not have product-management permissions.</p><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;

  return <div className="workspace"><aside className="workspace-sidebar admin-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><span className="sidebar-label">OPERATIONS</span><Link className="sidebar-link" href="/admin">Overview</Link><Link className="sidebar-link active" href="/admin/products/new"><PackagePlus size={16}/> Add product</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/">← Back to store</Link></div></aside><main className="workspace-main product-create-main"><Link href="/admin" className="back-link"><ArrowLeft size={15}/> Back to operations</Link><header className="workspace-header"><div><span className="eyebrow">DIRECTORY / PRODUCTS</span><h1>Add a wholesale product.</h1><p>Publish a complete catalogue entry with clear buying requirements and a strong primary image.</p></div></header><form className="product-create-form" onSubmit={submit}><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">01 / PRODUCT DETAILS</span><h2>Core catalogue information</h2></div><span className="status-pill green">Draft</span></div><div className="form-grid product-form-grid"><label className="field wide">Product name<input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Premium heavyweight hoodie" required /></label><label className="field">URL slug<input value={slug} onChange={event => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="premium-heavyweight-hoodie" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label className="field">Category<select value={category} onChange={event => setCategory(event.target.value)}><option>Apparel</option><option>Bags</option><option>Accessories</option><option>Home & lifestyle</option><option>Custom</option></select></label><label className="field">Minimum order quantity<input type="number" min="1" value={moq} onChange={event => setMoq(event.target.value)} required /></label><label className="field wide">Product description<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the product, material, use case, and wholesale value…" minLength={20} rows={5} required /></label><label className="field">Available colors<input value={colors} onChange={event => setColors(event.target.value)} placeholder="Black, Stone, Navy" required /><small>Separate options with commas.</small></label><label className="field">Available sizes<input value={sizes} onChange={event => setSizes(event.target.value)} placeholder="S, M, L, XL" required /><small>Separate options with commas.</small></label><label className="field">Packaging options<input value={packagingOptions} onChange={event => setPackagingOptions(event.target.value)} placeholder="Bulk cartons, Individual polybags" required /></label><label className="field">Customization options<input value={customizationOptions} onChange={event => setCustomizationOptions(event.target.value)} placeholder="Private label, Embroidery, None" required /></label></div></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">02 / PRODUCT IMAGERY</span><h2>Upload the product range</h2><p className="panel-helper">Select 10–30 images at once. Choose one image as the primary image for the shop card and detail page.</p></div><span className={`status-pill ${images.length >= 10 ? "green" : "amber"}`}>{images.length}/10 minimum</span></div><label className="bulk-upload-zone"><UploadCloud size={25}/><strong>Choose product images</strong><span>JPG, PNG, or WEBP · up to 10 MB each · 10 minimum</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages} /></label>{images.length > 0 && <div className="image-upload-grid">{images.map((image, index) => <div className={`image-upload-card ${index === primaryIndex ? "primary" : ""}`} key={`${image.file.name}-${index}`}><img src={image.preview} alt={`Product preview ${index + 1}`} /><div className="image-upload-actions"><button type="button" className="image-primary-button" onClick={() => setPrimaryIndex(index)} aria-pressed={index === primaryIndex}>{index === primaryIndex ? <><Check size={13}/> Primary</> : "Set as primary"}</button><button type="button" className="image-remove-button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}><Trash2 size={14}/></button></div></div>)}</div>}{images.length < 10 && <p className="form-hint"><ImagePlus size={15}/> Add {10 - images.length} more image{10 - images.length === 1 ? "" : "s"} to continue.</p>}</section>{error && <p className="form-error" role="alert">{error}</p>}<div className="product-form-footer"><Link href="/admin" className="button button-secondary">Cancel</Link><button type="submit" className="button button-primary" disabled={!canSubmit || uploading}>{uploading ? <><Loader2 className="spin" size={16}/> Uploading & publishing…</> : <><PackagePlus size={16}/> Publish product</>}</button></div></form></main></div>;
}
