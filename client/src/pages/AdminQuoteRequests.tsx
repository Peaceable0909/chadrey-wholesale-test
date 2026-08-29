import { useEffect, useMemo, useState } from "react";
import {ArrowLeft, ChevronDown, ChevronRight, Image as ImageIcon, Loader2, MessageSquare, PackageSearch, ArrowRight, ArrowLeftToLine, ShieldCheck} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";

type RequestRow = { id: string; ref: string; status: string; customer_id: string; requirements: string | null; company_name: string | null; contact_email: string | null; contact_phone: string | null; whatsapp: string | null; delivery_address: string | null; created_at: string };
type ItemRow = { id: string; quote_request_id: string; product_id: string; quantity: number; color: string; size: string; packaging: string; customization: string; option_selections: Record<string, string> | null; custom_form_value: string | null; requirements: string | null; preferred_image_ids: string[] | null };
type ProductRow = { id: string; name: string; category: string; moq: number; product_images: Array<{ id: string; public_url: string; sort_order: number }> };

type RequestDetails = RequestRow & { items: Array<ItemRow & { product?: ProductRow }> };
const meaningful = (value: string | null | undefined) => Boolean(value && value.trim());

export default function AdminQuoteRequests() {
  const { user, loading } = useAuth();
  const [requests, setRequests] = useState<RequestDetails[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") return;
    let active = true;
    setLoadingRequests(true);
    void (async () => {
      const client = getSupabaseClient();
      const [requestResult, itemResult, productResult] = await Promise.all([
        client.from("quote_requests").select("id,ref,status,customer_id,requirements,company_name,contact_email,contact_phone,whatsapp,delivery_address,created_at").order("created_at", { ascending: false }),
        client.from("quote_request_items").select("id,quote_request_id,product_id,quantity,color,size,packaging,customization,option_selections,custom_form_value,requirements,preferred_image_ids"),
        client.from("products").select("id,name,category,moq,product_images(id,public_url,sort_order)")
      ]);
      if (!active) return;
      const requestError = requestResult.error || itemResult.error || productResult.error;
      if (requestError) { setError(requestError.message); setLoadingRequests(false); return; }
      const products = new Map(((productResult.data || []) as ProductRow[]).map(product => [product.id, product]));
      const itemsByRequest = new Map<string, Array<ItemRow & { product?: ProductRow }>>();
      for (const item of (itemResult.data || []) as ItemRow[]) {
        const current = itemsByRequest.get(item.quote_request_id) || [];
        current.push({ ...item, product: products.get(item.product_id) });
        itemsByRequest.set(item.quote_request_id, current);
      }
      const next = ((requestResult.data || []) as RequestRow[]).map(request => ({ ...request, items: itemsByRequest.get(request.id) || [] }));
      setRequests(next);
      setSelectedId(current => current || next[0]?.id || "");
      setLoadingRequests(false);
    })();
    return () => { active = false; };
  }, [user]);

  const selected = useMemo(() => requests.find(request => request.id === selectedId), [requests, selectedId]);
  if (loading) return <div className="confirmation-page"><Loader2 className="spin"/><h1>Loading operations…</h1></div>;
  if (!user) return <div className="confirmation-page admin-gate"><Link href="/" className="back-link"><ArrowLeftToLine size={14}/> Back to Chadrey Wholesale</Link><span className="success-mark neutral"><ShieldCheck size={26}/></span><span className="eyebrow">QUOTE INBOX</span><h1>Admin sign-in required.</h1><p>Use your Supabase administrator account to access the operations workspace. If you don't have access yet, ask a Chadrey Wholesale administrator to add you.</p><Link href="/admin/login" className="button button-primary">Sign in to operations <ArrowRight size={16}/></Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page admin-gate"><Link href="/" className="back-link"><ArrowLeftToLine size={14}/> Back to Chadrey Wholesale</Link><span className="success-mark neutral"><ShieldCheck size={26}/></span><span className="eyebrow">ADMIN OPERATIONS</span><h1>Access restricted.</h1><p>This workspace is available to Chadrey Wholesale administrators only.</p><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;

  return <div className="workspace"><aside className="workspace-sidebar admin-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><span className="sidebar-label">OPERATIONS</span><Link className="sidebar-link" href="/admin">Overview</Link><Link className="sidebar-link active" href="/admin/quotes"><PackageSearch size={16}/> Quote requests</Link><Link className="sidebar-link" href="/admin/quote"><MessageSquare size={16}/> Quotations</Link><span className="sidebar-label">DIRECTORY</span><Link className="sidebar-link" href="/admin/products">Products</Link><Link className="sidebar-link" href="/admin/users">Users</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/">← Back to store</Link></div></aside><main className="workspace-main admin-quote-main"><header className="workspace-header compact-workspace-header"><div><Link href="/admin" className="back-link"><ArrowLeft size={15}/> Back to operations</Link><span className="eyebrow">OPERATIONS / QUOTE INBOX</span><h1>Review quote requests.</h1><p>Read the customer brief and product preferences before preparing pricing.</p></div></header>{error && <p className="form-error" role="alert">{error}</p>}{loadingRequests ? <div className="admin-inline-loading"><Loader2 className="spin" size={18}/> Loading quote requests…</div> : requests.length === 0 ? <section className="workspace-panel empty-state"><PackageSearch size={26}/><h3>No live quote requests</h3><p>New customer requests will appear here once submitted.</p></section> : <div className="quote-review-layout"><section className="workspace-panel quote-inbox-list"><div className="panel-heading"><div><span className="eyebrow">INBOX</span><h2>{requests.length} request{requests.length === 1 ? "" : "s"}</h2></div></div>{requests.map(request => <button type="button" className={`quote-inbox-row ${selectedId === request.id ? "selected" : ""}`} key={request.id} onClick={() => setSelectedId(request.id)}><div><strong>{request.ref}</strong><span>{request.company_name || request.contact_email || "Customer account"}</span><small>{new Date(request.created_at).toLocaleDateString()} · {request.items.length} line{request.items.length === 1 ? "" : "s"}</small></div><span className={`status-pill ${request.status === "pending" ? "amber" : "green"}`}>{request.status}</span>{selectedId === request.id ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button>)}</section>{selected && <section className="workspace-panel quote-review-detail"><div className="panel-heading"><div><span className="eyebrow">REQUEST / {selected.ref}</span><h2>{selected.company_name || "Customer request"}</h2><p className="panel-helper">Received {new Date(selected.created_at).toLocaleString()}</p></div><span className={`status-pill ${selected.status === "pending" ? "amber" : "green"}`}>{selected.status}</span></div><div className="quote-review-content"><div className="review-contact-grid"><div><span>Contact</span><strong>{selected.contact_email || "Not provided"}</strong><small>{selected.contact_phone || selected.whatsapp || "No phone provided"}</small></div><div><span>Delivery</span><strong>{selected.delivery_address || "Not provided"}</strong></div></div><div className="review-brief"><span className="editor-section-label">CUSTOMER BRIEF</span><p>{selected.requirements || "No overall brief was provided."}</p></div><div className="review-lines"><span className="editor-section-label">PRODUCT LINES</span>{selected.items.map((item, index) => { const preferred = new Set(item.preferred_image_ids || []); const images = item.product?.product_images?.filter(image => preferred.has(image.id)).sort((a, b) => a.sort_order - b.sort_order) || []; const optionEntries = Object.entries(item.option_selections || {}).filter(([, value]) => meaningful(value) && value !== "__other__"); return <article className="review-line" key={item.id}><div className="review-line-header"><span className="line-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{item.product?.name || "Product unavailable"}</h3><span>{item.product?.category || ""} · Quantity {item.quantity} · MOQ {item.product?.moq || "—"}</span></div></div>{images.length > 0 && <div className="review-image-strip">{images.map(image => <img key={image.id} src={image.public_url} alt={`${item.product?.name || "Product"} preferred view`}/>)}</div>}<div className="review-option-list">{optionEntries.map(([key, value]) => <span key={key}><b>{key.replace(/-/g, " ")}:</b> {value}</span>)}{meaningful(item.custom_form_value) && <span><b>Other form:</b> {item.custom_form_value}</span>}{!optionEntries.length && !meaningful(item.custom_form_value) && <span>Options not specified.</span>}</div><p className="review-requirements">{item.requirements || "No product-specific requirements."}</p></article>})}</div><div className="review-detail-actions"><Link href={`/messages?quoteId=${selected.id}`} className="button button-secondary"><MessageSquare size={15}/> Ask a question</Link><Link href={`/admin/quote?quoteId=${selected.id}`} className="button button-primary">Prepare quotation <ChevronRight size={15}/></Link></div></div></section>}</div>}</main></div>;
}
