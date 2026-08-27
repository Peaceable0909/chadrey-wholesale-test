import { useEffect, useMemo, useState } from "react";
import { Edit3, Image as ImageIcon, Loader2, PackagePlus, Save, Search, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";
import { normalizeOptionGroups } from "@/lib/productOptions";
import FormattedDescription from "@/components/FormattedDescription";

type ProductImage = { id: string; storage_path: string; public_url: string; is_primary: boolean; sort_order: number };
type Product = { id: string; slug: string; name: string; short_description: string; description: string; category: string; moq: number; option_groups: unknown; colors: unknown; sizes: unknown; packaging_options: unknown; customization_options: unknown; is_active: boolean; created_at: string; updated_at: string; product_images: ProductImage[] };
type ProductForm = { name: string; shortDescription: string; description: string; category: string; moq: string; colors: string; sizes: string; packaging: string; customization: string; customLabel: string; customValues: string };

const csv = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const listValue = (value: unknown) => Array.isArray(value) ? value.join(", ") : "";
const buildOptionGroups = (form: ProductForm) => [{ key: "color", label: "Color", options: csv(form.colors) }, { key: "size", label: "Size", options: csv(form.sizes) }, { key: "packaging", label: "Packaging", options: csv(form.packaging) }, { key: "customization", label: "Customization", options: csv(form.customization) }, { key: form.customLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: form.customLabel.trim(), options: csv(form.customValues) }].filter(group => group.label && group.options.length);
const emptyForm: ProductForm = { name: "", shortDescription: "", description: "", category: "", moq: "", colors: "", sizes: "", packaging: "", customization: "", customLabel: "", customValues: "" };

export default function AdminProducts() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoadingProducts(true); setError("");
    const { data, error: queryError } = await getSupabaseClient().from("products").select("id,slug,name,short_description,description,category,moq,option_groups,colors,sizes,packaging_options,customization_options,is_active,created_at,updated_at,product_images(id,storage_path,public_url,is_primary,sort_order)").order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setProducts(((data || []) as Product[]).map(product => ({ ...product, product_images: [...(product.product_images || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order) })));
    setLoadingProducts(false);
  }
  useEffect(() => { if (user?.role === "admin") void loadProducts(); }, [user]);

  function beginEdit(product: Product) {
    const groups = normalizeOptionGroups(product);
    const custom = groups.find(group => !["color", "size", "packaging", "customization"].includes(group.key));
    setEditing(product);
    setForm({ name: product.name, shortDescription: product.short_description || "", description: product.description, category: product.category, moq: String(product.moq), colors: listValue(product.colors), sizes: listValue(product.sizes), packaging: listValue(product.packaging_options), customization: listValue(product.customization_options), customLabel: custom?.label || "", customValues: custom?.options.join(", ") || "" });
    setStatus(""); setError("");
  }
  function closeEditor() { if (!busy) setEditing(null); }
  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) { setForm(current => ({ ...current, [key]: value })); }

  async function saveEdit() {
    if (!editing) return;
    if (!form.name.trim() || !form.shortDescription.trim() || !form.description.trim() || Number(form.moq) < 1) return setError("Name, short description, full description, and MOQ are required.");
    setBusy(true); setError(""); setStatus("");
    const { error: updateError } = await getSupabaseClient().from("products").update({ name: form.name.trim(), short_description: form.shortDescription.trim(), description: form.description.trim(), category: form.category.trim(), moq: Number(form.moq), colors: csv(form.colors), sizes: csv(form.sizes), packaging_options: csv(form.packaging), customization_options: csv(form.customization), option_groups: buildOptionGroups(form) }).eq("id", editing.id);
    if (updateError) setError(updateError.message);
    else { setStatus("Product updated."); setEditing(null); await loadProducts(); }
    setBusy(false);
  }
  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete “${product.name}”? This removes the catalogue record and its image metadata.`)) return;
    setBusy(true); setError(""); setStatus("");
    const client = getSupabaseClient();
    const paths = product.product_images.map(image => image.storage_path);
    if (paths.length) await client.storage.from("product-images").remove(paths);
    const { error: deleteError } = await client.from("products").delete().eq("id", product.id);
    if (deleteError) setError(deleteError.message); else { setProducts(current => current.filter(item => item.id !== product.id)); setStatus("Product deleted."); }
    setBusy(false);
  }

  const visibleProducts = useMemo(() => products.filter(product => `${product.name} ${product.category} ${product.short_description}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  if (loading) return <div className="confirmation-page"><Loader2 className="spin"/><h1>Loading operations…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">PRODUCT DIRECTORY</span><h1>Admin sign-in required.</h1><Link href="/admin/login" className="button button-primary">Sign in to operations</Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page"><h1>Access restricted.</h1><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;

  return <div className="workspace"><aside className="workspace-sidebar admin-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><span className="sidebar-label">DIRECTORY</span><Link className="sidebar-link active" href="/admin/products">Products</Link><Link className="sidebar-link" href="/admin/products/new"><PackagePlus size={16}/> Add product</Link><Link className="sidebar-link" href="/admin/users">Users</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/admin">← Back to operations</Link></div></aside><main className="workspace-main admin-products-main"><header className="workspace-header compact-workspace-header"><div><span className="eyebrow">DIRECTORY / PRODUCTS</span><h1>Manage your catalogue.</h1><p>Keep product information, buying rules, and customer-facing options clear.</p></div><Link href="/admin/products/new" className="button button-primary"><PackagePlus size={16}/> Add product</Link></header>{status && <p className="form-success" role="status">{status}</p>}{error && <p className="form-error" role="alert">{error}</p>}<section className="workspace-panel catalogue-panel"><div className="panel-heading catalogue-panel-heading"><div><span className="eyebrow">LIVE CATALOGUE</span><h2>{products.length} product{products.length === 1 ? "" : "s"}</h2></div><label className="admin-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search catalogue"/></label></div>{loadingProducts ? <div className="admin-inline-loading"><Loader2 className="spin" size={18}/> Loading products…</div> : visibleProducts.length ? <div className="product-admin-list">{visibleProducts.map(product => { const image = product.product_images[0]; const groups = normalizeOptionGroups(product); return <article className="product-admin-row" key={product.id}><div className="product-admin-thumb">{image?.public_url ? <img src={image.public_url} alt={product.name}/> : <ImageIcon size={22}/>}</div><div className="product-admin-summary"><div className="product-admin-heading"><div><h3>{product.name}</h3><p>{product.short_description || "No short description"}</p></div><span className={`status-pill ${product.is_active ? "green" : "amber"}`}>{product.is_active ? "Live" : "Hidden"}</span></div><div className="product-admin-meta"><span>{product.category}</span><strong>MOQ {product.moq}</strong><span>{product.product_images.length} image{product.product_images.length === 1 ? "" : "s"}</span><span>{groups.length} option group{groups.length === 1 ? "" : "s"}</span></div><div className="product-option-chips">{groups.slice(0, 4).map(group => <span key={group.key}>{group.label}: {group.options.slice(0, 3).join(", ")}{group.options.length > 3 ? "…" : ""}</span>)}</div></div><div className="product-admin-actions"><button className="button button-secondary small" onClick={() => beginEdit(product)}><Edit3 size={14}/> Edit</button><button className="icon-button danger" onClick={() => void deleteProduct(product)} disabled={busy} aria-label={`Delete ${product.name}`}><Trash2 size={16}/></button></div></article>})}</div> : <div className="empty-state"><ImageIcon size={24}/><h3>{search ? "No matching products" : "No products yet"}</h3><p>{search ? "Try a different search term." : "Publish your first catalogue product to see it here."}</p>{!search && <Link href="/admin/products/new" className="button button-primary"><PackagePlus size={15}/> Add product</Link>}</div>}</section>{editing && <div className="edit-product-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}><section className="edit-product-drawer" role="dialog" aria-modal="true" aria-labelledby="edit-product-title"><header className="edit-product-header"><div><span className="eyebrow">EDIT PRODUCT</span><h2 id="edit-product-title">{editing.name}</h2></div><button className="icon-button" onClick={closeEditor} aria-label="Close editor"><X size={18}/></button></header><div className="edit-product-body"><div className="editor-section"><span className="editor-section-label">01 / IDENTITY</span><div className="form-grid product-form-grid"><label className="field wide">Product name<input value={form.name} onChange={event => setField("name", event.target.value)}/></label><label className="field">Category<input value={form.category} onChange={event => setField("category", event.target.value)}/></label><label className="field">Minimum order quantity<input type="number" min="1" value={form.moq} onChange={event => setField("moq", event.target.value)}/></label></div></div><div className="editor-section"><span className="editor-section-label">02 / CUSTOMER-FACING COPY</span><div className="form-grid"><label className="field wide">Short catalogue description<input value={form.shortDescription} onChange={event => setField("shortDescription", event.target.value)} maxLength={180}/></label><label className="field wide">Full description<textarea rows={8} value={form.description} onChange={event => setField("description", event.target.value)}/><small>Use **bold text** and lines beginning with - for formatting.</small></label></div></div><div className="editor-section"><span className="editor-section-label">03 / OPTIONAL PRODUCT OPTIONS</span><p className="editor-help">Leave a group blank when it does not apply. Customers will only see configured groups.</p><div className="form-grid"><label className="field">Colors<input value={form.colors} onChange={event => setField("colors", event.target.value)} placeholder="Leave blank if not applicable"/></label><label className="field">Sizes<input value={form.sizes} onChange={event => setField("sizes", event.target.value)} placeholder="Leave blank if not applicable"/></label><label className="field">Packaging<input value={form.packaging} onChange={event => setField("packaging", event.target.value)} placeholder="Bulk carton, Gift box"/></label><label className="field">Customization<input value={form.customization} onChange={event => setField("customization", event.target.value)} placeholder="Logo, Plain"/></label><label className="field">Custom form label<input value={form.customLabel} onChange={event => setField("customLabel", event.target.value)} placeholder="Capacity, Style, Finish"/></label><label className="field">Custom form values<input value={form.customValues} onChange={event => setField("customValues", event.target.value)} placeholder="500 ml, 750 ml, 1 L"/></label></div></div><div className="editor-section"><span className="editor-section-label">04 / IMAGE REFERENCE</span><div className="editor-image-strip">{editing.product_images.map((image, index) => <div className={`editor-image ${image.is_primary ? "primary" : ""}`} key={image.id}><img src={image.public_url} alt={`${editing.name} view ${index + 1}`}/>{image.is_primary && <span>Primary</span>}</div>)}</div><small className="editor-help">Image uploads and primary-image changes are managed from the product creation workflow.</small></div></div><footer className="edit-product-footer"><button className="button button-secondary" onClick={closeEditor} disabled={busy}>Cancel</button><button className="button button-primary" onClick={() => void saveEdit()} disabled={busy}>{busy ? <Loader2 className="spin" size={16}/> : <Save size={16}/>} {busy ? "Saving…" : "Save changes"}</button></footer></section></div>}</main></div>;
}
