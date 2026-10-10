import { getSupabaseClient } from "@/lib/supabase";

/* Read-only queries for the customer and admin overview screens, straight from Supabase (RLS applies). */

export type AdminCounts = { quoteRequests: number; pendingRequests: number; quotations: number; invoices: number; orders: number };

async function countRows(table: string, filter?: (query: any) => any): Promise<number> {
  let query = getSupabaseClient().from(table).select("id", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchAdminCounts(): Promise<AdminCounts> {
  const [quoteRequests, pendingRequests, quotations, invoices, orders] = await Promise.all([
    countRows("quote_requests"),
    countRows("quote_requests", query => query.eq("status", "pending")),
    countRows("quotations"),
    countRows("invoices"),
    countRows("orders"),
  ]);
  return { quoteRequests, pendingRequests, quotations, invoices, orders };
}

export type RecentRequest = { id: string; ref: string; status: string; created_at: string; company_name: string | null; contact_email: string | null };

export async function fetchRecentRequests(limit = 6): Promise<RecentRequest[]> {
  const { data, error } = await getSupabaseClient()
    .from("quote_requests")
    .select("id,ref,status,created_at,company_name,contact_email")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentRequest[];
}

export type OrderToWatch = { id: string; status: string; carrier: string | null; tracking_number: string | null; created_at: string };

export async function fetchOrdersToWatch(limit = 5): Promise<OrderToWatch[]> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .select("id,status,carrier,tracking_number,created_at")
    .in("status", ["processing", "shipped"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as OrderToWatch[];
}

export type AppNotification = { id: string; title: string; body: string | null; created_at: string; read_at: string | null };

/** Filtered to the signed-in user explicitly: admins can read every row, but this screen is personal. */
export async function fetchNotifications(userId: string, limit = 6): Promise<AppNotification[]> {
  const { data, error } = await getSupabaseClient()
    .from("notifications")
    .select("id,title,body,created_at,read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}
