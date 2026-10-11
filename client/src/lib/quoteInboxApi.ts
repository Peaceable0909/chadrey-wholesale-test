import type { Product } from "@/lib/catalogue";
import { fetchAdminProductsByIds } from "@/lib/catalogueApi";
import { getSupabaseClient } from "@/lib/supabase";

export type InboxItem = {
  id: string;
  quote_request_id: string;
  product_id: string;
  quantity: number;
  option_selections: Record<string, string> | null;
  custom_form_value: string | null;
  requirements: string | null;
  preferred_image_ids: string[] | null;
  product: Product | null;
};

export type InboxRequest = {
  id: string;
  ref: string;
  status: string;
  customer_id: string;
  requirements: string | null;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  delivery_address: string | null;
  created_at: string;
  items: InboxItem[];
};

/** The most recent requests, and only the lines and products they actually refer to. */
export const INBOX_LIMIT = 100;

export async function fetchQuoteInbox(): Promise<InboxRequest[]> {
  const client = getSupabaseClient();
  const requestResult = await client
    .from("quote_requests")
    .select("id,ref,status,customer_id,requirements,company_name,contact_email,contact_phone,whatsapp,delivery_address,created_at")
    .order("created_at", { ascending: false })
    .limit(INBOX_LIMIT);
  if (requestResult.error) throw requestResult.error;
  const requests = (requestResult.data ?? []) as Array<Omit<InboxRequest, "items">>;
  if (!requests.length) return [];

  const itemResult = await client
    .from("quote_request_items")
    .select("id,quote_request_id,product_id,quantity,option_selections,custom_form_value,requirements,preferred_image_ids")
    .in("quote_request_id", requests.map(request => request.id));
  if (itemResult.error) throw itemResult.error;
  const items = (itemResult.data ?? []) as Array<Omit<InboxItem, "product">>;

  // Products now live in the shop's own database, not next to the quote requests, so they are looked up by id.
  const products = new Map((await fetchAdminProductsByIds(items.map(item => item.product_id))).map(product => [product.id, product]));

  const byRequest = new Map<string, InboxItem[]>();
  for (const item of items) {
    const list = byRequest.get(item.quote_request_id) ?? [];
    list.push({ ...item, product: products.get(item.product_id) ?? null });
    byRequest.set(item.quote_request_id, list);
  }
  return requests.map(request => ({ ...request, items: byRequest.get(request.id) ?? [] }));
}
