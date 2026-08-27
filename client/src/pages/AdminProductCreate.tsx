import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Loader2, PackagePlus, Trash2, UploadCloud } from "lucide-react";
import { Link, useLocation } from "wouter";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import FormattedDescription from "@/components/FormattedDescription";

type ImageDraft = { file: File; preview: string };

const csv = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const buildOptionGroups = (colors: string, sizes: string, packaging: string, customization: string, customLabel: string, customOptions: string) => [{ key: "color", label: "Color", options: csv(colors) }, { key: "size", label: "Size", options: csv(sizes) }, { key: "packaging", label: "Packaging", options: csv(packaging) }, { key: "customization", label: "Customization", options: csv(customization) }, { key: customLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: customLabel.trim(), options: csv(customOptions) }].filter(group => group.label && group.options.length);

export default function AdminProductCreate() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [category, setCategory] = useState("Apparel");
  const [moq, setMoq] = useState("24");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [packagingOptions, setPackagingOptions] = useState("");
  const [customizationOptions, setCustomizationOptions] = useState("");
  const [customOptionLabel, setCustomOptionLabel] = useState("");
  const [customOptionValues, setCustomOptionValues] = useState("");
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = useMemo(() => Boolean(
    name.trim() && slug.trim() && shortDescription.trim().length >= 10 && description.trim().length >= 20 && category.trim() &&
      Number(moq) > 0 && images.length >= 2
  ), [name, slug, shortDescription, description, category, moq, colors, sizes, packagingOptions, customizationOptions, images.length]);

  function selectImages(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const accepted = selected.filter(file => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
    const next = accepted.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setImages(current => [...current, ...next].slice(0, 30));
    setError(accepted.length !== selected.length ? "Only image files up to 10 MB each were added." : "");
    event.target.value = "";
  }

  function applyDescriptionFormat(kind: "bold" | "bullet") {
    const input = descriptionRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = description.slice(start, end) || (kind === "bold" ? "important detail" : "bullet point");
    const replacement = kind === "bold" ? `**${selected}**` : selected.split("\\n").map(line => line ? `- ${line}` : line).join("\\n");
    const next = `${description.slice(0, start)}${replacement}${description.slice(end)}`;
    setDescription(next);
    requestAnimationFrame(() => { input.focus(); const cursor = start + replacement.length; input.setSelectionRange(cursor, cursor); });
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
    if (!isSupabaseConfigured()) return setError("Supabase is not configured for this environment.");
    if (images.length < 2) return setError("Select at least 2 product images before publishing.");
    if (primaryIndex >= images.length) return setError("Choose a primary image.");

    setUploading(true);
    setUploadProgress(0);
    setUploadStage("Preparing secure upload…");
    const uploadedPaths: string[] = [];
    try {
      const safeSlug = slug.trim().toLowerCase();
      const client = getSupabaseClient();
      const uploaded: Array<{ path: string; url: string }> = [];
      for (let index = 0; index < images.length; index += 1) {
        const { file } = images[index]!;
        const path = `products/${safeSlug}/${String(index + 1).padStart(2, "0")}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        setUploadStage(`Uploading image ${index + 1} of ${images.length}…`);
        const { error: uploadError } = await client.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        uploaded.push({ path, url: client.storage.from("product-images").getPublicUrl(path).data.publicUrl });
        setUploadProgress(Math.round(((index + 1) / images.length) * 80));
      }
      setUploadStage("Publishing catalogue record…");
      const { data: product, error: productError } = await client.from("products").insert({ slug: safeSlug, name: name.trim(), description: description.trim(), short_description: shortDescription.trim(), category: category.trim(), moq: Number(moq), colors: csv(colors), sizes: csv(sizes), packaging_options: csv(packagingOptions), customization_options: csv(customizationOptions), option_groups: buildOptionGroups(colors, sizes, packagingOptions, customizationOptions, customOptionLabel, customOptionValues), created_by: user?.uid }).select("id").single();
      if (productError) throw productError;
      const { error: imageError } = await client.from("product_images").insert(uploaded.map((image, index) => ({ product_id: product.id, storage_path: image.path, public_url: image.url, alt_text: `${name.trim()} product image ${index + 1}`, sort_order: index, is_primary: index === primaryIndex })));
      if (imageError) throw imageError;
      setUploadProgress(100);
      setUploadStage("Product published. Opening operations…");
      window.setTimeout(() => navigate("/admin"), 350);
    } catch (caught) {
      if (uploadedPaths.length) await getSupabaseClient().storage.from("product-images").remove(uploadedPaths);
      setError(caught instanceof Error ? caught.message : "Unable to create product. Check your connection and try again.");
      setUploadStage("");
    } finally {
      window.setTimeout(() => setUploading(false), 400);
    }
  }

  if (loading) return <div className="confirmation-page"><Loader2 className="spin" /><h1>Loading operations…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">ADMIN OPERATIONS</span><h1>Admin sign-in required.</h1><Link href="/admin/login" className="button button-primary">Sign in to operations</Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page"><span className="eyebrow">ADMIN OPERATIONS</span><h1>Access restricted.</h1><p>Your account does not have product-management permissions.</p><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;

  return <div className="workspace"><aside className="workspace-sidebar admin-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><span className="sidebar-label">OPERATIONS</span><Link className="sidebar-link" href="/admin">Overview</Link><Link className="sidebar-link active" href="/admin/products/new"><PackagePlus size={16}/> Add product</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/">← Back to store</Link></div></aside><main className="workspace-main product-create-main"><Link href="/admin" className="back-link"><ArrowLeft size={15}/> Back to operations</Link><header className="workspace-header"><div><span className="eyebrow">DIRECTORY / PRODUCTS</span><h1>Add a wholesale product.</h1><p>Publish a complete catalogue entry with clear buying requirements and a strong primary image.</p></div></header><form className="product-create-form" onSubmit={submit}><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">01 / PRODUCT DETAILS</span><h2>Core catalogue information</h2></div><span className="status-pill green">Draft</span></div><div className="form-grid product-form-grid"><label className="field wide">Product name<input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Premium heavyweight hoodie" required /></label><label className="field">URL slug<input value={slug} onChange={event => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="premium-heavyweight-hoodie" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label className="field">Category<select value={category} onChange={event => setCategory(event.target.value)}><option>Apparel</option><option>Bags</option><option>Accessories</option><option>Home & lifestyle</option><option>Custom</option></select></label><label className="field">Minimum order quantity<input type="number" min="1" value={moq} onChange={event => setMoq(event.target.value)} required /></label><label className="field wide">Short catalogue description<input value={shortDescription} onChange={event => setShortDescription(event.target.value)} placeholder="One concise sentence for catalogue cards" minLength={10} maxLength={180} required /><small>This is shown on the products page. The full description appears on the product page.</small></label><label className="field wide">Full product description<div className="description-editor-toolbar" role="toolbar" aria-label="Description formatting"><button type="button" onClick={() => applyDescriptionFormat("bold")} disabled={uploading}><strong>B</strong> Bold</button><button type="button" onClick={() => applyDescriptionFormat("bullet")} disabled={uploading}>• Bullet list</button><span>Supports **bold** and bullet lines</span></div><textarea ref={descriptionRef} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the product, material, use case, and wholesale value… Add bullet points for key benefits." minLength={20} rows={7} required /><div className="description-preview"><small>Preview</small><FormattedDescription text={description}/></div></label><label className="field">Available colors<input value={colors} onChange={event => setColors(event.target.value)} placeholder="Black, Stone, Navy" /><small>Optional. Leave blank when not applicable.</small></label><label className="field">Available sizes<input value={sizes} onChange={event => setSizes(event.target.value)} placeholder="S, M, L, XL" /><small>Optional. Leave blank for products without sizes.</small></label><label className="field">Packaging options<input value={packagingOptions} onChange={event => setPackagingOptions(event.target.value)} placeholder="Bulk cartons, Individual polybags" /><small>Optional.</small></label><label className="field">Customization options<input value={customizationOptions} onChange={event => setCustomizationOptions(event.target.value)} placeholder="Private label, Embroidery" /><small>Optional.</small></label><label className="field">Custom form label<input value={customOptionLabel} onChange={event => setCustomOptionLabel(event.target.value)} placeholder="e.g. Capacity, Style, Finish" /><small>Use for products that come in different forms.</small></label><label className="field">Custom form values<input value={customOptionValues} onChange={event => setCustomOptionValues(event.target.value)} placeholder="500 ml, 750 ml, 1 L" /><small>Separate options with commas.</small></label></div></section><section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">02 / PRODUCT IMAGERY</span><h2>Upload the product range</h2><p className="panel-helper">Select 2–30 images at once. Choose one image as the primary image for the shop card and detail page.</p></div><span className={`status-pill ${images.length >= 2 ? "green" : "amber"}`}>{images.length}/2 minimum</span></div><label className="bulk-upload-zone"><UploadCloud size={25}/><strong>Choose product images</strong><span>JPG, PNG, or WEBP · up to 10 MB each · 2 minimum</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages} /></label>{images.length > 0 && <div className="image-upload-grid">{images.map((image, index) => <div className={`image-upload-card ${index === primaryIndex ? "primary" : ""}`} key={`${image.file.name}-${index}`}><img src={image.preview} alt={`Product preview ${index + 1}`} /><div className="image-upload-actions"><button type="button" className="image-primary-button" onClick={() => setPrimaryIndex(index)} aria-pressed={index === primaryIndex}>{index === primaryIndex ? <><Check size={13}/> Primary</> : "Set as primary"}</button><button type="button" className="image-remove-button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}><Trash2 size={14}/></button></div></div>)}</div>}{images.length < 2 && <p className="form-hint"><ImagePlus size={15}/> Add {2 - images.length} more image{2 - images.length === 1 ? "" : "s"} to continue.</p>}</section>{error && <p className="form-error" role="alert">{error}</p>}{uploading && <div className="upload-progress-panel" role="status" aria-live="polite"><div className="upload-progress-spinner"><Loader2 className="spin" size={24}/></div><div><strong>{uploadStage || "Working…"}</strong><span>Your product is being saved securely. Please keep this page open.</span><div className="upload-progress-track"><span style={{ width: `${uploadProgress}%` }}/></div><small>{uploadProgress}% complete</small></div></div>}<div className="product-form-footer"><Link href="/admin" className="button button-secondary">Cancel</Link><button type="submit" className="button button-primary" disabled={!canSubmit || uploading}>{uploading ? <><Loader2 className="spin" size={16}/> Uploading & publishing…</> : <><PackagePlus size={16}/> Publish product</>}</button></div></form></main></div>;
}
