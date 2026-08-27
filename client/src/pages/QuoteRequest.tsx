import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Image as ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { normalizeOptionGroups, type ProductOptionGroup } from "@/lib/productOptions";
import { productSlugFromLocation } from "@/lib/productRoute";

type ProductImage = { id: string; public_url: string; is_primary: boolean; sort_order: number; alt_text?: string | null };
type Product = { id: string; slug: string; name: string; category: string; moq: number; description: string; option_groups: unknown; colors: unknown; sizes: unknown; packaging_options: unknown; customization_options: unknown; product_images: ProductImage[] };
type Line = { id: string; productId: string; quantity: number; selections: Record<string, string>; customValues: Record<string, string>; preferredImageIds: string[]; requirements: string };

type ContactDetails = { name: string; company: string; email: string; phone: string; whatsapp: string; address: string };

function newLine(product?: Product, overrides: Partial<Line> = {}): Line {
  const groups = product ? normalizeOptionGroups(product) : [];
  const selections = Object.fromEntries(groups.map(group => [group.key, group.options[0] || ""]));
  const primary = product?.product_images.find(image => image.is_primary) || product?.product_images[0];
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, productId: product?.id || "", quantity: product?.moq || 1, selections, customValues: {}, preferredImageIds: primary ? [primary.id] : [], requirements: "", ...overrides };
}

function readPrefill(search: string, product: Product) {
  const params = new URLSearchParams(search);
  const groups = normalizeOptionGroups(product);
  const selections: Record<string, string> = {};
  for (const group of groups) {
    const value = params.get(group.key) || (group.key === "color" ? params.get("color") : group.key === "size" ? params.get("size") : group.key === "packaging" ? params.get("packaging") : group.key === "customization" ? params.get("customization") : null);
    if (value && group.options.includes(value)) selections[group.key] = value;
  }
  return { quantity: Math.max(product.moq, Number(params.get("qty")) || product.moq), selections };
}

