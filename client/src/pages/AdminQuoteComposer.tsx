import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileCheck2, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";

type RequestSummary = { id: string; ref: string; status: string; company_name: string | null; contact_email: string | null; requirements: string | null };
type ItemSummary = { quantity: number; product: { name: string } | null };

export default function AdminQuoteComposer() {
  const [location, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const quoteRequestId = new URLSearchParams(`${location}${window.location.search}`.split("?")[1] || "").get("quoteId") || "";
  const [request, setRequest] = useState<RequestSummary | null>(null);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [subtotal, setSubtotal] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin" || !quoteRequestId) { setLoadingRequest(false); return; }
    let active = true;
    void (async () => {
      const client = getSupabaseClient();
      const [requestResult, itemResult] = await Promise.all([
        client.from("quote_requests").select("id,ref,status,company_name,contact_email,requirements").eq("id", quoteRequestId).single(),
        client.from("quote_request_items").select("quantity,products(name)").eq("quote_request_id", quoteRequestId)
      ]);
      if (!active) return;
      if (requestResult.error) setError(requestResult.error.message);
      else setRequest(requestResult.data as RequestSummary);
      if (!itemResult.error) setItems(((itemResult.data || []) as any[]).map(item => ({ quantity: item.quantity, product: Array.isArray(item.products) ? item.products[0] || null : item.products })));
      setLoadingRequest(false);
    })();
    return () => { active = false; };
  }, [user, quoteRequestId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !request) return;
    setSaving(true); setError("");
    try {
      const client = getSupabaseClient();
      const { error: quotationError } = await client.from("quotations").insert({ quote_request_id: request.id, currency: "NGN", subtotal: Number(subtotal), notes: notes.trim() || null, issued_by: user.uid, status: "sent", expires_at: dueDate ? `${dueDate}T23:59:59Z` : null });
      if (quotationError) throw quotationError;
      const { error: requestError } = await client.from("quote_requests").update({ status: "quoted" }).eq("id", request.id);
      if (requestError) throw requestError;
      setCreated(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to issue the quotation.");
    } finally { setSaving(false); }
  }

  if (authLoading || loadingRequest) return <div className="confirmation-page"><Loader2 className="spin"/><h1>Loading request…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">QUOTATION</span><h1>Admin sign-in required.</h1><Link href="/admin/login" className="button button-primary">Sign in to operations</Link></div>;
  if (user.role !== "admin") return <div className="confirmation-page"><h1>Access restricted.</h1><Link href="/dashboard" className="button button-secondary">Back to workspace</Link></div>;
  if (!quoteRequestId || !request) return <div className="confirmation-page"><span className="eyebrow">QUOTATION</span><h1>Quote request not found.</h1><p>Open a request from the quote inbox before preparing a quotation.</p><Link href="/admin/quotes" className="button button-primary">Open quote inbox <ArrowRight size={16}/></Link></div>;
  if (created) return <div className="confirmation-page"><div className="success-mark"><Check size={27}/></div><span className="eyebrow">QUOTATION ISSUED</span><h1>The quotation is ready.</h1><p>The customer can now review the quotation for request {request.ref}.</p><Link href="/admin/quotes" className="button button-primary">Back to quote inbox <ArrowRight size={16}/></Link></div>;

  return <div className="app-shell"><header className="site-header reference-header"><Link href="/" className="brand"><span className="brand-mark">C</span><span>CHADREY<small>OPERATIONS</small></span></Link><nav className="main-nav"><Link href="/admin">Operations</Link><Link className="active" href="/admin/quotes">Quote inbox</Link></nav><span className="avatar admin-avatar">AD</span></header><main className="page-container narrow"><Link href="/admin/quotes" className="back-link"><ArrowLeft size={15}/> Back to quote inbox</Link><span className="eyebrow">REQUEST / {request.ref}</span><h1>Prepare a quotation.</h1><p className="page-lede">Price the reviewed customer request without losing its requirements or product context.</p><section className="quote-compose-summary"><div><span>Customer</span><strong>{request.company_name || request.contact_email || "Customer account"}</strong></div><div><span>Product lines</span><strong>{items.length} line{items.length === 1 ? "" : "s"} · {items.reduce((total, item) => total + item.quantity, 0)} units</strong></div><p>{request.requirements || "No overall brief provided."}</p></section><form onSubmit={submit} className="form-section"><div className="form-section-heading"><div><span className="eyebrow">COMMERCIAL TERMS</span><h2>Quotation details</h2></div><FileCheck2 size={21} color="var(--green)"/></div><div className="form-grid"><label className="field">Subtotal / total<input required min="0" step="0.01" type="number" value={subtotal} onChange={event => setSubtotal(event.target.value)} placeholder="e.g. 428000"/></label><label className="field">Valid until<input required type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label><label className="field wide">Notes for customer<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Lead time, production notes, validity period, or payment terms"/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-submit-row"><Link className="text-button" href="/admin/quotes">Cancel</Link><button className="button button-primary" type="submit" disabled={saving}>{saving ? <><Loader2 className="spin" size={16}/> Issuing…</> : <>Issue quotation for review <ArrowRight size={16}/></>}</button></div></form></main></div>;
}
