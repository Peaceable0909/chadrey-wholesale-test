import { useEffect, useState } from "react";
import { Edit3, Image as ImageIcon, Loader2, PackagePlus, Save, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";
import FormattedDescription from "@/components/FormattedDescription";

type Product = { id: string; slug: string; name: string; description: string; category: string; moq: number; colors: unknown; sizes: unknown; packaging_options: unknown; customization_options: unknown; is_active: boolean; created_at: string; product_images: Array<{ id: string; storage_path: string; public_url: string; is_primary: boolean }> };
const csv = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const listValue = (value: unknown) => Array.isArray(value) ? value.join(", ") : "";

export default function AdminProducts() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", moq: "", colors: "", sizes: "", packaging: "", customization: "" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function loadProducts() {
    setError("");
    const { data, error: queryError } = await getSupabaseClient().from("products").select("id,slug,name,description,category,moq,colors,sizes,packaging_options,customization_options,is_active,created_at,product_images(id,storage_path,public_url,is_primary)").order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setProducts((data || []) as Product[]);
  }
  useEffect(() => { if (user?.role === "admin") void loadProducts(); }, [user]);

  function beginEdit(product: Product) {
    setEditing(product);
    setForm({ name: product.name, description: product.description, category: product.category, moq: String(product.moq), colors: listValue(product.colors), sizes: listValue(product.sizes), packaging: listValue(product.packaging_options), customization: listValue(product.customization_options) });
    setStatus(""); setError("");
  }
  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setError(""); setStatus("");
    const client = getSupabaseClient();
    const { error: updateError } = await client.from("products").update({ name: form.name.trim(), description: form.description.trim(), category: form.category.trim(), moq: Number(form.moq), colors: csv(form.colors), sizes: csv(form.sizes), packaging_options: csv(form.packaging), customization_options: csv(form.customization) }).eq("id", editing.id);
    if (updateError) setError(updateError.message); else { setStatus("Product updated."); setEditing(null); await loadProducts(); }
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

  if (loading) return <div className="confirmation-page"><Loader2 className="spin"/><h1>Loading operations…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">PRODUCT DIRECTORY</span><h1>Admin sign-in required.</h1><Link href="/admin/login" className="button button-primary">Sign in to operations</Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page"><h1>Access restricted.</h1><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;

  return <div className="workspace"><aside className="workspace-sidebar admin-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><span className="sidebar-label">DIRECTORY</span><Link className="sidebar-link active" href="/admin/products">Products</Link><Link className="sidebar-link" href="/admin/products/new"><PackagePlus size={16}/> Add product</Link><Link className="sidebar-link" href="/admin/users">Users</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/admin">← Back to operations</Link></div></aside><main className="workspace-main"><header className="workspace-header"><div><span className="eyebrow">DIRECTORY / PRODUCTS</span><h1>Manage your catalogue.</h1><p>Edit live product information or remove products that are no longer available.</p></div><Link href="/admin/products/new" className="button button-primary"><PackagePlus size={16}/> Add product</Link></header>{status && <p className="form-success" role="status">{status}</p>}{error && <p className="form-error" role="alert">{error}</p>}<section className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">LIVE CATALOGUE</span><h2>{products.length} product{products.length === 1 ? "" : "s"}</h2></div></div>{products.length ? <div className="product-admin-grid">{products.map(product => <article className="product-admin-card" key={product.id}><div className="product-admin-image">{product.product_images[0]?.public_url ? <img src={product.product_images.find(image => image.is_primary)?.public_url || product.product_images[0].public_url} alt={product.name}/> : <ImageIcon size={28}/>}<span>{product.product_images.length} image{product.product_images.length === 1 ? "" : "s"}</span></div><div className="product-admin-card-body"><div className="product-meta"><span>{product.category}</span><strong>MOQ {product.moq}</strong></div><h3>{product.name}</h3><FormattedDescription text={product.description}/><div className="product-admin-actions"><button className="button button-secondary small" onClick={() => beginEdit(product)}><Edit3 size={14}/> Edit</button><button className="icon-button danger" onClick={() => void deleteProduct(product)} disabled={busy} aria-label={`Delete ${product.name}`}><Trash2 size={16}/></button></div></div></article>)}</div> : <div className="empty-state"><ImageIcon size={24}/><h3>No products yet</h3><p>Publish your first catalogue product to see it here.</p><Link href="/admin/products/new" className="button button-primary"><PackagePlus size={15}/> Add product</Link></div>}</section>{editing && <div className="edit-product-panel"><div className="panel-heading"><div><span className="eyebrow">EDIT PRODUCT</span><h2>{editing.name}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Close editor"><X size={18}/></button></div><div className="form-grid product-form-grid"><label className="field wide">Product name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label><label className="field">Category<input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}/></label><label className="field">Minimum order quantity<input type="number" min="1" value={form.moq} onChange={event => setForm({ ...form, moq: event.target.value })}/></label><label className="field wide">Description<textarea rows={7} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/><small>Use **bold text** and lines starting with - for bullet points.</small></label><label className="field">Colors<input value={form.colors} onChange={event => setForm({ ...form, colors: event.target.value })}/></label><label className="field">Sizes<input value={form.sizes} onChange={event => setForm({ ...form, sizes: event.target.value })}/></label><label className="field">Packaging<input value={form.packaging} onChange={event => setForm({ ...form, packaging: event.target.value })}/></label><label className="field">Customization<input value={form.customization} onChange={event => setForm({ ...form, customization: event.target.value })}/></label></div><div className="product-form-footer"><button className="button button-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={() => void saveEdit()} disabled={busy}>{busy ? <Loader2 className="spin" size={16}/> : <Save size={16}/>} {busy ? "Saving…" : "Save changes"}</button></div></div>}</main></div>;
}