export default function QuoteRequest() {
  const [location] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [overallRequirements, setOverallRequirements] = useState("");
  const [contact, setContact] = useState<ContactDetails>({ name: "", company: "", email: "", phone: "", whatsapp: "", address: "" });
  const [submittedRef, setSubmittedRef] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const productParam = productSlugFromLocation(`${location}${window.location.search}`);

  useEffect(() => {
    if (!supabase) { setLoadingProducts(false); return; }
    let active = true;
    void supabase.from("products").select("id,slug,name,category,moq,description,option_groups,colors,sizes,packaging_options,customization_options,product_images(id,public_url,is_primary,sort_order,alt_text)").eq("is_active", true).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setSubmitError(error.message);
      const nextProducts = (data || []).map((product: any) => ({ ...product, product_images: Array.isArray(product.product_images) ? [...product.product_images].sort((a: ProductImage, b: ProductImage) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order) : [] })) as Product[];
      setProducts(nextProducts);
      setLoadingProducts(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    setContact(current => ({ ...current, name: current.name || user.name, email: current.email || user.email || "" }));
  }, [user]);

  useEffect(() => {
    if (!products.length) return;
    const selected = products.find(product => product.slug === productParam) || products[0];
    setLines(current => {
      if (current.length !== 1 || current[0]?.productId) return current;
      const prefill = selected.slug === productParam ? readPrefill(window.location.search, selected) : {};
      return [newLine(selected, prefill)];
    });
  }, [products, productParam]);

  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const updateLine = (id: string, patch: Partial<Line>) => setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line));
  const updateSelection = (line: Line, group: ProductOptionGroup, value: string) => updateLine(line.id, { selections: { ...line.selections, [group.key]: value } });
  const updateCustomValue = (line: Line, group: ProductOptionGroup, value: string) => updateLine(line.id, { customValues: { ...line.customValues, [group.key]: value } });
  const toggleImage = (line: Line, imageId: string) => updateLine(line.id, { preferredImageIds: line.preferredImageIds.includes(imageId) ? line.preferredImageIds.filter(id => id !== imageId) : [...line.preferredImageIds, imageId] });
  const addLine = () => setLines(current => [...current, newLine(products[0])]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (!user) return setSubmitError("Please sign in before submitting a quote request.");
    if (!lines.length || lines.some(line => !line.productId)) return setSubmitError("Choose a product for every request line.");
    const invalidMoq = lines.find(line => line.quantity < (productById.get(line.productId)?.moq || 1));
    if (invalidMoq) return setSubmitError("Every quantity must meet the selected product's MOQ.");
    if (overallRequirements.trim().length < 10) return setSubmitError("Tell us what you need in at least a few words so we can prepare an accurate quote.");
    setSubmitting(true);
    try {
      const ref = `WR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const client = supabase!;
      const { data: request, error: requestError } = await client.from("quote_requests").insert({ ref, customer_id: user.uid, status: "pending", notes: overallRequirements.trim(), requirements: overallRequirements.trim(), company_name: contact.company.trim() || null, contact_email: contact.email.trim() || user.email, contact_phone: contact.phone.trim() || null, whatsapp: contact.whatsapp.trim() || null, delivery_address: contact.address.trim() || null }).select("id,ref").single();
      if (requestError || !request) throw requestError || new Error("The quote request could not be created.");
      const itemRows = lines.map(line => {
        const customFormValue = Object.entries(line.customValues).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value.trim()}`).join("; ");
        return { quote_request_id: request.id, product_id: line.productId, quantity: line.quantity, color: line.selections.color || "", size: line.selections.size || "", packaging: line.selections.packaging || "", customization: line.selections.customization || "", option_selections: line.selections, custom_form_value: customFormValue || null, requirements: line.requirements.trim() || null, preferred_image_ids: line.preferredImageIds };
      });
      const { error: itemError } = await client.from("quote_request_items").insert(itemRows);
      if (itemError) {
        await client.from("quote_requests").delete().eq("id", request.id);
        throw itemError;
      }
      setSubmittedRef(request.ref);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Unable to submit the quote request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loadingProducts) return <div className="confirmation-page"><Loader2 className="spin"/><h1>Preparing your request…</h1><p>Loading live products and their available options.</p></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">REQUEST A QUOTE</span><h1>Sign in to build a quote.</h1><p>Sign in so we can save your requirements and send the quotation to your account.</p><Link href="/login?next=/quote" className="button button-primary">Sign in to continue <ArrowRight size={16}/></Link></div>;
  if (submittedRef) return <div className="app-shell"><header className="site-header"><Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link></header><main className="confirmation-page"><div className="success-mark"><Check size={27}/></div><span className="eyebrow">REQUEST RECEIVED</span><h1>Your quote is on its way.</h1><p>We received your specifications and will review the details before preparing a quotation.</p><div className="reference-card"><span>Request reference</span><strong>{submittedRef}</strong><small>Track it from your workspace.</small></div><div className="hero-actions"><Link href="/dashboard" className="button button-primary">View my quotes <ArrowRight size={16}/></Link><Link href="/products" className="button button-secondary">Browse more products</Link></div></main></div>;

  return <div className="app-shell"><header className="site-header"><Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link><nav className="main-nav"><Link href="/">Home</Link><Link href="/products">Products</Link><Link className="active" href="/quote">Request a Quote</Link><Link href="/dashboard">My Workspace</Link></nav><Link href="/dashboard" className="avatar">AB</Link></header><main className="page-container narrow quote-page"><Link href="/products" className="back-link"><ArrowLeft size={15}/> Back to products</Link><div className="page-kicker"><span className="eyebrow">REQUEST A QUOTE</span><span className="step-progress"><i/><i/><i/></span></div><div className="quote-page-heading"><div><h1>Tell us exactly what you need.</h1><p className="page-lede">Choose the products, options, and image references you prefer. Then use the requirements box to describe anything else our sourcing team should know.</p></div><span className="quote-secure-note">Your request is saved to your workspace.</span></div><form onSubmit={submit}><section className="form-section"><div className="form-section-heading"><div><span className="eyebrow">01 / PRODUCT REQUIREMENTS</span><h2>Build your request</h2></div><button type="button" className="button button-secondary small" onClick={addLine} disabled={!products.length}><Plus size={15}/> Add another product</button></div>{lines.map((line, index) => { const product = productById.get(line.productId); const groups = product ? normalizeOptionGroups(product) : []; return <div className="quote-line enhanced-quote-line" key={line.id}><div className="quote-line-top"><span className="line-number">{String(index + 1).padStart(2, "0")}</span><div className="quote-line-title"><strong>{product?.name || "Choose a product"}</strong>{product && <span>{product.category} · MOQ {product.moq}</span>}</div>{lines.length > 1 && <button type="button" className="remove-line" onClick={() => setLines(current => current.filter(item => item.id !== line.id))}><Trash2 size={15}/> Remove</button>}</div><div className="form-grid"><label className="field wide">Product<select value={line.productId} onChange={event => { const next = productById.get(event.target.value); if (next) { const prefill = newLine(next); updateLine(line.id, { productId: next.id, quantity: next.moq, selections: prefill.selections, customValues: {}, preferredImageIds: prefill.preferredImageIds, requirements: "" }); } }}><option value="">Choose a live catalogue product</option>{products.map(item => <option key={item.id} value={item.id}>{item.name} · MOQ {item.moq}</option>)}</select></label><label className="field">Quantity<input type="number" min={product?.moq || 1} value={line.quantity} onChange={event => updateLine(line.id, { quantity: Math.max(product?.moq || 1, Number(event.target.value) || 1) })}/><small>{product ? `Minimum order: ${product.moq}` : "Select a product first"}</small></label>{groups.map(group => <label className="field" key={group.key}>{group.label}<select value={line.selections[group.key] || ""} onChange={event => updateSelection(line, group, event.target.value)}><option value="">Choose {group.label.toLowerCase()}</option>{group.options.map(option => <option key={option}>{option}</option>)}<option value="__other__">Other / not listed</option></select>{line.selections[group.key] === "__other__" && <input className="nested-option-input" value={line.customValues[group.key] || ""} onChange={event => updateCustomValue(line, group, event.target.value)} placeholder={`Enter ${group.label.toLowerCase()}`}/>}</label>)}{product && product.product_images.length > 0 && <div className="field wide preferred-images-field"><div className="field-heading"><span>Preferred product images</span><small>Select one or more views you prefer.</small></div><div className="preferred-image-grid">{product.product_images.map((image, imageIndex) => <button type="button" className={`preferred-image ${line.preferredImageIds.includes(image.id) ? "selected" : ""}`} aria-pressed={line.preferredImageIds.includes(image.id)} onClick={() => toggleImage(line, image.id)} key={image.id}><img src={image.public_url} alt={image.alt_text || `${product.name} view ${imageIndex + 1}`}/><span>{line.preferredImageIds.includes(image.id) ? <Check size={13}/> : <ImageIcon size={13}/>} View {imageIndex + 1}</span></button>)}</div></div>}<label className="field wide requirements-field"><span>What should we know about this product?</span><small>Include dimensions, materials, branding, color breakdown, deadline, or anything not covered above.</small><textarea rows={5} value={line.requirements} onChange={event => updateLine(line.id, { requirements: event.target.value })} placeholder="Write the complete product-specific requirements here…"/></label></div></div>; })}</section><section className="form-section overall-requirements-section"><div className="form-section-heading"><div><span className="eyebrow">02 / YOUR BRIEF</span><h2>Tell us everything else</h2></div><ChevronDown size={20} color="var(--green)"/></div><label className="field wide requirements-field main-requirements-field"><span>Overall request requirements <strong>*</strong></span><small>Use this space for shared instructions, intended use, delivery destination, timing, target budget, and any request that applies to the full order.</small><textarea required minLength={10} rows={8} value={overallRequirements} onChange={event => setOverallRequirements(event.target.value)} placeholder="Example: We need a mixed wholesale order for a school campaign arriving before…"/></label></section><section className="form-section"><div className="form-section-heading"><div><span className="eyebrow">03 / CONTACT AND DELIVERY</span><h2>Where should we send the quote?</h2></div></div><div className="form-grid"><label className="field">Full name<input required value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} placeholder="Your name"/></label><label className="field">Company<input value={contact.company} onChange={event => setContact({ ...contact, company: event.target.value })} placeholder="Company or store name"/></label><label className="field">Work email<input required type="email" value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} placeholder="you@company.com"/></label><label className="field">Phone number<input required value={contact.phone} onChange={event => setContact({ ...contact, phone: event.target.value })} placeholder="+234 …"/></label><label className="field">WhatsApp number<input value={contact.whatsapp} onChange={event => setContact({ ...contact, whatsapp: event.target.value })} placeholder="If different"/></label><label className="field wide">Delivery address<textarea required rows={3} value={contact.address} onChange={event => setContact({ ...contact, address: event.target.value })} placeholder="Street, city, state, country"/></label></div></section>{submitError && <p className="form-error" role="alert">{submitError}</p>}<div className="form-submit-row"><span className="quote-form-footnote">We will review the request before sending pricing.</span><button className="button button-primary" type="submit" disabled={submitting || !products.length}>{submitting ? <><Loader2 className="spin" size={16}/> Sending request…</> : <>Submit quote request <ArrowRight size={16}/></>}</button></div></form></main></div>;
}
