import { ArrowRight, Bell, ChevronRight, CircleCheck, Clock3, FileText, Package, Plus, WalletCards } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { getSupabaseClient } from "@/lib/supabase";
import { initialsFrom } from "@/lib/utils";
import { Link } from "wouter";
import { useEffect, useState } from "react";

type LiveQuote = { id: string; ref: string; status: string; createdAt: string; product: string; fileCount: number; requirements: string | null };

function SideNav() { return <aside className="workspace-sidebar"><Link href="/" className="workspace-logo"><span className="brand-mark">C</span><span>CHADREY<small>WHOLESALE</small></span></Link><span className="sidebar-label">WORKSPACE</span><Link className="sidebar-link active" href="/dashboard"><CircleCheck size={16}/> Overview</Link><Link className="sidebar-link" href="/dashboard#recent-requests"><FileText size={16}/> My quotes</Link><Link className="sidebar-link" href="/dashboard#recent-requests"><WalletCards size={16}/> Invoices</Link><Link className="sidebar-link" href="/orders"><Package size={16}/> Orders</Link><span className="sidebar-label">ACCOUNT</span><Link className="sidebar-link" href="/addresses">Addresses</Link><Link className="sidebar-link" href="/account">Account settings</Link><div className="sidebar-bottom"><Link className="sidebar-link" href="/">← Back to store</Link></div></aside>; }

export default function CustomerDashboard() {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [quotes, setQuotes] = useState<LiveQuote[]>([]);
  const { user, loading } = useAuth();
  const notificationQuery = trpc.notifications.mine.useQuery(undefined, { enabled: Boolean(user) });

  useEffect(() => {
    if (!user) { setQuotes([]); return; }
    let active = true;
    void (async () => {
      const client = getSupabaseClient();
      const [requestResult, itemResult, fileResult] = await Promise.all([
        client.from("quote_requests").select("id,ref,status,created_at,requirements").eq("customer_id", user.uid).order("created_at", { ascending: false }),
        client.from("quote_request_items").select("quote_request_id,products(name)"),
        client.from("quote_request_files").select("quote_request_id")
      ]);
      if (!active || requestResult.error) return;
      const names = new Map<string, string>();
      for (const item of (itemResult.data || []) as any[]) { const product = Array.isArray(item.products) ? item.products[0] : item.products; if (product?.name && !names.has(item.quote_request_id)) names.set(item.quote_request_id, product.name); }
      const files = new Map<string, number>();
      for (const file of (fileResult.data || []) as Array<{ quote_request_id: string }>) files.set(file.quote_request_id, (files.get(file.quote_request_id) || 0) + 1);
      setQuotes(((requestResult.data || []) as any[]).map(request => ({ id: request.id, ref: request.ref, status: request.status, createdAt: request.created_at, product: names.get(request.id) || "Quote request", fileCount: files.get(request.id) || 0, requirements: request.requirements })));
    })();
    return () => { active = false; };
  }, [user]);

  if (loading) return <div className="confirmation-page"><span className="eyebrow">CUSTOMER WORKSPACE</span><h1>Loading your workspace…</h1></div>;
  if (!user) return <div className="confirmation-page"><span className="eyebrow">CUSTOMER WORKSPACE</span><h1>Sign in to continue.</h1><p>Your quotes, invoices, orders, and saved details are attached to your secure workspace.</p><button className="button button-primary" onClick={() => startLogin()}>Sign in with Supabase <ArrowRight size={16}/></button></div>;

  return <div className="workspace"><SideNav/><main className="workspace-main"><header className="workspace-header"><div><span className="eyebrow">CUSTOMER WORKSPACE</span><h1>Good morning, {user.name?.split(" ")[0] || "there"}.</h1><p>Here is the latest on your sourcing activity.</p></div><div className="workspace-header-actions"><div className="notification-menu-wrap"><button className="icon-button" onClick={() => setNotificationOpen(value => !value)} aria-label="Open notifications"><Bell size={17}/><i/></button>{notificationOpen && <div className="notification-menu"><strong>Notifications</strong>{notificationQuery.data?.length ? notificationQuery.data.slice(0, 4).map(notification => <Link href="/dashboard#recent-requests" className="notification-menu-item" key={notification.id}><span className="notification-dot green"/><span>{notification.title}</span></Link>) : <span className="notification-menu-empty">No new updates.</span>}</div>}</div><Link href="/account" className="avatar" title={user.name}>{initialsFrom(user.name, user.email)}</Link></div></header><section className="dashboard-grid"><Link href="/dashboard#recent-requests" className="summary-card summary-highlight summary-card-link"><span className="summary-icon"><FileText size={17}/></span><span>Open quote requests</span><strong>{quotes.length}</strong><small>{quotes.length ? "Live from your account" : "No requests yet"}</small></Link><Link href="/dashboard#recent-requests" className="summary-card summary-card-link"><span className="summary-icon"><Clock3 size={17}/></span><span>Awaiting quotation</span><strong>{quotes.filter(quote => quote.status === "pending").length}</strong><small>{quotes.length ? "Live from your account" : "No live quotations"}</small></Link><Link href="/orders" className="summary-card summary-card-link"><span className="summary-icon"><Package size={17}/></span><span>Orders in progress</span><strong>0</strong><small>No live orders yet</small></Link></section><div className="workspace-columns"><section id="recent-requests" className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Recent requests</h2></div><Link href="/quote" className="button button-primary small"><Plus size={15}/> New request</Link></div><div className="quote-table">{quotes.length ? quotes.map(quote => { const tone = quote.status === "pending" ? "amber" : quote.status === "paid" ? "violet" : "green"; const action = quote.status === "quoted" ? "Review quotation" : "View request"; return <div className="quote-row" key={quote.ref}><div className={`status-symbol ${tone}`}><FileText size={17}/></div><div className="quote-row-main"><strong>{quote.ref}</strong><span>{quote.product}{quote.fileCount ? ` · ${quote.fileCount} reference file${quote.fileCount === 1 ? "" : "s"}` : ""}</span><small>{new Date(quote.createdAt).toLocaleDateString()}</small></div><div className={`status-pill ${tone}`}>{quote.status}</div><Link href={quote.status === "quoted" ? `/quotation?quoteId=${quote.id}` : "/dashboard#recent-requests"} className="row-action">{action}<ChevronRight size={15}/></Link></div>; }) : <div className="empty-state"><FileText size={22}/><p>No live quote requests yet.</p><Link href="/products" className="text-link">Browse products <ArrowRight size={15}/></Link></div>}</div><Link href="/dashboard#recent-requests" className="panel-footer">View all requests <ArrowRight size={15}/></Link></section><section className="workspace-panel notification-panel"><div className="panel-heading"><div><span className="eyebrow">NOTIFICATIONS</span><h2>Keep moving</h2></div><span className="unread-count">{notificationQuery.data?.length ?? 0} new</span></div>{notificationQuery.data?.length ? notificationQuery.data.slice(0, 3).map((notification, index) => <Link href="/dashboard#recent-requests" className="notification-item" key={notification.id}><span className={`notification-dot ${index === 0 ? "green" : "amber"}`}/><div><strong>{notification.title}</strong><p>{notification.body || "Chadrey Wholesale update"} · {new Date(notification.createdAt).toLocaleString()}</p></div></Link>) : <span className="notification-menu-empty">No new updates.</span>}<div className="timeline-card"><span className="eyebrow">ORDER TRACKING</span><h3>No live orders yet</h3><p>Your order milestones will appear here after an invoice is paid and an order is created.</p><Link href="/products" className="text-link">Browse products <ArrowRight size={15}/></Link></div></section></div></main></div>;
}
